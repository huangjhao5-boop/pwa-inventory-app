import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster } from '../../types/inventory';
import { ItemFormModal } from './ItemFormModal';
import { CsvImportExportModal } from './CsvImportExportModal';
import { CsvHelper } from '../../utils/csvHelper';
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
} from 'lucide-react';

export const ItemMasterTable: React.FC = () => {
  const { items, deleteItem, openQRGenerator, addToast, settings, recordTransaction } = useInventory();
  const isFieldMode = settings.viewMode === 'FIELD';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Extract unique categories
  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category || '未分類')))];

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
    const matchLowStock = !onlyLowStock || item.currentStock <= item.safetyStock;

    return matchQuery && matchCat && matchLowStock;
  });

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

  const handleExportCsv = () => {
    const csvStr = CsvHelper.exportItemsToCsv(items);
    CsvHelper.downloadCsv(csvStr, `inventory_master_${new Date().toISOString().slice(0, 10)}.csv`);
    addToast('success', '品目マスタを UTF-8 BOM付き CSV でエクスポートしました');
  };

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
                登録数: {items.length} 件 / ボックス名・メーカー・安全在庫アラート監視
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {!isFieldMode && (
            <>
              <button
                onClick={() => setIsCsvModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>CSV インポート</span>
              </button>

              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
              >
                <Download className="w-4 h-4 text-blue-400" />
                <span>CSV エクスポート</span>
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

      {/* Filter & Search Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-3.5 sm:p-4 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="品目コード、品名、メーカー、ボックス名、型番で検索..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500 font-medium"
            />
          </div>

          {/* Low Stock Filter Switch */}
          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold border transition ${
              onlyLowStock
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            <AlertTriangle className={`w-4 h-4 ${onlyLowStock ? 'text-amber-400' : ''}`} />
            <span>要発注・安全在庫割れのみ</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
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
      </div>

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
              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col justify-between gap-3"
                >
                  <div>
                    {/* Top Row: Code & Box Name */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-bold text-slate-400 truncate">
                        {item.code}
                      </span>
                      <span className="px-2.5 py-1 bg-blue-950/80 border border-blue-800/80 text-blue-300 rounded-xl text-xs font-extrabold flex items-center gap-1 shrink-0">
                        <Box className="w-3 h-3 text-blue-400" />
                        <span>{item.location}</span>
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="font-black text-base text-white leading-snug">
                      {item.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      {item.supplier && (
                        <span className="text-blue-300 font-bold">🏢 {item.supplier}</span>
                      )}
                      {item.spec && <span>{item.spec}</span>}
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
                  <th className="py-3.5 px-4">品目コード / 照合</th>
                  <th className="py-3.5 px-4">品名・規格型番</th>
                  <th className="py-3.5 px-4">メーカー / 分類</th>
                  <th className="py-3.5 px-4 text-right">現在庫数</th>
                  <th className="py-3.5 px-4 text-right">安全在庫</th>
                  <th className="py-3.5 px-4">保管ボックス名</th>
                  <th className="py-3.5 px-4">包装換算単位</th>
                  <th className="py-3.5 px-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                      該当する品目はありません
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const isLow = item.currentStock <= item.safetyStock;
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
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
                          <div className="flex items-baseline justify-end gap-1">
                            <span
                              className={`font-black text-base ${
                                isLow ? 'text-amber-400' : 'text-emerald-400'
                              }`}
                            >
                              {item.currentStock}
                            </span>
                            <span className="text-xs text-slate-400">{item.baseUnit}</span>
                          </div>
                          {isLow && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
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
                        <td className="py-3.5 px-4 max-w-[200px]">
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
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
      />
    </div>
  );
};
