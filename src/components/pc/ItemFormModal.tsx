import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ItemMaster, UnitConversion, PRESET_UNITS, LinkedBarcode } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import { AiVisionService } from '../../utils/geminiAiVision';
import { VisualKnowledgeService } from '../../utils/visualKnowledgeService';
import { ImageCompressor } from '../../utils/imageCompressor';
import {
  X,
  Plus,
  Trash2,
  Layers,
  Building2,
  Box,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
  Tag,
  Check,
  Link2,
} from 'lucide-react';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: ItemMaster | null;
}

// 電工現場の主要メーカー既定プリセット
const PRESET_SUPPLIERS = [
  'ヘラマンタイトン',
  'ニチフ',
  'TOHO',
  '日東電工',
  'パナソニック',
  'パンドウイット',
  '未来工業',
  'ネグロス電工',
  '三菱電機',
  '富士電機',
  'オムロン',
  'WAGO',
  'フエニックス・コンタクト',
  'ミスミ',
  'SMC',
  'キーエンス',
  'テンパール',
  '河村電器',
];

// 商品カテゴリプリセット
const PRESET_CATEGORIES = [
  '配線・電気資材',
  '制御盤パーツ',
  '端子・圧着具',
  '結束バンド・チューブ',
  '機構・締結部品',
  '空圧・流体機器',
  '測定器・工具',
  '消耗品・その他',
];

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  initialItem,
}) => {
  const { saveItem, addToast, settings, items } = useInventory();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [category, setCategory] = useState('配線・電気資材');
  const [supplier, setSupplier] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [baseUnit, setBaseUnit] = useState('個');
  const [currentStock, setCurrentStock] = useState(0);
  const [safetyStock, setSafetyStock] = useState(10);
  const [location, setLocation] = useState('端子ボックス (A-01)');
  const [qrCode, setQrCode] = useState('');
  const [orderUrl, setOrderUrl] = useState('');
  const [note, setNote] = useState('');

  // Dropdown open states for autocomplete
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  // Dynamic packaging unit conversions
  const [conversions, setConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 50 },
    { unit: '袋', multiplier: 10 },
  ]);

  // Linked Barcodes state (外箱コード・仕入先コード・別名バーコード)
  const [linkedBarcodes, setLinkedBarcodes] = useState<LinkedBarcode[]>([]);
  const [newLinkedCode, setNewLinkedCode] = useState('');
  const [newLinkedUnit, setNewLinkedUnit] = useState('箱');
  const [newLinkedMultiplier, setNewLinkedMultiplier] = useState(100);
  const [newLinkLabel, setNewLinkLabel] = useState('外箱コード');

  // AI & OCR state
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collect unique existing values for fast autocomplete
  const uniqueSuppliers = useMemo(() => {
    const fromItems = items.map((i) => i.supplier).filter(Boolean) as string[];
    return Array.from(new Set([...fromItems, ...PRESET_SUPPLIERS]));
  }, [items]);

  const uniqueLocations = useMemo(() => {
    const fromItems = items.map((i) => i.location).filter(Boolean) as string[];
    const defaults = ['端子ボックス (A-01)', '結束バンドボックス (B-01)', 'マークチューブ棚 (C-01)', '盤内資材 (D-01)'];
    return Array.from(new Set([...fromItems, ...defaults]));
  }, [items]);

  const filteredSuppliers = useMemo(() => {
    if (!supplier.trim()) return uniqueSuppliers.slice(0, 8);
    const q = supplier.toLowerCase().trim();
    return uniqueSuppliers.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [supplier, uniqueSuppliers]);

  const filteredItemNames = useMemo(() => {
    if (!name.trim()) return [];
    const q = name.toLowerCase().trim();
    return items
      .filter((i) => i.name.toLowerCase().includes(q) || (i.spec && i.spec.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [name, items]);

  const filteredLocations = useMemo(() => {
    if (!location.trim()) return uniqueLocations.slice(0, 6);
    const q = location.toLowerCase().trim();
    return uniqueLocations.filter((l) => l.toLowerCase().includes(q)).slice(0, 6);
  }, [location, uniqueLocations]);

  useEffect(() => {
    if (initialItem) {
      setCode(initialItem.code);
      setName(initialItem.name);
      setSpec(initialItem.spec || '');
      setCategory(initialItem.category || '配線・電気資材');
      setSupplier(initialItem.supplier || '');
      setImageUrl(initialItem.imageUrl);
      setBaseUnit(initialItem.baseUnit || '個');
      setCurrentStock(initialItem.currentStock || 0);
      setSafetyStock(initialItem.safetyStock || 0);
      setLocation(initialItem.location || '端子ボックス (A-01)');
      setQrCode(initialItem.qrCode || `INV:v1:${initialItem.code}`);
      setOrderUrl(initialItem.orderUrl || '');
      setNote(initialItem.note || '');
      setConversions(
        initialItem.unitConversions?.filter((c) => c.unit !== initialItem.baseUnit) || []
      );
      setLinkedBarcodes(initialItem.linkedBarcodes || []);
    } else {
      setCode('');
      setName('');
      setSpec('');
      setCategory('配線・電気資材');
      setSupplier('');
      setImageUrl(undefined);
      setBaseUnit('個');
      setCurrentStock(0);
      setSafetyStock(10);
      setLocation('端子ボックス (A-01)');
      setQrCode('');
      setOrderUrl('');
      setNote('');
      setConversions([
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
      ]);
      setLinkedBarcodes([]);
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleAddLinkedBarcode = () => {
    if (!newLinkedCode.trim()) return;
    if (linkedBarcodes.some((l) => l.code === newLinkedCode.trim())) {
      addToast('warning', 'このバーコードは既に追加されています');
      return;
    }
    setLinkedBarcodes([
      ...linkedBarcodes,
      {
        code: newLinkedCode.trim(),
        unit: newLinkedUnit,
        multiplier: newLinkedMultiplier,
        label: newLinkLabel.trim() || undefined,
      },
    ]);
    setNewLinkedCode('');
  };

  const handleRemoveLinkedBarcode = (index: number) => {
    setLinkedBarcodes(linkedBarcodes.filter((_, i) => i !== index));
  };

  const handleAddConversion = () => {
    setConversions([...conversions, { unit: '箱', multiplier: 20 }]);
  };

  const handleRemoveConversion = (idx: number) => {
    setConversions(conversions.filter((_, i) => i !== idx));
  };

  const handleUpdateConversion = (
    idx: number,
    field: 'unit' | 'multiplier',
    value: string | number
  ) => {
    const next = [...conversions];
    if (field === 'unit') {
      next[idx].unit = String(value);
    } else {
      next[idx].multiplier = Math.max(1, Number(value) || 1);
    }
    setConversions(next);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      const base64 = await ImageCompressor.compressImage(rawBase64, 360, 360, 0.65);
      setImageUrl(base64);

      // Run AI Vision & OCR
      setIsAiProcessing(true);
      try {
        const result = await AiVisionService.smartRecognize(
          base64,
          items,
          settings.geminiApiKey
        );
        setIsAiProcessing(false);

        if (result.suggestedName && !name) setName(result.suggestedName);
        if (result.suggestedSpec && !spec) setSpec(result.suggestedSpec);
        if (result.suggestedSupplier && !supplier) setSupplier(result.suggestedSupplier);
        if (result.suggestedCategory) setCategory(result.suggestedCategory);
        if (result.suggestedBoxName && location === '端子ボックス (A-01)') setLocation(result.suggestedBoxName);
        
        // 最小単位・包装倍率の自動反映
        if (result.suggestedBaseUnit) {
          setBaseUnit(result.suggestedBaseUnit);
        }
        if (result.suggestedConversions && result.suggestedConversions.length > 0) {
          setConversions(result.suggestedConversions.filter((c) => c.unit !== result.suggestedBaseUnit));
        }

        const sourceLabel =
          result.source === 'LEARNED_MEMORY'
            ? '🧠 現場AI学習記憶'
            : result.source === 'GEMINI_AI'
            ? '✨ Gemini Multimodal AI'
            : '⚡ 電工高精度OCR';

        addToast('success', `${sourceLabel}: 最小単位「${result.suggestedBaseUnit || '個'}」・品名・型番・メーカーを自動認識しました！`);
      } catch {
        setIsAiProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    const allConversions: UnitConversion[] = [
      ...conversions.filter((c) => c.unit.trim() && c.unit !== baseUnit),
      { unit: baseUnit, multiplier: 1 },
    ];

    const validLinkedBarcodes = linkedBarcodes.filter((b) => b.code.trim());
    const aliasCodes = Array.from(new Set(validLinkedBarcodes.map((b) => b.code.trim())));

    const item: ItemMaster = {
      id: initialItem?.id || `item-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      spec: spec.trim(),
      category: category.trim(),
      supplier: supplier.trim() || undefined,
      imageUrl: imageUrl || undefined,
      baseUnit: baseUnit.trim() || '個',
      currentStock: Number(currentStock) || 0,
      safetyStock: Number(safetyStock) || 0,
      location: location.trim() || '端子ボックス (A-01)',
      qrCode: qrCode.trim() || `INV:v1:${code.trim()}`,
      orderUrl: orderUrl.trim() || undefined,
      unitConversions: allConversions,
      linkedBarcodes: validLinkedBarcodes.length > 0 ? validLinkedBarcodes : undefined,
      aliasCodes: aliasCodes.length > 0 ? aliasCodes : undefined,
      updatedAt: new Date().toISOString(),
      note: note.trim() || undefined,
    };

    // AIの能動学習：写真や品目情報を記憶バンクへ学習保存
    if (imageUrl) {
      VisualKnowledgeService.learnFromItem(item, imageUrl);
    }

    await saveItem(item);
    addToast('success', `品目「${item.name}」をマスタに保存しました（AI学習更新済）`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
              <span>{initialItem ? '品目マスタ編集' : '新規品目マスタ登録'}</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold">
                AI自動学習 & 快速検索対応
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              品目情報、メーカー候補検索、最小基準単位、保管ボックス名、包装換算倍率の設定
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Code */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                品目コード / JANバーコード (必須)
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例: 4901480000028 / R2-4"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Name with Autocomplete */}
            <div className="relative">
              <label className="block font-bold text-slate-300 mb-1">
                品名 (必須・候補から検索可)
              </label>
              <input
                type="text"
                required
                value={name}
                onFocus={() => setShowNameDropdown(true)}
                onChange={(e) => {
                  setName(e.target.value);
                  setShowNameDropdown(true);
                }}
                placeholder="例: 丸形圧着端子 (JIS規格)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
              {showNameDropdown && filteredItemNames.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-700/60 flex items-center justify-between">
                    <span>既存の登録品目から引用</span>
                    <button
                      type="button"
                      onClick={() => setShowNameDropdown(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  {filteredItemNames.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setName(item.name);
                        if (item.spec && !spec) setSpec(item.spec);
                        if (item.supplier && !supplier) setSupplier(item.supplier);
                        if (item.category) setCategory(item.category);
                        if (item.baseUnit) setBaseUnit(item.baseUnit);
                        setShowNameDropdown(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-900/60 text-white flex items-center justify-between gap-2 text-xs transition"
                    >
                      <span className="font-bold truncate">{item.name}</span>
                      {item.spec && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono shrink-0">
                          {item.spec}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Supplier with Smart Autocomplete & Quick Search */}
            <div className="relative">
              <label className="block font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>メーカー / 仕入先 (快速検索)</span>
                </span>
                <span className="text-[10px] text-blue-400 font-normal">候補タップで即入力</span>
              </label>
              <input
                type="text"
                value={supplier}
                onFocus={() => setShowSupplierDropdown(true)}
                onChange={(e) => {
                  setSupplier(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                placeholder="例: ニチフ, ヘラマンタイトン, TOHO..."
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 font-medium"
              />
              {showSupplierDropdown && filteredSuppliers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-700/60 flex items-center justify-between">
                    <span>主要電工メーカー・登録済仕入先</span>
                    <button
                      type="button"
                      onClick={() => setShowSupplierDropdown(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 p-1">
                    {filteredSuppliers.map((sup) => (
                      <button
                        key={sup}
                        type="button"
                        onClick={() => {
                          setSupplier(sup);
                          setShowSupplierDropdown(false);
                        }}
                        className={`text-left px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-between ${
                          supplier === sup
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-900/80 hover:bg-blue-900/60 text-slate-200'
                        }`}
                      >
                        <span className="truncate">{sup}</span>
                        {supplier === sup && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Spec */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">規格 / 型番 (重要)</label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="例: R2-4 (0.5~2.0sq用), AB150-W..."
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category with Quick Presets */}
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-blue-400" />
                <span>商品カテゴリ</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              >
                {PRESET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Location / Storage Box with Smart Autocomplete */}
            <div className="relative">
              <label className="block font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Box className="w-3.5 h-3.5 text-blue-400" />
                  <span>保管ボックス名 / 棚番</span>
                </span>
                <span className="text-[10px] text-blue-400 font-normal">既存棚番から選択可</span>
              </label>
              <input
                type="text"
                value={location}
                onFocus={() => setShowLocationDropdown(true)}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setShowLocationDropdown(true);
                }}
                placeholder="例: 端子ボックス (A-01)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              />
              {showLocationDropdown && filteredLocations.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-44 overflow-y-auto p-1.5 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-700/60 flex items-center justify-between">
                    <span>倉庫・作業場の棚番候補</span>
                    <button
                      type="button"
                      onClick={() => setShowLocationDropdown(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                  {filteredLocations.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => {
                        setLocation(loc);
                        setShowLocationDropdown(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-900/60 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Box className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="truncate">{loc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Base Unit (最小管理単位) with Quick Buttons */}
            <div className="col-span-full bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-200 text-xs">
                  基準単位 (在庫を数える最小管理単位)
                </label>
                <span className="text-[11px] text-amber-400 font-bold">
                  現在の最小単位: 【 {baseUnit} 】
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setBaseUnit(u)}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition active:scale-95 ${
                      baseUnit === u
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Stock */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">現在庫数 ({baseUnit})</label>
              <input
                type="number"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Safety Stock */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">安全在庫数 ({baseUnit})</label>
              <input
                type="number"
                min="0"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Photo Attachment & AI/OCR Self-Learning */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">基準画像・商品写真 (AI照合対象)</label>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isAiProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-indigo-950/80 hover:bg-indigo-900 active:scale-95 text-indigo-200 border border-indigo-700/80 rounded-xl flex items-center gap-1.5 transition text-xs font-bold shadow"
                >
                  {isAiProcessing ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-amber-400" />
                  )}
                  <span>{isAiProcessing ? 'AI解析中...' : imageUrl ? '写真更新・AI再解析' : '📸 写真添付・AI自動解析'}</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    className="text-xs text-rose-400 hover:underline font-semibold"
                  >
                    削除
                  </button>
                )}
              </div>
              {imageUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={imageUrl} alt="基準写真" className="w-12 h-12 object-cover rounded-lg border border-slate-700 bg-black" />
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    <span>基準写真登録済（保存時にAI学習記憶）</span>
                  </span>
                </div>
              )}
            </div>

            {/* 発注先Webリンク (EC/商社URL) */}
            <div className="col-span-full pt-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-bold text-slate-300 text-xs flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                  <span>発注先Webリンク (モノタロウ、Amazon、ミスミ、電材商社EC等)</span>
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <span className="text-slate-500">ワンクリック検索:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const q = encodeURIComponent(`${supplier} ${name} ${spec}`.trim());
                      window.open(`https://www.monotaro.com/s/q-${q}/`, '_blank');
                    }}
                    className="text-amber-400 hover:underline px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold"
                  >
                    モノタロウ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = encodeURIComponent(`${supplier} ${name} ${spec}`.trim());
                      window.open(`https://www.amazon.co.jp/s?k=${q}`, '_blank');
                    }}
                    className="text-amber-400 hover:underline px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold"
                  >
                    Amazon
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const q = encodeURIComponent(`${supplier} ${name} ${spec}`.trim());
                      window.open(`https://www.google.com/search?q=${q}`, '_blank');
                    }}
                    className="text-blue-400 hover:underline px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-bold"
                  >
                    Google
                  </button>
                </div>
              </div>
              <input
                type="url"
                value={orderUrl}
                onChange={(e) => setOrderUrl(e.target.value)}
                placeholder="https://www.monotaro.com/p/... (発注先商品ページのURLを貼り付け)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Dynamic Unit Conversions Section */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-slate-200 text-xs sm:text-sm">
                  包装単位・換算倍率設定 (AI自動推理対応)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddConversion}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>換算単位を追加</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              現場で「1箱」または「1袋」でスキャンした際、この倍率を掛けて最小基準単位（<strong className="text-amber-400">{baseUnit}</strong>）に自動換算します。
            </p>

            <div className="space-y-2">
              {conversions.map((conv, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-bold">1</span>
                  {/* 左：包装単位プルダウン選択 */}
                  <select
                    value={PRESET_UNITS.includes(conv.unit as any) ? conv.unit : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        handleUpdateConversion(idx, 'unit', e.target.value);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs"
                    title="包装単位を選択"
                  >
                    {PRESET_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="custom">自訂・その他</option>
                  </select>

                  {!PRESET_UNITS.includes(conv.unit as any) && (
                    <input
                      type="text"
                      value={conv.unit}
                      onChange={(e) => handleUpdateConversion(idx, 'unit', e.target.value)}
                      placeholder="単位名"
                      className="w-16 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs text-center"
                    />
                  )}

                  <span className="text-xs text-slate-400 font-bold">=</span>

                  {/* 中：倍率数量 */}
                  <input
                    type="number"
                    min="1"
                    value={conv.multiplier}
                    onChange={(e) => handleUpdateConversion(idx, 'multiplier', e.target.value)}
                    className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-black text-xs text-center text-emerald-400"
                  />

                  {/* 右：換算先の基準単位 */}
                  <span className="px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-amber-300 font-bold text-xs">
                    {baseUnit}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleRemoveConversion(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition ml-auto"
                    title="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 🔗 紐付けバーコード設定 (外箱コード・仕入先コード・別名JAN) */}
          <div className="bg-indigo-950/40 p-4 rounded-2xl border border-indigo-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-indigo-400" />
                <span className="font-extrabold text-slate-100 text-xs sm:text-sm">
                  🔗 紐付けバーコード設定 (外箱コード・仕入先コード)
                </span>
              </div>
              <span className="text-[11px] text-indigo-300 font-mono font-bold">
                {linkedBarcodes.length} 件登録済
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              発注時や箱単位のバーコード（ITFコード・仕入先JAN）を登録すると、スキャン時に自動でこの品目および指定包装単位（箱・袋など）に切り替わります。
            </p>

            {/* Existing Linked Barcodes List */}
            {linkedBarcodes.length > 0 && (
              <div className="space-y-1.5">
                {linkedBarcodes.map((lb, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-mono font-black text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-700">
                        {lb.code}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 shrink-0">
                        {lb.unit || baseUnit} {lb.multiplier && lb.multiplier > 1 ? `(×${lb.multiplier})` : ''}
                      </span>
                      {lb.label && (
                        <span className="text-[11px] text-slate-400 truncate">
                          {lb.label}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLinkedBarcode(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition shrink-0"
                      title="紐付け解除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Linked Barcode Row */}
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-indigo-500/30 space-y-2">
              <span className="text-[11px] font-bold text-indigo-300 block">
                ＋ 新しい箱コード・別名コードを追加
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <input
                  type="text"
                  value={newLinkedCode}
                  onChange={(e) => setNewLinkedCode(e.target.value)}
                  placeholder="バーコード / ITFコード (例: 14944387...)"
                  className="sm:col-span-5 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
                <select
                  value={newLinkedUnit}
                  onChange={(e) => {
                    setNewLinkedUnit(e.target.value);
                    const conv = conversions.find((c) => c.unit === e.target.value);
                    if (conv) setNewLinkedMultiplier(conv.multiplier);
                  }}
                  className="sm:col-span-3 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs"
                >
                  {PRESET_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newLinkLabel}
                  onChange={(e) => setNewLinkLabel(e.target.value)}
                  placeholder="用途 (例: 外箱コード)"
                  className="sm:col-span-3 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddLinkedBarcode}
                  disabled={!newLinkedCode.trim()}
                  className="sm:col-span-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs rounded-lg transition flex items-center justify-center"
                  title="追加"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-blue-900/40 transition"
            >
              マスタを保存 (AI学習)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
