import React from 'react';
import { ItemMaster, LabelLayout } from '../../types/inventory';
import { QRCodeSVG } from 'qrcode.react';

interface LabelSheetPreviewProps {
  items: { item: ItemMaster; printCount: number }[];
  layout: LabelLayout;
}

export const LabelSheetPreview: React.FC<LabelSheetPreviewProps> = ({ items, layout }) => {
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
      <div className="print-container bg-white text-slate-900 p-4 sm:p-6 rounded-2xl shadow-2xl mx-auto overflow-hidden">
        {/* Printable Grid */}
        <div
          className={`grid gap-1.5 sm:gap-2 ${
            is24
              ? 'grid-cols-2 sm:grid-cols-3'
              : is44
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-1 max-w-sm mx-auto'
          }`}
        >
          {flattenedList.map((item, idx) => {
            const qrText = item.qrCode || `INV:v1:${item.code}`;
            return (
              <div
                key={idx}
                className={`border border-slate-300 rounded-lg p-2 flex items-center gap-2 bg-white ${
                  is24 ? 'min-h-[90px]' : is44 ? 'min-h-[70px]' : 'min-h-[110px]'
                }`}
              >
                {/* QR Code */}
                <div className="shrink-0 bg-white p-0.5">
                  <QRCodeSVG
                    value={qrText}
                    size={is44 ? 42 : is24 ? 54 : 72}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Info Text */}
                <div className="flex-1 min-w-0 leading-tight">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[9px] font-bold text-slate-500 truncate">
                      {item.code}
                    </span>
                    <span className="text-[9px] font-extrabold px-1 bg-slate-100 rounded text-blue-700">
                      盒號: {item.location}
                    </span>
                  </div>

                  <h5
                    className={`font-black text-slate-900 truncate mt-0.5 ${
                      is44 ? 'text-[11px]' : 'text-xs'
                    }`}
                  >
                    {item.name}
                  </h5>

                  <div className="flex items-center justify-between text-[9px] text-slate-600 truncate mt-0.5">
                    {item.supplier ? <span className="font-bold text-blue-700">{item.supplier}</span> : <span></span>}
                    {item.spec && <span>{item.spec}</span>}
                  </div>

                  <div className="text-[8px] text-slate-400 font-mono mt-0.5 truncate">
                    {qrText}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
