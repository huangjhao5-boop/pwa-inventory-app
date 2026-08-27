import { ItemMaster } from '../types/inventory';

/**
 * UTF-8 BOM 付き CSV 処理ユーティリティ (Excel 文字化け防止対応)
 */

export class CsvHelper {
  /**
   * ItemMaster 一覧を UTF-8 BOM 付き CSV 文字列に変換
   */
  static exportItemsToCsv(items: ItemMaster[]): string {
    const headers = [
      '品号(Code)',
      '品名(Name)',
      '規格(Spec)',
      '分類(Category)',
      '廠商(Supplier)',
      '基準単位(BaseUnit)',
      '現在在庫(CurrentStock)',
      '安全在庫(SafetyStock)',
      '保管棚番(Location)',
      '自作QR(QRCode)',
      '包装単位換算(Conversions)',
      '備考(Note)',
      '最終更新日時(UpdatedAt)'
    ];

    const rows = items.map((item) => {
      const convStr = item.unitConversions
        ? item.unitConversions.map((c) => `${c.unit}:${c.multiplier}`).join(';')
        : '';

      return [
        this.escapeCsv(item.code),
        this.escapeCsv(item.name),
        this.escapeCsv(item.spec),
        this.escapeCsv(item.category),
        this.escapeCsv(item.supplier || ''),
        this.escapeCsv(item.baseUnit),
        item.currentStock,
        item.safetyStock,
        this.escapeCsv(item.location),
        this.escapeCsv(item.qrCode || ''),
        this.escapeCsv(convStr),
        this.escapeCsv(item.note || ''),
        this.escapeCsv(item.updatedAt)
      ].join(',');
    });

    // Excel 文字化け防止用 UTF-8 BOM (\uFEFF) を付与
    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * CSV ファイルをダウンロードさせる
   */
  static downloadCsv(csvContent: string, filename = 'inventory_items.csv') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * CSV テキストを解析して ItemMaster 配列に変換
   */
  static parseCsvToItems(csvText: string): { items: Partial<ItemMaster>[]; errors: string[] } {
    const errors: string[] = [];
    const items: Partial<ItemMaster>[] = [];

    // BOM 除去
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length <= 1) {
      return { items: [], errors: ['CSVデータが空またはヘッダー行のみです'] };
    }

    // ヘッダーを除外して処理
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = this.parseCsvLine(line);

      if (cols.length < 5) {
        errors.push(`行 ${i + 1}: 列数が不足しています (${cols.length} 列)`);
        continue;
      }

      const code = cols[0]?.trim();
      const name = cols[1]?.trim();
      if (!code || !name) {
        errors.push(`行 ${i + 1}: 品号または品名が空です`);
        continue;
      }

      const spec = cols[2]?.trim() || '';
      const category = cols[3]?.trim() || '未分類';
      let supplier = '';
      let baseUnit = '個';
      let currentStock = 0;
      let safetyStock = 0;
      let location = 'A-01';
      let qrCode = `INV:v1:${code}`;
      let convStr = '';
      let note = '';

      if (cols.length >= 13) {
        supplier = cols[4]?.trim() || '';
        baseUnit = cols[5]?.trim() || '個';
        currentStock = Number(cols[6]) || 0;
        safetyStock = Number(cols[7]) || 0;
        location = cols[8]?.trim() || 'A-01';
        qrCode = cols[9]?.trim() || `INV:v1:${code}`;
        convStr = cols[10]?.trim() || '';
        note = cols[11]?.trim() || '';
      } else {
        baseUnit = cols[4]?.trim() || '個';
        currentStock = Number(cols[5]) || 0;
        safetyStock = Number(cols[6]) || 0;
        location = cols[7]?.trim() || 'A-01';
        qrCode = cols[8]?.trim() || `INV:v1:${code}`;
        convStr = cols[9]?.trim() || '';
        note = cols[10]?.trim() || '';
      }

      // 換算設定パース "箱:50;袋:10"
      const unitConversions: { unit: string; multiplier: number }[] = [];
      if (convStr) {
        convStr.split(';').forEach((part) => {
          const [u, m] = part.split(':');
          if (u && m && Number(m) > 0) {
            unitConversions.push({ unit: u.trim(), multiplier: Number(m) });
          }
        });
      }

      items.push({
        id: `item-${code}`,
        code,
        name,
        spec,
        category,
        supplier,
        baseUnit,
        currentStock,
        safetyStock,
        location,
        qrCode,
        unitConversions,
        note,
        updatedAt: new Date().toISOString(),
      });
    }

    return { items, errors };
  }

  private static escapeCsv(str: string): string {
    if (!str) return '""';
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  private static parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
