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
 * お客様の「注文見積り書_中西電機」のオリジナルデザイン（二重枠線・罫線・アイペック社ロゴ画像・結合セル）を
 * 100% 完全に維持し、型番・メーカー・数量・単位・希望納期・納品場所を含む【全行・全セル】を
 * 水平・垂直（上下）完全中央揃え (horizontal: 'center', vertical: 'middle') かつ自動縮小表示で出力します。
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

    // 列幅の最適化
    sheet.getColumn('A').width = 11;
    sheet.getColumn('B').width = 6;
    sheet.getColumn('C').width = 12;
    sheet.getColumn('D').width = 16;
    sheet.getColumn('E').width = 36;
    sheet.getColumn('F').width = 8;
    sheet.getColumn('G').width = 6;
    sheet.getColumn('H').width = 10;
    sheet.getColumn('I').width = 10;
    sheet.getColumn('J').width = 12;
    sheet.getColumn('K').width = 10;
    sheet.getColumn('L').width = 8;
    sheet.getColumn('M').width = 8;

    // 1. ヘッダー情報の書き換え & フォント・配置設定
    const cellE3 = sheet.getCell('E3');
    cellE3.value = recipientCompany;
    cellE3.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
    cellE3.font = { name: 'ＭＳ Ｐ明朝', size: 14, underline: true };

    const cellL3 = sheet.getCell('L3');
    cellL3.value = todayReiwa;
    cellL3.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
    cellL3.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

    const cellE5 = sheet.getCell('E5');
    cellE5.value = recipientPerson;
    cellE5.alignment = { horizontal: 'right', vertical: 'middle', shrinkToFit: true };
    cellE5.font = { name: 'ＭＳ Ｐ明朝', size: 18, underline: true };

    const cellF5 = sheet.getCell('F5');
    cellF5.value = '様';
    cellF5.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
    cellF5.font = { name: 'ＭＳ Ｐ明朝', size: 16 };

    const cellJ10 = sheet.getCell('J10');
    cellJ10.value = '担当';
    cellJ10.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
    cellJ10.font = { name: 'ＭＳ Ｐ明朝', size: 11 };

    const cellK10 = sheet.getCell('K10');
    cellK10.value = operator;
    cellK10.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
    cellK10.font = { name: 'ＭＳ Ｐ明朝', size: 11, bold: true };

    // 2. 明細行 (Row 13 ~ Row 27) の書き換えと【全行完全中央揃え】設定
    const chunkSize = 15;
    for (let i = 0; i < chunkSize; i++) {
      const rowNum = 13 + i;
      const row = sheet.getRow(rowNum);
      row.height = 24;

      const orderItem = orderItems[i];

      // B: 通番 NO. 1 ~ 15 (完全中央揃え)
      const cellB = row.getCell('B');
      cellB.value = i + 1;
      cellB.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      cellB.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

      if (orderItem) {
        // C: 工番 (完全中央揃え)
        const cellC = row.getCell('C');
        cellC.value = defaultJobCode || null;
        cellC.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellC.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // D: メーカー (完全中央揃え)
        const cellD = row.getCell('D');
        cellD.value = orderItem.item.supplier || null;
        cellD.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellD.font = { name: 'ＭＳ Ｐ明朝', size: 11 };

        // E: 型番 (完全中央揃え: 1行目・2行目・3行目すべて均一に中央揃え)
        const cellE = row.getCell('E');
        const modelVal = orderItem.note || (orderItem.item.spec ? `${orderItem.item.name} ${orderItem.item.spec}` : orderItem.item.name);
        cellE.value = modelVal;
        cellE.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellE.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // F: 数量 (完全中央揃え)
        const cellF = row.getCell('F');
        cellF.value = orderItem.orderQuantity;
        cellF.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellF.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // G: 単位 (完全中央揃え)
        const cellG = row.getCell('G');
        cellG.value = orderItem.orderUnit || orderItem.item.baseUnit;
        cellG.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellG.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // H: 仕入単価 (完全中央揃え / 空欄)
        const cellH = row.getCell('H');
        cellH.value = null;
        cellH.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

        // I: 仕入金額 (完全中央揃え / 空欄)
        const cellI = row.getCell('I');
        cellI.value = null;
        cellI.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

        // J: 希望納期 (完全中央揃え)
        const cellJ = row.getCell('J');
        cellJ.value = defaultDesiredDelivery;
        cellJ.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellJ.font = { name: 'ＭＳ Ｐ明朝', size: 12 };

        // K: 納期回答 (完全中央揃え / 空欄)
        const cellK = row.getCell('K');
        cellK.value = null;
        cellK.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };

        // L: 納品場所 (結合セルL:M / 完全中央揃え)
        const cellL = row.getCell('L');
        cellL.value = defaultDeliveryLocation;
        cellL.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellL.font = { name: 'ＭＳ Ｐ明朝', size: 12 };
      } else {
        // 未使用行のデータをクリア（中央揃えと自動縮小は維持）
        ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
          const c = row.getCell(col);
          c.value = null;
          c.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        });
      }
    }

    // 見積書シートも同期
    const estimateSheet = workbook.getWorksheet('部品見積書');
    if (estimateSheet) {
      estimateSheet.getColumn('A').width = 11;
      estimateSheet.getColumn('B').width = 6;
      estimateSheet.getColumn('C').width = 12;
      estimateSheet.getColumn('D').width = 16;
      estimateSheet.getColumn('E').width = 36;
      estimateSheet.getColumn('F').width = 8;
      estimateSheet.getColumn('G').width = 6;
      estimateSheet.getColumn('H').width = 10;
      estimateSheet.getColumn('I').width = 10;
      estimateSheet.getColumn('J').width = 12;
      estimateSheet.getColumn('K').width = 10;
      estimateSheet.getColumn('L').width = 8;
      estimateSheet.getColumn('M').width = 8;

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
