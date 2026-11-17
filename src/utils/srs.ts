import { SrsRating, VocabWord } from '../types';

const ONE_MINUTE_MS = 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function calculateNextReview(
  word: VocabWord,
  rating: SrsRating,
  now: number = Date.now()
): VocabWord {
  let nextReviewAt = now;
  let intervalDays = word.intervalDays;
  let streak = word.streak;

  if (rating === 'hard') {
    // Quên / Khó -> lặp lại sau 1 phút
    nextReviewAt = now + ONE_MINUTE_MS;
    intervalDays = 0;
    streak = 0;
  } else if (rating === 'medium') {
    // Nhớ mang máng -> lặp lại sau 1 ngày
    nextReviewAt = now + ONE_DAY_MS;
    intervalDays = 1;
    streak = Math.max(1, word.streak);
  } else {
    // Đã thuộc lòng -> lặp lại sau 3-7 ngày tùy chuỗi ôn tập
    const nextStreak = word.streak + 1;
    let days = 3;
    if (nextStreak === 1) days = 3;
    else if (nextStreak === 2) days = 5;
    else days = 7;

    nextReviewAt = now + days * ONE_DAY_MS;
    intervalDays = days;
    streak = nextStreak;
  }

  return {
    ...word,
    nextReviewAt,
    lastReviewedAt: now,
    intervalDays,
    streak,
    reviewCount: word.reviewCount + 1,
    lastRating: rating,
  };
}

export function isWordDue(word: VocabWord, now: number = Date.now()): boolean {
  return word.nextReviewAt <= now;
}

export function formatNextReviewLabel(word: VocabWord, now: number = Date.now()): string {
  const diffMs = word.nextReviewAt - now;
  if (diffMs <= 0) {
    return 'Cần ôn ngay';
  }
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.ceil(diffMs / ONE_MINUTE_MS));
    return `Ôn lại sau ${mins} phút`;
  }
  if (diffMs < ONE_DAY_MS) {
    const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return `Ôn lại sau ${hours} giờ`;
  }
  const days = Math.max(1, Math.round(diffMs / ONE_DAY_MS));
  return `Ôn lại sau ${days} ngày`;
}
