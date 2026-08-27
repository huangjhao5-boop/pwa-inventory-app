import React, { useState } from 'react';
import { UnitConversion, PRESET_FRACTIONS } from '../../types/inventory';
import { audioHaptics } from '../../utils/audioHaptics';
import { Delete, Check, PieChart, Calculator } from 'lucide-react';

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
}) => {
  const [inputMode, setInputMode] = useState<'NUMERIC' | 'FRACTION'>('NUMERIC');

  const currentConversion = units.find((u) => u.unit === selectedUnit) || {
    unit: baseUnit,
    multiplier: 1,
  };
  const baseQuantity = value * currentConversion.multiplier;

  const handleDigit = (digit: string) => {
    audioHaptics.playClick(soundEnabled);
    const str = String(value === 0 ? '' : value) + digit;
    const num = Math.min(99999, parseInt(str || '0', 10));
    onChange(num);
  };

  const handleClear = () => {
    audioHaptics.playClick(soundEnabled);
    onChange(0);
  };

  const handleBackspace = () => {
    audioHaptics.playClick(soundEnabled);
    const str = String(value);
    if (str.length <= 1) {
      onChange(0);
    } else {
      onChange(parseInt(str.slice(0, -1), 10));
    }
  };

  const handleQuickAdd = (add: number) => {
    audioHaptics.playClick(soundEnabled);
    onChange(Math.max(1, value + add));
  };

  const handleApplyFraction = (ratio: number) => {
    audioHaptics.playClick(soundEnabled);
    // 選択中単位の倍率（例: 1袋=100本）に基づき、概算数量を自動算出
    const targetMultiplier = currentConversion.multiplier > 1 ? currentConversion.multiplier : 100;
    const approxQty = Math.max(1, Math.round(targetMultiplier * ratio));
    
    // 単位を基準単位に切り替えて概算値をセット
    onSelectUnit(baseUnit);
    onChange(approxQty);
  };

  return (
    <div className="flex flex-col w-full select-none bg-slate-900 rounded-3xl p-3 sm:p-4 border border-slate-800 shadow-2xl">
      {/* Packaging Unit Tabs (箱, 袋, パック, 個, etc.) */}
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
              className={`py-2 px-3 rounded-xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all border ${
                isSelected
                  ? 'bg-blue-600 border-blue-400 text-white shadow-md shadow-blue-900/40 scale-[1.02]'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {u.unit}
              {u.multiplier > 1 && (
                <span className="ml-1 text-[10px] opacity-80">
                  (×{u.multiplier})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Mode Switch: テンキー入力 ⇄ 目測割合・残量概算 */}
      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-2.5">
        <button
          type="button"
          onClick={() => setInputMode('NUMERIC')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            inputMode === 'NUMERIC'
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>数値テンキー</span>
        </button>
        <button
          type="button"
          onClick={() => setInputMode('FRACTION')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            inputMode === 'FRACTION'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-3.5 h-3.5 text-amber-300" />
          <span>目測残量・割合概算 (1/2, 3/4...)</span>
        </button>
      </div>

      {/* Value & Calculation Display */}
      <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 flex items-center justify-between mb-3 shadow-inner">
        <div>
          <span className="text-xs text-slate-400 font-semibold block">入力数量</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {value}
            </span>
            <span className="text-sm sm:text-base font-bold text-blue-400">
              {selectedUnit}
            </span>
          </div>
        </div>

        {/* Base Unit Calculation */}
        <div className="text-right">
          <span className="text-[11px] text-slate-500 font-medium block">
            基準単位換算 ({baseUnit})
          </span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400">
            {baseQuantity}
            <span className="text-xs font-semibold text-slate-300 ml-1">{baseUnit}</span>
          </span>
        </div>
      </div>

      {/* VIEW 1: 目測残量・割合入力モード (結束バンド・ネジ等の概算用) */}
      {inputMode === 'FRACTION' ? (
        <div className="space-y-2.5 py-1">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            結束バンドや端子パックなど、本数を1本ずつ数えられない場合は以下の目安ボタンをタップして概算数量を入力できます。
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_FRACTIONS.map((f) => {
              const targetMult = currentConversion.multiplier > 1 ? currentConversion.multiplier : 100;
              const approxQty = Math.max(1, Math.round(targetMult * f.ratio));
              return (
                <button
                  key={f.label}
                  type="button"
                  onClick={() => handleApplyFraction(f.ratio)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 active:scale-95 border border-slate-700 rounded-2xl flex flex-col items-start gap-0.5 transition shadow"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-extrabold text-xs text-white">{f.label}</span>
                    <span className="text-xs font-black text-emerald-400">
                      約 {approxQty} {baseUnit}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">{f.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* VIEW 2: 通常数値テンキーモード */
        <>
          {/* Quick Add Pills */}
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

          {/* Keypad Grid */}
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
        </>
      )}

      {/* Confirm Button */}
      <button
        type="button"
        onClick={() => {
          audioHaptics.playClick(soundEnabled);
          onConfirm();
        }}
        disabled={value <= 0}
        className={`mt-3 w-full h-14 sm:h-16 ${confirmColor} disabled:opacity-40 disabled:pointer-events-none text-white font-black text-lg sm:text-xl rounded-2xl shadow-xl shadow-blue-950/50 active:scale-[0.98] transition flex items-center justify-center gap-2`}
      >
        <Check className="w-6 h-6 stroke-[3]" />
        <span>{confirmLabel}</span>
      </button>
    </div>
  );
};
