import React, { useState, useEffect, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ActionType, ItemMaster } from '../../types/inventory';
import { NumericKeypad } from './NumericKeypad';
import { StockInquiryCard } from './StockInquiryCard';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  ShoppingCart,
  X,
  ChevronLeft,
  Camera,
  Zap,
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
  const [newItemCategory, setNewItemCategory] = useState('一般部品');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('個');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState(10);
  const [newItemLocation, setNewItemLocation] = useState('A-01');
  const [itemImage, setItemImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isBottomSheetOpen) {
      if (activeScannedItem) {
        setCurrentStep('MENU');
        setSelectedUnit(activeScannedItem.baseUnit || '個');
        setQuantity(1);
        setNote('');
      } else {
        // 未登録品目: 智能預設填入，消除現場繁瑣輸入
        setCurrentStep('NEW_ITEM');
        const cleanCode = activeScannedCode || '';
        const shortCode = cleanCode.length > 8 ? cleanCode.slice(-6) : cleanCode;
        setNewItemName(`新部品-${shortCode}`);
        setNewItemSpec('');
        setNewItemSupplier('');
        setItemImage(null);
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

  // 拍照 / 圖片上傳處理
  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setItemImage(base64);
    };
    reader.readAsDataURL(file);
  };

  // 一鍵極速登錄 (1-Click Fast Register)
  const handleFastRegister = async (customName?: string) => {
    if (!activeScannedCode) return;

    const nameToUse = customName || newItemName || `新部品-${activeScannedCode.slice(-6)}`;
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
      location: newItemLocation.trim() || 'A-01',
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
                {activeScannedItem ? activeScannedItem.name : '未登録品目の快速登録'}
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                {activeScannedItem ? activeScannedItem.code : activeScannedCode}
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
              <div className="bg-slate-950/90 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400">現在庫</span>
                  <div className="text-xl font-black text-emerald-400">
                    {activeScannedItem.currentStock}{' '}
                    <span className="text-xs text-slate-300">{activeScannedItem.baseUnit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400">棚番 / 廠商</span>
                  <div className="text-sm font-bold text-blue-400">
                    {activeScannedItem.location}{' '}
                    {activeScannedItem.supplier && (
                      <span className="text-xs text-slate-400 font-normal">
                        ({activeScannedItem.supplier})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. 入荷 */}
                <button
                  type="button"
                  onClick={() => handleSelectAction('IN')}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1.5 transition"
                >
                  <ArrowDownCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【入荷】</span>
                  <span className="text-[11px] opacity-80">在庫を増やす</span>
                </button>

                {/* 2. 払出 */}
                <button
                  type="button"
                  onClick={() => handleSelectAction('OUT')}
                  className="p-4 bg-rose-600 hover:bg-rose-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-rose-950/50 flex flex-col items-center justify-center gap-1.5 transition"
                >
                  <ArrowUpCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【払出】</span>
                  <span className="text-[11px] opacity-80">出庫・使用</span>
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
                  <span className="font-bold text-sm">【在庫確認】</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectAction('ORDER')}
                  className="p-3 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-300 border border-amber-500/40 rounded-2xl flex items-center justify-center gap-2 transition"
                >
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-sm">【発注依頼】</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Keypad Input */}
          {currentStep === 'KEYPAD' && activeScannedItem && (
            <div className="space-y-3">
              <div
                className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-between ${
                  selectedAction === 'IN'
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : selectedAction === 'OUT'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                    : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                }`}
              >
                <span>
                  選択中アクション:{' '}
                  {selectedAction === 'IN' ? '【入荷 (入庫)】' : selectedAction === 'OUT' ? '【払出 (出庫)】' : '【発注依頼】'}
                </span>
                <span className="opacity-80">現在庫: {activeScannedItem.currentStock} {activeScannedItem.baseUnit}</span>
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
                    ? `入荷確定 (+${quantity}${selectedUnit})`
                    : selectedAction === 'OUT'
                    ? `払出確定 (-${quantity}${selectedUnit})`
                    : `発注依頼登録 (${quantity}${selectedUnit})`
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

          {/* STEP 4: Smart Fast Registration (極速初次登錄) */}
          {currentStep === 'NEW_ITEM' && (
            <div className="space-y-4">
              {/* Fast 1-Click Action Bar */}
              <div className="bg-gradient-to-r from-blue-950 to-indigo-950 p-4 rounded-3xl border border-blue-500/40 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400 animate-bounce" />
                    <span className="font-extrabold text-sm text-white">現場極速初次登錄</span>
                  </div>
                  <span className="text-[11px] font-mono text-blue-300 bg-blue-900/60 px-2 py-0.5 rounded-lg">
                    {activeScannedCode}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  面倒な手入力をスキップ！写真を撮るか、このまま「1秒登録」ですぐに入荷作業を行えます。
                </p>

                {/* Photo Snap & Fast Add Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoCapture}
                    className="hidden"
                  />

                  {/* Photo Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition"
                  >
                    <Camera className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs sm:text-sm">
                      {itemImage ? '写真撮影済 ✓' : '📸 拍照附圖'}
                    </span>
                  </button>

                  {/* 1-Click Fast Register */}
                  <button
                    type="button"
                    onClick={() => handleFastRegister()}
                    className="py-3 px-3 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold rounded-2xl text-xs sm:text-sm shadow-lg shadow-blue-950 transition flex items-center justify-center gap-1.5"
                  >
                    <Zap className="w-4 h-4" />
                    <span>⚡ 1秒極速登錄</span>
                  </button>
                </div>

                {/* Image Preview Thumbnail */}
                {itemImage && (
                  <div className="relative w-full h-28 rounded-2xl overflow-hidden border border-slate-700 mt-2 bg-black">
                    <img src={itemImage} alt="Captured preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setItemImage(null)}
                      className="absolute top-1 right-1 p-1 bg-black/70 rounded-full text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Optional Quick Form Fields (修正・補足用) */}
              <div className="bg-slate-950/60 p-4 rounded-3xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-400 block">
                  📝 手動修正・補足（任意・後からPCでも編集可能）:
                </span>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">品名</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="例: 高圧エアーバルブ"
                    className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      廠商・サプライヤー
                    </label>
                    <input
                      type="text"
                      value={newItemSupplier}
                      onChange={(e) => setNewItemSupplier(e.target.value)}
                      placeholder="例: ミスミ, SMC..."
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">規格・型番</label>
                    <input
                      type="text"
                      value={newItemSpec}
                      onChange={(e) => setNewItemSpec(e.target.value)}
                      placeholder="例: M6×20mm"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">分類</label>
                    <select
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    >
                      <option value="一般部品">一般部品</option>
                      <option value="ボルト・締結部品">ボルト・締結</option>
                      <option value="配線・電気資材">配線・電気</option>
                      <option value="電子パーツ">電子パーツ</option>
                      <option value="空圧・配管部品">空圧・配管</option>
                      <option value="消耗品">消耗品</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">基準単位</label>
                    <input
                      type="text"
                      value={newItemBaseUnit}
                      onChange={(e) => setNewItemBaseUnit(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">安全在庫</label>
                    <input
                      type="number"
                      min="0"
                      value={newItemSafetyStock}
                      onChange={(e) => setNewItemSafetyStock(Number(e.target.value) || 0)}
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">棚番</label>
                    <input
                      type="text"
                      value={newItemLocation}
                      onChange={(e) => setNewItemLocation(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleFastRegister()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition"
                >
                  上記の内容で保存して入荷へ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
