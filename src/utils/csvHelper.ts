import * as XLSX from 'xlsx';
import { ItemMaster } from '../types/inventory';

export interface PurchaseOrderItem {
  item: ItemMaster;
  orderQuantity: number;
  orderUnit: string;
  calculatedBaseQuantity: number;
  note?: string;
}

export interface ExportColumnDef {
  key: string;
  label: string;
}

export const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'code', label: '品目コード(Code)' },
  { key: 'name', label: '品名(Name)' },
  { key: 'spec', label: '規格型番(Spec)' },
  { key: 'category', label: 'カテゴリ(Category)' },
  { key: 'supplier', label: '仕入先メーカー(Supplier)' },
  { key: 'location', label: '保管ボックス名(Location)' },
  { key: 'currentStock', label: '現在庫数(CurrentStock)' },
  { key: 'baseUnit', label: '基準単位(BaseUnit)' },
  { key: 'safetyStock', label: '安全在庫数(SafetyStock)' },
  { key: 'stockStatus', label: '在庫状況(Status)' },
  { key: 'isDiscontinued', label: '廃番指定(Discontinued)' },
  { key: 'discontinuedReason', label: '廃番理由/後継品(Reason)' },
  { key: 'orderUrl', label: '発注URL(OrderUrl)' },
  { key: 'conversions', label: '包装単位換算(Conversions)' },
  { key: 'note', label: '備考(Note)' },
  { key: 'updatedAt', label: '最終更新日時(UpdatedAt)' },
];

/**
 * 文字列の表示幅（全角文字=2, 半角文字=1）を計算
 */
