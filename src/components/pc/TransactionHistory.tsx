import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CsvHelper } from '../../utils/csvHelper';
import {
  History,
  Search,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  Download,
  User,
  Calendar,
  Trash2,
} from 'lucide-react';

export const TransactionHistory: React.FC = () => {
  const { logs, addToast, clearOldLogs } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  // Year & Month Filters
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(logs.map((l) => new Date(l.timestamp).getFullYear()))).filter(Boolean);
    if (years.length === 0) years.push(new Date().getFullYear());
    return years.sort((a, b) => b - a);
  }, [logs]);

  const [selectedYear, setSelectedYear] = useState<string>(
    availableYears[0] ? availableYears[0].toString() : 'ALL'
  );
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    const d = new Date(log.timestamp);
    const logYear = d.getFullYear().toString();
    const logMonth = (d.getMonth() + 1).toString();

    if (selectedYear !== 'ALL' && logYear !== selectedYear) return false;
    if (selectedMonth !== 'ALL' && logMonth !== selectedMonth) return false;

    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      log.itemCode.toLowerCase().includes(q) ||
      log.itemName.toLowerCase().includes(q) ||
      log.operator.toLowerCase().includes(q) ||
      (log.note && log.note.toLowerCase().includes(q));

    const matchAction = filterAction === 'ALL' || log.type === filterAction;
    return matchQuery && matchAction;
  });

  // Summary Metrics for currently filtered logs
  const totalInCount = filteredLogs
    .filter((l) => l.type === 'IN')
    .reduce((acc, curr) => acc + curr.baseQuantity, 0);

  const totalOutCount = filteredLogs
    .filter((l) => l.type === 'OUT')
    .reduce((acc, curr) => acc + curr.baseQuantity, 0);

  const handleExportLogsCsv = () => {
    const headers = [
      'ログID',
      '日時',
      '操作区分',
      '品号',
      '品名',
      '増減量(Delta)',
      '入力数量',
      '入力単位',
      '換算倍率',
      '基準数量',
      '担当作業員',
      '同期状態',
      '備考',
    ];

    const rows = logs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.type}"`,
      `"${l.itemCode}"`,
      `"${l.itemName}"`,
      l.delta,
      l.quantity,
      `"${l.unit}"`,
      l.multiplier,
      l.baseQuantity,
      `"${l.operator}"`,
      l.synced ? '"同期済"' : '"未同期"',
      `"${l.note || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const periodLabel = `${selectedYear === 'ALL' ? '全期間' : `${selectedYear}年`}${selectedMonth === 'ALL' ? '' : `${selectedMonth}月`}`;
    CsvHelper.downloadCsv(csvContent, `inventory_logs_${periodLabel}_${new Date().toISOString().slice(0, 10)}.csv`);
    addToast('success', `入出庫履歴ログ（${periodLabel}：${filteredLogs.length}件）を CSV 出力しました`);
  };

  const handlePruneOldLogs = async () => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const dateStr = sixMonthsAgo.toISOString().slice(0, 10);

    if (
      window.confirm(
        `【ログのクリーンアップ】\n6ヶ月以上前（${dateStr} 以前）の古い入出庫ログを削除して軽量化しますか？\n（※事前にCSV出力を済ませておくことをお勧めします）`
      )
    ) {
      await clearOldLogs(sixMonthsAgo);
    }
  };

  const MONTHS = [
    { key: 'ALL', label: '全月' },
    { key: '1', label: '1月' },
    { key: '2', label: '2月' },
    { key: '3', label: '3月' },
    { key: '4', label: '4月' },
    { key: '5', label: '5月' },
    { key: '6', label: '6月' },
    { key: '7', label: '7月' },
    { key: '8', label: '8月' },
    { key: '9', label: '9月' },
    { key: '10', label: '10月' },
    { key: '11', label: '11月' },
    { key: '12', label: '12月' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-8">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <History className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl text-white">
                入出庫・受払履歴レポート (Audit Logs)
              </h2>
              <p className="text-xs text-slate-400">
                全 {logs.length} 件の取引記録 (表示中: <strong className="text-emerald-400 font-bold">{filteredLogs.length}</strong> 件) / 年月別集計対応
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePruneOldLogs}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 rounded-xl text-xs font-bold transition shadow-sm"
            title="6ヶ月以上前の古いログを整理"
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>ログ整理</span>
          </button>

          <button
            onClick={handleExportLogsCsv}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{selectedYear === 'ALL' ? '全期間' : `${selectedYear}年`} CSV 出力</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards for Selected Period */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">期間内 入庫数量 (換算)</span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
            +{totalInCount}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">期間内 払出数量 (換算)</span>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-1">
            -{totalOutCount}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">期間内 取引件数</span>
          <div className="text-2xl sm:text-3xl font-black text-blue-400 mt-1">
            {filteredLogs.length} <span className="text-xs font-normal text-slate-400">/ 全 {logs.length} 件</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4">
          <span className="text-xs text-slate-400 font-semibold block">同期状態</span>
          <div className="text-2xl sm:text-3xl font-black text-teal-400 mt-1">
            100%
            <span className="text-xs font-normal text-slate-400 ml-1">ローカル永続化</span>
          </div>
        </div>
      </div>

      {/* Filter Bar with Year & Month classification */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="品号・品名・作業員・備考で検索..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Action Type Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { key: 'ALL', label: '全操作' },
              { key: 'IN', label: '入荷のみ' },
              { key: 'OUT', label: '払出のみ' },
              { key: 'ORDER', label: '発注依頼' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterAction(f.key)}
                className={`py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                  filterAction === f.key
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Year and Month Filters */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          {/* Year Dropdown & Month Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 shrink-0">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-slate-300">対象年:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">全年度</option>
                {availableYears.map((y) => (
                  <option key={y} value={y.toString()}>
                    {y} 年
                  </option>
                ))}
              </select>
            </div>

            {/* Month Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none flex-1 max-w-full sm:justify-end">
              {MONTHS.map((m) => {
                const isSelected = selectedMonth === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setSelectedMonth(m.key)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition border shrink-0 ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-400 text-white shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">日時</th>
                <th className="py-3.5 px-4">操作区分</th>
                <th className="py-3.5 px-4">品号 / 品名</th>
                <th className="py-3.5 px-4 text-right">入力数量</th>
                <th className="py-3.5 px-4 text-right">基準換算数量</th>
                <th className="py-3.5 px-4">作業員</th>
                <th className="py-3.5 px-4">備考 / トランザクション</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-medium">
                    入出庫履歴データがありません
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isIn = log.type === 'IN';
                  const isOut = log.type === 'OUT';
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                        </div>
                      </td>

                      {/* Action Type */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black inline-flex items-center gap-1 ${
                            isIn
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : isOut
                              ? 'bg-rose-950 text-rose-400 border border-rose-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}
                        >
                          {isIn && <ArrowDownCircle className="w-3.5 h-3.5" />}
                          {isOut && <ArrowUpCircle className="w-3.5 h-3.5" />}
                          <span>{isIn ? '入荷' : isOut ? '払出' : log.type}</span>
                        </span>
                      </td>

                      {/* Item info */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-white">{log.itemName}</div>
                        <div className="text-xs text-slate-500 font-mono">{log.itemCode}</div>
                      </td>

                      {/* Entered Qty */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-white">
                        {log.quantity} <span className="text-xs text-slate-400">{log.unit}</span>
                      </td>

                      {/* Calculated Base Qty */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-black text-sm ${
                            isIn ? 'text-emerald-400' : isOut ? 'text-rose-400' : 'text-slate-200'
                          }`}
                        >
                          {log.delta > 0 ? `+${log.delta}` : log.delta}
                        </span>
                        {log.multiplier > 1 && (
                          <div className="text-[10px] text-slate-500">
                            (×{log.multiplier}換算)
                          </div>
                        )}
                      </td>

                      {/* Operator */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-300">
                          <User className="w-3.5 h-3.5 text-blue-400" />
                          <span>{log.operator}</span>
                        </div>
                      </td>

                      {/* Note */}
                      <td className="py-3.5 px-4 max-w-[200px] text-slate-400 truncate">
                        {log.note || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
