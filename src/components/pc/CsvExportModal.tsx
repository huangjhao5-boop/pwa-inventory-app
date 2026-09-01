import React, { useState, useMemo } from 'react';
import { ItemMaster } from '../../types/inventory';
import { CsvHelper, EXPORT_COLUMNS } from '../../utils/csvHelper';
import {
  Download,
  X,
  FileSpreadsheet,
  Filter,
  CheckSquare,
  Square,
  Search,
  FileText,
  Sparkles,
} from 'lucide-react';

interface CsvExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: ItemMaster[];
  filteredItems?: ItemMaster[];
  currentFilterLabel?: string;
  onSuccessToast?: (msg: string) => void;
}

export const CsvExportModal: React.FC<CsvExportModalProps> = ({
  isOpen,
  onClose,
  allItems,
  onSuccessToast,
}) => {
  // Export Format: EXCEL (.xlsx) or CSV (.csv)
  const [exportFormat, setExportFormat] = useState<'EXCEL' | 'CSV'>('EXCEL');

  // Filters within modal
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBox, setSelectedBox] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [stockStatus, setStockStatus] = useState<'ALL' | 'LOW' | 'ZERO' | 'DISCONTINUED'>('ALL');

  // Selected Columns
  const [selectedCols, setSelectedCols] = useState<string[]>(() =>
    EXPORT_COLUMNS.map((c) => c.key)
  );

  // Extract unique options
  const boxes = useMemo(
    () => ['ALL', ...Array.from(new Set(allItems.map((i) => i.location).filter(Boolean)))],
    [allItems]
  );
  const categories = useMemo(
    () => ['ALL', ...Array.from(new Set(allItems.map((i) => i.category || '未分類')))],
    [allItems]
  );
  const suppliers = useMemo(
    () => [
      'ALL',
      ...Array.from(new Set(allItems.map((i) => i.supplier).filter(Boolean) as string[])),
    ],
    [allItems]
  );

  // Filter items based on active criteria
  const exportItems = useMemo(() => {
    return allItems.filter((item) => {
      // 1. Keyword search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match =
          item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.spec && item.spec.toLowerCase().includes(q)) ||
          (item.supplier && item.supplier.toLowerCase().includes(q)) ||
          (item.location && item.location.toLowerCase().includes(q)) ||
          (item.note && item.note.toLowerCase().includes(q));
        if (!match) return false;
      }

      // 2. Box Filter
      if (selectedBox !== 'ALL' && item.location !== selectedBox) return false;

      // 3. Category Filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;

      // 4. Supplier Filter
      if (selectedSupplier !== 'ALL' && item.supplier !== selectedSupplier) return false;

      // 5. Stock Status Filter
      if (stockStatus === 'LOW' && (item.isDiscontinued || item.currentStock > item.safetyStock)) return false;
      if (stockStatus === 'ZERO' && item.currentStock !== 0) return false;
      if (stockStatus === 'DISCONTINUED' && !item.isDiscontinued) return false;

      return true;
    });
  }, [allItems, searchQuery, selectedBox, selectedCategory, selectedSupplier, stockStatus]);

  if (!isOpen) return null;

  const toggleSelectAllCols = () => {
    if (selectedCols.length === EXPORT_COLUMNS.length) {
      setSelectedCols([]);
    } else {
      setSelectedCols(EXPORT_COLUMNS.map((c) => c.key));
    }
  };

  const toggleCol = (key: string) => {
    if (selectedCols.includes(key)) {
      setSelectedCols(selectedCols.filter((k) => k !== key));
    } else {
      setSelectedCols([...selectedCols, key]);
    }
  };

  const handleDownload = () => {
    if (exportItems.length === 0 || selectedCols.length === 0) return;

    const dateStr = new Date().toISOString().slice(0, 10);

    if (exportFormat === 'EXCEL') {
      const filename = `在庫マスタ_エクスポート_${dateStr}.xlsx`;
      CsvHelper.exportItemsToExcel(exportItems, {
        selectedColumns: selectedCols,
        filename,
      });
      if (onSuccessToast) {
        onSuccessToast(`📊 ${exportItems.length}件の品目を Excel (.xlsx) で出力しました（自動列幅・オートフィルター有効）`);
      }
    } else {
      const csvStr = CsvHelper.exportItemsToCsv(exportItems, {
        selectedColumns: selectedCols,
      });
      const filename = `在庫マスタ_エクスポート_${dateStr}.csv`;
      CsvHelper.downloadCsv(csvStr, filename);
      if (onSuccessToast) {
        onSuccessToast(`📄 ${exportItems.length}件の品目を CSV で出力しました`);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                <span>Excel / CSV 抽出エクスポート</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  自適配列幅 & オートフィルター対応
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                抽出条件・出力形式・出力カラムを自在にカスタマイズして出力できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>出力ファイル形式を選択</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExportFormat('EXCEL')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-1 ${
                  exportFormat === 'EXCEL'
                    ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-950/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-emerald-300 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>📊 Excel 形式 (.xlsx)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                    一番オススメ
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  ✅ <strong>自適配欄位大小</strong>（文字幅自動調整）<br />
                  ✅ <strong>標題オートフィルター</strong>（Excelの▼絞り込み即時利用可）
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('CSV')}
                className={`p-3.5 rounded-2xl border text-left transition flex flex-col gap-1 ${
                  exportFormat === 'CSV'
                    ? 'bg-blue-950/60 border-blue-500 text-white shadow-lg shadow-blue-950/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs sm:text-sm text-blue-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>📄 CSV 形式 (.csv)</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold">
                    UTF-8 BOM
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  他システムやデータベース移行用の標準CSVテキスト（Excel文字化け防止対応）
                </p>
              </button>
            </div>
          </div>

          {/* 🔍 データ抽出フィルターバー */}
          <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Filter className="w-4 h-4 text-blue-400" />
                <span>データ絞り込み条件（フィルタリング）</span>
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-black">
                該当: {exportItems.length} 件 / 全 {allItems.length} 件
              </span>
            </div>

            {/* Keyword Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="キーワード検索（品名・型番・コード・備考）..."
                className="w-full pl-9 pr-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">保管ボックス</label>
                <select
                  value={selectedBox}
                  onChange={(e) => setSelectedBox(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-bold focus:outline-none"
                >
                  {boxes.map((b) => (
                    <option key={b} value={b}>
                      {b === 'ALL' ? '📦 全保管箱' : b}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">カテゴリ</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-bold focus:outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c === 'ALL' ? '🗂️ 全カテゴリ' : c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">仕入先メーカー</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-bold focus:outline-none"
                >
                  {suppliers.map((s) => (
                    <option key={s} value={s}>
                      {s === 'ALL' ? '🏭 全メーカー' : s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1">在庫状態</label>
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value as any)}
                  className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 font-bold focus:outline-none"
                >
                  <option value="ALL">📊 全在庫</option>
                  <option value="LOW">⚡ 要発注のみ</option>
                  <option value="ZERO">⚠️ 在庫ゼロのみ</option>
                  <option value="DISCONTINUED">🛑 廃番品のみ</option>
                </select>
              </div>
            </div>
          </div>

          {/* Column selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>出力する項目列の選択 ({selectedCols.length} / {EXPORT_COLUMNS.length} 列)</span>
              </label>
              <button
                type="button"
                onClick={toggleSelectAllCols}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
              >
                {selectedCols.length === EXPORT_COLUMNS.length ? '全解除' : '全列を選択'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              {EXPORT_COLUMNS.map((col) => {
                const isChecked = selectedCols.includes(col.key);
                return (
                  <button
                    type="button"
                    key={col.key}
                    onClick={() => toggleCol(col.key)}
                    className={`p-2 rounded-xl border text-left text-xs font-bold transition flex items-center gap-2 ${
                      isChecked
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
                        : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:bg-slate-800'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-600 shrink-0" />
                    )}
                    <span className="truncate">{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="text-xs text-slate-400">
            出力対象: <strong className="text-white font-bold">{exportItems.length}</strong> 件 / 選択列:{' '}
            <strong className="text-emerald-400 font-bold">{selectedCols.length}</strong> 列
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={exportItems.length === 0 || selectedCols.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>
                {exportFormat === 'EXCEL'
                  ? `Excel (.xlsx) をダウンロード`
                  : `CSV (.csv) をダウンロード`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
