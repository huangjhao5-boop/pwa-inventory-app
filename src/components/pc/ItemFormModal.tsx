import React, { useState, useEffect } from 'react';
import { ItemMaster, UnitConversion } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import { X, Plus, Trash2, Save, Layers } from 'lucide-react';

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
  const { saveItem } = useInventory();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [spec, setSpec] = useState('');
  const [category, setCategory] = useState('ボルト・締結部品');
  const [baseUnit, setBaseUnit] = useState('個');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [safetyStock, setSafetyStock] = useState<number>(10);
  const [location, setLocation] = useState('A-01-1F');
  const [note, setNote] = useState('');
  const [conversions, setConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 50 },
    { unit: '袋', multiplier: 10 },
  ]);

  useEffect(() => {
    if (initialItem) {
      setCode(initialItem.code);
      setName(initialItem.name);
      setSpec(initialItem.spec || '');
      setCategory(initialItem.category || 'ボルト・締結部品');
      setBaseUnit(initialItem.baseUnit || '個');
      setCurrentStock(initialItem.currentStock);
      setSafetyStock(initialItem.safetyStock);
      setLocation(initialItem.location || 'A-01-1F');
      setNote(initialItem.note || '');
      setConversions(
        initialItem.unitConversions?.length > 0
          ? initialItem.unitConversions
          : [{ unit: '箱', multiplier: 50 }]
      );
    } else {
      setCode(`ITEM-${Date.now().toString().slice(-6)}`);
      setName('');
      setSpec('');
      setCategory('ボルト・締結部品');
      setBaseUnit('個');
      setCurrentStock(0);
      setSafetyStock(10);
      setLocation('A-01-1F');
      setNote('');
      setConversions([
        { unit: '箱', multiplier: 50 },
        { unit: '袋', multiplier: 10 },
      ]);
    }
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleAddConversionRow = () => {
    setConversions([...conversions, { unit: 'パック', multiplier: 5 }]);
  };

  const handleUpdateConversion = (index: number, field: keyof UnitConversion, val: any) => {
    const updated = [...conversions];
    updated[index] = { ...updated[index], [field]: val };
    setConversions(updated);
  };

  const handleRemoveConversion = (index: number) => {
    setConversions(conversions.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    // Filter valid conversions
    const validConversions = conversions
      .filter((c) => c.unit.trim().length > 0 && Number(c.multiplier) > 0)
      .map((c) => ({ unit: c.unit.trim(), multiplier: Number(c.multiplier) }));

    // Always ensure baseUnit conversion exists
    if (!validConversions.some((c) => c.unit === baseUnit.trim())) {
      validConversions.push({ unit: baseUnit.trim(), multiplier: 1 });
    }

    const itemToSave: ItemMaster = {
      id: initialItem?.id || `item-${Date.now()}`,
      code: code.trim(),
      name: name.trim(),
      spec: spec.trim(),
      category: category.trim(),
      baseUnit: baseUnit.trim() || '個',
      currentStock: Number(currentStock) || 0,
      safetyStock: Number(safetyStock) || 0,
      location: location.trim() || 'A-01',
      qrCode: initialItem?.qrCode || `INV:v1:${code.trim()}`,
      unitConversions: validConversions,
      note: note.trim(),
      updatedAt: new Date().toISOString(),
    };

    await saveItem(itemToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-extrabold text-base sm:text-lg text-white">
            {initialItem ? '📝 品目マスター編集' : '✨ 新規品目マスター登録'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                品号 / バーコード (必須)
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                分類カテゴリー
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="ボルト・締結部品">ボルト・締結部品</option>
                <option value="配線・電気資材">配線・電気資材</option>
                <option value="電子パーツ">電子パーツ</option>
                <option value="空圧・配管部品">空圧・配管部品</option>
                <option value="シール・パッキン">シール・パッキン</option>
                <option value="工具・消耗品">工具・消耗品</option>
                <option value="一般部品">一般部品</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                品名 (必須)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="例: 六角穴付ボルト (SUS304)"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">規格・型式</label>
              <input
                type="text"
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                placeholder="例: M6 × 20mm ステンレス"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">基準単位</label>
              <input
                type="text"
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                placeholder="個, 本, 枚..."
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">保管棚番 (ロケーション)</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="例: A-01-1F"
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">現在庫数</label>
              <input
                type="number"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">安全在庫数 (警告値)</label>
              <input
                type="number"
                value={safetyStock}
                onChange={(e) => setSafetyStock(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Dynamic Unit Conversion Section */}
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>包裝単位換算設定 (可動態設定)</span>
              </div>
              <button
                type="button"
                onClick={handleAddConversionRow}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>換算単位を追加</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              現場で「箱」「袋」で入出庫した際に、自動で基準単位「{baseUnit}」に掛け算換算されます。
            </p>

            <div className="space-y-2">
              {conversions.map((conv, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">1</span>
                  <input
                    type="text"
                    value={conv.unit}
                    onChange={(e) => handleUpdateConversion(idx, 'unit', e.target.value)}
                    placeholder="箱 / 袋..."
                    className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <span className="text-xs text-slate-400">=</span>
                  <input
                    type="number"
                    min="1"
                    value={conv.multiplier}
                    onChange={(e) =>
                      handleUpdateConversion(idx, 'multiplier', Number(e.target.value))
                    }
                    className="w-24 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                  />
                  <span className="text-xs text-slate-400">{baseUnit}</span>

                  <button
                    type="button"
                    onClick={() => handleRemoveConversion(idx)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">備考</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="メーカー名、仕入先、補足事項..."
            />
          </div>

          {/* Footer Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-base rounded-2xl shadow-xl transition flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              <span>マスター情報を保存</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
