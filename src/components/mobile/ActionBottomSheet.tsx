import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ActionType, ItemMaster, PRESET_UNITS, UnitConversion } from '../../types/inventory';
import { NumericKeypad } from './NumericKeypad';
import { StockInquiryCard } from './StockInquiryCard';
import { AiVisionService } from '../../utils/geminiAiVision';
import { VisualKnowledgeService } from '../../utils/visualKnowledgeService';
import { ImageCompressor } from '../../utils/imageCompressor';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  ShoppingCart,
  X,
  ChevronLeft,
  Camera,
  Zap,
  Sparkles,
  Loader2,
  Box,
  Building2,
  Tag,
  CheckCircle2,
  Image as ImageIcon,
  Plus,
  Trash2,
} from 'lucide-react';

// ─── 電工向けプリセット（日本語） ───────────────────
const PRESET_SUPPLIERS = [
  'ニチフ (NICHIFU)',
  'パンドウイット (Panduit)',
  'フエニックス・コンタクト',
  'WAGO (ワゴ)',
  'オムロン (OMRON)',
  'IDEC (和泉電気)',
  '富士電機',
  '横河電機',
  '三菱電機',
  '日東電工 (Nitto)',
  'SMC',
  'ミスミ (MISUMI)',
];

const PRESET_NAMES = [
  // 端子類
  '丸形圧着端子 (R型)',
  'Y形圧着端子 (先開形)',
  '棒形圧着端子 (TC型)',
  'フェルール端子 (AI型)',
  '絶縁被覆付圧着スリーブ',
  // 配線資材
  '耐候性結束バンド (黒)',
  'コルゲートチューブ (難燃)',
  'スパイラルチューブ',
  '配線固定具 (タイマウント)',
  // 盤材・パーツ
  'ガラス管ヒューズ (速断)',
  'DINレール (35mm)',
  '中継端子台 (ネジ式)',
  'ワンタッチ管継手 (SMC同等)',
  // ネジ締結
  '六角穴付ボルト (SUS)',
  '六角ナット (SUS)',
  '平ワッシャー (SUS)',
];

const PRESET_BOXES = [
  '端子ボックス (A-01)',
  '端子ボックス (A-02)',
  '結束バンドボックス (B-01)',
  'ネジ・締結ボックス (B-02)',
  'ヒューズボックス (C-01)',
  '盤材ラック (D-01)',
  '予備品ボックス (E-01)',
];

