import React, { useState, useEffect, useMemo } from 'react';
import {
  Volume2,
  Plus,
  Search,
  Pencil,
  Trash2,
  RotateCw,
  CheckCircle2,
  BookMarked,
  Layers,
  X,
} from 'lucide-react';
import { SrsRating, VocabSubTab, VocabWord } from '../types';
import {
  calculateNextReview,
  formatNextReviewLabel,
  isWordDue,
} from '../utils/srs';
import { speakText } from '../utils/speech';

interface TabVocabSrsProps {
  words: VocabWord[];
  subTab: VocabSubTab;
  onChangeSubTab: (tab: VocabSubTab) => void;
  onAddWord: (word: Omit<VocabWord, 'id' | 'createdAt' | 'nextReviewAt' | 'lastReviewedAt' | 'intervalDays' | 'streak' | 'reviewCount'>) => void;
  onUpdateWord: (word: VocabWord) => void;
  onDeleteWord: (id: string) => void;
  onResetStarterWords: () => void;
}

const PART_OF_SPEECH_OPTIONS = [
  { value: 'noun', label: 'noun (Danh từ)' },
  { value: 'verb', label: 'verb (Động từ)' },
  { value: 'adjective', label: 'adjective (Tính từ)' },
  { value: 'adverb', label: 'adverb (Trạng từ)' },
  { value: 'phrase', label: 'phrase (Cụm từ)' },
];

