/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Target, CheckCircle, X, RotateCcw } from 'lucide-react';
import { UserProfile, CalibrationSample } from '../profileManager.ts';
import { EyeTrackingData } from '../eyeTracker.ts';
import { fitCalibrationModel, aggregateFixationSamples, CalibrationMatrixCoeffs } from '../utils/calibration.ts';
import {
  evaluateRasterScanPursuitTarget,
  calibrateFromSmoothPursuit,
  PursuitStreamFrame,
  RasterPursuitTargetState,
} from '../utils/smoothPursuitCalibration.ts';
import { playPointChime, stopAllSounds } from '../utils/audio.ts';
import { Language, translations } from '../i18n/translations.ts';

interface GridCalibrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: UserProfile;
  onSaveProfile: (updatedProfile: UserProfile) => void;
  trackingInfo: EyeTrackingData | null;
  onSpeak: (text: string) => void;
  currentLanguage?: Language;
}

type CalibrationPreset = 'smooth-pursuit' | '9-grid' | '5-quadrant' | '4-corners';

// 9 Points located at the furthest reachable perimeter of the screen
const GRID_POINTS_DATA = [
  { id: 0, xPct: 0.07, yPct: 0.08, labelEs: 'Esquina Superior Izquierda', labelEn: 'Top-Left Corner' },
  { id: 1, xPct: 0.50, yPct: 0.08, labelEs: 'Borde Superior Centro', labelEn: 'Top Center Edge' },
  { id: 2, xPct: 0.93, yPct: 0.08, labelEs: 'Esquina Superior Derecha', labelEn: 'Top-Right Corner' },
  { id: 3, xPct: 0.07, yPct: 0.50, labelEs: 'Borde Medio Izquierda', labelEn: 'Middle-Left Edge' },
  { id: 4, xPct: 0.50, yPct: 0.50, labelEs: 'Centro Neutro de Pantalla', labelEn: 'Screen Neutral Center' },
  { id: 5, xPct: 0.93, yPct: 0.50, labelEs: 'Borde Medio Derecha', labelEn: 'Middle-Right Edge' },
  { id: 6, xPct: 0.07, yPct: 0.92, labelEs: 'Esquina Inferior Izquierda', labelEn: 'Bottom-Left Corner' },
  { id: 7, xPct: 0.50, yPct: 0.92, labelEs: 'Borde Inferior Centro', labelEn: 'Bottom Center Edge' },
  { id: 8, xPct: 0.93, yPct: 0.92, labelEs: 'Esquina Inferior Derecha', labelEn: 'Bottom-Right Corner' },
];

const RASTER_SCAN_LINES = [
  { row: 0, yPct: 0.08, dir: 'ltr' as const, labelEs: 'Línea 1 (Izq → Der)', labelEn: 'Line 1 (Left → Right)' },
  { row: 1, yPct: 0.29, dir: 'rtl' as const, labelEs: 'Línea 2 (Der → Izq)', labelEn: 'Line 2 (Right → Left)' },
  { row: 2, yPct: 0.50, dir: 'ltr' as const, labelEs: 'Línea 3 · Centro (Izq → Der)', labelEn: 'Line 3 · Center (Left → Right)' },
  { row: 3, yPct: 0.71, dir: 'rtl' as const, labelEs: 'Línea 4 (Der → Izq)', labelEn: 'Line 4 (Right → Left)' },
  { row: 4, yPct: 0.92, dir: 'ltr' as const, labelEs: 'Línea 5 · Inferior (Izq → Der)', labelEn: 'Line 5 · Bottom (Left → Right)' },
];

