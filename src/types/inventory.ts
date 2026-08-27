export type ActionType = 'IN' | 'OUT' | 'AUDIT' | 'ORDER';

export type SystemViewMode = 'FIELD' | 'PC_ADMIN';

export const PRESET_UNITS = [
  '個',
  '本',
  '枚',
  '箱',
  '袋',
  '卷',
  '式',
  '瓶',
  '組',
  '支',
  '包',
  '套',
  '盒',
  '台',
  '張',
  '條',
  'kg',
  'm',
  'L'
] as const;

export interface UnitConversion {
  unit: string;        // 包裝單位 (例: 箱, 袋, パック, 本)
  multiplier: number;  // 換算基準數量 (例: 1箱 = 50個 -> multiplier: 50)
}

export interface ItemMaster {
  id: string;
  code: string;               // 品號 / JAN/EAN / 自訂條碼
  name: string;               // 品名
  spec: string;               // 規格・型號 (例: M6×20mm, SUS304)
  category: string;           // 分類 (例: 螺栓螺帽, 配線資材, 消耗品)
  supplier?: string;          // 廠商・供應商 (例: MISUMI, SMC, 日富端子)
  imageUrl?: string;          // 拍照照片 (Base64/URL)
  baseUnit: string;           // 基準單位 (例: 個, 本, 枚)
  currentStock: number;       // 現在庫數 (基準單位換算)
  safetyStock: number;        // 安全在庫數 (警告閥值)
  location: string;           // 盒子名稱 / 盒號 (例: 1號盒 (A-01))
  qrCode?: string;            // 自建 QR 碼字串 (例: INV:v1:4901480000011)
  unitConversions: UnitConversion[]; // 包裝換算設定
  updatedAt: string;          // 最終更新時間 ISO
  note?: string;              // 備註
}

/**
 * 待審核入庫單 (現場掃描暫存 -> PC 電腦端審核正式入庫)
 */
export interface PendingInbound {
  id: string;
  itemCode: string;
  itemName: string;
  spec?: string;
  category?: string;
  supplier?: string;
  imageUrl?: string;
  quantity: number;           // 現場輸入數量
  unit: string;               // 現場輸入單位
  multiplier: number;         // 換算倍率
  baseQuantity: number;       // 換算後基準入庫數
  location: string;           // 儲存盒子名稱
  operator: string;           // 現場作業員
  scannedAt: string;          // 掃描時間 ISO
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string;              // 現場備註
}

export interface InventoryLog {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: ActionType;
  delta: number;              // 庫存變動量 (+50, -10)
  quantity: number;           // 輸入數量 (3)
  unit: string;               // 輸入單位 (箱)
  multiplier: number;         // 換算倍率 (50)
  baseQuantity: number;       // 換算後基準數量 (150)
  operator: string;           // 操作作業員代碼
  timestamp: string;          // 記錄時間 ISO
  note?: string;              // 備註
  synced: boolean;            // 雲端同步狀態
}

export interface BatchScanItem {
  id: string;
  item: ItemMaster;
  actionType: 'IN' | 'OUT';
  selectedUnit: string;
  multiplier: number;
  enteredQuantity: number;
  calculatedBaseQuantity: number;
  scannedAt: number;
}

export interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  debounceMs: number;
  activeOperator: string;
  offlineMode: boolean;
  viewMode: SystemViewMode;
  autoTorch: boolean;
  requirePcApprovalForInbound: boolean; // 是否啟用「PC正式審核後才入庫」流程
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket?: string;
    messagingSenderId?: string;
    appId?: string;
  };
}

export type LabelLayout = 'A-ONE-24' | 'A-ONE-44' | 'SINGLE-THERMAL';

export type TabKey = 'SCAN' | 'BATCH' | 'APPROVAL' | 'ITEMS' | 'LOGS' | 'PRINT' | 'SETTINGS';
