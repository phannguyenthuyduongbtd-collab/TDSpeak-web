import React from 'react';
import { MainTab } from '../types';

interface HeaderProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  dueCount: number;
  onStartQuickReview: () => void;
}

const NAV_ITEMS: { id: MainTab; label: string }[] = [
  { id: 'speaking', label: 'Luyện nói AI' },
  { id: 'vocabulary', label: 'Sổ tay & Flashcard' },
  { id: 'games', label: 'Kho trò chơi' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  dueCount,
  onStartQuickReview,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single text element Brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('speaking')}
          className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          TDSpeak
        </button>

        {/* Zone 2: Desktop 3 main navigation tabs */}
        <nav
          aria-label="Điều hướng chính"
          className="hidden md:flex items-center gap-7 h-full"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative h-full inline-flex items-center text-sm font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'text-blue-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onStartQuickReview}
            className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            {dueCount > 0 ? `Ôn tập (${dueCount})` : 'Ôn tập Flashcard'}
          </button>
        </div>
      </div>

      {/* Mobile tab strip */}
      <nav
        aria-label="Điều hướng di động"
        className="md:hidden grid grid-cols-3 border-t border-slate-100 bg-white"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-2.5 px-2 text-xs font-medium text-center whitespace-nowrap truncate transition-colors border-b-2 ${
                isActive
                  ? 'border-blue-600 text-blue-700 font-semibold bg-blue-50/40'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
