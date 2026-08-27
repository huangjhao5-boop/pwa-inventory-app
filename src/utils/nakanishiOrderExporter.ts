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
 * 100% 完全に維持し、全セルに「文字の自動縮小表示（shrinkToFit: true）」を設定して文字が枠外にはみ出さないよう完全制御します。
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

    // 1. ヘッダー情報の書き換え & アライメント設定（自動縮小付き）
    const cellE3 = sheet.getCell('E3');
    cellE3.value = recipientCompany;
    cellE3.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

    const cellL3 = sheet.getCell('L3');
    cellL3.value = todayReiwa;
    cellL3.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

    const cellE5 = sheet.getCell('E5');
    cellE5.value = recipientPerson;
    cellE5.alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true };

    const cellF5 = sheet.getCell('F5');
    cellF5.value = '様';
    cellF5.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };

    const cellJ10 = sheet.getCell('J10');
    cellJ10.value = '担当';
    cellJ10.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

    const cellK10 = sheet.getCell('K10');
    cellK10.value = operator;
    cellK10.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };

    // 2. 明細行 (Row 13 ~ Row 27) の書き換えと「文字のはみ出し防止（自動縮小）」設定
    const chunkSize = 15;
    for (let i = 0; i < chunkSize; i++) {
      const rowNum = 13 + i;
      const row = sheet.getRow(rowNum);
      const orderItem = orderItems[i];

      // B: 通番 NO. 1 ~ 15 (中央揃え)
      const cellB = row.getCell('B');
      cellB.value = i + 1;
      cellB.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      cellB.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

      if (orderItem) {
        // C: 工番 (中央揃え / 自動縮小)
        const cellC = row.getCell('C');
        cellC.value = defaultJobCode || null;
        cellC.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellC.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // D: メーカー (中央揃え / 自動縮小)
        const cellD = row.getCell('D');
        cellD.value = orderItem.item.supplier || null;
        cellD.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellD.font = { name: 'ＭＳ Ｐ明朝', size: 11 };

        // E: 型番 (左揃え / 自動縮小: 長い文字でも枠内に自動収縮)
        const cellE = row.getCell('E');
        const modelVal = orderItem.note || (orderItem.item.spec ? `${orderItem.item.name} ${orderItem.item.spec}` : orderItem.item.name);
        cellE.value = modelVal;
        cellE.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
        cellE.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // F: 数量 (中央揃え / 自動縮小)
        const cellF = row.getCell('F');
        cellF.value = orderItem.orderQuantity;
        cellF.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellF.font = { name: 'ＭＳ Ｐゴシック', size: 13 };

        // G: 単位 (中央揃え / 自動縮小)
        const cellG = row.getCell('G');
        cellG.value = orderItem.orderUnit || orderItem.item.baseUnit;
        cellG.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellG.font = { name: 'ＭＳ Ｐゴシック', size: 13 };

        // H: 仕入単価 (空欄 / 自動縮小)
        const cellH = row.getCell('H');
        cellH.value = null;
        cellH.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

        // I: 仕入金額 (空欄 / 自動縮小)
        const cellI = row.getCell('I');
        cellI.value = null;
        cellI.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

        // J: 希望納期 (中央揃え / 自動縮小)
        const cellJ = row.getCell('J');
        cellJ.value = defaultDesiredDelivery;
        cellJ.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellJ.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // K: 納期回答 (空欄 / 自動縮小)
        const cellK = row.getCell('K');
        cellK.value = null;
        cellK.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

        // L: 納品場所 (結合セルL:M / 中央揃え / 自動縮小)
        const cellL = row.getCell('L');
        cellL.value = defaultDeliveryLocation;
        cellL.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellL.font = { name: 'ＭＳ Ｐ明朝', size: 12 };
      } else {
        // 残りのサンプル行をクリア（書式と自動縮小は維持）
        ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
          const c = row.getCell(col);
          c.value = null;
          c.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        });
      }
    }

    // 見積書シートのヘッダーも同期
    const estimateSheet = workbook.getWorksheet('部品見積書');
    if (estimateSheet) {
      estimateSheet.getCell('E3').value = recipientCompany;
      estimateSheet.getCell('E3').alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      estimateSheet.getCell('L3').value = todayReiwa;
      estimateSheet.getCell('L3').alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      estimateSheet.getCell('E5').value = recipientPerson;
      estimateSheet.getCell('E5').alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true };
      estimateSheet.getCell('F5').value = '様';
      estimateSheet.getCell('F5').alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
      estimateSheet.getCell('J10').value = '担当';
      estimateSheet.getCell('J10').alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      estimateSheet.getCell('K10').value = operator;
      estimateSheet.getCell('K10').alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
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
