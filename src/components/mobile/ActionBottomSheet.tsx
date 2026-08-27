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
} from 'lucide-react';

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

  // Mode: 'MENU' | 'KEYPAD' | 'INQUIRY' | 'NEW_ITEM'
  const [currentStep, setCurrentStep] = useState<'MENU' | 'KEYPAD' | 'INQUIRY' | 'NEW_ITEM'>('MENU');
  const [selectedAction, setSelectedAction] = useState<ActionType>('IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<string>('個');
  const [note, setNote] = useState<string>('');

  // New Item Registration form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemSpec, setNewItemSpec] = useState('');
  const [newItemSupplier, setNewItemSupplier] = useState('');
  const [newItemCategory] = useState('一般部品');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('個');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState(10);
  const [newItemBoxName, setNewItemBoxName] = useState('1號盒');
  const [itemImage, setItemImage] = useState<string | null>(null);

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
        // 未登錄品項: 預設填入安全代碼，等待拍照辨識或直接入庫
        setCurrentStep('NEW_ITEM');
        const cleanCode = activeScannedCode || '';
        const shortCode = cleanCode.length > 8 ? cleanCode.slice(-6) : cleanCode;
        setNewItemName(`新商品-${shortCode}`);
        setNewItemSpec('');
        setNewItemSupplier('');
        setNewItemBaseUnit('個');
        setNewItemBoxName('1號盒');
        setItemImage(null);
        setOcrDetectedInfo(null);
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

    await recordTransaction(
      activeScannedItem,
      selectedAction,
      quantity,
      selectedUnit,
      conv.multiplier,
      note
    );
  };

  // 拍照 / 圖片上傳 + 自動 OCR 文字辨識
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setItemImage(base64);

      // 啟動 OCR 文字識別
      setIsOcrProcessing(true);
      setOcrDetectedInfo(null);
      try {
        const result = await OcrHelper.recognizeImage(base64);
        setIsOcrProcessing(false);

        const detectedParts: string[] = [];
        if (result.suggestedName) {
          setNewItemName(result.suggestedName);
          detectedParts.push(`品名: ${result.suggestedName}`);
        }
        if (result.suggestedSpec) {
          setNewItemSpec(result.suggestedSpec);
          detectedParts.push(`規格: ${result.suggestedSpec}`);
        }
        if (result.suggestedSupplier) {
          setNewItemSupplier(result.suggestedSupplier);
          detectedParts.push(`廠商: ${result.suggestedSupplier}`);
        }
        if (result.suggestedBoxName) {
          setNewItemBoxName(result.suggestedBoxName);
          detectedParts.push(`盒子: ${result.suggestedBoxName}`);
        }

        if (detectedParts.length > 0) {
          setOcrDetectedInfo(`✨ 照片文字已自動填入：${detectedParts.join(' | ')}`);
          addToast('success', '已自動辨識照片標籤文字並填入欄位！');
        } else {
          setOcrDetectedInfo('已取得照片，請確認下方欄位或直接入庫');
        }
      } catch (err) {
        setIsOcrProcessing(false);
        console.error('OCR failed:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // 儲存商品並直接進入入庫鍵盤
  const handleSaveAndProceed = async (customName?: string) => {
    if (!activeScannedCode) return;

    const nameToUse = customName || newItemName || `新商品-${activeScannedCode.slice(-6)}`;
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
      location: newItemBoxName.trim() || '1號盒',
      qrCode: `INV:v1:${activeScannedCode}`,
      unitConversions: [
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
        { unit: newItemBaseUnit, multiplier: 1 },
      ],
      updatedAt: new Date().toISOString(),
    };

    await saveItem(newItem);
    setSelectedAction('IN');
    setSelectedUnit(newItemBaseUnit);
    setQuantity(1);
    setCurrentStep('KEYPAD');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            {currentStep !== 'MENU' && activeScannedItem && (
              <button
                onClick={() => setCurrentStep('MENU')}
                className="p-1.5 -ml-2 text-slate-400 hover:text-white rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-white truncate max-w-[260px]">
                {activeScannedItem ? activeScannedItem.name : '新商品登記與入庫'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                條碼: {activeScannedItem ? activeScannedItem.code : activeScannedCode}
              </p>
            </div>
          </div>
          <button
            onClick={closeBottomSheet}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* STEP 1: Main Action Menu */}
          {currentStep === 'MENU' && activeScannedItem && (
            <div className="space-y-3">
              {/* Quick Summary Badge */}
              <div className="bg-slate-950/90 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 font-semibold block">目前庫存</span>
                  <div className="text-2xl font-black text-emerald-400">
                    {activeScannedItem.currentStock}{' '}
                    <span className="text-xs text-slate-300 font-bold">{activeScannedItem.baseUnit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-semibold block">存放盒子 / 廠商</span>
                  <div className="text-sm font-bold text-blue-400">
                    {activeScannedItem.location || '未指定盒號'}{' '}
                    {activeScannedItem.supplier && (
                      <span className="text-xs text-slate-300 font-normal">
                        ({activeScannedItem.supplier})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. 入荷 (入庫) */}
                <button
                  type="button"
                  onClick={() => handleSelectAction('IN')}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1.5 transition"
                >
                  <ArrowDownCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【 入 庫 】</span>
                  <span className="text-[11px] opacity-90 font-medium">增加庫存數量</span>
                </button>

                {/* 2. 払出 (出庫) */}
                <button
                  type="button"
                  onClick={() => handleSelectAction('OUT')}
                  className="p-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1.5 transition"
                >
                  <ArrowUpCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【 出 庫 】</span>
                  <span className="text-[11px] opacity-90 font-medium">扣減使用數量</span>
                </button>
              </div>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCurrentStep('INQUIRY')}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition"
                >
                  <Search className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-sm">【 查庫存明細 】</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAction('ORDER')}
                  className="p-3 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 border border-amber-500/40 rounded-2xl flex items-center justify-center gap-2 transition"
                >
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-sm">【 請購叫貨 】</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Keypad Input */}
          {currentStep === 'KEYPAD' && activeScannedItem && (
            <div className="space-y-3">
              <div
                className={`py-2 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between ${
                  selectedAction === 'IN'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : selectedAction === 'OUT'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                }`}
              >
                <span>
                  目前模式:{' '}
                  {selectedAction === 'IN' ? '【 入庫作業 】' : selectedAction === 'OUT' ? '【 出庫作業 】' : '【 請購登記 】'}
                </span>
                <span className="opacity-90">現有: {activeScannedItem.currentStock} {activeScannedItem.baseUnit}</span>
              </div>

              <NumericKeypad
                value={quantity}
                onChange={setQuantity}
                units={
                  activeScannedItem.unitConversions && activeScannedItem.unitConversions.length > 0
                    ? activeScannedItem.unitConversions
                    : [{ unit: activeScannedItem.baseUnit, multiplier: 1 }]
                }
                baseUnit={activeScannedItem.baseUnit}
                selectedUnit={selectedUnit}
                onSelectUnit={setSelectedUnit}
                onConfirm={handleConfirmTransaction}
                soundEnabled={settings.soundEnabled}
                confirmLabel={
                  selectedAction === 'IN'
                    ? `確認入庫 (+${quantity} ${selectedUnit})`
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

          {/* STEP 3: Stock Inquiry Details */}
          {currentStep === 'INQUIRY' && activeScannedItem && (
            <div>
              <StockInquiryCard item={activeScannedItem} />
            </div>
          )}

          {/* STEP 4: Smart Fast Registration & OCR (拍照自動識別 / 快速入庫) */}
          {currentStep === 'NEW_ITEM' && (
            <div className="space-y-4">
              {/* Card 1: Fast Photo OCR & Direct In */}
              <div className="bg-gradient-to-r from-blue-950/90 to-indigo-950/90 p-4 rounded-3xl border border-blue-500/50 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span className="font-extrabold text-sm text-white">新商品辨識與登記</span>
                  </div>
                  <span className="text-xs font-mono text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded-lg border border-blue-700/50">
                    {activeScannedCode}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  現場不用打字！點擊下方拍照自動辨識標籤文字，或直接點【立即入庫】稍後再補品名。
                </p>

                {/* Hidden File Input for Camera */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoCapture}
                  className="hidden"
                />

                {/* 2 Primary Actions: Snap Photo OCR vs 1-Click Direct In */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {/* Photo Snap & OCR Button */}
                  <button
                    type="button"
                    disabled={isOcrProcessing}
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3.5 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-100 rounded-2xl border border-slate-700 flex flex-col items-center justify-center gap-1 transition shadow"
                  >
                    {isOcrProcessing ? (
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                    ) : (
                      <Camera className="w-5 h-5 text-emerald-400" />
                    )}
                    <span className="font-extrabold text-xs sm:text-sm">
                      {isOcrProcessing ? '正在辨識文字...' : itemImage ? '重拍標籤照片' : '📸 拍照自動辨識'}
                    </span>
                  </button>

                  {/* 1-Click Direct Stock In */}
                  <button
                    type="button"
                    onClick={() => handleSaveAndProceed()}
                    className="py-3.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black rounded-2xl text-xs sm:text-sm shadow-lg shadow-blue-950 transition flex flex-col items-center justify-center gap-1"
                  >
                    <Zap className="w-5 h-5 text-amber-300" />
                    <span>⚡ 免填寫・直接入庫</span>
                  </button>
                </div>

                {/* OCR Feedback message */}
                {ocrDetectedInfo && (
                  <div className="p-2.5 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{ocrDetectedInfo}</span>
                  </div>
                )}

                {/* Image Preview Thumbnail */}
                {itemImage && (
                  <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-slate-700 bg-black">
                    <img src={itemImage} alt="Captured preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setItemImage(null);
                        setOcrDetectedInfo(null);
                      }}
                      className="absolute top-1.5 right-1.5 p-1.5 bg-black/80 hover:bg-black text-white rounded-full"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Card 2: Manual Fields & Customization */}
              <div className="bg-slate-950/70 p-4 rounded-3xl border border-slate-800 space-y-3 text-xs">
                <span className="font-bold text-slate-300 block">
                  📝 商品詳細資訊（可手動修改或確認）：
                </span>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">品名</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="例: M6六角螺栓"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">廠商 / 供應商</label>
                    <input
                      type="text"
                      value={newItemSupplier}
                      onChange={(e) => setNewItemSupplier(e.target.value)}
                      placeholder="例: MISUMI, SMC..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">規格 / 型號</label>
                    <input
                      type="text"
                      value={newItemSpec}
                      onChange={(e) => setNewItemSpec(e.target.value)}
                      placeholder="例: M6×20mm SUS304"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {/* 基準單位下拉選擇 */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">基準單位</label>
                    <select
                      value={newItemBaseUnit}
                      onChange={(e) => setNewItemBaseUnit(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold"
                    >
                      {PRESET_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 盒子名稱 (改自棚番) */}
                  <div>
                    <label className="block font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Box className="w-3 h-3 text-blue-400" />
                      <span>盒子名稱</span>
                    </label>
                    <input
                      type="text"
                      value={newItemBoxName}
                      onChange={(e) => setNewItemBoxName(e.target.value)}
                      placeholder="例: 1號盒 / A-01"
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-300 mb-1">安全庫存</label>
                    <input
                      type="number"
                      min="0"
                      value={newItemSafetyStock}
                      onChange={(e) => setNewItemSafetyStock(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveAndProceed()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow transition"
                >
                  確認儲存並進行入庫
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
