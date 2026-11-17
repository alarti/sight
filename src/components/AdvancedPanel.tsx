/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { RefObject } from 'react';
import { User, Plus, Target, Focus, Download, Upload, Camera, FileText, Mic, ScanEye } from 'lucide-react';
import { UserProfile, EyeTrackingData, CalibrationAlgorithm, CursorControlMode } from '../types/index.ts';
import { Language, translations } from '../i18n/translations.ts';

interface AdvancedPanelProps {
  isOpen: boolean;
  profiles: UserProfile[];
  activeProfileId: string;
  setActiveProfileId: (id: string) => void;
  activeProfile: UserProfile;
  onCreateNewProfile: () => void;
  sensitivityX: number;
  sensitivityY: number;
  onSensitivityXChange: (val: number) => void;
  onSensitivityYChange: (val: number) => void;
  invertY: boolean;
  onToggleInvertY: () => void;
  dwellTimeMs: number;
  setDwellTimeMs: (val: number) => void;
  isAdaptiveDwellEnabled: boolean;
  setIsAdaptiveDwellEnabled: (val: boolean | ((prev: boolean) => boolean)) => void;
  onLaunchGridWizard: () => void;
  onCenterCalibration: () => void;
  onExportBackup: () => void;
  onRestoreBackupClick: () => void;
  cameraActive: boolean;
  onStartCamera: () => void;
  onStopCamera: () => void;
  debugCanvasRef: RefObject<HTMLCanvasElement | null>;
  trackingInfo: EyeTrackingData | null;
  calibrationModel?: CalibrationAlgorithm;
  onCalibrationModelChange?: (model: CalibrationAlgorithm) => void;
  cursorControlMode?: CursorControlMode;
  onCursorControlModeChange?: (mode: CursorControlMode) => void;
  sensorFusionEnabled?: boolean;
  onToggleSensorFusion?: () => void;
  ivtStabilizationEnabled?: boolean;
  onToggleIvtStabilization?: () => void;
  verticalGainMultiplier?: number;
  onVerticalGainChange?: (gain: number) => void;
  onOpenPaperModal?: () => void;
  onOpenVoiceCloningModal?: () => void;
  currentLanguage?: Language;
}

