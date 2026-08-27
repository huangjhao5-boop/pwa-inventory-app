import React, { useState, useEffect } from 'react';
import { UnitConversion } from '../../types/inventory';
import { audioHaptics } from '../../utils/audioHaptics';
import { Delete, Check } from 'lucide-react';

interface NumericKeypadProps {
  value: number;
  onChange: (val: number) => void;
  units: UnitConversion[];
  baseUnit: string;
  selectedUnit: string;
  onSelectUnit: (unit: string) => void;
  onConfirm: () => void;
  soundEnabled?: boolean;
  confirmLabel?: string;
  confirmColor?: string;
  maxStock?: number; // 出庫時の在庫上限チェック用
  isOutAction?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  units,
  baseUnit,
  selectedUnit,
  onSelectUnit,
  onConfirm,
  soundEnabled = true,
  confirmLabel = '確定',
  confirmColor = 'bg-blue-600 hover:bg-blue-500',
  maxStock,
  isOutAction = false,
}) => {
  // 初期入力フラグ（初期値1のとき、数字を押すと追記ではなく上書き置換する）
  const [isFirstInput, setIsFirstInput] = useState<boolean>(true);

  useEffect(() => {
    setIsFirstInput(true);
  }, [selectedUnit]);

  const currentConversion = units.find((u) => u.unit === selectedUnit) || {
    unit: baseUnit,
    multiplier: 1,
  };
  const baseQuantity = value * currentConversion.multiplier;
  const isStockExceeded = isOutAction && maxStock !== undefined && baseQuantity > maxStock;

  const handleDigit = (digit: string) => {
    audioHaptics.playClick(soundEnabled);
    let newNum = 0;
    if (isFirstInput) {
      // 最初の入力時はデフォルト値（1など）を置換
      newNum = parseInt(digit, 10);
      setIsFirstInput(false);
    } else {
      const str = String(value === 0 ? '' : value) + digit;
      newNum = Math.min(99999, parseInt(str || '0', 10));
    }
    onChange(newNum);
  };

  const handleClear = () => {
    audioHaptics.playClick(soundEnabled);
    setIsFirstInput(false);
    onChange(0);
  };

  const handleBackspace = () => {
    audioHaptics.playClick(soundEnabled);
    setIsFirstInput(false);
    const str = String(value);
    if (str.length <= 1) {
      onChange(0);
    } else {
      onChange(parseInt(str.slice(0, -1), 10));
    }
  };

  const handleQuickAdd = (add: number) => {
    audioHaptics.playClick(soundEnabled);
    setIsFirstInput(false);
    onChange(Math.max(1, value + add));
  };

  return (
    <div className="flex flex-col w-full select-none bg-slate-900 rounded-3xl p-3 sm:p-4 border border-slate-800 shadow-2xl">
      {/* 包装単位セレクタータブ (箱, 袋, パック, 個, etc.) */}
      <div className="flex items-center gap-1.5 mb-2.5 overflow-x-auto pb-1 scrollbar-none">
        {units.map((u) => {
          const isSelected = selectedUnit === u.unit;
          return (
            <button
              key={u.unit}
              type="button"
              onClick={() => {
                audioHaptics.playClick(soundEnabled);
                onSelectUnit(u.unit);
              }}
              className={`py-2 px-3.5 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/40 scale-[1.02]'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {u.unit}
              {u.multiplier > 1 && (
                <span className="ml-1 text-[10px] opacity-80 font-normal">
                  (×{u.multiplier})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 数量・換算値ディスプレイ */}
      <div className={`rounded-2xl p-3.5 border flex items-center justify-between mb-3 shadow-inner transition ${
        isStockExceeded ? 'bg-rose-950/40 border-rose-600/80' : 'bg-slate-950 border-slate-800'
      }`}>
        <div>
          <span className="text-xs text-slate-400 font-semibold block">入力数量</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              {value}
            </span>
            <span className="text-sm sm:text-base font-bold text-blue-400">
              {selectedUnit}
            </span>
          </div>
        </div>

        {/* 基準換算数量 & 在庫警告 */}
        <div className="text-right">
          <span className="text-[11px] text-slate-400 font-medium block">
            基準単位換算 ({baseUnit})
          </span>
          <span className={`text-xl sm:text-2xl font-black ${isStockExceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
            {baseQuantity}
            <span className="text-xs font-semibold text-slate-300 ml-1">{baseUnit}</span>
          </span>
          {isOutAction && maxStock !== undefined && (
            <div className="text-[10px] text-slate-400 mt-0.5">
              現在庫: <strong className="text-slate-200">{maxStock}</strong> {baseUnit}
            </div>
          )}
        </div>
      </div>

      {/* 在庫不足エラー警告バナー */}
      {isStockExceeded && (
        <div className="mb-2.5 px-3 py-1.5 bg-rose-950/80 border border-rose-600 rounded-xl text-xs text-rose-200 font-bold text-center animate-pulse">
          ⚠️ 出庫数 ({baseQuantity} {baseUnit}) が現在庫 ({maxStock} {baseUnit}) を超過しています！
        </div>
      )}

      {/* クイック加算ボタン (+1, +5, +10, +50, +100) */}
      <div className="grid grid-cols-5 gap-1.5 mb-2.5">
        {[1, 5, 10, 50, 100].map((add) => (
          <button
            key={add}
            type="button"
            onClick={() => handleQuickAdd(add)}
            className="py-1.5 bg-slate-800/70 hover:bg-slate-700 active:scale-95 border border-slate-700/60 rounded-xl text-xs font-bold text-slate-200 transition"
          >
            +{add}
          </button>
        ))}
      </div>

      {/* テンキーグリッド (1~9, C, 0, ⌫) */}
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
          <button
            key={num}
            type="button"
            onClick={() => handleDigit(num)}
            className="h-14 sm:h-16 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-extrabold text-2xl rounded-2xl border border-slate-700 shadow-md transition flex items-center justify-center"
          >
            {num}
          </button>
        ))}

        {/* Clear */}
        <button
          type="button"
          onClick={handleClear}
          className="h-14 sm:h-16 bg-rose-950/40 hover:bg-rose-900/60 active:scale-95 text-rose-300 font-bold text-base rounded-2xl border border-rose-800/50 shadow-md transition flex items-center justify-center"
        >
          C
        </button>

        {/* 0 */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-14 sm:h-16 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-extrabold text-2xl rounded-2xl border border-slate-700 shadow-md transition flex items-center justify-center"
        >
          0
        </button>

        {/* Backspace */}
        <button
          type="button"
          onClick={handleBackspace}
          className="h-14 sm:h-16 bg-slate-800/80 hover:bg-slate-700 active:scale-95 text-slate-300 rounded-2xl border border-slate-700 shadow-md transition flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {/* 確定ボタン */}
      <button
        type="button"
        onClick={() => {
          audioHaptics.playClick(soundEnabled);
          onConfirm();
        }}
        disabled={value <= 0 || isStockExceeded}
        className={`mt-3 w-full h-14 sm:h-16 ${confirmColor} disabled:opacity-40 disabled:pointer-events-none text-white font-black text-lg sm:text-xl rounded-2xl shadow-xl shadow-blue-950/50 active:scale-[0.98] transition flex items-center justify-center gap-2`}
      >
        <Check className="w-6 h-6 stroke-[3]" />
        <span>{confirmLabel}</span>
      </button>
    </div>
  );
};