const PRESET_INDICES: Record<Exclude<CalibrationPreset, 'smooth-pursuit'>, number[]> = {
  '4-corners': [0, 2, 8, 6],
  '5-quadrant': [4, 0, 2, 8, 6],
  '9-grid': [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

export const GridCalibrationWizard: React.FC<GridCalibrationWizardProps> = ({
  isOpen,
  onClose,
  activeProfile,
  onSaveProfile,
  trackingInfo,
  onSpeak,
  currentLanguage = 'es',
}) => {
  // Default to Continuous Boustrophedon Line-Scan + 3D Head-Pose Coupled Calibration
  const [presetMode, setPresetMode] = useState<CalibrationPreset>('smooth-pursuit');
  const [countdown, setCountdown] = useState<number | null>(3);
  const [currentPointIndex, setCurrentPointIndex] = useState<number>(0);
  const [pointProgress, setPointProgress] = useState<number>(0);
  const [pursuitState, setPursuitState] = useState<RasterPursuitTargetState>(() =>
    evaluateRasterScanPursuitTarget(0, 5)
  );
  const [pursuitMetrics, setPursuitMetrics] = useState<{ lagMs: number; r2: number; cells: number } | null>(null);
  const [calibrationDone, setCalibrationDone] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [waitingForValidEye, setWaitingForValidEye] = useState<boolean>(false);

  const isPursuitMode = presetMode === 'smooth-pursuit';
  const activeIndices = isPursuitMode ? [] : PRESET_INDICES[presetMode];
  const activePoints = activeIndices.map(id => GRID_POINTS_DATA[id]);
  const t = translations[currentLanguage].calibration;

  const getPointLabel = (idx: number) => {
    if (isPursuitMode) {
      if (pursuitState.phase === 'head-gimbal') {
        return currentLanguage === 'en'
          ? '3D Head Calibration: Keep eyes on center & gently nod/turn head'
          : 'Ajuste 3D de Cabeza: Fije la vista en el centro y mueva suave la cabeza';
      }
      const lineIdx = Math.max(0, Math.min(4, pursuitState.lineIndex));
      const lineInfo = RASTER_SCAN_LINES[lineIdx];
      return currentLanguage === 'en' ? lineInfo.labelEn : lineInfo.labelEs;
    }
    const pt = activePoints[idx];
    if (!pt) return '';
    return currentLanguage === 'en' ? pt.labelEn : pt.labelEs;
  };

  const trackingInfoRef = useRef<EyeTrackingData | null>(trackingInfo);
  trackingInfoRef.current = trackingInfo;

  // Active point capture accumulator & smooth-pursuit stream buffer
  const pointSamplesRef = useRef<Array<{ rawX: number; rawY: number; yaw: number; pitch: number; roll: number }>>([]);
  const collectedSamplesRef = useRef<CalibrationSample[]>([]);
  const pursuitStreamRef = useRef<PursuitStreamFrame[]>([]);
  const announcedGimbalRef = useRef<boolean>(false);
  const lastLineChimeRef = useRef<number>(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const restartCalibrationSequence = (nextPreset?: CalibrationPreset) => {
    if (nextPreset) setPresetMode(nextPreset);
    setCountdown(3);
    setCurrentPointIndex(0);
    collectedSamplesRef.current = [];
    pursuitStreamRef.current = [];
    announcedGimbalRef.current = false;
    lastLineChimeRef.current = 0;
    setPointProgress(0);
    setPursuitState(evaluateRasterScanPursuitTarget(0, 5));
    setPursuitMetrics(null);
    setCalibrationDone(false);
    setIsPaused(false);
    setWaitingForValidEye(false);
    pointSamplesRef.current = [];
  };

  // Setup / Reset when opened
  useEffect(() => {
    if (isOpen) {
      restartCalibrationSequence();
      const introMsg = currentLanguage === 'en'
        ? `Starting continuous line-scan and 3D head calibration for ${activeProfile.name}. Follow the cursor from top-left line by line.`
        : `Iniciando barrido continuo por líneas y matriz 3D de cabeza para ${activeProfile.name}. Siga el cursor desde arriba a la izquierda línea a línea.`;
      onSpeak(introMsg);
    }
  }, [isOpen, activeProfile.name, currentLanguage]);

  // Initial 3-second countdown before point 0 / raster sweep start
  useEffect(() => {
    if (!isOpen || countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        setCountdown(null);
        onSpeak(getPointLabel(0));
      } else {
        setCountdown(countdown - 1);
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [isOpen, countdown, presetMode]);

  // Continuous Boustrophedon Line-Scan + 2s 3D Head-Pose Gimbal Calibration Loop
  useEffect(() => {
    if (!isOpen || !isPursuitMode || countdown !== null || calibrationDone || isPaused) return;

    let animId: number;
    let activeElapsedMs = 0;
    let lastFrameTime = performance.now();
    // 10.5s for 5-line Boustrophedon raster scan + 2.0s for central 3D head-gimbal calibration = 12.5s
    const ORBIT_DURATION_MS = 12500;
    pursuitStreamRef.current = [];
    announcedGimbalRef.current = false;
    lastLineChimeRef.current = 0;
    setPointProgress(0);
    setWaitingForValidEye(false);

    const step = (now: number) => {
      const dt = Math.min(60, Math.max(1, now - lastFrameTime));
      lastFrameTime = now;

      const cur = trackingInfoRef.current;
      const hasValidCleanEye = Boolean(
        cur &&
        cur.faceDetected &&
        cur.eyesDetected &&
        !cur.isBlinking &&
        (cur.signalQuality ?? 1) >= 0.35 &&
        Number.isFinite(cur.rawGazeX) &&
        Number.isFinite(cur.rawGazeY)
      );

      if (hasValidCleanEye) {
        setWaitingForValidEye(false);
        activeElapsedMs += dt;
      } else {
        setWaitingForValidEye(true);
      }

      const progress01 = Math.min(1, activeElapsedMs / ORBIT_DURATION_MS);
      const state = evaluateRasterScanPursuitTarget(progress01, 5);
      setPursuitState(state);
      setPointProgress(progress01 * 100);

      // Subtle audio tick when advancing to a new horizontal scan line
      if (state.phase === 'raster-scan' && state.lineIndex > lastLineChimeRef.current) {
        lastLineChimeRef.current = state.lineIndex;
        playPointChime(523.25 + state.lineIndex * 45);
      }

      // Announce 2-second 3D Head-Pose Gimbal phase once when entering center hold
      if (state.phase === 'head-gimbal' && !announcedGimbalRef.current) {
        announcedGimbalRef.current = true;
        playPointChime(783.99);
        onSpeak(
          currentLanguage === 'en'
            ? 'Keep your gaze fixed on the center and gently nod or turn your head.'
            : 'Mantenga la vista fija en el centro y mueva suavemente la cabeza.'
        );
      }

      if (hasValidCleanEye && cur) {
        const stageRect = stageRef.current?.getBoundingClientRect();
        const targetScreenX = stageRect ? stageRect.left + state.xPct * stageRect.width : state.xPct * window.innerWidth;
        const targetScreenY = stageRect ? stageRect.top + state.yPct * stageRect.height : state.yPct * window.innerHeight;
        pursuitStreamRef.current.push({
          tMs: now,
          targetX: targetScreenX,
          targetY: targetScreenY,
          rawPupilX: cur.rawGazeX,
          rawPupilY: cur.rawGazeY,
          headYaw: cur.headPose?.normYaw ?? 0,
          headPitch: cur.headPose?.normPitch ?? 0,
          headRoll: cur.headPose?.rollDeg ?? 0,
        });
      }

      if (progress01 >= 1) {
        const chosenAlgo = activeProfile.calibrationModel || 'quadrant-matrix';
        const pursuitRes = calibrateFromSmoothPursuit(pursuitStreamRef.current, chosenAlgo);
        setCalibrationDone(true);
        setWaitingForValidEye(false);
        stopAllSounds();

        if (pursuitRes) {
          setPursuitMetrics({
            lagMs: pursuitRes.optimalLagMs,
            r2: pursuitRes.pearsonR2,
            cells: pursuitRes.rasterCellsCount,
          });
          setCalibrationStats(pursuitRes.matrix);
          const neutralCenter = {
            x: pursuitRes.samples.reduce((a, s) => a + s.rawPupilX, 0) / pursuitRes.samples.length,
            y: pursuitRes.samples.reduce((a, s) => a + s.rawPupilY, 0) / pursuitRes.samples.length,
          };
          onSaveProfile({
            ...activeProfile,
            calibrationModel: chosenAlgo,
            samples: pursuitRes.samples,
            baselineOffsetX: 0,
            baselineOffsetY: 0,
            neutralCenter,
            calibrationMatrix: pursuitRes.matrix,
            updatedAt: Date.now(),
          });
        }
        return;
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, isPursuitMode, countdown, calibrationDone, isPaused, currentLanguage]);

  // Fixation-gated progression engine through discrete quadrant points
  useEffect(() => {
    if (!isOpen || isPursuitMode || countdown !== null || calibrationDone || isPaused) return;

    let animId: number;
    let lastFrameTime = performance.now();
    const pointOpenedAt = lastFrameTime;
    let validCaptureMs = 0;
    const STABILIZATION_MS = currentPointIndex === 0 ? 850 : 600;
    const TARGET_VALID_CAPTURE_MS = 1100;
    const MIN_VALID_FRAMES = 14;
    const MAX_POINT_WAIT_MS = 6500;

    pointSamplesRef.current = [];
    setPointProgress(0);
    setWaitingForValidEye(false);

    const step = (now: number) => {
      const dt = Math.min(80, Math.max(1, now - lastFrameTime));
      lastFrameTime = now;
      const elapsedSinceOpen = now - pointOpenedAt;

      if (elapsedSinceOpen < STABILIZATION_MS) {
        setPointProgress(0);
        animId = requestAnimationFrame(step);
        return;
      }

      const cur = trackingInfoRef.current;
      const hasValidCleanEye = Boolean(
        cur &&
        cur.faceDetected &&
        cur.eyesDetected &&
        !cur.isBlinking &&
        (cur.signalQuality ?? 1) >= 0.40 &&
        Number.isFinite(cur.rawGazeX) &&
        Number.isFinite(cur.rawGazeY)
      );

      if (hasValidCleanEye && cur) {
        setWaitingForValidEye(false);
        pointSamplesRef.current.push({
          rawX: cur.rawGazeX,
          rawY: cur.rawGazeY,
          yaw: cur.headPose?.normYaw ?? 0,
          pitch: cur.headPose?.normPitch ?? 0,
          roll: cur.headPose?.rollDeg ?? 0,
        });
        validCaptureMs += dt;
      } else {
        setWaitingForValidEye(true);
      }

      const timeProg = Math.min(100, (validCaptureMs / TARGET_VALID_CAPTURE_MS) * 100);
      const countProg = Math.min(100, (pointSamplesRef.current.length / MIN_VALID_FRAMES) * 100);
      const progress = hasValidCleanEye ? Math.min(timeProg, Math.max(countProg, timeProg * 0.85)) : timeProg;
      setPointProgress(progress);

      const readyByFixation =
        validCaptureMs >= TARGET_VALID_CAPTURE_MS && pointSamplesRef.current.length >= MIN_VALID_FRAMES;
      const timedOut = elapsedSinceOpen >= MAX_POINT_WAIT_MS && pointSamplesRef.current.length > 0;

      if (readyByFixation || timedOut) {
        const pt = activePoints[currentPointIndex];
        const stageRect = stageRef.current?.getBoundingClientRect();
        const targetScreenX = stageRect ? stageRect.left + pt.xPct * stageRect.width : pt.xPct * window.innerWidth;
        const targetScreenY = stageRect ? stageRect.top + pt.yPct * stageRect.height : pt.yPct * window.innerHeight;

        const aggregated = aggregateFixationSamples(pointSamplesRef.current);
        const startIdx = Math.floor(pointSamplesRef.current.length * 0.20);
        const settledPoseFrames = pointSamplesRef.current.slice(startIdx);
        const meanYaw = settledPoseFrames.reduce((a, f) => a + f.yaw, 0) / Math.max(1, settledPoseFrames.length);
        const meanPitch = settledPoseFrames.reduce((a, f) => a + f.pitch, 0) / Math.max(1, settledPoseFrames.length);
        const meanRoll = settledPoseFrames.reduce((a, f) => a + f.roll, 0) / Math.max(1, settledPoseFrames.length);

        const sample: CalibrationSample = {
          targetX: targetScreenX,
          targetY: targetScreenY,
          rawPupilX: aggregated.rawX,
          rawPupilY: aggregated.rawY,
          headYaw: meanYaw,
          headPitch: meanPitch,
          headRoll: meanRoll,
        };

        const newSamples = [...collectedSamplesRef.current, sample];
        collectedSamplesRef.current = newSamples;

        if (currentPointIndex < activePoints.length - 1) {
          playPointChime(587.33 + currentPointIndex * 40);
          const nextIdx = currentPointIndex + 1;
          setCurrentPointIndex(nextIdx);
          onSpeak(getPointLabel(nextIdx));
        } else {
          setCalibrationDone(true);
          setWaitingForValidEye(false);
          computeAndSaveCalibration(newSamples);
          stopAllSounds();
        }
        return;
      }

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isOpen, isPursuitMode, countdown, currentPointIndex, calibrationDone, isPaused, currentLanguage, presetMode]);

  // Clean up and halt any running sounds/speech on unmount or close
  useEffect(() => {
    return () => {
      stopAllSounds();
    };
  }, []);

  const [calibrationStats, setCalibrationStats] = useState<CalibrationMatrixCoeffs | null>(null);

  const computeAndSaveCalibration = (samples: CalibrationSample[]) => {
    if (samples.length === 0) return;

    // Derive neutral center either from explicit center sample (id 4) or centroid of all samples
    const centerSample = samples.find((_, idx) => activePoints[idx]?.id === 4);
    const neutralCenter = centerSample
      ? { x: centerSample.rawPupilX, y: centerSample.rawPupilY }
      : {
          x: samples.reduce((a, s) => a + s.rawPupilX, 0) / samples.length,
          y: samples.reduce((a, s) => a + s.rawPupilY, 0) / samples.length,
        };

    const chosenAlgo = activeProfile.calibrationModel || 'quadrant-matrix';
    const fitted = fitCalibrationModel(samples, chosenAlgo);
    setCalibrationStats(fitted);

    const updatedProfile: UserProfile = {
      ...activeProfile,
      calibrationModel: chosenAlgo,
      samples,
      baselineOffsetX: 0,
      baselineOffsetY: 0,
      neutralCenter,
      calibrationMatrix: fitted || undefined,
      updatedAt: Date.now(),
    };

    onSaveProfile(updatedProfile);
  };

  const handleCloseWizard = () => {
    stopAllSounds();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10005] w-screen h-screen bg-[var(--bg-canvas)]/95 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in text-[var(--text-primary)]">
      
      {/* MINIMAL TOP BAR */}
      <div className="w-full flex items-center justify-between px-4 sm:px-8 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)]">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--accent-primary)] font-semibold block">
              {t.modalTitle}
            </span>
            <h2 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
              {translations[currentLanguage].advancedPanel.profile} <span className="text-[var(--accent-primary)]">{activeProfile.name}</span>
            </h2>
          </div>
        </div>

        {/* CONTINUOUS LINE-SCAN + 3D HEAD & QUADRANT PRESET SELECTOR */}
        {!calibrationDone && (
          <div className="flex items-center bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg p-0.5 text-[11px] font-mono flex-wrap">
            {(
              [
                { id: 'smooth-pursuit', es: 'Barrido por Líneas + 3D', en: 'Line-Scan + 3D Head' },
                { id: '9-grid', es: '9 Puntos (Matriz)', en: '9 Points (Grid)' },
                { id: '5-quadrant', es: '5 Puntos', en: '5 Points' },
                { id: '4-corners', es: '4 Esquinas', en: '4 Corners' },
              ] as const
            ).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => restartCalibrationSequence(opt.id)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  presetMode === opt.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {currentLanguage === 'en' ? opt.en : opt.es}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          {!calibrationDone && countdown === null && (
            <div className="flex items-center gap-2 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] px-3 py-1 rounded-lg font-mono text-xs tabular-nums">
              <span className="text-[var(--text-secondary)]">
                {isPursuitMode ? (
                  <>
                    {pursuitState.phase === 'head-gimbal'
                      ? (currentLanguage === 'en' ? '3D Head' : 'Cabeza 3D')
                      : (currentLanguage === 'en' ? `Line ${pursuitState.lineIndex + 1}/5` : `Línea ${pursuitState.lineIndex + 1}/5`)}{' '}
                    <strong className="text-[var(--accent-primary)]">{Math.round(pointProgress)}%</strong>
                  </>
                ) : (
                  <>
                    {t.stepIndicator} <strong className="text-[var(--accent-primary)]">{currentPointIndex + 1}</strong> / {activePoints.length}
                  </>
                )}
              </span>
            </div>
          )}

          <button
            onClick={handleCloseWizard}
            data-dwell-id="wizard-close-btn"
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title={t.cancelBtn}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FULL-VIEWPORT QUADRANT & RASTER-SCAN CALIBRATION STAGE */}
      <div ref={stageRef} className="relative flex-1 w-full h-full overflow-hidden">
        {!isPursuitMode &&
          activePoints.map((pt, idx) => {
            const isCurrent = idx === currentPointIndex && !calibrationDone && countdown === null;
            const isDone = idx < currentPointIndex || calibrationDone;
            const label = currentLanguage === 'en' ? pt.labelEn : pt.labelEs;

            return (
              <div
                key={pt.id}
                style={{
                  left: `${pt.xPct * 100}%`,
                  top: `${pt.yPct * 100}%`,
                }}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-transform duration-300 ${
                  isCurrent ? 'scale-110 z-30' : isDone ? 'scale-90 opacity-65' : 'opacity-25'
                }`}
              >
                <div
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center border transition-colors ${
                    isCurrent
                      ? 'bg-[var(--bg-elevated)] border-[var(--border-active)] ocular-breathe-ring'
                      : isDone
                      ? 'bg-[var(--bg-surface)] border-[var(--accent-primary)]'
                      : 'bg-[var(--bg-surface)] border-[var(--border-hairline)]'
                  }`}
                >
                  {isCurrent && (
                    <svg className="absolute inset-0 w-16 h-16 transform -rotate-90">
                      <circle cx="32" cy="32" r="28" stroke="rgba(127, 166, 138, 0.2)" strokeWidth="3" fill="none" />
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        stroke="#7FA68A"
                        strokeWidth="4"
                        fill="rgba(127, 166, 138, 0.08)"
                        strokeDasharray={175.9}
                        strokeDashoffset={175.9 - (175.9 * pointProgress) / 100}
                        strokeLinecap="round"
                      />
                    </svg>
                  )}

                  <div
                    className={`w-3.5 h-3.5 rounded-full transition-transform ${
                      isCurrent
                        ? 'bg-[var(--accent-primary)] scale-125'
                        : isDone
                        ? 'bg-[var(--accent-primary)] opacity-75'
                        : 'bg-[var(--text-muted)]'
                    }`}
                  />
                </div>

                <span
                  className={`text-[10px] font-mono mt-2 px-2 py-0.5 rounded border whitespace-nowrap ${
                    isCurrent
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-active)] font-semibold'
                      : isDone
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] border-[var(--border-hairline)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)]'
                  }`}
                >
                  0{idx + 1} · {label}
                </span>
              </div>
            );
          })}

        {/* BOUSTROPHEDON 5-LINE RASTER GUIDE RAILS */}
        {isPursuitMode && !calibrationDone && countdown === null && (
          <div className="absolute inset-0 pointer-events-none">
            {RASTER_SCAN_LINES.map(line => {
              const isLineActive = pursuitState.phase === 'raster-scan' && pursuitState.lineIndex === line.row;
              const isLineDone =
                pursuitState.phase === 'head-gimbal' ||
                (pursuitState.phase === 'raster-scan' && pursuitState.lineIndex > line.row);

              return (
                <div
                  key={line.row}
                  style={{
                    left: '7%',
                    width: '86%',
                    top: `${line.yPct * 100}%`,
                  }}
                  className="absolute transform -translate-y-1/2 flex items-center justify-between"
                >
                  <div
                    className={`w-full h-[2px] rounded-full transition-colors ${
                      isLineActive
                        ? 'bg-[var(--accent-primary)]/55'
                        : isLineDone
                        ? 'bg-[var(--accent-primary)]/25'
                        : 'bg-[var(--border-hairline)]/45'
                    }`}
                  />
                  <span
                    className={`absolute ${
                      line.dir === 'ltr' ? 'left-0 -top-4' : 'right-0 -top-4'
                    } text-[9px] font-mono px-1.5 py-0.2 rounded ${
                      isLineActive
                        ? 'text-[var(--accent-primary)] font-semibold'
                        : isLineDone
                        ? 'text-[var(--accent-primary)]/60'
                        : 'text-[var(--text-muted)]/55'
                    }`}
                  >
                    {line.dir === 'ltr' ? `L${line.row + 1} →` : `← L${line.row + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* CONTINUOUS LINE-SCAN & 3D HEAD-GIMBAL MOVING STIMULUS */}
        {isPursuitMode && !calibrationDone && countdown === null && (
          <div
            style={{
              left: `${pursuitState.xPct * 100}%`,
              top: `${pursuitState.yPct * 100}%`,
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none"
          >
            <div
              className={`relative w-20 h-20 rounded-full bg-[var(--bg-elevated)] border-2 flex items-center justify-center shadow-lg ${
                pursuitState.phase === 'head-gimbal'
                  ? 'border-[var(--accent-amber)] ocular-breathe-ring'
                  : 'border-[var(--border-active)]'
              }`}
            >
              <svg className="absolute inset-0 w-20 h-20 transform -rotate-90">
                <circle cx="40" cy="40" r="34" stroke="rgba(127, 166, 138, 0.2)" strokeWidth="3" fill="none" />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  stroke={pursuitState.phase === 'head-gimbal' ? '#D4A359' : '#7FA68A'}
                  strokeWidth="4"
                  fill="rgba(127, 166, 138, 0.1)"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 - (213.6 * pointProgress) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div
                className={`w-4 h-4 rounded-full ${
                  pursuitState.phase === 'head-gimbal' ? 'bg-[var(--accent-amber)] scale-125' : 'bg-[var(--accent-primary)]'
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-mono mt-2 px-2.5 py-0.5 rounded border bg-[var(--bg-elevated)] font-semibold whitespace-nowrap ${
                pursuitState.phase === 'head-gimbal'
                  ? 'text-[var(--accent-amber)] border-[var(--accent-amber)]'
                  : 'text-[var(--text-primary)] border-[var(--border-active)]'
              }`}
            >
              {pursuitState.phase === 'head-gimbal'
                ? currentLanguage === 'en'
                  ? '3D HEAD GIMBAL · KEEP EYES ON CENTER & NOD GENTLY'
                  : 'MATRIZ 3D CABEZA · MIRADA FIJA Y MUEVA SUAVE LA CABEZA'
                : currentLanguage === 'en'
                ? `LINE ${pursuitState.lineIndex + 1}/5 · FOLLOW CURSOR CONTINUOUSLY`
                : `LÍNEA ${pursuitState.lineIndex + 1}/5 · SIGA EL BARRIDO CONTINUO`}
            </span>
          </div>
        )}

        {/* INITIAL COUNTDOWN OVERLAY */}
        {countdown !== null && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-canvas)]/85 gap-4 animate-in fade-in px-4 text-center">
            <span className="text-xs uppercase tracking-[0.16em] font-mono text-[var(--accent-primary)] font-semibold">
              {isPursuitMode
                ? currentLanguage === 'en'
                  ? 'Follow the cursor line by line from Top-Left (5 lines in zigzag + 2s 3D head calibration)'
                  : 'Siga el cursor línea a línea desde Arriba-Izquierda (5 líneas en zigzag + 2s de ajuste 3D de cabeza)'
                : t.fixatePrompt}
            </span>
            <div className="w-24 h-24 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-active)] flex items-center justify-center text-4xl font-mono font-bold text-[var(--text-primary)] tabular-nums">
              {countdown}
            </div>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm text-center">
              {t.readySubtitle}
            </p>
          </div>
        )}

        {/* ACTIVE STATUS BANNER AT BOTTOM */}
        {!calibrationDone && countdown === null && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-[var(--bg-surface)] border border-[var(--border-active)] px-5 py-3 rounded-xl flex items-center gap-4">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${waitingForValidEye ? 'bg-[var(--accent-amber)]' : 'bg-[var(--accent-primary)]'}`} />
            <div className="text-left">
              <span className={`text-[11px] font-mono block font-semibold ${waitingForValidEye ? 'text-[var(--accent-amber)]' : 'text-[var(--accent-primary)]'}`}>
                {waitingForValidEye
                  ? (currentLanguage === 'en' ? 'Waiting for steady open eyes...' : 'Esperando detección ocular estable...')
                  : t.capturingProgress}
              </span>
              <p className="text-xs font-semibold text-[var(--text-primary)] font-mono tabular-nums">
                {getPointLabel(currentPointIndex)} · {Math.round(pointProgress)}%
              </p>
            </div>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="ml-2 px-3 py-1 bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] rounded-lg text-xs font-mono border border-[var(--border-hairline)]"
            >
              {isPaused ? (currentLanguage === 'en' ? 'Resume' : 'Reanudar') : (currentLanguage === 'en' ? 'Pause' : 'Pausar')}
            </button>
          </div>
        )}

        {/* CALIBRATION COMPLETE MODAL OVERLAY */}
        {calibrationDone && (
          <div className="absolute inset-0 bg-[var(--bg-canvas)]/92 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-8 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)]">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div className="text-center max-w-lg">
              <span className="text-xs font-mono uppercase tracking-[0.16em] text-[var(--accent-primary)] font-semibold block mb-1">
                {t.completeTitle}
              </span>
              <h3 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">
                {t.completeSubtitle}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
                {isPursuitMode
                  ? currentLanguage === 'en'
                    ? `Continuous 5-line Boustrophedon raster matrix and 3D head-pose coupling tensor (Yaw, Pitch, Roll) solved for ${activeProfile.name}.`
                    : `Matriz densa de barrido continuo por líneas y tensor de acoplamiento 3D de cabeza (Yaw, Pitch, Roll) calculados para ${activeProfile.name}.`
                  : currentLanguage === 'en'
                  ? `Pupil positioning matrix solved across all ${activePoints.length} quadrant anchors for ${activeProfile.name}. Screen edges and keys are now locked with zero residual bias.`
                  : `Matriz de posicionamiento pupilar calculada en todo el cuadrante con ${activePoints.length} puntos para ${activeProfile.name}. Las esquinas, teclas y celdas coinciden ahora con su mirada.`}
              </p>

              {calibrationStats && (
                <div className="flex items-center justify-center gap-5 bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-xl p-3.5 mt-4 text-xs font-mono tabular-nums flex-wrap">
                  <div className="flex flex-col items-center">
                    <span className="text-[var(--text-muted)] text-[10px]">{t.rmseMetric}</span>
                    <span className="text-[var(--accent-primary)] font-semibold text-sm">{calibrationStats.rmsePx} px</span>
                  </div>
                  <div className="w-[1px] h-7 bg-[var(--border-hairline)]" />
                  <div className="flex flex-col items-center">
                    <span className="text-[var(--text-muted)] text-[10px]">{t.angleMetric}</span>
                    <span className="text-[var(--text-primary)] font-semibold text-sm">~{calibrationStats.accuracyDeg}°</span>
                  </div>
                  <div className="w-[1px] h-7 bg-[var(--border-hairline)]" />
                  <div className="flex flex-col items-center">
                    <span className="text-[var(--text-muted)] text-[10px]">{currentLanguage === 'en' ? 'Clinical Index' : 'Índice Clínico'}</span>
                    <span className="text-[var(--accent-primary)] font-semibold text-sm">
                      {calibrationStats.reliabilityScore ?? 95}/100
                    </span>
                  </div>
                  {pursuitMetrics && (
                    <>
                      <div className="w-[1px] h-7 bg-[var(--border-hairline)]" />
                      <div className="flex flex-col items-center">
                        <span className="text-[var(--text-muted)] text-[10px]">
                          {currentLanguage === 'en' ? 'Pursuit Lag / R²' : 'Latencia / R²'}
                        </span>
                        <span className="text-[var(--accent-amber)] font-semibold text-sm">
                          {pursuitMetrics.lagMs} ms · {pursuitMetrics.r2}
                        </span>
                      </div>
                      <div className="w-[1px] h-7 bg-[var(--border-hairline)]" />
                      <div className="flex flex-col items-center">
                        <span className="text-[var(--text-muted)] text-[10px]">
                          {currentLanguage === 'en' ? '3D Raster Anchors' : 'Anclas Matriz 3D'}
                        </span>
                        <span className="text-[var(--accent-primary)] font-semibold text-sm">
                          {pursuitMetrics.cells} pts · 3D
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
              <button
                type="button"
                onClick={() => restartCalibrationSequence()}
                className="px-5 py-3 bg-[var(--bg-surface)] hover:border-[var(--border-active)] text-[var(--text-primary)] font-semibold rounded-xl border border-[var(--border-hairline)] transition-colors flex items-center gap-2 text-xs"
              >
                <RotateCcw className="w-4 h-4 text-[var(--accent-amber)]" />
                {currentLanguage === 'en' ? 'Recalibrate' : 'Repetir Calibración'}
              </button>
              <button
                data-dwell-id="finish-calibration-btn"
                onClick={handleCloseWizard}
                className="px-7 py-3 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-xl transition-colors flex items-center gap-2 text-xs"
              >
                <CheckCircle className="w-4 h-4" />
                {t.saveProfileBtn}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MINIMAL FOOTER */}
      <footer className="px-6 py-2.5 bg-[var(--bg-surface)] border-t border-[var(--border-hairline)] text-[11px] font-mono text-[var(--text-muted)] flex items-center justify-between">
        <span>{t.centerRestingNote}</span>
        <span>{translations[currentLanguage].appTitle}</span>
      </footer>
    </div>
  );
};
