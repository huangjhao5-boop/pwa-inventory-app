import { ItemMaster, VisualKnowledgeEntry } from '../types/inventory';

const STORAGE_KEY = 'pwa_inventory_visual_knowledge_bank';

export class VisualKnowledgeService {
  private static cache: VisualKnowledgeEntry[] | null = null;

  /**
   * 画像から簡易視覚フィンガープリント（色分布・明度ハッシュ）を生成
   */
  static async extractColorHash(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('00000000');

        ctx.drawImage(img, 0, 0, 8, 8);
        const imgData = ctx.getImageData(0, 0, 8, 8);
        const data = imgData.data;

        // 8x8 ブロックのグレースケール平均値をビット列に変換（DHash）
        let hash = '';
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 7; col++) {
            const leftIdx = (row * 8 + col) * 4;
            const rightIdx = (row * 8 + col + 1) * 4;
            const leftLum = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
            const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
            hash += leftLum > rightLum ? '1' : '0';
          }
        }
        resolve(hash);
      };
      img.onerror = () => resolve('00000000');
      img.src = imageSrc;
    });
  }

  /**
   * テキストから識別用特徴トークンを抽出
   */
  static extractTokens(text: string): string[] {
    if (!text) return [];
    return text
      .toUpperCase()
      .replace(/[^\w\u3040-\u30ff\u4e00-\u9fa5\-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);
  }

  /**
   * 保存済み学習ナレッジの取得
   */
  static getKnowledgeBank(): VisualKnowledgeEntry[] {
    if (this.cache) return this.cache;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.cache = JSON.parse(saved);
        return this.cache || [];
      }
    } catch {
      // ignore
    }
    this.cache = [];
    return this.cache;
  }

  /**
   * ユーザーの手動修正・確定から学習（自己学習フィードバック）
   */
  static async learnFromItem(
    item: ItemMaster,
    capturedImageBase64?: string,
    rawOcrText?: string
  ): Promise<void> {
    const bank = this.getKnowledgeBank();
    const targetImage = capturedImageBase64 || item.imageUrl;
    if (!targetImage) return;

    const colorHash = await this.extractColorHash(targetImage);

    // 特徴トークンを収集 (品名 + 規格 + メーカー + ボックス + OCR読取文字)
    const combinedText = `${item.name} ${item.spec} ${item.supplier || ''} ${item.location} ${rawOcrText || ''}`;
    const tokens = Array.from(new Set(this.extractTokens(combinedText)));

    const existingIdx = bank.findIndex((e) => e.itemCode === item.code);

    const newEntry: VisualKnowledgeEntry = {
      id: existingIdx >= 0 ? bank[existingIdx].id : `vk-${Date.now()}`,
      itemCode: item.code,
      name: item.name,
      spec: item.spec,
      supplier: item.supplier,
      category: item.category,
      baseUnit: item.baseUnit,
      boxName: item.location,
      colorHash,
      featureTokens: tokens,
      imageThumbnail: targetImage.length > 10000 ? targetImage.slice(0, 10000) : targetImage,
      matchCount: existingIdx >= 0 ? bank[existingIdx].matchCount + 1 : 1,
      lastLearnedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      bank[existingIdx] = newEntry;
    } else {
      bank.unshift(newEntry);
    }

    // 上限 200 件まで保持
    if (bank.length > 200) bank.pop();

    this.cache = bank;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bank));
    } catch {
      // quota exceeded fallback
    }
  }

  /**
   * 削除された品目を学習ナレッジから除外
   */
  static removeItem(itemCode: string): void {
    const bank = this.getKnowledgeBank();
    const next = bank.filter((e) => e.itemCode !== itemCode);
    this.cache = next;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  /**
   * 撮影画像とOCRテキストから、過去の学習データをもとに最適品目を予測照合
   */
  static async findBestMatch(
    capturedImageBase64: string,
    rawOcrText?: string,
    existingItems?: ItemMaster[]
  ): Promise<{
    matchedEntry: VisualKnowledgeEntry | null;
    matchedItem: ItemMaster | null;
    confidenceScore: number;
    explanation: string;
  }> {
    const bank = this.getKnowledgeBank();
    if (bank.length === 0) {
      return { matchedEntry: null, matchedItem: null, confidenceScore: 0, explanation: '' };
    }

    const currentHash = await this.extractColorHash(capturedImageBase64);
    const queryTokens = this.extractTokens(rawOcrText || '');

    let bestScore = 0;
    let bestEntry: VisualKnowledgeEntry | null = null;
    let bestReason = '';

    for (const entry of bank) {
      let score = 0;

      // 1. 視覚ハッシュ類似度 (ハミング距離)
      if (currentHash && entry.colorHash) {
        let diffBits = 0;
        const len = Math.min(currentHash.length, entry.colorHash.length);
        for (let i = 0; i < len; i++) {
          if (currentHash[i] !== entry.colorHash[i]) diffBits++;
        }
        const visualSimilarity = 1 - diffBits / len;
        score += visualSimilarity * 40; // 最大 40 点
      }

      // 2. 特徴トークン一致度
      if (queryTokens.length > 0 && entry.featureTokens.length > 0) {
        let matchedTokens = 0;
        for (const qt of queryTokens) {
          if (entry.featureTokens.some((et) => et.includes(qt) || qt.includes(et))) {
            matchedTokens++;
          }
        }
        const tokenRatio = matchedTokens / queryTokens.length;
        score += tokenRatio * 50; // 最大 50 点
      }

      // 3. 学習頻度ボーナス
      score += Math.min(10, entry.matchCount * 2);

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
        bestReason = `過去の修正学習データと一致 (外観・トークン照合: ${Math.round(score)}%)`;
      }
    }

    if (bestScore >= 55 && bestEntry) {
      const correspondingItem =
        existingItems?.find((i) => i.code === bestEntry?.itemCode) || null;

      return {
        matchedEntry: bestEntry,
        matchedItem: correspondingItem,
        confidenceScore: Math.min(99, Math.round(bestScore)),
        explanation: bestReason,
      };
    }

    return { matchedEntry: null, matchedItem: null, confidenceScore: 0, explanation: '' };
  }
}
