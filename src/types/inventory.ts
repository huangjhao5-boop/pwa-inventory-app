export type ActionType = 'IN' | 'OUT' | 'AUDIT' | 'ORDER';

export type SystemViewMode = 'FIELD' | 'PC_ADMIN';

export const PRESET_UNITS = [
  '個',
  '本',
  '枚',
  '箱',
  '箱(大)',
  '箱(小)',
  '袋',
  'パック',
  '束',
  '巻',
  '組',
  '式',
  'kg',
  'm',
  'L'
] as const;

export interface UnitConversion {
  unit: string;        // 包装単位 (例: 箱, 箱(小), 袋, パック, 巻, 束)
  multiplier: number;  // 換算基準数量 (例: 1袋 = 100本, 1箱 = 1000本, 1小箱 = 50個)
}

/**
 * 消耗品・小物品用 目測割合・残量換算 (結束バンド、端子、ネジなど)
 */
export interface FractionalRatio {
  label: string;      // 表示名 (例: "満杯 (100%)", "約7〜8割 (3/4)", "半分程度 (1/2)", "残り約1/3", "残り約1/4", "残り僅か (10%)")
  ratio: number;      // 係数 (1.0, 0.75, 0.5, 0.33, 0.25, 0.1)
  description?: string;
}

export const PRESET_FRACTIONS: FractionalRatio[] = [
  { label: '満杯 (100%)', ratio: 1.0, description: '新品・全量' },
  { label: '約3/4 (75%)', ratio: 0.75, description: '使用歴あり・約7〜8割残' },
  { label: '半分 (50%)', ratio: 0.5, description: '約半分使用' },
  { label: '約1/3 (33%)', ratio: 0.33, description: '残り約3割' },
  { label: '約1/4 (25%)', ratio: 0.25, description: '残り約2〜3割' },
  { label: '僅か (10%)', ratio: 0.1, description: '残り少・要補充' },
];

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
  unitConversions: UnitConversion[]; // 包装単位換算設定 (箱, 袋, パックなど複数)
  updatedAt: string;          // 最終更新日時 ISO
  note?: string;              // 備考・メモ
}

/**
 * 視覚学習ナレッジエントリ (撮影・手動修正のフィードバックから自己学習)
 */
export interface VisualKnowledgeEntry {
  id: string;
  itemCode: string;
  name: string;
  spec?: string;
  supplier?: string;
  category?: string;
  baseUnit?: string;
  boxName?: string;
  colorHash: string;          // 視覚的カラーハッシュ
  featureTokens: string[];    // テキスト・形状特徴トークン
  imageThumbnail: string;     // サムネイル
  matchCount: number;         // 正解回数 (学習強度)
  lastLearnedAt: number;      // 最終学習日時
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
