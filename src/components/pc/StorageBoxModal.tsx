import React, { useState, useEffect } from 'react';
import { StorageBoxConfig } from '../../types/inventory';
import { useInventory } from '../../context/InventoryContext';
import {
  X,
  Box,
  Zap,
  Link2,
  Wrench,
  Shield,
  Server,
  Tag,
  Plug,
  Cpu,
  Save,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface StorageBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  boxConfig?: StorageBoxConfig | null;
  currentBoxName?: string;
  itemCountInBox?: number;
}

export const BOX_ICONS = [
  { id: 'box', label: '標準ボックス', icon: Box },
  { id: 'zap', label: '端子・圧着・電気', icon: Zap },
  { id: 'link', label: '結束バンド・配線', icon: Link2 },
  { id: 'wrench', label: 'ネジ・締結・ボルト', icon: Wrench },
  { id: 'shield', label: 'ヒューズ・保護具', icon: Shield },
  { id: 'server', label: '制御盤・DINレール', icon: Server },
  { id: 'tag', label: 'マークチューブ・銘板', icon: Tag },
  { id: 'plug', label: 'コネクタ・プラグ', icon: Plug },
  { id: 'cpu', label: '電子基板・リレー', icon: Cpu },
];

export const BOX_COLORS = [
  { id: 'emerald', label: 'エメラルドグリーン', bg: 'from-emerald-600/20 to-teal-950/40', border: 'border-emerald-500/50', text: 'text-emerald-400', badge: 'bg-emerald-500/20 border-emerald-500/30' },
  { id: 'amber', label: 'アンバーゴールド', bg: 'from-amber-600/20 to-yellow-950/40', border: 'border-amber-500/50', text: 'text-amber-400', badge: 'bg-amber-500/20 border-amber-500/30' },
  { id: 'blue', label: 'コバルトブルー', bg: 'from-blue-600/20 to-indigo-950/40', border: 'border-blue-500/50', text: 'text-blue-400', badge: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'rose', label: 'クリムゾンレッド', bg: 'from-rose-600/20 to-red-950/40', border: 'border-rose-500/50', text: 'text-rose-400', badge: 'bg-rose-500/20 border-rose-500/30' },
  { id: 'purple', label: 'パープルバイオレット', bg: 'from-purple-600/20 to-violet-950/40', border: 'border-purple-500/50', text: 'text-purple-400', badge: 'bg-purple-500/20 border-purple-500/30' },
  { id: 'cyan', label: 'シアンターコイズ', bg: 'from-cyan-600/20 to-blue-950/40', border: 'border-cyan-500/50', text: 'text-cyan-400', badge: 'bg-cyan-500/20 border-cyan-500/30' },
  { id: 'orange', label: 'サンセットオレンジ', bg: 'from-orange-600/20 to-amber-950/40', border: 'border-orange-500/50', text: 'text-orange-400', badge: 'bg-orange-500/20 border-orange-500/30' },
  { id: 'slate', label: 'スレートグレー', bg: 'from-slate-700/30 to-slate-950/50', border: 'border-slate-600/50', text: 'text-slate-300', badge: 'bg-slate-700/30 border-slate-600/30' },
];

