import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useInventory } from '../../context/InventoryContext';
import { X, Download, Printer, Copy, Check, Image as ImageIcon } from 'lucide-react';

export const QRGeneratorModal: React.FC = () => {
  const { isQRGeneratorOpen, closeQRGenerator, qrGeneratorTarget, addToast } = useInventory();

  const [code, setCode] = useState(qrGeneratorTarget?.code || 'PART-001');
  const [name, setName] = useState(qrGeneratorTarget?.name || '新規部品');
  const [spec, setSpec] = useState(qrGeneratorTarget?.spec || '');
  const [includeLabelText, setIncludeLabelText] = useState(false); // ユーザー要望によりデフォルトは「QRコード単体のみ（文字なし）」
  const [copied, setCopied] = useState(false);

  const qrContainerRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (qrGeneratorTarget) {
      setCode(qrGeneratorTarget.code);
      setName(qrGeneratorTarget.name);
      setSpec(qrGeneratorTarget.spec || '');
    }
  }, [qrGeneratorTarget]);

  if (!isQRGeneratorOpen) return null;

  const qrValue = code;

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

  const handleDownloadPNG = () => {
    if (!qrContainerRef.current) return;
    const svg = qrContainerRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    canvas.width = 500;
    canvas.height = 500;

    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20, 460, 460);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `QR_${code || 'code'}.png`;
      a.click();
      addToast('success', '高解像度 QRコード (PNG画像) を保存しました');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
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
            <span>🏷️ QRコード発行・出力</span>
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
                品目コード / JANバーコード
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                placeholder="例: 4944387106008"
              />
            </div>
          </div>

          {/* QR Code Preview Card (Pure QR Code Only) */}
          <div className="bg-white p-5 rounded-3xl flex flex-col items-center justify-center text-slate-900 shadow-xl">
            <div ref={qrContainerRef} className="p-2 bg-white rounded-2xl">
              <QRCodeSVG
                value={qrValue}
                size={220}
                level="M"
                includeMargin={true}
              />
            </div>

            {/* Optional text label (Defaults to hidden) */}
            {includeLabelText && (
              <div className="mt-2 text-center w-full max-w-[240px] border-t border-slate-200 pt-1.5">
                <p className="font-extrabold text-sm truncate leading-tight text-slate-900">{name}</p>
                {spec && <p className="text-xs text-slate-700 truncate">{spec}</p>}
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{code}</p>
              </div>
            )}
          </div>

          {/* Label Toggle */}
          <div className="flex items-center justify-between px-1">
            <label className="text-xs text-slate-400 font-medium flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeLabelText}
                onChange={(e) => setIncludeLabelText(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0"
              />
              <span>品名・型番のテキスト印字を含める</span>
            </label>
          </div>

          {/* String Output Display */}
          <div className="flex items-center gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/80">
            <div className="flex-1 font-mono text-[11px] text-slate-300 truncate">
              {qrValue}
            </div>
            <button
              onClick={handleCopyText}
              className="p-1 text-slate-400 hover:text-white rounded"
              title="コード文字列コピー"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 grid grid-cols-3 gap-2">
          <button
            onClick={handleDownloadPNG}
            className="flex items-center justify-center gap-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-blue-900/40"
            title="PNG画像として保存"
          >
            <ImageIcon className="w-4 h-4" />
            <span>PNG 画像保存</span>
          </button>
          <button
            onClick={handleDownloadSVG}
            className="flex items-center justify-center gap-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs border border-slate-700 transition"
            title="SVGベクターとして保存"
          >
            <Download className="w-4 h-4" />
            <span>SVG 保存</span>
          </button>
          <button
            onClick={handlePrintSingle}
            className="flex items-center justify-center gap-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs border border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
            <span>印刷</span>
          </button>
        </div>
      </div>
    </div>
  );
};
