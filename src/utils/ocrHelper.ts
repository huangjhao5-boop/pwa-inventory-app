import { createWorker } from 'tesseract.js';
import { UnitConversion } from '../types/inventory';
import { VisualKnowledgeService } from './visualKnowledgeService';

export interface OcrRecognizedData {
  rawText: string;
  suggestedName?: string;
  suggestedSpec?: string;
  suggestedSupplier?: string;
  suggestedCategory?: string;
  suggestedBoxName?: string;
  suggestedBaseUnit?: string;
  suggestedConversions?: UnitConversion[];
  isLearnedPattern?: boolean;
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

        const maxDim = 1400;
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

        canvas.width = width * 2;
        canvas.height = height * 2;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width * 2, height * 2);

        const imgData = ctx.getImageData(0, 0, width * 2, height * 2);
        const data = imgData.data;

        const total = data.length / 4;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avgBrightness = sum / total;
        const threshold = Math.min(180, Math.max(100, avgBrightness * 0.9));

        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = lum > threshold ? 255 : 0;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  }

  private static async getWorker() {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        try {
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
   * スマート単位・最小単位・包装倍率判定エンジン
   * 結束バンド・端子・電線・ネジなどの電工現場ルールから最小単位(個/本/m/巻/枚/組)と包装倍率を自動推定
   */
  static inferUnits(
    name: string,
    spec: string,
    rawText: string
  ): { baseUnit: string; conversions: UnitConversion[] } {
    const combined = `${name} ${spec} ${rawText}`.toLowerCase();

    let baseUnit = '個';
    let conversions: UnitConversion[] = [];

    // 1. 結束バンド / インシュロック系 ➔ 最小単位は「本」
    if (/インシュロック|結束バンド|タイラップ|ケーブルタイ|ty-rap/i.test(combined)) {
      baseUnit = '本';
      // 数量検出 (例: 100本入, 1000本)
      const matchQty = combined.match(/(\d+)\s*(本|pcs|p)/i);
      const bagQty = matchQty ? parseInt(matchQty[1], 10) : 100;
      conversions = [
        { unit: '袋', multiplier: bagQty > 0 ? bagQty : 100 },
        { unit: '箱', multiplier: (bagQty > 0 ? bagQty : 100) * 10 },
      ];
      return { baseUnit, conversions };
    }

    // 2. マークチューブ / 電線 / チューブ / テープ系 ➔ 最小単位は「m」または「巻」
    if (/マークチューブ|チューブ|電線|ケーブル|ビニルテープ|スパイラル/i.test(combined)) {
      if (/マークチューブ|電線|ケーブル/i.test(combined)) {
        baseUnit = 'm';
        const matchM = combined.match(/(\d+)\s*m/i);
        const rollM = matchM ? parseInt(matchM[1], 10) : 100;
        conversions = [
          { unit: '巻', multiplier: rollM > 0 ? rollM : 100 },
          { unit: '箱', multiplier: (rollM > 0 ? rollM : 100) * 5 },
        ];
        return { baseUnit, conversions };
      } else {
        baseUnit = '巻';
        conversions = [
          { unit: '箱', multiplier: 10 },
          { unit: '袋', multiplier: 5 },
        ];
        return { baseUnit, conversions };
      }
    }

    // 3. 銘板 / ラベル / プレート / カバー系 ➔ 最小単位は「枚」
    if (/銘板|ラベル|プレート|シート|カバー/i.test(combined)) {
      baseUnit = '枚';
      conversions = [
        { unit: '組', multiplier: 10 },
        { unit: '袋', multiplier: 50 },
        { unit: '箱', multiplier: 200 },
      ];
      return { baseUnit, conversions };
    }

    // 4. 端子台組品 / ソケットセット ➔ 最小単位は「組」
    if (/組品|セット|ソケット組/i.test(combined)) {
      baseUnit = '組';
      conversions = [
        { unit: '箱', multiplier: 10 },
        { unit: '個', multiplier: 1 },
      ];
      return { baseUnit, conversions };
    }

    // 5. 圧着端子 / フェルール端子 / ネジ / ボルト / ヒューズ等 ➔ 最小単位は「個」
    baseUnit = '個';
    const matchQty = combined.match(/(\d+)\s*(個|入|pcs|p)/i);
    const packQty = matchQty ? parseInt(matchQty[1], 10) : 100;
    conversions = [
      { unit: '袋', multiplier: packQty > 0 ? packQty : 100 },
      { unit: '箱', multiplier: (packQty > 0 ? packQty : 100) * 10 },
      { unit: 'パック', multiplier: packQty > 0 ? packQty : 50 },
    ];

    return { baseUnit, conversions };
  }

  /**
   * 画像文字認識 + 現場学習キャッシュ照合 + 電工向けノイズ除去・パース
   */
  static async recognizeImage(imageSource: string): Promise<OcrRecognizedData> {
    try {
      // 1. まず現場AI学習記憶（VisualKnowledgeBank）と照合
      const learnedEntry = await VisualKnowledgeService.findMatchingEntry(imageSource);
      if (learnedEntry) {
        const units = this.inferUnits(learnedEntry.name, learnedEntry.spec || '', '');
        return {
          rawText: learnedEntry.name,
          suggestedName: learnedEntry.name,
          suggestedSpec: learnedEntry.spec,
          suggestedSupplier: learnedEntry.supplier,
          suggestedCategory: learnedEntry.category,
          suggestedBoxName: learnedEntry.boxName,
          suggestedBaseUnit: units.baseUnit,
          suggestedConversions: units.conversions,
          isLearnedPattern: true,
        };
      }

      // 2. OCR処理実行
      const processedSrc = await this.preprocessImage(imageSource);
      const worker = await this.getWorker();
      const ret = await worker.recognize(processedSrc);

      const rawText = ret.data.text || '';

      // ノイズ除去
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
      let suggestedCategory = '配線・電気資材';

      // 電工向け主要メーカーリスト（国内・海外メーカー完全網羅）
      const knownSuppliers: [string, string, string?][] = [
        ['HELLERMANNTYTON', 'ヘラマンタイトン', '配線・電気資材'],
        ['HELLERMANN', 'ヘラマンタイトン', '配線・電気資材'],
        ['ヘラマンタイトン', 'ヘラマンタイトン', '配線・電気資材'],
        ['インシュロック', 'ヘラマンタイトン', '配線・電気資材'],
        ['INSULOK', 'ヘラマンタイトン', '配線・電気資材'],
        ['NICHIFU', 'ニチフ', '配線・電気資材'],
        ['ニチフ', 'ニチフ', '配線・電気資材'],
        ['PANDUIT', 'パンドウイット', '配線・電気資材'],
        ['パンドウイット', 'パンドウイット', '配線・電気資材'],
        ['TOHO', 'TOHO', '配線・電気資材'],
        ['東邦', 'TOHO', '配線・電気資材'],
        ['NITTO', '日東電工', '配線・電気資材'],
        ['日東電工', '日東電工', '配線・電気資材'],
        ['MIRAI', '未来工業', '配線・電気資材'],
        ['未来工業', '未来工業', '配線・電気資材'],
        ['NEGROS', 'ネグロス電工', '配線・電気資材'],
        ['ネグロス', 'ネグロス電工', '配線・電気資材'],
        ['PANASONIC', 'パナソニック', '制御盤パーツ'],
        ['パナソニック', 'パナソニック', '制御盤パーツ'],
        ['MITSUBISHI', '三菱電機', '制御盤パーツ'],
        ['三菱電機', '三菱電機', '制御盤パーツ'],
        ['FUJI', '富士電機', '制御盤パーツ'],
        ['富士電機', '富士電機', '制御盤パーツ'],
        ['OMRON', 'オムロン', '制御盤パーツ'],
        ['オムロン', 'オムロン', '制御盤パーツ'],
        ['IDEC', 'IDEC', '制御盤パーツ'],
        ['WAGO', 'WAGO', '配線・電気資材'],
        ['PHOENIX', 'フエニックス・コンタクト', '配線・電気資材'],
        ['MISUMI', 'ミスミ', '機構・締結部品'],
        ['ミスミ', 'ミスミ', '機構・締結部品'],
        ['KEYENCE', 'キーエンス', '制御盤パーツ'],
        ['SMC', 'SMC', '空圧・流体機器'],
      ];

      // 型番パターン
      const specPatterns = [
        /AB[-_]?\d+[A-Z0-9\-]*/i,              // AB300, AB-150-W
        /[A-Z0-9]{1,6}[-][A-Z0-9\.\-]+/,      // AB150-W, R2-4, 1.25Y-3.5, TC-1.25
        /\d+(\.\d+)?\s*(mm|mm²|sq|AWG|V|A|W|kΩ|MΩ)/i,
        /M\d+\s*[xX×]\s*\d+/,                  // M6x20
        /\d+\s*[xX×]\s*\d+\s*[xX×]\s*\d+/,    // 3x5x10
        /SUS\d+|SS\d+/,
        /IP\d{2}/,
      ];

      for (const line of lines) {
        const upper = line.toUpperCase();

        // 1. メーカー比対
        if (!suggestedSupplier) {
          for (const [key, displayName, cat] of knownSuppliers) {
            if (upper.includes(key.toUpperCase())) {
              suggestedSupplier = displayName;
              if (cat) suggestedCategory = cat;
              break;
            }
          }
        }

        // 2. 規格型番比対
        if (!suggestedSpec) {
          for (const pattern of specPatterns) {
            const match = line.match(pattern);
            if (match) {
              suggestedSpec = match[0].trim();
              break;
            }
          }
        }

        // 3. 棚番・ボックス比対
        if (!suggestedBoxName && /[A-Z]-\d+|BOX[-_]?\d+|\d+號盒|棚\d+|棚番\d+|端子ボックス/i.test(line)) {
          suggestedBoxName = line;
        }

        // 4. 品名比対
        if (
          !suggestedName &&
          line.length >= 2 &&
          !knownSuppliers.some(([k]) => line.toUpperCase() === k) &&
          !specPatterns.some((p) => p.test(line))
        ) {
          suggestedName = line.replace(/\s+/g, ' ').trim();
        }
      }

      // インシュロック系の場合はメーカーを「ヘラマンタイトン」に補正
      if (!suggestedSupplier && (/インシュロック|AB\d+/i.test(rawText) || /インシュロック|AB\d+/i.test(suggestedSpec))) {
        suggestedSupplier = 'ヘラマンタイトン';
      }

      if (!suggestedName && lines.length > 0) {
        suggestedName = lines[0];
      }

      // 5. 最小単位・包装倍率の自動判定
      const units = this.inferUnits(suggestedName, suggestedSpec, rawText);

      return {
        rawText,
        suggestedName: suggestedName || undefined,
        suggestedSpec: suggestedSpec || undefined,
        suggestedSupplier: suggestedSupplier || undefined,
        suggestedCategory,
        suggestedBoxName: suggestedBoxName || undefined,
        suggestedBaseUnit: units.baseUnit,
        suggestedConversions: units.conversions,
      };
    } catch (err) {
      console.error('OCR recognition error:', err);
      return { rawText: '' };
    }
  }
}