export const StorageBoxModal: React.FC<StorageBoxModalProps> = ({
  isOpen,
  onClose,
  boxConfig,
  currentBoxName,
  itemCountInBox = 0,
}) => {
  const { updateBoxConfig, addBoxConfig, deleteBoxConfig, addToast } = useInventory();

  const isEdit = Boolean(currentBoxName);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('box');
  const [color, setColor] = useState('emerald');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (boxConfig) {
      setName(boxConfig.name);
      setIcon(boxConfig.icon || 'box');
      setColor(boxConfig.color || 'emerald');
      setDescription(boxConfig.description || '');
    } else if (currentBoxName) {
      setName(currentBoxName);
      setIcon('box');
      setColor('emerald');
      setDescription('');
    } else {
      setName('');
      setIcon('box');
      setColor('emerald');
      setDescription('');
    }
  }, [boxConfig, currentBoxName, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('warning', '保管箱名を入力してください');
      return;
    }

    const payload: StorageBoxConfig = {
      name: name.trim(),
      icon,
      color,
      description: description.trim() || undefined,
    };

    let ok = false;
    if (isEdit && currentBoxName) {
      ok = await updateBoxConfig(currentBoxName, payload);
    } else {
      ok = await addBoxConfig(payload);
    }

    if (ok) {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!currentBoxName) return;
    if (
      window.confirm(
        `保管箱「${currentBoxName}」の設定を削除しますか？\n（※箱の中の品目は削除されず、そのまま残ります）`
      )
    ) {
      await deleteBoxConfig(currentBoxName);
      onClose();
    }
  };

  const activeColorObj = BOX_COLORS.find((c) => c.id === color) || BOX_COLORS[0];
  const activeIconObj = BOX_ICONS.find((i) => i.id === icon) || BOX_ICONS[0];
  const PreviewIconComponent = activeIconObj.icon;

  const isRenaming = isEdit && currentBoxName && currentBoxName !== name.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <span className={`p-2 rounded-xl border ${activeColorObj.badge} ${activeColorObj.text}`}>
              <PreviewIconComponent className="w-5 h-5 stroke-[2.5]" />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-white">
                {isEdit ? `保管箱の編集・設定 (${currentBoxName})` : '✨ 新しい保管箱の追加'}
              </h3>
              <p className="text-[11px] text-slate-400">
                名前・アイコン・テーマカラーを自由にカスタマイズ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Live Preview Card */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-400">
              リアルタイムプレビュー (箱の外観)
            </label>
            <div
              className={`bg-gradient-to-br ${activeColorObj.bg} ${activeColorObj.border} border rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl border ${activeColorObj.badge} ${activeColorObj.text}`}>
                  <PreviewIconComponent className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-black text-base text-white">
                    {name.trim() || '（保管箱名を入力）'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {description.trim() || `${itemCountInBox} 品目格納`}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${activeColorObj.badge} ${activeColorObj.text}`}>
                {activeIconObj.label}
              </span>
            </div>
          </div>

          {/* Box Name Input */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              保管箱名・棚番名 <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 端子ボックス (A-01), 結束バンド箱 (B-01)"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold text-sm focus:outline-none focus:border-indigo-500"
            />
            {isRenaming && (
              <div className="mt-2 p-2.5 rounded-xl bg-amber-950/70 border border-amber-500/50 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  <strong>在庫自動連動:</strong> 箱名を変更すると、現在この箱に格納されている{' '}
                  <strong className="text-white font-black underline">{itemCountInBox} 件</strong>{' '}
                  の品目の保管場所名も自動で「{name.trim()}」へ書き換わります！
                </p>
              </div>
            )}
          </div>

          {/* Box Description */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              用途説明・格納資材の目安 (任意)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 圧着端子・スリーブ・絶縁キャップ"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Icon Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              標示アイコンを選択 (用途区別)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {BOX_ICONS.map((item) => {
                const IconComp = item.icon;
                const isSelected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center gap-2 transition ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <IconComp className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-300' : 'text-slate-400'}`} />
                    <span className="text-[11px] font-bold truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Theme Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              カラー標識を選択
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BOX_COLORS.map((c) => {
                const isSelected = color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setColor(c.id)}
                    className={`p-2 rounded-xl border flex items-center gap-2 transition ${
                      isSelected
                        ? `${c.bg} ${c.border} text-white shadow-md ring-1 ring-white/50`
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${c.badge} border shrink-0`} />
                    <span className="text-[11px] font-bold truncate">{c.label.split('')[0] + c.label.slice(1, 6)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-3.5 py-2 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                <span>削除</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-950 transition flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isEdit ? '保管箱設定を保存' : '保管箱を作成'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
