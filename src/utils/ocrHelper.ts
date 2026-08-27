import { createWorker } from 'tesseract.js';

export interface OcrRecognizedData {
  rawText: string;
  suggestedName?: string;
  suggestedSpec?: string;
  suggestedSupplier?: string;
  suggestedBoxName?: string;
}

export class OcrHelper {
  private static workerPromise: Promise<any> | null = null;

  /**
   * 影像前處理（灰階 + 高對比二值化），大幅降低 OCR 雜訊與亂碼率
   */
  private static async preprocessImage(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSrc);

        // 限制最大寬度以加快辨識速度
        const maxDim = 1200;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 轉灰階並增強對比
        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // 簡單自適應二值化 (提高黑白文字清晰度)
          const val = avg > 120 ? Math.min(255, avg * 1.2) : Math.max(0, avg * 0.8);
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }

  private static async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        try {
          const worker = await createWorker('eng+chi_tra', 1);
          return worker;
        } catch {
          const worker = await createWorker('eng', 1);
          return worker;
        }
      })();
    }
    return this.workerPromise;
  }

  /**
   * 圖片文字辨識與去雜訊清洗
   */
  static async recognizeImage(imageSource: string): Promise<OcrRecognizedData> {
    try {
      const processedSrc = await this.preprocessImage(imageSource);
      const worker = await this.getWorker();
      const ret = await worker.recognize(processedSrc);
      
      const rawText = ret.data.text || '';
      
      // 清除無效雜訊亂碼（例如 @#^& 等無效符號）
      const lines = rawText
        .split('\n')
        .map((l: string) => l.replace(/[^\w\u4e00-\u9fa5\u3040-\u30ff\-\.\/\s\(\)\*xX×:]/g, '').trim())
        .filter((l: string) => l.length >= 2);

      let suggestedName = '';
      let suggestedSpec = '';
      let suggestedSupplier = '';
      let suggestedBoxName = '';

      const knownSuppliers = [
        'MISUMI', 'ミスミ', '米思米',
        'SMC',
        'OMRON', 'オムロン', '歐姆龍',
        'NICHIFU', 'ニチフ', '日富',
        'PANDUIT', 'パンドウイット', '泛達',
        'DAITO', '大東通信機',
        'NOK',
        'KEYENCE', 'キーエンス', '基恩斯',
        'THK', 'IKO', 'HIWIN', '上銀',
        'DELTA', '台達',
        'MITSUBISHI', '三菱',
        'NITTO', '日東電工'
      ];

      for (const line of lines) {
        // 1. 廠商比對
        for (const sup of knownSuppliers) {
          if (line.toUpperCase().includes(sup.toUpperCase())) {
            suggestedSupplier = sup;
            break;
          }
        }

        // 2. 規格型號比對 (M6x20, 24V, 5A, φ6, SUS304 等)
        if (!suggestedSpec && (/[MφΦ]\d+|(\d+(\.\d+)?\s*[xX*×]\s*\d+)|\d+mm|\d+V|\d+A|SUS\d+/i.test(line))) {
          suggestedSpec = line;
          continue;
        }

        // 3. 盒號 (1號盒, A-01, BOX-1)
        if (!suggestedBoxName && (/[A-Z]-\d+|BOX[-_]?\d+|\d+號盒/i.test(line))) {
          suggestedBoxName = line;
          continue;
        }

        // 4. 品名
        if (!suggestedName && line.length >= 2 && !knownSuppliers.some((s) => line.toUpperCase() === s)) {
          suggestedName = line;
        }
      }

      if (!suggestedName && lines.length > 0) {
        suggestedName = lines[0];
      }

      return {
        rawText,
        suggestedName: suggestedName || undefined,
        suggestedSpec: suggestedSpec || undefined,
        suggestedSupplier: suggestedSupplier || undefined,
        suggestedBoxName: suggestedBoxName || undefined,
      };
    } catch (err) {
      console.error('OCR recognition error:', err);
      return {
        rawText: '',
      };
    }
  }
}
