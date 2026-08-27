import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ActionType, ItemMaster, PRESET_UNITS } from '../../types/inventory';
import { NumericKeypad } from './NumericKeypad';
import { StockInquiryCard } from './StockInquiryCard';
import { OcrHelper } from '../../utils/ocrHelper';
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
} from 'lucide-react';

// ─── 電工向けプリセット ───────────────────
const PRESET_SUPPLIERS = [
  'NICHIFU (日富)',
  'Panduit (泛達)',
  'Phoenix Contact',
  'WAGO',
  'OMRON',
  'IDEC',
  'Fuji Electric (富士電機)',
  'Yokogawa (橫河)',
  'MITSUBISHI (三菱)',
  '日東電工 (Nitto)',
  'SMC',
  'MISUMI',
];

const PRESET_NAMES = [
  // 端子類
  '圓形壓著端子',
  '棒形壓著端子',
  'Y形壓著端子',
  '針形端子 (AI型)',
  // 配線資材
  '耐候束線帶',
  '塑膠波紋管',
  '電線管接頭',
  '護線套管 (Spiral)',
  '配線固定座',
  // 螺絲螺帽
  '六角孔螺栓',
  '六角螺帽',
  '平墊圈',
  '彈簧墊圈',
  // 零件
  '玻璃管保險絲',
  '快速氣壓接頭',
  'DIN 導軌 (35mm)',
  '配電盤端子台',
];

