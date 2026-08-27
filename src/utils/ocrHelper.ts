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
   * 影像前処理：灰階化 + 高コントラスト二値化
   * - 電工ラベルは白地黒文字/黄地黒文字が多いため、対比を強調
   */
  private static async preprocessImage(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSrc);

        // スケールダウン（最大 1400px）
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
          else { width = Math.round((width * maxDim) / height); height = maxDim; }
        }

        // 2x アップスケールで読み取り精度向上
        canvas.width = width * 2;
        canvas.height = height * 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width * 2, height * 2);

        const imgData = ctx.getImageData(0, 0, width * 2, height * 2);
        const data = imgData.data;

        // 輝度計算 + 適応的二値化
        const total = data.length / 4;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avgBrightness = sum / total;

        // 閾値 = 平均輝度 * 0.9（暗い画像には低め）
        const threshold = Math.min(180, Math.max(100, avgBrightness * 0.9));

        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // 二値化（黒/白のみ）
          const val = lum > threshold ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png')); // PNG はロスレスで OCR 精度向上
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }

  private static async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        try {
          // 日本語 + 英語 (電工ラベルに最適)
          const worker = await createWorker('jpn+eng', 1);
          return worker;
        } catch {
          try {
            const worker = await createWorker('eng', 1);
            return worker;
          } catch {
            const worker = await createWorker();
            return worker;
          }
        }
      })();
    }
    return this.workerPromise;
  }

  /**
   * 画像文字認識 + 電工向けノイズ除去・パース
   */
  static async recognizeImage(imageSource: string): Promise<OcrRecognizedData> {
    try {
      const processedSrc = await this.preprocessImage(imageSource);
      const worker = await this.getWorker();
      const ret = await worker.recognize(processedSrc);

      const rawText = ret.data.text || '';

      // ノイズ除去（電工ラベルで不要な文字を除去）
      const lines = rawText
        .split('\n')
        .map((l: string) =>
          l
            .replace(/[^\w\u3000-\u9fff\u30a0-\u30ff\uff00-\uffef\-\.\/\s\(\)\*xX×:\+]/g, '')
            .trim()
        )
        .filter((l: string) => l.length >= 2 && !/^[.\-_\s]+$/.test(l));

      let suggestedName = '';
      let suggestedSpec = '';
      let suggestedSupplier = '';
      let suggestedBoxName = '';

      // 電工向け主要メーカーリスト（認識しやすい英字表記優先）
      const knownSuppliers: [string, string][] = [
        ['NICHIFU', 'NICHIFU'],
        ['PANDUIT', 'Panduit'],
        ['PHOENIX', 'Phoenix Contact'],
        ['WAGO', 'WAGO'],
        ['OMRON', 'OMRON'],
        ['MITSUBISHI', 'MITSUBISHI'],
        ['FUJI', 'Fuji Electric'],
        ['YOKOGAWA', 'Yokogawa'],
        ['IDEC', 'IDEC'],
        ['MISUMI', 'MISUMI'],
        ['KEYENCE', 'KEYENCE'],
        ['SMC', 'SMC'],
        ['NOK', 'NOK'],
        ['THK', 'THK'],
        ['NITTO', '日東電工'],
        ['ミスミ', 'MISUMI'],
        ['ニチフ', 'NICHIFU'],
        ['日富', 'NICHIFU'],
        ['オムロン', 'OMRON'],
        ['三菱', 'MITSUBISHI'],
        ['富士電機', 'Fuji Electric'],
        ['横河', 'Yokogawa'],
        ['日東電工', '日東電工'],
      ];

      // 型番パターン（電工部品に多い形式）
      const specPatterns = [
        /[A-Z]{1,4}[-]?\d+[-]?\d*[A-Z]*/,   // R2-4, AI-1.5, VD1.25-4
        /\d+(\.\d+)?\s*(mm|mm²|AWG|V|A|W|kΩ|MΩ)/i,
        /M\d+\s*[xX×]\s*\d+/,               // M6x20
        /\d+\s*[xX×]\s*\d+\s*[xX×]\s*\d+/, // 3x5x10
        /SUS\d+|SS\d+/,
        /IP\d{2}/,
        /\d{4,}/,                            // Part numbers
      ];

      for (const line of lines) {
        const upper = line.toUpperCase();

        // 1. 廠商比對
        if (!suggestedSupplier) {
          for (const [key, displayName] of knownSuppliers) {
            if (upper.includes(key.toUpperCase())) {
              suggestedSupplier = displayName;
              break;
            }
          }
        }

        // 2. 規格型番比對
        if (!suggestedSpec) {
          for (const pattern of specPatterns) {
            if (pattern.test(line)) {
              suggestedSpec = line.replace(/\s+/g, ' ').trim();
              break;
            }
          }
        }

        // 3. 盒號比對
        if (!suggestedBoxName && /[A-Z]-\d+|BOX[-_]?\d+|\d+號盒|棚\d+|棚番\d+/i.test(line)) {
          suggestedBoxName = line;
        }

        // 4. 品名（廠商名・型番でない、かつ 2 文字以上）
        if (!suggestedName && line.length >= 2
          && !knownSuppliers.some(([k]) => line.toUpperCase() === k)
          && !specPatterns.some((p) => p.test(line))
        ) {
          suggestedName = line.replace(/\s+/g, ' ').trim();
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
      return { rawText: '' };
    }
  }
}
