import React from 'react';
import { ItemMaster, LabelLayout } from '../../types/inventory';
import { QRCodeSVG } from 'qrcode.react';
import { Scissors } from 'lucide-react';

interface LabelSheetPreviewProps {
  items: { item: ItemMaster; printCount: number }[];
  layout: LabelLayout;
  pureQrOnly?: boolean;
  showCutLines?: boolean;
}

export const LabelSheetPreview: React.FC<LabelSheetPreviewProps> = ({
  items,
  layout,
  pureQrOnly = false,
  showCutLines = true,
}) => {
  // Flatten items according to printCount
  const flattenedList: ItemMaster[] = [];
  items.forEach(({ item, printCount }) => {
    for (let i = 0; i < printCount; i++) {
      flattenedList.push(item);
    }
  });

  if (flattenedList.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        印刷対象の品目が選択されていません
      </div>
    );
  }

  const is24 = layout === 'A-ONE-24';
  const is44 = layout === 'A-ONE-44';

  return (
    <div className="bg-slate-900/50 p-4 rounded-3xl border border-slate-800">
      <div
        id="printable-label-sheet"
        className="print-container bg-white text-slate-900 p-4 sm:p-6 rounded-2xl shadow-2xl mx-auto overflow-hidden"
      >
        {/* Printable Grid */}
        <div
          className={`grid gap-2 sm:gap-2.5 ${
            is24
              ? 'grid-cols-2 sm:grid-cols-3'
              : is44
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-1 max-w-sm mx-auto'
          }`}
        >
          {flattenedList.map((item, idx) => {
            const qrText = item.code;
            return (
              <div
                key={idx}
                className={`relative p-2 flex items-center bg-white transition ${
                  showCutLines
                    ? 'border-2 border-dashed border-slate-400/90 rounded-lg'
                    : 'border border-slate-200 rounded-lg'
                } ${
                  pureQrOnly ? 'justify-center p-3' : 'gap-2'
                } ${
                  is24 ? 'min-h-[95px]' : is44 ? 'min-h-[75px]' : 'min-h-[110px]'
                }`}
              >
                {/* ✂️ Corner Cutting Mark Guide */}
                {showCutLines && (
                  <span
                    className="absolute -top-2 -left-1 text-[10px] text-slate-400 bg-white px-0.5 leading-none select-none print:text-slate-500 flex items-center gap-0.5 pointer-events-none"
                    title="キリトリ線"
                  >
                    <Scissors className="w-2.5 h-2.5 text-slate-400 rotate-90" />
                  </span>
                )}

                {/* Pure QR code */}
                <div className="shrink-0 bg-white p-0.5 flex flex-col items-center justify-center">
                  <QRCodeSVG
                    value={qrText}
                    size={pureQrOnly ? (is44 ? 58 : is24 ? 80 : 100) : (is44 ? 44 : is24 ? 56 : 72)}
                    level="M"
                    includeMargin={true}
                  />
                </div>

                {/* Info Text (Hidden when pureQrOnly is true) */}
                {!pureQrOnly && (
                  <div className="flex-1 min-w-0 leading-tight">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[9px] font-bold text-slate-500 truncate">
                        {item.code}
                      </span>
                      <span className="text-[8.5px] font-extrabold px-1 bg-slate-100 rounded text-blue-700 truncate">
                        {item.location}
                      </span>
                    </div>

                    <h5
                      className={`font-black text-slate-900 truncate mt-0.5 ${
                        is44 ? 'text-[11px]' : 'text-xs'
                      }`}
                    >
                      {item.name}
                    </h5>

                    {item.spec && (
                      <div className="text-[9.5px] font-mono font-bold text-amber-800 bg-amber-50/80 px-1 py-0.5 rounded truncate mt-0.5 border border-amber-200/50">
                        {item.spec}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[9px] text-slate-600 truncate mt-0.5">
                      {item.supplier && (
                        <span className="font-bold text-blue-700 truncate">{item.supplier}</span>
                      )}
                      <span className="text-slate-400 font-mono text-[8px] truncate">{qrText}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
