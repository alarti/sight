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
    <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl px-3.5 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
          <Volume2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] text-[var(--text-muted)] font-mono shrink-0">
            {t.title}
          </span>
          <p className="text-xs sm:text-base font-semibold text-[var(--text-primary)] truncate">
            «{lastSpokenText}»
          </p>
        </div>
      </div>
      <button
        data-dwell-id="repeat-speech"
        onClick={onRepeatSpeech}
        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-[11px] sm:text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 ${
          isHovered
            ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold'
            : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
        }`}
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden xs:inline sm:inline">{t.repeatButton}</span>
      </button>
    </div>
  );
};
