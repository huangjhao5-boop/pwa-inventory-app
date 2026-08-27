import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster } from '../../types/inventory';
import { CsvHelper, PurchaseOrderItem } from '../../utils/csvHelper';
import { NakanishiOrderExcelExporter, formatReiwaDate } from '../../utils/nakanishiOrderExporter';
import {
  ShoppingCart,
  X,
  Copy,
  Printer,
  Trash2,
  Building2,
  Box,
  AlertTriangle,
  FileSpreadsheet,
  Check,
  FileText,
  Calendar,
  MapPin,
  Briefcase,
  Edit3,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedItems?: ItemMaster[];
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  initialSelectedItems = [],
}) => {
  const { items, settings, addToast } = useInventory();

  // Selected purchase order items state
  const [orderItems, setOrderItems] = useState<PurchaseOrderItem[]>(() => {
    return initialSelectedItems.map((item) => {
      const defaultConv = item.unitConversions?.[0] || { unit: item.baseUnit, multiplier: 1 };
      const deficit = Math.max(1, (item.safetyStock * 2) - item.currentStock);
      const orderQty = Math.max(1, Math.ceil(deficit / defaultConv.multiplier));
      const defaultModelText = item.spec ? `${item.name} ${item.spec}` : item.name;
      return {
        item,
        orderQuantity: orderQty,
        orderUnit: defaultConv.unit,
        calculatedBaseQuantity: orderQty * defaultConv.multiplier,
        note: defaultModelText,
      };
    });
  });

  // 中西電機工業 注文書固有のパラメータ
  const [jobCode, setJobCode] = useState('');
  const [desiredDelivery, setDesiredDelivery] = useState('大至急');
  const [deliveryLocation, setDeliveryLocation] = useState('事務所');
  const [recipientPerson, setRecipientPerson] = useState('林');

  const [copied, setCopied] = useState(false);
  const [orderNumber] = useState(() => `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`);

  if (!isOpen) return null;

  const handleUpdateQty = (index: number, qty: number) => {
    setOrderItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const conv = target.item.unitConversions?.find((c) => c.unit === target.orderUnit) || { multiplier: 1 };
      const validQty = Math.max(1, qty);
      next[index] = {
        ...target,
        orderQuantity: validQty,
        calculatedBaseQuantity: validQty * conv.multiplier,
      };
      return next;
    });
  };

  const handleUpdateUnit = (index: number, unit: string) => {
    setOrderItems((prev) => {
      const next = [...prev];
      const target = next[index];
      const conv = target.item.unitConversions?.find((c) => c.unit === unit) || { multiplier: 1 };
      next[index] = {
        ...target,
        orderUnit: unit,
        calculatedBaseQuantity: target.orderQuantity * conv.multiplier,
      };
      return next;
    });
  };

  const handleUpdateModelText = (index: number, text: string) => {
    setOrderItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], note: text };
      return next;
    });
  };

  const handleRemove = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddLowStockItems = () => {
    const lowStock = items.filter((i) => i.currentStock <= i.safetyStock);
    const existingIds = new Set(orderItems.map((o) => o.item.id));
    const toAdd = lowStock.filter((i) => !existingIds.has(i.id));

    if (toAdd.length === 0) {
      addToast('info', '要発注（安全在庫割れ）の品目はすべて追加済みです');
      return;
    }

    const newOrders: PurchaseOrderItem[] = toAdd.map((item) => {
      const defaultConv = item.unitConversions?.[0] || { unit: item.baseUnit, multiplier: 1 };
      const deficit = Math.max(1, (item.safetyStock * 2) - item.currentStock);
      const orderQty = Math.max(1, Math.ceil(deficit / defaultConv.multiplier));
      const defaultModelText = item.spec ? `${item.name} ${item.spec}` : item.name;
      return {
        item,
        orderQuantity: orderQty,
        orderUnit: defaultConv.unit,
        calculatedBaseQuantity: orderQty * defaultConv.multiplier,
        note: defaultModelText,
      };
    });

    setOrderItems((prev) => [...prev, ...newOrders]);
    addToast('success', `${newOrders.length}件の要発制品目を追加しました`);
  };

  // Export 1: 中西電機工業 注文書 Excel (.xlsx) 出力
  const handleExportNakanishiExcel = async () => {
    if (orderItems.length === 0) return;
    try {
      const fileName = await NakanishiOrderExcelExporter.exportNakanishiOrder(orderItems, {
        operatorName: settings.activeOperator || '黄',
        recipientCompany: '中西電機工業㈱',
        recipientPerson,
        defaultJobCode: jobCode,
        defaultDesiredDelivery: desiredDelivery,
        defaultDeliveryLocation: deliveryLocation,
      });
      const sheetCount = Math.max(1, Math.ceil(orderItems.length / 15));
      addToast('success', `中西電機 注文書 (${fileName} / 計${sheetCount}シート) を出力しました！`);
      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
      } catch {}
    } catch (e) {
      console.error('Export Excel failed:', e);
      addToast('error', 'Excel出力に失敗しました');
    }
  };

  // Export 2: CSV Export
  const handleExportCsv = () => {
    if (orderItems.length === 0) return;
    const csvContent = CsvHelper.exportPurchaseOrdersToCsv(orderItems, orderNumber);
    CsvHelper.downloadCsv(csvContent, `発注書_${orderNumber}.csv`);
    addToast('success', `発注書CSV (${orderNumber}.csv) を出力しました`);
  };

  // Export 3: Copy Text for LINE / Email
  const handleCopyText = async () => {
    if (orderItems.length === 0) return;
    const text = CsvHelper.formatPurchaseOrderText(orderItems, settings.activeOperator);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    addToast('success', '発注依頼テキストをクリップボードにコピーしました（LINE・メール送信可）');
  };

  // Export 4: Print Purchase Order
  const handlePrint = () => {
    window.print();
  };

  const totalSheets = Math.max(1, Math.ceil(orderItems.length / 15));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-2xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-lg text-white">資材発注書作成 & エクスポート</h3>
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-amber-400 font-bold">
                  {orderNumber}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-950 border border-emerald-700 font-bold text-xs text-emerald-300">
                  中西電機 注文書様式完全準拠
                </span>
              </div>
              <p className="text-xs text-slate-400">
                発注品目の型番・数量・単位を直接調整し、「注文見積り書_中西電機」の正規Excelフォーマットで即時出力できます
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 中西電機 注文書 ヘッダーパラメータ設定バー */}
        <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div>
            <label className="text-slate-400 font-bold block mb-1 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              <span>工番 (デフォルト空白)</span>
            </label>
            <input
              type="text"
              value={jobCode}
              onChange={(e) => setJobCode(e.target.value)}
              placeholder="空白 (必要時入力)"
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 font-bold block mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>希望納期</span>
            </label>
            <input
              type="text"
              value={desiredDelivery}
              onChange={(e) => setDesiredDelivery(e.target.value)}
              placeholder="大至急 / 8月30日..."
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 font-bold block mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>納品場所</span>
            </label>
            <input
              type="text"
              value={deliveryLocation}
              onChange={(e) => setDeliveryLocation(e.target.value)}
              placeholder="事務所 / 第2工場..."
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500 text-xs"
            />
          </div>

          <div>
            <label className="text-slate-400 font-bold block mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span>中西電機 担当者</span>
            </label>
            <input
              type="text"
              value={recipientPerson}
              onChange={(e) => setRecipientPerson(e.target.value)}
              placeholder="林"
              className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-xs"
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-300">
              発注対象: <strong className="text-amber-400 text-sm">{orderItems.length}</strong> 件
              {orderItems.length > 15 ? ` (全${totalSheets}シートに自動分割)` : ' (1シート: 1~15件)'}
            </span>
            <button
              type="button"
              onClick={handleAddLowStockItems}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>要発注品（安全在庫割れ）を全件追加</span>
            </button>
          </div>

          <div className="text-xs text-slate-400">
            依頼日: <strong className="text-slate-200">{formatReiwaDate()}</strong> / 担当: <strong className="text-blue-400">{settings.activeOperator || '黄'}</strong>
          </div>
        </div>

        {/* Main List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {orderItems.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-400 font-bold text-sm">発注品目が選択されていません</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                上の「要発注品を全件追加」ボタンを押すか、品目一覧のチェックボックスから発注品目を選択してください。
              </p>
            </div>
          ) : (
            orderItems.map((order, idx) => {
              const isLow = order.item.currentStock <= order.item.safetyStock;
              const sheetNo = Math.floor(idx / 15) + 1;
              return (
                <div
                  key={order.item.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-sm flex flex-col gap-2.5"
                >
                  {/* Top Row: Item Info & Controls */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800">
                          NO. {idx + 1} {totalSheets > 1 && `(Sheet ${sheetNo})`}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-800">
                          {order.item.code}
                        </span>
                        <span className="text-xs font-bold text-blue-400 flex items-center gap-0.5">
                          <Box className="w-3 h-3" />
                          <span>{order.item.location}</span>
                        </span>
                        {order.item.supplier && (
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-blue-400" />
                            <span>{order.item.supplier}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="font-black text-sm sm:text-base text-white truncate mt-1">
                        {order.item.name}
                      </h4>
                      {order.item.spec && (
                        <p className="text-xs text-amber-300 font-bold truncate mt-0.5">規格型番: {order.item.spec}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs mt-1">
                        <span className="text-slate-400">
                          現在庫: <strong className={isLow ? 'text-amber-400' : 'text-slate-200'}>{order.item.currentStock}</strong> {order.item.baseUnit}
                        </span>
                        <span className="text-slate-400">
                          安全在庫: <strong>{order.item.safetyStock}</strong> {order.item.baseUnit}
                        </span>
                      </div>
                    </div>

                    {/* Right: Quantity Controls */}
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                      <div className="text-right">
                        <label className="text-[10px] text-slate-500 font-bold block mb-0.5">発注数量 & 単位</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            value={order.orderQuantity}
                            onChange={(e) => handleUpdateQty(idx, parseInt(e.target.value, 10) || 1)}
                            className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-center text-sm font-black text-amber-400 focus:outline-none focus:border-amber-500"
                          />

                          {/* Unit Select & Custom input */}
                          <input
                            type="text"
                            value={order.orderUnit}
                            onChange={(e) => handleUpdateUnit(idx, e.target.value)}
                            list={`units-list-${idx}`}
                            className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white text-center focus:outline-none focus:border-blue-500"
                            placeholder="単位"
                          />
                          <datalist id={`units-list-${idx}`}>
                            <option value={order.item.baseUnit} />
                            <option value="P" />
                            <option value="巻" />
                            <option value="袋" />
                            <option value="箱" />
                            <option value="個" />
                            <option value="本" />
                            <option value="組" />
                            <option value="式" />
                            {order.item.unitConversions?.map((c) => (
                              <option key={c.unit} value={c.unit} />
                            ))}
                          </datalist>
                        </div>

                        {order.calculatedBaseQuantity !== order.orderQuantity && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            (= {order.calculatedBaseQuantity} {order.item.baseUnit})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition"
                        title="リストから除外"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Row: Editable Excel Model Text (型番列の出力文字列) */}
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 flex items-center gap-2">
                    <label className="text-[11px] text-slate-400 font-bold flex items-center gap-1 shrink-0">
                      <Edit3 className="w-3 h-3 text-blue-400" />
                      <span>Excel「型番」列の印字内容:</span>
                    </label>
                    <input
                      type="text"
                      value={order.note || ''}
                      onChange={(e) => handleUpdateModelText(idx, e.target.value)}
                      placeholder="例: マークチューブ Φ4.2mm / 1.25Y-3.5..."
                      className="flex-1 px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions (Export Formats) */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            合計 <strong className="text-white font-bold">{orderItems.length}</strong> 品目
            {totalSheets > 1 && (
              <span className="text-amber-400 ml-1 font-bold">（※全 {totalSheets} シートに自動出力）</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            {/* Format 1: Text Copy */}
            <button
              type="button"
              onClick={handleCopyText}
              disabled={orderItems.length === 0}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
              <span>{copied ? 'コピー完了！' : 'テキストコピー'}</span>
            </button>

            {/* Format 2: Print */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={orderItems.length === 0}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              title="発注伝票を印刷"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span>印刷</span>
            </button>

            {/* Format 3: Generic CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={orderItems.length === 0}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <span>CSV</span>
            </button>

            {/* Format 4: 中西電機工業 注文書 Excel (.xlsx) */}
            <button
              type="button"
              onClick={handleExportNakanishiExcel}
              disabled={orderItems.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-950/60 transition flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4 stroke-[2.5]" />
              <span>📗 中西電機 注文書 (Excel) を出力</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
