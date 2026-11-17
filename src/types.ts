export type MainTab = 'speaking' | 'vocabulary' | 'games';

export type VocabSubTab = 'flashcard' | 'notebook';

export type GameSubTab = 'quiz' | 'fill_blank' | 'dictation' | 'scramble';

export type SrsRating = 'hard' | 'medium' | 'easy';

export interface SpeakingPrompt {
  id: string;
  questionEn: string;
  questionVi: string;
  sampleAnswerEn: string;
  ipa: string;
  sampleAnswerVi: string;
}

export interface SpeakingTopic {
  id: string;
  titleVi: string;
  titleEn: string;
  durationLabel: string;
  description: string;
  prompts: SpeakingPrompt[];
}

export interface CustomSentence {
  id: string;
  text: string;
}

export interface CustomMaterial {
  id: string;
  title: string;
  rawText: string;
  sentences: CustomSentence[];
  createdAt: number;
}

export interface WordDiffItem {
  expected: string;
  display: string;
  status: 'correct' | 'wrong' | 'missing';
  spokenAs?: string;
}

export interface PronunciationResult {
  score: number;
  transcript: string;
  diffs: WordDiffItem[];
  correctCount: number;
  totalExpected: number;
  feedbackTitle: string;
  feedbackDetail: string;
  practiceWords: string[];
  timestamp: number;
}

export interface VocabWord {
  id: string;
  word: string;
  partOfSpeech: string;
  phonetic: string;
  meaning: string;
  example: string;
  createdAt: number;
  // SRS fields
  nextReviewAt: number;
  lastReviewedAt: number | null;
  intervalDays: number; // 0 means learning/minute-level, >=1 means days
  streak: number;
  reviewCount: number;
  lastRating?: SrsRating;
}

export interface GameRoundAnswer {
  word: VocabWord;
  userAnswer: string;
  isCorrect: boolean;
}
