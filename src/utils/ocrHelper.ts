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

  private static async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        try {
          const worker = await createWorker('chi_tra+eng+jpn', 1, {
            logger: (m) => console.debug('OCR Progress:', m),
          });
          return worker;
        } catch (e) {
          console.warn('Failed to load full multi-lang OCR, falling back to eng:', e);
          const worker = await createWorker('eng', 1);
          return worker;
        }
      })();
    }
    return this.workerPromise;
  }

  /**
   * 圖片 OCR 文字識別與智慧欄位剖析
   */
  static async recognizeImage(imageSource: string | File): Promise<OcrRecognizedData> {
    try {
      const worker = await this.getWorker();
      const ret = await worker.recognize(imageSource);
      const rawText = ret.data.text || '';
      
      const lines = rawText
        .split('\n')
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 1);

      let suggestedName = '';
      let suggestedSpec = '';
      let suggestedSupplier = '';
      let suggestedBoxName = '';

      // 常見廠商關鍵字比對庫
      const knownSuppliers = [
        'MISUMI', 'ミスミ', 'SMC', 'OMRON', 'オムロン', 'NICHIFU', 'ニチフ',
        'PANDUIT', 'パンドウイット', 'DAITO', '大東通信機', 'NOK', 'KEYENCE',
        'キーエンス', 'THK', 'IKO', 'HIWIN', '上銀', '台達', 'DELTA', '三菱', 'MITSUBISHI'
      ];

      for (const line of lines) {
        // 1. 廠商比對
        for (const sup of knownSuppliers) {
          if (line.toUpperCase().includes(sup.toUpperCase())) {
            suggestedSupplier = sup;
            break;
          }
        }

        // 2. 規格型號比對 (包含數字、x、M、φ、mm、V、A 等特徵)
        if (!suggestedSpec && (/[MφΦ]\d+|(\d+(\.\d+)?\s*[xX*×]\s*\d+)|\d+mm|\d+V|\d+A/i.test(line))) {
          suggestedSpec = line;
          continue;
        }

        // 3. 盒子名稱/位置 (A-01, B-02, BOX-1 等)
        if (!suggestedBoxName && (/[A-Z]-\d+|BOX[-_]?\d+|盒\d+/i.test(line))) {
          suggestedBoxName = line;
          continue;
        }

        // 4. 品名 (非廠商且長度適中之第一行文字)
        if (!suggestedName && line.length >= 2 && !knownSuppliers.some(s => line.toUpperCase() === s)) {
          suggestedName = line;
        }
      }

      // 若未抓到品名，用第一行非空行
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
