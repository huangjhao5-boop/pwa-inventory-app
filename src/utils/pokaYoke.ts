/**
 * 防呆 (Poka-Yoke) 與驗證模組
 */

export class PokaYokeDebouncer {
  private lastScannedCode = '';
  private lastScannedTime = 0;
  private cooldownMs: number;

  constructor(cooldownMs = 1500) {
    this.cooldownMs = cooldownMs;
  }

  setCooldown(ms: number) {
    this.cooldownMs = ms;
  }

  /**
   * 重複スキャンチェック。
   * 同一コードがクールダウン時間（デフォルト1.5秒）以内に再スキャンされた場合は拒否する。
   */
  shouldAllowScan(code: string): { allowed: boolean; reason?: string; remainingMs?: number } {
    const now = Date.now();
    const cleanCode = code.trim();

    if (this.lastScannedCode === cleanCode) {
      const elapsed = now - this.lastScannedTime;
      if (elapsed < this.cooldownMs) {
        return {
          allowed: false,
          reason: `重複スキャン防止 (残り ${((this.cooldownMs - elapsed) / 1000).toFixed(1)} 秒)`,
          remainingMs: this.cooldownMs - elapsed,
        };
      }
    }

    this.lastScannedCode = cleanCode;
    this.lastScannedTime = now;
    return { allowed: true };
  }

  /**
   * 手動リセット（モーダルクローズ時など）
   */
  reset() {
    this.lastScannedCode = '';
    this.lastScannedTime = 0;
  }
}

/**
 * 数量・在庫バリデーション
 */
export function validateInventoryAction(
  actionType: 'IN' | 'OUT' | 'AUDIT' | 'ORDER',
  currentStock: number,
  baseQuantity: number,
  safetyStock: number
): { valid: boolean; warning?: string; error?: string } {
  if (baseQuantity <= 0) {
    return { valid: false, error: '数量は 1 以上を入力してください' };
  }

  if (actionType === 'OUT') {
    if (baseQuantity > currentStock) {
      return {
        valid: true,
        warning: `注意: 出庫数 (${baseQuantity}) が現在庫 (${currentStock}) を超過します。在庫がマイナスになります。`,
      };
    }
    const remaining = currentStock - baseQuantity;
    if (remaining <= safetyStock) {
      return {
        valid: true,
        warning: `安全在庫割れ警告: 出庫後の在庫残 (${remaining}) が安全在庫 (${safetyStock}) を下回ります。`,
      };
    }
  }

  return { valid: true };
}
