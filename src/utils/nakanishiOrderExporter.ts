import * as XLSX from 'xlsx';
import { PurchaseOrderItem } from './csvHelper';

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
 * 既存の「注文見積り書_中西電機.xls」のセル構造・様式に100%完全準拠
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

    // 41行 × 13列の空グリッドを初期化 (1-indexed base)
    const data: (string | number)[][] = Array.from({ length: 41 }, () => Array(14).fill(''));

    // R01: タイトル
    data[0][1] = '　注  　文  　書　';

    // R03: 宛先・依頼日
    data[2][3] = recipientCompany;
    data[2][9] = '依頼日';
    data[2][10] = todayReiwa;

    // R05: 宛名・発注元会社名
    data[4][3] = recipientPerson;
    data[4][4] = '様';
    data[4][9] = '株式会社 アイペック';

    // R06: 郵便番号
    data[5][9] = '  〒519-0323';

    // R07: 挨拶文・住所
    data[6][1] = 'お世話になっております｡下記注文を宜しくお願い致します。';
    data[6][9] = '  三重県鈴鹿市伊船町2014番地の7';

    // R08: TEL
    data[7][9] = '  TEL  059-371-6270';

    // R09: FAX
    data[8][9] = '  FAX  059-371-6271';

    // R10: 担当
    data[9][9] = '担当';
    data[9][10] = operator;

    // R12: 明細ヘッダー (12行目 = index 11)
    data[11][0] = '積算表NO';
    data[11][1] = 'NO.';
    data[11][2] = '工  番';
    data[11][3] = 'メーカー';
    data[11][4] = '型　　　　番';
    data[11][5] = '数量';
    data[11][6] = '単位';
    data[11][7] = '仕入単価';
    data[11][8] = '仕入金額';
    data[11][9] = '希望納期';
    data[11][10] = '納期回答';
    data[11][11] = '納品場所';

    // R13 ~ R27: 明細行 (NO. 1 ~ 15)
    for (let i = 0; i < 15; i++) {
      const rowIdx = 12 + i;
      data[rowIdx][1] = i + 1; // NO. 1 ~ 15

      const orderItem = orderItems[i];
      if (orderItem) {
        data[rowIdx][2] = options.defaultJobCode || ''; // 工番
        data[rowIdx][3] = orderItem.item.supplier || ''; // メーカー
        // 型番優先、なければ品名
        data[rowIdx][4] = orderItem.item.spec ? `${orderItem.item.name} ${orderItem.item.spec}` : orderItem.item.name; // 型番
        data[rowIdx][5] = orderItem.orderQuantity; // 数量
        data[rowIdx][6] = orderItem.orderUnit; // 単位
        data[rowIdx][9] = defaultDesiredDelivery; // 希望納期
        data[rowIdx][11] = defaultDeliveryLocation; // 納品場所
      }
    }

    // R30 ~ R33: 特記事項
    data[29][1] = '特記事項';
    data[30][1] = '※金額･納期は､必ずFAXにてご回答下さい｡';
    data[31][1] = '※希望納期日に入荷不可の場合は、必ずご連絡願います。';
    data[32][1] = '※出荷明細・納品書等には、必ず　注文日・上記注番を記載して下さい。';

    // R35: 備考
    data[34][1] = '備考';

    // ワークブックとシートを作成
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 列幅を設定 (A ~ L)
    ws['!cols'] = [
      { wch: 10 }, // A: 積算表NO
      { wch: 5 },  // B: NO.
      { wch: 12 }, // C: 工番
      { wch: 16 }, // D: メーカー
      { wch: 32 }, // E: 型番
      { wch: 8 },  // F: 数量
      { wch: 6 },  // G: 単位
      { wch: 10 }, // H: 仕入単価
      { wch: 10 }, // I: 仕入金額
      { wch: 12 }, // J: 希望納期 / 会社情報
      { wch: 14 }, // K: 納期回答 / 依頼日・担当
      { wch: 12 }, // L: 納品場所
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '部品注文書');

    // 見積書シートも同じフォーマットで追加
    const dataEstimates = JSON.parse(JSON.stringify(data));
    dataEstimates[0][1] = '部 品 見 積 依 頼 書';
    dataEstimates[6][1] = 'お世話になっております｡下記の部品見積を宜しくお願い致します。';
    const wsEstimates = XLSX.utils.aoa_to_sheet(dataEstimates);
    wsEstimates['!cols'] = ws['!cols'];
    XLSX.utils.book_append_sheet(wb, wsEstimates, '部品見積書');

    // ファイル書き出し
    const fileName = `注文書_中西電機_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(wb, fileName);

    return fileName;
  }
}
