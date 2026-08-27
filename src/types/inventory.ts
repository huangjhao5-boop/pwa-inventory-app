export interface UnitConversion {
  unit: string;      // 例: "箱", "袋", "パック"
  multiplier: number; // 例: 1箱 = 50個の場合 50
}

export interface ItemMaster {
  id: string;
  code: string;               // 品号・JAN/EAN・型番
  name: string;               // 品名
  spec: string;               // 規格・型式 (例: M6×20mm, SUS304)
  category: string;           // 分類 (例: ボルト・締結部品, 電設資材, 消耗品)
  supplier?: string;          // 廠商・サプライヤー (例: ミスミ, SMC, 日東電工)
  imageUrl?: string;          // 写真 (Base64/URL)
  baseUnit: string;           // 基準単位 (例: 個, 本, 枚)
  currentStock: number;       // 現在庫数 (基準単位換算)
  safetyStock: number;        // 安全在庫数 (警告しきい値)
  location: string;           // 保管棚番 (例: A-02-3F)
  qrCode?: string;            // 自作QRコード文字列 (例: INV:v1:BOLT-M6-20)
  unitConversions: UnitConversion[]; // 包裝換算設定 (可動態編輯)
  updatedAt: string;          // 最終更新日時 ISO
  note?: string;              // 備考
}

export type ActionType = 'IN' | 'OUT' | 'AUDIT' | 'ORDER' | 'NEW';

export interface InventoryLog {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: ActionType;           // IN: 入庫, OUT: 出庫, AUDIT: 棚卸, ORDER: 発注, NEW: 新規登録
  delta: number;              // 基準単位での増減量 (+10, -5 など)
  quantity: number;           // 入力された数量 (例: 2)
  unit: string;               // 入力された単位 (例: "箱")
  multiplier: number;         // 換算倍率 (例: 50)
  baseQuantity: number;       // 換算後の基準数量 (例: 100)
  operator: string;           // 作業員コード/氏名 (例: OP-01, 田中)
  timestamp: string;          // ISO日時
  note?: string;              // メモ
  synced: boolean;            // クラウド/サーバー同期済みフラグ
}

export interface BatchScanItem {
  id: string;                 // 一時ID
  item: ItemMaster;
  actionType: 'IN' | 'OUT';
  selectedUnit: string;
  multiplier: number;
  enteredQuantity: number;    // 入力数量
  calculatedBaseQuantity: number; // 基準換算数量
  scannedAt: number;          // タイムスタンプ
}

export type SystemViewMode = 'FIELD' | 'PC_ADMIN';
export type TabKey = 'SCAN' | 'BATCH' | 'ITEMS' | 'LOGS' | 'PRINT' | 'SETTINGS';

export interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  debounceMs: number;
  activeOperator: string;
  offlineMode: boolean;
  viewMode: SystemViewMode;
  autoTorch: boolean;
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
