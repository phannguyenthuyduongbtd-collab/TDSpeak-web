import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  Trophy,
  RotateCcw,
  Clock,
  HelpCircle,
  ArrowRight,
  Delete,
} from 'lucide-react';
import { GameRoundAnswer, GameSubTab, VocabWord } from '../types';
import { playGameSound, speakText } from '../utils/speech';

interface TabGamesProps {
  words: VocabWord[];
  onGoToNotebook: () => void;
}

type GameState = 'TITLE_MENU' | 'PLAYING' | 'ROUND_SUMMARY';

interface ScrambleTile {
  id: string;
  char: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildBlankSentence(word: VocabWord): { before: string; after: string; usedFallback: boolean } {
  const escaped = word.word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  const match = regex.exec(word.example);
  if (match) {
    return {
      before: word.example.slice(0, match.index),
      after: word.example.slice(match.index + match[0].length),
      usedFallback: false,
    };
  }
  return {
    before: `The English word meaning "${word.meaning}" is `,
    after: `.`,
    usedFallback: true,
  };
}

function scrambleWordTiles(target: string): ScrambleTile[] {
  const letters = target.replace(/\s+/g, '').split('');
  if (letters.length <= 1) {
    return letters.map((char, idx) => ({ id: `${idx}-${char}`, char }));
  }

  let shuffled = shuffleArray(letters);
  let attempts = 0;
  while (shuffled.join('').toLowerCase() === letters.join('').toLowerCase() && attempts < 10) {
    shuffled = shuffleArray(letters);
    attempts++;
  }

  return shuffled.map((char, idx) => ({
    id: `tile-${idx}-${char}-${Math.random().toString(36).slice(2, 6)}`,
    char,
  }));
}

const GAME_TABS: { id: GameSubTab; label: string; shortDesc: string }[] = [
  {
    id: 'quiz',
    label: 'Quiz 4 lựa chọn',
    shortDesc: 'Chọn nhanh đáp án đúng trong 15 giây mỗi câu.',
  },
  {
    id: 'fill_blank',
    label: 'Điền từ khuyết',
    shortDesc: 'Đọc ngữ cảnh câu ví dụ và điền chính xác từ còn thiếu.',
  },
  {
    id: 'dictation',
    label: 'Nghe & Gõ từ',
    shortDesc: 'Luyện nghe phát âm chuẩn và gõ lại đúng chính tả.',
  },
  {
    id: 'scramble',
    label: 'Xếp chữ cái',
    shortDesc: 'Bấm chọn hoặc kéo thả các chữ cái xáo trộn thành từ hoàn chỉnh.',
  },
];

const ROUND_SIZE = 8;
const QUIZ_SECONDS = 15;

export const TabGames: React.FC<TabGamesProps> = ({ words, onGoToNotebook }) => {
  const [activeGame, setActiveGame] = useState<GameSubTab>('quiz');
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [muted, setMuted] = useState(false);

  // Round state
  const [deck, setDeck] = useState<VocabWord[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<GameRoundAnswer[]>([]);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    message: string;
    userAnswer: string;
  } | null>(null);

  // Quiz state
  const [quizDirection, setQuizDirection] = useState<'en_to_vi' | 'vi_to_en'>('en_to_vi');
  const [quizOptions, setQuizOptions] = useState<VocabWord[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUIZ_SECONDS);

  // Fill blank & Dictation input state
  const [textAnswer, setTextAnswer] = useState('');
  const [showHint, setShowHint] = useState(false);

  // Word Scramble state
  const [bankTiles, setBankTiles] = useState<ScrambleTile[]>([]);
  const [placedTiles, setPlacedTiles] = useState<ScrambleTile[]>([]);
  const [draggedTileId, setDraggedTileId] = useState<string | null>(null);

  const currentWord = deck[currentIdx] || null;
  const activeTabInfo = GAME_TABS.find((t) => t.id === activeGame) || GAME_TABS[0];

  const canPlayQuiz = words.length >= 4;
  const canPlayOther = words.length >= 1;

  // Build quiz options for a given word
  const prepareQuestion = useCallback(
    (word: VocabWord, gameType: GameSubTab) => {
      setFeedback(null);
      setTextAnswer('');
      setShowHint(false);

      if (gameType === 'quiz') {
        const distractors = shuffleArray(
          words.filter((w) => w.id !== word.id)
        ).slice(0, 3);
        setQuizOptions(shuffleArray([word, ...distractors]));
        setTimeLeft(QUIZ_SECONDS);
      } else if (gameType === 'dictation') {
        setTimeout(() => {
          speakText(word.word, { rate: 0.9 });
        }, 180);
      } else if (gameType === 'scramble') {
        setBankTiles(scrambleWordTiles(word.word));
        setPlacedTiles([]);
      }
    },
    [words]
  );

  const startGame = (gameType: GameSubTab = activeGame) => {
    if (gameType === 'quiz' && !canPlayQuiz) return;
    if (!canPlayOther) return;

    const roundDeck = shuffleArray(words).slice(0, Math.min(ROUND_SIZE, words.length));
    setDeck(roundDeck);
    setCurrentIdx(0);
    setScore(0);
    setStreak(0);
    setHistory([]);
    setGameState('PLAYING');
    prepareQuestion(roundDeck[0], gameType);
  };

  const switchGameTab = (tab: GameSubTab) => {
    setActiveGame(tab);
    setGameState('TITLE_MENU');
    setFeedback(null);
  };

  const recordOutcome = useCallback(
    (isCorrect: boolean, userAnswer: string, customMessage?: string) => {
      if (!currentWord || feedback) return;

      playGameSound(isCorrect ? 'correct' : 'wrong', muted);

      const nextStreak = isCorrect ? streak + 1 : 0;
      const pointsEarned = isCorrect ? 10 + Math.min(nextStreak - 1, 4) * 2 : 0;

      if (isCorrect) {
        setScore((s) => s + pointsEarned);
      }
      setStreak(nextStreak);
      setHistory((prev) => [
        ...prev,
        { word: currentWord, userAnswer, isCorrect },
      ]);
      setFeedback({
        isCorrect,
        userAnswer,
        message:
          customMessage ||
          (isCorrect
            ? `Chính xác! +${pointsEarned} điểm`
            : `Chưa đúng. Đáp án chuẩn là "${currentWord.word}" (${currentWord.meaning}).`),
      });
    },
    [currentWord, feedback, muted, streak]
  );

  const goToNextQuestion = useCallback(() => {
    const nextIdx = currentIdx + 1;
    if (nextIdx >= deck.length) {
      playGameSound('complete', muted);
      setGameState('ROUND_SUMMARY');
      return;
    }
    setCurrentIdx(nextIdx);
    prepareQuestion(deck[nextIdx], activeGame);
  }, [currentIdx, deck, muted, prepareQuestion, activeGame]);

  // Quiz countdown timer
  useEffect(() => {
    if (gameState !== 'PLAYING' || activeGame !== 'quiz' || feedback !== null) {
      return;
    }
    if (timeLeft <= 0) {
      recordOutcome(false, '(Hết giờ)', `Hết thời gian! Đáp án đúng là "${
        quizDirection === 'en_to_vi' ? currentWord?.meaning : currentWord?.word
      }".`);
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [gameState, activeGame, feedback, timeLeft, recordOutcome, currentWord, quizDirection]);

  // Word Scramble keyboard support
  useEffect(() => {
    if (gameState !== 'PLAYING' || activeGame !== 'scramble' || feedback !== null) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        setPlacedTiles((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          setBankTiles((bank) => [...bank, last]);
          return prev.slice(0, -1);
        });
        return;
      }
      if (e.key === 'Enter' && bankTiles.length === 0 && placedTiles.length > 0 && currentWord) {
        e.preventDefault();
        const assembled = placedTiles.map((t) => t.char).join('');
        const targetClean = currentWord.word.replace(/\s+/g, '');
        recordOutcome(assembled.toLowerCase() === targetClean.toLowerCase(), assembled);
        return;
      }
      if (/^[a-zA-Z-']$/.test(e.key)) {
        const matchTile = bankTiles.find(
          (t) => t.char.toLowerCase() === e.key.toLowerCase()
        );
        if (matchTile) {
          playGameSound('click', muted);
          setBankTiles((bank) => bank.filter((t) => t.id !== matchTile.id));
          setPlacedTiles((placed) => [...placed, matchTile]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState, activeGame, feedback, bankTiles, placedTiles, currentWord, muted, recordOutcome]);

  const handleSelectScrambleTile = (tile: ScrambleTile) => {
    if (feedback) return;
    playGameSound('click', muted);
    setBankTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setPlacedTiles((prev) => [...prev, tile]);
  };

  const handleRemoveScrambleTile = (tile: ScrambleTile) => {
    if (feedback) return;
    playGameSound('click', muted);
    setPlacedTiles((prev) => prev.filter((t) => t.id !== tile.id));
    setBankTiles((prev) => [...prev, tile]);
  };

  const handleDropOnAnswerZone = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTileId || feedback) return;
    const fromBank = bankTiles.find((t) => t.id === draggedTileId);
    if (fromBank) {
      handleSelectScrambleTile(fromBank);
    }
    setDraggedTileId(null);
  };

  const handleDropOnBankZone = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTileId || feedback) return;
    const fromPlaced = placedTiles.find((t) => t.id === draggedTileId);
    if (fromPlaced) {
      handleRemoveScrambleTile(fromPlaced);
    }
    setDraggedTileId(null);
  };

  const blankParts = useMemo(
    () => (currentWord ? buildBlankSentence(currentWord) : null),
    [currentWord]
  );

  return (
    <div className="space-y-6">
      {/* Header + Sound Toggle + 4 Sub-tabs */}
      <div className="space-y-4 pb-5 border-b border-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Kho trò chơi từ vựng
            </h1>
            <p className="text-sm sm:text-base text-slate-600">
              Luyện phản xạ nghĩa, ngữ cảnh và chính tả từ chính {words.length} từ trong Sổ tay của bạn.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            <span>{muted ? 'Đang tắt âm' : 'Âm thanh bật'}</span>
          </button>
        </div>

        {/* 4 Game Sub-tabs */}
        <div
          role="tablist"
          aria-label="Chọn trò chơi từ vựng"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2"
        >
          {GAME_TABS.map((tab, idx) => {
            const isActive = activeGame === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => switchGameTab(tab.id)}
                className={`p-3.5 rounded-xl border text-left transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <span
                  className={`block font-mono text-xs tabular-nums ${
                    isActive ? 'text-blue-300' : 'text-slate-400'
                  }`}
                >
                  0{idx + 1}.
                </span>
                <span className="block font-display text-sm sm:text-base font-bold mt-0.5 truncate">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Game Arena */}
      <div className="max-w-3xl mx-auto">
        {!canPlayOther || (activeGame === 'quiz' && !canPlayQuiz) ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center space-y-4">
            <h2 className="font-display text-xl font-bold text-slate-900">
              Cần thêm từ vựng trong Sổ tay để chơi
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              {activeGame === 'quiz'
                ? 'Trò chơi Quiz 4 lựa chọn cần tối thiểu 4 từ vựng trong Sổ tay. Hãy thêm từ mới hoặc nạp lại bộ từ mẫu nhé!'
                : 'Sổ tay của bạn hiện chưa có từ vựng nào. Hãy thêm ít nhất 1 từ vựng để bắt đầu.'}
            </p>
            <button
              type="button"
              onClick={onGoToNotebook}
              className="px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
            >
              Mở Sổ tay từ vựng
            </button>
          </div>
        ) : gameState === 'TITLE_MENU' ? (
          /* TITLE_MENU State */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-mono text-blue-700 tabular-nums">
                Nguồn dữ liệu: {words.length} từ trong Sổ tay · Tối đa {Math.min(ROUND_SIZE, words.length)} câu/lượt
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                {activeTabInfo.label}
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                {activeTabInfo.shortDesc}
              </p>
            </div>

            {activeGame === 'quiz' && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-600">Chế độ câu hỏi:</p>
                <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setQuizDirection('en_to_vi')}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                      quizDirection === 'en_to_vi'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nhìn Tiếng Anh chọn Tiếng Việt
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuizDirection('vi_to_en')}
                    className={`px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                      quizDirection === 'vi_to_en'
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nhìn Tiếng Việt chọn Tiếng Anh
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => startGame(activeGame)}
                className="px-6 py-3 text-sm sm:text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
              >
                Bắt đầu chơi
              </button>
            </div>
          </div>
        ) : gameState === 'ROUND_SUMMARY' ? (
          /* ROUND_SUMMARY State */
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">{activeTabInfo.label} · Hoàn thành lượt chơi</p>
                  <h2 className="font-display text-2xl font-bold text-slate-900 tabular-nums">
                    Tổng điểm: {score}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm tabular-nums">
                <div>
                  <span className="text-slate-500">Đúng: </span>
                  <strong className="text-emerald-700">
                    {history.filter((h) => h.isCorrect).length}/{history.length}
                  </strong>
                </div>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <div>
                  <span className="text-slate-500">Tỷ lệ: </span>
                  <strong className="text-slate-900">
                    {Math.round(
                      (history.filter((h) => h.isCorrect).length / Math.max(1, history.length)) * 100
                    )}
                    %
                  </strong>
                </div>
              </div>
            </div>

            {/* Word-by-word summary */}
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto pr-1">
              {history.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    {item.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.word.word}{' '}
                        <span className="font-normal text-slate-500">
                          — {item.word.meaning}
                        </span>
                      </p>
                      {!item.isCorrect && (
                        <p className="text-xs text-red-600">
                          Bạn trả lời: {item.userAnswer || '(Bỏ trống)'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakText(item.word.word, { rate: 0.9 })}
                    aria-label={`Nghe ${item.word.word}`}
                    className="p-2 text-slate-500 hover:text-blue-700 rounded-lg shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startGame(activeGame)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Chơi lại</span>
              </button>
              <button
                type="button"
                onClick={() => setGameState('TITLE_MENU')}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Đổi tùy chọn
              </button>
            </div>
          </div>
        ) : (
          /* PLAYING State */
          currentWord && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 space-y-6">
              {/* Unobtrusive HUD */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 text-xs sm:text-sm tabular-nums">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-slate-900">
                    Câu {currentIdx + 1}/{deck.length}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="text-slate-600">
                    Điểm: <strong className="text-blue-700">{score}</strong>
                  </span>
                  {streak > 1 && (
                    <>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-medium">
                        Chuỗi đúng: {streak}
                      </span>
                    </>
                  )}
                </div>

                {activeGame === 'quiz' && (
                  <div
                    className={`inline-flex items-center gap-1.5 font-mono font-semibold ${
                      timeLeft <= 5 ? 'text-red-600' : 'text-slate-700'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>{timeLeft}s</span>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {activeGame === 'quiz' && (
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${(timeLeft / QUIZ_SECONDS) * 100}%` }}
                  />
                </div>
              )}

              {/* GAME 1: QUIZ 4 OPTIONS */}
              {activeGame === 'quiz' && (
                <div className="space-y-6">
                  <div className="text-center space-y-2 py-2">
                    <p className="text-xs font-medium text-slate-500">
                      {quizDirection === 'en_to_vi'
                        ? 'Chọn nghĩa tiếng Việt đúng cho từ:'
                        : 'Chọn từ tiếng Anh tương ứng với nghĩa:'}
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <h3 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900">
                        {quizDirection === 'en_to_vi' ? currentWord.word : currentWord.meaning}
                      </h3>
                      {quizDirection === 'en_to_vi' && (
                        <button
                          type="button"
                          onClick={() => speakText(currentWord.word, { rate: 0.92 })}
                          aria-label="Nghe từ"
                          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    {quizDirection === 'en_to_vi' && (
                      <p className="font-mono text-xs text-slate-500">
                        {currentWord.partOfSpeech} · {currentWord.phonetic}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {quizOptions.map((option, idx) => {
                      const label =
                        quizDirection === 'en_to_vi' ? option.meaning : option.word;
                      const isTarget = option.id === currentWord.id;
                      const wasSelected = feedback?.userAnswer === label;

                      let btnStyle =
                        'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 text-slate-900';
                      if (feedback) {
                        if (isTarget) {
                          btnStyle =
                            'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold';
                        } else if (wasSelected && !isTarget) {
                          btnStyle = 'bg-red-50 border-red-400 text-red-800';
                        } else {
                          btnStyle = 'bg-slate-50 border-slate-200 text-slate-400';
                        }
                      }

                      return (
                        <button
                          key={option.id}
                          type="button"
                          disabled={Boolean(feedback)}
                          onClick={() =>
                            recordOutcome(isTarget, label)
                          }
                          className={`p-4 rounded-xl border text-left transition-colors flex items-center justify-between gap-3 min-h-[56px] ${btnStyle}`}
                        >
                          <span className="flex items-center gap-3">
                            <span className="font-mono text-xs text-slate-400">
                              {idx + 1}.
                            </span>
                            <span className="text-sm sm:text-base">{label}</span>
                          </span>
                          {feedback && isTarget && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          {feedback && wasSelected && !isTarget && (
                            <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* GAME 2: FILL IN THE BLANKS */}
              {activeGame === 'fill_blank' && blankParts && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (feedback) {
                      goToNextQuestion();
                      return;
                    }
                    const cleaned = textAnswer.trim();
                    if (!cleaned) return;
                    const ok = cleaned.toLowerCase() === currentWord.word.toLowerCase();
                    recordOutcome(ok, cleaned);
                  }}
                  className="space-y-5"
                >
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-slate-500">
                      Điền từ tiếng Anh còn thiếu vào chỗ trống:
                    </p>
                    <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-lg sm:text-xl text-slate-900 leading-relaxed">
                      <span>{blankParts.before}</span>
                      <span className="inline-block min-w-[96px] border-b-2 border-blue-600 px-2 mx-1 font-mono font-bold text-blue-700 text-center">
                        {feedback ? currentWord.word : textAnswer || '_______'}
                      </span>
                      <span>{blankParts.after}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="text-slate-600">
                        Gợi ý nghĩa:{' '}
                        <strong className="text-slate-900">{currentWord.meaning}</strong>{' '}
                        <span className="text-xs text-slate-500">
                          ({currentWord.partOfSpeech})
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowHint(true)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>
                          {showHint
                            ? `Chữ cái đầu: "${currentWord.word[0].toUpperCase()}..." (${currentWord.word.length} ký tự)`
                            : 'Gợi ý chữ cái đầu'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {!feedback && (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        autoFocus
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        placeholder="Nhập từ tiếng Anh..."
                        className="flex-1 px-4 py-2.5 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="submit"
                        disabled={!textAnswer.trim()}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-xl transition-colors whitespace-nowrap"
                      >
                        Kiểm tra
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* GAME 3: DICTATION (LISTEN & TYPE) */}
              {activeGame === 'dictation' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (feedback) {
                      goToNextQuestion();
                      return;
                    }
                    const cleaned = textAnswer.trim();
                    if (!cleaned) return;
                    const ok = cleaned.toLowerCase() === currentWord.word.toLowerCase();
                    recordOutcome(ok, cleaned);
                  }}
                  className="space-y-5"
                >
                  <div className="text-center space-y-4 py-2">
                    <p className="text-xs font-medium text-slate-500">
                      Nghe phát âm và gõ lại chính xác chính tả của từ:
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => speakText(currentWord.word, { rate: 0.92 })}
                        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                      >
                        <Volume2 className="w-5 h-5" />
                        <span>Nghe lại từ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => speakText(currentWord.word, { rate: 0.58 })}
                        className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>Nghe chậm</span>
                      </button>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowHint((h) => !h)}
                        className="text-xs font-medium text-slate-500 hover:text-blue-700 underline"
                      >
                        {showHint
                          ? `Nghĩa: ${currentWord.meaning} (${currentWord.partOfSpeech})`
                          : 'Hiện gợi ý nghĩa tiếng Việt'}
                      </button>
                    </div>
                  </div>

                  {!feedback && (
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <input
                        type="text"
                        autoFocus
                        value={textAnswer}
                        onChange={(e) => setTextAnswer(e.target.value)}
                        placeholder="Gõ từ bạn nghe được..."
                        className="flex-1 px-4 py-2.5 text-base font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                      <button
                        type="submit"
                        disabled={!textAnswer.trim()}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 rounded-xl transition-colors whitespace-nowrap"
                      >
                        Kiểm tra chính tả
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* GAME 4: WORD SCRAMBLE */}
              {activeGame === 'scramble' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-slate-500">
                        Sắp xếp các chữ cái thành từ đúng (bấm, kéo thả hoặc gõ phím):
                      </p>
                      <p className="text-base sm:text-lg font-bold text-slate-900">
                        Nghĩa: {currentWord.meaning}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          ({currentWord.partOfSpeech})
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => speakText(currentWord.word, { rate: 0.85 })}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Nghe gợi ý</span>
                    </button>
                  </div>

                  {/* Answer Drop Zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropOnAnswerZone}
                    className="min-h-[76px] p-3.5 rounded-xl bg-slate-50 border-2 border-dashed border-slate-300 flex flex-wrap items-center justify-center gap-2"
                  >
                    {placedTiles.length === 0 ? (
                      <span className="text-xs sm:text-sm text-slate-400">
                        Bấm hoặc kéo các chữ cái bên dưới vào đây...
                      </span>
                    ) : (
                      placedTiles.map((tile) => (
                        <button
                          key={tile.id}
                          type="button"
                          draggable={!feedback}
                          onDragStart={() => setDraggedTileId(tile.id)}
                          onClick={() => handleRemoveScrambleTile(tile)}
                          className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-blue-600 text-white font-mono text-lg font-bold uppercase flex items-center justify-center hover:bg-blue-700 transition-transform active:scale-95"
                        >
                          {tile.char}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Scrambled Bank Drop Zone */}
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDropOnBankZone}
                    className="min-h-[68px] p-3 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-center gap-2"
                  >
                    {bankTiles.map((tile) => (
                      <button
                        key={tile.id}
                        type="button"
                        draggable={!feedback}
                        onDragStart={() => setDraggedTileId(tile.id)}
                        onClick={() => handleSelectScrambleTile(tile)}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-lg font-bold uppercase flex items-center justify-center hover:border-blue-500 hover:bg-blue-50 transition-transform active:scale-95"
                      >
                        {tile.char}
                      </button>
                    ))}
                  </div>

                  {!feedback && (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setBankTiles((prev) => [...prev, ...placedTiles]);
                          setPlacedTiles([]);
                        }}
                        disabled={placedTiles.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
                      >
                        <Delete className="w-4 h-4" />
                        <span>Xếp lại từ đầu</span>
                      </button>

                      <button
                        type="button"
                        disabled={bankTiles.length > 0}
                        onClick={() => {
                          const assembled = placedTiles.map((t) => t.char).join('');
                          const targetClean = currentWord.word.replace(/\s+/g, '');
                          recordOutcome(
                            assembled.toLowerCase() === targetClean.toLowerCase(),
                            assembled
                          );
                        }}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 rounded-xl transition-colors"
                      >
                        Kiểm tra đáp án
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Feedback Banner + Next Button */}
              {feedback && (
                <div
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    feedback.isCorrect
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {feedback.isCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{feedback.message}</p>
                      <p className="text-xs opacity-85">
                        {currentWord.word} ({currentWord.phonetic}) — {currentWord.meaning}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={goToNextQuestion}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>
                      {currentIdx + 1 >= deck.length ? 'Xem tổng kết' : 'Câu tiếp theo'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};
