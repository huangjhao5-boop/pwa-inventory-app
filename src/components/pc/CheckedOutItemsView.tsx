import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CheckedOutItem, ReturnCondition, RETURN_FRACTION_PRESETS } from '../../types/inventory';
import { PcOutboundModal } from './PcOutboundModal';
import {
  Truck,
  Search,
  User,
  RotateCcw,
  Trash2,
  PackageCheck,
  PackageOpen,
  ArrowUpCircle,
  X,
  Calculator,
} from 'lucide-react';

export const CheckedOutItemsView: React.FC = () => {
  const {
    checkedOutList,
    items,
    returnCheckedOutItem,
    markCheckedOutAsConsumed,
    deleteCheckedOutRecord,
    addToast,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CHECKED_OUT' | 'RETURNED' | 'CONSUMED'>('CHECKED_OUT');

  // Modals
  const [isOutboundModalOpen, setIsOutboundModalOpen] = useState(false);
  const [returningItem, setReturningItem] = useState<CheckedOutItem | null>(null);

  // Return Form State (Multi-pack & fractional return)
  const [unopenedCount, setUnopenedCount] = useState<number>(0);
  const [openedCount, setOpenedCount] = useState<number>(0);
  const [returnPreset, setReturnPreset] = useState<ReturnCondition>('ONE_QUARTER_OR_LITTLE');
  const [customFraction, setCustomFraction] = useState<number>(0.25);
  const [returnNote, setReturnNote] = useState<string>('');

  // Extract unique operators from checked out list
  const uniqueOperators = useMemo(() => {
    const list = Array.from(new Set(checkedOutList.map((c) => c.operator).filter(Boolean)));
    return ['ALL', ...list];
  }, [checkedOutList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return checkedOutList.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        item.itemName.toLowerCase().includes(q) ||
        item.itemCode.toLowerCase().includes(q) ||
        (item.spec && item.spec.toLowerCase().includes(q)) ||
        item.operator.toLowerCase().includes(q) ||
        (item.destination && item.destination.toLowerCase().includes(q)) ||
        (item.returnNote && item.returnNote.toLowerCase().includes(q));

      const matchOperator = selectedOperator === 'ALL' || item.operator === selectedOperator;
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;

      return matchQuery && matchOperator && matchStatus;
    });
  }, [checkedOutList, searchQuery, selectedOperator, statusFilter]);

  // KPI Metrics
  const activeCheckedOutCount = checkedOutList.filter((c) => c.status === 'CHECKED_OUT').length;
  const returnedCount = checkedOutList.filter((c) => c.status === 'RETURNED').length;
  const consumedCount = checkedOutList.filter((c) => c.status === 'CONSUMED').length;

  // Open Return Modal with intelligent defaults
  const handleOpenReturnModal = (item: CheckedOutItem) => {
    setReturningItem(item);
    if (item.outQuantity > 1) {
      // e.g. took 3 packs -> default to 1 unopened + 1 opened (remainder 0.25)
      setUnopenedCount(Math.max(0, item.outQuantity - 2));
      setOpenedCount(1);
    } else {
      setUnopenedCount(0);
      setOpenedCount(1);
    }
    setReturnPreset('ONE_QUARTER_OR_LITTLE');
    setCustomFraction(0.25);
    setReturnNote('');
  };

  const handleSelectPreset = (key: ReturnCondition) => {
    setReturnPreset(key);
    const preset = RETURN_FRACTION_PRESETS.find((p) => p.key === key);
    if (preset && preset.fraction > 0) {
      setCustomFraction(preset.fraction);
    }
  };

  // Calculations for Return Modal
  const currentFractionValue = returnPreset === 'EXACT_COUNT' ? customFraction : (RETURN_FRACTION_PRESETS.find((p) => p.key === returnPreset)?.fraction ?? 0.25);
  const totalReturnedPacks = returningItem ? unopenedCount * 1.0 + (openedCount > 0 ? openedCount * currentFractionValue : 0) : 0;
  const totalReturnedBaseQty = returningItem ? Math.round(totalReturnedPacks * returningItem.multiplier) : 0;
  const consumedPacks = returningItem ? Math.max(0, returningItem.outQuantity - (unopenedCount + (openedCount > 0 ? openedCount : 0))) : 0;
  const consumedFractionalPacks = returningItem ? Math.max(0, returningItem.outQuantity - totalReturnedPacks) : 0;

  const originalTargetItem = returningItem ? items.find((i) => i.id === returningItem.itemId) : null;
  const stockBeforeReturn = originalTargetItem ? originalTargetItem.currentStock : 0;
  const stockAfterReturn = stockBeforeReturn + totalReturnedBaseQty;

  const handleConfirmReturn = async () => {
    if (!returningItem) return;

    if (unopenedCount + openedCount > returningItem.outQuantity) {
      addToast('error', `返却包数の合計 (${unopenedCount + openedCount}) が持出包数 (${returningItem.outQuantity}) を超えています`);
      return;
    }

    const ok = await returnCheckedOutItem(returningItem.id, {
      unopenedCount,
      openedCount,
      openedFraction: currentFractionValue,
      returnedPackEquivalent: totalReturnedPacks,
      returnedBaseQty: totalReturnedBaseQty,
      returnCondition: returnPreset,
      isOpenPackage: openedCount > 0 && currentFractionValue < 1.0,
      returnNote: returnNote.trim(),
    });

    if (ok) {
      setReturningItem(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-8">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl text-white flex items-center gap-2">
                <span>現場持出・未返却管理台帳 (Checked-Out & Returns)</span>
                {activeCheckedOutCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950 animate-pulse">
                    未返却 {activeCheckedOutCount} 件
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                現場に持ち出した資材の追跡・未開封/開封残量端数の正確な棚戻し計算
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => setIsOutboundModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-rose-950 transition active:scale-95"
        >
          <ArrowUpCircle className="w-4 h-4" />
          <span>＋ 新規持出（払出）を登録</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">現在持出中 (未整理)</span>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1">
            {activeCheckedOutCount} <span className="text-xs font-normal text-slate-400">件</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">返却・棚戻し完了</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
            {returnedCount} <span className="text-xs font-normal text-slate-400">件</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">現場で全消費 (残量無)</span>
          <div className="text-2xl sm:text-3xl font-black text-blue-400 mt-1">
            {consumedCount} <span className="text-xs font-normal text-slate-400">件</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">総持出レコード</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-200 mt-1">
            {checkedOutList.length} <span className="text-xs font-normal text-slate-400">件</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="品名・型番・作業員・現場名・備考で検索..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'CHECKED_OUT', label: `持出中 (${activeCheckedOutCount})` },
              { key: 'ALL', label: 'すべて' },
              { key: 'RETURNED', label: '返却済' },
              { key: 'CONSUMED', label: '現場消費' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key as any)}
                className={`py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  statusFilter === f.key
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Operator Filter Row */}
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold shrink-0 mr-1">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span>作業員で絞り込み:</span>
          </div>
          {uniqueOperators.map((op) => {
            const isSelected = selectedOperator === op;
            return (
              <button
                key={op}
                onClick={() => setSelectedOperator(op)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition border shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {op === 'ALL' ? '全員' : op}
              </button>
            );
          })}
        </div>
      </div>

      {/* Checked Out Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.length > 0 ? (
          filteredList.map((item) => {
            const isPendingReturn = item.status === 'CHECKED_OUT';
            const originalItem = items.find((i) => i.id === item.itemId);

            return (
              <div
                key={item.id}
                className={`rounded-3xl p-5 border shadow-xl flex flex-col justify-between space-y-4 transition ${
                  isPendingReturn
                    ? 'bg-gradient-to-br from-amber-950/20 to-slate-900 border-amber-500/50'
                    : item.status === 'RETURNED'
                    ? 'bg-slate-900/90 border-emerald-500/40'
                    : 'bg-slate-900/60 border-slate-800 opacity-80'
                }`}
              >
                {/* Top Info */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.itemName}
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-700 bg-black shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-500 shrink-0 font-bold">
                          無
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-black text-base text-white truncate">{item.itemName}</h4>
                        {item.spec && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-xs inline-block mt-0.5 truncate">
                            {item.spec}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    {isPendingReturn ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse shrink-0">
                        🚚 持出中
                      </span>
                    ) : item.status === 'RETURNED' ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                        ✅ 返却済
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 shrink-0">
                        現場全消費
                      </span>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="mt-3.5 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">持出数量：</span>
                      <strong className="text-rose-400 font-bold">
                        {item.outQuantity} {item.outUnit} ({item.outBaseQuantity} {originalItem?.baseUnit || '個'})
                      </strong>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">持出担当：</span>
                      <span className="font-bold text-blue-300 flex items-center gap-1">
                        <User className="w-3 h-3 text-blue-400" />
                        <span>{item.operator}</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">現場・用途：</span>
                      <span className="font-semibold text-slate-200 truncate max-w-[180px]">
                        {item.destination || '現場持出'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">戻し先保管箱：</span>
                      <span className="font-bold text-indigo-300 truncate max-w-[180px]">
                        📦 {item.location}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/60">
                      <span>持出日時:</span>
                      <span>{new Date(item.checkedOutAt).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    {/* Return Info if already returned */}
                    {item.status === 'RETURNED' && (
                      <div className="mt-2 pt-2 border-t border-emerald-500/30 bg-emerald-950/20 p-2.5 rounded-xl text-emerald-300 space-y-1.5">
                        <div className="flex items-center justify-between font-black text-xs">
                          <span>棚戻し内訳：</span>
                          <span className="text-emerald-400">
                            +{item.returnedPackEquivalent ?? item.outQuantity} {item.outUnit} (+{item.returnedBaseQuantity} {originalItem?.baseUnit})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 flex items-center justify-between">
                          <span>未開封: {item.unopenedReturnedCount ?? 0} {item.outUnit}</span>
                          <span>開封残: {item.openedReturnedCount ?? 0} {item.outUnit} (残率:{Math.round((item.openedRemainingFraction ?? 1) * 100)}%)</span>
                        </div>
                        {item.isPackageOpened && (
                          <span className="inline-block px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[10px] font-black">
                            📦 開封品あり（端数残）
                          </span>
                        )}
                        {item.returnNote && (
                          <div className="text-[11px] text-slate-300">メモ: {item.returnNote}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-800/80">
                  {isPendingReturn ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal(item)}
                        className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>現場から返却・棚戻し</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => markCheckedOutAsConsumed(item.id)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                        title="現場で全量使用完了（余りなし）"
                      >
                        全消費
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>整理完了</span>
                      <button
                        type="button"
                        onClick={() => deleteCheckedOutRecord(item.id)}
                        className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="記録を削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/50 rounded-3xl border border-slate-800 space-y-2">
            <PackageCheck className="w-10 h-10 mx-auto text-slate-600" />
            <p className="font-bold text-sm text-slate-400">現在、未返却・持出中の資材はありません</p>
            <p className="text-xs text-slate-500">現場作業から戻ってきた資材は、この画面から残量整理・棚戻しできます</p>
          </div>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 📦 現場返却・残量端数棚戻しモーダル (Precision Return Modal) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {returningItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-emerald-950/40">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white">
                    📦 現場持出資材の返却・棚戻し
                  </h3>
                  <p className="text-xs text-slate-400">
                    未開封包数と開封品（残量少許など）を正確に計算して在庫に戻します
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReturningItem(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Item Summary Card */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                <div className="font-black text-sm text-white">{returningItem.itemName}</div>
                <div className="text-amber-300 font-mono">規格: {returningItem.spec || '-'}</div>
                <div className="text-slate-400">
                  持出時: <strong className="text-rose-400">{returningItem.outQuantity} {returningItem.outUnit} ({returningItem.outBaseQuantity} {originalTargetItem?.baseUnit || '個'})</strong> | 担当: <span className="text-blue-300">{returningItem.operator}</span>
                </div>
                <div className="text-slate-300">
                  戻し先保管箱: <strong className="text-indigo-300">📦 {returningItem.location}</strong>
                </div>
              </div>

              {/* Step 1 & 2: Multi-pack Breakdown Inputs */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                <div className="text-xs font-extrabold text-slate-200 flex items-center justify-between">
                  <span>持ち帰った包数（{returningItem.outUnit}）の内訳を入力：</span>
                  <span className="text-slate-400">持出計: {returningItem.outQuantity} {returningItem.outUnit}</span>
                </div>

                {/* Unopened Count */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-emerald-300 block">🟢 完全未開封で返却：</span>
                    <span className="text-[10px] text-slate-400">手をつけていない新品パック</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setUnopenedCount(Math.max(0, unopenedCount - 1))}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center hover:bg-slate-700"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={returningItem.outQuantity}
                      value={unopenedCount}
                      onChange={(e) => setUnopenedCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 text-center py-1 bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 font-black text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setUnopenedCount(Math.min(returningItem.outQuantity - openedCount, unopenedCount + 1))}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center hover:bg-slate-700"
                    >
                      ＋
                    </button>
                    <span className="text-xs text-slate-400 font-bold ml-1">{returningItem.outUnit}</span>
                  </div>
                </div>

                {/* Opened Count */}
                <div className="flex items-center justify-between bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">📦 開封・使いかけで返却：</span>
                    <span className="text-[10px] text-slate-400">袋を開封し一部使用したパック</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setOpenedCount(Math.max(0, openedCount - 1))}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center hover:bg-slate-700"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={returningItem.outQuantity - unopenedCount}
                      value={openedCount}
                      onChange={(e) => setOpenedCount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-14 text-center py-1 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-black text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setOpenedCount(Math.min(returningItem.outQuantity - unopenedCount, openedCount + 1))}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-white font-black text-xs flex items-center justify-center hover:bg-slate-700"
                    >
                      ＋
                    </button>
                    <span className="text-xs text-slate-400 font-bold ml-1">{returningItem.outUnit}</span>
                  </div>
                </div>

                {/* Consumed on site preview */}
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/80">
                  <span>現場で完全使い切り（消費）:</span>
                  <strong className="text-rose-400 font-bold">{consumedPacks} {returningItem.outUnit}</strong>
                </div>
              </div>

              {/* Step 3: Fraction Selector for Opened Pack */}
              {openedCount > 0 && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-amber-500/40 space-y-2.5 animate-in fade-in">
                  <label className="block text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <PackageOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>開封品（{openedCount} {returningItem.outUnit}）の残量を選択してください：</span>
                  </label>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {RETURN_FRACTION_PRESETS.map((preset) => {
                      const isSelected = returnPreset === preset.key;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => handleSelectPreset(preset.key)}
                          className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-400 text-white shadow'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          <span className="font-extrabold text-xs block">{preset.label}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{preset.description}</span>
                        </button>
                      );
                    })}
                  </div>

                  {returnPreset === 'EXACT_COUNT' && (
                    <div className="pt-2 flex items-center justify-between bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs">
                      <span className="text-slate-300 font-bold">残量係数 (0.01〜0.99):</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0.01"
                        max="0.99"
                        value={customFraction}
                        onChange={(e) => setCustomFraction(Math.max(0.01, Math.min(0.99, parseFloat(e.target.value) || 0.25)))}
                        className="w-20 text-center py-1 bg-slate-950 border border-amber-500/60 rounded-lg text-amber-300 font-black text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Crystal-Clear Calculation Summary Box */}
              <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-emerald-950/40 p-4 rounded-2xl border border-indigo-500/50 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-indigo-200">
                  <Calculator className="w-4 h-4 text-indigo-400" />
                  <span>📐 リアルタイム在庫計算明細 (結論)</span>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>現場持出数量：</span>
                    <strong className="text-rose-400">{returningItem.outQuantity}.00 {returningItem.outUnit}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>現場実質消費量：</span>
                    <span className="text-slate-400">−{consumedFractionalPacks.toFixed(2)} {returningItem.outUnit}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-300 font-black pt-1 border-t border-slate-800">
                    <span>今回棚戻し（入庫）：</span>
                    <span className="text-sm text-emerald-400">
                      +{totalReturnedPacks.toFixed(2)} {returningItem.outUnit} (+{totalReturnedBaseQty} {originalTargetItem?.baseUnit || '個'})
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/40 rounded-xl text-xs text-emerald-200 flex items-center justify-between font-bold">
                  <span>在庫への反映結果：</span>
                  <span className="font-mono text-sm">
                    {stockBeforeReturn} ➔ <strong className="text-emerald-400 font-black text-base">{stockAfterReturn}</strong> {originalTargetItem?.baseUnit}
                  </span>
                </div>
              </div>

              {/* Memo Note */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">返却メモ（任意）：</label>
                <input
                  type="text"
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="例: 未開封1袋 + 開封品1袋(約25%残)を棚戻し"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReturningItem(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReturn}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950 transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>この内容で棚戻し（+{totalReturnedPacks.toFixed(2)} {returningItem.outUnit}）</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pc Outbound Modal */}
      {isOutboundModalOpen && (
        <PcOutboundModal
          isOpen={isOutboundModalOpen}
          onClose={() => setIsOutboundModalOpen(false)}
        />
      )}
    </div>
  );
};
