import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Crop, X, Sparkles } from 'lucide-react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string;
  onCropComplete: (croppedBase64: string) => void;
  onCancel: () => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  isOpen,
  imageSrc,
  onCropComplete,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Normalized crop coordinates [0.0 ~ 1.0] relative to image
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.8,
  });

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragHandle, setDragHandle] = useState<'MOVE' | 'NW' | 'NE' | 'SW' | 'SE' | null>(null);
  const startPosRef = useRef<{ clientX: number; clientY: number; initialCrop: typeof crop }>({
    clientX: 0,
    clientY: 0,
    initialCrop: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
  });

  // Reset crop when image changes
  useEffect(() => {
    if (isOpen) {
      setCrop({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    }
  }, [isOpen, imageSrc]);

  // Touch / Mouse Drag handlers
  const handlePointerDown = (handle: 'MOVE' | 'NW' | 'NE' | 'SW' | 'SE', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);
    startPosRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      initialCrop: { ...crop },
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragHandle || !imageRef.current) return;
    e.preventDefault();

    const rect = imageRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const deltaX = (e.clientX - startPosRef.current.clientX) / rect.width;
    const deltaY = (e.clientY - startPosRef.current.clientY) / rect.height;
    const init = startPosRef.current.initialCrop;

    let next = { ...crop };

    if (dragHandle === 'MOVE') {
      next.x = Math.max(0, Math.min(1 - init.width, init.x + deltaX));
      next.y = Math.max(0, Math.min(1 - init.height, init.y + deltaY));
    } else if (dragHandle === 'SE') {
      next.width = Math.max(0.15, Math.min(1 - init.x, init.width + deltaX));
      next.height = Math.max(0.15, Math.min(1 - init.y, init.height + deltaY));
    } else if (dragHandle === 'NW') {
      const newX = Math.max(0, Math.min(init.x + init.width - 0.15, init.x + deltaX));
      const newY = Math.max(0, Math.min(init.y + init.height - 0.15, init.y + deltaY));
      next.width = init.width + (init.x - newX);
      next.height = init.height + (init.y - newY);
      next.x = newX;
      next.y = newY;
    } else if (dragHandle === 'NE') {
      const newY = Math.max(0, Math.min(init.y + init.height - 0.15, init.y + deltaY));
      next.width = Math.max(0.15, Math.min(1 - init.x, init.width + deltaX));
      next.height = init.height + (init.y - newY);
      next.y = newY;
    } else if (dragHandle === 'SW') {
      const newX = Math.max(0, Math.min(init.x + init.width - 0.15, init.x + deltaX));
      next.width = init.width + (init.x - newX);
      next.height = Math.max(0.15, Math.min(1 - init.y, init.height + deltaY));
      next.x = newX;
    }

    setCrop(next);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    setDragHandle(null);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  // Perform actual canvas crop
  const executeCrop = useCallback(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return onCropComplete(imageSrc);

      // Handle rotation if applied
      let srcWidth = img.naturalWidth || img.width;
      let srcHeight = img.naturalHeight || img.height;

      // Crop coordinates in original image pixel dimensions
      const cropPxX = Math.round(crop.x * srcWidth);
      const cropPxY = Math.round(crop.y * srcHeight);
      const cropPxW = Math.round(crop.width * srcWidth);
      const cropPxH = Math.round(crop.height * srcHeight);

      // Target canvas
      const maxDim = 800;
      let targetW = cropPxW;
      let targetH = cropPxH;
      if (targetW > maxDim || targetH > maxDim) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * maxDim) / targetW);
          targetW = maxDim;
        } else {
          targetW = Math.round((targetW * maxDim) / targetH);
          targetH = maxDim;
        }
      }

      canvas.width = targetW;
      canvas.height = targetH;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw cropped slice
      ctx.drawImage(
        img,
        cropPxX,
        cropPxY,
        cropPxW,
        cropPxH,
        0,
        0,
        targetW,
        targetH
      );

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
      onCropComplete(croppedBase64);
    };
    img.onerror = () => onCropComplete(imageSrc);
    img.src = imageSrc;
  }, [crop, imageSrc, onCropComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-indigo-950/40">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Crop className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <span>🎯 認識対象を枠で囲む (トリミング)</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                余分な背景を除外し、部品本体や銘板ラベルだけを囲むと認識率が大幅に向上します
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Viewport Area */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-hidden select-none min-h-[320px] max-h-[55vh]"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="relative inline-block max-w-full max-h-full">
            <img
              ref={imageRef}
              src={imageSrc}
              alt="トリミング対象"
              className="max-h-[50vh] max-w-full object-contain rounded-xl shadow-lg pointer-events-none"
              draggable={false}
            />

            {/* Dark Mask Overlay with Cutout Bounding Box */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(to right, rgba(0,0,0,0.6) ${crop.x * 100}%, transparent ${crop.x * 100}%, transparent ${(crop.x + crop.width) * 100}%, rgba(0,0,0,0.6) ${(crop.x + crop.width) * 100}%)`,
              }}
            />

            {/* Active Bounding Crop Box */}
            <div
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
              onPointerDown={(e) => handlePointerDown('MOVE', e)}
              className="absolute border-2 border-amber-400 bg-amber-400/10 cursor-move shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] rounded-lg touch-none"
            >
              {/* Center crosshair / guide */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                <div className="border-r border-b border-white/60"></div>
                <div className="border-r border-b border-white/60"></div>
                <div className="border-b border-white/60"></div>
                <div className="border-r border-b border-white/60"></div>
                <div className="border-r border-b border-white/60"></div>
                <div className="border-b border-white/60"></div>
                <div className="border-r border-white/60"></div>
                <div className="border-r border-white/60"></div>
                <div></div>
              </div>

              {/* Bounding Box Label */}
              <div className="absolute -top-6 left-0 bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md shadow pointer-events-none">
                AI解析対象エリア (ドラッグで移動)
              </div>

              {/* 4 Corner Handles */}
              <div
                onPointerDown={(e) => handlePointerDown('NW', e)}
                className="absolute -top-2.5 -left-2.5 w-6 h-6 bg-amber-400 border-2 border-slate-900 rounded-full cursor-nwse-resize shadow-md touch-none"
              />
              <div
                onPointerDown={(e) => handlePointerDown('NE', e)}
                className="absolute -top-2.5 -right-2.5 w-6 h-6 bg-amber-400 border-2 border-slate-900 rounded-full cursor-nesw-resize shadow-md touch-none"
              />
              <div
                onPointerDown={(e) => handlePointerDown('SW', e)}
                className="absolute -bottom-2.5 -left-2.5 w-6 h-6 bg-amber-400 border-2 border-slate-900 rounded-full cursor-nesw-resize shadow-md touch-none"
              />
              <div
                onPointerDown={(e) => handlePointerDown('SE', e)}
                className="absolute -bottom-2.5 -right-2.5 w-6 h-6 bg-amber-400 border-2 border-slate-900 rounded-full cursor-nwse-resize shadow-md touch-none"
              />
            </div>
          </div>
        </div>

        {/* Bottom Quick Preset Controls */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-bold text-[11px] shrink-0">枠プリセット:</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setCrop({ x: 0.0, y: 0.0, width: 1.0, height: 1.0 })}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition text-[11px]"
              >
                全体 (100%)
              </button>
              <button
                type="button"
                onClick={() => setCrop({ x: 0.15, y: 0.15, width: 0.7, height: 0.7 })}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition text-[11px]"
              >
                中央部品 (70%)
              </button>
              <button
                type="button"
                onClick={() => setCrop({ x: 0.2, y: 0.3, width: 0.6, height: 0.4 })}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-bold transition text-[11px]"
              >
                銘板・ラベル枠 (横長)
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => onCropComplete(imageSrc)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
            >
              切り抜かず全体で解析
            </button>

            <button
              type="button"
              onClick={executeCrop}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-95 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-950/60 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>🎯 この枠内をAI高精度解析（決定）</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
