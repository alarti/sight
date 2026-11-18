/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { RefObject, useMemo } from 'react';
import { Volume2, Delete, EyeOff, Sparkles, Eraser } from 'lucide-react';
import { Language, translations } from '../i18n/translations.ts';
import { getQuickWordSuggestions, applyWordCompletion } from '../utils/predictive.ts';
import { playKeyTypeChime } from '../utils/audio.ts';

export const getKeyRows = (language: Language = 'es') => [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', language === 'en' ? ';' : 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '?']
];

interface VirtualKeyboardProps {
  typedMessage: string;
  setTypedMessage: React.Dispatch<React.SetStateAction<string>>;
  aiSuggestion: string;
  dwellTimeMs: number;
  dwellProgress: number;
  hoveredDwellId: string | null;
  keyboardContainerRef: RefObject<HTMLDivElement | null>;
  onSpeakTypedMessage: () => void;
  onApplyAiSuggestion: () => void;
  onKeyType: (char: string) => void;
  isRestingInSanctuary?: boolean;
  isBlinkSpeaking?: boolean;
  currentLanguage?: Language;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  typedMessage,
  setTypedMessage,
  aiSuggestion,
  dwellProgress,
  hoveredDwellId,
  keyboardContainerRef,
  onSpeakTypedMessage,
  onApplyAiSuggestion,
  onKeyType,
  isRestingInSanctuary = false,
  isBlinkSpeaking = false,
  currentLanguage = 'es',
}) => {
  const t = translations[currentLanguage].keyboard;
  const isAiSelected = hoveredDwellId === 'ai-autocomplete-card' || isBlinkSpeaking;
  const keyboardRows = getKeyRows(currentLanguage);

  // Compute top-5 dynamic word completions based on the active prefix in typedMessage
  const quickWords = useMemo(
    () => getQuickWordSuggestions(typedMessage, currentLanguage, 5),
    [typedMessage, currentLanguage]
  );

  const handleCompleteWord = (word: string) => {
    playKeyTypeChime();
    const nextText = applyWordCompletion(typedMessage, word);
    setTypedMessage(nextText);
  };

  const handleDeleteLastWord = () => {
    playKeyTypeChime();
    setTypedMessage((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) return '';
      const lastSpaceIdx = trimmed.lastIndexOf(' ');
      if (lastSpaceIdx === -1) return '';
      return trimmed.slice(0, lastSpaceIdx + 1);
    });
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2">
      {/* CONTEXTUAL PHRASE PREDICTION + OCULAR REST PAD (SIDE-BY-SIDE ON ALL SCREENS) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 shrink-0">
        <div
          data-dwell-id="ai-autocomplete-card"
          data-keyboard-key="ai-autocomplete-card"
          onClick={onApplyAiSuggestion}
          className={`col-span-2 bg-[var(--bg-surface)] border rounded-xl px-2.5 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 relative overflow-hidden transition-colors cursor-pointer ${
            isAiSelected
              ? 'border-[var(--border-active)] bg-[var(--bg-elevated)] ring-2 ring-[var(--accent-primary)]'
              : 'border-[var(--border-hairline)]'
          }`}
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-mono text-[var(--text-muted)]">
              <span className="uppercase tracking-[0.1em] text-[var(--accent-primary)] font-semibold truncate">
                {t.aiSuggestion}
              </span>
              <span className="hidden sm:inline">·</span>
              <span className={`hidden sm:inline tabular-nums truncate ${isBlinkSpeaking ? 'text-[var(--accent-amber)] font-semibold' : ''}`}>
                {isBlinkSpeaking
                  ? currentLanguage === 'en'
                    ? 'Blink detected · Speaking'
                    : 'Parpadeo · Locutando'
                  : currentLanguage === 'en'
                  ? 'Fixate gaze here to speak phrase'
                  : 'Fije la mirada aquí para locutar'}
              </span>
            </div>
            <p className="text-xs sm:text-base font-semibold text-[var(--text-primary)] tracking-tight leading-snug truncate">
              «{aiSuggestion}»
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApplyAiSuggestion();
            }}
            className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg font-sans font-semibold text-[11px] sm:text-xs shrink-0 border transition-colors flex items-center gap-1.5 ${
              isAiSelected
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{currentLanguage === 'en' ? 'Speak Phrase' : 'Locutar Frase'}</span>
          </button>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
            <div
              className="h-full origin-left transition-transform duration-75 bg-[var(--accent-primary)]"
              style={{ transform: `scaleX(${isAiSelected ? dwellProgress / 100 : 0})` }}
            />
          </div>
        </div>

        {/* KEYBOARD OCULAR REST SANCTUARY PAD (ZERO DWELL TRIGGERS) */}
        <div
          data-sanctuary-zone="true"
          className={`col-span-1 rounded-xl border px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center gap-2 transition-colors ${
            isRestingInSanctuary
              ? 'bg-[var(--bg-elevated)] border-[var(--border-active)]'
              : 'bg-[var(--bg-sanctuary)] border-[var(--border-hairline)]'
          }`}
        >
          <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] shrink-0 ocular-breathe-ring">
            <EyeOff className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-[0.1em] text-[var(--accent-primary)] block font-semibold truncate">
              {currentLanguage === 'en' ? 'Pause Pad · 0% Click' : 'Pausa Ocular · 0% Clic'}
            </span>
            <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] leading-tight line-clamp-1">
              {currentLanguage === 'en'
                ? 'Rest gaze here safely'
                : 'Descanse aquí la vista'}
            </p>
          </div>
        </div>
      </div>

      {/* TYPED TEXT BUFFER, 1-GAZE WORD CHIPS & DIRECT-GAZE KEYBOARD MATRIX */}
      <div className="flex-1 min-h-0 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2">
        {/* DISPLAY OF TYPED TEXT */}
        <div className="h-9 sm:h-11 shrink-0 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg sm:rounded-xl px-3 py-1 text-sm sm:text-lg font-semibold text-[var(--text-primary)] tracking-tight flex items-center justify-between">
          <span className="truncate">
            {typedMessage || (
              <span className="text-[var(--text-muted)] font-normal text-xs sm:text-sm">
                {t.placeholder}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-[10px] font-mono text-[var(--text-muted)] hidden sm:inline tabular-nums">
              {typedMessage.length}c
            </span>
            <span className="w-1.5 sm:w-2 h-4 sm:h-5 bg-[var(--accent-primary)] inline-block opacity-75" />
          </div>
        </div>

        {/* 1-GAZE PREDICTIVE WORD COMPLETION BAR (5 DIRECT GAZE CHIPS) */}
        <div className="grid grid-cols-5 gap-1 sm:gap-2 shrink-0 h-8 sm:h-10">
          {quickWords.map((word, idx) => {
            const chipDwellId = `word-chip-${idx}`;
            const isChipHovered = hoveredDwellId === chipDwellId;
            return (
              <button
                key={`${idx}-${word}`}
                type="button"
                data-dwell-id={chipDwellId}
                onClick={() => handleCompleteWord(word)}
                className={`px-1.5 sm:px-2.5 rounded-lg sm:rounded-xl border text-[11px] sm:text-sm font-semibold flex items-center justify-center gap-1 transition-colors relative overflow-hidden h-full ${
                  isChipHovered
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] ring-2 ring-[var(--accent-primary)] z-10'
                    : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:border-[var(--border-active)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[var(--accent-primary)] shrink-0 hidden md:inline" />
                <span className="truncate">{word}</span>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                  <div
                    className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                    style={{ transform: `scaleX(${isChipHovered ? dwellProgress / 100 : 0})` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* ACTION BUTTONS & DIRECT GAZE KEYBOARD MATRIX */}
        <div ref={keyboardContainerRef} className="flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2 shrink-0 h-9 sm:h-11">
            <button
              type="button"
              data-dwell-id="key-speak"
              data-keyboard-key="key-speak"
              onClick={onSpeakTypedMessage}
              className={`px-2 py-1 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative overflow-hidden h-full ${
                hoveredDwellId === 'key-speak'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] ring-2 ring-[var(--accent-primary)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{t.speak}</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                  style={{
                    transform: `scaleX(${hoveredDwellId === 'key-speak' ? dwellProgress / 100 : 0})`,
                  }}
                />
              </div>
            </button>

            <button
              type="button"
              data-dwell-id="key-space"
              data-keyboard-key="key-space"
              onClick={() => onKeyType(' ')}
              className={`px-2 py-1 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative overflow-hidden h-full ${
                hoveredDwellId === 'key-space'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] ring-2 ring-[var(--accent-primary)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
              }`}
            >
              <span className="truncate">{t.space}</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                  style={{
                    transform: `scaleX(${hoveredDwellId === 'key-space' ? dwellProgress / 100 : 0})`,
                  }}
                />
              </div>
            </button>

            <button
              type="button"
              data-dwell-id="key-backspace"
              data-keyboard-key="key-backspace"
              onClick={() => setTypedMessage((prev) => prev.slice(0, -1))}
              className={`px-2 py-1 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative overflow-hidden h-full ${
                hoveredDwellId === 'key-backspace'
                  ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)] ring-2 ring-[var(--accent-amber)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Delete className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{t.backspace}</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                  style={{
                    transform: `scaleX(${hoveredDwellId === 'key-backspace' ? dwellProgress / 100 : 0})`,
                  }}
                />
              </div>
            </button>

            <button
              type="button"
              data-dwell-id="key-clear-word"
              data-keyboard-key="key-clear-word"
              onClick={handleDeleteLastWord}
              className={`px-2 py-1 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative overflow-hidden h-full ${
                hoveredDwellId === 'key-clear-word'
                  ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)] ring-2 ring-[var(--accent-amber)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Eraser className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">{currentLanguage === 'en' ? 'Del Word' : 'Borrar Palabra'}</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                  style={{
                    transform: `scaleX(${hoveredDwellId === 'key-clear-word' ? dwellProgress / 100 : 0})`,
                  }}
                />
              </div>
            </button>
          </div>

          {/* VIRTUAL KEYBOARD GRID (30 LETTERS AND PUNCTUATION KEYS SCALED TO FIT VIEWPORT) */}
          <div className="flex-1 min-h-0 grid grid-rows-3 gap-1.5 sm:gap-2">
            {keyboardRows.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-10 gap-1 sm:gap-2 min-h-0">
                {row.map((char) => {
                  const dwellKeyId = `char-${char}`;
                  const isCurrentActive = hoveredDwellId === dwellKeyId || hoveredDwellId === char;

                  return (
                    <button
                      key={char}
                      type="button"
                      data-dwell-id={dwellKeyId}
                      data-keyboard-key={char}
                      onClick={() => onKeyType(char)}
                      className={`h-full min-h-[34px] w-full rounded-lg sm:rounded-xl border text-base sm:text-2xl font-bold flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                        isCurrentActive
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] z-20 ring-2 ring-[var(--accent-primary)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--border-active)]'
                      }`}
                    >
                      <span>{char}</span>
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[var(--border-hairline)] overflow-hidden">
                        <div
                          className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                          style={{ transform: `scaleX(${isCurrentActive ? dwellProgress / 100 : 0})` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

