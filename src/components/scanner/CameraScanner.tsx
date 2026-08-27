import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useInventory } from '../../context/InventoryContext';
import {
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Keyboard,
  Zap,
} from 'lucide-react';

interface CameraScannerProps {
  onScan?: (code: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan }) => {
  const { openBottomSheet } = useInventory();
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-viewport';

  const onCodeDetected = useCallback(
    (decodedText: string) => {
      if (onScan) {
        onScan(decodedText);
      } else {
        openBottomSheet(decodedText);
      }
    },
    [onScan, openBottomSheet]
  );

  const startScanner = useCallback(async () => {
    try {
      setErrorMessage(null);
      if (qrScannerRef.current) {
        try {
          await qrScannerRef.current.stop();
        } catch {
          // ignore
        }
      }

      // Enable native hardware GPU BarcodeDetector for ultra-fast scanning
      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });
      qrScannerRef.current = html5QrCode;

      const config = {
        fps: 30, // Ultra-fast 30fps stream
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.max(220, Math.floor(minEdge * 0.85));
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          onCodeDetected(decodedText);
        },
        () => {
          // scanning frame
        }
      );

      setIsScanning(true);

      // Check Torch capabilities
      try {
        const videoTrack = (html5QrCode as any).videoTrack as MediaStreamTrack | undefined;
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          const caps = (videoTrack.getCapabilities() as any) || {};
          if (caps.torch) {
            setHasTorch(true);
          }
        }
      } catch (e) {
        console.debug('Torch capability check failed:', e);
      }
    } catch (err: any) {
      console.warn('Camera start warning:', err);
      setErrorMessage(
        'カメラの起動中または権限が許可されていません。カメラを許可するか、下部の「手動入力・テストコード」をご利用ください。'
      );
      setIsScanning(false);
    }
  }, [onCodeDetected]);

  const stopScanner = useCallback(async () => {
    if (qrScannerRef.current && isScanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (e) {
        console.error('Stop scanner error:', e);
      }
      setIsScanning(false);
    }
  }, [isScanning]);

  const toggleTorch = async () => {
    if (!qrScannerRef.current) return;
    try {
      const videoTrack = (qrScannerRef.current as any).videoTrack as MediaStreamTrack | undefined;
      if (videoTrack) {
        const nextState = !isTorchOn;
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      }
    } catch (e) {
      console.error('Torch toggle failed:', e);
    }
  };

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [startScanner, stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onCodeDetected(manualCode.trim());
    setManualCode('');
  };

  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto p-3">
      {/* Scanner Box */}
      <div className="relative w-full aspect-square max-w-[340px] sm:max-w-[380px] bg-slate-900 rounded-3xl overflow-hidden border-2 border-slate-700 shadow-2xl">
        <div id={scannerContainerId} className="w-full h-full object-cover" />

        {/* Viewfinder Target Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-64 h-64 border-2 border-blue-400/80 rounded-2xl">
            {/* Corner Markers */}
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />

            {/* Animated Laser Scanning Line */}
            <div className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-pulse top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Top Controls on Camera */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`p-2.5 rounded-full backdrop-blur-md border transition ${
                isTorchOn
                  ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/50'
                  : 'bg-slate-900/80 text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
              title="ライト点灯"
            >
              {isTorchOn ? <Flashlight className="w-5 h-5" /> : <FlashlightOff className="w-5 h-5" />}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                stopScanner().then(() => startScanner());
              }}
              className="p-2.5 rounded-full bg-slate-900/80 text-slate-200 border border-slate-700 hover:bg-slate-800 backdrop-blur-md"
              title="カメラ再起動"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Hint on Camera */}
        <div className="absolute bottom-3 inset-x-4 flex items-center justify-center">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-950/80 text-slate-200 border border-slate-700/80 backdrop-blur">
            バーコードまたはQRコードを枠内にかざしてください
          </span>
        </div>
      </div>

      {/* Error / Fallback Notice */}
      {errorMessage && (
        <div className="mt-3 p-3 bg-rose-950/60 border border-rose-700/60 rounded-xl text-xs text-rose-200 text-center w-full">
          {errorMessage}
        </div>
      )}

      {/* Hardware Gun Hint */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
        <Zap className="w-4 h-4 text-amber-400" />
        <span>Bluetooth・USBバーコードリーダーの直接入力に対応</span>
      </div>

      {/* Manual Input Toggle & Form */}
      <div className="w-full mt-3">
        <div className="flex justify-center">
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 py-1"
          >
            <Keyboard className="w-4 h-4" />
            <span>{showManualInput ? '手動入力を閉じる' : '手動入力 / テストバーコード'}</span>
          </button>
        </div>

        {showManualInput && (
          <form onSubmit={handleManualSubmit} className="mt-2 flex gap-2 w-full">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="品目コード / JANコード / QRコード内容..."
              className="flex-1 px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-sm transition"
            >
              送信
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
