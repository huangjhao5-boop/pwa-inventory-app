/**
 * 雙軌 QR / 條碼解析模組 (Dual-mode Barcode & QR Parser)
 */

export interface ParsedCodeResult {
  rawText: string;
  type: 'ITEM' | 'LOCATION' | 'OPERATOR' | 'UNKNOWN';
  itemCode?: string;
  spec?: string;
  name?: string;
  lot?: string;
  locationCode?: string;
  operatorCode?: string;
  customData?: Record<string, unknown>;
}

export class DualModeCodeParser {
  /**
   * QR / バーコード文字列を解析し構造化データを返す
   */
  static parse(raw: string): ParsedCodeResult {
    const text = (raw || '').trim();
    if (!text) {
      return { rawText: '', type: 'UNKNOWN' };
    }

    // 1. JSON 形式の自社QR解析 (例: {"type":"ITEM","code":"M6-20","name":"六角ボルト"})
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
      try {
        const json = JSON.parse(text);
        if (json.code || json.itemCode) {
          return {
            rawText: text,
            type: 'ITEM',
            itemCode: String(json.code || json.itemCode).trim(),
            name: json.name ? String(json.name) : undefined,
            spec: json.spec ? String(json.spec) : undefined,
            lot: json.lot ? String(json.lot) : undefined,
            customData: json,
          };
        }
        if (json.location || json.loc) {
          return {
            rawText: text,
            type: 'LOCATION',
            locationCode: String(json.location || json.loc).trim(),
            customData: json,
          };
        }
        if (json.operator || json.op) {
          return {
            rawText: text,
            type: 'OPERATOR',
            operatorCode: String(json.operator || json.op).trim(),
            customData: json,
          };
        }
      } catch {
        // Not valid JSON, continue to prefix matching
      }
    }

    // 2. 自社プレフィックス形式 (INV:v1:CODE:LOT / QR:ITEM:CODE)
    if (text.startsWith('INV:v1:') || text.startsWith('INV:') || text.startsWith('QR:ITEM:')) {
      const parts = text.split(':');
      // Format: INV:v1:CODE[:LOT]
      if (text.startsWith('INV:v1:')) {
        const itemCode = parts[2] || '';
        const lot = parts[3] || undefined;
        return { rawText: text, type: 'ITEM', itemCode, lot };
      }
      if (text.startsWith('QR:ITEM:')) {
        const itemCode = parts[2] || '';
        return { rawText: text, type: 'ITEM', itemCode };
      }
      const itemCode = parts[1] || '';
      return { rawText: text, type: 'ITEM', itemCode };
    }

    // 3. ロケーション・棚番プレフィックス (LOC:A-01-2F / BIN:04)
    if (text.startsWith('LOC:') || text.startsWith('BIN:') || text.startsWith('SHELVE:')) {
      const parts = text.split(':');
      return {
        rawText: text,
        type: 'LOCATION',
        locationCode: parts[1] || text,
      };
    }

    // 4. 作業員コードプレフィックス (OP:USER-01 / STAFF:007)
    if (text.startsWith('OP:') || text.startsWith('STAFF:') || text.startsWith('USER:')) {
      const parts = text.split(':');
      return {
        rawText: text,
        type: 'OPERATOR',
        operatorCode: parts[1] || text,
      };
    }

    // 5. 一般ベンダー標準バーコード (JAN/EAN-13, Code-128, ITF, 品番直打ち)
    return {
      rawText: text,
      type: 'ITEM',
      itemCode: text,
    };
  }

  /**
   * 自社標準フォーマットの QR 文字列を生成する
   */
  static formatItemQR(code: string, lot?: string): string {
    const cleanCode = code.trim();
    if (lot && lot.trim()) {
      return `INV:v1:${cleanCode}:${lot.trim()}`;
    }
    return `INV:v1:${cleanCode}`;
  }
}
