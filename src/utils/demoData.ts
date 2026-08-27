import { ItemMaster } from '../types/inventory';

export const INITIAL_DEMO_ITEMS: ItemMaster[] = [
  {
    id: 'item-terminal-r2-4',
    code: '4901480000028',
    name: '丸形圧着端子 (JIS規格)',
    spec: 'R2-4 (適用電線 0.5~2.0mm²)',
    category: '配線・電気資材',
    supplier: 'ニチフ (NICHIFU)',
    baseUnit: '個',
    currentStock: 850,
    safetyStock: 200,
    location: '端子ボックス (A-01)',
    qrCode: 'INV:v1:4901480000028',
    unitConversions: [
      { unit: '箱', multiplier: 500 },
      { unit: 'パック', multiplier: 100 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '制御盤配線標準パーツ'
  },
  {
    id: 'item-terminal-y2-4',
    code: '4901480000073',
    name: 'Y形圧着端子 (先開形)',
    spec: '2Y-4 (適用電線 1.04~2.63mm²)',
    category: '配線・電気資材',
    supplier: 'ニチフ (NICHIFU)',
    baseUnit: '個',
    currentStock: 420,
    safetyStock: 150,
    location: '端子ボックス (A-02)',
    qrCode: 'INV:v1:4901480000073',
    unitConversions: [
      { unit: '箱', multiplier: 500 },
      { unit: 'パック', multiplier: 100 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '端子台ネジ締め配線用'
  },
  {
    id: 'item-cable-tie-150',
    code: '4901480000035',
    name: '耐候性結束バンド (黒)',
    spec: '長さ150mm 幅3.6mm 屋外耐候ナイロン66',
    category: '配線・電気資材',
    supplier: 'パンドウイット (Panduit)',
    baseUnit: '本',
    currentStock: 1200,
    safetyStock: 300,
    location: '結束バンドボックス (B-01)',
    qrCode: 'INV:v1:4901480000035',
    unitConversions: [
      { unit: '袋', multiplier: 100 },
      { unit: '箱', multiplier: 1000 },
      { unit: '本', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '屋外UVカット・制御盤結束'
  },
  {
    id: 'item-fuse-glass-5a',
    code: '4901480000042',
    name: 'ガラス管ヒューズ (速断型)',
    spec: '250V 5A 5.2×20mm',
    category: '制御盤パーツ',
    supplier: '大東通信機 (DAITO)',
    baseUnit: '個',
    currentStock: 35,
    safetyStock: 50, // 安全在庫割れアラート
    location: 'ヒューズボックス (C-01)',
    qrCode: 'INV:v1:4901480000042',
    unitConversions: [
      { unit: '箱', multiplier: 50 },
      { unit: 'パック', multiplier: 10 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '電源回路保護用スペア'
  },
  {
    id: 'item-din-rail-35',
    code: '4901480000080',
    name: 'DINレール (幅35mm)',
    spec: 'アルミ製 長さ1000mm RoHS対応',
    category: '制御盤パーツ',
    supplier: 'IDEC (和泉電気)',
    baseUnit: '本',
    currentStock: 24,
    safetyStock: 10,
    location: '盤材ラック (D-01)',
    qrCode: 'INV:v1:4901480000080',
    unitConversions: [
      { unit: 'セット', multiplier: 10 },
      { unit: '本', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '盤内機器マウント用レール'
  },
  {
    id: 'item-bolt-m6-20',
    code: '4901480000011',
    name: '六角穴付ボルト (ステンレス)',
    spec: 'M6 × 20mm SUS304',
    category: '機構・締結部品',
    supplier: 'ミスミ (MISUMI)',
    baseUnit: '個',
    currentStock: 650,
    safetyStock: 100,
    location: 'ネジボックス (B-02)',
    qrCode: 'INV:v1:4901480000011',
    unitConversions: [
      { unit: '箱', multiplier: 100 },
      { unit: '袋', multiplier: 20 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '防錆仕様・アッセンブリ締結用'
  }
];
