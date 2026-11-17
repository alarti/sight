/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef } from 'react';
import { CursorControlMode } from '../types/index.ts';

interface GazeReticleProps {
  ringRef: React.RefObject<SVGCircleElement | null>;
  visible?: boolean;
  isManualAimingMode?: boolean;
  isDraggingReticle?: boolean;
  isTrackingPaused?: boolean;
  isRestingInSanctuary?: boolean;
  cursorControlMode?: CursorControlMode;
  bayesianConfidence?: number;
  loupeState?: {
    stage: 'coarse' | 'fine-loupe';
    anchorX: number;
    anchorY: number;
    loupeRadiusPx: number;
  } | null;
  onStartDragReticle?: (e: React.PointerEvent<HTMLDivElement>) => void;
}

export const GazeReticle = forwardRef<HTMLDivElement, GazeReticleProps>(
  (
    {
      ringRef,
      visible = true,
      isManualAimingMode = false,
      isDraggingReticle = false,
      isTrackingPaused = false,
      isRestingInSanctuary = false,
      cursorControlMode = 'bayesian-lock',
      bayesianConfidence = 0,
      loupeState = null,
      onStartDragReticle,
    },
    ref
  ) => {
    if (!visible) {
      return null;
    }

    const strokeColor = isDraggingReticle
      ? '#D19A52'
      : isTrackingPaused
      ? '#7A7870'
      : isManualAimingMode
      ? '#8AB896'
      : cursorControlMode === 'ocular-trackball'
      ? '#D19A52'
      : '#7FA68A';

    const showBayesianTag =
      !isManualAimingMode &&
      !isDraggingReticle &&
      !isRestingInSanctuary &&
      cursorControlMode === 'bayesian-lock' &&
      bayesianConfidence >= 0.48;

    return (
      <>
        {/* TWO-STAGE FOVEAL LOUPE ZONE INDICATOR */}
        {cursorControlMode === 'two-stage-loupe' &&
          loupeState?.stage === 'fine-loupe' &&
          !isManualAimingMode &&
          !isRestingInSanctuary && (
            <div
              style={{
                width: loupeState.loupeRadiusPx * 2,
                height: loupeState.loupeRadiusPx * 2,
                transform: `translate3d(${loupeState.anchorX - loupeState.loupeRadiusPx}px, ${
                  loupeState.anchorY - loupeState.loupeRadiusPx
                }px, 0)`,
              }}
              className="fixed top-0 left-0 rounded-full border border-dashed border-[var(--border-active)]/60 bg-[var(--accent-soft)]/30 pointer-events-none z-[99990] transition-transform duration-150"
            />
          )}

        <div
          ref={ref}
          className={`fixed top-0 left-0 pointer-events-none z-[99999] will-change-transform transition-opacity duration-200 ${
            isRestingInSanctuary && !isManualAimingMode
              ? 'opacity-25'
              : isTrackingPaused && !isManualAimingMode
              ? 'opacity-45'
              : 'opacity-90'
          }`}
        >
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke={
                  isDraggingReticle
                    ? 'rgba(209, 154, 82, 0.35)'
                    : isTrackingPaused
                    ? 'rgba(122, 120, 112, 0.3)'
                    : 'rgba(127, 166, 138, 0.25)'
                }
                strokeWidth="2.5"
                strokeDasharray={isTrackingPaused ? '4 4' : undefined}
                fill="transparent"
              />
              <circle
                ref={ringRef}
                cx="32"
                cy="32"
                r="26"
                stroke={strokeColor}
                strokeWidth="3.5"
                fill={
                  isDraggingReticle
                    ? 'rgba(209, 154, 82, 0.14)'
                    : isManualAimingMode
                    ? 'rgba(127, 166, 138, 0.12)'
                    : 'rgba(127, 166, 138, 0.06)'
                }
                strokeDasharray={175.9}
                strokeDashoffset={175.9}
                strokeLinecap="round"
                className="transition-all duration-75"
              />
            </svg>
            {/* Interactive center drag handle when manual aiming mode is active */}
            <div
              onPointerDown={onStartDragReticle}
              className={`absolute rounded-full transition-transform ${
                isManualAimingMode
                  ? 'w-12 h-12 pointer-events-auto cursor-grab active:cursor-grabbing flex items-center justify-center'
                  : 'w-2.5 h-2.5 pointer-events-none'
              }`}
              title={isManualAimingMode ? 'Arrastre el cursor al punto donde está mirando para calibrar el modelo ML' : undefined}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full border border-[#E6E1D6]/80 ${
                  isDraggingReticle
                    ? 'bg-[#D19A52] scale-125'
                    : isTrackingPaused
                    ? 'bg-[#7A7870]'
                    : 'bg-[#7FA68A]'
                }`}
              />
            </div>
            {(isManualAimingMode || isDraggingReticle) && (
              <span
                className={`absolute -bottom-5 whitespace-nowrap px-2 py-0.5 rounded text-[9px] font-mono font-semibold border pointer-events-none ${
                  isDraggingReticle
                    ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-active)]'
                }`}
              >
                {isDraggingReticle ? 'SOLTAR PARA APRENDER (ML)' : 'PUNTERÍA ML EN VIVO'}
              </span>
            )}
            {showBayesianTag && (
              <span className="absolute -bottom-4 whitespace-nowrap px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border pointer-events-none bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)] tabular-nums">
                LOCK {Math.round(bayesianConfidence * 100)}%
              </span>
            )}
          </div>
        </div>
      </>
    );
  }
);

GazeReticle.displayName = 'GazeReticle';