export const TabVocabSrs: React.FC<TabVocabSrsProps> = ({
  words,
  subTab,
  onChangeSubTab,
  onAddWord,
  onUpdateWord,
  onDeleteWord,
  onResetStarterWords,
}) => {
  const [now, setNow] = useState(() => Date.now());

  // Tick every 15s so 1-minute ("Quên / Khó") cards naturally become due again
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Flashcard state
  const [practiceAllMode, setPracticeAllMode] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionReviewedCount, setSessionReviewedCount] = useState(0);

  // Notebook state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'due' | 'mastered'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingWord, setEditingWord] = useState<VocabWord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form fields
  const [formWord, setFormWord] = useState('');
  const [formPos, setFormPos] = useState('noun');
  const [formPhonetic, setFormPhonetic] = useState('');
  const [formMeaning, setFormMeaning] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const dueWords = useMemo(
    () =>
      words
        .filter((w) => isWordDue(w, now))
        .sort((a, b) => a.nextReviewAt - b.nextReviewAt),
    [words, now]
  );

  const masteredCount = useMemo(
    () => words.filter((w) => !isWordDue(w, now) && w.intervalDays >= 3).length,
    [words, now]
  );

  const activeDeck = practiceAllMode ? words : dueWords;
  const currentCard =
    activeDeck.length > 0 ? activeDeck[cardIndex % activeDeck.length] : null;

  useEffect(() => {
    setIsFlipped(false);
  }, [currentCard?.id, subTab, practiceAllMode]);

  const openAddForm = () => {
    setEditingWord(null);
    setFormWord('');
    setFormPos('noun');
    setFormPhonetic('');
    setFormMeaning('');
    setFormExample('');
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (word: VocabWord) => {
    setEditingWord(word);
    setFormWord(word.word);
    setFormPos(word.partOfSpeech);
    setFormPhonetic(word.phonetic);
    setFormMeaning(word.meaning);
    setFormExample(word.example);
    setFormError(null);
    setShowForm(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWord.trim() || !formMeaning.trim()) {
      setFormError('Vui lòng nhập đầy đủ Từ tiếng Anh và Nghĩa tiếng Việt.');
      return;
    }

    const cleanWord = formWord.trim();
    const cleanExample =
      formExample.trim() || `I am practicing the word "${cleanWord}" today.`;

    if (editingWord) {
      onUpdateWord({
        ...editingWord,
        word: cleanWord,
        partOfSpeech: formPos,
        phonetic: formPhonetic.trim() || '/.../',
        meaning: formMeaning.trim(),
        example: cleanExample,
      });
    } else {
      onAddWord({
        word: cleanWord,
        partOfSpeech: formPos,
        phonetic: formPhonetic.trim() || '/.../',
        meaning: formMeaning.trim(),
        example: cleanExample,
      });
    }

    setShowForm(false);
    setEditingWord(null);
    setFormError(null);
  };

  const handleRateCard = (rating: SrsRating) => {
    if (!currentCard) return;
    const currentNow = Date.now();
    const updated = calculateNextReview(currentCard, rating, currentNow);
    onUpdateWord(updated);
    setNow(currentNow);
    setSessionReviewedCount((c) => c + 1);
    setIsFlipped(false);

    if (practiceAllMode) {
      setCardIndex((idx) => (idx + 1) % Math.max(1, activeDeck.length));
    } else {
      setCardIndex(0);
    }
  };

  const filteredNotebookWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return words.filter((w) => {
      const matchesQuery =
        !q ||
        w.word.toLowerCase().includes(q) ||
        w.meaning.toLowerCase().includes(q) ||
        w.example.toLowerCase().includes(q);
      if (!matchesQuery) return false;

      if (filterMode === 'due') return isWordDue(w, now);
      if (filterMode === 'mastered') return !isWordDue(w, now) && w.intervalDays >= 3;
      return true;
    });
  }, [words, searchQuery, filterMode, now]);

  const getEasyDaysPreview = (word: VocabWord) => {
    const nextStreak = word.streak + 1;
    if (nextStreak === 1) return 3;
    if (nextStreak === 2) return 5;
    return 7;
  };

  return (
    <div className="space-y-6">
      {/* Header + Stats + Sub-tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Sổ tay từ vựng thông minh & Flashcard
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 tabular-nums">
            <span>
              Cần ôn hôm nay:{' '}
              <strong className="font-semibold text-blue-700">{dueWords.length} từ</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Tổng sổ tay: <strong className="font-semibold text-slate-900">{words.length} từ</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>
              Đã thuộc vững: <strong className="font-semibold text-emerald-700">{masteredCount} từ</strong>
            </span>
          </div>
        </div>

        {/* Sub-tab Segmented Control */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={() => onChangeSubTab('flashcard')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'flashcard'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Ôn tập Flashcard ({dueWords.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeSubTab('notebook')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'notebook'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookMarked className="w-4 h-4" />
            <span>Sổ tay từ vựng</span>
          </button>
        </div>
      </div>

      {subTab === 'flashcard' ? (
        /* SRS Flashcard View */
        <div className="max-w-2xl mx-auto space-y-5">
          {currentCard ? (
            <>
              <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums px-1">
                <span>
                  {practiceAllMode
                    ? `Ôn tự do · Thẻ ${(cardIndex % activeDeck.length) + 1}/${activeDeck.length}`
                    : `Hàng đợi SRS hôm nay · Còn ${dueWords.length} từ cần ôn`}
                </span>
                <span>Đã ôn trong phiên: {sessionReviewedCount} lượt</span>
              </div>

              {/* Interactive Flip Card */}
              <div className="perspective-1000">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsFlipped((f) => !f)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setIsFlipped((f) => !f);
                    }
                  }}
                  aria-label="Lật thẻ từ vựng"
                  className={`relative w-full min-h-[300px] sm:min-h-[330px] cursor-pointer transition-transform duration-300 transform-style-3d ${
                    isFlipped ? 'rotate-y-180' : ''
                  }`}
                >
                  {/* Front Side */}
                  <div className="absolute inset-0 backface-hidden bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        Mặt trước · {currentCard.partOfSpeech}
                      </span>
                      <span className="font-mono tabular-nums">
                        Chuỗi nhớ: {currentCard.streak}
                      </span>
                    </div>

                    <div className="text-center space-y-3 my-auto py-4">
                      <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 break-words">
                        {currentCard.word}
                      </h2>
                      <p className="font-mono text-sm sm:text-base text-blue-700">
                        {currentCard.phonetic}
                      </p>

                      <div
                        className="pt-2 flex items-center justify-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => speakText(currentCard.word, { rate: 0.92 })}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Volume2 className="w-4 h-4" />
                          <span>Nghe phát âm</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => speakText(currentCard.word, { rate: 0.65 })}
                          className="px-3 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          Chậm
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Bấm vào thẻ để xem nghĩa và câu ví dụ</span>
                    </div>
                  </div>

                  {/* Back Side */}
                  <div className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-2xl border border-blue-200 p-6 sm:p-10 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-xs text-blue-700 font-medium">
                      <span>Mặt sau · {currentCard.word}</span>
                      <span>{currentCard.partOfSpeech}</span>
                    </div>

                    <div className="text-center space-y-4 my-auto py-4">
                      <p className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                        {currentCard.meaning}
                      </p>

                      <div className="max-w-lg mx-auto p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                        <p className="text-sm sm:text-base text-slate-800 leading-relaxed">
                          "{currentCard.example}"
                        </p>
                        <div onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => speakText(currentCard.example, { rate: 0.92 })}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Nghe câu ví dụ</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Chọn mức độ ghi nhớ bên dưới để lên lịch SRS</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3 SRS Rating Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleRateCard('hard')}
                  className="p-3.5 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100/80 text-left transition-colors space-y-0.5"
                >
                  <span className="block text-sm font-semibold text-red-800">
                    Quên / Khó
                  </span>
                  <span className="block text-xs text-red-700 tabular-nums">
                    Lặp lại sau 1 phút
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRateCard('medium')}
                  className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/80 text-left transition-colors space-y-0.5"
                >
                  <span className="block text-sm font-semibold text-amber-900">
                    Nhớ mang máng
                  </span>
                  <span className="block text-xs text-amber-800 tabular-nums">
                    Lặp lại sau 1 ngày
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleRateCard('easy')}
                  className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/80 text-left transition-colors space-y-0.5"
                >
                  <span className="block text-sm font-semibold text-emerald-800">
                    Đã thuộc lòng
                  </span>
                  <span className="block text-xs text-emerald-700 tabular-nums">
                    Lặp lại sau {getEasyDaysPreview(currentCard)} ngày (3–7 ngày)
                  </span>
                </button>
              </div>

              {practiceAllMode && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeAllMode(false);
                      setCardIndex(0);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 underline"
                  >
                    Quay lại chế độ chỉ ôn từ đến hạn
                  </button>
                </div>
              )}
            </>
          ) : (
            /* All caught up state */
            <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="space-y-1.5">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
                  Tuyệt vời! Bạn đã hoàn thành ôn tập hôm nay
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  {words.length === 0
                    ? 'Sổ tay của bạn đang trống. Hãy chuyển sang mục Sổ tay từ vựng để thêm từ mới.'
                    : 'Tất cả từ vựng đều đã được lên lịch lặp lại tối ưu. Những từ bạn chọn "Quên / Khó" sẽ tự động quay lại sau 1 phút.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {words.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPracticeAllMode(true);
                      setCardIndex(0);
                    }}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Ôn tập thêm toàn bộ {words.length} thẻ
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onChangeSubTab('notebook');
                    openAddForm();
                  }}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Thêm từ mới vào sổ tay
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Vocabulary Notebook Management */
        <div className="space-y-5">
          {/* Toolbar: Search + Filters + Add Button */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm từ tiếng Anh, nghĩa tiếng Việt..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
                {(
                  [
                    { id: 'all', label: 'Tất cả' },
                    { id: 'due', label: 'Cần ôn' },
                    { id: 'mastered', label: 'Đã thuộc' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilterMode(item.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      filterMode === item.id
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {words.length < 5 && (
                <button
                  type="button"
                  onClick={onResetStarterWords}
                  className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  Nạp bộ từ mẫu
                </button>
              )}
              <button
                type="button"
                onClick={openAddForm}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm từ mới</span>
              </button>
            </div>
          </div>

          {/* Add / Edit Form Panel */}
          {showForm && (
            <form
              onSubmit={handleFormSubmit}
              className="bg-white rounded-xl border border-blue-200 p-5 sm:p-6 space-y-4"
            >
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {editingWord ? `Chỉnh sửa từ "${editingWord.word}"` : 'Thêm từ vựng mới vào Sổ tay'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  aria-label="Đóng biểu mẫu"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {formError}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Từ tiếng Anh *
                  </label>
                  <input
                    type="text"
                    value={formWord}
                    onChange={(e) => setFormWord(e.target.value)}
                    placeholder="Ví dụ: sustainable"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Loại từ
                  </label>
                  <select
                    value={formPos}
                    onChange={(e) => setFormPos(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {PART_OF_SPEECH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Phiên âm IPA
                  </label>
                  <input
                    type="text"
                    value={formPhonetic}
                    onChange={(e) => setFormPhonetic(e.target.value)}
                    placeholder="Ví dụ: /səˈsteɪnəbl/"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Nghĩa tiếng Việt *
                  </label>
                  <input
                    type="text"
                    value={formMeaning}
                    onChange={(e) => setFormMeaning(e.target.value)}
                    placeholder="Ví dụ: bền vững"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Câu ví dụ (nên chứa từ tiếng Anh ở trên để chơi Điền từ khuyết)
                </label>
                <input
                  type="text"
                  value={formExample}
                  onChange={(e) => setFormExample(e.target.value)}
                  placeholder="Ví dụ: Solar power is a sustainable source of energy."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  {editingWord ? 'Lưu thay đổi' : 'Lưu vào Sổ tay'}
                </button>
              </div>
            </form>
          )}

          {/* Vocabulary List */}
          {filteredNotebookWords.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-2">
              <p className="font-display text-base font-semibold text-slate-900">
                Không tìm thấy từ vựng phù hợp
              </p>
              <p className="text-sm text-slate-500">
                Thử đổi từ khóa tìm kiếm hoặc bấm "Thêm từ mới" để bổ sung vào sổ tay.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
              {filteredNotebookWords.map((item) => {
                const due = isWordDue(item, now);
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <span className="font-display text-lg font-bold text-slate-900">
                          {item.word}
                        </span>
                        <span className="text-xs text-slate-500">
                          {item.partOfSpeech}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 text-xs">·</span>
                        <span className="font-mono text-xs text-blue-700">
                          {item.phonetic}
                        </span>
                        <span aria-hidden="true" className="text-slate-300 text-xs">·</span>
                        <span
                          className={`text-xs font-medium ${
                            due ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatNextReviewLabel(item, now)}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-slate-800">
                        {item.meaning}
                      </p>
                      <p className="text-xs sm:text-sm text-slate-500 italic">
                        "{item.example}"
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => speakText(item.word, { rate: 0.92 })}
                        aria-label={`Nghe phát âm ${item.word}`}
                        className="p-2 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditForm(item)}
                        aria-label={`Chỉnh sửa ${item.word}`}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {confirmDeleteId === item.id ? (
                        <div className="inline-flex items-center gap-1 ml-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteWord(item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
                          >
                            Xóa
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900"
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Xóa ${item.word}`}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
