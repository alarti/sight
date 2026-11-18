/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { RefObject } from 'react';
import { Volume2, Delete, Magnet, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, EyeOff } from 'lucide-react';
import { Language, translations } from '../i18n/translations.ts';

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
  stickyFocusedKey: string | null;
  isStickyKeyboardEnabled: boolean;
  setIsStickyKeyboardEnabled: (val: boolean) => void;
  keyboardContainerRef: RefObject<HTMLDivElement | null>;
  onSpeakTypedMessage: () => void;
  onApplyAiSuggestion: () => void;
  onKeyType: (char: string) => void;
  detectedGlanceDirection?: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | null;
  onManualDirectionalStep?: (dir: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => void;
  isRestingInSanctuary?: boolean;
  isBlinkSpeaking?: boolean;
  currentLanguage?: Language;
}

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  typedMessage,
  setTypedMessage,
  aiSuggestion,
  dwellTimeMs,
  dwellProgress,
  hoveredDwellId,
  stickyFocusedKey,
  isStickyKeyboardEnabled,
  setIsStickyKeyboardEnabled,
  keyboardContainerRef,
  onSpeakTypedMessage,
  onApplyAiSuggestion,
  onKeyType,
  detectedGlanceDirection,
  onManualDirectionalStep,
  isRestingInSanctuary = false,
  isBlinkSpeaking = false,
  currentLanguage = 'es',
}) => {
  const t = translations[currentLanguage].keyboard;
  const isAiSelected = stickyFocusedKey === 'ai-autocomplete-card' || hoveredDwellId === 'ai-autocomplete-card' || isBlinkSpeaking;
  const keyboardRows = getKeyRows(currentLanguage);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2.5">
      {/* DIRECTIONAL GLANCE FEEDBACK & STEPPER CONTROL BAR */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex items-center justify-between flex-wrap gap-1.5 sm:gap-2 shrink-0">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          <button
            type="button"
            data-dwell-id="btn-toggle-stepper"
            onClick={() => setIsStickyKeyboardEnabled(!isStickyKeyboardEnabled)}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-colors border ${
              isStickyKeyboardEnabled
                ? 'bg-[var(--bg-elevated)] border-[var(--border-active)] text-[var(--text-primary)]'
                : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-muted)]'
            } ${hoveredDwellId === 'btn-toggle-stepper' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
            title={currentLanguage === 'en' ? 'Toggle directional stepper mode' : 'Alternar modo selector direccional de teclado'}
          >
            <Magnet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--accent-primary)]" />
            <span>{currentLanguage === 'en' ? 'Stepper:' : 'Selector:'}</span>
            <strong className={isStickyKeyboardEnabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}>
              {isStickyKeyboardEnabled
                ? currentLanguage === 'en'
                  ? 'ON'
                  : 'ACTIVO'
                : currentLanguage === 'en'
                ? 'FREE'
                : 'LIBRE'}
            </strong>
          </button>

          {stickyFocusedKey && isStickyKeyboardEnabled && (
            <span className="hidden md:inline font-mono text-[11px] text-[var(--text-secondary)]">
              {currentLanguage === 'en' ? 'Focus:' : 'Foco:'}{' '}
              <strong className="text-[var(--text-primary)]">[{stickyFocusedKey}]</strong>
            </span>
          )}
        </div>

        {/* DIRECTIONAL GLANCE BUTTONS (ALL GAZE-TARGETABLE WITH data-dwell-id) */}
        <div className="flex items-center gap-1 sm:gap-1.5 font-mono text-[10px] sm:text-[11px]">
          <button
            type="button"
            data-dwell-id="btn-dir-left"
            onClick={() => onManualDirectionalStep?.('LEFT')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'LEFT' || hoveredDwellId === 'btn-dir-left'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold ring-2 ring-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline sm:inline">{t.dirLeft}</span>
          </button>

          <button
            type="button"
            data-dwell-id="btn-dir-up"
            onClick={() => onManualDirectionalStep?.('UP')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'UP' || hoveredDwellId === 'btn-dir-up'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold ring-2 ring-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <ArrowUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline sm:inline">{t.dirUp}</span>
          </button>

          <button
            type="button"
            data-dwell-id="btn-dir-down"
            onClick={() => onManualDirectionalStep?.('DOWN')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'DOWN' || hoveredDwellId === 'btn-dir-down'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold ring-2 ring-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <ArrowDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xs:inline sm:inline">{t.dirDown}</span>
          </button>

          <button
            type="button"
            data-dwell-id="btn-dir-right"
            onClick={() => onManualDirectionalStep?.('RIGHT')}
            className={`px-2 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'RIGHT' || hoveredDwellId === 'btn-dir-right'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold ring-2 ring-[var(--accent-primary)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <span className="hidden xs:inline sm:inline">{t.dirRight}</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>

      {/* CONTEXTUAL PHRASE PREDICTION + OCULAR REST PAD (SIDE-BY-SIDE ON ALL SCREENS TO SAVE VERTICAL HEIGHT) */}
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 shrink-0">
        <div
          data-dwell-id="ai-autocomplete-card"
          data-keyboard-key="ai-autocomplete-card"
          onClick={onApplyAiSuggestion}
          className={`col-span-2 bg-[var(--bg-surface)] border rounded-xl px-2.5 py-2 sm:px-4 sm:py-2.5 flex items-center justify-between gap-2 relative overflow-hidden transition-colors cursor-pointer ${
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
                  ? 'Dwell or blink to speak'
                  : 'Fije mirada o parpadee'}
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
          className={`col-span-1 rounded-xl border px-2.5 py-2 sm:px-3.5 sm:py-2.5 flex items-center gap-2 transition-colors ${
            isRestingInSanctuary
              ? 'bg-[var(--bg-elevated)] border-[var(--border-active)]'
              : 'bg-[var(--bg-sanctuary)] border-[var(--border-hairline)]'
          }`}
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] shrink-0 ocular-breathe-ring">
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

      {/* TYPED TEXT BUFFER & FLEX-SCALED KEYBOARD MATRIX */}
      <div className="flex-1 min-h-0 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2.5">
        {/* DISPLAY OF TYPED TEXT */}
        <div className="h-9 sm:h-12 shrink-0 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg sm:rounded-xl px-3 py-1.5 text-sm sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight flex items-center justify-between">
          <span className="truncate">
            {typedMessage || (
              <span className="text-[var(--text-muted)] font-normal text-xs sm:text-base">
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

        {/* ACTION BUTTONS & VIRTUAL KEYBOARD CONTAINER */}
        <div ref={keyboardContainerRef} className="flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2">
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5 shrink-0 h-9 sm:h-11">
            <button
              type="button"
              data-dwell-id="key-speak"
              data-keyboard-key="key-speak"
              onClick={onSpeakTypedMessage}
              className={`px-2 py-1 rounded-lg sm:rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors relative overflow-hidden h-full ${
                stickyFocusedKey === 'key-speak' || hoveredDwellId === 'key-speak'
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
                    transform: `scaleX(${
                      stickyFocusedKey === 'key-speak' || hoveredDwellId === 'key-speak' ? dwellProgress / 100 : 0
                    })`,
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
                stickyFocusedKey === 'key-space' || hoveredDwellId === 'key-space'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] ring-2 ring-[var(--accent-primary)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
              }`}
            >
              <span className="truncate">{t.space}</span>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
                <div
                  className="h-full origin-left transition-transform duration-75 bg-[var(--accent-contrast)]"
                  style={{
                    transform: `scaleX(${
                      stickyFocusedKey === 'key-space' || hoveredDwellId === 'key-space' ? dwellProgress / 100 : 0
                    })`,
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
                stickyFocusedKey === 'key-backspace' || hoveredDwellId === 'key-backspace'
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
                    transform: `scaleX(${
                      stickyFocusedKey === 'key-backspace' || hoveredDwellId === 'key-backspace'
                        ? dwellProgress / 100
                        : 0
                    })`,
                  }}
                />
              </div>
            </button>
          </div>

          {/* VIRTUAL KEYBOARD GRID (30 LETTERS AND PUNCTUATION KEYS SCALED TO FIT VIEWPORT) */}
          <div className="flex-1 min-h-0 grid grid-rows-3 gap-1 sm:gap-2">
            {keyboardRows.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-10 gap-1 sm:gap-2 min-h-0">
                {row.map((char) => {
                  const dwellKeyId = `char-${char}`;
                  const isCurrentActive =
                    stickyFocusedKey === char ||
                    stickyFocusedKey === dwellKeyId ||
                    hoveredDwellId === dwellKeyId ||
                    hoveredDwellId === char;

                  return (
                    <button
                      key={char}
                      type="button"
                      data-dwell-id={dwellKeyId}
                      data-keyboard-key={char}
                      onClick={() => onKeyType(char)}
                      className={`h-full min-h-[32px] w-full rounded-lg sm:rounded-xl border text-sm sm:text-xl font-semibold flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                        isCurrentActive
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-bold z-20 ring-2 ring-[var(--accent-primary)]'
                          : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-primary)] hover:border-[var(--border-active)]'
                      }`}
                    >
                      <span>{char}</span>
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-hairline)] overflow-hidden">
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
