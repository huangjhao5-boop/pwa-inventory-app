import React, { useState } from 'react';
import { ItemMaster } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import {
  Box,
  AlertTriangle,
  QrCode,
  Clock,
  Layers,
  Building2,
  Edit3,
  Check,
  Plus,
  Minus,
} from 'lucide-react';

interface StockInquiryCardProps {
  item: ItemMaster;
}

export const StockInquiryCard: React.FC<StockInquiryCardProps> = ({ item }) => {
  const { openQRGenerator, saveItem, recordTransaction, addToast } = useInventory();
  const isLowStock = item.currentStock <= item.safetyStock;

  const [isEditingStock, setIsEditingStock] = useState(false);
  const [manualStockVal, setManualStockVal] = useState<number>(item.currentStock);

  const handleSaveStockAdjustment = async () => {
    const targetStock = Math.max(0, Number(manualStockVal) || 0);
    const diff = targetStock - item.currentStock;

    if (diff === 0) {
      setIsEditingStock(false);
      return;
    }

    const updatedItem: ItemMaster = {
      ...item,
      currentStock: targetStock,
      updatedAt: new Date().toISOString(),
    };

    await saveItem(updatedItem);

    // 調整ログを記録
    if (diff > 0) {
      await recordTransaction(item, 'IN', diff, item.baseUnit, 1, '手動棚卸・実在庫修正', false);
    } else {
      await recordTransaction(item, 'OUT', Math.abs(diff), item.baseUnit, 1, '手動棚卸・実在庫修正', false);
    }

    addToast('success', `在庫数を ${item.currentStock} ➔ ${targetStock} ${item.baseUnit} に直接修正しました！`);
    setIsEditingStock(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header Info */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-blue-400 border border-slate-700">
              {item.category || '一般部品'}
            </span>
            <span className="text-xs text-slate-400 font-mono truncate">{item.code}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white leading-tight">
            {item.name}
          </h3>
          {item.spec && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black font-mono">
                規格: {item.spec}
              </span>
            </div>
          )}
          {item.supplier && (
            <p className="text-xs text-blue-300 mt-1 font-bold flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>メーカー: {item.supplier}</span>
            </p>
          )}
        </div>

        {/* Box Name Tag & Image */}
        <div className="flex flex-col items-end shrink-0 gap-1.5">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-950/80 border border-blue-800/80 text-blue-300 rounded-xl text-xs font-black shadow">
            <Box className="w-3.5 h-3.5 text-blue-400" />
            <span>{item.location || '未指定'}</span>
          </div>
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.name}
              className="w-12 h-12 object-cover rounded-xl border border-slate-700 shadow"
            />
          )}
        </div>
      </div>

      {/* Stock Level Display & Direct Adjustment */}
      <div
        className={`p-4 rounded-2xl border flex flex-col gap-3 ${
          isLowStock
            ? 'bg-amber-950/40 border-amber-500/50 shadow-inner'
            : 'bg-slate-950/80 border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block">現在庫数</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span
                className={`text-3xl sm:text-4xl font-black tracking-tight ${
                  isLowStock ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {item.currentStock}
              </span>
              <span className="text-sm font-bold text-slate-300">{item.baseUnit}</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400">
              安全在庫数: <strong className="text-slate-200">{item.safetyStock}</strong> {item.baseUnit}
            </div>
            {isLowStock && (
              <div className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>要発注 (不足: {Math.max(0, item.safetyStock - item.currentStock)} {item.baseUnit})</span>
              </div>
            )}
          </div>
        </div>

        {/* Direct Inventory Adjustment Toggle */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setManualStockVal(item.currentStock);
              setIsEditingStock(!isEditingStock);
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 py-1 transition"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>{isEditingStock ? '調整を閉じる' : '✏️ 実在庫数を直接手動修正 (棚卸・0修正)'}</span>
          </button>
        </div>

        {/* Manual Stock Edit Form */}
        {isEditingStock && (
          <div className="p-3 bg-slate-900 border border-slate-700 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">実在庫の直接指定:</span>
              <span className="text-[11px] text-amber-400 font-semibold">
                差分: {manualStockVal - item.currentStock >= 0 ? `+${manualStockVal - item.currentStock}` : manualStockVal - item.currentStock} {item.baseUnit}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setManualStockVal(Math.max(0, manualStockVal - 1))}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-lg active:scale-95 transition"
              >
                <Minus className="w-4 h-4" />
              </button>

              <input
                type="number"
                min="0"
                value={manualStockVal}
                onChange={(e) => setManualStockVal(Math.max(0, Number(e.target.value) || 0))}
                className="flex-1 py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-white text-lg font-black font-mono focus:outline-none focus:border-blue-500"
                autoFocus
              />

              <button
                type="button"
                onClick={() => setManualStockVal(manualStockVal + 1)}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-lg active:scale-95 transition"
              >
                <Plus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleSaveStockAdjustment}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-lg shadow-emerald-950 active:scale-95 transition shrink-0"
              >
                <Check className="w-4 h-4" />
                <span>確定保存</span>
              </button>
            </div>

            {/* Quick Increment Shortcuts */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-500">クイック指定:</span>
              {[0, 1, 5, 10, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setManualStockVal(n)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono font-bold border border-slate-700"
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Unit Conversion Multipliers */}
      {item.unitConversions && item.unitConversions.length > 0 && (
        <div className="bg-slate-950/50 rounded-2xl p-3 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>包装単位・換算倍率</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.unitConversions.map((conv) => (
              <div
                key={conv.unit}
                className="px-2.5 py-1 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200"
              >
                1 {conv.unit} = <strong className="text-blue-400">{conv.multiplier}</strong> {item.baseUnit}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR Code Action */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          更新: {new Date(item.updatedAt).toLocaleDateString('ja-JP')}
        </span>
        <button
          onClick={() => openQRGenerator(item)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <QrCode className="w-3.5 h-3.5 text-blue-400" />
          <span>QRコードを表示</span>
        </button>
      </div>
    </div>
  );
};
