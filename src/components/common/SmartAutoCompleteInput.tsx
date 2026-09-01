import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';

interface SmartAutoCompleteInputProps {
  label: string;
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  candidates: string[]; // Database items, OCR words, preset domain words
  className?: string;
  inputClassName?: string;
  onSelectCandidate?: (val: string) => void;
}

export const SmartAutoCompleteInput: React.FC<SmartAutoCompleteInputProps> = ({
  label,
  required,
  value,
  onChange,
  placeholder,
  candidates,
  className = '',
  inputClassName = '',
  onSelectCandidate,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter candidates matching typed value
  const filteredCandidates = useMemo(() => {
    const cleanVal = value.trim().toLowerCase();
    const unique = Array.from(new Set(candidates.filter(Boolean)));
    if (!cleanVal) {
      return unique.slice(0, 8);
    }
    return unique
      .filter((c) => c.toLowerCase().includes(cleanVal) && c.toLowerCase() !== cleanVal)
      .slice(0, 10);
  }, [candidates, value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (cand: string) => {
    onChange(cand);
    if (onSelectCandidate) onSelectCandidate(cand);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="block text-xs font-bold text-slate-300 mb-1">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-indigo-500 transition ${inputClassName}`}
        />

        {filteredCandidates.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Quick Suggestion Pills under input if matching items exist */}
      {filteredCandidates.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 max-h-16 overflow-y-auto">
          <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-0.5">
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            候補:
          </span>
          {filteredCandidates.slice(0, 4).map((cand) => (
            <button
              key={cand}
              type="button"
              onClick={() => handleSelect(cand)}
              className="px-2 py-0.5 rounded-md bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-500/40 text-[10px] font-bold transition active:scale-95 shrink-0"
            >
              {cand}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown Suggestions List when active */}
      {isOpen && filteredCandidates.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-indigo-500/60 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1">
          <div className="p-1 text-[10px] font-bold text-slate-400 bg-slate-950 px-2 border-b border-slate-800 flex items-center justify-between">
            <span>🔍 予測・履歴キーワード候補</span>
            <span>タップして適用</span>
          </div>
          {filteredCandidates.map((cand) => (
            <button
              key={cand}
              type="button"
              onClick={() => handleSelect(cand)}
              className="w-full text-left px-3 py-2 text-xs font-bold text-slate-200 hover:bg-indigo-600 hover:text-white flex items-center justify-between border-b border-slate-800/50 last:border-0 transition"
            >
              <span>{cand}</span>
              <span className="text-[10px] opacity-75 font-mono">⏎ 適用</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
