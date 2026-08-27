import React from 'react';
import { ItemMaster } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import {
  MapPin,
  AlertTriangle,
  QrCode,
  Clock,
  Layers,
} from 'lucide-react';

interface StockInquiryCardProps {
  item: ItemMaster;
}

export const StockInquiryCard: React.FC<StockInquiryCardProps> = ({ item }) => {
  const { openQRGenerator } = useInventory();
  const isLowStock = item.currentStock <= item.safetyStock;

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
            <p className="text-xs text-slate-300 mt-0.5 font-medium">{item.spec}</p>
          )}
        </div>

        {/* Location Tag */}
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1 px-3 py-1.5 bg-blue-950/80 border border-blue-800/80 text-blue-300 rounded-xl text-xs font-bold shadow">
            <MapPin className="w-3.5 h-3.5 text-blue-400" />
            <span>{item.location || '未割当'}</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">棚番</span>
        </div>
      </div>

      {/* Stock Level Display */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between ${
          isLowStock
            ? 'bg-amber-950/40 border-amber-500/50 shadow-inner'
            : 'bg-slate-950/80 border-slate-800'
        }`}
      >
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
            安全在庫: <strong className="text-slate-200">{item.safetyStock}</strong> {item.baseUnit}
          </div>
          {isLowStock && (
            <div className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>発注推奨 (不足: {Math.max(0, item.safetyStock - item.currentStock)} {item.baseUnit})</span>
            </div>
          )}
        </div>
      </div>

      {/* Unit Conversion Multipliers */}
      {item.unitConversions && item.unitConversions.length > 0 && (
        <div className="bg-slate-950/50 rounded-2xl p-3 border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-2">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>包裝単位換算</span>
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
          <span>QR ラベル発行</span>
        </button>
      </div>
    </div>
  );
};
