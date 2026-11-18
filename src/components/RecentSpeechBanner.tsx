/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, RotateCcw } from 'lucide-react';
import { Language, translations } from '../i18n/translations.ts';

interface RecentSpeechBannerProps {
  lastSpokenText: string;
  hoveredDwellId: string | null;
  onRepeatSpeech: () => void;
  currentLanguage?: Language;
}

export const RecentSpeechBanner: React.FC<RecentSpeechBannerProps> = ({
  lastSpokenText,
  hoveredDwellId,
  onRepeatSpeech,
  currentLanguage = 'es',
}) => {
  const isHovered = hoveredDwellId === 'repeat-speech';
  const t = translations[currentLanguage].recentSpeech;

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 sm:gap-3 transition-colors shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
          <Volume2 className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex items-baseline gap-2">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)] font-mono hidden sm:inline shrink-0">
            {t.title}
          </span>
          <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
            «{lastSpokenText}»
          </p>
        </div>
      </div>
      <button
        type="button"
        data-dwell-id="repeat-speech"
        onClick={onRepeatSpeech}
        className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
          isHovered
            ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold ring-2 ring-[var(--accent-primary)]'
            : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>{t.repeatButton}</span>
      </button>
    </div>
  );
};
