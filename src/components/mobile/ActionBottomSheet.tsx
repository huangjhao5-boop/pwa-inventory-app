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
  Check,
  Image as ImageIcon,
  Plus,
  Trash2,
  Link2,
} from 'lucide-react';

// ─── 電工向けプリセット（日本語） ───────────────────
const PRESET_SUPPLIERS = [
  'ヘラマンタイトン',
  'ニチフ',
  'TOHO',
  '日東電工',
  'パナソニック',
  'パンドウイット',
  '未来工業',
  'ネグロス電工',
  '三菱電機',
  '富士電機',
  'オムロン',
  'WAGO',
  'フエニックス・コンタクト',
  'ミスミ',
  'SMC',
  'キーエンス',
];

const PRESET_NAMES = [
  // 結束バンド・配線資材
  'インシュロック 屋内用',
  'インシュロック 耐候性',
  'マークチューブ',
  'コルゲートチューブ (難燃)',
  'スパイラルチューブ',
  'ビニル絶縁テープ',
  // 端子類
  '丸形圧着端子 (R型)',
  'Y形圧着端子 (先開形)',
  '棒形圧着端子 (TC型)',
  'フェルール端子 (AI型)',
  '絶縁被覆付圧着スリーブ',
  // 盤材・パーツ
  'ガラス管ヒューズ (速断)',
  'DINレール (35mm)',
  '中継端子台 (ネジ式)',
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
    activeMatchedBarcode,
    linkBarcodeToItem,
    recordTransaction,
    settings,
    saveItem,
    addToast,
    items,
    pendingInbounds,
  } = useInventory();

  const [currentStep, setCurrentStep] = useState<'MENU' | 'KEYPAD' | 'INQUIRY' | 'NEW_ITEM' | 'NEW_ITEM_INBOUND'>('MENU');
  const [selectedAction, setSelectedAction] = useState<ActionType>('IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<string>('個');
  const [note, setNote] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Unregistered Barcode Mode (新規登録 or 既存品目への紐付け)
  const [unregisteredMode, setUnregisteredMode] = useState<'CREATE_NEW' | 'LINK_EXISTING'>('CREATE_NEW');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkTargetItem, setLinkTargetItem] = useState<ItemMaster | null>(null);
  const [linkUnit, setLinkUnit] = useState('箱');
  const [linkMultiplier, setLinkMultiplier] = useState(100);
  const [linkLabel, setLinkLabel] = useState('外箱コード');

  // New Item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemSpec, setNewItemSpec] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('配線・電気資材');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('個');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState(10);
  const [newItemBoxName, setNewItemBoxName] = useState('端子ボックス (A-01)');
  const [newItemNote, setNewItemNote] = useState('');
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

  const filteredExistingItemsForLink = items.filter((item) => {
    if (!linkSearchQuery.trim()) return true;
    const q = linkSearchQuery.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      (item.spec && item.spec.toLowerCase().includes(q)) ||
      (item.supplier && item.supplier.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q))
    );
  });

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
        const defaultUnit = activeMatchedBarcode?.unit || activeScannedItem.baseUnit || '個';
        setSelectedUnit(defaultUnit);
        setQuantity(1);
        setNote(activeMatchedBarcode?.label ? `[${activeMatchedBarcode.label}]` : '');
      } else {
        setCurrentStep('NEW_ITEM');
        setUnregisteredMode('CREATE_NEW');
        setLinkSearchQuery('');
        setLinkTargetItem(null);
        setLinkUnit('箱');
        setLinkMultiplier(100);
        setLinkLabel('外箱コード');
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
        setNewItemNote('');
        setNewItemConversions([
          { unit: '箱', multiplier: 1000 },
          { unit: '袋', multiplier: 100 },
          { unit: 'パック', multiplier: 10 },
        ]);
      }
    }
  }, [isBottomSheetOpen, activeScannedItem, activeScannedCode, activeMatchedBarcode]);

  const handleConfirmLinkToExisting = async () => {
    if (!linkTargetItem || !activeScannedCode) return;
    const ok = await linkBarcodeToItem(linkTargetItem.id, {
      code: activeScannedCode,
      unit: linkUnit,
      multiplier: linkMultiplier,
      label: linkLabel.trim() || undefined,
    });
    if (ok) {
      closeBottomSheet();
    }
  };

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
    const baseQty = quantity * conv.multiplier;

    // 承認待ちの出庫引当数を差し引いた実質有効在庫を計算
    const pendingOutBaseQty = pendingInbounds
      .filter((p) => p.status === 'PENDING' && p.type === 'OUT' && p.itemCode === activeScannedItem.code)
      .reduce((sum, p) => sum + p.baseQuantity, 0);

    const effectiveStock = Math.max(0, activeScannedItem.currentStock - pendingOutBaseQty);

    if (selectedAction === 'OUT') {
      if (effectiveStock <= 0) {
        addToast(
          'error',
          `⚠️ 有効在庫不足: 現在庫 ${activeScannedItem.currentStock} ${activeScannedItem.baseUnit} 中、${pendingOutBaseQty} ${activeScannedItem.baseUnit} が出庫承認待ち（引当済）のため出庫できません！`
        );
        return;
      }
      if (baseQty > effectiveStock) {
        addToast(
          'error',
          `⚠️ 出庫数超過: 出庫数量 (${baseQty} ${activeScannedItem.baseUnit}) が利用可能な有効在庫 (${effectiveStock} ${activeScannedItem.baseUnit}) を超過しています！ (現在庫: ${activeScannedItem.currentStock}, 引当待: ${pendingOutBaseQty})`
        );
        return;
      }
      setIsConfirmModalOpen(true);
      return;
    }

    await recordTransaction(activeScannedItem, selectedAction, quantity, selectedUnit, conv.multiplier, note);
  };

  const handleExecuteOut = async () => {
    if (!activeScannedItem) return;
    const conv = activeScannedItem.unitConversions?.find((u) => u.unit === selectedUnit) || {
      unit: activeScannedItem.baseUnit,
      multiplier: 1,
    };
    setIsConfirmModalOpen(false);
    await recordTransaction(activeScannedItem, 'OUT', quantity, selectedUnit, conv.multiplier, note);
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
    if (field === 'unit') {
      next[idx].unit = String(val);
    } else {
      const valStr = String(val);
      next[idx].multiplier = valStr === '' ? ('' as any) : Math.max(0, parseInt(valStr) || 0);
    }
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
      note: newItemNote.trim() || undefined,
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
      note: newItemNote.trim() || undefined,
    };

    if (itemImage) {
      VisualKnowledgeService.learnFromItem(newItem, itemImage, rawOcrText);
    }

    await saveItem(newItem);
    closeBottomSheet();
  };

  // 新規登録品の入庫確定（二重加算を完全防止し、正確に入荷数量のみを加算）
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
      currentStock: 0, // 0からスタートし、下のrecordTransactionで指定数量のみを加算（+1が+2になる不具合を完全解消）
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '端子ボックス (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
      note: newItemNote.trim() || undefined,
    };
    await saveItem(item);
    const conv = allConversions.find((c) => c.unit === selectedUnit) || { multiplier: 1 };
    await recordTransaction(item, 'IN', quantity, selectedUnit, conv.multiplier, '新規登録初回入荷', false);
    closeBottomSheet();
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
            <div className="flex-1 min-w-0">
              <h2 className="font-extrabold text-sm sm:text-base text-white truncate">
                {activeScannedItem ? activeScannedItem.name :
                  currentStep === 'NEW_ITEM_INBOUND' ? '初回入荷数量の入力' : '新規品目登録 & 入荷'}
              </h2>
              {activeScannedItem ? (
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {activeScannedItem.spec ? (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                      規格: {activeScannedItem.spec}
                    </span>
                  ) : null}
                  <span className="text-[11px] text-slate-400 font-mono">
                    コード: {activeScannedItem.code}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 font-mono">
                  コード: {activeScannedCode}
                </p>
              )}
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

              {/* 規格・型番の強調表示 */}
              {activeScannedItem.spec && (
                <div className="bg-amber-950/40 border border-amber-500/30 px-3.5 py-2.5 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span className="text-xs text-amber-200/90 font-bold">規格・型番仕様:</span>
                  </div>
                  <span className="text-sm font-black text-amber-300 bg-slate-950/80 px-2.5 py-0.5 rounded-lg border border-amber-500/40 font-mono">
                    {activeScannedItem.spec}
                  </span>
                </div>
              )}

              {/* 作業員への備考・注意メモ */}
              {activeScannedItem.note && (
                <div className="bg-amber-950/40 border border-amber-500/40 px-3.5 py-2 rounded-2xl flex items-start gap-2 text-xs text-amber-200 shadow-sm">
                  <span className="shrink-0 font-black text-amber-400">📌 注意:</span>
                  <span className="font-semibold leading-relaxed">{activeScannedItem.note}</span>
                </div>
              )}

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
          {currentStep === 'KEYPAD' && activeScannedItem && (() => {
            const pendingOutBaseQty = pendingInbounds
              .filter((p) => p.status === 'PENDING' && p.type === 'OUT' && p.itemCode === activeScannedItem.code)
              .reduce((sum, p) => sum + p.baseQuantity, 0);
            const effectiveStock = Math.max(0, activeScannedItem.currentStock - pendingOutBaseQty);

            return (
              <div className="space-y-3">
                {/* 品目規格リキャップバー */}
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div className="truncate flex-1 mr-2">
                    <span className="text-slate-400">対象品: </span>
                    <strong className="text-white">{activeScannedItem.name}</strong>
                  </div>
                  {activeScannedItem.spec ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-black text-xs border border-amber-500/40 shrink-0">
                      規格: {activeScannedItem.spec}
                    </span>
                  ) : null}
                </div>

                <div className={`py-2 px-3.5 rounded-xl font-bold text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 ${
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
                  <div className="flex items-center gap-1.5 opacity-90 text-[11px]">
                    <span>現在庫: {activeScannedItem.currentStock} {activeScannedItem.baseUnit}</span>
                    {pendingOutBaseQty > 0 && selectedAction === 'OUT' && (
                      <span className="text-amber-400 font-bold">
                        (引当待: -{pendingOutBaseQty} | 有効: {effectiveStock} {activeScannedItem.baseUnit})
                      </span>
                    )}
                  </div>
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
                  maxStock={effectiveStock}
                  isOutAction={selectedAction === 'OUT'}
                  confirmLabel={
                    selectedAction === 'IN'
                      ? settings.requirePcApprovalForInbound
                        ? `承認待ち送信 (+${quantity} ${selectedUnit})`
                        : `入荷確定 (+${quantity} ${selectedUnit})`
                      : selectedAction === 'OUT'
                      ? `出庫確認へ (-${quantity} ${selectedUnit})`
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
            );
          })()}

          {/* ── STEP 3: 在庫照会 ── */}
          {currentStep === 'INQUIRY' && activeScannedItem && (
            <div>
              <StockInquiryCard item={activeScannedItem} />
            </div>
          )}

          {/* ── STEP 4: 未登録バーコードの処理（新規品目登録 or 既存品目への箱コード紐付け） ── */}
          {currentStep === 'NEW_ITEM' && (
            <div className="space-y-4">
              {/* Top Mode Segmented Selector */}
              <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 gap-1.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setUnregisteredMode('CREATE_NEW')}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    unregisteredMode === 'CREATE_NEW'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>✨ 新規品目として登録</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnregisteredMode('LINK_EXISTING')}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    unregisteredMode === 'LINK_EXISTING'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Link2 className="w-4 h-4 text-indigo-300" />
                  <span>🔗 既存品目に箱コード紐付け</span>
                </button>
              </div>

              {/* ── MODE B: 既存品目に「箱コード・別名バーコード」として紐付け ── */}
              {unregisteredMode === 'LINK_EXISTING' && (
                <div className="bg-gradient-to-r from-indigo-950/90 to-slate-900/90 p-4 rounded-3xl border border-indigo-500/50 shadow-xl space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-indigo-400" />
                      <span className="font-extrabold text-sm text-white">
                        外箱コード・別名コード紐付け
                      </span>
                    </div>
                    <span className="text-xs font-mono text-amber-300 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-700 font-bold">
                      {activeScannedCode}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    スキャンしたバーコード（{activeScannedCode}）を、既存の品目の「外箱コード・仕入先コード」として紐付けます。次回以降スキャン時に自動で対象品目・箱単位として認識されます。
                  </p>

                  {/* Search Existing Item */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      紐付ける対象品目を検索・選択：
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={linkSearchQuery}
                        onChange={(e) => setLinkSearchQuery(e.target.value)}
                        placeholder="品名・規格・メーカーで検索..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Filtered Item Candidates */}
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1 pr-1">
                      {filteredExistingItemsForLink.length > 0 ? (
                        filteredExistingItemsForLink.slice(0, 6).map((item) => {
                          const isSelected = linkTargetItem?.id === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setLinkTargetItem(item);
                                const firstBox = item.unitConversions?.find((c) => c.unit.includes('箱')) || item.unitConversions?.[0];
                                if (firstBox) {
                                  setLinkUnit(firstBox.unit);
                                  setLinkMultiplier(firstBox.multiplier);
                                } else {
                                  setLinkUnit('箱');
                                  setLinkMultiplier(100);
                                }
                              }}
                              className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'bg-indigo-950 border-indigo-400 shadow-md'
                                  : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-xs text-white truncate">{item.name}</div>
                                <div className="text-[11px] text-amber-300 font-mono truncate">
                                  {item.spec ? `[${item.spec}] ` : ''}{item.supplier ? `(${item.supplier})` : ''}
                                </div>
                              </div>
                              <span className="text-[11px] font-bold text-emerald-400 shrink-0">
                                在庫: {item.currentStock} {item.baseUnit}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-4 text-center text-xs text-slate-500">
                          一致する品目がありません
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Item Confirmation & Packaging Unit */}
                  {linkTargetItem && (
                    <div className="bg-slate-950 p-3 rounded-2xl border border-indigo-500/40 space-y-2.5 animate-in fade-in duration-150">
                      <div className="text-xs border-b border-slate-800 pb-2">
                        <span className="text-slate-400 block text-[10px]">選択された対象品目:</span>
                        <strong className="text-white text-sm">{linkTargetItem.name}</strong>
                        {linkTargetItem.spec && (
                          <span className="text-amber-300 font-mono ml-2 font-bold">[{linkTargetItem.spec}]</span>
                        )}
                        {linkTargetItem.supplier && (
                          <span className="text-slate-400 ml-1">({linkTargetItem.supplier})</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            スキャン時の単位
                          </label>
                          <select
                            value={linkUnit}
                            onChange={(e) => {
                              setLinkUnit(e.target.value);
                              const conv = linkTargetItem.unitConversions?.find((c) => c.unit === e.target.value);
                              if (conv) setLinkMultiplier(conv.multiplier);
                            }}
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold text-xs"
                          >
                            {PRESET_UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            換算倍率 ({linkTargetItem.baseUnit})
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={linkMultiplier}
                            onChange={(e) => setLinkMultiplier(Math.max(1, Number(e.target.value) || 1))}
                            className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-black text-xs text-center text-emerald-400"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          用途・メモ (任意)
                        </label>
                        <input
                          type="text"
                          value={linkLabel}
                          onChange={(e) => setLinkLabel(e.target.value)}
                          placeholder="例: 外箱コード (1000本入), 仕入先発注JAN"
                          className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleConfirmLinkToExisting}
                        className="w-full py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-950 transition flex items-center justify-center gap-1.5 mt-2"
                      >
                        <Link2 className="w-4 h-4" />
                        <span>🔗 このバーコードを「{linkTargetItem.name}」に紐付けて保存</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ── MODE A: 新規品目登録 ── */}
              {unregisteredMode === 'CREATE_NEW' && (
                <>
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
                    <input type="number" min="0" value={newItemSafetyStock === 0 ? '' : newItemSafetyStock}
                      onChange={(e) => setNewItemSafetyStock(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs" />
                  </div>
                </div>

                {/* 📌 備考・リマインダーメモ */}
                <div>
                  <label className="block font-semibold text-slate-300 mb-1 text-xs flex items-center justify-between">
                    <span>📌 備考・注意メモ（作業員リマインダー）</span>
                    <span className="text-[10px] text-slate-500">任意</span>
                  </label>
                  <input
                    type="text"
                    value={newItemNote}
                    onChange={(e) => setNewItemNote(e.target.value)}
                    placeholder="例: 開封済み袋から優先使用 / ロット確認"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400 placeholder-slate-500"
                  />
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
                      {/* 左：包装単位プルダウン */}
                      <select
                        value={PRESET_UNITS.includes(conv.unit as any) ? conv.unit : 'custom'}
                        onChange={(e) => {
                          if (e.target.value !== 'custom') {
                            handleUpdateConversion(idx, 'unit', e.target.value);
                          }
                        }}
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs"
                      >
                        {PRESET_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                        <option value="custom">自訂</option>
                      </select>

                      {!PRESET_UNITS.includes(conv.unit as any) && (
                        <input
                          type="text"
                          value={conv.unit}
                          onChange={(e) => handleUpdateConversion(idx, 'unit', e.target.value)}
                          placeholder="単位名"
                          className="w-14 px-1.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs text-center"
                        />
                      )}

                      <span className="text-slate-400 text-xs font-bold">=</span>

                      {/* 中：倍率 */}
                      <input
                        type="number"
                        min="1"
                        value={conv.multiplier === 0 || (conv.multiplier as any) === '' ? '' : conv.multiplier}
                        onChange={(e) => handleUpdateConversion(idx, 'multiplier', e.target.value)}
                        placeholder="入数"
                        className="w-16 px-1.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-black text-xs text-center text-emerald-400"
                      />

                      {/* 右：基準単位 */}
                      <select
                        value={newItemBaseUnit}
                        onChange={(e) => setNewItemBaseUnit(e.target.value)}
                        className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs"
                      >
                        {PRESET_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>

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
            </>
          )}
        </div>
      )}

          {/* ── STEP 5: 初回入荷数量の確認（フル数字キーパッドで自由な数量を入力） ── */}
          {currentStep === 'NEW_ITEM_INBOUND' && (() => {
            const allConversions: UnitConversion[] = [
              ...newItemConversions.filter((c) => c.unit !== newItemBaseUnit),
              { unit: newItemBaseUnit, multiplier: 1 },
            ];

            return (
              <div className="space-y-3">
                <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-2xl p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-emerald-300">✅ 品目を登録・学習しました！</span>
                    <span className="text-[11px] text-slate-400">初回入荷数を入力してください</span>
                  </div>
                  <p className="text-slate-300">
                    品名：<strong className="text-white">{newItemName}</strong>
                    {newItemSpec && ` [${newItemSpec}]`}
                    {newItemSupplier && ` | ${newItemSupplier}`}
                  </p>
                  <p className="text-slate-300 mt-0.5">
                    保管場所：<strong className="text-blue-300">{newItemBoxName}</strong>
                    {' | '}基準単位：<strong className="text-emerald-400">{newItemBaseUnit}</strong>
                  </p>
                </div>

                <NumericKeypad
                  value={quantity}
                  onChange={setQuantity}
                  units={allConversions}
                  baseUnit={newItemBaseUnit}
                  selectedUnit={selectedUnit}
                  onSelectUnit={setSelectedUnit}
                  onConfirm={handleConfirmNewItemInbound}
                  soundEnabled={settings.soundEnabled}
                  confirmLabel={
                    settings.requirePcApprovalForInbound
                      ? `承認待ち送信 (+${quantity} ${selectedUnit})`
                      : `初回入荷確定 (+${quantity} ${selectedUnit})`
                  }
                  confirmColor="bg-emerald-600 hover:bg-emerald-500"
                />

                <button
                  type="button"
                  onClick={closeBottomSheet}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 font-semibold text-xs rounded-xl transition"
                >
                  入荷せずマスタ登録のみで終了
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── 出庫二次確認モーダル ── */}
      {isConfirmModalOpen && activeScannedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/40 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <ArrowUpCircle className="w-7 h-7 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-black text-white">出庫内容の最終確認</h3>
              <p className="text-xs text-slate-400">以下の内容で在庫を払い出します。よろしいですか？</p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between items-start text-slate-300 gap-2">
                <span className="text-slate-400 shrink-0">対象品目:</span>
                <strong className="text-white text-right break-words">{activeScannedItem.name}</strong>
              </div>
              {activeScannedItem.spec && (
                <div className="flex justify-between items-center text-slate-300 gap-2">
                  <span className="text-slate-400 shrink-0">規格・型番:</span>
                  <strong className="text-amber-300 font-bold font-mono">{activeScannedItem.spec}</strong>
                </div>
              )}
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">出庫数量:</span>
                <strong className="text-rose-400 font-black text-sm">
                  {quantity} {selectedUnit}
                  {(() => {
                    const conv = activeScannedItem.unitConversions?.find((u) => u.unit === selectedUnit) || { multiplier: 1 };
                    return conv.multiplier > 1 ? ` (換算: -${quantity * conv.multiplier} ${activeScannedItem.baseUnit})` : '';
                  })()}
                </strong>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="text-slate-400">現在庫:</span>
                <span className="font-bold">{activeScannedItem.currentStock} {activeScannedItem.baseUnit}</span>
              </div>
              <div className="flex justify-between text-slate-300 pt-1.5 border-t border-slate-800">
                <span className="text-slate-300 font-bold">出庫後残在庫:</span>
                <strong className="text-emerald-400 font-black text-base">
                  {Math.max(0, activeScannedItem.currentStock - quantity * ((activeScannedItem.unitConversions?.find((u) => u.unit === selectedUnit)?.multiplier) || 1))} {activeScannedItem.baseUnit}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px] pt-1">
                <span>担当作業員:</span>
                <strong className="text-blue-400 font-bold">{settings.activeOperator}</strong>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="py-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecuteOut}
                className="py-3 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-950/50 transition flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>出庫を実行する</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
