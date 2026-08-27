import { ItemMaster } from '../types/inventory';

export const INITIAL_DEMO_ITEMS: ItemMaster[] = [
  {
    id: 'item-bolt-m6-20',
    code: '4901480000011',
    name: '六角穴付ボルト (SUS304)',
    spec: 'M6 × 20mm ステンレス',
    category: 'ボルト・締結部品',
    supplier: 'ミスミ (MISUMI)',
    baseUnit: '個',
    currentStock: 450,
    safetyStock: 100,
    location: 'A-01-1F',
    qrCode: 'INV:v1:4901480000011:LOT2026A',
    unitConversions: [
      { unit: '箱', multiplier: 100 },
      { unit: '袋', multiplier: 20 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '防錆仕様、メインアセンブリ用'
  },
  {
    id: 'item-terminal-r2-4',
    code: '4901480000028',
    name: '丸形圧着端子 (JIS規格)',
    spec: 'R2-4 (0.5~2.0sq用)',
    category: '配線・電気資材',
    supplier: 'ニチフ端子工業 (NICHIFU)',
    baseUnit: '個',
    currentStock: 80,
    safetyStock: 200, // 在庫割れアラート対象
    location: 'B-03-2F',
    qrCode: 'INV:v1:4901480000028',
    unitConversions: [
      { unit: '箱', multiplier: 500 },
      { unit: 'パック', multiplier: 100 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '制御盤配線用標準部品'
  },
  {
    id: 'item-cable-tie-150',
    code: '4901480000035',
    name: '耐候性結束バンド (黒)',
    spec: '長さ150mm 幅3.6mm ナイロン66',
    category: '配線・電気資材',
    supplier: 'パンドウイット (Panduit)',
    baseUnit: '本',
    currentStock: 620,
    safetyStock: 150,
    location: 'B-04-1F',
    qrCode: 'INV:v1:4901480000035',
    unitConversions: [
      { unit: '袋', multiplier: 100 },
      { unit: '箱', multiplier: 1000 },
      { unit: '本', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '屋外対応UVカット仕様'
  },
  {
    id: 'item-fuse-glass-5a',
    code: '4901480000042',
    name: 'ガラス管ヒューズ (速断型)',
    spec: '250V 5A 5.2×20mm',
    category: '電子パーツ',
    supplier: '大東通信機 (DAITO)',
    baseUnit: '個',
    currentStock: 35,
    safetyStock: 50, // 在庫割れ警告
    location: 'C-01-3F',
    qrCode: 'INV:v1:4901480000042',
    unitConversions: [
      { unit: '箱', multiplier: 50 },
      { unit: '袋', multiplier: 10 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '電源ユニット予備パーツ'
  },
  {
    id: 'item-air-fitting-kq2h06-01s',
    code: '4901480000059',
    name: 'ワンタッチ管継手 (ハーフユニオン)',
    spec: 'チューブ外径φ6 / 接続ねじR1/8',
    category: '空圧・配管部品',
    supplier: 'SMC株式会社',
    baseUnit: '個',
    currentStock: 120,
    safetyStock: 30,
    location: 'D-02-1F',
    qrCode: 'INV:v1:4901480000059',
    unitConversions: [
      { unit: '箱', multiplier: 10 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: 'SMC同等品 シール剤付'
  },
  {
    id: 'item-oring-p10-nbr',
    code: '4901480000066',
    name: 'Oリング (ニトリルゴム NBR-70)',
    spec: 'P-10 (内径9.8mm × 太さ1.9mm)',
    category: 'シール・パッキン',
    supplier: 'NOK株式会社',
    baseUnit: '個',
    currentStock: 15,
    safetyStock: 40, // 在庫割れ警告
    location: 'D-03-2F',
    qrCode: 'INV:v1:4901480000066',
    unitConversions: [
      { unit: '袋', multiplier: 50 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '耐油用・定期交換パーツ'
  }
];
