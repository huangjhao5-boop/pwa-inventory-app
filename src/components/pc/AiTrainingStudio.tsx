import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ItemMaster, PRESET_UNITS, UnitConversion, VisualKnowledgeEntry } from '../../types/inventory';
import { AiVisionService, AiVisionResult } from '../../utils/geminiAiVision';
import { VisualKnowledgeService } from '../../utils/visualKnowledgeService';
import { ImageCompressor } from '../../utils/imageCompressor';
import { ImageCropperModal } from '../scanner/ImageCropperModal';
import { SmartAutoCompleteInput } from '../common/SmartAutoCompleteInput';
import {
  Sparkles,
  GraduationCap,
  CheckCircle2,
  Upload,
  RefreshCw,
  Trash2,
  Zap,
  BookOpen,
  ZoomIn,
  X,
  Crop,
  Key,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const PRESET_SUPPLIERS = [
  '東洋技研',
  '春日電機',
  '日東工業',
  'タカチ電機工業',
  '寺田電機',
  'パトライト',
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
  'IDEC',
  'WAGO',
  'フエニックス・コンタクト',
  'ミスミ',
  'SMC',
  'キーエンス',
];

export const AiTrainingStudio: React.FC = () => {
  const { items, settings, updateSettings, addToast, saveItem } = useInventory();

  // Selected Photo for training bench
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rawUncroppedImage, setRawUncroppedImage] = useState<string | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [selectedItemSource, setSelectedItemSource] = useState<ItemMaster | null>(null);

  // AI Prediction State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiVisionResult | null>(null);

  // Teacher's Correct Answer State (對答案輸入欄位)
  const [correctName, setCorrectName] = useState('');
  const [correctSpec, setCorrectSpec] = useState('');
  const [correctSupplier, setCorrectSupplier] = useState('');
  const [correctCategory, setCorrectCategory] = useState('制御盤パーツ');
  const [correctBaseUnit, setCorrectBaseUnit] = useState('個');
  const [correctLocation, setCorrectLocation] = useState('盤内資材 (D-01)');
  const [correctConversions, setCorrectConversions] = useState<UnitConversion[]>([
    { unit: '箱', multiplier: 10 },
    { unit: '袋', multiplier: 1 },
  ]);

  // Learned Memory List
  const [learnedEntries, setLearnedEntries] = useState<VisualKnowledgeEntry[]>([]);

  // Zoom Lightbox State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // API Key Quick Edit
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [inputApiKey, setInputApiKey] = useState(settings.geminiApiKey || '');

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

  // Autocomplete Candidate lists
  const nameCandidates = useMemo(() => {
    const list = [
      '中継端子ボックス',
      '中継ボックス',
      '端子台',
      '裸圧着端子 丸形',
      '裸圧着端子 Y形',
      '絶縁被覆付圧着端子',
      'インシュロック (結束バンド)',
      'DINレール',
      'ガラス管ヒューズ',
      'ミニチュアリレー',
      'プルボックス',
      '配線ダクト',
      'マークチューブ',
      ...items.map((i) => i.name),
      ...(aiResult?.candidateTokens || []),
    ];
    return Array.from(new Set(list.filter(Boolean)));
  }, [items, aiResult]);

  const specCandidates = useMemo(() => {
    const list = [
      'BOXTM-2001',
      'JB-100',
      'JB-150',
      'TX-10',
      'TB-15',
      'R2-4',
      'R5.5-5',
      '1.25Y-3.5',
      '2Y-4',
      'AB300',
      'AB150-W',
      '600V 15A',
      '250V 5A',
      'M6×20mm',
      ...items.map((i) => i.spec).filter(Boolean),
      ...(aiResult?.candidateTokens || []),
    ];
    return Array.from(new Set(list.filter(Boolean) as string[]));
  }, [items, aiResult]);

  const supplierCandidates = useMemo(() => {
    const fromItems = items.map((i) => i.supplier).filter(Boolean) as string[];
    return Array.from(new Set([...fromItems, ...PRESET_SUPPLIERS]));
  }, [items]);

  const boxCandidates = useMemo(() => {
    const fromItems = items.map((i) => i.location).filter(Boolean) as string[];
    const defaults = ['盤内資材 (D-01)', '端子ボックス (A-01)', '結束バンドボックス (B-01)', 'マークチューブ棚 (C-01)'];
    return Array.from(new Set([...fromItems, ...defaults]));
  }, [items]);

  // Run AI Inspection on selected image (High resolution analysis)
  const runAiAnalysis = async (imgBase64: string, existingHintItem?: ItemMaster | null) => {
    setIsAnalyzing(true);
    try {
      const result = await AiVisionService.smartRecognize(
        imgBase64,
        items,
        settings.geminiApiKey
      );
      setAiResult(result);
      setIsAnalyzing(false);

      // Pre-fill teacher's form
      if (existingHintItem) {
        setCorrectName(existingHintItem.name);
        setCorrectSpec(existingHintItem.spec || '');
        setCorrectSupplier(existingHintItem.supplier || '');
        setCorrectCategory(existingHintItem.category || '制御盤パーツ');
        setCorrectBaseUnit(existingHintItem.baseUnit || '個');
        setCorrectLocation(existingHintItem.location || '盤内資材 (D-01)');
        setCorrectConversions(
          existingHintItem.unitConversions?.filter((c) => c.unit !== existingHintItem.baseUnit) || [
            { unit: '箱', multiplier: 10 },
            { unit: '袋', multiplier: 1 },
          ]
        );
      } else {
        setCorrectName(result.suggestedName || '');
        setCorrectSpec(result.suggestedSpec || '');
        setCorrectSupplier(result.suggestedSupplier || '');
        setCorrectCategory(result.suggestedCategory || '制御盤パーツ');
        setCorrectBaseUnit(result.suggestedBaseUnit || '個');
        setCorrectLocation(result.suggestedBoxName || '盤内資材 (D-01)');
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
    setRawUncroppedImage(item.imageUrl);
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
      // High quality 1600px for AI & OCR analysis
      const highRes = await ImageCompressor.compressForAnalysis(rawBase64, 1600, 1600, 0.9);
      setRawUncroppedImage(highRes);
      setSelectedImage(highRes);
      setSelectedItemSource(null);
      setIsCropperOpen(true); // Pop up crop modal for accurate ROI
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBase64: string) => {
    setSelectedImage(croppedBase64);
    setIsCropperOpen(false);
    runAiAnalysis(croppedBase64, selectedItemSource);
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
      location: correctLocation.trim() || '盤内資材 (D-01)',
      unitConversions: allConversions,
      updatedAt: new Date().toISOString(),
    };

    // Teach AI
    await VisualKnowledgeService.learnFromItem(
      groundTruthItem,
      selectedImage,
      `${correctName} ${correctSpec} ${correctSupplier} ${correctLocation}`
    );

    // Also update existing item if linked
    if (selectedItemSource) {
      await saveItem({
        ...selectedItemSource,
        name: correctName.trim(),
        spec: correctSpec.trim(),
        supplier: correctSupplier.trim() || undefined,
        category: correctCategory.trim(),
        baseUnit: correctBaseUnit.trim() || '個',
        location: correctLocation.trim(),
        unitConversions: allConversions,
        updatedAt: new Date().toISOString(),
      });
    }

    refreshKnowledgeBank();

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // ignore
    }

    addToast(
      'success',
      `🎓 AI学習完了！次回からこの写真・特徴は「${correctName}」として即座に100%識別されます`
    );
  };

  const handleSaveApiKey = () => {
    updateSettings({ geminiApiKey: inputApiKey.trim() });
    setShowApiKeyInput(false);
    addToast('success', 'Gemini API 設定を保存しました');
    if (selectedImage) {
      runAiAnalysis(selectedImage, selectedItemSource);
    }
  };

  const handleDeleteEntry = (code: string) => {
    VisualKnowledgeService.removeItem(code);
    refreshKnowledgeBank();
    addToast('info', '選択した学習パターンを削除しました');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-8 animate-in fade-in duration-200">
      {/* Cropper Modal */}
      {isCropperOpen && rawUncroppedImage && (
        <ImageCropperModal
          isOpen={isCropperOpen}
          imageSrc={rawUncroppedImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setIsCropperOpen(false);
            if (rawUncroppedImage) {
              runAiAnalysis(rawUncroppedImage, selectedItemSource);
            }
          }}
        />
      )}

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
                高解像度写真や枠トリミングで AI の推論結果を確認 ➔ 人間先生が正解を指導（対答案）➔ 即座に現場AI記憶バンクに学習定着！
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowApiKeyInput(!showApiKeyInput)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-xl text-xs font-bold transition"
            title="Gemini API 設定"
          >
            <Key className="w-4 h-4" />
            <span>{settings.geminiApiKey ? '✨ Gemini AI 連携中' : '🔑 APIキー設定'}</span>
          </button>

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
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-950 transition"
          >
            <Upload className="w-4 h-4" />
            <span>新しい写真をアップロードして指導</span>
          </button>
        </div>
      </div>

      {/* API Key Modal / Dropdown */}
      {showApiKeyInput && (
        <div className="bg-slate-900 border border-amber-500/50 p-4 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center gap-3 animate-in fade-in">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-amber-300 mb-1">
              Google Gemini API Key (AI画像認識用):
            </label>
            <input
              type="text"
              value={inputApiKey}
              onChange={(e) => setInputApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition"
            >
              保存して再診断
            </button>
            <button
              type="button"
              onClick={() => setShowApiKeyInput(false)}
              className="px-3 py-2 bg-slate-800 text-slate-400 hover:text-white text-xs rounded-xl transition"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

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
                        ? 'bg-blue-950/60 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60'
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-700 bg-black shrink-0"
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
                <div className="flex items-center gap-2">
                  {rawUncroppedImage && (
                    <button
                      type="button"
                      onClick={() => setIsCropperOpen(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold transition"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      <span>枠トリミング調整</span>
                    </button>
                  )}
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

                  {/* Photo Thumbnail */}
                  <div
                    onClick={() => setZoomedImage(selectedImage)}
                    className="relative aspect-video max-h-36 bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center cursor-pointer group hover:border-indigo-500 transition"
                    title="クリックして拡大表示"
                  >
                    <img
                      src={selectedImage}
                      alt="診断対象写真"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs text-white font-bold gap-1">
                      <ZoomIn className="w-4 h-4" />
                      <span>拡大</span>
                    </div>
                  </div>

                  {/* Prediction Values Display */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">推論品名:</span>
                      <strong className="text-sm text-white font-black block">
                        {aiResult?.suggestedName || (isAnalyzing ? '解析中...' : '（未検出）')}
                      </strong>
                    </div>

                    <div>
                      <span className="text-slate-400 text-[11px] block">推論規格・型番:</span>
                      <span className="text-amber-300 font-mono font-bold">
                        {aiResult?.suggestedSpec || '（未検出）'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[11px] block">推論メーカー:</span>
                        <span className="text-slate-200 font-bold">
                          {aiResult?.suggestedSupplier || '（未検出）'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[11px] block">推論最小単位:</span>
                        <strong className="text-emerald-400 font-black">
                          {aiResult?.suggestedBaseUnit || '個'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Teacher's Correct Answer Input (人間先生の正解) */}
                <div className="bg-gradient-to-br from-indigo-950/40 via-slate-950 to-slate-900 p-4 rounded-2xl border border-indigo-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>🎓 人間先生の正解（対答案）</span>
                    </span>
                    <span className="text-[10px] text-slate-400">修正して学習</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <SmartAutoCompleteInput
                      label="正解の品名"
                      required
                      value={correctName}
                      onChange={setCorrectName}
                      placeholder="例: 中継端子ボックス"
                      candidates={nameCandidates}
                    />

                    <SmartAutoCompleteInput
                      label="正解の規格・型番 (重要)"
                      value={correctSpec}
                      onChange={setCorrectSpec}
                      placeholder="例: BOXTM-2001 (600V 15A)"
                      candidates={specCandidates}
                      inputClassName="text-amber-300 font-mono"
                    />

                    <SmartAutoCompleteInput
                      label="正解のメーカー"
                      value={correctSupplier}
                      onChange={setCorrectSupplier}
                      placeholder="例: 東洋技研 (TOGI)"
                      candidates={supplierCandidates}
                    />

                    <SmartAutoCompleteInput
                      label="保管ボックス名"
                      value={correctLocation}
                      onChange={setCorrectLocation}
                      placeholder="例: 盤内資材 (D-01)"
                      candidates={boxCandidates}
                      inputClassName="text-indigo-300 font-bold"
                    />

                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1 font-bold">
                        正解の最小単位: 【 <strong className="text-amber-300">{correctBaseUnit}</strong> 】
                      </label>
                      <div className="flex flex-wrap gap-1">
                        {PRESET_UNITS.map((u) => (
                          <button
                            key={u}
                            type="button"
                            onClick={() => setCorrectBaseUnit(u)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                              correctBaseUnit === u
                                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
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

              {/* Action: TEACH AND LEARN BUTTON */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTeachAndLearn}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950/60 transition flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-5 h-5 text-amber-300" />
                  <span>この正解で AI に学習させる（記憶バンクに定着・次回から即答）</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
              <Sparkles className="w-10 h-10 text-indigo-400 mx-auto opacity-40 animate-pulse" />
              <h3 className="font-extrabold text-base text-slate-200">
                左の一覧から写真を選択するか、新しい写真をアップロードしてください
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                AIが写真から何を読み取ったかをリアルタイム推論テストし、人間が正解を対答案として教え込めます。
              </p>
            </div>
          )}

          {/* Bottom Learned Memory Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-extrabold text-sm text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>🧠 現場 AI 記憶バンク（学習済みルール一覧: {learnedEntries.length}件）</span>
              </span>
              <button
                type="button"
                onClick={refreshKnowledgeBank}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold"
              >
                更新 ↻
              </button>
            </div>

            {learnedEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-2 px-3">写真</th>
                      <th className="py-2 px-3">学習した正解品名</th>
                      <th className="py-2 px-3">規格型番</th>
                      <th className="py-2 px-3">メーカー</th>
                      <th className="py-2 px-3">学習回数</th>
                      <th className="py-2 px-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {learnedEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3">
                          {e.imageThumbnail ? (
                            <img
                              src={e.imageThumbnail}
                              alt={e.name}
                              className="w-8 h-8 rounded-lg object-cover bg-black border border-slate-700 cursor-pointer"
                              onClick={() => setZoomedImage(e.imageThumbnail)}
                            />
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold text-white">{e.name}</td>
                        <td className="py-2 px-3 font-mono text-amber-300">{e.spec || '-'}</td>
                        <td className="py-2 px-3 text-slate-300">{e.supplier || '-'}</td>
                        <td className="py-2 px-3 text-emerald-400 font-bold">{e.matchCount || 1}回</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(e.itemCode || '')}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title="学習ルールを削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                まだ学習済みのルールがありません。写真をアップロードして正解を指導してください。
              </div>
            )}
          </div>
        </div>
      </div>

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
              className="absolute -top-3 -right-3 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full border border-slate-600 shadow-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedImage}
              alt="拡大写真"
              className="max-h-[80vh] max-w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
