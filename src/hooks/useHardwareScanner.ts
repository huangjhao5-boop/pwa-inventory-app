import { useEffect, useRef } from 'react';

interface HardwareScannerOptions {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  enabled?: boolean;
}

/**
 * 實體藍牙/工業 PDA 雷射掃描槍全域鍵盤監聽 Hook
 */
export function useHardwareScanner({
  onScan,
  minChars = 3,
  maxIntervalMs = 50,
  enabled = true,
}: HardwareScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // ユーザーが通常の input/textarea にフォーカスして入力している場合はスキップ
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Enter キーでスキャン完了と判定
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minChars) {
          e.preventDefault();
          const scannedCode = bufferRef.current.trim();
          bufferRef.current = '';
          onScan(scannedCode);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // 印字可能文字かつ高速入力（50ms以内）またはバッファ開始
      if (e.key.length === 1) {
        if (interval > maxIntervalMs && bufferRef.current.length > 0) {
          // 手入力の遅延と判断してバッファをリセット
          bufferRef.current = '';
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, minChars, maxIntervalMs, onScan]);
}
