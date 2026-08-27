import React, { useState, useRef } from 'react';
import { ItemMaster } from '../../types/inventory';
import { CsvHelper } from '../../utils/csvHelper';
import { useInventory } from '../../context/InventoryContext';
import { X, UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Download } from 'lucide-react';

interface CsvImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvImportExportModal: React.FC<CsvImportExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { importItems, items, addToast } = useInventory();
  const [parsedItems, setParsedItems] = useState<Partial<ItemMaster>[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const { items: loaded, errors } = CsvHelper.parseCsvToItems(text);
        setParsedItems(loaded);
        setParseErrors(errors);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportConfirm = async () => {
    if (parsedItems.length === 0) return;
    setIsProcessing(true);
    try {
      await importItems(parsedItems);
      onClose();
    } catch (e) {
      console.error(e);
      addToast('error', 'インポートに失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleCsv = CsvHelper.exportItemsToCsv(items.slice(0, 3));
    CsvHelper.downloadCsv(sampleCsv, 'sample_inventory_template.csv');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <span>CSV 批次取込・インポート (UTF-8 BOM対応)</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Instructions & Template Download */}
          <div className="flex items-center justify-between bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-300">
            <span>Excel で編集した CSV ファイルを一括取り込みできます。</span>
            <button
              onClick={handleDownloadSample}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>雛形サンプルをDL</span>
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition bg-slate-800/30 hover:bg-slate-800/60"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,text/csv"
              className="hidden"
            />
            <UploadCloud className="w-10 h-10 text-blue-400 mb-2" />
            <p className="font-bold text-sm text-slate-200">
              {fileName ? fileName : 'ここをクリックして CSV ファイルを選択'}
            </p>
            <p className="text-xs text-slate-500 mt-1">.csv ファイル (UTF-8)</p>
          </div>

          {/* Errors Notice */}
          {parseErrors.length > 0 && (
            <div className="bg-rose-950/50 border border-rose-800/60 rounded-2xl p-3 text-xs text-rose-300 space-y-1">
              <div className="font-bold flex items-center gap-1 text-rose-400">
                <AlertCircle className="w-4 h-4" />
                <span>取込時に {parseErrors.length} 件の警告が発生しました:</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 max-h-24 overflow-y-auto">
                {parseErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          {parsedItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>取込プレビュー ({parsedItems.length} 件検出):</span>
              </h4>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-800/90 text-slate-400 sticky top-0">
                    <tr>
                      <th className="p-2">品号</th>
                      <th className="p-2">品名</th>
                      <th className="p-2">規格</th>
                      <th className="p-2">単位</th>
                      <th className="p-2">現在庫</th>
                      <th className="p-2">棚番</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {parsedItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50">
                        <td className="p-2 font-mono">{item.code}</td>
                        <td className="p-2 font-semibold text-white truncate max-w-[120px]">
                          {item.name}
                        </td>
                        <td className="p-2 text-slate-400">{item.spec || '-'}</td>
                        <td className="p-2">{item.baseUnit}</td>
                        <td className="p-2 text-emerald-400 font-bold">{item.currentStock}</td>
                        <td className="p-2 text-blue-400">{item.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-sm transition"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleImportConfirm}
            disabled={parsedItems.length === 0 || isProcessing}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-lg"
          >
            {isProcessing ? 'インポート中...' : `全 ${parsedItems.length} 件をインポート`}
          </button>
        </div>
      </div>
    </div>
  );
};
