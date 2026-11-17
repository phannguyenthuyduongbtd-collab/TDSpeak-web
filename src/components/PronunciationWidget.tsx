import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Volume2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Keyboard,
} from 'lucide-react';
import { PronunciationResult } from '../types';
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionSupported,
  speakText,
  SpeechRecognitionInstance,
} from '../utils/speech';
import { evaluatePronunciation } from '../utils/pronunciation';

interface PronunciationWidgetProps {
  targetSentence: string;
  compact?: boolean;
  bestScore?: number;
  onScoreRecorded?: (result: PronunciationResult) => void;
}

export const PronunciationWidget: React.FC<PronunciationWidgetProps> = ({
  targetSentence,
  compact = false,
  bestScore,
  onScoreRecorded,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef<string>('');
  const speechSupported = isSpeechRecognitionSupported();

  // Reset widget result when target sentence changes
  useEffect(() => {
    stopListening();
    setResult(null);
    setInterimText('');
    setMicError(null);
    setManualText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSentence]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const handleGrade = (transcript: string) => {
    const trimmed = transcript.trim();
    if (!trimmed) {
      setMicError('Chưa nghe rõ giọng đọc của bạn. Hãy nói gần micro và rõ chữ hơn nhé.');
      return;
    }
    const graded = evaluatePronunciation(targetSentence, trimmed);
    setResult(graded);
    setMicError(null);
    onScoreRecorded?.(graded);
  };

  const startListening = () => {
    const SpeechRec = getSpeechRecognitionConstructor();
    if (!SpeechRec) {
      setMicError(
        'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói trực tiếp. Bạn có thể dùng chế độ nhập thử bên dưới hoặc mở bằng Chrome/Edge.'
      );
      setShowManualInput(true);
      return;
    }

    setMicError(null);
    setInterimText('');
    finalTranscriptRef.current = '';

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let finalStr = '';
        let interimStr = '';
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          const text = item[0]?.transcript || '';
          if (item.isFinal) {
            finalStr += text + ' ';
          } else {
            interimStr += text + ' ';
          }
        }
        finalTranscriptRef.current = finalStr.trim();
        setInterimText((finalStr + interimStr).trim());
      };

      recognition.onerror = (event) => {
        setIsListening(false);
        recognitionRef.current = null;
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicError(
            'Bạn chưa cấp quyền Micro. Hãy bật quyền Micro trên thanh địa chỉ trình duyệt hoặc dùng chế độ nhập thử.'
          );
        } else if (event.error === 'no-speech') {
          setMicError('Không phát hiện âm thanh. Hãy bấm Micro và đọc to rõ câu tiếng Anh nhé.');
        } else if (event.error !== 'aborted') {
          setMicError('Micro gặp gián đoạn nhẹ. Bạn hãy thử bấm lại hoặc dùng chế độ nhập kiểm tra.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
        const captured = (finalTranscriptRef.current || interimText).trim();
        if (captured) {
          handleGrade(captured);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
      setMicError('Không thể khởi động Micro. Hãy thử tải lại trang hoặc dùng chế độ nhập kiểm tra.');
    }
  };

  const toggleRecording = () => {
    if (isListening) {
      const latestText = (finalTranscriptRef.current || interimText).trim();
      stopListening();
      if (latestText) {
        handleGrade(latestText);
      }
    } else {
      startListening();
    }
  };

  const handleListen = (rate: number) => {
    speakText(targetSentence, {
      rate,
      onStart: () => setIsSpeakingTarget(true),
      onEnd: () => setIsSpeakingTarget(false),
    });
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return { text: 'Xuất sắc', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    if (score >= 75) return { text: 'Rất tốt', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' };
    if (score >= 50) return { text: 'Khá ổn', colorClass: 'text-amber-700 bg-amber-50 border-amber-200' };
    return { text: 'Cần luyện thêm', colorClass: 'text-red-700 bg-red-50 border-red-200' };
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => handleListen(0.95)}
          className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
            isSpeakingTarget
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Volume2 className="w-4 h-4 shrink-0" />
          <span>Nghe mẫu</span>
        </button>

        <button
          type="button"
          onClick={() => handleListen(0.7)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Volume2 className="w-4 h-4 shrink-0" />
          <span>Nghe chậm 0.7x</span>
        </button>

        <button
          type="button"
          onClick={toggleRecording}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
            isListening
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isListening ? (
            <>
              <Square className="w-4 h-4 fill-current shrink-0" />
              <span>Dừng & Chấm điểm</span>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 shrink-0" />
              <span>Bấm mic luyện nói</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowManualInput((v) => !v)}
          title="Chế độ nhập văn bản kiểm tra nếu thiết bị không có Micro"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
        >
          <Keyboard className="w-3.5 h-3.5 shrink-0" />
          <span>{showManualInput ? 'Ẩn nhập thử' : 'Nhập thử không cần mic'}</span>
        </button>

        {typeof bestScore === 'number' && bestScore > 0 && (
          <span className="ml-auto text-xs font-mono tabular-nums text-slate-500">
            Cao nhất: {bestScore}/100
          </span>
        )}
      </div>

      {/* Live listening banner */}
      {isListening && (
        <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-blue-800">
              Đang lắng nghe giọng đọc tiếng Anh của bạn...
            </p>
            <p className="text-sm text-slate-800 italic">
              {interimText ? `"${interimText}"` : 'Hãy đọc to và rõ ràng câu mẫu ở trên, sau đó bấm "Dừng & Chấm điểm".'}
            </p>
          </div>
        </div>
      )}

      {/* Fallback / Manual check input */}
      {(showManualInput || !speechSupported) && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGrade(manualText);
          }}
          className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5"
        >
          <label className="block text-xs font-medium text-slate-600">
            Kiểm tra nhanh (nhập câu bạn vừa đọc để chấm điểm đối chiếu từng từ):
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Ví dụ: Hello everyone my name is Minh..."
              className="flex-1 px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap shrink-0"
            >
              Chấm điểm
            </button>
          </div>
        </form>
      )}

      {/* Mic Error */}
      {micError && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-sm text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>{micError}</p>
        </div>
      )}

      {/* Graded Pronunciation Result */}
      {result && (
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="font-mono text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
                {result.score}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </div>
              {(() => {
                const badge = getScoreLabel(result.score);
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${badge.colorClass}`}
                  >
                    {result.score >= 75 ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5" />
                    )}
                    {badge.text}
                  </span>
                );
              })()}
            </div>

            <button
              type="button"
              onClick={() => {
                setResult(null);
                startListening();
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đọc lại câu này</span>
            </button>
          </div>

          {/* Word-by-word diff */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Kết quả đối chiếu từng từ</span>
              <span>
                <span className="text-emerald-700 font-medium">Xanh: Đọc đúng</span>
                <span className="mx-1.5">·</span>
                <span className="text-red-600 font-medium">Đỏ: Đọc sai / Thiếu</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 leading-relaxed">
              {result.diffs.map((item, idx) => {
                if (item.status === 'correct') {
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-medium"
                    >
                      {item.display}
                    </span>
                  );
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => speakText(item.expected, { rate: 0.8 })}
                    title={
                      item.status === 'wrong' && item.spokenAs
                        ? `Hệ thống nghe thành "${item.spokenAs}". Bấm để nghe phát âm chuẩn.`
                        : 'Từ này bị đọc thiếu hoặc chưa rõ. Bấm để nghe phát âm chuẩn.'
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 text-sm font-medium underline decoration-red-400 decoration-wavy underline-offset-2 hover:bg-red-100 transition-colors"
                  >
                    {item.display}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-slate-500 pt-1">
              AI nghe được: <span className="text-slate-700 italic">"{result.transcript}"</span>
            </p>
          </div>

          {/* Detailed Encouraging Feedback */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <p className="text-sm font-semibold text-slate-900">{result.feedbackTitle}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{result.feedbackDetail}</p>

            {result.practiceWords.length > 0 && (
              <div className="pt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500">
                  Bấm để nghe lại từ cần sửa:
                </span>
                {result.practiceWords.slice(0, 6).map((word) => (
                  <button
                    key={word}
                    type="button"
                    onClick={() => speakText(word, { rate: 0.75 })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-200 transition-colors"
                  >
                    <Volume2 className="w-3 h-3" />
                    {word}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
