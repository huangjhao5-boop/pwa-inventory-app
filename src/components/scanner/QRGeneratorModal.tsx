import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useInventory } from '../../context/InventoryContext';
import { DualModeCodeParser } from '../../utils/qrParser';
import { X, Download, Printer, Copy, Check } from 'lucide-react';

export const QRGeneratorModal: React.FC = () => {
  const { isQRGeneratorOpen, closeQRGenerator, qrGeneratorTarget, addToast } = useInventory();

  const [code, setCode] = useState(qrGeneratorTarget?.code || 'PART-001');
  const [name, setName] = useState(qrGeneratorTarget?.name || '新規部品');
  const [spec, setSpec] = useState(qrGeneratorTarget?.spec || '');
  const [lot, setLot] = useState('LOT-A1');
  const [formatType, setFormatType] = useState<'INV_STANDARD' | 'JSON' | 'RAW'>('INV_STANDARD');
  const [copied, setCopied] = useState(false);

  const qrContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (qrGeneratorTarget) {
      setCode(qrGeneratorTarget.code);
      setName(qrGeneratorTarget.name);
      setSpec(qrGeneratorTarget.spec);
    }
  }, [qrGeneratorTarget]);

  if (!isQRGeneratorOpen) return null;

  let qrValue = '';
  if (formatType === 'INV_STANDARD') {
    qrValue = DualModeCodeParser.formatItemQR(code, lot);
  } else if (formatType === 'JSON') {
    qrValue = JSON.stringify({ code, name, spec, lot });
  } else {
    qrValue = code;
  }

  const handleCopyText = () => {
    navigator.clipboard.writeText(qrValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('info', 'QRコード文字列をコピーしました');
  };

  const handleDownloadSVG = () => {
    if (!qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${code || 'code'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'QRコード (SVG) を保存しました');
  };

  const handlePrintSingle = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <span>🏷️ 自社QRコード発行・ラベル出力</span>
          </h2>
          <button
            onClick={closeQRGenerator}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Form */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                品目コード / JANバーコード (必須)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="例: 4901480000028"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">品名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="例: 丸形圧着端子"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">規格・型番</label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="例: R2-4"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ロット番号 / 保管場所 (任意)
              </label>
              <input
                type="text"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="例: LOT-2026A"
              />
            </div>
          </div>

          {/* Format selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">QR形式設定</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormatType('INV_STANDARD')}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition ${
                  formatType === 'INV_STANDARD'
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                自社標準
              </button>
              <button
                type="button"
                onClick={() => setFormatType('JSON')}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition ${
                  formatType === 'JSON'
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                構造化 JSON
              </button>
              <button
                type="button"
                onClick={() => setFormatType('RAW')}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition ${
                  formatType === 'RAW'
                    ? 'bg-blue-600 border-blue-400 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                }`}
              >
                直接コード
              </button>
            </div>
          </div>

          {/* QR Code Preview Card */}
          <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center text-slate-900 shadow-inner">
            <div ref={qrContainerRef} className="p-2 bg-white">
              <QRCodeSVG
                value={qrValue}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Label Text Preview */}
            <div className="mt-2 text-center w-full max-w-[220px]">
              <p className="font-extrabold text-sm truncate leading-tight">{name}</p>
              <p className="text-xs text-slate-700 truncate">{spec || code}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{code}</p>
            </div>
          </div>

          {/* String Output Display */}
          <div className="flex items-center gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
            <div className="flex-1 font-mono text-[11px] text-slate-300 truncate">
              {qrValue}
            </div>
            <button
              onClick={handleCopyText}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="コピー"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex gap-2">
          <button
            onClick={handleDownloadSVG}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-sm border border-slate-700 transition"
          >
            <Download className="w-4 h-4" />
            <span>SVG 保存</span>
          </button>
          <button
            onClick={handlePrintSingle}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-blue-900/40"
          >
            <Printer className="w-4 h-4" />
            <span>印刷プレビュー</span>
          </button>
        </div>
      </div>
    </div>
  );
};
