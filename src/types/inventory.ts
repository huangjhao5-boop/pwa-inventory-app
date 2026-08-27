export type ActionType = 'IN' | 'OUT' | 'AUDIT' | 'ORDER';

export type SystemViewMode = 'FIELD' | 'PC_ADMIN';

export const PRESET_UNITS = [
  '個',
  '本',
  '枚',
  '箱',
  '袋',
  '巻',
  '式',
  '本/組',
  'パック',
  'セット',
  'kg',
  'm',
  'L'
] as const;

export interface UnitConversion {
  unit: string;        // 包装単位 (例: 箱, 袋, パック, 巻)
  multiplier: number;  // 換算基準数量 (例: 1箱 = 50個 -> multiplier: 50)
}

export interface ItemMaster {
  id: string;
  code: string;               // 品目コード / JAN・EAN / QRコード
  name: string;               // 品名 (例: 絶縁被覆付圧着端子 R2-4)
  spec: string;               // 規格・型番 (例: R2-4 / 0.5~2.0sq)
  category: string;           // カテゴリ (例: 配線・電気資材, 制御盤パーツ)
  supplier?: string;          // メーカー・仕入先 (例: ニチフ, パンドウイット, オムロン)
  imageUrl?: string;          // 基準画像・商品写真 (Base64/URL)
  baseUnit: string;           // 基準単位 (例: 個, 本, 枚)
  currentStock: number;       // 現在庫数 (基準単位換算)
  safetyStock: number;        // 安全在庫数 (アラート閾値)
  location: string;           // 保管ボックス名 / 棚番 (例: 1号ボックス (A-01))
  qrCode?: string;            // 自社QRコード文字列 (例: INV:v1:4901480000011)
  unitConversions: UnitConversion[]; // 包装単位換算設定
  updatedAt: string;          // 最終更新日時 ISO
  note?: string;              // 備考・メモ
}

/**
 * 入荷承認待ちデータ (現場スキャン一時保存 -> PC管理者で正式承認)
 */
export interface PendingInbound {
  id: string;
  itemCode: string;
  itemName: string;
  spec?: string;
  category?: string;
  supplier?: string;
  imageUrl?: string;
  quantity: number;           // 現場入力数量
  unit: string;               // 現場入力単位
  multiplier: number;         // 換算倍率
  baseQuantity: number;       // 換算後基準数量
  location: string;           // ボックス名 / 保管場所
  operator: string;           // 現場作業担当者
  scannedAt: string;          // スキャン日時 ISO
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  note?: string;              // 現場メモ
}

export interface InventoryLog {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  type: ActionType;
  delta: number;              // 在庫変動量 (+50, -10)
  quantity: number;           // 入力数量
  unit: string;               // 入力単位
  multiplier: number;         // 換算倍率
  baseQuantity: number;       // 換算後基準数量
  operator: string;           // 作業担当者
  timestamp: string;          // 記録日時 ISO
  note?: string;              // 備考
  synced: boolean;            // クラウド同期状態
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
  requirePcApprovalForInbound: boolean; // PC正式承認フローの有効化
  geminiApiKey?: string;                 // Gemini AI 画像認識用 APIキー
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
