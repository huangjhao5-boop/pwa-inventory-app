import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { CameraScanner } from '../scanner/CameraScanner';
import {
  ListChecks,
  Trash2,
  Send,
  Plus,
  Minus,
  ArrowDownCircle,
  ArrowUpCircle,
  Scan,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export const BatchScanView: React.FC = () => {
  const {
    batchScanList,
    updateBatchItem,
    removeBatchItem,
    clearBatchList,
    commitBatchList,
  } = useInventory();

  const [showScanner, setShowScanner] = useState(true);
  const [defaultAction, setDefaultAction] = useState<'IN' | 'OUT'>('IN');

  const totalBaseUnits = batchScanList.reduce(
    (acc, curr) => acc + curr.calculatedBaseQuantity,
    0
  );

  const handleCommit = async () => {
    const success = await commitBatchList();
    if (success) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Top Banner / Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
              <ListChecks className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl text-white">
                批次連続検品・確認リスト
              </h2>
              <p className="text-xs text-slate-400">
                連続スキャンで仮登録し、リスト上で数量・単位を修正して一括送信
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Selector for New Scans */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 self-stretch sm:self-auto justify-center">
          <button
            onClick={() => setDefaultAction('IN')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              defaultAction === 'IN'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>入荷一括</span>
          </button>
          <button
            onClick={() => setDefaultAction('OUT')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              defaultAction === 'OUT'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpCircle className="w-4 h-4" />
            <span>払出一括</span>
          </button>
        </div>
      </div>

      {/* Embedded Scanner Accordion */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <button
          onClick={() => setShowScanner(!showScanner)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left font-bold text-sm text-slate-200 hover:bg-slate-800/60 transition"
        >
          <div className="flex items-center gap-2">
            <Scan className="w-4 h-4 text-blue-400" />
            <span>{showScanner ? 'カメラリーダーを最小化' : 'カメラリーダーを展開してスキャン'}</span>
          </div>
          <span className="text-xs text-blue-400">{showScanner ? '閉じる ▲' : '開く ▼'}</span>
        </button>

        {showScanner && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
            <CameraScanner />
          </div>
        )}
      </div>

      {/* Verification List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
            <span>検品待機品目:</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs">
              {batchScanList.length} 件
            </span>
            <span className="text-xs text-slate-500">
              (合計換算: <strong className="text-emerald-400">{totalBaseUnits}</strong> 基準単位)
            </span>
          </div>

          {batchScanList.length > 0 && (
            <button
              onClick={clearBatchList}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>全件クリア</span>
            </button>
          )}
        </div>

        {batchScanList.length === 0 ? (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-2">
            <ListChecks className="w-12 h-12 text-slate-600 mx-auto" />
            <p className="text-slate-400 font-semibold text-sm">検品リストは空です</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              カメラまたはバーコードスキャナーで商品を連続スキャンすると、ここに自動でリストアップされます。
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {batchScanList.map((batchItem, index) => {
              const { item, actionType, selectedUnit, enteredQuantity, calculatedBaseQuantity } =
                batchItem;
              return (
                <div
                  key={batchItem.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1"
                >
                  {/* Left: Item Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500 font-mono">
                        #{index + 1}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                          actionType === 'IN'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {actionType === 'IN' ? '入荷' : '払出'}
                      </span>
                      <span className="text-xs text-slate-400 font-mono truncate">{item.code}</span>
                      <span className="text-[11px] text-blue-400 font-medium ml-auto sm:ml-0">
                        棚: {item.location}
                      </span>
                    </div>

                    <h4 className="font-extrabold text-sm sm:text-base text-white truncate mt-1">
                      {item.name}
                    </h4>
                    {item.spec && (
                      <p className="text-xs text-slate-400 truncate">{item.spec}</p>
                    )}
                  </div>

                  {/* Right: Quantity & Unit Modifier Controls */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                    {/* Unit Selector */}
                    <select
                      value={selectedUnit}
                      onChange={(e) =>
                        updateBatchItem(batchItem.id, { selectedUnit: e.target.value })
                      }
                      className="px-2.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-blue-500"
                    >
                      {item.unitConversions?.map((c) => (
                        <option key={c.unit} value={c.unit}>
                          {c.unit} (x{c.multiplier})
                        </option>
                      ))}
                      {!item.unitConversions?.some((c) => c.unit === item.baseUnit) && (
                        <option value={item.baseUnit}>{item.baseUnit}</option>
                      )}
                    </select>

                    {/* Quantity Stepper */}
                    <div className="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateBatchItem(batchItem.id, {
                            enteredQuantity: Math.max(1, enteredQuantity - 1),
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        value={enteredQuantity}
                        onChange={(e) =>
                          updateBatchItem(batchItem.id, {
                            enteredQuantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-12 text-center bg-transparent font-extrabold text-sm text-white focus:outline-none"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          updateBatchItem(batchItem.id, {
                            enteredQuantity: enteredQuantity + 1,
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Calculated Base Display */}
                    <div className="text-right min-w-[70px]">
                      <span className="text-[10px] text-slate-500 block">基準換算</span>
                      <span className="font-extrabold text-xs text-emerald-400">
                        {calculatedBaseQuantity} {item.baseUnit}
                      </span>
                    </div>

                    {/* Delete Item */}
                    <button
                      onClick={() => removeBatchItem(batchItem.id)}
                      className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800/80 transition"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed / Sticky Bottom Submission Bar */}
      {batchScanList.length > 0 && (
        <div className="sticky bottom-16 md:bottom-4 z-20 bg-slate-900/95 backdrop-blur-md p-3.5 rounded-3xl border border-slate-700/80 shadow-2xl flex items-center justify-between gap-3">
          <div>
            <span className="text-xs text-slate-400 font-semibold block">送信予定</span>
            <div className="text-sm font-black text-white flex items-center gap-1.5">
              <span>{batchScanList.length} 件</span>
              <span className="text-xs text-emerald-400 font-bold">
                (計 {totalBaseUnits} 基準単位)
              </span>
            </div>
          </div>

          <button
            onClick={handleCommit}
            className="flex-1 max-w-xs h-12 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-emerald-950/60 transition flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" />
            <span>整批核對送出 (一括実行)</span>
          </button>
        </div>
      )}
    </div>
  );
};
