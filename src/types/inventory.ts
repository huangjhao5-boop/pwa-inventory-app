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

export interface LinkedBarcode {
  code: string;               // 紐付けバーコード / ITFコード / 箱コード / 別名JAN
  unit?: string;              // 紐づく包装単位 (例: 箱, 箱(大), 袋, パック, 個)
  multiplier?: number;        // 入数・換算倍率 (例: 100, 1000)
  label?: string;             // 用途ラベル (例: 外箱ITFコード, 仕入先発注コード, ケースコード)
}

/**
 * 保管ボックス設定（名前変更・アイコン・テーマカラー設定）
 */
export interface StorageBoxConfig {
  name: string;        // 保管箱名 (例: 端子ボックス (A-01))
  icon: string;        // 'zap' | 'link' | 'wrench' | 'shield' | 'server' | 'tag' | 'plug' | 'tool' | 'box'
  color: string;       // 'emerald' | 'amber' | 'blue' | 'rose' | 'purple' | 'cyan' | 'orange' | 'slate'
  description?: string;
}

export const DEFAULT_STORAGE_BOXES: StorageBoxConfig[] = [
  { name: '端子ボックス (A-01)', icon: 'zap', color: 'emerald', description: '圧着端子・スリーブ・絶縁キャップ' },
  { name: '結束バンドボックス (B-01)', icon: 'link', color: 'amber', description: 'インシュロック・タイマウント・固定具' },
  { name: 'ネジ・締結ボックス (B-02)', icon: 'wrench', color: 'cyan', description: 'M3〜M6ビス・ナット・ワッシャー' },
  { name: 'ヒューズボックス (C-01)', icon: 'shield', color: 'rose', description: '筒型・管ヒューズ・ブレーカー予備' },
  { name: 'マークチューブ棚 (C-02)', icon: 'tag', color: 'orange', description: '印字チューブ・ラベル・銘板シート' },
  { name: '盤材ラック (D-01)', icon: 'server', color: 'purple', description: 'DINレール・ダクト・端子台・リレー' },
  { name: 'コネクタ・プラグ箱 (E-01)', icon: 'plug', color: 'blue', description: '産業用コネクタ・モジュラープラグ' },
  { name: '予備品ボックス (E-02)', icon: 'box', color: 'slate', description: 'その他汎用資材・消耗品ストック' },
];

export interface ItemMaster {
  id: string;
  code: string;               // 品目コード / メインJAN / QRコード
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
  orderUrl?: string;          // 発注先Webリンク (モノタロウ、Amazon、ミスミ、電材商社EC等)
  unitConversions: UnitConversion[]; // 包装単位換算設定 (箱, 袋, パックなど複数)
  linkedBarcodes?: LinkedBarcode[];  // 紐付けバーコード設定 (外箱コード・仕入先コード・別名コード)
  aliasCodes?: string[];             // 互換用エイリアスコード一覧
  updatedAt: string;          // 最終更新日時 ISO
  note?: string;              // 備考・メモ
  isDiscontinued?: boolean;   // 廃番フラグ (以後入庫・追加発注なし。全量使用・在庫0でマスタから自動削除)
  discontinuedReason?: string;// 廃番理由 / 代替品型番メモ (例: 型番変更によりTX-15へ移行)
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
  type?: 'IN' | 'OUT';        // 入荷 (IN) または 出庫 (OUT)
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
  recentOperators?: string[];
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

export type ReturnCondition = 'UNOPENED' | 'NEAR_FULL' | 'THREE_QUARTERS' | 'HALF_USED' | 'ONE_QUARTER_OR_LITTLE' | 'EXACT_COUNT';

export interface ReturnFractionPreset {
  key: ReturnCondition;
  label: string;
  fraction: number; // 1.0, 0.9, 0.75, 0.5, 0.25
  description: string;
}

export const RETURN_FRACTION_PRESETS: ReturnFractionPreset[] = [
  { key: 'UNOPENED', label: '🟢 未開封 (1.00 / 100% 残量)', fraction: 1.0, description: '未開封のまま全量残' },
  { key: 'NEAR_FULL', label: '🟢 ほぼ満杯 (0.90 / 約9割 残量)', fraction: 0.9, description: '数本・数個だけ使用' },
  { key: 'THREE_QUARTERS', label: '🟡 約3/4残 (0.75 / 約75% 残量)', fraction: 0.75, description: '約1/4を使用' },
  { key: 'HALF_USED', label: '🟠 半分使用 (0.50 / 約50% 残量)', fraction: 0.5, description: '約半分を使用' },
  { key: 'ONE_QUARTER_OR_LITTLE', label: '🔴 剩餘少許 (0.25 / 約25% 残量)', fraction: 0.25, description: '約3/4を使用・残り少許' },
  { key: 'EXACT_COUNT', label: '🔢 端数実数を直接入力', fraction: 0, description: '正確な端数または実数' },
];

/**
 * 現場持出・未返却管理データ（複数包・開封端数の正確な計算対応）
 */
export interface CheckedOutItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  spec?: string;
  supplier?: string;
  imageUrl?: string;
  location: string;             // 本来の保管場所 (戻し先)
  outQuantity: number;          // 持出・払出入力数量 (例: 3)
  outUnit: string;              // 持出単位 (例: 袋, 箱, パック, 本)
  multiplier: number;           // 換算倍率 (例: 1袋 = 100本)
  outBaseQuantity: number;      // 持出基準数量 (例: 300本)
  operator: string;             // 持出作業員 (例: M.K(TW), 田中)
  destination?: string;         // 現場名・工事番号・用途 (例: A棟制御盤配線, 現場持出)
  checkedOutAt: string;         // 持出日時 ISO
  status: 'CHECKED_OUT' | 'RETURNED' | 'CONSUMED'; // 持出中 / 返却済 / 全消費完了

  // 返却・棚戻し詳細
  returnedAt?: string;          // 返却日時 ISO
  unopenedReturnedCount?: number; // 未開封で返却した包数 (例: 1)
  openedReturnedCount?: number;   // 開封品として返却した包数 (例: 1)
  openedRemainingFraction?: number; // 開封品の残量係数 (例: 0.25)
  consumedCount?: number;         // 現場で全消費した包数 (例: 1)
  returnedPackEquivalent?: number;// 返却合計換算包数 (例: 1 + 0.25 = 1.25 包)
  returnedBaseQuantity?: number;  // 実際に返却された基準数量 (例: 125本)
  returnCondition?: ReturnCondition;
  isPackageOpened?: boolean;    // 開封済みフラグ
  returnNote?: string;          // 返却時メモ
}

export type LabelLayout = 'A-ONE-24' | 'A-ONE-44' | 'SINGLE-THERMAL';

export type TabKey = 'SCAN' | 'BATCH' | 'APPROVAL' | 'ITEMS' | 'CHECKOUT' | 'AI_STUDIO' | 'LOGS' | 'PRINT' | 'SETTINGS';