const PRESET_BOXES = [
  '1號盒 (A-01)',
  '2號盒 (A-02)',
  '3號盒 (B-01)',
  '4號盒 (B-02)',
  '5號盒 (C-01)',
  '6號盒 (C-02)',
  '端子盒',
  '束線帶盒',
  '螺絲盒',
  '保險絲盒',
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
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('個');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState(10);
  const [newItemBoxName, setNewItemBoxName] = useState('1號盒 (A-01)');
  const [itemImage, setItemImage] = useState<string | null>(null);

  // 新增品目時的初始入庫數量
  const [initialInboundQty, setInitialInboundQty] = useState(1);

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrDetectedInfo, setOcrDetectedInfo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setNewItemBaseUnit('個');
        setNewItemBoxName('1號盒 (A-01)');
        setItemImage(null);
        setOcrDetectedInfo(null);
        setInitialInboundQty(1);
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

  // 拍照 OCR
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setItemImage(base64);
      setIsOcrProcessing(true);
      setOcrDetectedInfo(null);
      try {
        const result = await OcrHelper.recognizeImage(base64);
        setIsOcrProcessing(false);
        const detectedParts: string[] = [];
        if (result.suggestedName) { setNewItemName(result.suggestedName); detectedParts.push(`品名: ${result.suggestedName}`); }
        if (result.suggestedSpec) { setNewItemSpec(result.suggestedSpec); detectedParts.push(`規格: ${result.suggestedSpec}`); }
        if (result.suggestedSupplier) { setNewItemSupplier(result.suggestedSupplier); detectedParts.push(`廠商: ${result.suggestedSupplier}`); }
        if (result.suggestedBoxName) { setNewItemBoxName(result.suggestedBoxName); detectedParts.push(`盒號: ${result.suggestedBoxName}`); }
        if (detectedParts.length > 0) {
          setOcrDetectedInfo(`✨ 辨識填入：${detectedParts.join(' | ')}`);
          addToast('success', '已辨識標籤文字並自動填入！');
        } else {
          setOcrDetectedInfo('已取得照片，請確認下方資料或點選常用標籤');
        }
      } catch {
        setIsOcrProcessing(false);
        setOcrDetectedInfo('辨識失敗，請手動填寫或點選常用標籤');
      }
    };
    reader.readAsDataURL(file);
  };

  // 儲存商品並進入【入庫數量輸入】步驟
  const handleSaveAndGoToInbound = async () => {
    if (!activeScannedCode) return;
    const nameToUse = newItemName.trim() || `新商品-${activeScannedCode.slice(-6)}`;
    const newItem: ItemMaster = {
      id: `item-${activeScannedCode}`,
      code: activeScannedCode,
      name: nameToUse,
      spec: newItemSpec.trim(),
      category: '一般部品',
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: itemImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: 0,
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '1號盒 (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: [
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
        { unit: newItemBaseUnit, multiplier: 1 },
      ],
      updatedAt: new Date().toISOString(),
    };
    await saveItem(newItem);
    addToast('info', `品目「${nameToUse}」已建立，請輸入初始入庫數量`);
    setSelectedAction('IN');
    setSelectedUnit(newItemBaseUnit);
    setQuantity(initialInboundQty);
    setCurrentStep('NEW_ITEM_INBOUND');
  };

  // 跳過入庫，直接關閉
  const handleSaveOnly = async () => {
    if (!activeScannedCode) return;
    const nameToUse = newItemName.trim() || `新商品-${activeScannedCode.slice(-6)}`;
    const newItem: ItemMaster = {
      id: `item-${activeScannedCode}`,
      code: activeScannedCode,
      name: nameToUse,
      spec: newItemSpec.trim(),
      category: '一般部品',
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: itemImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: 0,
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '1號盒 (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: [
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
        { unit: newItemBaseUnit, multiplier: 1 },
      ],
      updatedAt: new Date().toISOString(),
    };
    await saveItem(newItem);
    closeBottomSheet();
  };

  // 新規品目登録後の入庫確認 (NEW_ITEM_INBOUND ステップ)
  const handleConfirmNewItemInbound = async () => {
    if (!activeScannedCode) return;
    const item = {
      id: `item-${activeScannedCode}`,
      code: activeScannedCode,
      name: newItemName.trim() || `新商品-${activeScannedCode.slice(-6)}`,
      spec: newItemSpec.trim(),
      category: '一般部品',
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: itemImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: 0,
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '1號盒 (A-01)',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: [
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
        { unit: newItemBaseUnit, multiplier: 1 },
      ],
      updatedAt: new Date().toISOString(),
    };
    await recordTransaction(item, 'IN', quantity, selectedUnit, 1, '新品初次入庫');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
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
                  currentStep === 'NEW_ITEM_INBOUND' ? '確認初次入庫數量' : '🆕 新商品登記'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {activeScannedItem ? activeScannedItem.code : activeScannedCode}
              </p>
            </div>
          </div>
          <button onClick={closeBottomSheet} className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">

          {/* ── MENU ── */}
          {currentStep === 'MENU' && activeScannedItem && (
            <div className="space-y-3">
              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">目前庫存</span>
                  <div className="text-2xl font-black text-emerald-400">
                    {activeScannedItem.currentStock}{' '}
                    <span className="text-xs text-slate-300 font-bold">{activeScannedItem.baseUnit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-semibold block">盒子 / 廠商</span>
                  <div className="text-sm font-bold text-blue-400">
                    {activeScannedItem.location || '未指定'}
                    {activeScannedItem.supplier && (
                      <span className="text-xs text-slate-300 font-normal"> ({activeScannedItem.supplier})</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => handleSelectAction('IN')}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1.5 transition">
                  <ArrowDownCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【 入 庫 】</span>
                  <span className="text-[11px] opacity-90 font-medium">
                    {settings.requirePcApprovalForInbound ? '暫存待PC審核' : '直接增加在庫'}
                  </span>
                </button>
                <button type="button" onClick={() => handleSelectAction('OUT')}
                  className="p-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1.5 transition">
                  <ArrowUpCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【 出 庫 】</span>
                  <span className="text-[11px] opacity-90 font-medium">扣減使用數量</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button type="button" onClick={() => setCurrentStep('INQUIRY')}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition">
                  <Search className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-sm">查庫存明細</span>
                </button>
                <button type="button" onClick={() => handleSelectAction('ORDER')}
                  className="p-3 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 border border-amber-500/40 rounded-2xl flex items-center justify-center gap-2 transition">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-sm">請購叫貨</span>
                </button>
              </div>
            </div>
          )}

          {/* ── KEYPAD ── */}
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
                    ? settings.requirePcApprovalForInbound ? '【現場入庫（送PC審核）】' : '【現場直接入庫】'
                    : selectedAction === 'OUT' ? '【出庫作業】' : '【請購登記】'}
                </span>
                <span className="opacity-90">現有: {activeScannedItem.currentStock} {activeScannedItem.baseUnit}</span>
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
                      ? `✅ 送交 PC 審核 (+${quantity} ${selectedUnit})`
                      : `✅ 確認入庫 (+${quantity} ${selectedUnit})`
                    : selectedAction === 'OUT'
                    ? `確認出庫 (-${quantity} ${selectedUnit})`
                    : `確認請購 (${quantity} ${selectedUnit})`
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

          {/* ── INQUIRY ── */}
          {currentStep === 'INQUIRY' && activeScannedItem && (
            <div>
              <StockInquiryCard item={activeScannedItem} />
            </div>
          )}

          {/* ── NEW_ITEM: 新商品登記 ── */}
          {currentStep === 'NEW_ITEM' && (
            <div className="space-y-4">
              {/* Card 1: OCR & Quick Action */}
              <div className="bg-gradient-to-r from-blue-950/90 to-indigo-950/90 p-4 rounded-3xl border border-blue-500/50 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <span className="font-extrabold text-sm text-white">新商品登記與入庫</span>
                  </div>
                  <span className="text-xs font-mono text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-700/50">
                    {activeScannedCode}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  拍照辨識或點選常用標籤，填寫後可登記品目並輸入初次入庫數量。
                </p>

                <input type="file" ref={fileInputRef} accept="image/*" capture="environment"
                  onChange={handlePhotoCapture} className="hidden" />

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button type="button" disabled={isOcrProcessing} onClick={() => fileInputRef.current?.click()}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-100 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1 transition shadow">
                    {isOcrProcessing ? <Loader2 className="w-5 h-5 text-amber-400 animate-spin" /> : <Camera className="w-5 h-5 text-emerald-400" />}
                    <span className="font-extrabold text-xs">
                      {isOcrProcessing ? '辨識中...' : itemImage ? '重拍照片' : '📸 拍照辨識'}
                    </span>
                  </button>

                  <button type="button" onClick={handleSaveAndGoToInbound}
                    className="py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-950 transition flex flex-col items-center justify-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    <span>確認並輸入入庫量</span>
                  </button>
                </div>

                {ocrDetectedInfo && (
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="break-all">{ocrDetectedInfo}</span>
                  </div>
                )}

                {itemImage && (
                  <div className="relative w-full h-24 rounded-2xl overflow-hidden border border-slate-700 bg-black">
                    <img src={itemImage} alt="preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setItemImage(null); setOcrDetectedInfo(null); }}
                      className="absolute top-1.5 right-1.5 p-1.5 bg-black/80 hover:bg-black text-white rounded-full">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card 2: 1-Tap Presets */}
              <div className="bg-slate-950/80 p-3.5 rounded-3xl border border-slate-800 space-y-2.5 text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-blue-400" />
                  <span>點擊快速填入品名：</span>
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
                  <span>點擊廠商：</span>
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
                  <span>點擊盒子名稱：</span>
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

              {/* Card 3: Manual Form */}
              <div className="bg-slate-950/70 p-4 rounded-3xl border border-slate-800 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">品名</label>
                  <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="例: 圓形壓著端子 R2-4"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 font-medium" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">廠商 / 供應商</label>
                    <input type="text" value={newItemSupplier} onChange={(e) => setNewItemSupplier(e.target.value)}
                      placeholder="例: NICHIFU..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">規格 / 型號</label>
                    <input type="text" value={newItemSpec} onChange={(e) => setNewItemSpec(e.target.value)}
                      placeholder="例: R2-4, 1.25-4..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">基準單位</label>
                    <select value={newItemBaseUnit} onChange={(e) => setNewItemBaseUnit(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold">
                      {PRESET_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Box className="w-3 h-3 text-blue-400" />盒子
                    </label>
                    <input type="text" value={newItemBoxName} onChange={(e) => setNewItemBoxName(e.target.value)}
                      placeholder="1號盒 (A-01)"
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">安全庫存</label>
                    <input type="number" min="0" value={newItemSafetyStock}
                      onChange={(e) => setNewItemSafetyStock(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button type="button" onClick={handleSaveAndGoToInbound}
                    className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    登記並輸入入庫量
                  </button>
                  <button type="button" onClick={handleSaveOnly}
                    className="py-3 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4 text-amber-400" />
                    只登記不入庫
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── NEW_ITEM_INBOUND: 初次入庫數量確認 ── */}
          {currentStep === 'NEW_ITEM_INBOUND' && (
            <div className="space-y-3">
              <div className="bg-emerald-950/60 border border-emerald-700/60 rounded-2xl p-3.5 text-xs">
                <p className="font-bold text-emerald-300 mb-1">✅ 品目已建立！</p>
                <p className="text-slate-300">
                  品名：<strong className="text-white">{newItemName}</strong>
                  {newItemSupplier && ` | 廠商：${newItemSupplier}`}
                </p>
                <p className="text-slate-300 mt-0.5">
                  盒號：<strong className="text-blue-300">{newItemBoxName}</strong>
                  {' | '}單位：<strong className="text-white">{newItemBaseUnit}</strong>
                </p>
                <p className="text-amber-300 mt-1 font-semibold">
                  {settings.requirePcApprovalForInbound
                    ? '入庫將送交 PC 端審核確認後正式入庫。'
                    : '入庫後庫存立即更新。'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-2 text-sm">初次入庫數量</label>
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
                    ? `送交審核 (+${quantity} ${newItemBaseUnit})`
                    : `確認入庫 (+${quantity} ${newItemBaseUnit})`}
                </span>
              </button>

              <button type="button" onClick={closeBottomSheet}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-semibold text-sm rounded-xl transition">
                跳過入庫，稍後再操作
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