export const ActionBottomSheet: React.FC = () => {
  const {
    isBottomSheetOpen,
    closeBottomSheet,
    activeScannedItem,
    activeScannedCode,
    recordTransaction,
    settings,
    saveItem,
    addToast,
    items,
  } = useInventory();

  // 'MENU' | 'KEYPAD' | 'INQUIRY' | 'NEW_ITEM' | 'NEW_ITEM_INBOUND'
  const [currentStep, setCurrentStep] = useState<'MENU' | 'KEYPAD' | 'INQUIRY' | 'NEW_ITEM' | 'NEW_ITEM_INBOUND'>('MENU');
  const [selectedAction, setSelectedAction] = useState<ActionType>('IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<string>('個');
  const [note, setNote] = useState<string>('');

  // New Item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemSpec, setNewItemSpec] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('配線・電気資材');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('個');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState(10);
  const [newItemBoxName, setNewItemBoxName] = useState('端子ボックス (A-01)');
  const [itemImage, setItemImage] = useState<string | null>(null);

  // Multi-level unit conversions (箱, 箱(小), 袋, パック, 個)
  const [newItemConversions, setNewItemConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 1000 },
    { unit: '袋', multiplier: 100 },
    { unit: 'パック', multiplier: 10 },
  ]);

  // 初回登録時の入庫数量
  const [initialInboundQty, setInitialInboundQty] = useState(1);

  // AI & Vision & Learning state
  const [isVisionProcessing, setIsVisionProcessing] = useState(false);
  const [visionBadgeMessage, setVisionBadgeMessage] = useState<string | null>(null);
  const [visionSource, setVisionSource] = useState<'LEARNED_MEMORY' | 'GEMINI_AI' | 'IMAGE_MATCH' | 'LOCAL_OCR' | null>(null);
  const [rawOcrText, setRawOcrText] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const updatePhotoRef = useRef<HTMLInputElement>(null);

  const handleUpdateExistingPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeScannedItem) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      const compressed = await ImageCompressor.compressImage(rawBase64, 360, 360, 0.65);
      const updated: ItemMaster = {
        ...activeScannedItem,
        imageUrl: compressed,
        updatedAt: new Date().toISOString(),
      };
      await saveItem(updated);
      VisualKnowledgeService.learnFromItem(updated, compressed);
      addToast('success', '📸 商品写真を更新・学習しました！');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isBottomSheetOpen) {
      if (activeScannedItem) {
        setCurrentStep('MENU');
        setSelectedUnit(activeScannedItem.baseUnit || '個');
        setQuantity(1);
        setNote('');
      } else {
        setCurrentStep('NEW_ITEM');
        const cleanCode = activeScannedCode || '';
        const shortCode = cleanCode.length > 8 ? cleanCode.slice(-6) : cleanCode;
        setNewItemName(`新商品-${shortCode}`);
        setNewItemSpec('');
        setNewItemSupplier('');
        setNewItemCategory('配線・電気資材');
        setNewItemBaseUnit('個');
        setNewItemBoxName('端子ボックス (A-01)');
        setItemImage(null);
        setVisionBadgeMessage(null);
        setVisionSource(null);
        setRawOcrText('');
        setInitialInboundQty(1);
        setNewItemConversions([
          { unit: '箱', multiplier: 1000 },
          { unit: '袋', multiplier: 100 },
          { unit: 'パック', multiplier: 10 },
        ]);
      }
    }
  }, [isBottomSheetOpen, activeScannedItem, activeScannedCode]);

  if (!isBottomSheetOpen) return null;

  const handleSelectAction = (action: ActionType) => {
    setSelectedAction(action);
    if (action === 'AUDIT') {
      setCurrentStep('INQUIRY');
    } else if (action === 'ORDER') {
      if (activeScannedItem) {
        const diff = Math.max(1, activeScannedItem.safetyStock - activeScannedItem.currentStock);
        setQuantity(diff);
      }
      setCurrentStep('KEYPAD');
    } else {
      setQuantity(1);
      setCurrentStep('KEYPAD');
    }
  };

  const handleConfirmTransaction = async () => {
    if (!activeScannedItem) return;
    const conv = activeScannedItem.unitConversions?.find((u) => u.unit === selectedUnit) || {
      unit: activeScannedItem.baseUnit,
      multiplier: 1,
    };
    await recordTransaction(activeScannedItem, selectedAction, quantity, selectedUnit, conv.multiplier, note);
  };

  // AI 視覚認識 & 自己学習ナレッジ照合
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      setIsVisionProcessing(true);
      setVisionBadgeMessage(null);

      // 高画質カメラ写真をFirestore・IDB安全な軽量サイズ（約25KB）に高速圧縮
      const base64 = await ImageCompressor.compressImage(rawBase64, 360, 360, 0.65);
      setItemImage(base64);

      try {
        const result = await AiVisionService.smartRecognize(
          base64,
          items,
          settings.geminiApiKey
        );
        setIsVisionProcessing(false);
        setVisionSource(result.source);
        if (result.rawAnalysis) setRawOcrText(result.rawAnalysis);

        const detectedParts: string[] = [];
        if (result.suggestedName) {
          setNewItemName(result.suggestedName);
          detectedParts.push(`品名: ${result.suggestedName}`);
        }
        if (result.suggestedSpec) {
          setNewItemSpec(result.suggestedSpec);
          detectedParts.push(`型番: ${result.suggestedSpec}`);
        }
        if (result.suggestedSupplier) {
          setNewItemSupplier(result.suggestedSupplier);
          detectedParts.push(`メーカー: ${result.suggestedSupplier}`);
        }
        if (result.suggestedCategory) {
          setNewItemCategory(result.suggestedCategory);
        }
        if (result.suggestedBoxName) {
          setNewItemBoxName(result.suggestedBoxName);
          detectedParts.push(`ボックス: ${result.suggestedBoxName}`);
        }
        if (result.suggestedBaseUnit) {
          setNewItemBaseUnit(result.suggestedBaseUnit);
        }
        if (result.suggestedQuantity && result.suggestedQuantity > 0) {
          setInitialInboundQty(result.suggestedQuantity);
          detectedParts.push(`推定量: ${result.suggestedQuantity}`);
        }

        if (result.source === 'LEARNED_MEMORY') {
          setVisionBadgeMessage(`🧠 過去の学習データから自動予測 (${result.confidenceScore}% 一致): ${detectedParts.join(' | ')}`);
          addToast('success', '過去の学習履歴から品名・型番を復元しました！');
        } else if (result.source === 'IMAGE_MATCH') {
          setVisionBadgeMessage(`🎯 登録済みの基準写真と一致しました: ${result.suggestedName}`);
          addToast('success', '登録済みの基準写真と一致しました！');
        } else if (result.source === 'GEMINI_AI') {
          setVisionBadgeMessage(`✨ Gemini AI 高精度解析: ${detectedParts.join(' | ')}`);
          addToast('success', 'Gemini AI が品名・型番を認識しました！');
        } else {
          setVisionBadgeMessage(detectedParts.length > 0 ? `📷 OCR自動読取: ${detectedParts.join(' | ')}` : '写真を設定しました。品名を選択または直接入力してください');
          addToast('info', '写真から文字情報を抽出しました');
        }
      } catch {
        setIsVisionProcessing(false);
        setVisionBadgeMessage('画像解析を完了しました。必要に応じて修正してください');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddConversion = () => {
    setNewItemConversions([...newItemConversions, { unit: '袋', multiplier: 50 }]);
  };

  const handleRemoveConversion = (idx: number) => {
    setNewItemConversions(newItemConversions.filter((_, i) => i !== idx));
  };

  const handleUpdateConversion = (idx: number, field: 'unit' | 'multiplier', val: any) => {
    const next = [...newItemConversions];
    if (field === 'unit') next[idx].unit = String(val);
    else next[idx].multiplier = Math.max(1, Number(val) || 1);
    setNewItemConversions(next);
  };

  // 商品を登録し、そのまま【入庫数量入力】へ進む (学習ナレッジにフィードバック蓄積)
  const handleSaveAndGoToInbound = async () => {
    if (!activeScannedCode) return;
    const nameToUse = newItemName.trim() || `新商品-${activeScannedCode.slice(-6)}`;
    const allConversions: UnitConversion[] = [
      ...newItemConversions.filter((c) => c.unit !== newItemBaseUnit),
      { unit: newItemBaseUnit, multiplier: 1 },
    ];

    const newItem: ItemMaster = {
      id: `item-${activeScannedCode}`,
      code: activeScannedCode,
      name: nameToUse,
      spec: newItemSpec.trim(),
      category: newItemCategory,
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: itemImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: 0,
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '端子ボックス (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
    };

    // 自己学習ナレッジバンクに登録（次回以降の認識精度が向上）
    if (itemImage) {
      VisualKnowledgeService.learnFromItem(newItem, itemImage, rawOcrText);
    }

    await saveItem(newItem);
    setSelectedAction('IN');
    setSelectedUnit(newItemBaseUnit);
    setQuantity(initialInboundQty);
    setCurrentStep('NEW_ITEM_INBOUND');
  };

  // 登録のみ（入庫は後で）
  const handleSaveOnly = async () => {
    if (!activeScannedCode) return;
    const nameToUse = newItemName.trim() || `新商品-${activeScannedCode.slice(-6)}`;
    const allConversions: UnitConversion[] = [
      ...newItemConversions.filter((c) => c.unit !== newItemBaseUnit),
      { unit: newItemBaseUnit, multiplier: 1 },
    ];

    const newItem: ItemMaster = {
      id: `item-${activeScannedCode}`,
      code: activeScannedCode,
      name: nameToUse,
      spec: newItemSpec.trim(),
      category: newItemCategory,
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: itemImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: 0,
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '端子ボックス (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
    };

    if (itemImage) {
      VisualKnowledgeService.learnFromItem(newItem, itemImage, rawOcrText);
    }

    await saveItem(newItem);
    closeBottomSheet();
  };

  // 新規登録品の入庫確定
  const handleConfirmNewItemInbound = async () => {
    if (!activeScannedCode) return;
    const allConversions: UnitConversion[] = [
      ...newItemConversions.filter((c) => c.unit !== newItemBaseUnit),
      { unit: newItemBaseUnit, multiplier: 1 },
    ];

    const item: ItemMaster = {
      id: `item-${activeScannedCode}`,
      code: activeScannedCode,
      name: newItemName.trim() || `新商品-${activeScannedCode.slice(-6)}`,
      spec: newItemSpec.trim(),
      category: newItemCategory,
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: itemImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: quantity,
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '端子ボックス (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
    };
    await saveItem(item);
    await recordTransaction(item, 'IN', quantity, selectedUnit, 1, '新規登録初回入荷', false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2">
            {(currentStep === 'KEYPAD' || currentStep === 'INQUIRY') && activeScannedItem && (
              <button onClick={() => setCurrentStep('MENU')} className="p-1.5 -ml-2 text-slate-400 hover:text-white rounded-lg transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {currentStep === 'NEW_ITEM_INBOUND' && (
              <button onClick={() => setCurrentStep('NEW_ITEM')} className="p-1.5 -ml-2 text-slate-400 hover:text-white rounded-lg transition">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white truncate max-w-[240px]">
                {activeScannedItem ? activeScannedItem.name :
                  currentStep === 'NEW_ITEM_INBOUND' ? '初回入荷数量の入力' : '新規品目登録 & 入荷'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                コード: {activeScannedItem ? activeScannedItem.code : activeScannedCode}
              </p>
            </div>
          </div>
          <button onClick={closeBottomSheet} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">

          {/* ── STEP 1: メインメニュー ── */}
          {currentStep === 'MENU' && activeScannedItem && (
            <div className="space-y-3">
              {/* 在庫状況 & 写真更新カード */}
              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3 shadow-inner">
                <input
                  type="file"
                  ref={updatePhotoRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleUpdateExistingPhoto}
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <div className="relative group cursor-pointer" onClick={() => updatePhotoRef.current?.click()}>
                    {activeScannedItem.imageUrl ? (
                      <img
                        src={activeScannedItem.imageUrl}
                        alt="基準写真"
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-700 shrink-0 bg-black shadow-md hover:opacity-80 transition"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:text-white transition">
                        <Camera className="w-5 h-5 text-emerald-400" />
                        <span className="text-[9px] mt-0.5 font-bold">写真登録</span>
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 p-1 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow border border-slate-900">
                      <Camera className="w-3 h-3" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 font-semibold block">現在庫数</span>
                    <div className="text-2xl font-black text-emerald-400">
                      {activeScannedItem.currentStock}{' '}
                      <span className="text-xs text-slate-300 font-bold">{activeScannedItem.baseUnit}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-semibold block">保管ボックス / メーカー</span>
                  <div className="text-sm font-bold text-blue-400">
                    {activeScannedItem.location || '未指定'}
                    {activeScannedItem.supplier && (
                      <span className="text-xs text-slate-300 font-normal"> ({activeScannedItem.supplier})</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePhotoRef.current?.click()}
                    className="mt-1 text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 ml-auto"
                  >
                    <Camera className="w-3 h-3 text-emerald-400" />
                    <span>写真を変更・再撮影</span>
                  </button>
                </div>
              </div>

              {/* 入荷 / 出庫 ボタン */}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => handleSelectAction('IN')}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1.5 transition">
                  <ArrowDownCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【 入 荷 】</span>
                  <span className="text-[11px] opacity-90 font-medium">
                    {settings.requirePcApprovalForInbound ? '承認待ち一時保存' : '直接在庫加算'}
                  </span>
                </button>
                <button type="button" onClick={() => handleSelectAction('OUT')}
                  className="p-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1.5 transition">
                  <ArrowUpCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【 出 庫 】</span>
                  <span className="text-[11px] opacity-90 font-medium">使用・払出登録</span>
                </button>
              </div>

              {/* サブアクション */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setCurrentStep('INQUIRY')}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition">
                  <Search className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-sm">在庫詳細・仕様</span>
                </button>
                <button type="button" onClick={() => handleSelectAction('ORDER')}
                  className="p-3 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 border border-amber-500/40 rounded-2xl flex items-center justify-center gap-2 transition">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-sm">発注・購入申請</span>
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: テンキー & 目測概算入力 ── */}
          {currentStep === 'KEYPAD' && activeScannedItem && (
            <div className="space-y-3">
              <div className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between ${
                selectedAction === 'IN'
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                  : selectedAction === 'OUT'
                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                  : 'bg-amber-950/80 text-amber-300 border border-amber-800'
              }`}>
                <span>
                  {selectedAction === 'IN'
                    ? settings.requirePcApprovalForInbound ? '【現場入荷（PC承認待ち）】' : '【現場直接入荷】'
                    : selectedAction === 'OUT' ? '【出庫作業】' : '【発注申請】'}
                </span>
                <span className="opacity-90">現在庫: {activeScannedItem.currentStock} {activeScannedItem.baseUnit}</span>
              </div>
              <NumericKeypad
                value={quantity}
                onChange={setQuantity}
                units={activeScannedItem.unitConversions?.length > 0
                  ? activeScannedItem.unitConversions
                  : [{ unit: activeScannedItem.baseUnit, multiplier: 1 }]}
                baseUnit={activeScannedItem.baseUnit}
                selectedUnit={selectedUnit}
                onSelectUnit={setSelectedUnit}
                onConfirm={handleConfirmTransaction}
                soundEnabled={settings.soundEnabled}
                confirmLabel={
                  selectedAction === 'IN'
                    ? settings.requirePcApprovalForInbound
                      ? `承認待ち送信 (+${quantity} ${selectedUnit})`
                      : `入荷確定 (+${quantity} ${selectedUnit})`
                    : selectedAction === 'OUT'
                    ? `出庫確定 (-${quantity} ${selectedUnit})`
                    : `発注登録 (${quantity} ${selectedUnit})`
                }
                confirmColor={
                  selectedAction === 'IN'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : selectedAction === 'OUT'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }
              />
            </div>
          )}

          {/* ── STEP 3: 在庫照会 ── */}
          {currentStep === 'INQUIRY' && activeScannedItem && (
            <div>
              <StockInquiryCard item={activeScannedItem} />
            </div>
          )}

          {/* ── STEP 4: 新規品目登録（AI視覚認識 & 自己学習フィードバック） ── */}
          {currentStep === 'NEW_ITEM' && (
            <div className="space-y-4">
              {/* AI 視覚認識 & 写真撮影カード */}
              <div className="bg-gradient-to-r from-blue-950/90 to-indigo-950/90 p-4 rounded-3xl border border-blue-500/50 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="font-extrabold text-sm text-white">AI視覚認識 & 自己学習</span>
                  </div>
                  <span className="text-xs font-mono text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-700/50">
                    {activeScannedCode}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  写真を撮影すると、AIと過去の学習履歴から品名・型番・メーカーを自動認識します。修正して保存すると次回以降の精度がさらに向上します。
                </p>

                <input type="file" ref={fileInputRef} accept="image/*" capture="environment"
                  onChange={handlePhotoCapture} className="hidden" />

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button type="button" disabled={isVisionProcessing} onClick={() => fileInputRef.current?.click()}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-100 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1 transition shadow">
                    {isVisionProcessing ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="font-extrabold text-xs">
                      {isVisionProcessing ? 'AI解析中...' : itemImage ? '写真を撮り直す' : '📸 写真撮影・AI認識'}
                    </span>
                  </button>

                  <button type="button" onClick={handleSaveAndGoToInbound}
                    className="py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-950 transition flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>登録して入荷数入力</span>
                  </button>
                </div>

                {visionBadgeMessage && (
                  <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
                    visionSource === 'LEARNED_MEMORY'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                      : visionSource === 'IMAGE_MATCH'
                      ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                      : visionSource === 'GEMINI_AI'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                      : 'bg-blue-950/80 border-blue-500 text-blue-200'
                  }`}>
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="break-all">{visionBadgeMessage}</span>
                  </div>
                )}

                {itemImage && (
                  <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-slate-700 bg-black">
                    <img src={itemImage} alt="撮影画像" className="w-full h-full object-cover" />
                    <div className="absolute bottom-1.5 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-emerald-400" />
                      <span>基準画像として学習・保存</span>
                    </div>
                    <button type="button" onClick={() => { setItemImage(null); setVisionBadgeMessage(null); }}
                      className="absolute top-1.5 right-1.5 p-1.5 bg-black/80 hover:bg-black text-white rounded-full">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* ワンタップ常用プリセット */}
              <div className="bg-slate-950/80 p-3.5 rounded-3xl border border-slate-800 space-y-2.5 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span>ワンタップ品名選択：</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_NAMES.map((pName) => (
                    <button key={pName} type="button" onClick={() => setNewItemName(pName)}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition ${
                        newItemName === pName
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}>
                      {pName}
                    </button>
                  ))}
                </div>

                <span className="font-bold text-slate-300 flex items-center gap-1 pt-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>ワンタップメーカー選択：</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SUPPLIERS.map((sup) => (
                    <button key={sup} type="button" onClick={() => setNewItemSupplier(sup.split(' ')[0])}
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition ${
                        newItemSupplier === sup.split(' ')[0]
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}>
                      {sup}
                    </button>
                  ))}
                </div>

                <span className="font-bold text-slate-300 flex items-center gap-1 pt-1">
                  <Box className="w-3.5 h-3.5 text-blue-400" />
                  <span>保管ボックス選択：</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_BOXES.map((bName) => (
                    <button key={bName} type="button" onClick={() => setNewItemBoxName(bName)}
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition ${
                        newItemBoxName === bName
                          ? 'bg-teal-600 text-white border-teal-400'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}>
                      {bName}
                    </button>
                  ))}
                </div>
              </div>

              {/* 手動入力フォーム */}
              <div className="bg-slate-950/70 p-4 rounded-3xl border border-slate-800 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">品名</label>
                  <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="例: 丸形圧着端子 R2-4"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">メーカー / 仕入先</label>
                    <input type="text" value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)}
                      placeholder="例: ニチフ (NICHIFU)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">規格 / 型番</label>
                    <input type="text" value={newItemSpec} onChange={(e) => setNewItemSpec(e.target.value)}
                      placeholder="例: R2-4 (0.5~2.0sq)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">基準単位</label>
                    <select value={newItemBaseUnit} onChange={(e) => setNewItemBaseUnit(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold">
                      {PRESET_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Box className="w-3 h-3 text-blue-400" />ボックス名
                    </label>
                    <input type="text" value={newItemBoxName} onChange={(e) => setNewItemBoxName(e.target.value)}
                      placeholder="端子ボックス (A-01)"
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">安全在庫数</label>
                    <input type="number" min="0" value={newItemSafetyStock}
                      onChange={(e) => setNewItemSafetyStock(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs" />
                  </div>
                </div>

                {/* 包装単位・換算倍率リスト (箱、袋、パック、束、巻等) */}
                <div className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 text-xs">包装単位換算 (箱 / パック / 小箱 / 袋 / 束 / 巻)</span>
                    <button type="button" onClick={handleAddConversion} className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center gap-1 bg-blue-900/30 px-2 py-1 rounded-lg border border-blue-700/50">
                      <Plus className="w-3.5 h-3.5" /> 単位を追加
                    </button>
                  </div>
                  {newItemConversions.map((conv, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-xs font-bold">1</span>
                      <select
                        value={PRESET_UNITS.includes(conv.unit as any) ? conv.unit : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            handleUpdateConversion(idx, 'unit', e.target.value);
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs"
                      >
                        {PRESET_UNITS.filter((u) => u !== newItemBaseUnit).map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={conv.unit}
                        onChange={(e) => handleUpdateConversion(idx, 'unit', e.target.value)}
                        placeholder="単位名"
                        className="w-16 px-1.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs text-center"
                      />
                      <span className="text-slate-400 text-xs font-bold">=</span>
                      <input
                        type="number"
                        min="1"
                        value={conv.multiplier}
                        onChange={(e) => handleUpdateConversion(idx, 'multiplier', e.target.value)}
                        className="w-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-black text-xs text-center text-emerald-400"
                      />
                      <span className="text-slate-300 font-bold text-xs">{newItemBaseUnit}</span>
                      <button type="button" onClick={() => handleRemoveConversion(idx)} className="p-1 text-slate-500 hover:text-rose-400 ml-auto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button type="button" onClick={handleSaveAndGoToInbound}
                    className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    登録して入荷数を入力
                  </button>
                  <button type="button" onClick={handleSaveOnly}
                    className="py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4 text-amber-400" />
                    マスタ登録のみ行う
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 5: 初回入荷数量の確認 ── */}
          {currentStep === 'NEW_ITEM_INBOUND' && (
            <div className="space-y-3">
              <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-2xl p-3.5 text-xs">
                <p className="font-bold text-emerald-300 mb-1">✅ 品目マスタを登録・学習しました！</p>
                <p className="text-slate-300">
                  品名：<strong className="text-white">{newItemName}</strong>
                  {newItemSupplier && ` | メーカー：${newItemSupplier}`}
                </p>
                <p className="text-slate-300 mt-0.5">
                  保管場所：<strong className="text-blue-300">{newItemBoxName}</strong>
                  {' | '}単位：<strong className="text-white">{newItemBaseUnit}</strong>
                </p>
                <p className="text-amber-300 mt-1 font-semibold">
                  {settings.requirePcApprovalForInbound
                    ? '入荷データは「承認待ち」として一時保存され、PC側で正式反映されます。'
                    : '確定すると直ちに在庫数に加算されます。'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-2 text-sm">初回入荷数量</label>
                <div className="flex items-center gap-3 bg-slate-950 rounded-2xl border border-slate-800 p-3">
                  <button type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-black flex items-center justify-center active:scale-95 transition">
                    −
                  </button>
                  <input type="number" min="1" value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center text-3xl font-black text-white bg-transparent focus:outline-none" />
                  <button type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-2xl font-black flex items-center justify-center active:scale-95 transition">
                    ＋
                  </button>
                </div>
                <div className="mt-2 flex gap-2 justify-center">
                  {[1, 5, 10, 20, 50, 100].map((n) => (
                    <button key={n} type="button" onClick={() => setQuantity(n)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        quantity === n
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <button type="button" onClick={handleConfirmNewItemInbound}
                className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold text-base rounded-2xl shadow-xl shadow-emerald-950/60 transition flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6" />
                <span>
                  {settings.requirePcApprovalForInbound
                    ? `承認待ち送信 (+${quantity} ${newItemBaseUnit})`
                    : `入荷確定 (+${quantity} ${newItemBaseUnit})`}
                </span>
              </button>

              <button type="button" onClick={closeBottomSheet}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-semibold text-sm rounded-xl transition">
                入荷をスキップしてスキャンへ戻る
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
