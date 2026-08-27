import React, { useState, useEffect, useRef } from 'react';
import { ItemMaster, UnitConversion, PRESET_UNITS } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import { OcrHelper } from '../../utils/ocrHelper';
import { X, Plus, Trash2, Layers, Building2, Camera, Box, Loader2 } from 'lucide-react';

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
  const { saveItem, addToast } = useInventory();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [category, setCategory] = useState('一般部品');
  const [supplier, setSupplier] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [baseUnit, setBaseUnit] = useState('個');
  const [currentStock, setCurrentStock] = useState(0);
  const [safetyStock, setSafetyStock] = useState(10);
  const [location, setLocation] = useState('1號盒');
  const [qrCode, setQrCode] = useState('');
  const [note, setNote] = useState('');

  // Dynamic packaging unit conversions
  const [conversions, setConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 50 },
    { unit: '袋', multiplier: 10 },
  ]);

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialItem) {
      setCode(initialItem.code);
      setName(initialItem.name);
      setSpec(initialItem.spec || '');
      setCategory(initialItem.category || '一般部品');
      setSupplier(initialItem.supplier || '');
      setImageUrl(initialItem.imageUrl);
      setBaseUnit(initialItem.baseUnit || '個');
      setCurrentStock(initialItem.currentStock || 0);
      setSafetyStock(initialItem.safetyStock || 0);
      setLocation(initialItem.location || '1號盒');
      setQrCode(initialItem.qrCode || `INV:v1:${initialItem.code}`);
      setNote(initialItem.note || '');
      setConversions(
        initialItem.unitConversions?.filter((c) => c.unit !== initialItem.baseUnit) || []
      );
    } else {
      setCode('');
      setName('');
      setSpec('');
      setCategory('一般部品');
      setSupplier('');
      setImageUrl(undefined);
      setBaseUnit('個');
      setCurrentStock(0);
      setSafetyStock(10);
      setLocation('1號盒');
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
      const base64 = event.target?.result as string;
      setImageUrl(base64);

      // Run OCR
      setIsOcrProcessing(true);
      try {
        const result = await OcrHelper.recognizeImage(base64);
        setIsOcrProcessing(false);
        if (result.suggestedName && !name) setName(result.suggestedName);
        if (result.suggestedSpec && !spec) setSpec(result.suggestedSpec);
        if (result.suggestedSupplier && !supplier) setSupplier(result.suggestedSupplier);
        if (result.suggestedBoxName && location === '1號盒') setLocation(result.suggestedBoxName);
        addToast('success', '已自動從照片辨識並填入品名/廠商資訊！');
      } catch {
        setIsOcrProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    // Combine base unit and packaging conversions
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
      location: location.trim() || '1號盒',
      qrCode: qrCode.trim() || `INV:v1:${code.trim()}`,
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
      note: note.trim() || undefined,
    };

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
              {initialItem ? '編輯品目主檔' : '新增品目主檔'}
            </h3>
            <p className="text-xs text-slate-400">
              品目資訊、廠商、盒子名稱、基準單位與包裝換算倍率設定
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
                品號 / 條碼代碼 (必填)
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例: 4901480000011 / BOLT-M6"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">
                品名 (必填)
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 六角孔螺栓 (SUS304)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Supplier / 廠商 */}
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                <span>廠商 / 供應商</span>
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="例: MISUMI, SMC, 日東電工..."
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Spec */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">規格 / 型號</label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="例: M6 × 20mm 不鏽鋼"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">商品分類</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="例: 螺栓螺帽 / 配線資材 / 消耗品"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Box Name / 盒子名稱 */}
            <div>
              <label className="block font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Box className="w-3.5 h-3.5 text-blue-400" />
                <span>盒子名稱 / 盒號 (Box Name)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: 1號盒 / 零件盒A-01"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Base Unit Selector */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">基準單位 (最小管理單位)</label>
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
              <label className="block font-bold text-slate-300 mb-1">目前庫存 ({baseUnit})</label>
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
              <label className="block font-bold text-slate-300 mb-1">安全庫存警報閥值 ({baseUnit})</label>
              <input
                type="number"
                min="0"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Photo Attachment & OCR */}
            <div>
              <label className="block font-bold text-slate-300 mb-1">商品照片 & 自動文字辨識</label>
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
                  disabled={isOcrProcessing}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-1.5 transition text-xs font-bold"
                >
                  {isOcrProcessing ? (
                    <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4 text-emerald-400" />
                  )}
                  <span>{isOcrProcessing ? 'OCR 辨識中...' : imageUrl ? '更換照片 (附OCR)' : '📸 上傳照片自動辨識'}</span>
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    className="text-xs text-rose-400 hover:underline font-semibold"
                  >
                    刪除照片
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Dynamic Unit Conversions Section */}
          <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span className="font-bold text-slate-200 text-xs sm:text-sm">
                  包裝換算倍率設定 (可動態編輯)
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddConversion}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增換算單位</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              現場掃描「1箱」或「1袋」時，系統會自動乘以此倍率換算為基準單位（{baseUnit}）。
            </p>

            <div className="space-y-2">
              {conversions.map((conv, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">1</span>
                  <input
                    type="text"
                    value={conv.unit}
                    onChange={(e) => handleUpdateConversion(idx, 'unit', e.target.value)}
                    placeholder="單位 (例: 箱)"
                    className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold"
                  />
                  <span className="text-xs text-slate-400">=</span>
                  <input
                    type="number"
                    min="1"
                    value={conv.multiplier}
                    onChange={(e) => handleUpdateConversion(idx, 'multiplier', e.target.value)}
                    className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-bold text-center"
                  />
                  <span className="text-xs text-slate-400">{baseUnit}</span>

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
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl shadow-lg shadow-blue-900/40 transition"
            >
              儲存主檔
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
