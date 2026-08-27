import * as XLSX from 'xlsx';
import { PurchaseOrderItem } from './csvHelper';
import { NAKANISHI_XLS_TEMPLATE_BASE64 } from './nakanishiTemplateBase64';

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
 * 中西電機工業株式会社向け 正式注文書 Excel 出力ユーティリティ
 * お客様ご提供の「注文見積り書_中西電機.xls」オリジナルバイナリを直接ベーステンプレートとして使用し、
 * セル位置・枠線・フォント・印刷設定・結合セルを100%完全維持して値のみを流し込みます。
 */
export class NakanishiOrderExcelExporter {
  static exportNakanishiOrder(
    orderItems: PurchaseOrderItem[],
    options: NakanishiOrderOptions = {}
  ) {
    const todayReiwa = formatReiwaDate();
    const operator = options.operatorName || '黄';
    const recipientCompany = options.recipientCompany || '中西電機工業㈱';
    const recipientPerson = options.recipientPerson || '林';
    const defaultDeliveryLocation = options.defaultDeliveryLocation || '事務所';
    const defaultDesiredDelivery = options.defaultDesiredDelivery || '大至急';
    const defaultJobCode = options.defaultJobCode || ''; // ユーザー要望2: 工番はデフォルト空白

    // オリジナルの .xls テンプレートを完全なスタイル付きで読み込み
    const wb = XLSX.read(NAKANISHI_XLS_TEMPLATE_BASE64, {
      type: 'base64',
      cellStyles: true,
      cellNF: true,
    });

    const templateSheet = wb.Sheets['部品注文書'];
    if (!templateSheet) {
      throw new Error('テンプレート内に「部品注文書」シートが見つかりません');
    }

    // 15品目ごとにシート分割 (Chunking by 15 items)
    const chunkSize = 15;
    const totalChunks = Math.max(1, Math.ceil(orderItems.length / chunkSize));

    // 新しい出力用ワークブック
    const outputWb = XLSX.utils.book_new();

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      const chunkItems = orderItems.slice(chunkIdx * chunkSize, (chunkIdx + 1) * chunkSize);
      const sheetNumber = chunkIdx + 1;
      const sheetName = totalChunks === 1 ? '部品注文書' : `部品注文書_${sheetNumber}`;

      // テンプレートシートを深層コピーして書式・結合セルを完全継承
      const ws: XLSX.WorkSheet = JSON.parse(JSON.stringify(templateSheet));

      // ヘッダー情報セット
      ws['E3'] = { t: 's', v: recipientCompany };
      ws['K3'] = { t: 's', v: '依頼日' };
      ws['L3'] = { t: 's', v: todayReiwa };
      ws['E5'] = { t: 's', v: recipientPerson };
      ws['F5'] = { t: 's', v: '様' };
      ws['J10'] = { t: 's', v: '担当' };
      ws['K10'] = { t: 's', v: operator };

      // 明細行クリア & データセット (Row 13 ~ Row 27)
      for (let i = 0; i < 15; i++) {
        const row = 13 + i;
        const globalNo = chunkIdx * chunkSize + i + 1;

        // NO. 列
        ws[`B${row}`] = { t: 'n', v: globalNo };

        const orderItem = chunkItems[i];
        if (orderItem) {
          ws[`C${row}`] = { t: 's', v: defaultJobCode }; // 工番（デフォルト空白）
          ws[`D${row}`] = { t: 's', v: orderItem.item.supplier || '' }; // メーカー

          // 型番: 手動編集されたnote、または品名+規格
          const modelVal = orderItem.note || (orderItem.item.spec ? `${orderItem.item.name} ${orderItem.item.spec}` : orderItem.item.name);
          ws[`E${row}`] = { t: 's', v: modelVal };

          ws[`F${row}`] = { t: 'n', v: orderItem.orderQuantity }; // 数量 (数値)
          ws[`G${row}`] = { t: 's', v: orderItem.orderUnit || orderItem.item.baseUnit }; // 単位

          // 単価・金額は空欄（見積回答用）
          delete ws[`H${row}`];
          delete ws[`I${row}`];

          ws[`J${row}`] = { t: 's', v: defaultDesiredDelivery }; // 希望納期
          delete ws[`K${row}`]; // 納期回答は空欄
          ws[`L${row}`] = { t: 's', v: defaultDeliveryLocation }; // 納品場所
        } else {
          // 空白行のサンプルデータをクリア
          delete ws[`C${row}`];
          delete ws[`D${row}`];
          delete ws[`E${row}`];
          delete ws[`F${row}`];
          delete ws[`G${row}`];
          delete ws[`H${row}`];
          delete ws[`I${row}`];
          delete ws[`J${row}`];
          delete ws[`K${row}`];
          delete ws[`L${row}`];
        }
      }

      XLSX.utils.book_append_sheet(outputWb, ws, sheetName);
    }

    // 見積書シートもテンプレートから追加（必要な場合）
    if (wb.Sheets['部品見積書']) {
      const wsEstimate: XLSX.WorkSheet = JSON.parse(JSON.stringify(wb.Sheets['部品見積書']));
      wsEstimate['E3'] = { t: 's', v: recipientCompany };
      wsEstimate['L3'] = { t: 's', v: todayReiwa };
      wsEstimate['E5'] = { t: 's', v: recipientPerson };
      wsEstimate['K10'] = { t: 's', v: operator };
      XLSX.utils.book_append_sheet(outputWb, wsEstimate, '部品見積書');
    }

    // ファイル書き出し
    const fileName = `注文書_中西電機_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(outputWb, fileName);

    return fileName;
  }
}