export const AdvancedPanel: React.FC<AdvancedPanelProps> = ({
  isOpen,
  profiles,
  activeProfileId,
  setActiveProfileId,
  activeProfile,
  onCreateNewProfile,
  sensitivityX,
  sensitivityY,
  onSensitivityXChange,
  onSensitivityYChange,
  invertY,
  onToggleInvertY,
  dwellTimeMs,
  setDwellTimeMs,
  isAdaptiveDwellEnabled,
  setIsAdaptiveDwellEnabled,
  onLaunchGridWizard,
  onCenterCalibration,
  onExportBackup,
  onRestoreBackupClick,
  cameraActive,
  onStartCamera,
  onStopCamera,
  debugCanvasRef,
  trackingInfo,
  calibrationModel = 'quadrant-matrix',
  onCalibrationModelChange,
  cursorControlMode = 'bayesian-lock',
  onCursorControlModeChange,
  sensorFusionEnabled = true,
  onToggleSensorFusion,
  ivtStabilizationEnabled = true,
  onToggleIvtStabilization,
  verticalGainMultiplier = 1.15,
  onVerticalGainChange,
  onOpenPaperModal,
  onOpenVoiceCloningModal,
  currentLanguage = 'es',
}) => {
  if (!isOpen) return null;

  const t = translations[currentLanguage].advancedPanel;

  return (
    <div className="bg-[var(--bg-surface)] border-b border-[var(--border-hairline)] px-4 sm:px-6 py-4 flex flex-col gap-3.5 text-xs font-mono text-[var(--text-secondary)] z-40 transition-colors">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* PROFILE SELECTOR */}
          <div className="flex items-center gap-2 bg-[var(--bg-canvas)] px-3 py-1.5 rounded-lg border border-[var(--border-hairline)]">
            <User className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t.profile}</span>
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold border border-[var(--border-hairline)] rounded px-2 py-0.5 text-xs outline-none"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.samples.length} {t.samplesRecorded})
                </option>
              ))}
            </select>
            <button
              onClick={onCreateNewProfile}
              className="p-1 hover:bg-[var(--bg-elevated)] rounded text-[var(--accent-primary)]"
              title={t.createNewProfile}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* DUAL SENSITIVITY CONTROLS: INDEPENDENT X & Y AXES */}
          <div className="flex items-center gap-3 bg-[var(--bg-canvas)] px-3.5 py-1.5 rounded-lg border border-[var(--border-hairline)] tabular-nums">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-primary)] font-semibold">{t.axisX}</span>
              <input
                type="range"
                min="3.0"
                max="30.0"
                step="0.5"
                value={sensitivityX}
                onChange={(e) => onSensitivityXChange(Number(e.target.value))}
                className="accent-[var(--accent-primary)] cursor-pointer w-20"
                title={`${t.axisX} (${sensitivityX.toFixed(1)}x)`}
              />
              <strong className="text-[var(--accent-primary)] w-10 text-right">{sensitivityX.toFixed(1)}x</strong>
            </div>

            <div className="w-[1px] h-4 bg-[var(--border-hairline)]" />

            <div className="flex items-center gap-1.5">
              <span className="text-[var(--text-primary)] font-semibold">{t.axisY}</span>
              <input
                type="range"
                min="3.0"
                max="45.0"
                step="0.5"
                value={sensitivityY}
                onChange={(e) => onSensitivityYChange(Number(e.target.value))}
                className="accent-[var(--accent-primary)] cursor-pointer w-20"
                title={`${t.axisY} (${sensitivityY.toFixed(1)}x)`}
              />
              <strong className="text-[var(--accent-primary)] w-10 text-right">{sensitivityY.toFixed(1)}x</strong>
            </div>
          </div>

          {/* Y-AXIS POLARITY CONTROLLER (NORMAL / INVERTED) */}
          <div className="flex items-center gap-2 bg-[var(--bg-canvas)] px-3 py-1.5 rounded-lg border border-[var(--border-hairline)]">
            <span className="text-[var(--text-secondary)]">{t.polarityY}</span>
            <button
              onClick={onToggleInvertY}
              className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors border ${
                invertY
                  ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)]'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-hairline)]'
              }`}
              title="Toggle Y polarity"
            >
              {invertY ? t.axisYInverted : t.axisYNormal}
            </button>
          </div>

          <button
            data-dwell-id="btn-grid-wizard"
            onClick={onLaunchGridWizard}
            className="px-3 py-1.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] rounded-lg flex items-center gap-1.5 font-sans font-semibold"
          >
            <Target className="w-3.5 h-3.5" />
            {t.trainGrid}
          </button>

          <button
            data-dwell-id="btn-center-calib"
            onClick={onCenterCalibration}
            className="px-3 py-1.5 bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] rounded-lg flex items-center gap-1.5 font-sans font-medium border border-[var(--border-hairline)]"
          >
            <Focus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            {t.calibrateCenter}
          </button>

          <div className="flex items-center gap-2.5 bg-[var(--bg-canvas)] px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] tabular-nums">
            <span className="text-[var(--text-primary)] font-semibold">{t.dwellDelay}</span>
            <input
              type="range"
              min="500"
              max="2200"
              step="100"
              value={dwellTimeMs}
              onChange={(e) => setDwellTimeMs(Number(e.target.value))}
              className="accent-[var(--accent-primary)] cursor-pointer w-20"
              title="Dwell delay"
            />
            <strong className="text-[var(--accent-primary)] w-11 text-right">{(dwellTimeMs / 1000).toFixed(1)}s</strong>
            <button
              onClick={() => setIsAdaptiveDwellEnabled((prev) => !prev)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                isAdaptiveDwellEnabled
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)]'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-muted)] border-[var(--border-hairline)]'
              }`}
              title="Adaptive dwell"
            >
              {isAdaptiveDwellEnabled ? t.adaptive : t.fixed}
            </button>
          </div>
        </div>

        {/* BACKUP / RESTORE / CAMERA / PAPER */}
        <div className="flex items-center gap-2 flex-wrap">
          {onOpenVoiceCloningModal && (
            <button
              onClick={onOpenVoiceCloningModal}
              className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-lg text-xs flex items-center gap-1.5 border border-[var(--border-hairline)] hover:border-[var(--border-active)] font-medium"
              title={translations[currentLanguage].header.voiceCloningTitle}
            >
              <Mic className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              {translations[currentLanguage].voiceCloning.title}
            </button>
          )}
          {onOpenPaperModal && (
            <button
              onClick={onOpenPaperModal}
              className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-lg text-xs flex items-center gap-1.5 border border-[var(--border-hairline)] hover:border-[var(--border-active)] font-medium"
              title="LaTeX / PDF Scientific Paper"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              Paper (.tex / .pdf)
            </button>
          )}
          <button
            onClick={onExportBackup}
            className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs flex items-center gap-1.5 border border-[var(--border-hairline)]"
          >
            <Download className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            {t.backupJSON}
          </button>
          <button
            onClick={onRestoreBackupClick}
            className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg text-xs flex items-center gap-1.5 border border-[var(--border-hairline)]"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            {t.restoreJSON}
          </button>

          {cameraActive ? (
            <button
              onClick={onStopCamera}
              className="px-3 py-1.5 bg-[var(--bg-elevated)] text-[var(--accent-urgent)] border border-[var(--border-hairline)] rounded-lg text-xs font-semibold"
            >
              {t.stopCamera}
            </button>
          ) : (
            <button
              onClick={onStartCamera}
              className="px-3.5 py-1.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-lg text-xs flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" /> {t.startCamera}
            </button>
          )}
        </div>
      </div>

      {/* SCIENTIFIC OCULAR CONTROLS (TPS / HOMOGRAPHY / I-VT SACCADE-FIXATION / ASYMMETRIC GAIN) */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-[var(--bg-canvas)] p-3 rounded-xl border border-[var(--border-hairline)]">
        <div className="flex items-center gap-3 flex-wrap">
          {/* CALIBRATION ALGORITHM SELECTOR */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--text-primary)] font-semibold">{t.calibrationAlgorithmLabel}</span>
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg p-0.5 flex-wrap gap-0.5">
              <button
                type="button"
                onClick={() => onCalibrationModelChange?.('quadrant-matrix')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  (calibrationModel || 'quadrant-matrix') === 'quadrant-matrix'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.modelQuadrantMatrix}
              </button>
              <button
                type="button"
                onClick={() => onCalibrationModelChange?.('tps')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  calibrationModel === 'tps'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.modelTps}
              </button>
              <button
                type="button"
                onClick={() => onCalibrationModelChange?.('polynomial')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  calibrationModel === 'polynomial'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.modelPolynomial}
              </button>
              <button
                type="button"
                onClick={() => onCalibrationModelChange?.('projective')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  calibrationModel === 'projective'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t.modelProjective}
              </button>
            </div>
          </div>

          {/* I-VT FIXATION VS SACCADE STABILIZER */}
          <button
            type="button"
            onClick={onToggleIvtStabilization}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
              ivtStabilizationEnabled
                ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${ivtStabilizationEnabled ? 'bg-[var(--accent-primary)]' : 'bg-[var(--text-muted)]'}`} />
            {ivtStabilizationEnabled ? t.ivtActive : t.ivtInactive}
          </button>

          {/* ASYMMETRIC VERTICAL GAIN SLIDER */}
          <div className="flex items-center gap-2 bg-[var(--bg-surface)] px-3 py-1.5 rounded-lg border border-[var(--border-hairline)] tabular-nums">
            <span className="text-[var(--text-primary)] font-semibold">{t.verticalGainLabel}</span>
            <input
              type="range"
              min="0.6"
              max="2.5"
              step="0.05"
              value={verticalGainMultiplier || 1.15}
              onChange={(e) => onVerticalGainChange?.(Number(e.target.value))}
              className="accent-[var(--accent-amber)] cursor-pointer w-20"
            />
            <strong className="text-[var(--accent-amber)] w-10 text-right">{(verticalGainMultiplier || 1.15).toFixed(2)}x</strong>
          </div>
        </div>

        {/* 1-CLICK INSTANT RECENTER BUTTON */}
        <button
          type="button"
          data-dwell-id="btn-fast-center-calib"
          onClick={onCenterCalibration}
          className="px-3.5 py-1.5 bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] rounded-lg text-xs flex items-center gap-1.5 font-semibold transition-colors"
        >
          <Focus className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          {t.calibrateCenter}
        </button>
      </div>

      {/* NEXT-GEN CURSOR POSITIONING PARADIGMS & 3D PHOTOMETRIC SENSOR FUSION */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-[var(--bg-canvas)] p-3 rounded-xl border border-[var(--border-hairline)]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[var(--text-primary)] font-semibold">{t.cursorModeLabel}</span>
          <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg p-0.5 flex-wrap gap-0.5">
            {(
              [
                { id: 'bayesian-lock', label: t.cursorBayesianLock },
                { id: 'ocular-trackball', label: t.cursorOcularTrackball },
                { id: 'two-stage-loupe', label: t.cursorTwoStageLoupe },
                { id: 'direct-matrix', label: t.cursorDirectMatrix },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onCursorControlModeChange?.(opt.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  cursorControlMode === opt.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleSensorFusion}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
            sensorFusionEnabled
              ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)]'
              : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-hairline)]'
          }`}
        >
          <ScanEye className="w-3.5 h-3.5" />
          <span>{t.sensorFusionLabel} {sensorFusionEnabled ? t.sensorFusionActive : t.sensorFusionBasic}</span>
        </button>
      </div>

      {/* CAMERA DEBUG HUD IN ADVANCED PANEL */}
      {cameraActive && (
        <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl flex items-center gap-4 max-w-2xl">
          <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-[var(--border-active)] bg-black shrink-0">
            <canvas ref={debugCanvasRef} width={128} height={96} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-1 text-[11px]">
            <span className="font-semibold text-[var(--text-primary)]">
              {t.mediapipeModel} · {activeProfile.name}
            </span>
            <p className="text-[var(--text-muted)] leading-tight">{t.browserNote}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap tabular-nums text-[var(--text-secondary)]">
              <span>
                {t.aiActive} {activeProfile.samples.length} {t.samplesRecorded}
              </span>
              <span>·</span>
              <span>
                {t.headTurn} Yaw {trackingInfo?.headPose?.yawDeg ?? 0}° / Pitch {trackingInfo?.headPose?.pitchDeg ?? 0}°
              </span>
              <span>·</span>
              <span>
                {trackingInfo?.isSquinting ? t.forcedClick : `${t.squintScore} ${(trackingInfo?.squintScore || 0).toFixed(2)}`}
              </span>
              {trackingInfo?.sensorMetrics?.fusionActive && (
                <>
                  <span>·</span>
                  <span className="text-[var(--accent-primary)]">
                    3D({trackingInfo.sensorMetrics.ray3DX.toFixed(2)},{trackingInfo.sensorMetrics.ray3DY.toFixed(2)})
                    {trackingInfo.sensorMetrics.photometricActive ? ' · PhotoROI' : ''}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-hairline)] text-[11px] text-[var(--text-muted)] tabular-nums">
        <span>{t.recalibrationNote}</span>
        <span>
          {t.eyeVelocity} {trackingInfo?.eyeVelocity || 0} px/s · {t.serverlessMode}
        </span>
      </div>
    </div>
  );
};
