import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LabelLayout } from '../../types/inventory';
import { LabelSheetPreview } from './LabelSheetPreview';
import {
  Printer,
  CheckSquare,
  Layers,
  Download,
  Image as ImageIcon,
  Sparkles,
  Search,
  X,
  Box,
  Tag,
  Building2,
  AlertTriangle,
  RotateCcw,
  Scissors,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const LabelPrinter: React.FC = () => {
  const { items, addToast } = useInventory();
  const [layout, setLayout] = useState<LabelLayout>('A-ONE-24');
  const [pureQrOnly, setPureQrOnly] = useState<boolean>(true); // ユーザー要望によりデフォルトはQRコード単体（文字なし）
  const [showCutLines, setShowCutLines] = useState<boolean>(true); // ユーザー要望：裁断用キリトリ線
  const [isExportingImage, setIsExportingImage] = useState(false);

  // ─── 絞り込みフィルター状態 ───
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLocation, setFilterLocation] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterStockStatus, setFilterStockStatus] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // 選択状態
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    items.slice(0, 6).forEach((i) => {
      initial[i.id] = true;
    });
    return initial;
  });
  const [printCopies, setPrintCopies] = useState<Record<string, number>>({});

  // フィルター用ユニーク一覧
  const uniqueLocations = useMemo(() => {
    const locs = items.map((i) => i.location).filter(Boolean);
    return Array.from(new Set(locs));
  }, [items]);

  const uniqueCategories = useMemo(() => {
    const cats = items.map((i) => i.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [items]);

  const uniqueSuppliers = useMemo(() => {
    const sups = items.map((i) => i.supplier).filter(Boolean) as string[];
    return Array.from(new Set(sups));
  }, [items]);

  // 絞り込み実行後の品目リスト
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. 検索ワード（品名、規格、型番、コード、メーカー、ボックス名、備考）
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSpec = (item.spec || '').toLowerCase().includes(q);
        const matchCode = item.code.toLowerCase().includes(q);
        const matchSupplier = (item.supplier || '').toLowerCase().includes(q);
        const matchLocation = (item.location || '').toLowerCase().includes(q);
        const matchNote = (item.note || '').toLowerCase().includes(q);
        if (!matchName && !matchSpec && !matchCode && !matchSupplier && !matchLocation && !matchNote) {
          return false;
        }
      }

      // 2. 保管ボックス・場所
      if (filterLocation !== 'ALL' && item.location !== filterLocation) {
        return false;
      }

      // 3. カテゴリ
      if (filterCategory !== 'ALL' && item.category !== filterCategory) {
        return false;
      }

      // 4. メーカー / 仕入先
      if (filterSupplier !== 'ALL' && item.supplier !== filterSupplier) {
        return false;
      }

      // 5. 在庫ステータス
      if (filterStockStatus === 'IN_STOCK' && item.currentStock <= 0) {
        return false;
      }
      if (filterStockStatus === 'LOW_STOCK' && (item.currentStock > item.safetyStock || item.currentStock <= 0)) {
        return false;
      }
      if (filterStockStatus === 'OUT_OF_STOCK' && item.currentStock > 0) {
        return false;
      }

      return true;
    });
  }, [items, searchQuery, filterLocation, filterCategory, filterSupplier, filterStockStatus]);

  // 全選択 / 解除（現在絞り込まれている品目に対して）
  const toggleSelectFiltered = () => {
    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedItemIds[i.id]);
    setSelectedItemIds((prev) => {
      const next = { ...prev };
      filteredItems.forEach((i) => {
        next[i.id] = !allFilteredSelected;
      });
      return next;
    });
  };

  // 全選択解除（すべての品目）
  const deselectAll = () => {
    setSelectedItemIds({});
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const updateCopies = (id: string, count: number) => {
    setPrintCopies((prev) => ({ ...prev, [id]: Math.max(1, count) }));
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterLocation('ALL');
    setFilterCategory('ALL');
    setFilterSupplier('ALL');
    setFilterStockStatus('ALL');
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

          img.crossOrigin = 'anonymous';
          img.onload = () => {
            // QRコード描画
            const qrSize = pureQrOnly ? 220 : 120;
            const qrX = pureQrOnly ? x + (cellWidth - qrSize) / 2 : x + 20;
            const qrY = pureQrOnly ? y + (cellHeight - qrSize) / 2 : y + (cellHeight - qrSize) / 2;

            ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

            // 文字情報描画（ラベル付きの場合）
            if (!pureQrOnly) {
              const itemDiv = svg.closest('.p-2') || svg.parentElement?.parentElement;
              if (itemDiv) {
                const nameEl = itemDiv.querySelector('.font-bold.text-slate-900');
                const specEl = itemDiv.querySelector('.text-amber-800, .font-mono');
                const codeEl = itemDiv.querySelector('.font-mono.text-slate-500');

                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText((nameEl?.textContent || '').slice(0, 16), x + 155, y + 55);

                ctx.fillStyle = '#b45309';
                ctx.font = 'bold 13px monospace';
                ctx.fillText((specEl?.textContent || '').slice(0, 20), x + 155, y + 85);

                ctx.fillStyle = '#64748b';
                ctx.font = '12px monospace';
                ctx.fillText(codeEl?.textContent || '', x + 155, y + 115);
              }
            }

            // ✂️ 裁断用キリトリ線（破線ガイド）を描画
            if (showCutLines) {
              ctx.save();
              ctx.strokeStyle = '#94a3b8';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([6, 4]);
              ctx.strokeRect(x + 6, y + 6, cellWidth - 12, cellHeight - 12);
              ctx.restore();
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

  const isFiltered =
    searchQuery.trim() !== '' ||
    filterLocation !== 'ALL' ||
    filterCategory !== 'ALL' ||
    filterSupplier !== 'ALL' ||
    filterStockStatus !== 'ALL';

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
                ボックス・カテゴリ・メーカー・在庫状態による絞り込みに対応。A4用紙印刷 & 高解像度PNG保存
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

      {/* Settings & Filterable Item Selection Bar */}
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

          {/* ✂️ Cutting Lines Toggle */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 text-amber-400" />
                <span>✂️ 裁断用キリトリ線 (ガイド枠)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCutLines(!showCutLines)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                  showCutLines
                    ? 'bg-emerald-600 text-white font-black shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {showCutLines ? '表示中 (ON)' : '非表示 (OFF)'}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              ハサミやカッターで切り抜きやすい点線ガイド枠と裁断マークを各ラベルに付与します
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

        {/* Right Column (2 cols): Filtering & Item Selection List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg flex flex-col">
          {/* Header with Selection Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                <span>品目を選択</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs font-bold font-mono">
                  {Object.values(selectedItemIds).filter(Boolean).length} / {items.length} 品目選択中
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
                  計 {totalLabels} 枚
                </span>
              </h3>
            </div>

            {/* Batch Select / Deselect Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectFiltered}
                className="text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition"
                title="現在絞り込まれている品目を一括で選択 / 解除"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>絞り込み結果 ({filteredItems.length}件) を全選択</span>
              </button>
              <button
                type="button"
                onClick={deselectAll}
                className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 transition"
              >
                全解除
              </button>
            </div>
          </div>

          {/* 🔍 Filter & Search Bar */}
          <div className="bg-slate-950/80 p-3 rounded-2xl border border-slate-800 space-y-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="品名・規格・型番・コード・メーカー・保管場所で検索..."
                className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {/* 1. Box / Location Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1 truncate">
                  <Box className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>保管ボックス</span>
                </label>
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="w-full py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-blue-500 truncate font-mono"
                >
                  <option value="ALL">すべて ({items.length})</option>
                  {uniqueLocations.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Category Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1 truncate">
                  <Tag className="w-3 h-3 text-blue-400 shrink-0" />
                  <span>カテゴリ</span>
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-blue-500 truncate"
                >
                  <option value="ALL">すべて</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Supplier Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>メーカー</span>
                </label>
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="w-full py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-blue-500 truncate"
                >
                  <option value="ALL">すべて</option>
                  {uniqueSuppliers.map((sup) => (
                    <option key={sup} value={sup}>
                      {sup}
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Stock Status Filter */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1 truncate">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>在庫状況</span>
                </label>
                <select
                  value={filterStockStatus}
                  onChange={(e) => setFilterStockStatus(e.target.value as any)}
                  className="w-full py-1.5 px-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-blue-500 truncate"
                >
                  <option value="ALL">すべて</option>
                  <option value="IN_STOCK">在庫あり (&gt;0)</option>
                  <option value="LOW_STOCK">要発注 (在庫少)</option>
                  <option value="OUT_OF_STOCK">在庫ゼロ</option>
                </select>
              </div>
            </div>

            {/* Filter Reset Indicator */}
            {isFiltered && (
              <div className="flex items-center justify-between pt-1 text-[11px] text-blue-400 border-t border-slate-800/80">
                <span>
                  絞り込み中: <strong>{filteredItems.length}</strong> 件該当 (全 {items.length} 件中)
                </span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-bold"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>条件クリア</span>
                </button>
              </div>
            )}
          </div>

          {/* Filtered Items List */}
          <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isSelected = Boolean(selectedItemIds[item.id]);
                const copies = printCopies[item.id] || 1;
                return (
                  <div
                    key={item.id}
                    className={`pt-2 p-2 rounded-xl transition flex items-center justify-between gap-3 text-xs ${
                      isSelected ? 'bg-blue-950/40 border border-blue-500/30' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectItem(item.id)}
                        className="rounded border-slate-700 text-blue-600 focus:ring-blue-500 bg-slate-800 shrink-0"
                      />
                      <div className="truncate min-w-0 flex-1">
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-1 rounded shrink-0">
                            {item.code}
                          </span>
                          <strong className="text-white truncate">{item.name}</strong>
                          {item.spec && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold shrink-0">
                              {item.spec}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 truncate">
                          <span className="text-indigo-300 font-mono">📦 {item.location}</span>
                          {item.supplier && <span>🏢 {item.supplier}</span>}
                          <span className="text-slate-500">
                            在庫: {item.currentStock} {item.baseUnit}
                          </span>
                        </div>
                      </div>
                    </label>

                    {/* Copies stepper */}
                    {isSelected && (
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-700/80">
                        <span className="text-slate-400 text-[11px]">枚数:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={copies}
                          onChange={(e) =>
                            updateCopies(item.id, parseInt(e.target.value, 10) || 1)
                          }
                          className="w-12 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded text-amber-300 font-black text-center text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                <p>該当する品目が見つかりませんでした。</p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-blue-400 underline font-bold"
                >
                  検索フィルターをリセット
                </button>
              </div>
            )}
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
          showCutLines={showCutLines}
        />
      </div>
    </div>
  );
};
