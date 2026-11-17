/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Crosshair,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Brain,
  RotateCcw,
  CheckCircle2,
  Move,
  X,
  Focus,
} from 'lucide-react';
import { Language } from '../i18n/translations.ts';

interface ManualAimingHudProps {
  isOpen: boolean;
  onClose: () => void;
  onNudgeCursor: (dxPx: number, dyPx: number, teachMl?: boolean) => void;
  onTeachCurrentPointToMl: () => void;
  onResetManualOffset: () => void;
  onCenterCalibration: () => void;
  onScreenDragStart: (clientX: number, clientY: number) => void;
  onScreenDragMove: (clientX: number, clientY: number) => void;
  onScreenDragEnd: (clientX: number, clientY: number) => void;
  isDragging: boolean;
  cursorX: number;
  cursorY: number;
  offsetX: number;
  offsetY: number;
  samplesCount: number;
  lastLearnedTimestamp: number | null;
  currentLanguage: Language;
}

export const ManualAimingHud: React.FC<ManualAimingHudProps> = ({
  isOpen,
  onClose,
  onNudgeCursor,
  onTeachCurrentPointToMl,
  onResetManualOffset,
  onCenterCalibration,
  onScreenDragStart,
  onScreenDragMove,
  onScreenDragEnd,
  isDragging,
  cursorX,
  cursorY,
  offsetX,
  offsetY,
  samplesCount,
  lastLearnedTimestamp,
  currentLanguage,
}) => {
  const [stepPx, setStepPx] = useState<number>(18);
  const [dragCanvasEnabled, setDragCanvasEnabled] = useState<boolean>(true);
  const isEn = currentLanguage === 'en';

  if (!isOpen) return null;

  const isRecentlyLearned =
    lastLearnedTimestamp !== null && Date.now() - lastLearnedTimestamp < 2600;

  const handlePointerDownOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragCanvasEnabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onScreenDragStart(e.clientX, e.clientY);
  };

  const handlePointerMoveOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragCanvasEnabled) return;
    e.preventDefault();
    onScreenDragMove(e.clientX, e.clientY);
  };

  const handlePointerUpOverlay = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragCanvasEnabled) return;
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onScreenDragEnd(e.clientX, e.clientY);
  };

  return (
    <>
      {/* FULL-SCREEN INTERACTIVE DRAG-TO-CALIBRATE LAYER */}
      {dragCanvasEnabled && (
        <div
          onPointerDown={handlePointerDownOverlay}
          onPointerMove={handlePointerMoveOverlay}
          onPointerUp={handlePointerUpOverlay}
          onPointerCancel={handlePointerUpOverlay}
          className="fixed inset-0 z-[9000] cursor-crosshair touch-none select-none bg-[var(--bg-canvas)]/10 border border-dashed border-[var(--border-active)]"
        >
          {/* Subtle visual guide banner at top center */}
          <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-active)] text-[var(--text-primary)] text-xs font-mono font-medium flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>
              {isEn
                ? 'Look at any spot · Touch/Drag cursor there · Release to train ML'
                : 'Mire a un punto · Toque o arrastre el cursor hasta ahí · Suelte para enseñar al ML'}
            </span>
          </div>
        </div>
      )}

      {/* FLOATING MANUAL AIMING & ML CALIBRATION CONTROL PANEL */}
      <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-[9500] w-[330px] sm:w-[375px] bg-[var(--bg-surface)] border border-[var(--border-active)] rounded-2xl p-3.5 text-xs text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Crosshair className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text-primary)] text-xs sm:text-sm leading-tight">
                {isEn ? 'Live Manual Aiming & ML' : 'Ajuste de Puntería en Directo (ML)'}
              </h3>
              <p className="text-[10px] text-[var(--text-muted)] font-mono">
                {isEn
                  ? 'Drag screen or use Arrow Keys ← ↑ → ↓'
                  : 'Arrastre en pantalla o use Flechas ← ↑ → ↓'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={isEn ? 'Close manual aiming mode (Esc)' : 'Cerrar modo de ajuste manual (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toggle Screen Dragging vs Normal UI Interaction */}
        <div className="mt-2.5 flex items-center justify-between gap-2 bg-[var(--bg-canvas)] px-3 py-2 rounded-xl border border-[var(--border-hairline)]">
          <div className="flex items-center gap-2">
            <Move className="w-3.5 h-3.5 text-[var(--accent-amber)] shrink-0" />
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              {isEn ? 'Touch / Mouse Screen Drag:' : 'Arrastrar tocando pantalla:'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDragCanvasEnabled(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-colors border ${
              dragCanvasEnabled
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-hairline)]'
            }`}
          >
            {dragCanvasEnabled
              ? isEn
                ? 'ACTIVE'
                : 'ACTIVO'
              : isEn
              ? 'PAUSED'
              : 'PAUSADO'}
          </button>
        </div>

        {/* Directional Pad (D-Pad) + Step Selector */}
        <div className="mt-3 grid grid-cols-12 gap-2.5 items-center">
          {/* D-Pad 3x3 */}
          <div className="col-span-6 grid grid-cols-3 gap-1.5 bg-[var(--bg-canvas)] p-2 rounded-xl border border-[var(--border-hairline)] justify-items-center">
            <div />
            <button
              type="button"
              onClick={() => onNudgeCursor(0, -stepPx, false)}
              className="w-10 h-9 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
              title={isEn ? 'Move cursor Up (↑)' : 'Mover cursor Arriba (↑)'}
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div />

            <button
              type="button"
              onClick={() => onNudgeCursor(-stepPx, 0, false)}
              className="w-10 h-9 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
              title={isEn ? 'Move cursor Left (←)' : 'Mover cursor Izquierda (←)'}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onCenterCalibration}
              className="w-10 h-9 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] transition-colors font-mono text-[10px] font-semibold"
              title={isEn ? 'Center cursor on screen' : 'Centrar cursor en pantalla'}
            >
              <Focus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNudgeCursor(stepPx, 0, false)}
              className="w-10 h-9 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
              title={isEn ? 'Move cursor Right (→)' : 'Mover cursor Derecha (→)'}
            >
              <ArrowRight className="w-4 h-4" />
            </button>

            <div />
            <button
              type="button"
              onClick={() => onNudgeCursor(0, stepPx, false)}
              className="w-10 h-9 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] border border-[var(--border-hairline)] flex items-center justify-center text-[var(--text-primary)] transition-colors"
              title={isEn ? 'Move cursor Down (↓)' : 'Mover cursor Abajo (↓)'}
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <div />
          </div>

          {/* Step Size & ML Teach Controls */}
          <div className="col-span-6 flex flex-col gap-2">
            <div className="bg-[var(--bg-canvas)] p-2 rounded-xl border border-[var(--border-hairline)]">
              <span className="text-[10px] font-mono text-[var(--text-muted)] block mb-1">
                {isEn ? 'Step per press:' : 'Paso por pulsación:'}
              </span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { label: '8px', val: 8 },
                  { label: '18px', val: 18 },
                  { label: '40px', val: 40 },
                ].map(opt => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setStepPx(opt.val)}
                    className={`py-1 rounded text-[10px] font-mono font-semibold transition-colors ${
                      stepPx === opt.val
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={onTeachCurrentPointToMl}
              className="w-full py-2 px-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              title={isEn ? 'Save current gaze-to-cursor alignment in ML model (Enter)' : 'Guardar este ajuste en el modelo de Machine Learning (Enter)'}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{isEn ? 'Memorize in ML' : 'Memorizar en ML'}</span>
            </button>

            <button
              type="button"
              onClick={onResetManualOffset}
              className="w-full py-1.5 px-2 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-[var(--accent-amber)]" />
              <span>{isEn ? 'Reset Offset' : 'Restablecer Offset'}</span>
            </button>
          </div>
        </div>

        {/* Telemetry & ML Confirmation Footer */}
        <div className="mt-2.5 pt-2 border-t border-[var(--border-hairline)] flex items-center justify-between text-[10px] font-mono tabular-nums">
          <div className="text-[var(--text-muted)]">
            <span>
              Cursor <strong className="text-[var(--text-primary)]">{Math.round(cursorX)},{Math.round(cursorY)}</strong>
            </span>
            <span className="mx-1.5">·</span>
            <span>
              Offset <strong className="text-[var(--accent-amber)]">{Math.round(-offsetX)}px, {Math.round(-offsetY)}px</strong>
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isRecentlyLearned ? (
              <span className="text-[var(--accent-primary)] font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {isEn ? `+1 ML (${samplesCount} pts)` : `+1 ML (${samplesCount} ptos)`}
              </span>
            ) : (
              <span className="text-[var(--text-secondary)]">
                ML {samplesCount} {isEn ? 'pts' : 'ptos'}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
