import React, { useState } from 'react';
import { ItemMaster } from '../../types/inventory';
import { CsvHelper } from '../../utils/csvHelper';
import {
  Download,
  X,
  FileSpreadsheet,
  Filter,
} from 'lucide-react';

interface CsvExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allItems: ItemMaster[];
  filteredItems: ItemMaster[];
  currentFilterLabel?: string;
  onSuccessToast?: (msg: string) => void;
}

const ALL_COLUMNS = [
  { key: 'code', label: '品目コード (Code)' },
  { key: 'name', label: '品名 (Name)' },
  { key: 'spec', label: '規格型番 (Spec)' },
  { key: 'category', label: 'カテゴリ (Category)' },
  { key: 'supplier', label: '仕入先メーカー (Supplier)' },
  { key: 'orderUrl', label: '発注URL (OrderUrl)' },
  { key: 'baseUnit', label: '基準単位 (BaseUnit)' },
  { key: 'currentStock', label: '現在庫数 (CurrentStock)' },
  { key: 'safetyStock', label: '安全在庫数 (SafetyStock)' },
  { key: 'location', label: '保管ボックス名 (Location)' },
  { key: 'qrCode', label: 'QRコード文字列 (QRCode)' },
  { key: 'conversions', label: '包装単位換算 (Conversions)' },
  { key: 'note', label: '備考 (Note)' },
  { key: 'updatedAt', label: '最終更新日時 (UpdatedAt)' },
];

export const CsvExportModal: React.FC<CsvExportModalProps> = ({
  isOpen,
  onClose,
  allItems,
  filteredItems,
  currentFilterLabel,
  onSuccessToast,
}) => {
  const [exportScope, setExportScope] = useState<'FILTERED' | 'ALL'>('FILTERED');
  const [selectedCols, setSelectedCols] = useState<string[]>(() => ALL_COLUMNS.map((c) => c.key));

  if (!isOpen) return null;

  const targetItems = exportScope === 'FILTERED' ? filteredItems : allItems;

  const toggleSelectAllCols = () => {
    if (selectedCols.length === ALL_COLUMNS.length) {
      setSelectedCols([]);
    } else {
      setSelectedCols(ALL_COLUMNS.map((c) => c.key));
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
    if (targetItems.length === 0) return;
    const csvStr = CsvHelper.exportItemsToCsv(targetItems, {
      selectedColumns: selectedCols,
    });
    const filename = `在庫マスタ_${exportScope === 'FILTERED' ? '抽出データ' : '全件'}_${new Date().toISOString().slice(0, 10)}.csv`;
    CsvHelper.downloadCsv(csvStr, filename);
    if (onSuccessToast) {
      onSuccessToast(`${targetItems.length}件の品目を CSV 出力しました`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">CSV エクスポート設定</h3>
              <p className="text-xs text-slate-400">
                出力対象の絞り込み範囲と出力する項目列を選択してください
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
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Scope selection */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-blue-400" />
              <span>エクスポート対象のデータ範囲</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setExportScope('FILTERED')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                  exportScope === 'FILTERED'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-white">現在の絞り込み結果</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                    {filteredItems.length} 件
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {currentFilterLabel || '画面上の検索・カテゴリ絞り込み適用分'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setExportScope('ALL')}
                className={`p-3 rounded-2xl border text-left transition flex flex-col gap-1 ${
                  exportScope === 'ALL'
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-white">マスタ全件</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px]">
                    {allItems.length} 件
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  登録されているすべての品目を出力
                </p>
              </button>
            </div>
          </div>

          {/* Column selection */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                出力する列項目 ({selectedCols.length}/{ALL_COLUMNS.length})
              </label>
              <button
                type="button"
                onClick={toggleSelectAllCols}
                className="text-xs text-blue-400 hover:underline font-semibold"
              >
                {selectedCols.length === ALL_COLUMNS.length ? '全解除' : '全選択'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-2xl border border-slate-800">
              {ALL_COLUMNS.map((col) => {
                const isChecked = selectedCols.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none p-1 rounded-lg hover:bg-slate-900"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleCol(col.key)}
                      className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="truncate">{col.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={targetItems.length === 0 || selectedCols.length === 0}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-950 transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>CSV ダウンロード ({targetItems.length}件)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
