import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster } from '../../types/inventory';
import { ItemFormModal } from './ItemFormModal';
import { CsvImportExportModal } from './CsvImportExportModal';
import { CsvExportModal } from './CsvExportModal';
import { PurchaseOrderModal } from './PurchaseOrderModal';
import { StorageBoxModal, BOX_ICONS, BOX_COLORS } from './StorageBoxModal';
import { StorageBoxConfig } from '../../types/inventory';
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
  Box,
  ShoppingCart,
  CheckSquare,
  Square,
  GraduationCap,
  LayoutGrid,
  Table,
  Layers,
  ChevronRight,
  ZoomIn,
  X,
  ArrowRight,
  Settings2,
} from 'lucide-react';

export const ItemMasterTable: React.FC = () => {
  const {
    items,
    deleteItem,
    openQRGenerator,
    addToast,
    settings,
    recordTransaction,
    setActiveTab,
    boxConfigs,
    batchMoveItemsToBox,
  } = useInventory();
  const isFieldMode = settings.viewMode === 'FIELD';

  // View mode switcher: BOX_EXPLORER (保管箱ビジュアル), GRID (データテーブル), CARDS (部品カード)
  const [viewMode, setViewMode] = useState<'BOX_EXPLORER' | 'GRID' | 'CARDS'>('BOX_EXPLORER');
  const [activeBoxFilter, setActiveBoxFilter] = useState<string | null>(null);

  // Storage Box Edit Modal State
  const [isBoxModalOpen, setIsBoxModalOpen] = useState(false);
  const [editingBoxConfig, setEditingBoxConfig] = useState<StorageBoxConfig | null>(null);
  const [editingBoxName, setEditingBoxName] = useState<string | undefined>(undefined);
  const [editingBoxItemCount, setEditingBoxItemCount] = useState<number>(0);

  // Batch Move State
  const [isBatchMoveOpen, setIsBatchMoveOpen] = useState(false);
  const [targetMoveBox, setTargetMoveBox] = useState('');

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

  // Photo Zoom Lightbox
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Extract unique filter options
  const categories = ['ALL', ...Array.from(new Set(items.map((i) => i.category || '未分類')))];
  const suppliers = ['ALL', ...Array.from(new Set(items.map((i) => i.supplier).filter(Boolean) as string[]))];
  const locations = ['ALL', ...Array.from(new Set(items.map((i) => i.location).filter(Boolean)))];

  const handleOpenEditBox = (boxName: string, count: number) => {
    const config = boxConfigs.find((b) => b.name === boxName) || {
      name: boxName,
      icon: 'box',
      color: 'emerald',
    };
    setEditingBoxConfig(config);
    setEditingBoxName(boxName);
    setEditingBoxItemCount(count);
    setIsBoxModalOpen(true);
  };

  const handleOpenCreateBox = () => {
    setEditingBoxConfig(null);
    setEditingBoxName(undefined);
    setEditingBoxItemCount(0);
    setIsBoxModalOpen(true);
  };

  // Group items by storage box for the Visual Box Map (combines boxConfigs and items)
  const boxGroups = useMemo(() => {
    const allBoxNames = Array.from(
      new Set([
        ...boxConfigs.map((b) => b.name),
        ...items.map((i) => i.location || '未分類保管箱'),
      ])
    );

    return allBoxNames.map((boxName) => {
      const boxItems = items.filter((i) => (i.location || '未分類保管箱') === boxName);
      const lowStockInBox = boxItems.filter((i) => i.currentStock <= i.safetyStock).length;
      const totalUnits = boxItems.reduce((acc, curr) => acc + curr.currentStock, 0);
      const sampleImages = boxItems.map((i) => i.imageUrl).filter(Boolean) as string[];

      // Lookup custom box config
      const config = boxConfigs.find((b) => b.name === boxName);
      let defaultColor = 'blue';
      let defaultIcon = 'box';
      if (boxName.includes('端子')) { defaultColor = 'emerald'; defaultIcon = 'zap'; }
      else if (boxName.includes('結束バンド') || boxName.includes('インシュロック')) { defaultColor = 'amber'; defaultIcon = 'link'; }
      else if (boxName.includes('ネジ') || boxName.includes('ボルト') || boxName.includes('締結')) { defaultColor = 'cyan'; defaultIcon = 'wrench'; }
      else if (boxName.includes('ヒューズ')) { defaultColor = 'rose'; defaultIcon = 'shield'; }
      else if (boxName.includes('盤') || boxName.includes('制御')) { defaultColor = 'purple'; defaultIcon = 'server'; }
      else if (boxName.includes('マークチューブ')) { defaultColor = 'orange'; defaultIcon = 'tag'; }

      const iconId = config?.icon || defaultIcon;
      const colorId = config?.color || defaultColor;

      const colorObj = BOX_COLORS.find((c) => c.id === colorId) || BOX_COLORS[0];
      const iconObj = BOX_ICONS.find((i) => i.id === iconId) || BOX_ICONS[0];

      return {
        boxName,
        boxItems,
        itemCount: boxItems.length,
        lowStockCount: lowStockInBox,
        totalUnits,
        sampleImages,
        themeColor: `${colorObj.bg} ${colorObj.border}`,
        iconColor: `${colorObj.badge} ${colorObj.text}`,
        iconComponent: iconObj.icon,
        iconLabel: iconObj.label,
        description: config?.description,
      };
    });
  }, [items, boxConfigs]);

  // Filter items
  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery =
      !q ||
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.supplier && item.supplier.toLowerCase().includes(q)) ||
      (item.spec && item.spec.toLowerCase().includes(q)) ||
      (item.location && item.location.toLowerCase().includes(q)) ||
      (item.aliasCodes && item.aliasCodes.some((ac) => ac.toLowerCase().includes(q)));

    const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchSup = selectedSupplier === 'ALL' || item.supplier === selectedSupplier;
    const matchLoc =
      activeBoxFilter !== null
        ? item.location === activeBoxFilter
        : selectedLocation === 'ALL' || item.location === selectedLocation;

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
                {viewMode === 'BOX_EXPLORER'
                  ? '📦 保管ボックス・棚番ビジュアルマップ'
                  : viewMode === 'GRID'
                  ? '📋 品目マスタ管理 (データグリッド)'
                  : '🎴 部品カード表示'}
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

              <button
                type="button"
                onClick={() => setActiveTab('AI_STUDIO')}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-950 to-blue-950 hover:from-indigo-900 hover:to-blue-900 active:scale-95 text-indigo-300 border border-indigo-500/50 rounded-xl text-xs font-extrabold shadow transition"
              >
                <GraduationCap className="w-4 h-4 text-indigo-400" />
                <span>🎓 AI学習・対答案</span>
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

      {/* Filter & View Switcher Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="品目コード、品名、型番、メーカー、保管ボックス名でクイック検索..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500 placeholder-slate-500 font-medium"
            />
          </div>

          {/* View Mode Switcher (Box View vs Data Grid vs Cards) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0 gap-1">
            <button
              onClick={() => {
                setViewMode('BOX_EXPLORER');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'BOX_EXPLORER'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>📦 保管箱ビジュアル</span>
            </button>
            <button
              onClick={() => {
                setViewMode('GRID');
                setActiveBoxFilter(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'GRID'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>📋 全品目テーブル</span>
            </button>
            <button
              onClick={() => {
                setViewMode('CARDS');
                setActiveBoxFilter(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                viewMode === 'CARDS'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>🎴 部品カード</span>
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 border-t border-slate-800/80">
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-blue-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  カテゴリ: {c === 'ALL' ? 'すべて' : c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-blue-500"
            >
              {suppliers.map((s) => (
                <option key={s} value={s}>
                  メーカー: {s === 'ALL' ? 'すべて' : s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value);
                if (e.target.value !== 'ALL') setActiveBoxFilter(e.target.value);
                else setActiveBoxFilter(null);
              }}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-semibold focus:outline-none focus:border-blue-500"
            >
              {locations.map((l) => (
                <option key={l} value={l}>
                  保管場所: {l === 'ALL' ? 'すべての保管箱' : l}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filters & Category Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
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

      {/* Floating Action Bar (When items selected) */}
      {selectedOrderIds.length > 0 && (
        <div className="sticky top-20 z-20 bg-indigo-950/90 backdrop-blur-md p-3 rounded-2xl border border-indigo-500/60 shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-400" />
            <span className="text-xs sm:text-sm font-black text-white">
              <strong className="text-amber-300">{selectedOrderIds.length}</strong> 件の品目を選択中
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setTargetMoveBox(boxGroups[0]?.boxName || '端子ボックス (A-01)');
                setIsBatchMoveOpen(true);
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-950 transition flex items-center gap-1.5"
            >
              <Box className="w-4 h-4" />
              <span>📦 別の保管箱へ一括移動</span>
            </button>
            <button
              onClick={() => setIsPurchaseOrderOpen(true)}
              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>発注見積書を生成</span>
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl font-bold transition"
            >
              選択解除
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 📦 VIEW 1: 保管ボックス・棚番ビジュアルマップ (Visual Box Explorer) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'BOX_EXPLORER' && (
        <div className="space-y-4">
          {/* Breadcrumb Navigation when a box is opened */}
          {activeBoxFilter && (
            <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md animate-in fade-in">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                <button
                  onClick={() => setActiveBoxFilter(null)}
                  className="font-bold text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Box className="w-4 h-4" />
                  <span>すべての保管箱</span>
                </button>
                <ChevronRight className="w-4 h-4 text-slate-600" />
                <span className="font-black text-white bg-indigo-950 px-2.5 py-1 rounded-xl border border-indigo-700">
                  {activeBoxFilter} ({filteredItems.length} 品目)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenEditBox(activeBoxFilter, filteredItems.length)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-200 text-xs font-bold rounded-xl border border-indigo-700/80 transition"
                  title="保管箱の名前・アイコン・色を変更"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  <span>箱設定・名前変更</span>
                </button>
                <button
                  onClick={() => setActiveBoxFilter(null)}
                  className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>すべての箱を表示</span>
                </button>
              </div>
            </div>
          )}

          {/* Box Overview Header & Grid (Shown when no specific box is locked) */}
          {!activeBoxFilter && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm text-slate-200">
                    保管ボックス一覧 ({boxGroups.length} 箱)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    箱をクリックすると中身の品目一覧を表示します
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenCreateBox}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>＋ 保管箱を追加</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {boxGroups.map((box) => {
                  const BoxIcon = box.iconComponent;
                  return (
                    <div
                      key={box.boxName}
                      onClick={() => setActiveBoxFilter(box.boxName)}
                      className={`bg-gradient-to-br ${box.themeColor} rounded-3xl p-5 border shadow-xl hover:scale-[1.02] hover:shadow-2xl transition cursor-pointer flex flex-col justify-between space-y-4 group relative`}
                    >
                      {/* Top: Icon & Box Title & Edit Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-3 rounded-2xl border shadow-inner ${box.iconColor} group-hover:scale-110 transition duration-200 shrink-0`}>
                            <BoxIcon className="w-6 h-6 stroke-[2.5]" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-black text-base sm:text-lg text-white group-hover:text-amber-300 transition truncate">
                              {box.boxName}
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5 truncate">
                              {box.description || `${box.itemCount} 品目格納 / 総計: ${box.totalUnits}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {/* Edit Box settings */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditBox(box.boxName, box.itemCount);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition border border-transparent hover:border-slate-700"
                            title="箱の設定・名前・色を変更"
                          >
                            <Settings2 className="w-4 h-4" />
                          </button>

                          {/* Stock status badge */}
                          {box.lowStockCount > 0 ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                              ⚠️ 要発注: {box.lowStockCount}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              ✅ 健全
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Middle: Visual Sample Images Mosaic */}
                      <div className="bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none min-h-[58px]">
                        {box.sampleImages.length > 0 ? (
                          box.sampleImages.slice(0, 4).map((imgUrl, i) => (
                            <img
                              key={i}
                              src={imgUrl}
                              alt="部品写真"
                              className="w-11 h-11 object-cover rounded-xl border border-slate-700 bg-black shrink-0"
                            />
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-500 px-2 py-1">
                            {box.itemCount > 0 ? '写真未登録の品目が格納中' : '品目がまだ格納されていません'}
                          </span>
                        )}
                        {box.sampleImages.length > 4 && (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-1 rounded-lg shrink-0">
                            +{box.sampleImages.length - 4}
                          </span>
                        )}
                      </div>

                      {/* Bottom: Open Action Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs font-extrabold text-indigo-300 group-hover:text-white transition">
                        <span>この保管箱を開いて確認 ({box.itemCount} 品目)</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items inside the selected box or search filter */}
          {activeBoxFilter && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                  const isLow = item.currentStock <= item.safetyStock;
                  const isSelectedForOrder = selectedOrderIds.includes(item.id);

                  return (
                    <div
                      key={item.id}
                      className={`bg-slate-900 border rounded-3xl p-4 shadow-lg flex flex-col justify-between space-y-3 transition hover:border-slate-600 ${
                        isLow ? 'border-amber-500/50 bg-amber-950/10' : 'border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {item.imageUrl ? (
                          <div
                            onClick={() => setZoomedImage(item.imageUrl || null)}
                            className="relative w-14 h-14 rounded-2xl overflow-hidden border border-slate-700 bg-black shrink-0 cursor-pointer group/img"
                            title="クリックで拡大表示"
                          >
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover/img:scale-110 transition" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition">
                              <ZoomIn className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                            No Photo
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-sm text-white truncate">{item.name}</span>
                          </div>
                          {item.spec && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-xs inline-block mt-0.5 truncate max-w-full">
                              規格: {item.spec}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400 mt-1 truncate">
                            {item.supplier || 'メーカー未設定'} | <span className="text-blue-300">{item.location}</span>
                          </div>
                        </div>
                      </div>

                      {/* Stock Info & Stepper */}
                      <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-slate-500 font-semibold block">現在庫数</span>
                          <span className={`text-xl font-black ${isLow ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {item.currentStock}
                            <span className="text-xs font-bold text-slate-300 ml-1">{item.baseUnit}</span>
                          </span>
                        </div>

                        {/* Quick Stepper Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, -1)}
                            disabled={item.currentStock <= 0}
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 disabled:opacity-40 text-white font-black text-sm flex items-center justify-center transition active:scale-95 shadow"
                            title="-1 減算"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(item, 1)}
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center transition active:scale-95 shadow"
                            title="+1 加算"
                          >
                            ＋
                          </button>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-xs">
                        <button
                          type="button"
                          onClick={() => toggleSelectOneOrder(item.id)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition ${
                            isSelectedForOrder
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-amber-400 bg-slate-800'
                          }`}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                          <span>{isSelectedForOrder ? '発注対象中' : '発注に追加'}</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openQRGenerator(item)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                            title="QRコード表示"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                            title="編集"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs bg-slate-900/50 rounded-3xl border border-slate-800">
                  この保管箱には一致する品目がありません。
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 📋 VIEW 2: 全品目一覧データテーブル (Dense Data Grid) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'GRID' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">
                    <button onClick={toggleSelectAllOrders} title="全選択/解除">
                      {selectedOrderIds.length === filteredItems.length && filteredItems.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">写真</th>
                  <th className="py-3 px-3">品目コード / JAN</th>
                  <th className="py-3 px-3">品名</th>
                  <th className="py-3 px-3">規格・型番</th>
                  <th className="py-3 px-3">メーカー</th>
                  <th className="py-3 px-3">保管箱・棚番</th>
                  <th className="py-3 px-3 text-right">現在庫 (調整)</th>
                  <th className="py-3 px-3 text-right">安全在庫</th>
                  <th className="py-3 px-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const isLow = item.currentStock <= item.safetyStock;
                    const isSelected = selectedOrderIds.includes(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-800/40 transition ${
                          isSelected ? 'bg-amber-950/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <button onClick={() => toggleSelectOneOrder(item.id)}>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </button>
                        </td>

                        <td className="py-2.5 px-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              onClick={() => setZoomedImage(item.imageUrl || null)}
                              className="w-10 h-10 object-cover rounded-xl border border-slate-700 bg-black cursor-pointer hover:scale-125 transition shadow"
                              title="拡大表示"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-500">
                              無
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          <div>{item.code}</div>
                          {item.linkedBarcodes && item.linkedBarcodes.length > 0 && (
                            <span className="text-[10px] text-indigo-400 font-bold block">
                              +{item.linkedBarcodes.length} 箱コード紐付
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-bold text-white max-w-xs truncate">
                          {item.name}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-amber-300 font-bold">
                          {item.spec || '-'}
                        </td>

                        <td className="py-2.5 px-3 text-slate-300">{item.supplier || '-'}</td>

                        <td className="py-2.5 px-3 text-blue-300 font-semibold">{item.location}</td>

                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span
                              className={`font-black text-sm ${
                                isLow ? 'text-rose-400 font-bold' : 'text-emerald-400'
                              }`}
                            >
                              {item.currentStock} {item.baseUnit}
                            </span>
                            <div className="flex items-center gap-0.5 ml-1">
                              <button
                                onClick={() => handleQuickAdjust(item, -1)}
                                disabled={item.currentStock <= 0}
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-600 disabled:opacity-30 text-white font-bold flex items-center justify-center"
                              >
                                −
                              </button>
                              <button
                                onClick={() => handleQuickAdjust(item, 1)}
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-emerald-600 text-white font-bold flex items-center justify-center"
                              >
                                ＋
                              </button>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right text-slate-400 font-mono">
                          {item.safetyStock} {item.baseUnit}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openQRGenerator(item)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition"
                              title="QRコード表示"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition"
                              title="編集"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500 text-xs">
                      該当する品目がありません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 🎴 VIEW 3: 部品カード表示 (Cards View) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {viewMode === 'CARDS' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-lg flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start gap-3">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    onClick={() => setZoomedImage(item.imageUrl || null)}
                    className="w-14 h-14 object-cover rounded-2xl border border-slate-700 bg-black cursor-pointer hover:scale-110 transition shrink-0"
                    title="拡大表示"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                    No Photo
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-black text-sm text-white truncate block">{item.name}</span>
                  {item.spec && (
                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-xs inline-block mt-0.5 truncate max-w-full">
                      規格: {item.spec}
                    </span>
                  )}
                  <div className="text-[11px] text-slate-400 mt-1">
                    {item.supplier || '-'} | <span className="text-blue-300">{item.location}</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">現在庫</span>
                  <span className="text-xl font-black text-emerald-400">
                    {item.currentStock} <span className="text-xs font-bold text-slate-300">{item.baseUnit}</span>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleQuickAdjust(item, -1)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-600 text-white font-black text-sm flex items-center justify-center"
                  >
                    −
                  </button>
                  <button
                    onClick={() => handleQuickAdjust(item, 1)}
                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-emerald-600 text-white font-black text-sm flex items-center justify-center"
                  >
                    ＋
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {isFormOpen && (
        <ItemFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          initialItem={editingItem}
        />
      )}

      {isCsvImportOpen && (
        <CsvImportExportModal isOpen={isCsvImportOpen} onClose={() => setIsCsvImportOpen(false)} />
      )}

      {isCsvExportOpen && (
        <CsvExportModal
          isOpen={isCsvExportOpen}
          onClose={() => setIsCsvExportOpen(false)}
          allItems={items}
          filteredItems={filteredItems}
        />
      )}

      {isPurchaseOrderOpen && (
        <PurchaseOrderModal
          isOpen={isPurchaseOrderOpen}
          onClose={() => setIsPurchaseOrderOpen(false)}
          initialSelectedItems={selectedOrderItems}
        />
      )}

      {/* 📦 選択品目の一括保管箱移動モーダル */}
      {isBatchMoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-indigo-950/40">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-base text-white">
                  📦 選択品目の一括保管箱移動
                </h3>
              </div>
              <button
                onClick={() => setIsBatchMoveOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                選択された <strong className="text-amber-300 font-bold">{selectedOrderIds.length} 件</strong> の品目を、新しい保管ボックスへ一括で移動します。
              </p>

              {/* Selected Items preview */}
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 max-h-36 overflow-y-auto space-y-1">
                {items
                  .filter((i) => selectedOrderIds.includes(i.id))
                  .map((item) => (
                    <div key={item.id} className="text-xs flex items-center justify-between text-slate-300">
                      <span className="truncate flex-1 font-semibold">{item.name}</span>
                      <span className="text-[10px] text-slate-500 shrink-0 ml-2">現在: {item.location}</span>
                    </div>
                  ))}
              </div>

              {/* Destination Box Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  移動先の保管箱を選択：
                </label>
                <select
                  value={targetMoveBox}
                  onChange={(e) => setTargetMoveBox(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-indigo-500/60 rounded-xl text-white font-bold text-xs sm:text-sm focus:outline-none focus:border-indigo-400"
                >
                  {boxGroups.map((b) => (
                    <option key={b.boxName} value={b.boxName}>
                      {b.boxName} ({b.itemCount} 品目格納中)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchMoveOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!targetMoveBox.trim() || selectedOrderIds.length === 0) return;
                    const ok = await batchMoveItemsToBox(selectedOrderIds, targetMoveBox.trim());
                    if (ok) {
                      setIsBatchMoveOpen(false);
                      setSelectedOrderIds([]);
                    }
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-950 transition flex items-center gap-1.5"
                >
                  <Box className="w-4 h-4" />
                  <span>この {selectedOrderIds.length} 件を移動する</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Box Customization & Rename Modal */}
      {isBoxModalOpen && (
        <StorageBoxModal
          isOpen={isBoxModalOpen}
          onClose={() => {
            setIsBoxModalOpen(false);
            setEditingBoxConfig(null);
            setEditingBoxName(undefined);
          }}
          boxConfig={editingBoxConfig}
          currentBoxName={editingBoxName}
          itemCountInBox={editingBoxItemCount}
        />
      )}

      {/* Photo Zoom Lightbox */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl p-3 shadow-2xl flex flex-col items-center"
          >
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-slate-800 hover:bg-rose-600 text-white rounded-full border border-slate-600 shadow transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="overflow-auto max-h-[82vh] rounded-2xl border border-slate-800 bg-black">
              <img src={zoomedImage} alt="拡大プレビュー" className="max-w-full max-h-[80vh] object-contain rounded-xl" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
