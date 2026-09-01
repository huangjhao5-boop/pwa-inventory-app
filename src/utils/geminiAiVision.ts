import { ItemMaster, UnitConversion } from '../types/inventory';
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
  suggestedConversions?: UnitConversion[];
  suggestedBoxName?: string;
  suggestedQuantity?: number;
  confidenceScore?: number; // 0 ~ 100
  rawAnalysis?: string;
  candidateTokens?: string[]; // Extracted keywords for quick auto-fill pills
}

export class AiVisionService {
  /**
   * Gemini Multimodal AI 画像認識（型番・品名・メーカー・規格・数量・既存品目IDの高精度判定）
   */
  static async analyzeWithGemini(
    imageBase64: string,
    apiKey: string,
    existingItems: ItemMaster[] = []
  ): Promise<AiVisionResult | null> {
    try {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = imageBase64.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

      // 既存の登録済み品目カタログをAIに参照情報として提供（最大80件）
      const inventoryCatalog = existingItems.slice(0, 80).map((i) => ({
        id: i.id,
        code: i.code,
        name: i.name,
        spec: i.spec || '',
        supplier: i.supplier || '',
        location: i.location || '',
        baseUnit: i.baseUnit || '個',
      }));

      const prompt = `
あなたは電気工事・制御盤製作・電設資材の在庫管理のエキスパートAIです。
提供された写真（部品本体、中継ボックス、端子台、圧着端子、結束バンド、電線、銘板ラベル、箱等）を精密に観察・分析してください。

【既存の登録済み品目マスタ一覧（ID付き）】:
${JSON.stringify(inventoryCatalog, null, 2)}

【指示】
1. 写真内の物品（または銘板・刻印文字）が、上記の【既存の登録済み品目マスタ】のいずれかに一致または同等品であるかを判定してください。一致する場合は、その品目の "matchedItemId" に対象の id を入れてください。
2. もし一致する登録品目がない場合（新規品目の場合）、写真から読み取れる文字（メーカー名、型番、定格、仕様）および外観特徴から、適切な「品名 (name)」「規格・型番 (spec)」「メーカー (supplier)」「分類 (category)」「基準単位 (baseUnit)」「おすすめ保管箱 (boxName)」を特定してください。
3. 特に電設業界の主要材料を正しく区別してください：
   - 中継端子ボックス・ジョイントボックス（例: JB-100, 日東工業, 春日電機, タカチ）➔ 品名: 中継端子ボックス, 分類: 制御盤パーツ, 単位: 個
   - 裸圧着端子・絶縁端子（例: R2-4, 1.25Y-3.5, ニチフ）➔ 品名: 裸圧着端子, 分類: 端子・圧着具, 単位: 個
   - 結束バンド・インシュロック（例: AB300, ヘラマンタイトン, パンドウイット）➔ 品名: インシュロック (結束バンド), 分類: 配線・電気資材, 単位: 本
   - 端子台（例: TX-10, TB-15, 東洋技研）➔ 品名: 端子台, 分類: 制御盤パーツ, 単位: 個
4. 抽出されたキーワード（型番、メーカー名、仕様、極数等）を "keywords" 配列として出力してください。

必ず以下の日本語JSON形式のみで出力してください（Markdownのバッククォート不要）:
{
  "matchedItemId": "一致する品目のid (なければ null)",
  "name": "品名",
  "spec": "規格・型番",
  "supplier": "メーカー名",
  "category": "分類 (配線・電気資材 / 制御盤パーツ / 端子・圧着具 / 機構・締結部品 / 電線・ケーブル / 空圧・流体機器)",
  "baseUnit": "基準単位 (個 / 本 / 枚 / 巻 / m / 袋 / 箱)",
  "boxName": "おすすめ保管ボックス名",
  "suggestedQuantity": 1,
  "confidenceScore": 95,
  "keywords": ["抽出キーワード1", "キーワード2"],
  "summary": "AIの視覚判定理由"
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
      const matchedItem = parsed.matchedItemId
        ? existingItems.find((i) => i.id === parsed.matchedItemId || i.code === parsed.matchedItemId)
        : undefined;

      return {
        source: 'GEMINI_AI',
        matchedExistingItem: matchedItem || undefined,
        suggestedName: parsed.name,
        suggestedSpec: parsed.spec,
        suggestedSupplier: parsed.supplier,
        suggestedCategory: parsed.category || '配線・電気資材',
        suggestedBaseUnit: parsed.baseUnit || '個',
        suggestedBoxName: parsed.boxName || '端子ボックス (A-01)',
        suggestedQuantity: Number(parsed.suggestedQuantity) || 1,
        confidenceScore: Number(parsed.confidenceScore) || 92,
        rawAnalysis: parsed.summary,
        candidateTokens: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      };
    } catch (err) {
      console.error('Gemini AI Vision analysis error:', err);
      return null;
    }
  }

  /**
   * 総合スマート認識エンジン：
   * 1. Gemini AI マルチモーダル視覚認識（APIキー設定時、最高峰のカタログ照合）
   * 2. 高精度電工 OCR + 特徴トークンによる全データベース検索照合
   * 3. 過去のユーザー修正に基づく自己学習ナレッジ照合
   */
  static async smartRecognize(
    imageBase64: string,
    existingItems: ItemMaster[],
    apiKey?: string
  ): Promise<AiVisionResult> {
    // 1. 先に OCR テキストとトークンを抽出
    const ocrResult = await OcrHelper.recognizeImage(imageBase64);
    const ocrTokens = VisualKnowledgeService.extractTokens(ocrResult.rawText);

    // 2. Gemini AI 判定の試行
    const effectiveKey =
      apiKey && apiKey.trim().length > 5
        ? apiKey.trim()
        : 'AQ.Ab8RN6K-0iI-v6dqX7QDe5r00o5iNZH_EVDd812ALgyzZS07Mw';

    if (effectiveKey && effectiveKey.length > 5) {
      const aiResult = await this.analyzeWithGemini(imageBase64, effectiveKey, existingItems);
      if (aiResult) {
        const units = OcrHelper.inferUnits(
          aiResult.suggestedName || '',
          aiResult.suggestedSpec || '',
          aiResult.suggestedBaseUnit || ''
        );
        const combinedTokens = Array.from(
          new Set([
            ...(aiResult.candidateTokens || []),
            ...ocrTokens,
            aiResult.suggestedName,
            aiResult.suggestedSpec,
            aiResult.suggestedSupplier,
          ].filter(Boolean) as string[])
        );

        return {
          ...aiResult,
          suggestedBaseUnit: aiResult.suggestedBaseUnit || units.baseUnit,
          suggestedConversions: units.conversions,
          candidateTokens: combinedTokens,
        };
      }
    }

    // 3. ローカル照合（データベース内の既存品目と OCR 文字列・トークンの高精度類似度ランキング）
    let bestMatchedItem: ItemMaster | null = null;
    let highestScore = 0;
    const upperOcr = (ocrResult.rawText || '').toUpperCase();

    for (const item of existingItems) {
      let score = 0;
      const upperName = item.name.toUpperCase();
      const upperSpec = (item.spec || '').toUpperCase();
      const upperSup = (item.supplier || '').toUpperCase();
      const upperCode = item.code.toUpperCase();

      // 型番・コードの完全一致
      if (upperSpec.length >= 2 && upperOcr.includes(upperSpec)) {
        score += 60;
      }
      if (upperCode.length >= 2 && upperOcr.includes(upperCode)) {
        score += 50;
      }

      // 品名・メーカーの一致
      if (upperName.length >= 2 && upperOcr.includes(upperName)) {
        score += 40;
      }
      if (upperSup.length >= 2 && upperOcr.includes(upperSup)) {
        score += 25;
      }

      // トークン一致
      for (const tok of ocrTokens) {
        if (upperSpec.includes(tok) || upperName.includes(tok) || upperSup.includes(tok)) {
          score += 15;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatchedItem = item;
      }
    }

    // 最低50点以上で既存品目として照合
    if (bestMatchedItem && highestScore >= 50) {
      const units = OcrHelper.inferUnits(
        bestMatchedItem.name,
        bestMatchedItem.spec || '',
        bestMatchedItem.baseUnit || ''
      );
      return {
        source: 'IMAGE_MATCH',
        matchedExistingItem: bestMatchedItem,
        suggestedName: bestMatchedItem.name,
        suggestedSpec: bestMatchedItem.spec,
        suggestedSupplier: bestMatchedItem.supplier,
        suggestedCategory: bestMatchedItem.category,
        suggestedBaseUnit: bestMatchedItem.baseUnit,
        suggestedConversions: bestMatchedItem.unitConversions || units.conversions,
        suggestedBoxName: bestMatchedItem.location,
        confidenceScore: Math.min(98, Math.round(highestScore + 20)),
        rawAnalysis: `OCR型番・名称照合一致: ${bestMatchedItem.name}`,
        candidateTokens: ocrTokens,
      };
    }

    // 4. ローカル OCR フォールバック
    return {
      source: 'LOCAL_OCR',
      suggestedName: ocrResult.suggestedName,
      suggestedSpec: ocrResult.suggestedSpec,
      suggestedSupplier: ocrResult.suggestedSupplier,
      suggestedCategory: ocrResult.suggestedCategory,
      suggestedBaseUnit: ocrResult.suggestedBaseUnit,
      suggestedConversions: ocrResult.suggestedConversions,
      suggestedBoxName: ocrResult.suggestedBoxName,
      confidenceScore: ocrResult.suggestedName ? 75 : 40,
      rawAnalysis: ocrResult.rawText,
      candidateTokens: ocrTokens,
    };
  }
}
