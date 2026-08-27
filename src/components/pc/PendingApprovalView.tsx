import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { PendingInbound } from '../../types/inventory';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Building2,
  Box,
  User,
  Clock,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

export const PendingApprovalView: React.FC = () => {
  const {
    pendingInbounds,
    approvePendingInbound,
    batchApprovePendingInbounds,
    rejectPendingInbound,
  } = useInventory();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const pendingList = pendingInbounds.filter((p) => p.status === 'PENDING');

  const toggleSelectAll = () => {
    if (selectedIds.length === pendingList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingList.map((p) => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleApproveOne = async (pending: PendingInbound) => {
    await approvePendingInbound(pending);
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    const toApprove = pendingList.filter((p) => selectedIds.includes(p.id));
    await batchApprovePendingInbounds(toApprove);
    setSelectedIds([]);
  };

  const handleRejectOne = async (id: string) => {
    if (window.confirm('この入荷申請を却下しますか？')) {
      await rejectPendingInbound(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-2xl">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-black text-lg sm:text-xl text-white flex items-center gap-2">
              <span>📥 入荷承認待ちリスト (Pending Inbound Approval)</span>
              {pendingList.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-slate-950">
                  {pendingList.length} 件 承認待ち
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              現場スマホでスキャン登録された入荷データです。品名・数量・ボックス名を確認し「正式承認」すると在庫に反映されます。
            </p>
          </div>
        </div>

        {/* Batch Actions */}
        {pendingList.length > 0 && (
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={toggleSelectAll}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              {selectedIds.length === pendingList.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-blue-400" />
                  <span>全選択解除</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-slate-400" />
                  <span>すべて選択 ({pendingList.length})</span>
                </>
              )}
            </button>

            <button
              onClick={handleBatchApprove}
              disabled={selectedIds.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>選択項目を一括承認 ({selectedIds.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* Main List */}
      {pendingList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-500">
            <Sparkles className="w-7 h-7 text-emerald-400" />
          </div>
          <h3 className="font-bold text-base text-slate-200">
            現在、承認待ちの入荷データはありません
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            現場端末で「一時保存・承認待ち」で入荷スキャンされると、ここに即座にリアルタイム表示されます。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingList.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            return (
              <div
                key={item.id}
                className={`bg-slate-900 border rounded-3xl p-4 sm:p-5 shadow-lg transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  isSelected
                    ? 'border-indigo-500/80 bg-slate-900/90 ring-1 ring-indigo-500/40'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Left: Checkbox + Photo + Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelectOne(item.id)}
                    className="mt-1 text-slate-400 hover:text-white transition"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-indigo-400 fill-indigo-950" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-500" />
                    )}
                  </button>

                  {/* Photo thumbnail */}
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.itemName}
                      className="w-14 h-14 object-cover rounded-2xl border border-slate-700 shrink-0 bg-black"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                      <Box className="w-6 h-6 text-slate-600" />
                    </div>
                  )}

                  {/* Item info */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800">
                        {item.itemCode}
                      </span>
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1">
                        <Box className="w-3 h-3" />
                        <span>{item.location || '未設定'}</span>
                      </span>
                      {item.supplier && (
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span>{item.supplier}</span>
                        </span>
                      )}
                    </div>

                    <h4 className="font-black text-base text-white truncate">
                      {item.itemName}
                    </h4>

                    {item.spec && (
                      <p className="text-xs text-slate-400">{item.spec}</p>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-blue-400" />
                        <span>担当: {item.operator}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.scannedAt).toLocaleTimeString('ja-JP')}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Quantity + Action Buttons */}
                <div className="flex items-center justify-between md:justify-end gap-4 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-semibold block">申請入荷数量</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-emerald-400">
                        +{item.quantity}
                      </span>
                      <span className="text-xs text-slate-300 font-bold">{item.unit}</span>
                      {item.multiplier > 1 && (
                        <span className="text-[11px] text-slate-400 ml-1">
                          (= {item.baseQuantity} 基準単位)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Reject */}
                    <button
                      type="button"
                      onClick={() => handleRejectOne(item.id)}
                      className="p-2.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-xl border border-slate-800 transition"
                      title="申請を却下"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>

                    {/* Approve One */}
                    <button
                      type="button"
                      onClick={() => handleApproveOne(item)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      <span>正式承認・入庫</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