function getVisualWidth(str: string): number {
  if (!str) return 0;
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (
      (code >= 0x3000 && code <= 0x9fff) ||
      (code >= 0xff01 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

/**
 * Excel (.xlsx) & CSV 処理ユーティリティ
 * - 自動列幅調整 (Auto-fit Columns)
 * - ヘッダーオートフィルター (AutoFilter)
 * - UTF-8 BOM 付き CSV
 */
export class CsvHelper {
  /**
   * 品目マスタを Excel (.xlsx) としてエクスポート
   * 自動列幅調整 & ヘッダーオートフィルター付き
   */
  static exportItemsToExcel(
    items: ItemMaster[],
    options?: {
      selectedColumns?: string[];
      filename?: string;
      sheetName?: string;
    }
  ): void {
    const activeHeaders = options?.selectedColumns && options.selectedColumns.length > 0
      ? EXPORT_COLUMNS.filter((h) => options.selectedColumns!.includes(h.key))
      : EXPORT_COLUMNS;

    // 行データの構築
    const tableData: Record<string, any>[] = items.map((item) => {
      const convStr = item.unitConversions
        ? item.unitConversions.map((c) => `${c.unit}:${c.multiplier}`).join('; ')
        : '';

      const isLow = item.currentStock <= item.safetyStock;
      const isZero = item.currentStock === 0;
      const statusLabel = isZero ? '⚠️ 在庫ゼロ' : isLow ? '⚡ 要発注' : '適正在庫';

      const rowMap: Record<string, any> = {
        code: item.code,
        name: item.name,
        spec: item.spec || '',
        category: item.category || '配線・電気資材',
        supplier: item.supplier || '',
        location: item.location || '未設定',
        currentStock: item.currentStock,
        baseUnit: item.baseUnit || '個',
        safetyStock: item.safetyStock,
        stockStatus: statusLabel,
        isDiscontinued: item.isDiscontinued ? '🛑 廃番' : '通常',
        discontinuedReason: item.discontinuedReason || '',
        orderUrl: item.orderUrl || '',
        conversions: convStr,
        note: item.note || '',
        updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleString('ja-JP') : '',
      };

      const orderedRow: Record<string, any> = {};
      activeHeaders.forEach((h) => {
        orderedRow[h.label] = rowMap[h.key] ?? '';
      });
      return orderedRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(tableData);

    // 1. 自適配欄位大小 (Auto-fit Column Widths)
    const colWidths = activeHeaders.map((h) => {
      let maxWidth = getVisualWidth(h.label);
      tableData.forEach((row) => {
        const val = row[h.label] != null ? String(row[h.label]) : '';
        const w = getVisualWidth(val);
        if (w > maxWidth) maxWidth = w;
      });
      // 余裕を持たせて最小 10、最大 65 の範囲で自動調整
      return { wch: Math.min(65, Math.max(10, maxWidth + 3)) };
    });
    worksheet['!cols'] = colWidths;

    // 2. 標題オートフィルター (Header AutoFilter)
    if (items.length > 0 && activeHeaders.length > 0) {
      const lastColIndex = activeHeaders.length - 1;
      const lastColLetter = XLSX.utils.encode_col(lastColIndex);
      worksheet['!autofilter'] = {
        ref: `A1:${lastColLetter}${items.length + 1}`,
      };
    }

    const workbook = XLSX.utils.book_new();
    const sheetName = options?.sheetName || '在庫マスタ';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const filename =
      options?.filename ||
      `在庫マスタ_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  /**
   * ItemMaster 一覧を UTF-8 BOM 付き CSV 文字列に変換
   */
  static exportItemsToCsv(
    items: ItemMaster[],
    options?: {
      selectedColumns?: string[];
    }
  ): string {
    const activeHeaders = options?.selectedColumns && options.selectedColumns.length > 0
      ? EXPORT_COLUMNS.filter((h) => options.selectedColumns!.includes(h.key))
      : EXPORT_COLUMNS;

    const rows = items.map((item) => {
      const convStr = item.unitConversions
        ? item.unitConversions.map((c) => `${c.unit}:${c.multiplier}`).join(';')
        : '';

      const isLow = item.currentStock <= item.safetyStock;
      const isZero = item.currentStock === 0;
      const statusLabel = isZero ? '在庫ゼロ' : isLow ? '要発注' : '適正在庫';

      const valMap: Record<string, string | number> = {
        code: this.escapeCsv(item.code),
        name: this.escapeCsv(item.name),
        spec: this.escapeCsv(item.spec || ''),
        category: this.escapeCsv(item.category || ''),
        supplier: this.escapeCsv(item.supplier || ''),
        location: this.escapeCsv(item.location || ''),
        currentStock: item.currentStock,
        baseUnit: this.escapeCsv(item.baseUnit || '個'),
        safetyStock: item.safetyStock,
        stockStatus: this.escapeCsv(statusLabel),
        isDiscontinued: item.isDiscontinued ? '廃番' : '通常',
        discontinuedReason: this.escapeCsv(item.discontinuedReason || ''),
        orderUrl: this.escapeCsv(item.orderUrl || ''),
        conversions: this.escapeCsv(convStr),
        note: this.escapeCsv(item.note || ''),
        updatedAt: this.escapeCsv(item.updatedAt || ''),
      };

      return activeHeaders.map((h) => valMap[h.key] ?? '""').join(',');
    });

    // Excel 文字化け防止用 UTF-8 BOM (\uFEFF) を付与
    return '\uFEFF' + [activeHeaders.map((h) => h.label).join(','), ...rows].join('\r\n');
  }

  /**
   * 発注書 (Purchase Order) を Excel (.xlsx) としてエクスポート
   */
  static exportPurchaseOrdersToExcel(
    orders: PurchaseOrderItem[],
    orderNumber?: string
  ): void {
    const pOrderNo =
      orderNumber ||
      `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;

    const tableData = orders.map((o, idx) => ({
      'No.': idx + 1,
      '発注番号': pOrderNo,
      '品目コード': o.item.code,
      '品名': o.item.name,
      '規格・型番': o.item.spec || '',
      '仕入先メーカー': o.item.supplier || '',
      '発注数量': o.orderQuantity,
      '発注単位': o.orderUnit,
      '基準換算数': o.calculatedBaseQuantity,
      '基準単位': o.item.baseUnit,
      '現在庫数': o.item.currentStock,
      '安全在庫数': o.item.safetyStock,
      '保管場所': o.item.location,
      '発注URL': o.item.orderUrl || '',
      '発注備考': o.note || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(tableData);

    const headers = Object.keys(tableData[0] || {});
    const colWidths = headers.map((h) => {
      let maxWidth = getVisualWidth(h);
      tableData.forEach((row: any) => {
        const val = row[h] != null ? String(row[h]) : '';
        const w = getVisualWidth(val);
        if (w > maxWidth) maxWidth = w;
      });
      return { wch: Math.min(60, Math.max(10, maxWidth + 3)) };
    });
    worksheet['!cols'] = colWidths;

    if (orders.length > 0) {
      const lastColLetter = XLSX.utils.encode_col(headers.length - 1);
      worksheet['!autofilter'] = {
        ref: `A1:${lastColLetter}${orders.length + 1}`,
      };
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '発注依頼書');
    XLSX.writeFile(workbook, `発注書_${pOrderNo}.xlsx`);
  }

  /**
   * 発注書 (Purchase Order) を UTF-8 BOM 付き CSV に変換
   */
  static exportPurchaseOrdersToCsv(orders: PurchaseOrderItem[], orderNumber?: string): string {
    const pOrderNo =
      orderNumber ||
      `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;
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

    const rows = orders.map((o) =>
      [
        this.escapeCsv(pOrderNo),
        this.escapeCsv(o.item.code),
        this.escapeCsv(o.item.name),
        this.escapeCsv(o.item.spec || ''),
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
      ].join(',')
    );

    return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  }

  /**
   * 発注依頼テキストフォーマット作成（LINE / Slack / メール用）
   */
  static formatPurchaseOrderText(orders: PurchaseOrderItem[], operatorName: string): string {
    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
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
      lines.push(
        `   発注数: ${o.orderQuantity} ${o.orderUnit} (基準: ${o.calculatedBaseQuantity} ${o.item.baseUnit}) [現在庫: ${o.item.currentStock}]`
      );
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
   * CSV / Excel テキストを解析して ItemMaster 配列に変換
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
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        result.push(char);
      }
    }
    result.push(current);
    return result;
  }
}
