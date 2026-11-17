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
    <div className="flex flex-col gap-3.5">
      {/* DIRECTIONAL GLANCE FEEDBACK BAR */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl px-4 py-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
            {currentLanguage === 'en' ? 'Directional Gaze Stepper' : 'Control Direccional Ocular'}
          </span>
          <span className="text-[var(--text-muted)]">·</span>
          <span className="text-[var(--text-secondary)]">
            {currentLanguage === 'en'
              ? 'Glance toward a direction to step through keys · Blink to speak contextual phrase.'
              : 'Desplace la mirada para avanzar entre teclas · Parpadee para locutar la frase sugerida.'}
          </span>
        </div>

        {/* DIRECTIONAL GLANCE STATUS INDICATORS */}
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <button
            onClick={() => onManualDirectionalStep?.('LEFT')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'LEFT'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.dirLeft}</span>
          </button>

          <button
            onClick={() => onManualDirectionalStep?.('UP')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'UP'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>{t.dirUp}</span>
          </button>

          <button
            onClick={() => onManualDirectionalStep?.('DOWN')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'DOWN'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>{t.dirDown}</span>
          </button>

          <button
            onClick={() => onManualDirectionalStep?.('RIGHT')}
            className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors border ${
              detectedGlanceDirection === 'RIGHT'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
            }`}
          >
            <span>{t.dirRight}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CONTEXTUAL PHRASE PREDICTION + OCULAR REST PAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div
          data-dwell-id="ai-autocomplete-card"
          data-keyboard-key="ai-autocomplete-card"
          onClick={onApplyAiSuggestion}
          className={`lg:col-span-2 bg-[var(--bg-surface)] border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative overflow-hidden transition-colors cursor-pointer ${
            isAiSelected
              ? 'border-[var(--border-active)] bg-[var(--bg-elevated)]'
              : 'border-[var(--border-hairline)]'
          }`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)] flex-wrap">
              <span className="uppercase tracking-[0.12em] text-[var(--accent-primary)] font-semibold">
                {t.aiSuggestion}
              </span>
              <span>·</span>
              <span className={`tabular-nums ${isBlinkSpeaking ? 'text-[var(--accent-amber)] font-semibold' : ''}`}>
                {isBlinkSpeaking
                  ? currentLanguage === 'en'
                    ? 'Blink detected · Speaking phrase now'
                    : 'Parpadeo detectado · Locutando frase sugerida'
                  : isAiSelected
                  ? currentLanguage === 'en'
                    ? `Activating in ${(dwellTimeMs / 1000).toFixed(1)}s · or blink to speak`
                    : `Activando en ${(dwellTimeMs / 1000).toFixed(1)}s · o parpadee para locutar`
                  : currentLanguage === 'en'
                  ? 'Blink to speak phrase immediately · or step UP'
                  : 'Parpadee para locutar al instante · o suba el selector'}
              </span>
            </div>
            <p className="text-base sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight leading-snug truncate">
              «{aiSuggestion}»
            </p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onApplyAiSuggestion();
            }}
            className={`px-4 py-2 rounded-lg font-sans font-semibold text-xs shrink-0 border transition-colors flex items-center gap-2 ${
              isAiSelected
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                : 'bg-[var(--bg-elevated)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{currentLanguage === 'en' ? 'Speak Phrase (Blink)' : 'Locutar Frase (Parpadeo)'}</span>
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
          className={`rounded-xl border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
            isRestingInSanctuary
              ? 'bg-[var(--bg-elevated)] border-[var(--border-active)]'
              : 'bg-[var(--bg-sanctuary)] border-[var(--border-hairline)]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] shrink-0 ocular-breathe-ring">
              <EyeOff className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--accent-primary)] block font-semibold">
                {currentLanguage === 'en' ? 'Ocular Pause Pad · 0% Click' : 'Zona de Pausa Ocular · 0% Clic'}
              </span>
              <p className="text-xs text-[var(--text-secondary)] leading-snug">
                {currentLanguage === 'en'
                  ? 'Rest your gaze here while thinking of your next word.'
                  : 'Pose la vista aquí mientras piensa la siguiente palabra.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* STICKY CURSOR CONTROL BAR & TYPED TEXT */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-4 flex flex-col gap-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-[var(--text-secondary)] font-mono">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="tabular-nums">
              {currentLanguage === 'en'
                ? `Buffer · ${typedMessage.length} chars`
                : `Texto compuesto · ${typedMessage.length} caracteres`}
            </span>
            <button
              onClick={() => setIsStickyKeyboardEnabled(!isStickyKeyboardEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border ${
                isStickyKeyboardEnabled
                  ? 'bg-[var(--bg-elevated)] border-[var(--border-active)] text-[var(--text-primary)]'
                  : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-muted)]'
              }`}
              title={currentLanguage === 'en' ? 'Toggle directional stepper mode' : 'Alternar modo selector direccional de teclado'}
            >
              <Magnet className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{currentLanguage === 'en' ? 'Stepper Mode:' : 'Selector Direccional:'}</span>
              <strong className={isStickyKeyboardEnabled ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}>
                {isStickyKeyboardEnabled
                  ? currentLanguage === 'en'
                    ? 'Active'
                    : 'Activo'
                  : currentLanguage === 'en'
                  ? 'Free Gaze'
                  : 'Mirada Libre'}
              </strong>
            </button>
          </div>
          <div className="flex items-center gap-3 tabular-nums">
            {stickyFocusedKey && isStickyKeyboardEnabled && (
              <span className="text-[var(--text-secondary)]">
                {currentLanguage === 'en' ? 'Focus:' : 'Foco:'}{' '}
                <strong className="text-[var(--text-primary)]">[{stickyFocusedKey}]</strong>
              </span>
            )}
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--accent-primary)] font-medium">
              Dwell {(dwellTimeMs / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        {/* DISPLAY OF TYPED TEXT */}
        <div className="min-h-[52px] sm:min-h-[68px] bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl px-4 py-3 text-base sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight flex items-center justify-between">
          <span className="truncate">
            {typedMessage || (
              <span className="text-[var(--text-muted)] font-normal">
                {t.placeholder}
              </span>
            )}
          </span>
          <span className="w-2 h-5 sm:h-6 bg-[var(--accent-primary)] ml-2 inline-block shrink-0 opacity-75" />
        </div>

        {/* ACTION BUTTONS & VIRTUAL KEYBOARD CONTAINER */}
        <div ref={keyboardContainerRef} className="flex flex-col gap-2.5 sm:gap-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <button
              data-dwell-id="key-speak"
              data-keyboard-key="key-speak"
              onClick={onSpeakTypedMessage}
              className={`p-2.5 sm:p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative overflow-hidden ${
                stickyFocusedKey === 'key-speak' || hoveredDwellId === 'key-speak'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{t.speak}</span>
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
              data-dwell-id="key-space"
              data-keyboard-key="key-space"
              onClick={() => onKeyType(' ')}
              className={`p-2.5 sm:p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative overflow-hidden ${
                stickyFocusedKey === 'key-space' || hoveredDwellId === 'key-space'
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)] hover:border-[var(--border-active)]'
              }`}
            >
              <span>{t.space}</span>
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
              data-dwell-id="key-backspace"
              data-keyboard-key="key-backspace"
              onClick={() => setTypedMessage((prev) => prev.slice(0, -1))}
              className={`p-2.5 sm:p-3.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors relative overflow-hidden ${
                stickyFocusedKey === 'key-backspace' || hoveredDwellId === 'key-backspace'
                  ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Delete className="w-4 h-4" />
              <span>{t.backspace}</span>
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

          {/* VIRTUAL KEYBOARD GRID (LETTERS AND PUNCTUATION) */}
          <div className="flex flex-col gap-1.5 sm:gap-2.5 pt-1">
            {keyboardRows.map((row, rIdx) => (
              <div key={rIdx} className="grid grid-cols-10 gap-1 sm:gap-2">
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
                      data-dwell-id={dwellKeyId}
                      data-keyboard-key={char}
                      onClick={() => onKeyType(char)}
                      className={`h-11 sm:h-14 md:h-15 rounded-lg sm:rounded-xl border text-base sm:text-xl font-semibold flex flex-col items-center justify-center relative overflow-hidden transition-colors ${
                        isCurrentActive
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-bold z-20'
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
