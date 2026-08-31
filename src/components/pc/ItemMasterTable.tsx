import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster } from '../../types/inventory';
import { ItemFormModal } from './ItemFormModal';
import { CsvImportExportModal } from './CsvImportExportModal';
import { CsvExportModal } from './CsvExportModal';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  QrCode,
  Download,
  Upload,
  AlertTriangle,
  Building2,
  Box,
  PlusCircle,
  MinusCircle,
  ShoppingCart,
  CheckSquare,
  Square,
  ExternalLink,
} from 'lucide-react';

export const ItemMasterTable: React.FC = () => {
  const { items, deleteItem, openQRGenerator, addToast, settings, recordTransaction } = useInventory();
  const isFieldMode = settings.viewMode === 'FIELD';

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<'ALL' | 'LOW' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL');

  // Order selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [isCsvExportOpen, setIsCsvExportOpen] = useState(false);
  const [isPurchaseOrderOpen, setIsPurchaseOrderOpen] = useState(false);

  // Extract unique filter options
  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category || '未分類')))];
  const suppliers = ['ALL', ...Array.from(new Set(items.map((i) => i.supplier).filter(Boolean) as string[]))];
  const locations = ['ALL', ...Array.from(new Set(items.map((i) => i.location).filter(Boolean)))];

  // Filter items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.supplier && item.supplier.toLowerCase().includes(q)) ||
      (item.spec && item.spec.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q));

    const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchSup = selectedSupplier === 'ALL' || item.supplier === selectedSupplier;
    const matchLoc = selectedLocation === 'ALL' || item.location === selectedLocation;

    let matchStock = true;
    if (stockStatusFilter === 'LOW') {
      matchStock = item.currentStock <= item.safetyStock;
    } else if (stockStatusFilter === 'IN_STOCK') {
      matchStock = item.currentStock > 0;
    } else if (stockStatusFilter === 'OUT_OF_STOCK') {
      matchStock = item.currentStock === 0;
    }

    return matchQuery && matchCat && matchSup && matchLoc && matchStock;
  });

  const lowStockCount = items.filter((i) => i.currentStock <= i.safetyStock).length;

  const handleCreateNew = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: ItemMaster) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`品目「${name}」をマスタから削除しますか？`)) {
      await deleteItem(id);
    }
  };

  const handleQuickAdjust = async (item: ItemMaster, deltaQty: number) => {
    const type = deltaQty > 0 ? 'IN' : 'OUT';
    await recordTransaction(item, type, Math.abs(deltaQty), item.baseUnit, 1, 'カード簡易調整');
  };

  // Order selection handlers
  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.length === filteredItems.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredItems.map((i) => i.id));
    }
  };

  const toggleSelectOneOrder = (id: string) => {
    if (selectedOrderIds.includes(id)) {
      setSelectedOrderIds(selectedOrderIds.filter((item) => item !== id));
    } else {
      setSelectedOrderIds([...selectedOrderIds, id]);
    }
  };

  const handleSelectAllLowStock = () => {
    const lowIds = items.filter((i) => i.currentStock <= i.safetyStock).map((i) => i.id);
    setSelectedOrderIds(lowIds);
    addToast('info', `要発注品 (${lowIds.length}件) を発注選択しました`);
  };

  const selectedOrderItems = items.filter((i) => selectedOrderIds.includes(i.id));

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-8">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <Package className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-extrabold text-lg sm:text-xl text-white">
                {isFieldMode ? '🔍 現場在庫検索・確認 (Cards)' : '📦 品目マスタ管理 (Data Grid)'}
              </h2>
              <p className="text-xs text-slate-400">
                登録数: {items.length} 件 (表示中: {filteredItems.length} 件) / 要発注: <strong className="text-amber-400 font-bold">{lowStockCount}</strong> 件
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Purchase Order Action */}
          <button
            onClick={() => {
              if (selectedOrderIds.length === 0) {
                handleSelectAllLowStock();
              }
              setIsPurchaseOrderOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-amber-950/50 transition"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>
              発注書作成
              {selectedOrderIds.length > 0 ? ` (${selectedOrderIds.length}件選択中)` : ''}
            </span>
          </button>

          {!isFieldMode && (
            <>
              <button
                onClick={() => setIsCsvImportOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>CSV インポート</span>
              </button>

              <button
                onClick={() => setIsCsvExportOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>CSV 抽出エクスポート</span>
              </button>
            </>
          )}

          <button
            onClick={handleCreateNew}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-blue-900/40 transition"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>新規品目登録</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar with Multi-Column Selectors */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search Input */}
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="品目コード、品名、メーカー、ボックス名、型番で検索..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500 font-medium"
            />
          </div>

          {/* Supplier Filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-2xl border border-slate-800">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-300 focus:outline-none"
            >
              <option value="ALL" className="bg-slate-900 text-white">全メーカー・仕入先</option>
              {suppliers.filter((s) => s !== 'ALL').map((s) => (
                <option key={s} value={s} className="bg-slate-900 text-white">{s}</option>
              ))}
            </select>
          </div>

          {/* Location / Box Filter */}
          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-2xl border border-slate-800">
            <Box className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-300 focus:outline-none"
            >
              <option value="ALL" className="bg-slate-900 text-white">全保管ボックス</option>
              {locations.filter((l) => l !== 'ALL').map((l) => (
                <option key={l} value={l} className="bg-slate-900 text-white">{l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filters & Category Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-2xl scrollbar-none">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`py-1 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-400 text-white shadow-md'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {cat === 'ALL' ? '全カテゴリ' : cat}
                </button>
              );
            })}
          </div>

          {/* Stock Status Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setStockStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                stockStatusFilter === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              全在庫
            </button>
            <button
              onClick={() => setStockStatusFilter('LOW')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition ${
                stockStatusFilter === 'LOW'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>要発注のみ ({lowStockCount})</span>
            </button>
            <button
              onClick={() => setStockStatusFilter('OUT_OF_STOCK')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                stockStatusFilter === 'OUT_OF_STOCK'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              在庫ゼロ
            </button>
          </div>
        </div>
      </div>

      {/* Floating Order Bar (When items selected) */}
      {selectedOrderIds.length > 0 && (
        <div className="sticky top-20 z-20 bg-amber-950/90 backdrop-blur-md p-3 rounded-2xl border border-amber-700/60 shadow-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            <span className="text-xs sm:text-sm font-black text-white">
              発注対象として <strong className="text-amber-300">{selectedOrderIds.length}</strong> 件の品目を選択中
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-slate-300 text-xs font-bold rounded-xl transition"
            >
              選択解除
            </button>
            <button
              onClick={() => setIsPurchaseOrderOpen(true)}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition"
            >
              発注書を開く →
            </button>
          </div>
        </div>
      )}

      {/* VIEW A: 現場モード（タッチカード） */}
      {isFieldMode ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-500 font-bold">
              該当する品目はありません
            </div>
          ) : (
            filteredItems.map((item) => {
              const isLow = item.currentStock <= item.safetyStock;
              const isSelectedForOrder = selectedOrderIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-slate-900 border rounded-3xl p-4 shadow-lg flex flex-col justify-between gap-3 transition ${
                    isSelectedForOrder ? 'border-amber-500/80 ring-1 ring-amber-500/50' : 'border-slate-800'
                  }`}
                >
                  <div>
                    {/* Top Row: Code & Box Name */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSelectOneOrder(item.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelectedForOrder ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <span className="font-mono text-xs font-bold text-slate-400 truncate">
                          {item.code}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 bg-blue-950/80 border border-blue-800/80 text-blue-300 rounded-xl text-xs font-extrabold flex items-center gap-1 shrink-0">
                        <Box className="w-3 h-3 text-blue-400" />
                        <span>{item.location}</span>
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="font-black text-base text-white leading-snug">
                      {item.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                      {item.supplier && (
                        <span className="text-blue-300 font-bold">🏢 {item.supplier}</span>
                      )}
                      {item.spec && <span>{item.spec}</span>}
                      {item.orderUrl && (
                        <a
                          href={item.orderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold text-cyan-400 hover:underline flex items-center gap-0.5 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>発注先</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Stock Level & Quick Adjust */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block font-semibold">現在庫</span>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-2xl font-black ${
                            isLow ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {item.currentStock}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">{item.baseUnit}</span>
                      </div>
                    </div>

                    {/* Quick Stepper + QR button */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickAdjust(item, -1)}
                        className="p-2 text-rose-400 hover:bg-rose-950/60 rounded-xl border border-slate-800 active:scale-95"
                        title="出庫 -1"
                      >
                        <MinusCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleQuickAdjust(item, 1)}
                        className="p-2 text-emerald-400 hover:bg-emerald-950/60 rounded-xl border border-slate-800 active:scale-95"
                        title="入荷 +1"
                      >
                        <PlusCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => openQRGenerator(item)}
                        className="p-2 text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800"
                        title="QRコード表示"
                      >
                        <QrCode className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VIEW B: PC管理モード（データグリッド） */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-3 text-center w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAllOrders}
                      className="text-slate-400 hover:text-white"
                      title="全選択/解除"
                    >
                      {selectedOrderIds.length > 0 && selectedOrderIds.length === filteredItems.length ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">品目コード / 写真</th>
                  <th className="py-3.5 px-4">品名・規格型番</th>
                  <th className="py-3.5 px-4">メーカー / 分類</th>
                  <th className="py-3.5 px-4 text-right">現在庫数</th>
                  <th className="py-3.5 px-4 text-right">安全在庫</th>
                  <th className="py-3.5 px-4">保管ボックス名</th>
                  <th className="py-3.5 px-4">包装換算単位</th>
                  <th className="py-3.5 px-4 text-center">発注リンク</th>
                  <th className="py-3.5 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 font-medium">
                      該当する品目はありません
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.currentStock <= item.safetyStock;
                    const isSelectedForOrder = selectedOrderIds.includes(item.id);
                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-800/40 transition ${
                          isSelectedForOrder ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        {/* Checkbox for Purchase Order */}
                        <td className="py-3.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOneOrder(item.id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelectedForOrder ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500" />
                            )}
                          </button>
                        </td>

                        {/* Code + Thumbnail */}
                        <td className="py-3.5 px-4 font-mono font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0 bg-black"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-500 shrink-0">
                                写真無
                              </div>
                            )}
                            <span>{item.code}</span>
                          </div>
                        </td>

                        {/* Name & Spec */}
                        <td className="py-3.5 px-4 min-w-[200px]">
                          <div className="font-extrabold text-white leading-tight">{item.name}</div>
                          {item.spec && (
                            <div className="text-xs text-slate-400 mt-0.5">{item.spec}</div>
                          )}
                        </td>

                        {/* Supplier & Category */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.supplier && (
                            <div className="flex items-center gap-1 text-xs font-bold text-blue-300 mb-0.5">
                              <Building2 className="w-3 h-3 text-blue-400" />
                              <span>{item.supplier}</span>
                            </div>
                          )}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {item.category}
                          </span>
                        </td>

                        {/* Current Stock */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="flex items-baseline gap-1">
                              <span
                                className={`font-black text-base ${
                                  isLow ? 'text-amber-400' : 'text-emerald-400'
                                }`}
                              >
                                {item.currentStock}
                              </span>
                              <span className="text-xs text-slate-400">{item.baseUnit}</span>
                            </div>
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                type="button"
                                onClick={() => handleQuickAdjust(item, 1)}
                                className="p-1 text-emerald-400 hover:bg-emerald-950/80 rounded border border-slate-800 text-xs active:scale-95 transition"
                                title="在庫 +1 加算"
                              >
                                <PlusCircle className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickAdjust(item, -1)}
                                disabled={item.currentStock <= 0}
                                className="p-1 text-rose-400 hover:bg-rose-950/80 rounded border border-slate-800 text-xs disabled:opacity-20 active:scale-95 transition"
                                title="在庫 -1 減算"
                              >
                                <MinusCircle className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          {isLow && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded inline-block mt-0.5">
                              要発注
                            </span>
                          )}
                        </td>

                        {/* Safety Stock */}
                        <td className="py-3.5 px-4 text-right text-slate-400 whitespace-nowrap">
                          {item.safetyStock} {item.baseUnit}
                        </td>

                        {/* Box Name */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-bold text-blue-300">
                            <Box className="w-3.5 h-3.5 text-blue-400" />
                            <span>{item.location}</span>
                          </div>
                        </td>

                        {/* Unit conversions */}
                        <td className="py-3.5 px-4 max-w-[180px]">
                          <div className="flex flex-wrap gap-1">
                            {item.unitConversions?.map((c) => (
                              <span
                                key={c.unit}
                                className="text-[11px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-mono"
                              >
                                1{c.unit}={c.multiplier}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Order Link Column */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          {item.orderUrl ? (
                            <a
                              href={item.orderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-bold transition"
                              title={item.orderUrl}
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>発注先</span>
                            </a>
                          ) : (
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-[11px] text-slate-500 hover:text-blue-400 underline"
                              title="発注URLを登録"
                            >
                              + URL登録
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openQRGenerator(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 rounded-lg hover:bg-slate-800 transition"
                              title="QRコード発行"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                              title="編集"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      <ItemFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialItem={editingItem}
      />

      {/* CSV Import Modal */}
      <CsvImportExportModal
        isOpen={isCsvImportOpen}
        onClose={() => setIsCsvImportOpen(false)}
      />

      {/* CSV Filtered Export Modal */}
      <CsvExportModal
        isOpen={isCsvExportOpen}
        onClose={() => setIsCsvExportOpen(false)}
        allItems={items}
        filteredItems={filteredItems}
        currentFilterLabel={`絞り込み条件適用 (${filteredItems.length}件)`}
        onSuccessToast={(msg) => addToast('success', msg)}
      />

      {/* Purchase Order Modal */}
      <PurchaseOrderModal
        isOpen={isPurchaseOrderOpen}
        onClose={() => setIsPurchaseOrderOpen(false)}
        initialSelectedItems={selectedOrderItems.length > 0 ? selectedOrderItems : items.filter((i) => i.currentStock <= i.safetyStock)}
      />
    </div>
  );
};
