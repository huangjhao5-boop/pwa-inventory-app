import React, { useState, useEffect } from 'react';
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
  Plus,
  Trash2,
} from 'lucide-react';

interface OutboundDraftItem {
  item: ItemMaster;
  quantity: number;
  selectedUnit: string;
  multiplier: number;
}

interface PcOutboundModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: ItemMaster | null;
  initialItems?: ItemMaster[];
}

export const PcOutboundModal: React.FC<PcOutboundModalProps> = ({
  isOpen,
  onClose,
  initialItem,
  initialItems = [],
}) => {
  const { items: allItems, settings, recordPcBatchOutbound, recordPcOutbound, addToast } = useInventory();

  // Multi-item cart state
  const [draftItems, setDraftItems] = useState<OutboundDraftItem[]>([]);
  const [addItemSelectId, setAddItemSelectId] = useState<string>('');

  const [operator, setOperator] = useState<string>(settings.activeOperator || 'M.K(TW)');
  const [destination, setDestination] = useState<string>('現場持出・盤配線');
  const [note, setNote] = useState<string>('');
  const [trackAsCheckedOut, setTrackAsCheckedOut] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize draft list
  useEffect(() => {
    if (initialItems && initialItems.length > 0) {
      setDraftItems(
        initialItems.map((item) => ({
          item,
          quantity: 1,
          selectedUnit: item.baseUnit,
          multiplier: 1,
        }))
      );
    } else if (initialItem) {
      setDraftItems([
        {
          item: initialItem,
          quantity: 1,
          selectedUnit: initialItem.baseUnit,
          multiplier: 1,
        },
      ]);
    } else if (allItems.length > 0) {
      setDraftItems([
        {
          item: allItems[0],
          quantity: 1,
          selectedUnit: allItems[0].baseUnit,
          multiplier: 1,
        },
      ]);
    }
  }, [initialItem, initialItems, allItems]);

  const handleUpdateItemQty = (index: number, qty: number) => {
    setDraftItems((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        copy[index].quantity = Math.max(1, qty);
      }
      return copy;
    });
  };

  const handleUpdateItemUnit = (index: number, unitName: string) => {
    setDraftItems((prev) => {
      const copy = [...prev];
      const target = copy[index];
      if (target) {
        target.selectedUnit = unitName;
        const conv = target.item.unitConversions?.find((c) => c.unit === unitName);
        target.multiplier = conv ? conv.multiplier : 1;
      }
      return copy;
    });
  };

  const handleRemoveDraftItem = (index: number) => {
    setDraftItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddMoreItem = () => {
    if (!addItemSelectId) return;
    const found = allItems.find((i) => i.id === addItemSelectId);
    if (!found) return;

    if (draftItems.some((d) => d.item.id === found.id)) {
      addToast('info', `「${found.name}」は既にリストに含まれています`);
      return;
    }

    setDraftItems((prev) => [
      ...prev,
      {
        item: found,
        quantity: 1,
        selectedUnit: found.baseUnit,
        multiplier: 1,
      },
    ]);
    setAddItemSelectId('');
  };

  // Validation
  const hasInsufficientStock = draftItems.some((d) => {
    const baseQty = Math.round(d.quantity * d.multiplier);
    return baseQty > d.item.currentStock;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (draftItems.length === 0) {
      addToast('error', '出庫する品目を 1 つ以上選択してください');
      return;
    }

    if (hasInsufficientStock) {
      addToast('error', '現在庫を超過している品目があります。数量を調整してください');
      return;
    }

    setIsSubmitting(true);
    try {
      if (draftItems.length === 1) {
        const single = draftItems[0];
        const ok = await recordPcOutbound({
          item: single.item,
          quantity: single.quantity,
          unit: single.selectedUnit,
          multiplier: single.multiplier,
          operator: operator.trim() || settings.activeOperator || '現場作業員',
          destination: destination.trim(),
          note: note.trim(),
          trackAsCheckedOut,
        });
        if (ok) onClose();
      } else {
        const ok = await recordPcBatchOutbound({
          items: draftItems.map((d) => ({
            item: d.item,
            quantity: d.quantity,
            unit: d.selectedUnit,
            multiplier: d.multiplier,
          })),
          operator: operator.trim() || settings.activeOperator || '現場作業員',
          destination: destination.trim(),
          note: note.trim(),
          trackAsCheckedOut,
        });
        if (ok) onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-rose-500/50 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-rose-950/40">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
              <ArrowUpCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white">
                📤 払出・現場持出登録 ({draftItems.length} 品目)
              </h3>
              <p className="text-xs text-slate-400">
                在庫から出庫し、現場持出台帳へ記録します（複数品目の一括持出対応）
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
          {/* Operator & Destination Top Bar */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-500"
                />
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-slate-500">選択:</span>
                  {['M.K(TW)', '現場作業員', '外注先'].map((op) => (
                    <button
                      key={op}
                      type="button"
                      onClick={() => setOperator(op)}
                      className="px-1.5 py-0.5 rounded-lg bg-slate-800 text-[10px] font-bold text-slate-300 hover:bg-slate-700 transition"
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination / Purpose */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>現場名・工事番号・用途：</span>
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="例: A棟制御盤配線, 外注現場持出"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs sm:text-sm font-semibold focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          {/* Items List to Check Out */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-rose-400" />
                <span>持出・払出対象の資材一覧：</span>
              </label>
              <span className="text-xs text-slate-400 font-mono">合計: {draftItems.length} 件</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {draftItems.map((draft, idx) => {
                const baseQty = Math.round(draft.quantity * draft.multiplier);
                const isInsufficient = baseQty > draft.item.currentStock;

                const unitOptions: UnitConversion[] = [{ unit: draft.item.baseUnit, multiplier: 1 }];
                if (draft.item.unitConversions) {
                  draft.item.unitConversions.forEach((c) => {
                    if (c.unit !== draft.item.baseUnit && !unitOptions.some((u) => u.unit === c.unit)) {
                      unitOptions.push(c);
                    }
                  });
                }

                return (
                  <div
                    key={`${draft.item.id}-${idx}`}
                    className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      isInsufficient
                        ? 'bg-rose-950/30 border-rose-500/60'
                        : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-sm text-white truncate">{draft.item.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs">
                        {draft.item.spec && (
                          <span className="text-amber-300 font-mono font-bold">{draft.item.spec}</span>
                        )}
                        <span className="text-slate-500">|</span>
                        <span className="text-indigo-300">📦 {draft.item.location}</span>
                        <span className="text-slate-500">|</span>
                        <span className="text-emerald-400 font-bold">
                          現在庫: {draft.item.currentStock} {draft.item.baseUnit}
                        </span>
                      </div>
                      {isInsufficient && (
                        <div className="text-rose-400 text-xs font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>在庫不足です（出庫: {baseQty}{draft.item.baseUnit} ＞ 在庫: {draft.item.currentStock}{draft.item.baseUnit}）</span>
                        </div>
                      )}
                    </div>

                    {/* Qty & Unit Input Controls */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(idx, draft.quantity - 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={draft.quantity}
                          onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 1)}
                          className="w-14 text-center py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-black text-sm focus:outline-none focus:border-rose-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateItemQty(idx, draft.quantity + 1)}
                          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-xs flex items-center justify-center"
                        >
                          ＋
                        </button>
                      </div>

                      <select
                        value={draft.selectedUnit}
                        onChange={(e) => handleUpdateItemUnit(idx, e.target.value)}
                        className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-rose-500 h-7"
                      >
                        {unitOptions.map((u) => (
                          <option key={u.unit} value={u.unit}>
                            {u.unit} {u.multiplier > 1 ? `(=${u.multiplier}${draft.item.baseUnit})` : ''}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleRemoveDraftItem(idx)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="リストから除外"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add More Items to Batch Outbound */}
            <div className="flex items-center gap-2 pt-1">
              <select
                value={addItemSelectId}
                onChange={(e) => setAddItemSelectId(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="">＋ 品目をリストに追加...</option>
                {allItems
                  .filter((i) => !draftItems.some((d) => d.item.id === i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} {i.spec ? `[${i.spec}]` : ''} (在庫: {i.currentStock} {i.baseUnit} / {i.location})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleAddMoreItem}
                disabled={!addItemSelectId}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>追加</span>
              </button>
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>共通備考メモ（任意）：</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例: 端子圧着工具・電工ナイフと一緒に持出"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Track as Checked-Out Checkbox */}
          <div
            className="bg-indigo-950/40 p-3 rounded-2xl border border-indigo-500/40 flex items-start gap-2.5 cursor-pointer"
            onClick={() => setTrackAsCheckedOut(!trackAsCheckedOut)}
          >
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
                作業終了後、持って帰ってきた余り（未開封包・開封端数）を「持出・返却管理」タブで正確に棚戻し・残量計算できます。
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
              disabled={isSubmitting || hasInsufficientStock || draftItems.length === 0}
              className="px-5 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-950 transition flex items-center gap-1.5"
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? '処理中...'
                  : draftItems.length > 1
                  ? `${draftItems.length} 件を一括払出・持出`
                  : '払出（出庫）を実行'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
