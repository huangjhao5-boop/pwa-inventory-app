import { ItemMaster } from '../types/inventory';

export const INITIAL_DEMO_ITEMS: ItemMaster[] = [
  {
    id: 'item-bolt-m6-20',
    code: '4901480000011',
    name: '六角孔螺栓 (SUS304不鏽鋼)',
    spec: 'M6 × 20mm 不鏽鋼',
    category: '螺栓・緊固件',
    supplier: 'MISUMI (米思米)',
    baseUnit: '個',
    currentStock: 450,
    safetyStock: 100,
    location: '1號盒 (A-01)',
    qrCode: 'INV:v1:4901480000011:LOT2026A',
    unitConversions: [
      { unit: '箱', multiplier: 100 },
      { unit: '袋', multiplier: 20 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '防銹規格、主裝配用'
  },
  {
    id: 'item-terminal-r2-4',
    code: '4901480000028',
    name: '圓形壓著端子 (JIS標準)',
    spec: 'R2-4 (0.5~2.0sq用)',
    category: '配線・電氣資材',
    supplier: 'NICHIFU (日富端子)',
    baseUnit: '個',
    currentStock: 80,
    safetyStock: 200, // 在庫割れアラート対象
    location: '2號盒 (B-03)',
    qrCode: 'INV:v1:4901480000028',
    unitConversions: [
      { unit: '箱', multiplier: 500 },
      { unit: '包', multiplier: 100 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '控制盤配線標準零件'
  },
  {
    id: 'item-cable-tie-150',
    code: '4901480000035',
    name: '耐候束線帶 (黑色束帶)',
    spec: '長150mm 寬3.6mm 尼龍66',
    category: '配線・電氣資材',
    supplier: 'Panduit (泛達)',
    baseUnit: '條',
    currentStock: 620,
    safetyStock: 150,
    location: '3號盒 (B-04)',
    qrCode: 'INV:v1:4901480000035',
    unitConversions: [
      { unit: '包', multiplier: 100 },
      { unit: '箱', multiplier: 1000 },
      { unit: '條', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '戶外抗UV耐候規格'
  },
  {
    id: 'item-fuse-glass-5a',
    code: '4901480000042',
    name: '玻璃管保險絲 (快斷型)',
    spec: '250V 5A 5.2×20mm',
    category: '電子零件',
    supplier: 'DAITO (大東通信機)',
    baseUnit: '個',
    currentStock: 35,
    safetyStock: 50, // 在庫割れ警告
    location: '4號盒 (C-01)',
    qrCode: 'INV:v1:4901480000042',
    unitConversions: [
      { unit: '盒', multiplier: 50 },
      { unit: '袋', multiplier: 10 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '電源模組備份零件'
  },
  {
    id: 'item-air-fitting-kq2h06-01s',
    code: '4901480000059',
    name: '快速氣壓接頭 (外螺紋直通)',
    spec: '氣管外徑φ6 / 接頭牙口R1/8',
    category: '氣動・空壓管路',
    supplier: 'SMC',
    baseUnit: '個',
    currentStock: 120,
    safetyStock: 30,
    location: '5號盒 (D-02)',
    qrCode: 'INV:v1:4901480000059',
    unitConversions: [
      { unit: '盒', multiplier: 10 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: 'SMC同等品 附密封膠'
  },
  {
    id: 'item-oring-p10-nbr',
    code: '4901480000066',
    name: 'O型環 (耐油丁腈橡膠 NBR-70)',
    spec: 'P-10 (內徑9.8mm × 線徑1.9mm)',
    category: '密封件・油封',
    supplier: 'NOK',
    baseUnit: '個',
    currentStock: 15,
    safetyStock: 40, // 在庫割れ警告
    location: '6號盒 (D-03)',
    qrCode: 'INV:v1:4901480000066',
    unitConversions: [
      { unit: '包', multiplier: 50 },
      { unit: '個', multiplier: 1 }
    ],
    updatedAt: new Date().toISOString(),
    note: '耐油定期更換零件'
  }
];
