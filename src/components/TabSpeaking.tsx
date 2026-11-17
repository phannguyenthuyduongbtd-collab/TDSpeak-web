import React, { useState } from 'react';
import {
  BookOpen,
  FileText,
  Upload,
  Sparkles,
  Trash2,
  Volume2,
  ChevronRight,
} from 'lucide-react';
import { SPEAKING_TOPICS, SAMPLE_FREE_PARAGRAPH } from '../data/seedData';
import { CustomMaterial, PronunciationResult } from '../types';
import { splitParagraphIntoSentences } from '../utils/pronunciation';
import { speakText } from '../utils/speech';
import { PronunciationWidget } from './PronunciationWidget';

interface TabSpeakingProps {
  bestScores: Record<string, number>;
  onSaveBestScore: (promptId: string, score: number) => void;
  customMaterials: CustomMaterial[];
  onSaveMaterial: (material: CustomMaterial) => void;
  onDeleteMaterial: (id: string) => void;
}

type SpeakingMode = 'topics' | 'custom';

export const TabSpeaking: React.FC<TabSpeakingProps> = ({
  bestScores,
  onSaveBestScore,
  customMaterials,
  onSaveMaterial,
  onDeleteMaterial,
}) => {
  const [mode, setMode] = useState<SpeakingMode>('topics');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(SPEAKING_TOPICS[0].id);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState<number>(0);

  // Custom material state
  const [materialTitle, setMaterialTitle] = useState('');
  const [rawInputText, setRawInputText] = useState('');
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(
    customMaterials[0]?.id ?? null
  );
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  const selectedTopic =
    SPEAKING_TOPICS.find((t) => t.id === selectedTopicId) || SPEAKING_TOPICS[0];
  const activePrompt =
    selectedTopic.prompts[selectedPromptIdx] || selectedTopic.prompts[0];

  const activeMaterial =
    customMaterials.find((m) => m.id === activeMaterialId) || customMaterials[0] || null;

  const handleSelectTopic = (topicId: string) => {
    setSelectedTopicId(topicId);
    setSelectedPromptIdx(0);
  };

  const handleScoreRecorded = (key: string, result: PronunciationResult) => {
    const prev = bestScores[key] ?? 0;
    if (result.score > prev) {
      onSaveBestScore(key, result.score);
    }
  };

  const handleCreateMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    const sentences = splitParagraphIntoSentences(rawInputText);
    if (sentences.length === 0) {
      setUploadNotice('Vui lòng dán hoặc tải lên một đoạn văn bản tiếng Anh trước khi tách câu.');
      return;
    }

    const newMaterial: CustomMaterial = {
      id: `mat-${Date.now()}`,
      title:
        materialTitle.trim() ||
        `Tài liệu luyện đọc (${new Date().toLocaleDateString('vi-VN')})`,
      rawText: rawInputText.trim(),
      sentences: sentences.map((text, index) => ({
        id: `s-${Date.now()}-${index}`,
        text,
      })),
      createdAt: Date.now(),
    };

    onSaveMaterial(newMaterial);
    setActiveMaterialId(newMaterial.id);
    setMaterialTitle('');
    setRawInputText('');
    setUploadNotice(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(txt|md|csv)$/i) && !file.type.startsWith('text/')) {
      setUploadNotice('Hiện hỗ trợ đọc trực tiếp tệp văn bản (.txt, .md). Với Word/PDF, bạn hãy copy và dán đoạn văn vào khung nhé!');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      if (content.trim()) {
        setRawInputText(content.trim());
        if (!materialTitle.trim()) {
          setMaterialTitle(file.name.replace(/\.[^.]+$/, ''));
        }
        setUploadNotice(`Đã tải nội dung từ "${file.name}". Bấm "Tách câu luyện nói" để bắt đầu!`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Section Header + Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1 max-w-2xl">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Luyện nói AI & Phát âm chuẩn
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            Thực hành giao tiếp 15 phút đầu giờ theo chủ đề hoặc tải tài liệu riêng để AI tách câu, đọc mẫu và chấm phát âm từng từ.
          </p>
        </div>

        {/* Segmented Control */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setMode('topics')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'topics'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Theo chủ đề</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === 'custom'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tài liệu tự do</span>
          </button>
        </div>
      </div>

      {mode === 'topics' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Topic Navigation */}
          <aside className="lg:col-span-4 space-y-2">
            <h2 className="text-xs font-semibold text-slate-500 px-1 pb-1">
              Chủ đề giao tiếp 15 phút đầu giờ
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
              {SPEAKING_TOPICS.map((topic, index) => {
                const isSelected = topic.id === selectedTopic.id;
                const topicCompletedCount = topic.prompts.filter(
                  (p) => (bestScores[p.id] ?? 0) >= 75
                ).length;

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleSelectTopic(topic.id)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-white border-blue-600 ring-1 ring-blue-600'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {String(index + 1).padStart(2, '0')}. {topic.titleEn} · {topic.prompts.length} câu
                      </p>
                      <h3 className="font-display text-base font-semibold text-slate-900 truncate">
                        {topic.titleVi}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2">
                        {topic.description}
                      </p>
                      {topicCompletedCount > 0 && (
                        <p className="text-xs font-medium text-emerald-700 pt-0.5 tabular-nums">
                          Đạt chuẩn: {topicCompletedCount}/{topic.prompts.length} câu
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 mt-1 transition-colors ${
                        isSelected ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Right Column: Active Prompt Practice Stage */}
          <section className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-5 sm:p-7 space-y-6">
            {/* Topic Meta + Question Tabs */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  {selectedTopic.titleVi} · {selectedTopic.durationLabel}
                </span>
                <span className="font-mono tabular-nums">
                  Câu {selectedPromptIdx + 1}/{selectedTopic.prompts.length}
                </span>
              </div>

              {/* Prompt Stepper */}
              <div className="flex flex-wrap gap-2">
                {selectedTopic.prompts.map((p, idx) => {
                  const isCurrent = idx === selectedPromptIdx;
                  const score = bestScores[p.id];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPromptIdx(idx)}
                      className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        isCurrent
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Câu {idx + 1}
                      {typeof score === 'number' && score > 0 ? ` (${score}đ)` : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Guided Question */}
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-blue-700">
                  Câu hỏi gợi ý
                </span>
                <button
                  type="button"
                  onClick={() => speakText(activePrompt.questionEn, { rate: 0.95 })}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-700"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Nghe câu hỏi</span>
                </button>
              </div>
              <p className="font-display text-lg sm:text-xl font-semibold text-slate-900 leading-snug">
                {activePrompt.questionEn}
              </p>
              <p className="text-sm text-slate-600">{activePrompt.questionVi}</p>
            </div>

            {/* Sample Answer with IPA + Meaning */}
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-500">
                Câu trả lời mẫu để luyện đọc
              </span>
              <p className="font-display text-xl sm:text-2xl font-semibold text-slate-900 leading-relaxed">
                {activePrompt.sampleAnswerEn}
              </p>
              <p className="font-mono text-xs sm:text-sm text-blue-700 bg-blue-50/70 px-3 py-2 rounded-lg border border-blue-100 leading-relaxed">
                {activePrompt.ipa}
              </p>
              <p className="text-sm text-slate-600 leading-relaxed">
                Nghĩa tiếng Việt: {activePrompt.sampleAnswerVi}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <PronunciationWidget
                targetSentence={activePrompt.sampleAnswerEn}
                bestScore={bestScores[activePrompt.id]}
                onScoreRecorded={(res) => handleScoreRecorded(activePrompt.id, res)}
              />
            </div>
          </section>
        </div>
      ) : (
        /* Mode 2: Free Material Input & Sentence-by-sentence AI practice */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Input / Upload Panel */}
          <form
            onSubmit={handleCreateMaterial}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4"
          >
            <div className="space-y-1">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Nhập tài liệu luyện nói tự do
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Dán đoạn văn tiếng Anh từ sách giáo khoa, bài đọc hoặc tải tệp văn bản lên để tách thành từng câu ngắn.
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="material-title"
                className="block text-xs font-medium text-slate-700"
              >
                Tiêu đề bài đọc (không bắt buộc)
              </label>
              <input
                id="material-title"
                type="text"
                value={materialTitle}
                onChange={(e) => setMaterialTitle(e.target.value)}
                placeholder="Ví dụ: Unit 3 - Teenagers"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="material-body"
                  className="block text-xs font-medium text-slate-700"
                >
                  Đoạn văn tiếng Anh
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setRawInputText(SAMPLE_FREE_PARAGRAPH);
                    if (!materialTitle.trim()) {
                      setMaterialTitle('Daily English Habits');
                    }
                    setUploadNotice(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dùng đoạn mẫu</span>
                </button>
              </div>
              <textarea
                id="material-body"
                rows={6}
                value={rawInputText}
                onChange={(e) => setRawInputText(e.target.value)}
                placeholder="Dán đoạn văn bản tiếng Anh bất kỳ tại đây..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
              />
            </div>

            {uploadNotice && (
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                {uploadNotice}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <Upload className="w-4 h-4" />
                <span>Tải tệp (.txt/.md)</span>
                <input
                  type="file"
                  accept=".txt,.md,text/plain"
                  onChange={handleFileUpload}
                  className="sr-only"
                />
              </label>

              <button
                type="submit"
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
              >
                Tách câu luyện nói
              </button>
            </div>

            {/* Saved Materials History */}
            {customMaterials.length > 0 && (
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-500">
                  Tài liệu đã lưu ({customMaterials.length})
                </p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {customMaterials.map((mat) => {
                    const isActive = activeMaterial?.id === mat.id;
                    return (
                      <div
                        key={mat.id}
                        className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
                          isActive
                            ? 'bg-blue-50/60 border-blue-200'
                            : 'bg-slate-50 border-slate-200 hover:bg-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveMaterialId(mat.id)}
                          className="flex-1 text-left min-w-0"
                        >
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {mat.title}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {mat.sentences.length} câu
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMaterial(mat.id)}
                          aria-label={`Xóa ${mat.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </form>

          {/* Split Sentences Practice List */}
          <section className="lg:col-span-7 space-y-4">
            {activeMaterial ? (
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 tabular-nums">
                      Đã tách thành {activeMaterial.sentences.length} câu ngắn
                    </p>
                    <h3 className="font-display text-xl font-bold text-slate-900">
                      {activeMaterial.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => speakText(activeMaterial.rawText, { rate: 0.92 })}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Nghe cả đoạn</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {activeMaterial.sentences.map((sentence, idx) => (
                    <div key={sentence.id} className="py-5 first:pt-1 last:pb-1 space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-xs font-semibold text-slate-400 pt-1.5 tabular-nums">
                          {String(idx + 1).padStart(2, '0')}.
                        </span>
                        <p className="font-display text-lg font-semibold text-slate-900 leading-relaxed">
                          {sentence.text}
                        </p>
                      </div>
                      <div className="pl-7">
                        <PronunciationWidget
                          targetSentence={sentence.text}
                          compact
                          bestScore={bestScores[sentence.id]}
                          onScoreRecorded={(res) => handleScoreRecorded(sentence.id, res)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 p-8 sm:p-12 text-center space-y-3">
                <FileText className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="font-display text-lg font-semibold text-slate-900">
                  Chưa có tài liệu nào được tách câu
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Hãy dán một đoạn văn bản tiếng Anh ở khung bên cạnh (hoặc bấm "Dùng đoạn mẫu") rồi nhấn "Tách câu luyện nói".
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};
