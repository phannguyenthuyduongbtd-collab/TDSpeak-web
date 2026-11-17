import { useState, useEffect, useMemo } from 'react';
import { INITIAL_VOCABULARY } from './data/seedData';
import { useLocalStorage } from './hooks/useLocalStorage';
import { CustomMaterial, MainTab, VocabSubTab, VocabWord } from './types';
import { isWordDue } from './utils/srs';
import { stopSpeaking } from './utils/speech';
import { Header } from './components/Header';
import { TabSpeaking } from './components/TabSpeaking';
import { TabVocabSrs } from './components/TabVocabSrs';
import { TabGames } from './components/TabGames';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('speaking');
  const [vocabSubTab, setVocabSubTab] = useState<VocabSubTab>('flashcard');

  const [words, setWords] = useLocalStorage<VocabWord[]>(
    'tdspeak_vocab_v1',
    INITIAL_VOCABULARY
  );
  const [bestSpeakingScores, setBestSpeakingScores] = useLocalStorage<
    Record<string, number>
  >('tdspeak_speaking_scores_v1', {});
  const [customMaterials, setCustomMaterials] = useLocalStorage<CustomMaterial[]>(
    'tdspeak_materials_v1',
    []
  );

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  const dueCount = useMemo(
    () => words.filter((w) => isWordDue(w, now)).length,
    [words, now]
  );

  const handleSelectTab = (tab: MainTab) => {
    stopSpeaking();
    setActiveTab(tab);
  };

  const handleStartQuickReview = () => {
    stopSpeaking();
    setVocabSubTab('flashcard');
    setActiveTab('vocabulary');
  };

  const handleSaveBestScore = (promptId: string, score: number) => {
    setBestSpeakingScores((prev) => ({
      ...prev,
      [promptId]: Math.max(prev[promptId] ?? 0, score),
    }));
  };

  const handleSaveMaterial = (material: CustomMaterial) => {
    setCustomMaterials((prev) => [material, ...prev]);
  };

  const handleDeleteMaterial = (id: string) => {
    setCustomMaterials((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddWord = (
    newWordData: Omit<
      VocabWord,
      | 'id'
      | 'createdAt'
      | 'nextReviewAt'
      | 'lastReviewedAt'
      | 'intervalDays'
      | 'streak'
      | 'reviewCount'
    >
  ) => {
    const timestamp = Date.now();
    const created: VocabWord = {
      ...newWordData,
      id: `v-${timestamp}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: timestamp,
      nextReviewAt: timestamp - 1000, // Immediately available for review today
      lastReviewedAt: null,
      intervalDays: 0,
      streak: 0,
      reviewCount: 0,
    };
    setWords((prev) => [created, ...prev]);
    setNow(timestamp);
  };

  const handleUpdateWord = (updatedWord: VocabWord) => {
    setWords((prev) =>
      prev.map((w) => (w.id === updatedWord.id ? updatedWord : w))
    );
    setNow(Date.now());
  };

  const handleDeleteWord = (id: string) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
  };

  const handleResetStarterWords = () => {
    const timestamp = Date.now();
    setWords((prev) => {
      const existingLower = new Set(prev.map((w) => w.word.toLowerCase()));
      const missingSeeds = INITIAL_VOCABULARY.filter(
        (seed) => !existingLower.has(seed.word.toLowerCase())
      ).map((seed) => ({
        ...seed,
        id: `v-seed-${seed.id}-${timestamp}`,
        nextReviewAt: timestamp - 1000,
      }));
      return [...prev, ...missingSeeds];
    });
    setNow(timestamp);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        dueCount={dueCount}
        onStartQuickReview={handleStartQuickReview}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {activeTab === 'speaking' && (
          <TabSpeaking
            bestScores={bestSpeakingScores}
            onSaveBestScore={handleSaveBestScore}
            customMaterials={customMaterials}
            onSaveMaterial={handleSaveMaterial}
            onDeleteMaterial={handleDeleteMaterial}
          />
        )}

        {activeTab === 'vocabulary' && (
          <TabVocabSrs
            words={words}
            subTab={vocabSubTab}
            onChangeSubTab={setVocabSubTab}
            onAddWord={handleAddWord}
            onUpdateWord={handleUpdateWord}
            onDeleteWord={handleDeleteWord}
            onResetStarterWords={handleResetStarterWords}
          />
        )}

        {activeTab === 'games' && (
          <TabGames
            words={words}
            onGoToNotebook={() => {
              setVocabSubTab('notebook');
              setActiveTab('vocabulary');
            }}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>TDSpeak — Luyện nói tiếng Anh & Ghi nhớ từ vựng SRS</span>
          <span>Dữ liệu học tập được lưu tự động trên trình duyệt của bạn</span>
        </div>
      </footer>
    </div>
  );
}
