import React, { useState, useEffect, useMemo } from 'react';
import { ItemMaster, UnitConversion } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import {
  X,
  ArrowUpCircle,
  Package,
  User,
  MapPin,
  FileText,
  AlertTriangle,
  Truck,
} from 'lucide-react';

interface PcOutboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: ItemMaster | null;
}

export const PcOutboundModal: React.FC<PcOutboundModalProps> = ({
  isOpen,
  onClose,
  initialItem,
}) => {
  const { items, settings, recordPcOutbound, addToast } = useInventory();

  const [selectedItemId, setSelectedItemId] = useState<string>(initialItem?.id || items[0]?.id || '');
  const [selectedItem, setSelectedItem] = useState<ItemMaster | null>(initialItem || items[0] || null);

  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<string>(initialItem?.baseUnit || '個');
  const [multiplier, setMultiplier] = useState<number>(1);

  const [operator, setOperator] = useState<string>(settings.activeOperator || 'M.K(TW)');
  const [destination, setDestination] = useState<string>('現場持出・盤配線');
  const [note, setNote] = useState<string>('');
  const [trackAsCheckedOut, setTrackAsCheckedOut] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // When initialItem changes or selectedItemId changes
  useEffect(() => {
    if (initialItem) {
      setSelectedItemId(initialItem.id);
      setSelectedItem(initialItem);
      setSelectedUnit(initialItem.baseUnit);
      setMultiplier(1);
    } else if (selectedItemId) {
      const found = items.find((i) => i.id === selectedItemId);
      if (found) {
        setSelectedItem(found);
        setSelectedUnit(found.baseUnit);
        setMultiplier(1);
      }
    }
  }, [initialItem, selectedItemId, items]);

  // Unit Options combining baseUnit and unitConversions
  const unitOptions = useMemo(() => {
    if (!selectedItem) return [{ unit: '個', multiplier: 1 }];
    const list: UnitConversion[] = [{ unit: selectedItem.baseUnit, multiplier: 1 }];
    if (selectedItem.unitConversions) {
      selectedItem.unitConversions.forEach((c) => {
        if (c.unit !== selectedItem.baseUnit && !list.some((l) => l.unit === c.unit)) {
          list.push(c);
        }
      });
    }
    return list;
  }, [selectedItem]);

  const handleUnitChange = (unitName: string) => {
    setSelectedUnit(unitName);
    const found = unitOptions.find((u) => u.unit === unitName);
    setMultiplier(found ? found.multiplier : 1);
  };

  const calculatedBaseQty = Math.round(quantity * multiplier);
  const isStockInsufficient = selectedItem ? calculatedBaseQty > selectedItem.currentStock : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) {
      addToast('error', '品目を選択してください');
      return;
    }
    if (quantity <= 0) {
      addToast('error', '出庫数量は 1 以上を指定してください');
      return;
    }
    if (isStockInsufficient) {
      addToast('error', `現在庫 (${selectedItem.currentStock}${selectedItem.baseUnit}) を超える数量は出庫できません`);
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await recordPcOutbound({
        item: selectedItem,
        quantity,
        unit: selectedUnit,
        multiplier,
        operator: operator.trim() || settings.activeOperator || '現場作業員',
        destination: destination.trim(),
        note: note.trim(),
        trackAsCheckedOut,
      });

      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/50 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-rose-950/40">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <ArrowUpCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                📤 払出・現場持出登録 (Outbound)
              </h3>
              <p className="text-xs text-slate-400">
                在庫から出庫し、現場持出台帳へ記録します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Target Item Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-rose-400" />
              <span>出庫対象の品目：</span>
            </label>
            {!initialItem ? (
              <select
                value={selectedItemId}
                onChange={(e) => setSelectedItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-rose-500"
              >
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} {i.spec ? `[${i.spec}]` : ''} (現在庫: {i.currentStock} {i.baseUnit} / {i.location})
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-black text-sm text-white">{selectedItem?.name}</div>
                  <div className="text-xs text-amber-300 font-mono mt-0.5">規格: {selectedItem?.spec || '-'}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    保管場所: <span className="text-blue-300">{selectedItem?.location}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">現在庫</span>
                  <span className="text-lg font-black text-emerald-400">
                    {selectedItem?.currentStock} <span className="text-xs font-normal">{selectedItem?.baseUnit}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quantity & Unit Selection */}
          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">出庫数量：</label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-center py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-black text-base focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center transition"
                  >
                    ＋
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">出庫単位：</label>
                <select
                  value={selectedUnit}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-rose-500 h-[38px]"
                >
                  {unitOptions.map((u) => (
                    <option key={u.unit} value={u.unit}>
                      {u.unit} {u.multiplier > 1 ? `(= ${u.multiplier} ${selectedItem?.baseUnit})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Quantity Chips */}
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 font-bold">数量クイック:</span>
              {[1, 2, 5, 10, 20].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setQuantity(num)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-bold transition border ${
                    quantity === num
                      ? 'bg-rose-600 border-rose-400 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  +{num}
                </button>
              ))}
            </div>

            {/* Calculated Conversion Summary */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-400">換算出庫量（基準数量）：</span>
              <span className={`font-black text-sm ${isStockInsufficient ? 'text-rose-400 animate-pulse' : 'text-amber-300'}`}>
                {calculatedBaseQty} {selectedItem?.baseUnit}
              </span>
            </div>

            {isStockInsufficient && (
              <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>在庫不足です（現在庫: {selectedItem?.currentStock}{selectedItem?.baseUnit}）</span>
              </div>
            )}
          </div>

          {/* Operator Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-400" />
              <span>持出担当者（作業員）：</span>
            </label>
            <input
              type="text"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="例: M.K(TW), 田中"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-500"
            />
            {/* Operator Chips */}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[11px] text-slate-500">選択:</span>
              {['M.K(TW)', '現場作業員', '外注先'].map((op) => (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOperator(op)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 hover:bg-slate-700 transition"
                >
                  {op}
                </button>
              ))}
            </div>
          </div>

          {/* Destination / Purpose Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>現場名・工事番号・用途：</span>
            </label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="例: A棟制御盤配線, 外注現場持出, 試作組込"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>備考メモ（任意）：</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 端子圧着工具と一緒に持出"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Track as Checked-Out Checkbox */}
          <div className="bg-indigo-950/40 p-3 rounded-2xl border border-indigo-500/40 flex items-start gap-2.5 cursor-pointer" onClick={() => setTrackAsCheckedOut(!trackAsCheckedOut)}>
            <input
              type="checkbox"
              checked={trackAsCheckedOut}
              onChange={(e) => setTrackAsCheckedOut(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-extrabold text-indigo-200 block flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-indigo-400" />
                <span>現場持出台帳として追跡する (おすすめ)</span>
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                作業終了後、持って帰ってきた余り（開封済み・端数など）を「持出・返却管理」タブから簡単に棚戻しできます。
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isStockInsufficient}
              className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-950 transition flex items-center gap-1.5"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>{isSubmitting ? '処理中...' : '払出（出庫）を実行'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
