import React, { useState, useRef, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster, UnitConversion, PRESET_UNITS } from '../../types/inventory';
import { AiVisionService, AiVisionResult } from '../../utils/geminiAiVision';
import { VisualKnowledgeService } from '../../utils/visualKnowledgeService';
import { ImageCompressor } from '../../utils/imageCompressor';
import {
  Camera,
  Loader2,
  Sparkles,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  X,
  Search,
  Plus,
  RefreshCw,
  Zap,
} from 'lucide-react';

interface PhotoCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialImage?: string | null;
}

export const PhotoCheckInModal: React.FC<PhotoCheckInModalProps> = ({
  isOpen,
  onClose,
  initialImage,
}) => {
  const { items, settings, recordTransaction, saveItem, addToast } = useInventory();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(initialImage || null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AiVisionResult | null>(null);

  // Mode: 'MATCH_EXISTING' (照合された既存品目) | 'CREATE_NEW' (バーコード無し新規品目)
  const [flowMode, setFlowMode] = useState<'MATCH_EXISTING' | 'CREATE_NEW'>('MATCH_EXISTING');
  const [selectedMatchedItem, setSelectedMatchedItem] = useState<ItemMaster | null>(null);

  // Inbound / Outbound Action Form State
  const [actionType, setActionType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedUnit, setSelectedUnit] = useState<string>('個');
  const [actionNote, setActionNote] = useState<string>('写真照合入庫 (バーコード無)');

  // New Item Registration State (when no matching item exists)
  const [newItemCode, setNewItemCode] = useState<string>('');
  const [newItemName, setNewItemName] = useState<string>('');
  const [newItemSpec, setNewItemSpec] = useState<string>('');
  const [newItemSupplier, setNewItemSupplier] = useState<string>('');
  const [newItemCategory, setNewItemCategory] = useState<string>('配線・電気資材');
  const [newItemBaseUnit, setNewItemBaseUnit] = useState<string>('個');
  const [newItemBoxName, setNewItemBoxName] = useState<string>('端子ボックス (A-01)');
  const [newItemSafetyStock, setNewItemSafetyStock] = useState<number>(10);
  const [newItemConversions, setNewItemConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 100 },
    { unit: '袋', multiplier: 10 },
  ]);

  // Search existing item picker if user wants to re-select
  const [searchPickerQuery, setSearchPickerQuery] = useState('');
  const [showSearchPicker, setShowSearchPicker] = useState(false);

  // Trigger analysis whenever capturedImage changes
  const runImageAnalysis = async (base64Img: string) => {
    setIsAnalyzing(true);
    setAiResult(null);
    setSelectedMatchedItem(null);
    setShowSearchPicker(false);

    try {
      const result = await AiVisionService.smartRecognize(
        base64Img,
        items,
        settings.geminiApiKey
      );
      setAiResult(result);
      setIsAnalyzing(false);

      if (result.matchedExistingItem) {
        setSelectedMatchedItem(result.matchedExistingItem);
        setFlowMode('MATCH_EXISTING');
        setSelectedUnit(result.matchedExistingItem.baseUnit || '個');
        addToast('success', `🎯 既存品目「${result.matchedExistingItem.name}」と一致しました`);
      } else {
        // Pre-fill new item form
        setFlowMode('CREATE_NEW');
        const codeGen = `NB-${Date.now().toString().slice(-6)}`;
        setNewItemCode(codeGen);
        setNewItemName(result.suggestedName || `品名未設定-${codeGen}`);
        setNewItemSpec(result.suggestedSpec || '');
        setNewItemSupplier(result.suggestedSupplier || '');
        setNewItemCategory(result.suggestedCategory || '配線・電気資材');
        setNewItemBaseUnit(result.suggestedBaseUnit || '個');
        setNewItemBoxName(result.suggestedBoxName || '端子ボックス (A-01)');
        setSelectedUnit(result.suggestedBaseUnit || '個');
        if (result.suggestedConversions && result.suggestedConversions.length > 0) {
          setNewItemConversions(result.suggestedConversions);
        }
      }
    } catch (err) {
      console.error('Photo check-in analysis failed:', err);
      setIsAnalyzing(false);
      setFlowMode('CREATE_NEW');
      const codeGen = `NB-${Date.now().toString().slice(-6)}`;
      setNewItemCode(codeGen);
      setNewItemName(`新商品-${codeGen}`);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialImage) {
        setCapturedImage(initialImage);
        runImageAnalysis(initialImage);
      } else {
        // Auto trigger file picker if no initial image
        setTimeout(() => {
          fileInputRef.current?.click();
        }, 100);
      }
    } else {
      setCapturedImage(null);
      setAiResult(null);
      setSelectedMatchedItem(null);
    }
  }, [isOpen, initialImage]);

  if (!isOpen) return null;

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const rawBase64 = ev.target?.result as string;
      const compressed = await ImageCompressor.compressImage(rawBase64, 480, 480, 0.7);
      setCapturedImage(compressed);
      runImageAnalysis(compressed);
    };
    reader.readAsDataURL(file);
  };

  // Execute Inbound / Outbound on Matched Existing Item
  const handleExecuteMatchedTransaction = async () => {
    if (!selectedMatchedItem) return;
    const conv = selectedMatchedItem.unitConversions?.find((u) => u.unit === selectedUnit) || {
      unit: selectedMatchedItem.baseUnit,
      multiplier: 1,
    };

    const ok = await recordTransaction(
      selectedMatchedItem,
      actionType,
      quantity,
      selectedUnit,
      conv.multiplier,
      actionNote
    );

    if (ok) {
      if (capturedImage) {
        VisualKnowledgeService.learnFromItem(selectedMatchedItem, capturedImage);
      }
      onClose();
    }
  };

  // Execute Save New Item & Inbound in 1-Click
  const handleSaveNewItemAndInbound = async () => {
    if (!newItemName.trim()) {
      addToast('error', '品名を入力してください');
      return;
    }

    const code = newItemCode.trim() || `NB-${Date.now().toString().slice(-6)}`;
    const allConversions: UnitConversion[] = [
      ...newItemConversions.filter((c) => c.unit !== newItemBaseUnit),
      { unit: newItemBaseUnit, multiplier: 1 },
    ];

    const newItem: ItemMaster = {
      id: `item-${code}`,
      code: code,
      name: newItemName.trim(),
      spec: newItemSpec.trim(),
      category: newItemCategory,
      supplier: newItemSupplier.trim() || undefined,
      imageUrl: capturedImage || undefined,
      baseUnit: newItemBaseUnit,
      currentStock: 0, // start from 0 and add via transaction below
      safetyStock: Number(newItemSafetyStock) || 0,
      location: newItemBoxName.trim() || '端子ボックス (A-01)',
      qrCode: `INV:v1:${code}`,
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
      note: 'バーコード無・写真登録品',
    };

    if (capturedImage) {
      VisualKnowledgeService.learnFromItem(newItem, capturedImage, aiResult?.rawAnalysis);
    }

    await saveItem(newItem);

    // Run transaction
    const conv = allConversions.find((c) => c.unit === selectedUnit) || { multiplier: 1 };
    await recordTransaction(
      newItem,
      actionType,
      quantity,
      selectedUnit,
      conv.multiplier,
      '新規写真登録・初回入荷'
    );

    addToast('success', `品目「${newItem.name}」を登録し、入庫を完了しました`);
    onClose();
  };

  // Filtered items for manual search picker
  const filteredPickerItems = items.filter((i) => {
    if (!searchPickerQuery.trim()) return true;
    const q = searchPickerQuery.toLowerCase().trim();
    return (
      i.name.toLowerCase().includes(q) ||
      i.code.toLowerCase().includes(q) ||
      (i.spec && i.spec.toLowerCase().includes(q)) ||
      (i.supplier && i.supplier.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        className="hidden"
      />

      <div className="bg-slate-900 border border-indigo-500/50 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-indigo-950/40">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Camera className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-white flex items-center gap-2">
                <span>📸 バーコード無し・写真照合入庫</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  AI自動照合
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                条碼無しのバルク品・端子・ネジ等の写真を撮影して即座に入庫登録
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Top Photo Preview & Retake Bar */}
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {capturedImage ? (
                <img
                  src={capturedImage}
                  alt="撮影写真"
                  className="w-16 h-16 rounded-xl object-cover border border-slate-700 bg-black shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                  <Camera className="w-6 h-6 text-slate-600" />
                </div>
              )}
              <div className="min-w-0">
                {isAnalyzing ? (
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>AI写真解析 & データベース照合中...</span>
                  </div>
                ) : aiResult ? (
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{aiResult.source === 'LEARNED_MEMORY' ? '過去の学習写真と完全一致' : aiResult.source === 'GEMINI_AI' ? 'Gemini AI 画像解析完了' : '画像照合完了'}</span>
                    </span>
                    <p className="text-xs text-slate-300 font-bold truncate">
                      {aiResult.suggestedName || selectedMatchedItem?.name || '品目情報を抽出しました'}
                    </p>
                    {aiResult.suggestedSpec && (
                      <span className="text-[10px] text-amber-300 font-mono font-bold block truncate">
                        規格: {aiResult.suggestedSpec}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">写真を撮影または選択してください</span>
                )}
              </div>
            </div>

            {/* Retake buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>再撮影</span>
              </button>
            </div>
          </div>

          {/* Mode Switch Tabs (照合一致 vs 新規品目登録) */}
          <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setFlowMode('MATCH_EXISTING')}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 ${
                flowMode === 'MATCH_EXISTING'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>既存マスタ品目に照合入庫</span>
            </button>
            <button
              type="button"
              onClick={() => setFlowMode('CREATE_NEW')}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 ${
                flowMode === 'CREATE_NEW'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>バーコード無の新規品目として登録</span>
            </button>
          </div>

          {/* ───────────────────────────────────────────────────────────── */}
          {/* FLOW 1: 既存品目への照合入庫 (MATCH_EXISTING) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {flowMode === 'MATCH_EXISTING' && (
            <div className="space-y-3.5">
              {selectedMatchedItem ? (
                <div className="bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 p-4 rounded-2xl border border-emerald-500/40 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wide">
                        🎯 照合・選択中の品目
                      </span>
                      <h4 className="font-extrabold text-base text-white mt-0.5">
                        {selectedMatchedItem.name}
                      </h4>
                      {selectedMatchedItem.spec && (
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold text-xs inline-block mt-1">
                          規格: {selectedMatchedItem.spec}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSearchPicker(true)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-bold transition flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>品目変更</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-slate-500">メーカー:</span> {selectedMatchedItem.supplier || '-'}
                    </div>
                    <div>
                      <span className="text-slate-500">保管場所:</span>{' '}
                      <strong className="text-indigo-300">{selectedMatchedItem.location}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">現在庫:</span>{' '}
                      <strong className="text-emerald-400 text-sm">{selectedMatchedItem.currentStock}</strong> {selectedMatchedItem.baseUnit}
                    </div>
                    <div>
                      <span className="text-slate-500">品目コード:</span>{' '}
                      <span className="font-mono text-slate-400">{selectedMatchedItem.code}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-950 rounded-2xl border border-dashed border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400 font-bold">照合品目が自動判定されませんでした</p>
                  <button
                    type="button"
                    onClick={() => setShowSearchPicker(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow transition"
                  >
                    🔍 登録済みの品目一覧から手動選択する
                  </button>
                </div>
              )}

              {/* Item Picker Modal / Accordion */}
              {showSearchPicker && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-blue-500/50 space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-300 flex items-center gap-1">
                      <Search className="w-3.5 h-3.5" />
                      <span>入庫する対象品目を検索選択:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSearchPicker(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      閉じる ✕
                    </button>
                  </div>
                  <input
                    type="text"
                    value={searchPickerQuery}
                    onChange={(e) => setSearchPickerQuery(e.target.value)}
                    placeholder="品名・規格型番・メーカー名で絞り込み..."
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <div className="max-h-48 overflow-y-auto space-y-1 p-1">
                    {filteredPickerItems.slice(0, 10).map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => {
                          setSelectedMatchedItem(it);
                          setSelectedUnit(it.baseUnit || '個');
                          setShowSearchPicker(false);
                        }}
                        className="w-full text-left p-2 rounded-xl bg-slate-900 hover:bg-blue-950/70 border border-slate-800 text-xs flex items-center justify-between transition"
                      >
                        <div>
                          <div className="font-bold text-white">{it.name}</div>
                          <div className="text-[11px] text-amber-300 font-mono">{it.spec || it.code}</div>
                        </div>
                        <div className="text-right text-slate-400">
                          <span>{it.currentStock} {it.baseUnit}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Inputs: IN / OUT and Quantity */}
              {selectedMatchedItem && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActionType('IN')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                        actionType === 'IN'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-400'
                      }`}
                    >
                      <ArrowDownCircle className="w-4 h-4" />
                      <span>【 入 荷（入庫加算）】</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionType('OUT')}
                      className={`flex-1 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                        actionType === 'OUT'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-slate-900 border border-slate-800 text-slate-400'
                      }`}
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>【 出 庫（払出減算）】</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">数量：</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={quantity === 0 ? '' : quantity}
                          onChange={(e) => setQuantity(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                          className="flex-1 text-center py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-black text-base focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setQuantity(quantity + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center"
                        >
                          ＋
                        </button>
                      </div>
                    </div>

                    {/* Packaging Unit Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1">単位（包装換算）：</label>
                      <select
                        value={selectedUnit}
                        onChange={(e) => setSelectedUnit(e.target.value)}
                        className="w-full py-2 px-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-bold text-xs"
                      >
                        <option value={selectedMatchedItem.baseUnit}>
                          {selectedMatchedItem.baseUnit} (基準単位 ×1)
                        </option>
                        {selectedMatchedItem.unitConversions
                          ?.filter((c) => c.unit !== selectedMatchedItem.baseUnit)
                          .map((conv) => (
                            <option key={conv.unit} value={conv.unit}>
                              {conv.unit} (1{conv.unit} = {conv.multiplier} {selectedMatchedItem.baseUnit})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">メモ：</label>
                    <input
                      type="text"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                      placeholder="例: 写真照合入庫 / 現場持出"
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Confirm Action Button */}
                  <button
                    type="button"
                    onClick={handleExecuteMatchedTransaction}
                    className={`w-full py-3 text-white font-black text-sm rounded-xl shadow-lg transition flex items-center justify-center gap-1.5 active:scale-95 ${
                      actionType === 'IN'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-950'
                        : 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-950'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      {actionType === 'IN'
                        ? `この品目を【 ${quantity} ${selectedUnit} 】入荷・棚加算する`
                        : `この品目を【 ${quantity} ${selectedUnit} 】出庫する`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────── */}
          {/* FLOW 2: バーコード無し新規品目登録 (CREATE_NEW) */}
          {/* ───────────────────────────────────────────────────────────── */}
          {flowMode === 'CREATE_NEW' && (
            <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-blue-500/40">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-xs font-black text-blue-300 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AIが写真から読み取った品目情報（編集可能）:</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">コード: {newItemCode}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">品名 <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="品名 (例: 裸圧着端子 丸形)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">規格 / 型番</label>
                  <input
                    type="text"
                    value={newItemSpec}
                    onChange={(e) => setNewItemSpec(e.target.value)}
                    placeholder="例: R2-4 (0.5~2.0sq)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-mono font-bold text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">メーカー / 仕入先</label>
                  <input
                    type="text"
                    value={newItemSupplier}
                    onChange={(e) => setNewItemSupplier(e.target.value)}
                    placeholder="例: ニチフ (NICHIFU)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">基準単位</label>
                  <select
                    value={newItemBaseUnit}
                    onChange={(e) => setNewItemBaseUnit(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs"
                  >
                    {PRESET_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">保管ボックス名</label>
                  <input
                    type="text"
                    value={newItemBoxName}
                    onChange={(e) => setNewItemBoxName(e.target.value)}
                    placeholder="例: 端子ボックス (A-01)"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-indigo-300 font-bold text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">安全在庫数 ({newItemBaseUnit})</label>
                  <input
                    type="number"
                    min="0"
                    value={newItemSafetyStock === 0 ? '' : newItemSafetyStock}
                    onChange={(e) => setNewItemSafetyStock(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Initial Inbound Quantity */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-xs font-black text-emerald-300 mb-1.5">
                  初回の入庫数量（入荷数）：
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={quantity === 0 ? '' : quantity}
                      onChange={(e) => setQuantity(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      className="flex-1 text-center py-1.5 bg-slate-900 border border-emerald-500/60 rounded-lg text-emerald-400 font-black text-base"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-black text-sm flex items-center justify-center"
                    >
                      ＋
                    </button>
                  </div>
                  <span className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-bold text-xs">
                    {newItemBaseUnit}
                  </span>
                </div>
              </div>

              {/* 1-Click Save & Inbound */}
              <button
                type="button"
                onClick={handleSaveNewItemAndInbound}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm rounded-xl shadow-lg shadow-blue-950 transition flex items-center justify-center gap-1.5 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>新規マスタ登録 ＆ 初回入庫（+{quantity} {newItemBaseUnit}）を完了する</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
