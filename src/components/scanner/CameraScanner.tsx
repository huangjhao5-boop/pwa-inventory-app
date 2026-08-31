import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster } from '../../types/inventory';
import {
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Keyboard,
  Zap,
  Search,
  X,
  Box,
  Building2,
  PlusCircle,
} from 'lucide-react';

interface CameraScannerProps {
  onScan?: (code: string) => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({ onScan }) => {
  const { items, openBottomSheet } = useInventory();
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-viewport';
  const lastScannedRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  const onCodeDetected = useCallback(
    (decodedText: string) => {
      const now = Date.now();
      const isSameCode = lastScannedRef.current.code === decodedText;
      // 連続スキャン誤検知防止のため、最低3.0秒（同一品目は3.5秒）のバッファ間隔を設定
      const cooldown = isSameCode ? 3500 : 3000;

      if (now - lastScannedRef.current.time < cooldown) {
        return;
      }

      lastScannedRef.current = { code: decodedText, time: now };

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

      const html5QrCode = new Html5Qrcode(scannerContainerId, {
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        verbose: false,
      });
      qrScannerRef.current = html5QrCode;

      const config = {
        fps: 15, // 安定した 15fps で省電力・端末熱暴走/クラッシュ防止
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
        'カメラの起動中または権限が許可されていません。カメラを許可するか、下部の手動検索をご利用ください。'
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

  // リアルタイム品目クイック検索 (品名・規格型番・コード・棚番・メーカー)
  const query = manualCode.trim().toLowerCase();
  const searchResults: ItemMaster[] = useMemo(() => {
    if (!query) return [];
    return items
      .filter((item) => {
        const nameMatch = item.name?.toLowerCase().includes(query);
        const specMatch = item.spec?.toLowerCase().includes(query);
        const codeMatch = item.code?.toLowerCase().includes(query);
        const supplierMatch = item.supplier?.toLowerCase().includes(query);
        const locationMatch = item.location?.toLowerCase().includes(query);
        const categoryMatch = item.category?.toLowerCase().includes(query);
        return nameMatch || specMatch || codeMatch || supplierMatch || locationMatch || categoryMatch;
      })
      .slice(0, 8); // 画面を圧迫しないよう上位8件を表示
  }, [items, query]);

  const handleSelectItem = (item: ItemMaster) => {
    onCodeDetected(item.code);
    setManualCode('');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    // 第一候補があればそれを選択、なければ入力文字列そのものをスキャン結果として送信
    if (searchResults.length > 0) {
      handleSelectItem(searchResults[0]);
    } else {
      onCodeDetected(manualCode.trim());
      setManualCode('');
    }
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

      {/* Manual Search & Quick Retrieval Panel (バーコード読取不可時の手動検索) */}
      <div className="w-full mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowManualInput(!showManualInput)}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 py-1 transition"
          >
            <Keyboard className="w-4 h-4" />
            <span>{showManualInput ? '手動検索を閉じる' : '⚡ 読めない時は手動検索 / コード直接入力'}</span>
          </button>

          {showManualInput && query && (
            <span className="text-[11px] text-slate-400 font-bold">
              該当 <strong className="text-amber-400">{searchResults.length}</strong> 件
            </span>
          )}
        </div>

        {showManualInput && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Input Bar */}
            <form onSubmit={handleManualSubmit} className="relative flex gap-2 w-full">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="品名・規格型番・コード・棚番で高速検索..."
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 font-sans shadow-inner"
                  autoFocus
                />
                {manualCode && (
                  <button
                    type="button"
                    onClick={() => setManualCode('')}
                    className="p-1 text-slate-400 hover:text-white absolute right-2.5 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm transition shrink-0 shadow-lg shadow-blue-950/60"
              >
                決定
              </button>
            </form>

            {/* Live Search Suggestions Dropdown */}
            {query && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-2 shadow-2xl space-y-1.5 max-h-72 overflow-y-auto">
                {searchResults.length > 0 ? (
                  searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      className="w-full text-left p-2.5 rounded-xl bg-slate-950/80 hover:bg-blue-950/70 border border-slate-800 hover:border-blue-700 transition flex items-start justify-between gap-3 group active:scale-[0.99]"
                    >
                      <div className="flex-1 min-w-0">
                        {/* Name & Code */}
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-bold text-sm text-white group-hover:text-blue-300 transition truncate">
                            {item.name}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px] font-bold border border-slate-700">
                            {item.code}
                          </span>
                        </div>

                        {/* Spec Badge & Supplier */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          {item.spec && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold font-mono">
                              規格: {item.spec}
                            </span>
                          )}
                          {item.supplier && (
                            <span className="text-slate-400 flex items-center gap-0.5 text-[11px]">
                              <Building2 className="w-3 h-3 text-blue-400" />
                              <span>{item.supplier}</span>
                            </span>
                          )}
                          <span className="text-blue-300 flex items-center gap-0.5 text-[11px]">
                            <Box className="w-3 h-3 text-blue-400" />
                            <span>{item.location || '棚未設定'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Stock count */}
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 block">現在庫</span>
                        <span className="text-sm font-black text-amber-400">
                          {item.currentStock} <span className="text-xs text-slate-300 font-normal">{item.baseUnit}</span>
                        </span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      「<strong className="text-white">{manualCode}</strong>」に一致する登録済品目はありません
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onCodeDetected(manualCode.trim());
                        setManualCode('');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>このコードで新規品目登録へ</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
