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
   * 影像前処理：グレースケール化 + コントラスト最適化（文字を潰す過剰な二値化を排除）
   */
  private static async preprocessImage(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(imageSrc);

        const maxDim = 1600;
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
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // グレースケール変換と適度なコントラスト強調（二値化で文字を消さない）
        for (let i = 0; i < data.length; i += 4) {
          const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          // コントラスト拡大 (0-255)
          const contrastGray = Math.min(255, Math.max(0, (gray - 128) * 1.25 + 128));
          data[i] = contrastGray;
          data[i + 1] = contrastGray;
          data[i + 2] = contrastGray;
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
   */
  static inferUnits(
    name: string,
    spec: string,
    rawText: string
  ): { baseUnit: string; conversions: UnitConversion[] } {
    const combined = `${name} ${spec} ${rawText}`.toUpperCase();

    // 1. 結束バンド・インシュロック
    if (/インシュロック|結束バンド|AB\d+|TY[-]?\d+|タイラップ/i.test(combined)) {
      return {
        baseUnit: '本',
        conversions: [
          { unit: '袋', multiplier: 100 },
          { unit: '箱', multiplier: 1000 },
          { unit: '本', multiplier: 1 },
        ],
      };
    }

    // 2. 圧着端子
    if (/端子|R\d+[-]\d+|Y\d+[-]\d+|1\.25Y|\d+\.\d+Y|丸形|Y形|裸圧着/i.test(combined)) {
      return {
        baseUnit: '個',
        conversions: [
          { unit: '箱', multiplier: 100 },
          { unit: '袋', multiplier: 100 },
          { unit: '個', multiplier: 1 },
        ],
      };
    }

    // 3. 中継端子ボックス・ボックス
    if (/中継|ボックス|BOX|BOXTM|JB[-_]?\d+|端子ボックス/i.test(combined)) {
      return {
        baseUnit: '個',
        conversions: [
          { unit: '箱', multiplier: 10 },
          { unit: '個', multiplier: 1 },
        ],
      };
    }

    // 4. 端子台
    if (/端子台|TX[-_]?\d+|TB[-_]?\d+|DIN/i.test(combined)) {
      return {
        baseUnit: '個',
        conversions: [
          { unit: '箱', multiplier: 10 },
          { unit: '個', multiplier: 1 },
        ],
      };
    }

    // 5. 電線・ケーブル
    if (/VVF|IV|CV|VCTF|電線|ケーブル|マークチューブ/i.test(combined)) {
      return {
        baseUnit: 'm',
        conversions: [
          { unit: '巻', multiplier: 100 },
          { unit: '箱', multiplier: 100 },
          { unit: 'm', multiplier: 1 },
        ],
      };
    }

    return {
      baseUnit: '個',
      conversions: [
        { unit: '箱', multiplier: 10 },
        { unit: '個', multiplier: 1 },
      ],
    };
  }

  /**
   * 画像から電工資材のテキスト・型番・メーカー・品名を解析抽出
   */
  static async recognizeImage(imageSource: string): Promise<OcrRecognizedData> {
    try {
      // 1. 現場学習記憶との照合
      const learnedMatch = await VisualKnowledgeService.findBestMatch(imageSource);
      if (learnedMatch.matchedEntry && learnedMatch.confidenceScore >= 55) {
        const entry = learnedMatch.matchedEntry;
        const units = this.inferUnits(entry.name, entry.spec || '', entry.baseUnit || '');
        return {
          rawText: `${entry.name} ${entry.spec || ''} ${entry.supplier || ''}`,
          suggestedName: entry.name,
          suggestedSpec: entry.spec,
          suggestedSupplier: entry.supplier,
          suggestedCategory: entry.category || '制御盤パーツ',
          suggestedBoxName: entry.boxName,
          suggestedBaseUnit: entry.baseUnit || units.baseUnit,
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
      let suggestedCategory = '制御盤パーツ';

      // 主要メーカー
      const knownSuppliers: [string, string, string?][] = [
        ['TOGI', '東洋技研', '制御盤パーツ'],
        ['東洋技研', '東洋技研', '制御盤パーツ'],
        ['KASUGA', '春日電機', '制御盤パーツ'],
        ['春日電機', '春日電機', '制御盤パーツ'],
        ['NITTO KOGYO', '日東工業', '制御盤パーツ'],
        ['日東工業', '日東工業', '制御盤パーツ'],
        ['TAKACHI', 'タカチ電機工業', '制御盤パーツ'],
        ['タカチ', 'タカチ電機工業', '制御盤パーツ'],
        ['TERADA', '寺田電機', '配線・電気資材'],
        ['寺田電機', '寺田電機', '配線・電気資材'],
        ['PATLITE', 'パトライト', '制御盤パーツ'],
        ['パトライト', 'パトライト', '制御盤パーツ'],
        ['NICHIFU', 'ニチフ', '端子・圧着具'],
        ['ニチフ', 'ニチフ', '端子・圧着具'],
        ['HELLERMANNTYTON', 'ヘラマンタイトン', '配線・電気資材'],
        ['HELLERMANN', 'ヘラマンタイトン', '配線・電気資材'],
        ['ヘラマンタイトン', 'ヘラマンタイトン', '配線・電気資材'],
        ['インシュロック', 'ヘラマンタイトン', '配線・電気資材'],
        ['INSULOK', 'ヘラマンタイトン', '配線・電気資材'],
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

      // 型番パターン（BOXTM-2001, JB-100, R2-4 等）
      const specPatterns = [
        /BOXTM[-_]?\d+[A-Z0-9\-]*/i,          // BOXTM-2001, BOXTM-1001
        /JB[-_]?\d+[A-Z0-9\-]*/i,             // JB-100, JB150
        /BOX[-_]?\d+[A-Z0-9\-]*/i,            // BOX-1, BOX-01
        /TX[-_]?\d+[A-Z0-9\-]*/i,             // TX-10, TX-20
        /TKB[-_]?\d+[A-Z0-9\-]*/i,            // TKB-15
        /TB[-_]?\d+[A-Z0-9\-]*/i,             // TB-15
        /TC[-_]?\d+[A-Z0-9\-]*/i,             // TC-1.25
        /OP[-_]?\d+[A-Z0-9\-]*/i,             // OP12-15A
        /AB[-_]?\d+[A-Z0-9\-]*/i,             // AB300, AB-150-W
        /[A-Z0-9]{2,8}[-][A-Z0-9\.\-]+/,     // BOXTM-2001, R2-4
        /\d+(\.\d+)?\s*(mm|mm²|sq|AWG|V|A|W|kΩ|MΩ|P|極)/i,
        /600V\s*15A/i,
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
        if (!suggestedBoxName && /[A-Z]-\d+|BOX[-_]?\d+|\d+號盒|棚\d+|棚番\d+|端子ボックス|盤内資材/i.test(line)) {
          suggestedBoxName = line;
        }
      }

      // 電工品目のスマート品名・カテゴリ補正
      if (/中継|JB[-_]?\d+|BOXTM|ボックス|BOX|端子ボックス|プルボックス/i.test(rawText) || /BOXTM/i.test(suggestedSpec)) {
        suggestedName = '中継端子ボックス';
        suggestedCategory = '制御盤パーツ';
        if (!suggestedBoxName) suggestedBoxName = '盤内資材 (D-01)';
        if (!suggestedSupplier && /TOGI|東洋技研/i.test(rawText)) suggestedSupplier = '東洋技研';
      } else if (/端子台|TKB|TX[-_]?\d+|TB[-_]?\d+|DINレール/i.test(rawText)) {
        suggestedName = '端子台';
        suggestedCategory = '制御盤パーツ';
      } else if (/圧着端子|丸形|Y形|R\d+[-]\d+|1\.25Y|\d+Y[-]\d+|TC[-_]?\d+/i.test(rawText)) {
        suggestedName = '裸圧着端子';
        suggestedCategory = '端子・圧着具';
        if (!suggestedSupplier && /NICHIFU|ニチフ/i.test(rawText)) suggestedSupplier = 'ニチフ';
      } else if (/インシュロック|結束バンド|AB\d+/i.test(rawText)) {
        suggestedName = 'インシュロック (結束バンド)';
        if (!suggestedSupplier) suggestedSupplier = 'ヘラマンタイトン';
        suggestedCategory = '配線・電気資材';
      }

      if (!suggestedName && lines.length > 0) {
        suggestedName = lines[0];
      }

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
      return {
        rawText: '',
        suggestedCategory: '制御盤パーツ',
        suggestedBaseUnit: '個',
      };
    }
  }
}
