import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster, PRESET_UNITS, UnitConversion, VisualKnowledgeEntry } from '../../types/inventory';
import { AiVisionService, AiVisionResult } from '../../utils/geminiAiVision';
import { VisualKnowledgeService } from '../../utils/visualKnowledgeService';
import { ImageCompressor } from '../../utils/imageCompressor';
import {
  Sparkles,
  GraduationCap,
  CheckCircle2,
  Box,
  Upload,
  RefreshCw,
  Trash2,
  Zap,
  BookOpen,
  ZoomIn,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';

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
];

export const AiTrainingStudio: React.FC = () => {
  const { items, settings, addToast, saveItem } = useInventory();

  // Selected Photo for training bench
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedItemSource, setSelectedItemSource] = useState<ItemMaster | null>(null);

  // AI Prediction State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiVisionResult | null>(null);

  // Teacher's Correct Answer State (對答案輸入欄位)
  const [correctName, setCorrectName] = useState('');
  const [correctSpec, setCorrectSpec] = useState('');
  const [correctSupplier, setCorrectSupplier] = useState('');
  const [correctCategory, setCorrectCategory] = useState('配線・電気資材');
  const [correctBaseUnit, setCorrectBaseUnit] = useState('個');
  const [correctLocation, setCorrectLocation] = useState('端子ボックス (A-01)');
  const [correctConversions, setCorrectConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 100 },
    { unit: '袋', multiplier: 10 },
  ]);

  // Learned Memory List
  const [learnedEntries, setLearnedEntries] = useState<VisualKnowledgeEntry[]>([]);

  // Zoom Lightbox State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Dropdown states
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [isLearnedJustNow, setIsLearnedJustNow] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refresh knowledge bank list
  const refreshKnowledgeBank = () => {
    const list = VisualKnowledgeService.getKnowledgeBank();
    setLearnedEntries([...list]);
  };

  useEffect(() => {
    refreshKnowledgeBank();
  }, []);

  // Filter existing items that have photos
  const itemsWithPhotos = useMemo(() => {
    return items.filter((i) => Boolean(i.imageUrl));
  }, [items]);

  // Supplier Autocomplete
  const uniqueSuppliers = useMemo(() => {
    const fromItems = items.map((i) => i.supplier).filter(Boolean) as string[];
    return Array.from(new Set([...fromItems, ...PRESET_SUPPLIERS]));
  }, [items]);

  const filteredSuppliers = useMemo(() => {
    if (!correctSupplier.trim()) return uniqueSuppliers.slice(0, 8);
    const q = correctSupplier.toLowerCase().trim();
    return uniqueSuppliers.filter((s) => s.toLowerCase().includes(q)).slice(0, 8);
  }, [correctSupplier, uniqueSuppliers]);

  // Run AI Inspection on selected image
  const runAiAnalysis = async (imgBase64: string, existingHintItem?: ItemMaster | null) => {
    setIsAnalyzing(true);
    setIsLearnedJustNow(false);
    try {
      const result = await AiVisionService.smartRecognize(
        imgBase64,
        items,
        settings.geminiApiKey
      );
      setAiResult(result);
      setIsAnalyzing(false);

      // Pre-fill teacher's form with initial values (either from hint item or AI prediction)
      if (existingHintItem) {
        setCorrectName(existingHintItem.name);
        setCorrectSpec(existingHintItem.spec || '');
        setCorrectSupplier(existingHintItem.supplier || '');
        setCorrectCategory(existingHintItem.category || '配線・電気資材');
        setCorrectBaseUnit(existingHintItem.baseUnit || '個');
        setCorrectLocation(existingHintItem.location || '端子ボックス (A-01)');
        setCorrectConversions(
          existingHintItem.unitConversions?.filter((c) => c.unit !== existingHintItem.baseUnit) || [
            { unit: '箱', multiplier: 100 },
            { unit: '袋', multiplier: 10 },
          ]
        );
      } else {
        setCorrectName(result.suggestedName || '');
        setCorrectSpec(result.suggestedSpec || '');
        setCorrectSupplier(result.suggestedSupplier || '');
        setCorrectCategory(result.suggestedCategory || '配線・電気資材');
        setCorrectBaseUnit(result.suggestedBaseUnit || '個');
        setCorrectLocation(result.suggestedBoxName || '端子ボックス (A-01)');
        if (result.suggestedConversions && result.suggestedConversions.length > 0) {
          setCorrectConversions(result.suggestedConversions);
        }
      }
    } catch {
      setIsAnalyzing(false);
    }
  };

  // Handle choosing a registered item photo
  const handleSelectExistingItemPhoto = (item: ItemMaster) => {
    if (!item.imageUrl) return;
    setSelectedImage(item.imageUrl);
    setSelectedItemSource(item);
    runAiAnalysis(item.imageUrl, item);
  };

  // Handle uploading a new photo
  const handleUploadNewPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawBase64 = event.target?.result as string;
      const base64 = await ImageCompressor.compressImage(rawBase64, 360, 360, 0.65);
      setSelectedImage(base64);
      setSelectedItemSource(null);
      runAiAnalysis(base64, null);
    };
    reader.readAsDataURL(file);
  };

  // TEACH / SAVE GROUND TRUTH (指導學習並固化記憶)
  const handleTeachAndLearn = async () => {
    if (!selectedImage) {
      addToast('warning', '指導する写真を選択してください');
      return;
    }
    if (!correctName.trim()) {
      addToast('warning', '正解の品名を入力してください');
      return;
    }

    const allConversions: UnitConversion[] = [
      ...correctConversions.filter((c) => c.unit.trim() && c.unit !== correctBaseUnit),
      { unit: correctBaseUnit, multiplier: 1 },
    ];

    const groundTruthItem: ItemMaster = {
      id: selectedItemSource?.id || `learned-${Date.now()}`,
      code: selectedItemSource?.code || `AI-${Date.now().toString().slice(-6)}`,
      name: correctName.trim(),
      spec: correctSpec.trim(),
      category: correctCategory.trim(),
      supplier: correctSupplier.trim() || undefined,
      imageUrl: selectedImage,
      baseUnit: correctBaseUnit.trim() || '個',
      currentStock: selectedItemSource?.currentStock || 0,
      safetyStock: selectedItemSource?.safetyStock || 10,
      location: correctLocation.trim() || '端子ボックス (A-01)',
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
    };

    // 1. 現場AI知識庫に即時学習・記憶（品名、規格型番、メーカー、OCR読取文字をすべて特徴結合）
    const combinedOcr = [
      aiResult?.rawAnalysis || '',
      aiResult?.suggestedName || '',
      aiResult?.suggestedSpec || '',
      correctName,
      correctSpec,
      correctSupplier,
    ].join(' ');

    await VisualKnowledgeService.learnFromItem(
      groundTruthItem,
      selectedImage,
      combinedOcr
    );

    // 既存品目の場合はマスタ側も同時に更新
    if (selectedItemSource) {
      await saveItem(groundTruthItem);
    }

    refreshKnowledgeBank();
    setIsLearnedJustNow(true);

    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {}

    addToast('success', `🎓 正解を現場AIに記憶させました！次回以降 99% 精密一致します。`);

    // 2. 自動で再テストを実行し、学習成果を確認
    const updatedItems = selectedItemSource
      ? items.map((i) => (i.id === groundTruthItem.id ? groundTruthItem : i))
      : items;
    const retest = await AiVisionService.smartRecognize(selectedImage, updatedItems, settings.geminiApiKey);
    setAiResult(retest);
  };

  const handleClearAllKnowledge = () => {
    if (window.confirm('現場AIが学習したすべての記憶パターンを初期化しますか？')) {
      VisualKnowledgeService.clearKnowledgeBank();
      refreshKnowledgeBank();
      addToast('info', '現場AIの学習記憶をリセットしました');
    }
  };

  const handleDeleteEntry = (code: string) => {
    VisualKnowledgeService.removeItem(code);
    refreshKnowledgeBank();
    addToast('info', '選択した学習パターンを削除しました');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-blue-950 border border-indigo-500/40 rounded-3xl p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-indigo-600/30 text-indigo-400 border border-indigo-500/50 rounded-2xl shadow">
              <GraduationCap className="w-6 h-6" />
            </span>
            <div>
              <h2 className="font-black text-xl text-white flex items-center gap-2">
                <span>🎓 現場 AI 写真学習・対答案スタジオ</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
                  学習済: {learnedEntries.length} 件
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                登録済み写真や新写真を選んで AI の推論結果を確認 ➔ 人間先生が正解を指導（対答案）➔ 即座に現場AI記憶バンクに学習・定着させます。
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleUploadNewPhoto}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-950 transition"
          >
            <Upload className="w-4 h-4" />
            <span>新しい写真をアップロードして指導</span>
          </button>
        </div>
      </div>

      {/* Main Bench: Photo Selector + Interactive Comparison Testing Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Registered Photos Gallery (3 cols) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col max-h-[680px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>登録済みの商品写真 ({itemsWithPhotos.length}件)</span>
            </span>
            <span className="text-[11px] text-slate-400">タップで選択</span>
          </div>

          <div className="overflow-y-auto space-y-2 mt-3 flex-1 pr-1">
            {itemsWithPhotos.length > 0 ? (
              itemsWithPhotos.map((item) => {
                const isSelected = selectedImage === item.imageUrl;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectExistingItemPhoto(item)}
                    className={`w-full text-left p-2.5 rounded-2xl border transition flex items-center gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/90 border-indigo-500 shadow-md shadow-indigo-950'
                        : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800/80'
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-14 h-14 object-cover rounded-xl border border-slate-700 bg-black shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold text-xs text-white truncate">{item.name}</span>
                      </div>
                      {item.spec && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold block truncate w-fit">
                          規格: {item.spec}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 mt-0.5 block truncate">
                        {item.supplier || 'メーカー未設定'}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs">
                写真が登録されている商品がありません。上のボタンから写真をアップロードしてください。
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Teacher-Student Comparison Bench (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {selectedImage ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-extrabold text-base text-white">
                    対答案テスト台 (AI推論 🆚 人間先生の正解)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => runAiAnalysis(selectedImage, selectedItemSource)}
                  disabled={isAnalyzing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-amber-400' : ''}`} />
                  <span>AI再診断</span>
                </button>
              </div>

              {/* Side-by-Side Comparison Box */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. AI's Prediction (AIの回答) */}
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-blue-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-400" />
                      <span>🤖 AI の推論回答</span>
                    </span>
                    {aiResult && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          aiResult.source === 'LEARNED_MEMORY'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : aiResult.source === 'GEMINI_AI'
                            ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}
                      >
                        {aiResult.source === 'LEARNED_MEMORY'
                          ? '🧠 現場AI学習記憶 (99%一致)'
                          : aiResult.source === 'GEMINI_AI'
                          ? '✨ Gemini AI'
                          : '⚡ 電工OCR'}
                      </span>
                    )}
                  </div>

                  {/* Photo Thumbnail (Click to zoom) */}
                  <div
                    onClick={() => setZoomedImage(selectedImage)}
                    className="relative aspect-video max-h-36 bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center cursor-pointer group hover:border-indigo-500 transition"
                    title="クリックして拡大表示"
                  >
                    <img src={selectedImage} alt="テスト写真" className="w-full h-full object-contain group-hover:scale-105 transition duration-200" />
                    <div className="absolute top-2 right-2 p-1.5 bg-slate-900/80 hover:bg-indigo-600 rounded-lg text-slate-300 hover:text-white border border-slate-700 shadow transition opacity-80 group-hover:opacity-100 flex items-center gap-1 text-[10px] font-bold">
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>拡大</span>
                    </div>
                    {isAnalyzing && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-amber-400 gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-bold text-white">AI解析中...</span>
                      </div>
                    )}
                  </div>

                  {/* Predicted Fields */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">推論品名:</span>
                      <strong className="text-white text-sm">
                        {aiResult?.suggestedName || '（未検出）'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">推論規格・型番:</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono font-bold text-xs inline-block">
                        {aiResult?.suggestedSpec || '（未検出）'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-500 block text-[11px]">推論メーカー:</span>
                        <span className="font-bold text-slate-300">{aiResult?.suggestedSupplier || '（未検出）'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">推論最小単位:</span>
                        <span className="font-bold text-emerald-400">{aiResult?.suggestedBaseUnit || '個'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Teacher's Correct Answer (人間先生の正解・対答案) */}
                <div className="bg-indigo-950/30 p-4 rounded-2xl border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>🎓 人間先生の正解（対答案）</span>
                    </span>
                    <span className="text-[10px] text-slate-400">修正して学習</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="block font-bold text-slate-300 mb-0.5">正解の品名</label>
                      <input
                        type="text"
                        value={correctName}
                        onChange={(e) => setCorrectName(e.target.value)}
                        placeholder="例: インシュロック 屋内用 / 丸形圧着端子"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-300 mb-0.5">正解の規格・型番 (重要)</label>
                      <input
                        type="text"
                        value={correctSpec}
                        onChange={(e) => setCorrectSpec(e.target.value)}
                        placeholder="例: AB150-W / R2-4 / M6×20"
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Supplier with Fast Selector */}
                    <div className="relative">
                      <label className="block font-bold text-slate-300 mb-0.5 flex items-center justify-between">
                        <span>正解のメーカー</span>
                        <span className="text-[10px] text-indigo-400 font-normal">候補からワンタップ</span>
                      </label>
                      <input
                        type="text"
                        value={correctSupplier}
                        onFocus={() => setShowSupplierDropdown(true)}
                        onChange={(e) => {
                          setCorrectSupplier(e.target.value);
                          setShowSupplierDropdown(true);
                        }}
                        placeholder="例: ヘラマンタイトン, ニチフ, TOHO..."
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-indigo-500"
                      />
                      {showSupplierDropdown && filteredSuppliers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-30 max-h-40 overflow-y-auto p-1 grid grid-cols-2 gap-1">
                          {filteredSuppliers.map((sup) => (
                            <button
                              key={sup}
                              type="button"
                              onClick={() => {
                                setCorrectSupplier(sup);
                                setShowSupplierDropdown(false);
                              }}
                              className="text-left px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-900 text-xs text-slate-200 truncate"
                            >
                              {sup}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Minimum Base Unit Pills */}
                    <div>
                      <label className="block font-bold text-slate-300 mb-1">
                        正解の最小単位: 【 <strong className="text-amber-400">{correctBaseUnit}</strong> 】
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {PRESET_UNITS.slice(0, 9).map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setCorrectBaseUnit(u)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              correctBaseUnit === u
                                ? 'bg-amber-500 text-slate-950 font-black shadow'
                                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Big Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTeachAndLearn}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950 transition flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-5 h-5" />
                  <span>🎓 この正解を現場AIに学習・記憶させる（即時定着）</span>
                </button>
              </div>

              {isLearnedJustNow && (
                <div className="p-3.5 bg-emerald-950/60 border border-emerald-700/60 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <strong className="block text-white">🎉 学習に成功しました！</strong>
                    <span>
                      この写真の色彩指紋とOCRトークンが現場AI知識庫に保存されました。次回以降の認識確信度は 99% に固定されます。
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3 shadow-xl">
              <GraduationCap className="w-12 h-12 text-indigo-400 mx-auto" />
              <h3 className="font-extrabold text-base text-white">
                左側の写真一覧から選択するか、写真をアップロードしてください
              </h3>
              <p className="text-xs max-w-md mx-auto">
                AI の推論結果を確認し、人間が正解を修正して「学習させる」ボタンを押すことで、AIが即座に記憶します。
              </p>
            </div>
          )}

          {/* Learned Memory Knowledge Bank Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Box className="w-4 h-4 text-emerald-400" />
                  <span>🧠 現場AI学習済み記憶バンク ({learnedEntries.length}件)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  本機内に保存されている自己学習パターン一覧（オフラインでも自動照合）
                </p>
              </div>

              {learnedEntries.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllKnowledge}
                  className="text-xs text-rose-400 hover:text-rose-300 font-bold px-3 py-1.5 rounded-xl bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/40 transition"
                >
                  学習記憶を全消去
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">写真</th>
                    <th className="py-2.5 px-3">学習品名</th>
                    <th className="py-2.5 px-3">規格・型番</th>
                    <th className="py-2.5 px-3">メーカー</th>
                    <th className="py-2.5 px-3 text-center">最小単位</th>
                    <th className="py-2.5 px-3 text-center">照合回数</th>
                    <th className="py-2.5 px-3 text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {learnedEntries.length > 0 ? (
                    learnedEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3">
                          {entry.imageThumbnail ? (
                            <img
                              src={entry.imageThumbnail}
                              alt={entry.name}
                              onClick={(e) => {
                                e.stopPropagation();
                                setZoomedImage(entry.imageThumbnail || null);
                              }}
                              className="w-9 h-9 object-cover rounded-lg border border-slate-700 bg-black cursor-pointer hover:scale-125 hover:border-indigo-400 transition shadow"
                              title="クリックで拡大表示"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-slate-500">
                              無
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-white">{entry.name}</td>
                        <td className="py-2.5 px-3 font-mono text-amber-300">{entry.spec || '-'}</td>
                        <td className="py-2.5 px-3 text-blue-300">{entry.supplier || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-400">
                          {entry.baseUnit || '個'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                          {entry.matchCount}回
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(entry.itemCode)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition rounded-lg hover:bg-slate-800"
                            title="削除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        まだ学習データがありません。上のテスト台で写真を指導すると、ここに記憶パターンが蓄積されます。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* High-Resolution Photo Lightbox Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col items-center"
          >
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute -top-3 -right-3 p-2 bg-slate-800 hover:bg-rose-600 text-white rounded-full border border-slate-600 shadow-xl transition active:scale-95"
              title="閉じる"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="overflow-auto max-h-[82vh] rounded-2xl border border-slate-800 bg-black flex items-center justify-center">
              <img
                src={zoomedImage}
                alt="高解像度プレビュー"
                className="max-w-full max-h-[80vh] object-contain rounded-xl select-none"
              />
            </div>
            <div className="pt-2 text-center text-xs text-slate-400 font-medium">
              🔍 高解像度拡大表示（枠外クリックまたは右上の ✕ で閉じます）
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
