import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { LabelLayout } from '../../types/inventory';
import { LabelSheetPreview } from './LabelSheetPreview';
import { Printer, CheckSquare, Layers } from 'lucide-react';

export const LabelPrinter: React.FC = () => {
  const { items } = useInventory();
  const [layout, setLayout] = useState<LabelLayout>('A-ONE-24');
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
                QR ラベル一括印刷 (Label Printer)
              </h2>
              <p className="text-xs text-slate-400">
                市販のA4ラベルシール・耐水透明封膜に対応 / 一般プリンターから直接印刷可能
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handlePrint}
            disabled={totalLabels === 0}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-50 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-blue-950 transition"
          >
            <Printer className="w-4 h-4 stroke-[2.5]" />
            <span>印刷ダイアログを開く ({totalLabels} 枚)</span>
          </button>
        </div>
      </div>

      {/* Settings & Item Selection Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 print:hidden">
        {/* Left Column: Layout selector & Options */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-4 shadow-lg">
          <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <span>ラベル用紙規格の選択</span>
          </h3>

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

          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300">💡 印刷のヒント:</p>
            <p>・市販の耐水・耐擦傷フィルムラベル紙を使用すると、長期間油や水濡れから保護できます。</p>
            <p>・ブラウザの印刷設定で「拡大/縮小: 100% (規定値)」を選択してください。</p>
          </div>
        </div>

        {/* Right Column (2 cols): Item Selection List */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-lg flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200">印刷する品目を選択</h3>
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
          📄 印刷プレビュー ({layout})
        </h3>
        <LabelSheetPreview items={selectedItemsWithCopies} layout={layout} />
      </div>
    </div>
  );
};
