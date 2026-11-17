import { PronunciationResult, WordDiffItem } from '../types';

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'-]/g, '')
    .replace(/^'+|'+$/g, '');
}

const HOMOPHONE_GROUPS: string[][] = [
  ['to', 'too', 'two'],
  ['there', 'their', "they're"],
  ['for', 'four'],
  ['write', 'right'],
  ['know', 'no'],
  ['sea', 'see'],
  ['hear', 'here'],
  ['wear', 'where'],
  ['one', 'won'],
  ['buy', 'by', 'bye'],
  ['sun', 'son'],
  ['hour', 'our'],
  ['meet', 'meat'],
  ['eight', 'ate'],
  ['read', 'red'],
];

function wordsMatch(expectedNorm: string, spokenNorm: string): boolean {
  if (!expectedNorm || !spokenNorm) return false;
  if (expectedNorm === spokenNorm) return true;

  // Handle common contractions vs expanded forms lightly
  const strippedExp = expectedNorm.replace(/'/g, '');
  const strippedSpk = spokenNorm.replace(/'/g, '');
  if (strippedExp === strippedSpk) return true;

  for (const group of HOMOPHONE_GROUPS) {
    if (group.includes(expectedNorm) && group.includes(spokenNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Dynamic programming alignment (Edit Distance on word tokens)
 * Maps each expected word accurately against spoken words even if the student
 * skips a word or inserts an extra word.
 */
export function evaluatePronunciation(
  expectedSentence: string,
  spokenTranscript: string
): PronunciationResult {
  const displayTokens = expectedSentence
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const expectedNorms = displayTokens.map(normalizeWord);
  const spokenRawTokens = spokenTranscript
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const spokenNorms = spokenRawTokens.map(normalizeWord).filter(Boolean);

  const n = expectedNorms.length;
  const m = spokenNorms.length;

  // DP table for minimum edit operations between expected[0..i) and spoken[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(0)
  );

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const match = wordsMatch(expectedNorms[i - 1], spokenNorms[j - 1]);
      if (match) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // substitution
          dp[i - 1][j] + 1, // deletion (missing expected word)
          dp[i][j - 1] + 1 // insertion (extra spoken word)
        );
      }
    }
  }

  // Backtrack to assign status to every expected word
  const diffs: WordDiffItem[] = new Array(n);
  let i = n;
  let j = m;

  while (i > 0) {
    if (j > 0 && wordsMatch(expectedNorms[i - 1], spokenNorms[j - 1])) {
      diffs[i - 1] = {
        expected: expectedNorms[i - 1],
        display: displayTokens[i - 1],
        status: 'correct',
        spokenAs: spokenRawTokens[j - 1],
      };
      i--;
      j--;
    } else if (j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      diffs[i - 1] = {
        expected: expectedNorms[i - 1],
        display: displayTokens[i - 1],
        status: 'wrong',
        spokenAs: spokenRawTokens[j - 1],
      };
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j] + 1) {
      diffs[i - 1] = {
        expected: expectedNorms[i - 1],
        display: displayTokens[i - 1],
        status: 'missing',
      };
      i--;
    } else {
      // Extra spoken word (insertion)
      j--;
    }
  }

  const correctCount = diffs.filter((d) => d.status === 'correct').length;
  const totalExpected = diffs.length || 1;
  const rawAccuracy = (correctCount / totalExpected) * 100;

  // Mildly penalize excessive extra unrelated words
  const extraWords = Math.max(0, m - n);
  const penalty = Math.min(15, extraWords * 3);
  const score = Math.max(0, Math.min(100, Math.round(rawAccuracy - penalty)));

  const practiceWords = Array.from(
    new Set(
      diffs
        .filter((d) => d.status !== 'correct')
        .map((d) => d.display.replace(/[.,!?;:"'()]/g, ''))
        .filter(Boolean)
    )
  );

  let feedbackTitle = '';
  let feedbackDetail = '';

  if (score >= 92) {
    feedbackTitle = 'Phát âm xuất sắc!';
    feedbackDetail =
      practiceWords.length === 0
        ? 'Bạn đọc trôi chảy, rõ ràng và khớp hoàn toàn với câu mẫu. Hãy tiếp tục phát huy phong độ này nhé!'
        : `Giọng đọc của bạn rất chuẩn và tự nhiên! Chỉ cần chú ý thêm từ "${practiceWords.join(', ')}" để đạt trọn vẹn 100 điểm.`;
  } else if (score >= 75) {
    feedbackTitle = 'Rất tốt, đáng khen!';
    feedbackDetail = `Bạn đã đọc đúng ${correctCount}/${totalExpected} từ khóa chính. Hãy nghe lại mẫu và luyện đọc chậm thêm các từ màu đỏ: ${practiceWords.slice(0, 4).join(', ')}.`;
  } else if (score >= 50) {
    feedbackTitle = 'Khá ổn — Cố lên nhé!';
    feedbackDetail = `Bạn đã nắm được nhịp câu và đọc đúng ${correctCount}/${totalExpected} từ. Hãy thử tốc độ chậm (0.75x) để nghe rõ âm cuối của các từ cần sửa: ${practiceWords.slice(0, 5).join(', ')}.`;
  } else {
    feedbackTitle = 'Đừng nản nhé — Thử lại nào!';
    feedbackDetail =
      spokenNorms.length === 0
        ? 'Hệ thống chưa thu rõ giọng nói của bạn. Hãy kiểm tra micro, nói to rõ hơn và thử lại nhé!'
        : `Bạn vừa khởi động xong! Hãy bấm nút Nghe chậm để làm quen từng cụm từ, sau đó đọc lại từng nhịp chậm rãi hơn.`;
  }

  return {
    score,
    transcript: spokenTranscript.trim(),
    diffs,
    correctCount,
    totalExpected,
    feedbackTitle,
    feedbackDetail,
    practiceWords,
    timestamp: Date.now(),
  };
}

/**
 * Splits a free-form English passage into clean, bite-sized practice sentences.
 */
export function splitParagraphIntoSentences(rawText: string): string[] {
  const cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Temporarily protect common abbreviations from splitting
  const protectedText = cleaned
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e)\./gi, '$1__DOT__')
    .replace(/(\d)\.(\d)/g, '$1__DOT__$2');

  const lines = protectedText
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const sentences: string[] = [];

  for (const line of lines) {
    const parts = line.match(/[^.!?]+[.!?]*/g) || [line];
    for (const part of parts) {
      const restored = part.replace(/__DOT__/g, '.').trim();
      if (restored.length >= 2) {
        sentences.push(restored);
      }
    }
  }

  return sentences;
}
