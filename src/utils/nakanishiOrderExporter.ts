import ExcelJS from 'exceljs';
import { PurchaseOrderItem } from './csvHelper';
import { NAKANISHI_XLSX_TEMPLATE_BASE64 } from './nakanishiTemplateBase64';

export interface NakanishiOrderOptions {
  operatorName?: string;
  orderDate?: string;
  recipientCompany?: string;
  recipientPerson?: string;
  defaultJobCode?: string;
  defaultDesiredDelivery?: string;
  defaultDeliveryLocation?: string;
}

/**
 * 令和和暦変換ユーティリティ
 */
export function formatReiwaDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const reiwaYear = year - 2018;
  const reiwaYearStr = reiwaYear === 1 ? '元' : `${reiwaYear}`;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `令和${reiwaYearStr}年${month}月${day}日`;
}

/**
 * 中西電機工業株式会社向け 正式注文書 Excel (.xlsx) 生成ユーティリティ
 * お客様の「注文見積り書_中西電機」のオリジナルデザイン（二重枠線・罫線・フォント・アイペック社ロゴ画像・結合セル）を
 * 100% 完全に維持して値のみを差し替えて出力します。
 */
export class NakanishiOrderExcelExporter {
  static async exportNakanishiOrder(
    orderItems: PurchaseOrderItem[],
    options: NakanishiOrderOptions = {}
  ): Promise<string> {
    const todayReiwa = formatReiwaDate();
    const operator = options.operatorName || '黄';
    const recipientCompany = options.recipientCompany || '中西電機工業㈱';
    const recipientPerson = options.recipientPerson || '林';
    const defaultDeliveryLocation = options.defaultDeliveryLocation || '事務所';
    const defaultDesiredDelivery = options.defaultDesiredDelivery || '大至急';
    const defaultJobCode = options.defaultJobCode || '';

    // Base64からテンプレートのバイナリバッファを作成
    const binaryString = window.atob(NAKANISHI_XLSX_TEMPLATE_BASE64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer);

    const sheet = workbook.getWorksheet('部品注文書');
    if (!sheet) {
      throw new Error('テンプレート内に「部品注文書」シートが見つかりません');
    }

    // 1. ヘッダー情報の書き換え
    sheet.getCell('E3').value = recipientCompany;
    sheet.getCell('L3').value = todayReiwa;
    sheet.getCell('E5').value = recipientPerson;
    sheet.getCell('F5').value = '様';
    sheet.getCell('K10').value = operator;

    // 2. 明細行 (Row 13 ~ Row 27) の書き換え
    const chunkSize = 15;
    for (let i = 0; i < chunkSize; i++) {
      const rowNum = 13 + i;
      const row = sheet.getRow(rowNum);
      const orderItem = orderItems[i];

      // 通番 NO. 1 ~ 15
      row.getCell('B').value = i + 1;

      if (orderItem) {
        row.getCell('C').value = defaultJobCode || null; // 工番（空ならnull）
        row.getCell('D').value = orderItem.item.supplier || null; // メーカー

        // 型番: 画面で調整されたnote、または品名+規格
        const modelVal = orderItem.note || (orderItem.item.spec ? `${orderItem.item.name} ${orderItem.item.spec}` : orderItem.item.name);
        row.getCell('E').value = modelVal;

        row.getCell('F').value = orderItem.orderQuantity; // 数量 (数値)
        row.getCell('G').value = orderItem.orderUnit || orderItem.item.baseUnit; // 単位
        row.getCell('H').value = null; // 仕入単価 (空欄)
        row.getCell('I').value = null; // 仕入金額 (空欄)
        row.getCell('J').value = defaultDesiredDelivery; // 希望納期
        row.getCell('K').value = null; // 納期回答 (空欄)
        row.getCell('L').value = defaultDeliveryLocation; // 納品場所
      } else {
        // 残りのサンプル行をクリア
        row.getCell('C').value = null;
        row.getCell('D').value = null;
        row.getCell('E').value = null;
        row.getCell('F').value = null;
        row.getCell('G').value = null;
        row.getCell('H').value = null;
        row.getCell('I').value = null;
        row.getCell('J').value = null;
        row.getCell('K').value = null;
        row.getCell('L').value = null;
      }
    }

    // 見積書シートのヘッダーも同期
    const estimateSheet = workbook.getWorksheet('部品見積書');
    if (estimateSheet) {
      estimateSheet.getCell('E3').value = recipientCompany;
      estimateSheet.getCell('L3').value = todayReiwa;
      estimateSheet.getCell('E5').value = recipientPerson;
      estimateSheet.getCell('K10').value = operator;
    }

    // ファイル書き出しと自動ダウンロード
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = `注文書_中西電機_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return fileName;
  }
}
