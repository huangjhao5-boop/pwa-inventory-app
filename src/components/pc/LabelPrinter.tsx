import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LabelLayout } from '../../types/inventory';
import { LabelSheetPreview } from './LabelSheetPreview';
import { Printer, CheckSquare, Layers, Download, Image as ImageIcon, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

export const LabelPrinter: React.FC = () => {
  const { items, addToast } = useInventory();
  const [layout, setLayout] = useState<LabelLayout>('A-ONE-24');
  const [pureQrOnly, setPureQrOnly] = useState<boolean>(true); // ユーザー要望によりデフォルトはQRコード単体（文字なし）
  const [isExportingImage, setIsExportingImage] = useState(false);

  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    items.slice(0, 6).forEach((i) => {
      initial[i.id] = true;
    });
    return initial;
  });
  const [printCopies, setPrintCopies] = useState<Record<string, number>>({});

  const toggleSelectAll = () => {
    const allSelected = items.every((i) => selectedItemIds[i.id]);
    const next: Record<string, boolean> = {};
    items.forEach((i) => {
      next[i.id] = !allSelected;
    });
    setSelectedItemIds(next);
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateCopies = (id: string, count: number) => {
    setPrintCopies((prev) => ({ ...prev, [id]: Math.max(1, count) }));
  };

  const selectedItemsWithCopies = items
    .filter((i) => selectedItemIds[i.id])
    .map((item) => ({
      item,
      printCount: printCopies[item.id] || 1,
    }));

  const totalLabels = selectedItemsWithCopies.reduce((acc, curr) => acc + curr.printCount, 0);

  const handlePrint = () => {
    window.print();
  };

  // 1. ラベルシート全体を高解像度 PNG 画像として出力・保存
  const handleExportSheetAsPng = async () => {
    const container = document.getElementById('printable-label-sheet');
    if (!container) {
      addToast('error', '印刷プレビューが見つかりません');
      return;
    }

    try {
      setIsExportingImage(true);
      addToast('info', '高解像度 PNG 画像を生成中...');

      // SVG QRコードを Canvas に描画
      const svgs = Array.from(container.querySelectorAll('svg'));
      if (svgs.length === 0) {
        addToast('warning', 'QRコードがありません');
        setIsExportingImage(false);
        return;
      }

      // レンダリング用オフスクリーン Canvas
      const cols = layout === 'A-ONE-24' ? 3 : layout === 'A-ONE-44' ? 4 : 1;
      const rows = Math.ceil(svgs.length / cols);
      const cellWidth = pureQrOnly ? 280 : 360;
      const cellHeight = pureQrOnly ? 280 : 180;
      const padding = 30;

      const canvas = document.createElement('canvas');
      canvas.width = cols * cellWidth + padding * 2;
      canvas.height = rows * cellHeight + padding * 2;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // 背景白塗り
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 各QRコードを順次描画
      const promises = svgs.map((svg, idx) => {
        return new Promise<void>((resolve) => {
          const svgData = new XMLSerializer().serializeToString(svg);
          const img = new Image();
          const colIdx = idx % cols;
          const rowIdx = Math.floor(idx / cols);
          const x = padding + colIdx * cellWidth;
          const y = padding + rowIdx * cellHeight;

          img.onload = () => {
            // 外枠ボーダー
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 5, y + 5, cellWidth - 10, cellHeight - 10);

            if (pureQrOnly) {
              const qrSize = Math.min(cellWidth - 40, cellHeight - 40);
              const qrX = x + (cellWidth - qrSize) / 2;
              const qrY = y + (cellHeight - qrSize) / 2;
              ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
            } else {
              const qrSize = 120;
              ctx.drawImage(img, x + 15, y + 25, qrSize, qrSize);

              const item = selectedItemsWithCopies[Math.min(idx, selectedItemsWithCopies.length - 1)]?.item;
              if (item) {
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 15px sans-serif';
                ctx.fillText(item.name.slice(0, 14), x + 145, y + 50);

                ctx.fillStyle = '#64748b';
                ctx.font = '12px sans-serif';
                if (item.spec) ctx.fillText(item.spec.slice(0, 16), x + 145, y + 75);
                ctx.fillText(`ボックス: ${item.location}`, x + 145, y + 100);

                ctx.fillStyle = '#94a3b8';
                ctx.font = 'bold 11px monospace';
                ctx.fillText(item.code, x + 145, y + 125);
              }
            }
            resolve();
          };

          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        });
      });

      await Promise.all(promises);

      // PNG ダウンロード
      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `QR_ラベルシート_${layout}_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();

      setIsExportingImage(false);
      addToast('success', 'QRラベルシートを PNG 画像として出力しました！');

      try {
        confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });
      } catch {}
    } catch (e) {
      console.error('Export sheet image failed:', e);
      setIsExportingImage(false);
      addToast('error', '画像の出力に失敗しました');
    }
  };

  // 2. 選択品目のQRコード画像を個別PNGとして連続出力
  const handleExportIndividualQrPngs = async () => {
    const selected = items.filter((i) => selectedItemIds[i.id]);
    if (selected.length === 0) {
      addToast('warning', '品目が選択されていません');
      return;
    }

    addToast('info', `${selected.length}件のQRコード画像をダウンロードします...`);

    for (const item of selected) {
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 500;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      // Pure QR Code generator
      const qrImg = new Image();
      // Use standard QR generator URL or local canvas
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=460x460&data=${encodeURIComponent(item.code)}`;

      await new Promise<void>((resolve) => {
        qrImg.crossOrigin = 'anonymous';
        qrImg.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 500, 500);
          ctx.drawImage(qrImg, 20, 20, 460, 460);

          const pngData = canvas.toDataURL('image/png');
          const a = document.createElement('a');
          a.href = pngData;
          a.download = `QR_${item.code}_${item.name.replace(/[\/\\:*?"<>|]/g, '_')}.png`;
          a.click();
          setTimeout(resolve, 200);
        };
        qrImg.onerror = () => resolve();
        qrImg.src = qrUrl;
      });
    }

    addToast('success', `${selected.length}件のQRコードPNG画像を保存しました`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-8">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Printer className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl text-white">
                QR ラベル一括印刷 & 画像出力 (Label Printer)
              </h2>
              <p className="text-xs text-slate-400">
                A4ラベル用紙への直接印刷だけでなく、高解像度 PNG 画像としての一括保存に対応
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* Export Individual PNGs */}
          <button
            onClick={handleExportIndividualQrPngs}
            disabled={totalLabels === 0}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition shadow"
            title="各品目のQRコードを個別のPNG画像としてダウンロード"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>個別 QR画像保存</span>
          </button>

          {/* Export Sheet as PNG */}
          <button
            onClick={handleExportSheetAsPng}
            disabled={totalLabels === 0 || isExportingImage}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-950/60 transition"
            title="プレビュー画面全体を1枚のPNG画像として保存"
          >
            <ImageIcon className="w-4 h-4 stroke-[2.5]" />
            <span>シートを画像 (PNG) で出力</span>
          </button>

          {/* Print Dialog */}
          <button
            onClick={handlePrint}
            disabled={totalLabels === 0}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 disabled:opacity-50 text-slate-100 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            <Printer className="w-4 h-4 text-blue-400" />
            <span>プリンター印刷 ({totalLabels}枚)</span>
          </button>
        </div>
      </div>

      {/* Settings & Item Selection Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:hidden">
        {/* Left Column: Layout selector & Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-lg">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>出力形式 & ラベル用紙規格</span>
          </h3>

          {/* QR only or Full Label Toggle */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
            <label className="text-xs font-bold text-slate-300 block">出力デザイン形式</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPureQrOnly(true)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  pureQrOnly
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>QRコード単体のみ</span>
              </button>
              <button
                type="button"
                onClick={() => setPureQrOnly(false)}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                  !pureQrOnly
                    ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>品名・型番ラベル付</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              {pureQrOnly ? '文字なしの純粋なQRコード画像のみを整列出力します' : '品名・ボックス名・型番・コードを印字した完全ラベル'}
            </p>
          </div>

          <div className="space-y-2">
            <label
              onClick={() => setLayout('A-ONE-24')}
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                layout === 'A-ONE-24'
                  ? 'bg-blue-600/10 border-blue-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="labelLayout"
                checked={layout === 'A-ONE-24'}
                onChange={() => setLayout('A-ONE-24')}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-100">
                  A-One 24面 (70 × 33.9mm)
                </div>
                <div className="text-[11px] text-slate-400">
                  パーツボックス・中型料盒・外箱向け標準規格
                </div>
              </div>
            </label>

            <label
              onClick={() => setLayout('A-ONE-44')}
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                layout === 'A-ONE-44'
                  ? 'bg-blue-600/10 border-blue-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="labelLayout"
                checked={layout === 'A-ONE-44'}
                onChange={() => setLayout('A-ONE-44')}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-100">
                  A-One 44面 (48.3 × 25.4mm)
                </div>
                <div className="text-[11px] text-slate-400">
                  小型ネジ箱・引き出し・仕分けトレイ向け高密度規格
                </div>
              </div>
            </label>

            <label
              onClick={() => setLayout('SINGLE-THERMAL')}
              className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                layout === 'SINGLE-THERMAL'
                  ? 'bg-blue-600/10 border-blue-500 text-white'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <input
                type="radio"
                name="labelLayout"
                checked={layout === 'SINGLE-THERMAL'}
                onChange={() => setLayout('SINGLE-THERMAL')}
                className="mt-1 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-100">
                  単票ラベル / サーマルプリンター
                </div>
                <div className="text-[11px] text-slate-400">
                  Brother / SATO / Zebra などのラベルライター用
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Right Column (2 cols): Item Selection List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">
              出力する品目を選択 ({Object.values(selectedItemIds).filter(Boolean).length} 品目 / 計 {totalLabels} 枚)
            </h3>
            <button
              onClick={toggleSelectAll}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>全選択 / 解除</span>
            </button>
          </div>

          {/* Items list */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/80">
            {items.map((item) => {
              const isSelected = Boolean(selectedItemIds[item.id]);
              const copies = printCopies[item.id] || 1;
              return (
                <div
                  key={item.id}
                  className="pt-2 flex items-center justify-between gap-3 text-xs"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectItem(item.id)}
                      className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800"
                    />
                    <div className="truncate">
                      <span className="font-mono text-slate-400 mr-2">{item.code}</span>
                      <strong className="text-white">{item.name}</strong>
                      <span className="text-slate-500 ml-1">({item.location})</span>
                    </div>
                  </label>

                  {/* Copies stepper */}
                  {isSelected && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-400">枚数:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={copies}
                        onChange={(e) =>
                          updateCopies(item.id, parseInt(e.target.value, 10) || 1)
                        }
                        className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-center"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Print Preview Section */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-slate-300 px-2 print:hidden">
          📄 出力プレビュー ({layout} / {pureQrOnly ? 'QRコード単体' : 'ラベル付'})
        </h3>
        <LabelSheetPreview
          items={selectedItemsWithCopies}
          layout={layout}
          pureQrOnly={pureQrOnly}
        />
      </div>
    </div>
  );
};
