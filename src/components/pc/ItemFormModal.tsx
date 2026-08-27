import React, { useState, useEffect, useRef } from 'react';
import { ItemMaster, UnitConversion, PRESET_UNITS } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import { AiVisionService } from '../../utils/geminiAiVision';
import { VisualKnowledgeService } from '../../utils/visualKnowledgeService';
import { ImageCompressor } from '../../utils/imageCompressor';
import { X, Plus, Trash2, Layers, Building2, Box, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: ItemMaster | null;
}

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
  const [note, setNote] = useState('');

  // Dynamic packaging unit conversions
  const [conversions, setConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 50 },
    { unit: '袋', multiplier: 10 },
  ]);

  // AI & OCR state
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setNote(initialItem.note || '');
      setConversions(
        initialItem.unitConversions?.filter((c) => c.unit !== initialItem.baseUnit) || []
      );
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
      setNote('');
      setConversions([
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
      ]);
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

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
        if (result.suggestedBaseUnit) setBaseUnit(result.suggestedBaseUnit);

        addToast('success', '写真から品名・型番・メーカー情報を自動認識しました！');
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
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
      note: note.trim() || undefined,
    };

    if (imageUrl) {
      VisualKnowledgeService.learnFromItem(item, imageUrl);
    }

    await saveItem(item);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-white">
              {initialItem ? '品目マスタ編集' : '新規品目マスタ登録'}
            </h3>
            <p className="text-xs text-slate-400">
              品目情報、メーカー、保管ボックス名、基準画像、包装換算倍率の設定
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

            {/* Name */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                品名 (必須)
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 丸形圧着端子 (JIS規格)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Supplier */}
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>メーカー / 仕入先</span>
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="例: ニチフ (NICHIFU), パンドウイット..."
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Spec */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">規格 / 型番</label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="例: R2-4 (0.5~2.0sq用)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">商品カテゴリ</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例: 配線・電気資材 / 制御盤パーツ / 締結部品"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Box Name */}
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Box className="w-3.5 h-3.5 text-blue-400" />
                <span>保管ボックス名 / 棚番</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 端子ボックス (A-01)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Base Unit */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">基準単位 (最小管理単位)</label>
              <select
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              >
                {PRESET_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
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

            {/* Photo Attachment & AI/OCR */}
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
                    <span>基準写真登録済（撮影時自動照合）</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dynamic Unit Conversions Section */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-slate-200 text-xs sm:text-sm">
                  包装単位・換算倍率設定
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
              現場で「1箱」または「1袋」でスキャンした際、この倍率を掛けて基準単位（{baseUnit}）に自動換算します。
            </p>

            <div className="space-y-2">
              {conversions.map((conv, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                  <span className="text-xs text-slate-400 font-bold">1</span>
                  <select
                    value={PRESET_UNITS.includes(conv.unit as any) ? conv.unit : 'custom'}
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        handleUpdateConversion(idx, 'unit', e.target.value);
                      }
                    }}
                    className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold"
                  >
                    <option value="custom">カスタム</option>
                    {PRESET_UNITS.filter((u) => u !== baseUnit).map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={conv.unit}
                    onChange={(e) => handleUpdateConversion(idx, 'unit', e.target.value)}
                    placeholder="単位名"
                    className="w-20 px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-bold text-xs text-center"
                  />
                  <span className="text-xs text-slate-400 font-bold">=</span>
                  <input
                    type="number"
                    min="1"
                    value={conv.multiplier}
                    onChange={(e) => handleUpdateConversion(idx, 'multiplier', e.target.value)}
                    className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-black text-xs text-center text-emerald-400"
                  />
                  <span className="text-xs text-slate-300 font-bold">{baseUnit}</span>

                  <button
                    type="button"
                    onClick={() => handleRemoveConversion(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
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
              マスタを保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
