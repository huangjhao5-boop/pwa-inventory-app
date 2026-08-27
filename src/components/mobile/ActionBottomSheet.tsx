import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ActionType, ItemMaster } from '../../types/inventory';
import { NumericKeypad } from './NumericKeypad';
import { StockInquiryCard } from './StockInquiryCard';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  ShoppingCart,
  PlusCircle,
  X,
  ChevronLeft,
  AlertTriangle,
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
  const [newItemCategory, setNewItemCategory] = useState('一般部品');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState('個');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState(10);
  const [newItemLocation, setNewItemLocation] = useState('A-01');

  useEffect(() => {
    if (isBottomSheetOpen) {
      if (activeScannedItem) {
        setCurrentStep('MENU');
        setSelectedUnit(activeScannedItem.baseUnit || '個');
        setQuantity(1);
        setNote('');
      } else {
        // 未登録品目
        setCurrentStep('NEW_ITEM');
        setNewItemName('');
        setNewItemSpec('');
      }
    }
  }, [isBottomSheetOpen, activeScannedItem]);

  if (!isBottomSheetOpen) return null;

  const handleSelectAction = (action: ActionType) => {
    setSelectedAction(action);
    if (action === 'AUDIT') {
      setCurrentStep('INQUIRY');
    } else if (action === 'ORDER') {
      // 発注推奨数量（安全在庫 - 現在庫）
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

  const handleCreateNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !activeScannedCode) return;

    const newItem: ItemMaster = {
      id: `item-${Date.now()}`,
      code: activeScannedCode,
      name: newItemName.trim(),
      spec: newItemSpec.trim(),
      category: newItemCategory,
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
    // 自動的に入荷モードへ遷移
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
                {activeScannedItem ? activeScannedItem.name : '未登録品目の新規追加'}
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
                  <span className="text-[11px] text-slate-400">棚番</span>
                  <div className="text-sm font-bold text-blue-400">{activeScannedItem.location}</div>
                </div>
              </div>

              {/* Action Buttons (Large Touch targets) */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. 入荷 (Stock In) */}
                <button
                  type="button"
                  onClick={() => handleSelectAction('IN')}
                  className="p-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-2xl shadow-lg shadow-emerald-950/50 flex flex-col items-center justify-center gap-1.5 transition"
                >
                  <ArrowDownCircle className="w-8 h-8 stroke-[2.5]" />
                  <span className="text-lg font-black tracking-wide">【入荷】</span>
                  <span className="text-[11px] opacity-80">在庫を増やす</span>
                </button>

                {/* 2. 払出 (Stock Out) */}
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
                {/* 3. 在庫確認 */}
                <button
                  type="button"
                  onClick={() => setCurrentStep('INQUIRY')}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-100 rounded-2xl border border-slate-700 flex items-center justify-center gap-2 transition"
                >
                  <Search className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-sm">【在庫確認】</span>
                </button>

                {/* 4. 発注依頼 */}
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
              {/* Action Banner */}
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

              {/* Glove-friendly Numeric Keypad */}
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

          {/* STEP 4: New Item Registration */}
          {currentStep === 'NEW_ITEM' && (
            <form onSubmit={handleCreateNewItem} className="space-y-3.5">
              <div className="bg-amber-950/40 p-3 rounded-2xl border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  スキャンされたコード <strong>{activeScannedCode}</strong> は主檔に未登録です。品名を入力して即時登録できます。
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  品名 (必須)
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="例: 高圧エアーバルブ"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">規格・型番</label>
                  <input
                    type="text"
                    value={newItemSpec}
                    onChange={(e) => setNewItemSpec(e.target.value)}
                    placeholder="例: HV-02-G1/4"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">分類</label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="ボルト・締結部品">ボルト・締結部品</option>
                    <option value="配線・電気資材">配線・電気資材</option>
                    <option value="電子パーツ">電子パーツ</option>
                    <option value="空圧・配管部品">空圧・配管部品</option>
                    <option value="シール・パッキン">シール・パッキン</option>
                    <option value="工具・消耗品">工具・消耗品</option>
                    <option value="一般部品">一般部品</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">基準単位</label>
                  <input
                    type="text"
                    value={newItemBaseUnit}
                    onChange={(e) => setNewItemBaseUnit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">安全在庫</label>
                  <input
                    type="number"
                    value={newItemSafetyStock}
                    onChange={(e) => setNewItemSafetyStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">保管棚番</label>
                  <input
                    type="text"
                    value={newItemLocation}
                    onChange={(e) => setNewItemLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base rounded-2xl shadow-lg transition flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                <span>品目を登録して入荷作業へ</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
