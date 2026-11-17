/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, RotateCw, Maximize2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Language } from '../i18n/translations.ts';

interface OrientationLockOverlayProps {
  currentLanguage?: Language;
}

export const OrientationLockOverlay: React.FC<OrientationLockOverlayProps> = ({
  currentLanguage = 'es',
}) => {
  const [isMobileDevice, setIsMobileDevice] = useState<boolean>(false);
  const [isPortrait, setIsPortrait] = useState<boolean>(false);
  const [hasUserBypassed, setHasUserBypassed] = useState<boolean>(false);
  const [lockStatus, setLockStatus] = useState<'idle' | 'locked' | 'unsupported'>('idle');

  const detectMobile = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;

    const userAgent = navigator.userAgent || (navigator as any).vendor || (window as any).opera || '';
    const mobileUARegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
    const isMobileUA = mobileUARegex.test(userAgent);

    const isTouchCoarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const hasTouchPoints = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 0;
    const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 800;

    return isMobileUA || (isTouchCoarse && hasTouchPoints && isSmallScreen);
  }, []);

  const checkPortrait = useCallback((): boolean => {
    if (typeof window === 'undefined') return false;

    if (screen.orientation && screen.orientation.type) {
      return screen.orientation.type.startsWith('portrait');
    }
    if (window.matchMedia) {
      return window.matchMedia('(orientation: portrait)').matches;
    }
    return window.innerHeight > window.innerWidth;
  }, []);

  const attemptOrientationLock = useCallback(async () => {
    if (typeof window === 'undefined') return;

    try {
      const screenAny = screen as any;
      if (screenAny.orientation && typeof screenAny.orientation.lock === 'function') {
        await screenAny.orientation.lock('landscape');
        setLockStatus('locked');
        return true;
      }
      if (typeof screenAny.lockOrientation === 'function') {
        const locked = screenAny.lockOrientation('landscape');
        if (locked) setLockStatus('locked');
        return locked;
      }
      if (typeof screenAny.mozLockOrientation === 'function') {
        const locked = screenAny.mozLockOrientation('landscape');
        if (locked) setLockStatus('locked');
        return locked;
      }
      if (typeof screenAny.msLockOrientation === 'function') {
        const locked = screenAny.msLockOrientation('landscape');
        if (locked) setLockStatus('locked');
        return locked;
      }
      setLockStatus('unsupported');
      return false;
    } catch {
      setLockStatus('unsupported');
      return false;
    }
  }, []);

  const handleRequestFullscreenAndLock = async () => {
    try {
      const docEl = document.documentElement as any;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        await docEl.msRequestFullscreen();
      }
      await attemptOrientationLock();
    } catch {
      await attemptOrientationLock();
    }
  };

  useEffect(() => {
    const mobile = detectMobile();
    setIsMobileDevice(mobile);

    const updateOrientationState = () => {
      const portrait = checkPortrait();
      setIsPortrait(portrait);
      if (!portrait) {
        setHasUserBypassed(false);
      }
    };

    updateOrientationState();

    if (mobile) {
      attemptOrientationLock().catch(() => {});
    }

    const handleOrientationChange = () => {
      setTimeout(updateOrientationState, 150);
    };

    window.addEventListener('resize', updateOrientationState);
    window.addEventListener('orientationchange', handleOrientationChange);

    if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
      screen.orientation.addEventListener('change', updateOrientationState);
    }

    return () => {
      window.removeEventListener('resize', updateOrientationState);
      window.removeEventListener('orientationchange', handleOrientationChange);
      if (screen.orientation && typeof screen.orientation.removeEventListener === 'function') {
        screen.orientation.removeEventListener('change', updateOrientationState);
      }
    };
  }, [detectMobile, checkPortrait, attemptOrientationLock]);

  if (!isMobileDevice || !isPortrait || hasUserBypassed) {
    return null;
  }

  const isEs = currentLanguage === 'es';

  return (
    <div 
      className="fixed inset-0 z-[999999] bg-[var(--bg-canvas)]/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200 text-[var(--text-primary)]"
      role="dialog"
      aria-modal="true"
      aria-label={isEs ? "Gire su dispositivo a horizontal" : "Rotate device to landscape"}
    >
      <div className="max-w-md w-full bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl p-6 sm:p-8 flex flex-col items-center gap-6 relative overflow-hidden">
        {/* ROTATING PHONE ILLUSTRATION */}
        <div className="relative w-24 h-24 flex items-center justify-center rounded-full border border-[var(--border-active)] bg-[var(--bg-elevated)] ocular-breathe-ring">
          <div className="w-14 h-20 rounded-xl border-2 border-[var(--accent-primary)] bg-[var(--bg-canvas)] flex flex-col items-center justify-between p-1.5">
            <div className="w-4 h-1 bg-[var(--border-active)] rounded-full" />
            <div className="w-full flex-1 my-1 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] flex items-center justify-center">
              <RotateCw className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div className="w-4 h-1 bg-[var(--accent-primary)] rounded-full" />
          </div>
        </div>

        {/* HEADINGS */}
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center justify-center gap-1.5 text-[var(--accent-primary)] text-[11px] font-mono uppercase tracking-[0.14em] font-semibold self-center">
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isEs ? "DISPOSITIVO MÓVIL DETECTADO" : "MOBILE DEVICE DETECTED"}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] tracking-tight leading-tight">
            {isEs ? "Gire su dispositivo a horizontal" : "Rotate device to landscape"}
          </h2>

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
            {isEs 
              ? "Para garantizar el seguimiento ocular con cámara frontal y la disposición perifoveal del comunicador para ELA, se recomienda usar formato horizontal."
              : "To ensure proper eye-tracking with the front camera and perifoveal assistive layout for ALS, landscape orientation is required."}
          </p>
        </div>

        {/* ACTIONS */}
        <div className="w-full flex flex-col gap-3 pt-1">
          <button
            onClick={handleRequestFullscreenAndLock}
            className="w-full py-3.5 px-5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
            <span>{isEs ? "Pantalla Completa y Bloquear Horizontal" : "Fullscreen & Lock Landscape"}</span>
          </button>

          {lockStatus === 'locked' && (
            <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--accent-primary)] font-mono">
              <CheckCircle2 className="w-4 h-4" />
              <span>{isEs ? "Orientación horizontal bloqueada" : "Landscape orientation locked"}</span>
            </div>
          )}

          {/* BYPASS OPTION */}
          <button
            onClick={() => setHasUserBypassed(true)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors underline pt-1 flex items-center justify-center gap-1"
          >
            <AlertTriangle className="w-3 h-3 text-[var(--accent-amber)]" />
            <span>{isEs ? "Continuar en vertical (no recomendado)" : "Continue in portrait (not recommended)"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
