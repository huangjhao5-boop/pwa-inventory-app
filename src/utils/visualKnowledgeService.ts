import { ItemMaster, VisualKnowledgeEntry } from '../types/inventory';

const STORAGE_KEY = 'pwa_inventory_visual_knowledge_bank';

export class VisualKnowledgeService {
  private static cache: VisualKnowledgeEntry[] | null = null;

  /**
   * 画像から簡易視覚フィンガープリント（色分布・明度ハッシュ）を生成 (64-bit DHash)
   */
  static async extractColorHash(imageSrc: string): Promise<string> {
    return new Promise((resolve) => {
      if (!imageSrc || imageSrc.length < 10) return resolve('0000000000000000');
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 9;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve('0000000000000000');

        ctx.drawImage(img, 0, 0, 9, 8);
        const imgData = ctx.getImageData(0, 0, 9, 8);
        const data = imgData.data;

        // 8x8 各行の左右画素の明度差をビット列化 (64-bit DHash)
        let hash = '';
        for (let row = 0; row < 8; row++) {
          for (let col = 0; col < 8; col++) {
            const leftIdx = (row * 9 + col) * 4;
            const rightIdx = (row * 9 + col + 1) * 4;
            const leftLum = 0.299 * data[leftIdx] + 0.587 * data[leftIdx + 1] + 0.114 * data[leftIdx + 2];
            const rightLum = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
            hash += leftLum > rightLum ? '1' : '0';
          }
        }
        resolve(hash || '0000000000000000');
      };
      img.onerror = () => resolve('0000000000000000');
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

    // 既存のエントリ（同一品目コードまたは同一ハッシュ）を検索
    const existingIdx = bank.findIndex(
      (e) => (item.code && e.itemCode === item.code) || (e.spec && item.spec && e.spec === item.spec)
    );

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
      imageThumbnail: targetImage,
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
      try {
        const compacted = bank.map((b) => ({ ...b, imageThumbnail: undefined }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(compacted));
      } catch {
        // ignore
      }
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
   * （視覚ハッシュ単体での誤一致を防止し、型番・文字情報と複合判定）
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
    const upperOcr = (rawOcrText || '').toUpperCase();
    const queryTokens = this.extractTokens(rawOcrText || '');

    let bestScore = 0;
    let bestEntry: VisualKnowledgeEntry | null = null;
    let bestReason = '';

    for (const entry of bank) {
      let score = 0;

      // 1. 完全同一画像・サムネイル一致判定
      const isExactImage = Boolean(entry.imageThumbnail && entry.imageThumbnail === capturedImageBase64);
      if (isExactImage) {
        score += 95;
      }

      // 2. 規格型番の一致判定（最重要！）
      let hasSpecMatch = false;
      if (entry.spec && entry.spec.trim().length >= 2) {
        const specClean = entry.spec.toUpperCase().replace(/[\s\-_]/g, '');
        const ocrClean = upperOcr.replace(/[\s\-_]/g, '');
        if (ocrClean.includes(specClean) || (queryTokens.length > 0 && queryTokens.some(qt => qt.includes(specClean) || specClean.includes(qt)))) {
          score += 65;
          hasSpecMatch = true;
        }
      }

      // 3. 品名・メーカーの一致判定
      let hasNameOrSupplierMatch = false;
      if (entry.name && entry.name.trim().length >= 2) {
        const nameUpper = entry.name.toUpperCase().trim();
        if (upperOcr.includes(nameUpper)) {
          score += 30;
          hasNameOrSupplierMatch = true;
        }
      }
      if (entry.supplier && entry.supplier.trim().length >= 2) {
        const supUpper = entry.supplier.toUpperCase().trim();
        if (upperOcr.includes(supUpper)) {
          score += 25;
          hasNameOrSupplierMatch = true;
        }
      }

      // 4. 特徴トークン一致
      if (queryTokens.length > 0 && entry.featureTokens && entry.featureTokens.length > 0) {
        let matchedTokens = 0;
        for (const qt of queryTokens) {
          if (entry.featureTokens.some((et) => et === qt || et.includes(qt) || qt.includes(et))) {
            matchedTokens++;
          }
        }
        score += Math.min(30, matchedTokens * 10);
      }

      // 5. 視覚ハッシュ類似度 (写真の背景色・明度)
      // 重要：文字・型番が一致している場合のみ視覚類似度をフル加算。文字が一致しない場合は上限15点に制限
      if (currentHash && entry.colorHash) {
        let diffBits = 0;
        const len = Math.min(currentHash.length, entry.colorHash.length);
        for (let i = 0; i < len; i++) {
          if (currentHash[i] !== entry.colorHash[i]) diffBits++;
        }
        const visualSimilarity = 1 - diffBits / len;
        if (isExactImage || hasSpecMatch || hasNameOrSupplierMatch) {
          score += visualSimilarity * 30;
        } else {
          score += Math.min(15, visualSimilarity * 15);
        }
      }

      // 6. 学習頻度ボーナス
      score += Math.min(10, (entry.matchCount || 1) * 2);

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
        bestReason = `学習記憶と一致 (確信度: ${Math.min(99, Math.round(score))}%)`;
      }
    }

    // 文字または画像が実質的に一致した場合のみ（最低55点以上）
    if (bestScore >= 55 && bestEntry) {
      const correspondingItem =
        existingItems?.find((i) => i.code === bestEntry?.itemCode) || null;

      return {
        matchedEntry: bestEntry,
        matchedItem: correspondingItem,
        confidenceScore: Math.min(99, Math.round(Math.max(90, bestScore))),
        explanation: bestReason,
      };
    }

    return { matchedEntry: null, matchedItem: null, confidenceScore: 0, explanation: '' };
  }

  /**
   * 簡易照合ヘルパー
   */
  static async findMatchingEntry(imageSrc: string): Promise<VisualKnowledgeEntry | null> {
    const match = await this.findBestMatch(imageSrc);
    if (match.matchedEntry && match.confidenceScore >= 55) {
      return match.matchedEntry;
    }
    return null;
  }

  /**
   * 学習ナレッジを全消去・初期化
   */
  static clearKnowledgeBank(): void {
    this.cache = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
