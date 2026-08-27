import { ItemMaster } from '../types/inventory';

export interface PurchaseOrderItem {
  item: ItemMaster;
  orderQuantity: number;
  orderUnit: string;
  calculatedBaseQuantity: number;
  note?: string;
}

/**
 * UTF-8 BOM 付き CSV 処理ユーティリティ (Excel 文字化け防止対応)
 */
export class CsvHelper {
  /**
   * ItemMaster 一覧を UTF-8 BOM 付き CSV 文字列に変換
   */
  static exportItemsToCsv(
    items: ItemMaster[],
    options?: {
      selectedColumns?: string[];
    }
  ): string {
    const allHeaders = [
      { key: 'code', label: '品目コード(Code)' },
      { key: 'name', label: '品名(Name)' },
      { key: 'spec', label: '規格型番(Spec)' },
      { key: 'category', label: 'カテゴリ(Category)' },
      { key: 'supplier', label: '仕入先メーカー(Supplier)' },
      { key: 'orderUrl', label: '発注URL(OrderUrl)' },
      { key: 'baseUnit', label: '基準単位(BaseUnit)' },
      { key: 'currentStock', label: '現在庫数(CurrentStock)' },
      { key: 'safetyStock', label: '安全在庫数(SafetyStock)' },
      { key: 'location', label: '保管ボックス名(Location)' },
      { key: 'qrCode', label: 'QRコード(QRCode)' },
      { key: 'conversions', label: '包装単位換算(Conversions)' },
      { key: 'note', label: '備考(Note)' },
      { key: 'updatedAt', label: '最終更新日時(UpdatedAt)' },
    ];

    const activeHeaders = options?.selectedColumns && options.selectedColumns.length > 0
      ? allHeaders.filter((h) => options.selectedColumns!.includes(h.key))
      : allHeaders;

    const rows = items.map((item) => {
      const convStr = item.unitConversions
        ? item.unitConversions.map((c) => `${c.unit}:${c.multiplier}`).join(';')
        : '';

      const valMap: Record<string, string | number> = {
        code: this.escapeCsv(item.code),
        name: this.escapeCsv(item.name),
        spec: this.escapeCsv(item.spec),
        category: this.escapeCsv(item.category),
        supplier: this.escapeCsv(item.supplier || ''),
        orderUrl: this.escapeCsv(item.orderUrl || ''),
        baseUnit: this.escapeCsv(item.baseUnit),
        currentStock: item.currentStock,
        safetyStock: item.safetyStock,
        location: this.escapeCsv(item.location),
        qrCode: this.escapeCsv(item.qrCode || ''),
        conversions: this.escapeCsv(convStr),
        note: this.escapeCsv(item.note || ''),
        updatedAt: this.escapeCsv(item.updatedAt),
      };

      return activeHeaders.map((h) => valMap[h.key]).join(',');
    });

    // Excel 文字化け防止用 UTF-8 BOM (\uFEFF) を付与
    return '\uFEFF' + [activeHeaders.map((h) => h.label).join(','), ...rows].join('\r\n');
  }

  /**
   * 発注書 (Purchase Order) を UTF-8 BOM 付き CSV に変換
   */
  static exportPurchaseOrdersToCsv(orders: PurchaseOrderItem[], orderNumber?: string): string {
    const pOrderNo = orderNumber || `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
    const headers = [
      '発注番号(PONumber)',
      '品目コード(ItemCode)',
      '品名(ItemName)',
      '規格型番(Spec)',
      '仕入先メーカー(Supplier)',
      '発注数量(OrderQty)',
      '発注単位(OrderUnit)',
      '基準換算数(BaseQty)',
      '基準単位(BaseUnit)',
      '現在庫数(CurrentStock)',
      '安全在庫数(SafetyStock)',
      '保管ボックス名(Location)',
      '発注URL(OrderUrl)',
      '発注備考(OrderNote)',
    ];

    const rows = orders.map((o) => [
      this.escapeCsv(pOrderNo),
      this.escapeCsv(o.item.code),
      this.escapeCsv(o.item.name),
      this.escapeCsv(o.item.spec),
      this.escapeCsv(o.item.supplier || ''),
      o.orderQuantity,
      this.escapeCsv(o.orderUnit),
      o.calculatedBaseQuantity,
      this.escapeCsv(o.item.baseUnit),
      o.item.currentStock,
      o.item.safetyStock,
      this.escapeCsv(o.item.location),
      this.escapeCsv(o.item.orderUrl || ''),
      this.escapeCsv(o.note || ''),
    ].join(','));

    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * 発注依頼テキストフォーマット作成（LINE / Slack / メール用）
   */
  static formatPurchaseOrderText(orders: PurchaseOrderItem[], operatorName: string): string {
    const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const lines = [
      `【資材発注依頼書】`,
      `発注日: ${today}`,
      `担当者: ${operatorName}`,
      `発注品目数: ${orders.length} 品目`,
      `----------------------------------------`,
    ];

    orders.forEach((o, i) => {
      lines.push(`${i + 1}. 【${o.item.name}】`);
      if (o.item.spec) lines.push(`   規格/型番: ${o.item.spec}`);
      if (o.item.supplier) lines.push(`   メーカー/仕入先: ${o.item.supplier}`);
      lines.push(`   発注数: ${o.orderQuantity} ${o.orderUnit} (基準: ${o.calculatedBaseQuantity} ${o.item.baseUnit}) [現在庫: ${o.item.currentStock}]`);
      if (o.item.orderUrl) lines.push(`   発注リンク: ${o.item.orderUrl}`);
      if (o.note) lines.push(`   備考: ${o.note}`);
      lines.push(``);
    });

    lines.push(`----------------------------------------`);
    lines.push(`上記資材の発注手配をお願いいたします。`);

    return lines.join('\n');
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
        errors.push(`行 ${i + 1}: 品目コードまたは品名が空です`);
        continue;
      }

      const spec = cols[2]?.trim() || '';
      const category = cols[3]?.trim() || '配線・電気資材';
      let supplier = '';
      let orderUrl = '';
      let baseUnit = '個';
      let currentStock = 0;
      let safetyStock = 0;
      let location = '端子ボックス (A-01)';
      let qrCode = `INV:v1:${code}`;
      let convStr = '';
      let note = '';

      if (cols.length >= 14) {
        supplier = cols[4]?.trim() || '';
        orderUrl = cols[5]?.trim() || '';
        baseUnit = cols[6]?.trim() || '個';
        currentStock = Number(cols[7]) || 0;
        safetyStock = Number(cols[8]) || 0;
        location = cols[9]?.trim() || '端子ボックス (A-01)';
        qrCode = cols[10]?.trim() || `INV:v1:${code}`;
        convStr = cols[11]?.trim() || '';
        note = cols[12]?.trim() || '';
      } else if (cols.length >= 13) {
        supplier = cols[4]?.trim() || '';
        baseUnit = cols[5]?.trim() || '個';
        currentStock = Number(cols[6]) || 0;
        safetyStock = Number(cols[7]) || 0;
        location = cols[8]?.trim() || '端子ボックス (A-01)';
        qrCode = cols[9]?.trim() || `INV:v1:${code}`;
        convStr = cols[10]?.trim() || '';
        note = cols[11]?.trim() || '';
      } else {
        baseUnit = cols[4]?.trim() || '個';
        currentStock = Number(cols[5]) || 0;
        safetyStock = Number(cols[6]) || 0;
        location = cols[7]?.trim() || '端子ボックス (A-01)';
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
        orderUrl,
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
