import { ItemMaster } from '../types/inventory';
import { OcrHelper } from './ocrHelper';
import { VisualKnowledgeService } from './visualKnowledgeService';

export interface AiVisionResult {
  source: 'LEARNED_MEMORY' | 'IMAGE_MATCH' | 'GEMINI_AI' | 'LOCAL_OCR';
  matchedExistingItem?: ItemMaster;
  suggestedName?: string;
  suggestedSpec?: string;
  suggestedSupplier?: string;
  suggestedCategory?: string;
  suggestedBaseUnit?: string;
  suggestedBoxName?: string;
  suggestedQuantity?: number;
  confidenceScore?: number; // 0 ~ 100
  rawAnalysis?: string;
}

export class AiVisionService {
  /**
   * 基準画像照合：撮影写真とデータベース内の品目写真（基準画像）を画像比較照合
   */
  static matchExistingItemByImage(
    capturedImageBase64: string,
    existingItems: ItemMaster[]
  ): ItemMaster | null {
    const itemsWithImages = existingItems.filter((i) => Boolean(i.imageUrl));
    if (itemsWithImages.length === 0) return null;

    const matched = itemsWithImages.find((item) => {
      if (!item.imageUrl) return false;
      if (item.imageUrl === capturedImageBase64) return true;
      return false;
    });

    return matched || null;
  }

  /**
   * Gemini Multimodal AI 画像認識（型番・品名・メーカー・規格・数量の高精度AI抽出）
   */
  static async analyzeWithGemini(
    imageBase64: string,
    apiKey: string
  ): Promise<AiVisionResult | null> {
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

      const prompt = `
あなたは電気工事・制御盤製作・工場備品のプロフェッショナルな在庫管理AIです。
提供された写真（ラベル、銘板、部品本体、包装箱、または端子・結束バンドなどの電気部品）を高精度に画像解析し、以下の日本語JSON形式のみで返答してください。Markdown記号や前置きは含めず、純粋なJSON文字列のみを出力してください。

【出力フォーマット】
{
  "name": "品名 (例: 丸形圧着端子, 結束バンド, ガラス管ヒューズ, 六角穴付ボルト)",
  "spec": "規格・型番 (例: R2-4, 150mm×3.6mm, 250V 5A, M6×20mm)",
  "supplier": "メーカー名 (例: ニチフ (NICHIFU), パンドウイット (Panduit), オムロン, ミスミ, SMC)",
  "category": "分類 (例: 配線・電気資材, 制御盤パーツ, 機構・締結部品)",
  "baseUnit": "基準単位 (例: 個, 本, 枚, 箱, パック)",
  "boxName": "おすすめ保管ボックス名 (例: 端子ボックス (A-01), 結束バンドボックス (B-01))",
  "suggestedQuantity": 100,
  "confidenceScore": 95,
  "summary": "AIによる視覚的特徴の簡単な説明"
}
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!response.ok) {
        console.warn('Gemini API request failed:', response.status, await response.text());
        return null;
      }

      const data = await response.json();
      const contentText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!contentText) return null;

      const parsed = JSON.parse(contentText);
      return {
        source: 'GEMINI_AI',
        suggestedName: parsed.name,
        suggestedSpec: parsed.spec,
        suggestedSupplier: parsed.supplier,
        suggestedCategory: parsed.category || '配線・電気資材',
        suggestedBaseUnit: parsed.baseUnit || '個',
        suggestedBoxName: parsed.boxName || '端子ボックス (A-01)',
        suggestedQuantity: Number(parsed.suggestedQuantity) || 1,
        confidenceScore: Number(parsed.confidenceScore) || 92,
        rawAnalysis: parsed.summary,
      };
    } catch (err) {
      console.error('Gemini AI Vision analysis error:', err);
      return null;
    }
  }

  /**
   * 総合スマート認識エンジン：
   * 1. 登録済み基準画像との完全照合
   * 2. 過去のユーザー修正に基づく自己学習ナレッジ（Visual Knowledge Bank）照合
   * 3. Gemini AI マルチモーダル視覚認識（APIキー設定時）
   * 4. 高精度ローカル電工 OCR + 学習特徴照合
   */
  static async smartRecognize(
    imageBase64: string,
    existingItems: ItemMaster[],
    apiKey?: string
  ): Promise<AiVisionResult> {
    // 1. 登録済み基準画像との照合
    const matchedItem = this.matchExistingItemByImage(imageBase64, existingItems);
    if (matchedItem) {
      return {
        source: 'IMAGE_MATCH',
        matchedExistingItem: matchedItem,
        suggestedName: matchedItem.name,
        suggestedSpec: matchedItem.spec,
        suggestedSupplier: matchedItem.supplier,
        suggestedCategory: matchedItem.category,
        suggestedBaseUnit: matchedItem.baseUnit,
        suggestedBoxName: matchedItem.location,
        confidenceScore: 99,
        rawAnalysis: `登録済み基準画像と一致: ${matchedItem.name}`,
      };
    }

    // 先に OCR テキストを取得（学習データ照合およびフォールバック用）
    const ocrResult = await OcrHelper.recognizeImage(imageBase64);

    // 2. 過去のユーザー修正・学習ナレッジからの検索
    const learnedMatch = await VisualKnowledgeService.findBestMatch(
      imageBase64,
      ocrResult.rawText,
      existingItems
    );

    if (learnedMatch.matchedEntry && learnedMatch.confidenceScore >= 60) {
      const entry = learnedMatch.matchedEntry;
      return {
        source: 'LEARNED_MEMORY',
        matchedExistingItem: learnedMatch.matchedItem || undefined,
        suggestedName: entry.name,
        suggestedSpec: entry.spec,
        suggestedSupplier: entry.supplier,
        suggestedCategory: entry.category || '配線・電気資材',
        suggestedBaseUnit: entry.baseUnit || '個',
        suggestedBoxName: entry.boxName || '端子ボックス (A-01)',
        confidenceScore: learnedMatch.confidenceScore,
        rawAnalysis: `🧠 ${learnedMatch.explanation}`,
      };
    }

    // 3. Gemini AI マルチモーダル認識（APIキー設定時）
    if (apiKey && apiKey.trim().length > 5) {
      const aiResult = await this.analyzeWithGemini(imageBase64, apiKey.trim());
      if (aiResult) {
        return aiResult;
      }
    }

    // 4. 高精度ローカル電工 OCR フォールバック
    return {
      source: 'LOCAL_OCR',
      suggestedName: ocrResult.suggestedName,
      suggestedSpec: ocrResult.suggestedSpec,
      suggestedSupplier: ocrResult.suggestedSupplier,
      suggestedBoxName: ocrResult.suggestedBoxName,
      confidenceScore: ocrResult.suggestedName ? 75 : 40,
      rawAnalysis: ocrResult.rawText,
    };
  }
}
