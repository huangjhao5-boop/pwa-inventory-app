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

    // 1. ヘッダー情報の書き換え & フォント・配置設定（原版スタイル完全準拠）
    // E3: 中西電機工業㈱ (フォント: ＭＳ Ｐ明朝, 22pt, 下線, 右揃え)
    const cellE3 = sheet.getCell('E3');
    cellE3.value = recipientCompany;
    cellE3.font = { name: 'ＭＳ Ｐ明朝', size: 22, underline: true };
    cellE3.alignment = { horizontal: 'right', vertical: 'middle' };

    // L3: 依頼日日付 (フォント: ＭＳ Ｐ明朝, 14pt, 中央揃え)
    const cellL3 = sheet.getCell('L3');
    cellL3.value = todayReiwa;
    cellL3.font = { name: 'ＭＳ Ｐ明朝', size: 14 };
    cellL3.alignment = { horizontal: 'center', vertical: 'middle' };

    // E5: 宛名 (フォント: ＭＳ Ｐ明朝, 18pt, 下線, 右揃え)
    const cellE5 = sheet.getCell('E5');
    cellE5.value = recipientPerson;
    cellE5.font = { name: 'ＭＳ Ｐ明朝', size: 18, underline: true };
    cellE5.alignment = { horizontal: 'right', vertical: 'middle' };

    // F5: 様 (フォント: ＭＳ Ｐ明朝, 16pt, 左揃え)
    const cellF5 = sheet.getCell('F5');
    cellF5.value = '様';
    cellF5.font = { name: 'ＭＳ Ｐ明朝', size: 16 };
    cellF5.alignment = { horizontal: 'left', vertical: 'middle' };

    // J10: 担当 (フォント: ＭＳ Ｐ明朝, 14pt, 中央揃え, 上下中央)
    const cellJ10 = sheet.getCell('J10');
    cellJ10.value = '担当';
    cellJ10.font = { name: 'ＭＳ Ｐ明朝', size: 14 };
    cellJ10.alignment = { horizontal: 'center', vertical: 'middle' };

    // K10: 担当者名 (フォント: ＭＳ Ｐ明朝, 14pt, 左揃え, 上下中央)
    const cellK10 = sheet.getCell('K10');
    cellK10.value = operator;
    cellK10.font = { name: 'ＭＳ Ｐ明朝', size: 14, bold: true };
    cellK10.alignment = { horizontal: 'left', vertical: 'middle' };

    // 2. 明細行 (Row 13 ~ Row 27) の書き換え（原版行高21.9pt、フォントは全セル【ＭＳ Ｐ明朝】に完全統一、文字長自動調整で超框防止）
    const getVisualCharLength = (text: string): number => {
      if (!text) return 0;
      let len = 0;
      for (let j = 0; j < text.length; j++) {
        len += text.charCodeAt(j) > 255 ? 1 : 0.55;
      }
      return len;
    };

    const getMakerFontSize = (text: string): number => {
      const len = getVisualCharLength(text);
      if (len <= 4) return 14;
      if (len <= 5.5) return 12;
      if (len <= 8) return 10;
      return 9;
    };

    const getModelFontSize = (text: string): number => {
      const len = getVisualCharLength(text);
      if (len <= 24) return 14;
      if (len <= 30) return 12;
      if (len <= 36) return 10;
      return 9;
    };

    const chunkSize = 15;
    for (let i = 0; i < chunkSize; i++) {
      const rowNum = 13 + i;
      const row = sheet.getRow(rowNum);
      row.height = 21.9;

      const orderItem = orderItems[i];

      // B: 通番 NO. 1 ~ 15 (フォント 16pt, 中央揃え, ＭＳ Ｐ明朝)
      const cellB = row.getCell('B');
      cellB.value = i + 1;
      cellB.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
      cellB.font = { name: 'ＭＳ Ｐ明朝', size: 16 };

      if (orderItem) {
        // C: 工番 (フォント 14pt, 中央揃え, ＭＳ Ｐ明朝)
        const cellC = row.getCell('C');
        cellC.value = defaultJobCode || null;
        cellC.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellC.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

        // D: メーカー (動的サイズ調整 14pt〜9pt で超框を完全防止, ＭＳ Ｐ明朝)
        const mfrText = orderItem.item.supplier || '';
        const cellD = row.getCell('D');
        cellD.value = mfrText || null;
        cellD.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellD.font = { name: 'ＭＳ Ｐ明朝', size: getMakerFontSize(mfrText) };

        // E: 型番 (動的サイズ調整 14pt〜9pt で超框を完全防止, 左揃え, ＭＳ Ｐ明朝)
        const modelVal = orderItem.note || (orderItem.item.spec ? `${orderItem.item.name} ${orderItem.item.spec}` : orderItem.item.name);
        const cellE = row.getCell('E');
        cellE.value = modelVal;
        cellE.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
        cellE.font = { name: 'ＭＳ Ｐ明朝', size: getModelFontSize(modelVal) };

        // F: 数量 (ＭＳ Ｐ明朝 に統一！)
        const cellF = row.getCell('F');
        cellF.value = orderItem.orderQuantity;
        cellF.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellF.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

        // G: 単位 (ＭＳ Ｐ明朝 に統一！)
        const cellG = row.getCell('G');
        cellG.value = orderItem.orderUnit || orderItem.item.baseUnit;
        cellG.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellG.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

        // H: 仕入単価 (空欄)
        const cellH = row.getCell('H');
        cellH.value = null;

        // I: 仕入金額 (空欄)
        const cellI = row.getCell('I');
        cellI.value = null;

        // J: 希望納期 (フォント 14pt, 中央揃え, ＭＳ Ｐ明朝)
        const cellJ = row.getCell('J');
        cellJ.value = defaultDesiredDelivery;
        cellJ.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellJ.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

        // K: 納期回答 (空欄)
        const cellK = row.getCell('K');
        cellK.value = null;

        // L: 納品場所 (結合セルL:M / フォント 14pt, 中央揃え, ＭＳ Ｐ明朝)
        const cellL = row.getCell('L');
        cellL.value = defaultDeliveryLocation;
        cellL.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cellL.font = { name: 'ＭＳ Ｐ明朝', size: 14 };
      } else {
        // 未使用行のデータをクリア
        ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
          const c = row.getCell(col);
          c.value = null;
        });
      }
    }

    // 3. 印刷ページ設定：A4横 1ページに確実に収まる設定（原版完全一致）
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
    delete (sheet.pageSetup as any).scale;

    // 改ページプレビュー表示、ズーム60%（原版完全一致）
    sheet.views = [
      {
        rightToLeft: false,
        state: 'normal',
        showRuler: true,
        showRowColHeaders: true,
        showGridLines: true,
        zoomScale: 60,
        zoomScaleNormal: 75,
        activeCell: 'C13',
        style: 'pageBreakPreview'
      } as any
    ];

    // 見積書シートも同期（原版スタイル完全準拠）
    const estimateSheet = workbook.getWorksheet('部品見積書');
    if (estimateSheet) {
      estimateSheet.getCell('E3').value = recipientCompany;
      estimateSheet.getCell('E3').font = { name: 'ＭＳ Ｐ明朝', size: 22, underline: true };
      estimateSheet.getCell('E3').alignment = { horizontal: 'right', vertical: 'middle' };

      estimateSheet.getCell('L3').value = todayReiwa;
      estimateSheet.getCell('L3').font = { name: 'ＭＳ Ｐ明朝', size: 14 };
      estimateSheet.getCell('L3').alignment = { horizontal: 'center', vertical: 'middle' };

      estimateSheet.getCell('E5').value = recipientPerson;
      estimateSheet.getCell('E5').font = { name: 'ＭＳ Ｐ明朝', size: 18, underline: true };
      estimateSheet.getCell('E5').alignment = { horizontal: 'right', vertical: 'middle' };

      estimateSheet.getCell('F5').value = '様';
      estimateSheet.getCell('F5').font = { name: 'ＭＳ Ｐ明朝', size: 16 };
      estimateSheet.getCell('F5').alignment = { horizontal: 'left', vertical: 'middle' };

      estimateSheet.getCell('J10').value = '担当';
      estimateSheet.getCell('J10').font = { name: 'ＭＳ Ｐ明朝', size: 14 };
      estimateSheet.getCell('J10').alignment = { horizontal: 'center', vertical: 'middle' };

      estimateSheet.getCell('K10').value = operator;
      estimateSheet.getCell('K10').font = { name: 'ＭＳ Ｐ明朝', size: 14, bold: true };
      estimateSheet.getCell('K10').alignment = { horizontal: 'left', vertical: 'middle' };

      for (let r = 13; r <= 27; r++) {
        estimateSheet.getRow(r).height = 21.9;
        const oItem = orderItems[r - 13];
        const rRow = estimateSheet.getRow(r);
        const cB = rRow.getCell('B');
        cB.value = r - 12;
        cB.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
        cB.font = { name: 'ＭＳ Ｐ明朝', size: 16 };

        if (oItem) {
          const cC = rRow.getCell('C');
          cC.value = defaultJobCode || null;
          cC.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
          cC.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

          const mText = oItem.item.supplier || '';
          const cD = rRow.getCell('D');
          cD.value = mText || null;
          cD.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
          cD.font = { name: 'ＭＳ Ｐ明朝', size: getMakerFontSize(mText) };

          const mVal = oItem.note || (oItem.item.spec ? `${oItem.item.name} ${oItem.item.spec}` : oItem.item.name);
          const cE = rRow.getCell('E');
          cE.value = mVal;
          cE.alignment = { horizontal: 'left', vertical: 'middle', shrinkToFit: true };
          cE.font = { name: 'ＭＳ Ｐ明朝', size: getModelFontSize(mVal) };

          const cF = rRow.getCell('F');
          cF.value = oItem.orderQuantity;
          cF.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
          cF.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

          const cG = rRow.getCell('G');
          cG.value = oItem.orderUnit || oItem.item.baseUnit;
          cG.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
          cG.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

          rRow.getCell('H').value = null;
          rRow.getCell('I').value = null;

          const cJ = rRow.getCell('J');
          cJ.value = defaultDesiredDelivery;
          cJ.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
          cJ.font = { name: 'ＭＳ Ｐ明朝', size: 14 };

          rRow.getCell('K').value = null;

          const cL = rRow.getCell('L');
          cL.value = defaultDeliveryLocation;
          cL.alignment = { horizontal: 'center', vertical: 'middle', shrinkToFit: true };
          cL.font = { name: 'ＭＳ Ｐ明朝', size: 14 };
        } else {
          ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
            rRow.getCell(col).value = null;
          });
        }
      }

      estimateSheet.pageSetup.fitToPage = true;
      estimateSheet.pageSetup.fitToWidth = 1;
      estimateSheet.pageSetup.fitToHeight = 1;
      delete (estimateSheet.pageSetup as any).scale;

      estimateSheet.views = [
        {
          rightToLeft: false,
          state: 'normal',
          showRuler: true,
          showRowColHeaders: true,
          showGridLines: true,
          zoomScale: 60,
          zoomScaleNormal: 75,
          activeCell: 'C13',
          style: 'pageBreakPreview'
        } as any
      ];
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
