/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { CalibrationSample, EyeTrackingData, HeadPoseData, CalibrationAlgorithm, CalibrationMatrixSnapshot } from "./types/index.ts";
import { estimateHeadPose, applyHeadPoseCompensation, analyzeSubpixelEyeGeometry } from "./utils/headPose.ts";
import { 
  fitCalibrationModel,
  evaluateCalibratedGaze, 
  CalibrationMatrixCoeffs 
} from "./utils/calibration.ts";
import {
  extractBlendshapeGaze,
  solve3DEyeballVisualAxisRay,
  sampleEyeRoiPhotometricCentroid,
  fuseGazeChannels,
} from "./utils/eyeSensorFusion.ts";

export type { CalibrationSample, EyeTrackingData, HeadPoseData, CalibrationAlgorithm };

/**
 * [Paper Section 6.3: Temporal Smoothing: 1€ Filter]
 * Casiez et al. (2012) speed-based adaptive low-pass filter.
 * Dynamically computes cutoff frequency fc = fc_min + beta * |dx/dt|
 * to eliminate resting micro-tremor while avoiding saccadic phase lag.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev: number = 0;
  private tPrev: number | null = null;

  constructor(minCutoff = 0.42, beta = 0.015, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  public filter(x: number, timestamp: number): { value: number; velocity: number } {
    if (this.tPrev === null) {
      this.tPrev = timestamp;
      this.xPrev = x;
      this.dxPrev = 0;
      return { value: x, velocity: 0 };
    }

    const dt = Math.max((timestamp - this.tPrev) / 1000.0, 1e-4);
    this.tPrev = timestamp;

    const dx = (x - (this.xPrev ?? x)) / dt;
    const aD = 1.0 / (1.0 + 1.0 / (2 * Math.PI * this.dCutoff * dt));
    const edx = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const a = 1.0 / (1.0 + 1.0 / (2 * Math.PI * cutoff * dt));
    const xFiltered = a * x + (1 - a) * (this.xPrev ?? x);
    this.xPrev = xFiltered;

    return { value: xFiltered, velocity: Math.abs(edx) };
  }

  public reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}

/**
 * 2D Constant-Velocity State-Space Kalman Filter with Saccadic Innovation Gate:
 * Tracks [x, y, vx, vy]^T and adapts measurement noise R_k based on Mahalanobis innovation
 * so resting fixations achieve sub-pixel stability while voluntary saccades incur zero lag.
 */
export class KalmanGazeFilter {
  private x = 0;
  private y = 0;
  private vx = 0;
  private vy = 0;
  private pPos = 10.0;
  private pVel = 10.0;
  private lastT: number | null = null;

  public update(measX: number, measY: number, timestampMs: number): { x: number; y: number } {
    if (this.lastT === null) {
      this.x = measX;
      this.y = measY;
      this.vx = 0;
      this.vy = 0;
      this.lastT = timestampMs;
      return { x: measX, y: measY };
    }

    const dt = Math.min(0.1, Math.max(0.001, (timestampMs - this.lastT) / 1000.0));
    this.lastT = timestampMs;

    // 1. State Prediction
    const predX = this.x + this.vx * dt;
    const predY = this.y + this.vy * dt;
    const qPos = 2.4;
    const qVel = 14.0;
    this.pPos += this.pVel * dt * dt + qPos;
    this.pVel += qVel * dt;

    // 2. Innovation & Mahalanobis Saccadic Gate
    const innovX = measX - predX;
    const innovY = measY - predY;
    const innovDist = Math.hypot(innovX, innovY);

    // Adaptive measurement noise R: calm fixation damping (< 16px), smooth pursuit (16-48px), near-zero lag saccade (> 48px)
    const rMeas = innovDist > 48 ? 0.25 : innovDist > 16 ? 2.2 : 10.0;

    const kPos = this.pPos / (this.pPos + rMeas);
    const kVel = (this.pVel * dt) / (this.pPos + rMeas);

    this.x = predX + kPos * innovX;
    this.y = predY + kPos * innovY;
    const velDamping = innovDist <= 16 ? 0.45 : 0.75;
    this.vx = (this.vx + kVel * (innovX / dt)) * velDamping;
    this.vy = (this.vy + kVel * (innovY / dt)) * velDamping;

    this.pPos *= (1.0 - kPos);
    this.pVel *= (1.0 - Math.min(0.9, kVel * dt));

    return { x: this.x, y: this.y };
  }

  public reset() {
    this.lastT = null;
    this.vx = 0;
    this.vy = 0;
    this.pPos = 10.0;
    this.pVel = 10.0;
  }
}

export class BrowserAIEyeTracker {
  private video: HTMLVideoElement;
  private faceLandmarker: FaceLandmarker | null = null;
  private isInitialized = false;

  // Pre-mapping 1€ filters in normalized [0, 1] pupil space:
  // Tuned for fast diagonal saccades across corners while filtering resting micro-tremor
  private rawPupilFilterX = new OneEuroFilter(1.4, 26.0, 1.0);
  private rawPupilFilterY = new OneEuroFilter(1.4, 26.0, 1.0);

  private kalmanFilter = new KalmanGazeFilter();
  private filterX = new OneEuroFilter(0.95, 0.025, 1.0);
  private filterY = new OneEuroFilter(0.95, 0.025, 1.0);

  private sensitivityX = 14.0;
  private sensitivityY = 14.0;
  private invertY = false;
  public baselineOffsetX = 0;
  public baselineOffsetY = 0;
  private calibrationCoeffs: CalibrationMatrixCoeffs | null = null;

  private calibrationSamples: CalibrationSample[] = [];
  private lastFittedSignature = '';
  private lastSmoothX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
  private lastSmoothY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;

  // Modern Eye-Tracking parameters from latest scientific literature
  private calibrationAlgorithm: CalibrationAlgorithm = 'quadrant-matrix'; // Default to M-QPM Whitened Quadrant Matrix + Exact TPS
  private ivtStabilizationEnabled = true; // Identification by Dispersion & Velocity Threshold Fixation Stabilizer
  private verticalGainMultiplier = 1.15; // Balanced vertical multiplier preventing downward overdrive
  private fixationAnchorX: number | null = null;
  private fixationAnchorY: number | null = null;
  private recentGazeWindow: Array<{ x: number; y: number }> = [];

  private squintStartTime: number | null = null;
  private lastSquintTriggerTime = 0;
  private lastTimestampMs = -1;

  // Medical-device signal quality & artifact suppression state
  private neutralX = 0.5;
  private neutralY = 0.5;
  private baselineAperture = 0.24;
  private blinkRecoveryUntil = 0;
  private lastCleanRawX = 0.5;
  private lastCleanRawY = 0.5;
  private hasCleanSample = false;
  private pendingSpikeX: number | null = null;
  private pendingSpikeY: number | null = null;
  private pendingSpikeFrames = 0;
  private sensorFusionEnabled = true;
  private roiCanvas: HTMLCanvasElement | null = null;

  constructor(video: HTMLVideoElement) {
    this.video = video;
    if (typeof document !== 'undefined') {
      this.roiCanvas = document.createElement('canvas');
    }
    this.initModel();
  }

  private async initModel() {
    try {
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm"
      );
      try {
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      } catch (gpuErr) {
        console.info("GPU delegate unavailable or throttled, using CPU delegate:", gpuErr);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "CPU"
          },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1
        });
      }
      this.isInitialized = true;
    } catch (e) {
      console.warn("Could not load MediaPipe FaceLandmarker:", e);
    }
  }

  public setSensitivity(sx: number, sy: number) {
    this.sensitivityX = sx;
    this.sensitivityY = sy;
  }

  public setInvertY(invert: boolean) {
    this.invertY = invert;
  }

  public getInvertY(): boolean {
    return this.invertY;
  }

  public setBaselineOffsets(ox: number, oy: number) {
    this.baselineOffsetX = ox;
    this.baselineOffsetY = oy;
  }

  public setNeutralCenter(nx: number, ny: number) {
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      this.neutralX = Math.min(0.9, Math.max(0.1, nx));
      this.neutralY = Math.min(0.9, Math.max(0.1, ny));
    }
  }

  public dispose() {
    this.isInitialized = false;
    if (this.faceLandmarker) {
      try {
        this.faceLandmarker.close();
      } catch (err) {
        console.debug("Error closing FaceLandmarker:", err);
      }
      this.faceLandmarker = null;
    }
    this.roiCanvas = null;
  }

  private buildSamplesSignature(samples: CalibrationSample[], algo: CalibrationAlgorithm): string {
    if (samples.length === 0) return `0:${algo}`;
    let hash = 2166136261;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const v1 = Math.round(s.targetX * 10);
      const v2 = Math.round(s.targetY * 10);
      const v3 = Math.round(s.rawPupilX * 10000);
      const v4 = Math.round(s.rawPupilY * 10000);
      hash = Math.imul(hash ^ v1, 16777619);
      hash = Math.imul(hash ^ v2, 16777619);
      hash = Math.imul(hash ^ v3, 16777619);
      hash = Math.imul(hash ^ v4, 16777619);
    }
    return `${samples.length}:${algo}:${hash >>> 0}`;
  }

  public setCalibrationAlgorithm(algo: CalibrationAlgorithm) {
    if (this.calibrationAlgorithm === algo && this.calibrationCoeffs) return;
    this.calibrationAlgorithm = algo;
    if (this.calibrationSamples.length >= 1) {
      const sig = this.buildSamplesSignature(this.calibrationSamples, algo);
      if (sig !== this.lastFittedSignature) {
        this.calibrationCoeffs = fitCalibrationModel(this.calibrationSamples, algo);
        this.lastFittedSignature = sig;
      }
    }
  }

  public setIvtStabilization(enabled: boolean) {
    this.ivtStabilizationEnabled = enabled;
    if (!enabled) {
      this.fixationAnchorX = null;
      this.fixationAnchorY = null;
      this.recentGazeWindow = [];
    }
  }

  public setVerticalGainMultiplier(gain: number) {
    this.verticalGainMultiplier = Math.max(0.5, Math.min(3.0, gain));
  }

  public setSensorFusionEnabled(enabled: boolean) {
    this.sensorFusionEnabled = enabled;
  }

  public setCalibrationMatrix(coeffs: CalibrationMatrixCoeffs | CalibrationMatrixSnapshot | null) {
    // Prioritize fitting from the full accumulated training samples only if not already fitted for them
    if (this.calibrationSamples.length >= 1) {
      const sig = this.buildSamplesSignature(this.calibrationSamples, this.calibrationAlgorithm);
      if (sig !== this.lastFittedSignature || !this.calibrationCoeffs) {
        this.calibrationCoeffs = fitCalibrationModel(this.calibrationSamples, this.calibrationAlgorithm);
        this.lastFittedSignature = sig;
      }
      return;
    }
    if (!coeffs) {
      this.calibrationCoeffs = null;
      this.lastFittedSignature = '';
      return;
    }
    if (('quadrantMatrix' in coeffs && coeffs.quadrantMatrix) || ('tps' in coeffs && coeffs.tps)) {
      this.calibrationCoeffs = {
        ...coeffs,
        rmsePx: coeffs.rmsePx ?? 8,
        accuracyDeg: coeffs.accuracyDeg ?? 0.3,
      };
    } else if ('a' in coeffs && 'b' in coeffs) {
      this.calibrationCoeffs = {
        a: coeffs.a,
        b: coeffs.b,
        rmsePx: coeffs.rmsePx ?? 35,
        accuracyDeg: coeffs.accuracyDeg ?? 1.25,
      };
    }
  }

  public setCalibrationSamples(samples: CalibrationSample[], algo?: CalibrationAlgorithm) {
    const modelToUse = algo || this.calibrationAlgorithm;
    const sig = this.buildSamplesSignature(samples, modelToUse);
    if (sig === this.lastFittedSignature && (this.calibrationCoeffs !== null || samples.length === 0)) {
      return;
    }
    // Preserve 100% of accumulated training samples without any maximum limit
    this.calibrationSamples = [...samples];
    if (this.calibrationSamples.length >= 1) {
      this.calibrationCoeffs = fitCalibrationModel(this.calibrationSamples, modelToUse);
    } else {
      this.calibrationCoeffs = null;
    }
    this.lastFittedSignature = sig;
  }

  /**
   * Live Manual Cursor Nudge (Arrow Keys / On-Screen D-Pad):
   * Shifts the cursor aiming by (dxPx, dyPx) in screen pixels immediately and updates
   * the internal fixation anchor and filters so there is zero lag.
   */
  public nudgeAimingOffset(dxPx: number, dyPx: number): {
    offsetX: number;
    offsetY: number;
    screenX: number;
    screenY: number;
  } {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;

    // Because mappedX = pred.x - baselineOffsetX, subtracting dxPx from baselineOffsetX moves the cursor +dxPx
    this.baselineOffsetX = Math.max(-screenW * 0.85, Math.min(screenW * 0.85, this.baselineOffsetX - dxPx));
    this.baselineOffsetY = Math.max(-screenH * 0.85, Math.min(screenH * 0.85, this.baselineOffsetY - dyPx));

    const nextX = Math.min(screenW - 5, Math.max(5, this.lastSmoothX + dxPx));
    const nextY = Math.min(screenH - 5, Math.max(5, this.lastSmoothY + dyPx));

    this.lastSmoothX = nextX;
    this.lastSmoothY = nextY;
    this.fixationAnchorX = nextX;
    this.fixationAnchorY = nextY;
    this.recentGazeWindow = [{ x: nextX, y: nextY }];
    this.kalmanFilter.reset();
    this.filterX.reset();
    this.filterY.reset();

    return {
      offsetX: this.baselineOffsetX,
      offsetY: this.baselineOffsetY,
      screenX: nextX,
      screenY: nextY,
    };
  }

  /**
   * Continuous Online Supervised ML Calibration (Unlimited Samples):
   * Every single manual training press or drag-release appends a new supervised sample
   * (rawPupilX, rawPupilY, headYaw, headPitch -> desiredScreenX, desiredScreenY) to the
   * training history without any upper limit, dynamically re-fitting the precision-weighted
   * TPS + Gaussian Process RBF + Bivariate Ridge ensemble so accuracy improves monotonically.
   */
  public applyManualCalibrationPoint(
    rawGazeX: number,
    rawGazeY: number,
    desiredScreenX: number,
    desiredScreenY: number,
    headYaw = 0,
    headPitch = 0,
    headRoll = 0
  ): {
    samples: CalibrationSample[];
    matrix: CalibrationMatrixCoeffs | null;
    offsetX: number;
    offsetY: number;
  } {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const clampedTargetX = Math.min(screenW - 5, Math.max(5, desiredScreenX));
    const clampedTargetY = Math.min(screenH - 5, Math.max(5, desiredScreenY));

    const validGaze = Number.isFinite(rawGazeX) && Number.isFinite(rawGazeY);
    const gx = validGaze ? rawGazeX : 0.5;
    const gy = validGaze ? rawGazeY : 0.5;

    if (validGaze) {
      const manualSample: CalibrationSample = {
        targetX: clampedTargetX,
        targetY: clampedTargetY,
        rawPupilX: gx,
        rawPupilY: gy,
        headYaw,
        headPitch,
        headRoll,
      };

      // Append every single supervised training press with no upper cap:
      // compressToWeightedInducingCentroids in calibration.ts accumulates precisionWeight
      // and shrinks local regularization lambda / precisionWeight as samples grow!
      this.calibrationSamples.push(manualSample);
      this.calibrationCoeffs = fitCalibrationModel(this.calibrationSamples, this.calibrationAlgorithm);
      this.lastFittedSignature = this.buildSamplesSignature(this.calibrationSamples, this.calibrationAlgorithm);
    }

    // Synchronize offset cleanly: M-QPM / TPS already pass through the trained point (~0px residual),
    // so reset baselineOffset to 0 instead of shifting the rest of the action quadrant
    if (this.calibrationCoeffs) {
      const pred = evaluateCalibratedGaze(gx, gy, headYaw, headPitch, this.calibrationCoeffs, this.calibrationAlgorithm);
      if (pred) {
        const residualX = pred.x - clampedTargetX;
        const residualY = pred.y - clampedTargetY;
        if (Math.hypot(residualX, residualY) <= 6) {
          this.baselineOffsetX = 0;
          this.baselineOffsetY = 0;
        } else {
          this.baselineOffsetX = Math.max(-screenW * 0.85, Math.min(screenW * 0.85, residualX));
          this.baselineOffsetY = Math.max(-screenH * 0.85, Math.min(screenH * 0.85, residualY));
        }
      }
    } else {
      const rawDefaultX = screenW * (0.5 + (gx - this.neutralX) * this.sensitivityX);
      const rawDefaultY = screenH * (0.5 + (gy - this.neutralY) * (this.sensitivityY * 1.15));
      this.baselineOffsetX = Math.max(-screenW * 0.85, Math.min(screenW * 0.85, rawDefaultX - clampedTargetX));
      this.baselineOffsetY = Math.max(-screenH * 0.85, Math.min(screenH * 0.85, rawDefaultY - clampedTargetY));
    }

    // Lock fixation anchor & state filters directly onto the manually calibrated coordinate
    this.lastSmoothX = clampedTargetX;
    this.lastSmoothY = clampedTargetY;
    this.fixationAnchorX = clampedTargetX;
    this.fixationAnchorY = clampedTargetY;
    this.recentGazeWindow = [{ x: clampedTargetX, y: clampedTargetY }];
    this.kalmanFilter.reset();
    this.filterX.reset();
    this.filterY.reset();

    return {
      samples: [...this.calibrationSamples],
      matrix: this.calibrationCoeffs,
      offsetX: this.baselineOffsetX,
      offsetY: this.baselineOffsetY,
    };
  }

  public calibrateCenter(currentScreenX?: number, currentScreenY?: number) {
    const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const targetCenterX = screenW / 2;
    const targetCenterY = screenH / 2;

    if (!this.calibrationCoeffs && this.hasCleanSample) {
      this.neutralX = this.lastCleanRawX;
      this.neutralY = this.lastCleanRawY;
      this.baselineOffsetX = 0;
      this.baselineOffsetY = 0;
    } else if (currentScreenX !== undefined && currentScreenY !== undefined) {
      const actualX = currentScreenX <= 1.05 ? currentScreenX * screenW : currentScreenX;
      const actualY = currentScreenY <= 1.05 ? currentScreenY * screenH : currentScreenY;
      this.baselineOffsetX += (actualX - targetCenterX);
      this.baselineOffsetY += (actualY - targetCenterY);
    } else {
      this.baselineOffsetX = 0;
      this.baselineOffsetY = 0;
    }
    this.lastSmoothX = targetCenterX;
    this.lastSmoothY = targetCenterY;
    this.fixationAnchorX = targetCenterX;
    this.fixationAnchorY = targetCenterY;
    this.recentGazeWindow = [{ x: targetCenterX, y: targetCenterY }];
    this.kalmanFilter.reset();
    this.filterX.reset();
    this.filterY.reset();
  }

  public resetCalibration() {
    this.baselineOffsetX = 0;
    this.baselineOffsetY = 0;
    this.neutralX = 0.5;
    this.neutralY = 0.5;
    this.calibrationSamples = [];
    this.calibrationCoeffs = null;
    this.lastFittedSignature = '';
    this.fixationAnchorX = null;
    this.fixationAnchorY = null;
    this.recentGazeWindow = [];
    this.pendingSpikeX = null;
    this.pendingSpikeY = null;
    this.pendingSpikeFrames = 0;
    this.rawPupilFilterX.reset();
    this.rawPupilFilterY.reset();
    this.kalmanFilter.reset();
    this.filterX.reset();
    this.filterY.reset();
  }

  /**
   * Online Postural Drift Refinement (Anchor-Safe):
   * When the user already has a 9-point grid calibration, never overwrite or append noisy button-click samples
   * that would warp the spatial calibration matrix. Instead, apply a gentle bounded baseline offset nudge
   * if the click is close to the target.
   */
  public recordSuccessfulInteraction(
    rawGazeX: number,
    rawGazeY: number,
    screenTargetX: number,
    screenTargetY: number,
    headYaw = 0,
    headPitch = 0,
    headRoll = 0
  ): CalibrationSample[] {
    if (!Number.isFinite(rawGazeX) || !Number.isFinite(rawGazeY)) {
      return [...this.calibrationSamples];
    }

    if (this.calibrationCoeffs && this.calibrationSamples.length >= 2) {
      const currentPred = evaluateCalibratedGaze(
        rawGazeX,
        rawGazeY,
        headYaw,
        headPitch,
        this.calibrationCoeffs,
        this.calibrationAlgorithm
      );
      if (currentPred) {
        const predX = currentPred.x - this.baselineOffsetX;
        const predY = currentPred.y - this.baselineOffsetY;
        const errX = predX - screenTargetX;
        const errY = predY - screenTargetY;
        const errDist = Math.hypot(errX, errY);
        if (errDist > 6 && errDist < 55) {
          this.baselineOffsetX = Math.max(-28, Math.min(28, this.baselineOffsetX + errX * 0.05));
          this.baselineOffsetY = Math.max(-28, Math.min(28, this.baselineOffsetY + errY * 0.05));
        }
      }
      return [...this.calibrationSamples];
    }

    const newSample: CalibrationSample = {
      targetX: screenTargetX,
      targetY: screenTargetY,
      rawPupilX: rawGazeX,
      rawPupilY: rawGazeY,
      headYaw,
      headPitch,
      headRoll
    };

    if (this.calibrationSamples.length < 9) {
      this.calibrationSamples.push(newSample);
    }

    if (this.calibrationSamples.length >= 4) {
      this.calibrationCoeffs = fitCalibrationModel(this.calibrationSamples, this.calibrationAlgorithm);
    }
    return [...this.calibrationSamples];
  }

  /**
   * High-Precision Gaze Mapping:
   * Uses Stacked Thin-Plate Splines (TPS) + Gaussian Process RBF Kernel ML,
   * Bivariate Polynomial Ridge, or Projective Homography
   */
  private mapViaNeuralGrid(
    rawX: number,
    rawY: number,
    headYaw: number,
    headPitch: number,
    screenW: number,
    screenH: number
  ): { x: number; y: number } {
    if (this.calibrationCoeffs) {
      const pred = evaluateCalibratedGaze(rawX, rawY, headYaw, headPitch, this.calibrationCoeffs, this.calibrationAlgorithm);
      if (pred) {
        return {
          x: Math.min(screenW - 5, Math.max(5, pred.x - this.baselineOffsetX)),
          y: Math.min(screenH - 5, Math.max(5, pred.y - this.baselineOffsetY))
        };
      }
    }

    const defaultX = screenW * (0.5 + (rawX - this.neutralX) * this.sensitivityX) - this.baselineOffsetX;
    const defaultY = screenH * (0.5 + (rawY - this.neutralY) * (this.sensitivityY * 1.15)) - this.baselineOffsetY;
    return {
      x: Math.min(screenW - 5, Math.max(5, defaultX)),
      y: Math.min(screenH - 5, Math.max(5, defaultY))
    };
  }

  public async processFrame(): Promise<EyeTrackingData> {
    const now = performance.now();
    const defaultData: EyeTrackingData = {
      gazeScreenX: this.lastSmoothX,
      gazeScreenY: this.lastSmoothY,
      rawGazeX: this.lastCleanRawX,
      rawGazeY: this.lastCleanRawY,
      headPose: { yawDeg: 0, pitchDeg: 0, rollDeg: 0, normYaw: 0, normPitch: 0 },
      faceDetected: false,
      eyesDetected: false,
      pupilLeft: null,
      pupilRight: null,
      faceBox: null,
      leftEyeBox: null,
      rightEyeBox: null,
      isFixating: false,
      eyeVelocity: 0,
      isSquinting: false,
      squintScore: 0,
      isBlinking: false,
      signalQuality: 0,
    };

    if (!this.video || this.video.readyState < 2 || !this.isInitialized || !this.faceLandmarker) {
      return defaultData;
    }

    try {
      let timestampMs = performance.now();
      if (timestampMs <= this.lastTimestampMs) {
        timestampMs = this.lastTimestampMs + 1;
      }
      this.lastTimestampMs = timestampMs;

      const results = this.faceLandmarker.detectForVideo(this.video, timestampMs);
      if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
        return defaultData;
      }

      const landmarks = results.faceLandmarks[0];
      const videoW = this.video.videoWidth || 640;
      const videoH = this.video.videoHeight || 480;

      // 1. Estimate 3D Head Pose (Yaw, Pitch, Roll)
      const headPose = estimateHeadPose(landmarks);

      // 2. Sub-Pixel 5-Point Iris & Limbus Contour Analysis + 3D Spherical Eyeball Geometry
      const leftEyeGeo = analyzeSubpixelEyeGeometry(landmarks, 'left', videoW, videoH, this.verticalGainMultiplier);
      const rightEyeGeo = analyzeSubpixelEyeGeometry(landmarks, 'right', videoW, videoH, this.verticalGainMultiplier);

      const pupilL = leftEyeGeo.pupilVideoPx;
      const pupilR = rightEyeGeo.pupilVideoPx;

      const lOuter = landmarks[33];
      const rInner = landmarks[362];

      // Face bounding box calculation from landmarks
      let minX = 1, maxX = 0, minY = 1, maxY = 0;
      for (const lm of landmarks) {
        if (lm.x < minX) minX = lm.x;
        if (lm.x > maxX) maxX = lm.x;
        if (lm.y < minY) minY = lm.y;
        if (lm.y > maxY) maxY = lm.y;
      }

      const faceBox = {
        x: Math.round(minX * videoW),
        y: Math.round(minY * videoH),
        width: Math.round((maxX - minX) * videoW),
        height: Math.round((maxY - minY) * videoH),
      };

      const lBox = {
        x: Math.round(lOuter.x * videoW - 15),
        y: Math.round(lOuter.y * videoH - 15),
        width: 40,
        height: 35,
      };

      const rBox = {
        x: Math.round(rInner.x * videoW - 15),
        y: Math.round(rInner.y * videoH - 15),
        width: 40,
        height: 35,
      };

      // [Paper Section 6.4: Dual Selection Modalities: Squint-Trigger & Medical Blink Interlock]
      let isSquinting = false;
      let avgSquint = 0;
      let avgBlink = 0;
      const apertureRatio = (leftEyeGeo.apertureRatio + rightEyeGeo.apertureRatio) * 0.5;

      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const categories = results.faceBlendshapes[0].categories;
        const blinkLeft = categories.find(c => c.categoryName === 'eyeBlinkLeft')?.score || 0;
        const blinkRight = categories.find(c => c.categoryName === 'eyeBlinkRight')?.score || 0;
        avgBlink = (blinkLeft + blinkRight) / 2;

        const squintLeft = categories.find(c => c.categoryName === 'eyeSquintLeft')?.score || 0;
        const squintRight = categories.find(c => c.categoryName === 'eyeSquintRight')?.score || 0;
        avgSquint = (squintLeft + squintRight) / 2;

        // Require >= 165ms sustained voluntary squint so natural 100-140ms blinks never misfire
        const isSquintActive = (avgSquint > 0.36 || (apertureRatio < 0.16 && avgBlink > 0.24)) && avgBlink < 0.82;
        if (isSquintActive) {
          if (this.squintStartTime === null) {
            this.squintStartTime = now;
          } else {
            const squintDuration = now - this.squintStartTime;
            if (squintDuration >= 165 && now - this.lastSquintTriggerTime > 850) {
              isSquinting = true;
              this.lastSquintTriggerTime = now;
            }
          }
        } else {
          this.squintStartTime = null;
        }
      }

      // Adaptive open-eye aperture baseline so partial ptosis or downward gaze isn't misclassified as blinking
      if (avgBlink < 0.18 && apertureRatio > 0.15 && apertureRatio < 0.55) {
        this.baselineAperture = this.baselineAperture * 0.96 + apertureRatio * 0.04;
      }

      const blinkClosureThreshold = Math.max(0.068, this.baselineAperture * 0.36);
      const isCurrentlyClosed =
        avgBlink > 0.48 ||
        apertureRatio < blinkClosureThreshold ||
        (avgBlink > 0.38 && apertureRatio < this.baselineAperture * 0.48);
      if (isCurrentlyClosed) {
        // Hold through lid closure plus 95ms post-blink Bell's phenomenon eyeball recovery
        this.blinkRecoveryUntil = now + 95;
      }
      const isBlinking = isCurrentlyClosed || now < this.blinkRecoveryUntil;

      // Posture Feedback
      const faceW = faceBox.width;
      const faceRatio = faceW / videoW;
      let distStatus = 'normal';
      let distMsg = 'Distancia óptima (10-15 cm)';
      if (faceRatio < 0.28) {
        distStatus = 'too_far';
        distMsg = 'Acérquese más al móvil (aprox 10-15 cm)';
      } else if (faceRatio > 0.65) {
        distStatus = 'too_close';
        distMsg = 'Aléjese un poco';
      }
      const isPostureOptimal = distStatus === 'normal' && Math.abs(headPose.rollDeg) < 18;

      if (isBlinking && this.hasCleanSample) {
        // Freeze clean gaze coordinates safely during blink & Bell-phenomenon recovery
        return {
          gazeScreenX: this.lastSmoothX,
          gazeScreenY: this.lastSmoothY,
          rawGazeX: this.lastCleanRawX,
          rawGazeY: this.lastCleanRawY,
          headPose,
          faceDetected: true,
          eyesDetected: false,
          pupilLeft: pupilL,
          pupilRight: pupilR,
          faceBox,
          leftEyeBox: lBox,
          rightEyeBox: rBox,
          isFixating: true,
          eyeVelocity: 0,
          isSquinting,
          squintScore: avgSquint,
          isBlinking: true,
          signalQuality: 0.15,
          posture: {
            isPostureOptimal,
            distanceStatus: distStatus,
            distanceMessage: distMsg,
            tiltStatus: Math.abs(headPose.rollDeg) > 18 ? 'tilted' : 'aligned',
            tiltAngleDeg: headPose.rollDeg,
            tiltMessage: Math.abs(headPose.rollDeg) > 18 ? 'Cabeza ladeada' : 'Alineado',
            faceRatio
          }
        };
      }

      // 3. Multi-Modal Sensor Fusion:
      //    2D Sub-Pixel Canthal Projection + Photometric Eye-ROI Centroid + 3D Eyeball Raycast + Directional Blendshapes
      let rawGazeX = 0.5;
      let rawGazeY = 0.5;
      let sensorMetrics = {
        ray3DX: 0.5,
        ray3DY: 0.5,
        blendshapeY: 0,
        photometricActive: false,
        fusionActive: false,
      };

      if (this.sensorFusionEnabled) {
        let leftIrisX = leftEyeGeo.pupilCenterNorm.x;
        let leftIrisY = leftEyeGeo.pupilCenterNorm.y;
        let rightIrisX = rightEyeGeo.pupilCenterNorm.x;
        let rightIrisY = rightEyeGeo.pupilCenterNorm.y;
        let photometricActive = false;

        if (this.roiCanvas) {
          const photoL = sampleEyeRoiPhotometricCentroid(
            this.video,
            this.roiCanvas,
            landmarks,
            'left',
            leftIrisX,
            leftIrisY,
            videoW,
            videoH
          );
          const photoR = sampleEyeRoiPhotometricCentroid(
            this.video,
            this.roiCanvas,
            landmarks,
            'right',
            rightIrisX,
            rightIrisY,
            videoW,
            videoH
          );
          if (photoL.active) {
            leftIrisX = photoL.refinedNormX;
            leftIrisY = photoL.refinedNormY;
          }
          if (photoR.active) {
            rightIrisX = photoR.refinedNormX;
            rightIrisY = photoR.refinedNormY;
          }
          photometricActive = photoL.active || photoR.active;
        }

        const facialMatrix = results.facialTransformationMatrixes?.[0]?.data
          ? Array.from(results.facialTransformationMatrixes[0].data)
          : undefined;

        const leftRay3D = solve3DEyeballVisualAxisRay(
          landmarks,
          'left',
          leftIrisX,
          leftIrisY,
          this.verticalGainMultiplier,
          facialMatrix
        );
        const rightRay3D = solve3DEyeballVisualAxisRay(
          landmarks,
          'right',
          rightIrisX,
          rightIrisY,
          this.verticalGainMultiplier,
          facialMatrix
        );

        const blendSignal = extractBlendshapeGaze(results.faceBlendshapes?.[0]?.categories);
        const fused = fuseGazeChannels(
          leftEyeGeo,
          rightEyeGeo,
          leftRay3D,
          rightRay3D,
          blendSignal,
          headPose,
          this.invertY,
          photometricActive
        );

        rawGazeX = fused.fusedX;
        rawGazeY = fused.fusedY;
        sensorMetrics = {
          ray3DX: fused.ray3DX,
          ray3DY: fused.ray3DY,
          blendshapeY: fused.blendshapeY,
          photometricActive: fused.photometricActive,
          fusionActive: true,
        };
      } else {
        const totalEyeWeight = leftEyeGeo.confidenceWeight + rightEyeGeo.confidenceWeight;
        const wL = leftEyeGeo.confidenceWeight / totalEyeWeight;
        const wR = rightEyeGeo.confidenceWeight / totalEyeWeight;

        rawGazeX = leftEyeGeo.sphericalGazeX * wL + rightEyeGeo.sphericalGazeX * wR;
        rawGazeY = leftEyeGeo.sphericalGazeY * wL + rightEyeGeo.sphericalGazeY * wR;

        if (this.invertY) {
          rawGazeY = 1.0 - rawGazeY;
        }
        sensorMetrics.ray3DX = rawGazeX;
        sensorMetrics.ray3DY = rawGazeY;
      }

      // [Paper Section 4.2: Concordant Compensation Formulation]
      const { compensatedX, compensatedY } = applyHeadPoseCompensation(rawGazeX, rawGazeY, headPose, this.invertY);

      // 1-Frame Glare / Outlier Spike Confirmation Gate (Hampel persistence filter):
      // Normal pursuit and diagonal saccades <= 0.145 normalized units/frame pass with 0ms delay;
      // single-frame extreme glare artifacts > 0.145 hold at most 1 frame before confirming.
      let gatedX = compensatedX;
      let gatedY = compensatedY;
      let signalQuality = Math.min(1.0, Math.max(0.45, (apertureRatio - 0.07) / Math.max(0.08, this.baselineAperture - 0.07)));

      if (this.hasCleanSample) {
        const jumpDist = Math.hypot(compensatedX - this.lastCleanRawX, compensatedY - this.lastCleanRawY);
        if (jumpDist > 0.145) {
          if (
            (this.pendingSpikeX !== null &&
              this.pendingSpikeY !== null &&
              Math.hypot(compensatedX - this.pendingSpikeX, compensatedY - this.pendingSpikeY) < 0.075) ||
            this.pendingSpikeFrames >= 1
          ) {
            // Confirmed voluntary saccade landing
            this.pendingSpikeX = null;
            this.pendingSpikeY = null;
            this.pendingSpikeFrames = 0;
          } else {
            this.pendingSpikeX = compensatedX;
            this.pendingSpikeY = compensatedY;
            this.pendingSpikeFrames++;
            gatedX = this.lastCleanRawX;
            gatedY = this.lastCleanRawY;
            signalQuality = Math.min(signalQuality, 0.55);
          }
        } else {
          this.pendingSpikeX = null;
          this.pendingSpikeY = null;
          this.pendingSpikeFrames = 0;
        }
      }

      this.lastCleanRawX = gatedX;
      this.lastCleanRawY = gatedY;
      this.hasCleanSample = true;

      // Pre-mapping 1€ smoothing in normalized [0, 1] pupil coordinates
      const smoothedRawX = this.rawPupilFilterX.filter(gatedX, now).value;
      const smoothedRawY = this.rawPupilFilterY.filter(gatedY, now).value;

      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;

      // 4. Predict via Multimodal 4D Neural Matrix Grid (Stacked TPS + RBF ML, Polynomial, or Projective)
      const mapped = this.mapViaNeuralGrid(
        smoothedRawX,
        smoothedRawY,
        headPose.normYaw,
        headPose.normPitch,
        screenW,
        screenH
      );

      // 5. 2D State-Space Kalman Filter with Mahalanobis Saccadic Innovation Gate
      const kalmanOut = this.kalmanFilter.update(mapped.x, mapped.y, now);

      // 6. Sliding-Window Spatial Dispersion (I-DT) & Hysteresis Deadband Fixation Lock:
      let targetFilteredX = kalmanOut.x;
      let targetFilteredY = kalmanOut.y;

      this.recentGazeWindow.push({ x: kalmanOut.x, y: kalmanOut.y });
      if (this.recentGazeWindow.length > 8) {
        this.recentGazeWindow.shift();
      }

      let windowDispersion = 0;
      if (this.recentGazeWindow.length >= 2) {
        const meanWinX = this.recentGazeWindow.reduce((s, p) => s + p.x, 0) / this.recentGazeWindow.length;
        const meanWinY = this.recentGazeWindow.reduce((s, p) => s + p.y, 0) / this.recentGazeWindow.length;
        for (const p of this.recentGazeWindow) {
          const d = Math.hypot(p.x - meanWinX, p.y - meanWinY);
          if (d > windowDispersion) windowDispersion = d;
        }
      }

      if (this.ivtStabilizationEnabled) {
        if (this.fixationAnchorX === null || this.fixationAnchorY === null) {
          this.fixationAnchorX = kalmanOut.x;
          this.fixationAnchorY = kalmanOut.y;
        }
        const distToAnchor = Math.hypot(kalmanOut.x - this.fixationAnchorX, kalmanOut.y - this.fixationAnchorY);

        if (distToAnchor < 16 && windowDispersion < 18) {
          // Focused fixation deadband: calm resting tremor without trapping fine neighboring button shifts
          this.fixationAnchorX = this.fixationAnchorX * 0.84 + kalmanOut.x * 0.16;
          this.fixationAnchorY = this.fixationAnchorY * 0.84 + kalmanOut.y * 0.16;
          targetFilteredX = this.fixationAnchorX;
          targetFilteredY = this.fixationAnchorY;
        } else if (distToAnchor < 52) {
          // Responsive micro-pursuit glide band between adjacent targets
          this.fixationAnchorX = this.fixationAnchorX * 0.45 + kalmanOut.x * 0.55;
          this.fixationAnchorY = this.fixationAnchorY * 0.45 + kalmanOut.y * 0.55;
          targetFilteredX = this.fixationAnchorX;
          targetFilteredY = this.fixationAnchorY;
        } else {
          // Voluntary saccade to a new target: snap anchor immediately for zero lag
          this.fixationAnchorX = kalmanOut.x;
          this.fixationAnchorY = kalmanOut.y;
          targetFilteredX = kalmanOut.x;
          targetFilteredY = kalmanOut.y;
        }
      }

      const fX = this.filterX.filter(targetFilteredX, now);
      const fY = this.filterY.filter(targetFilteredY, now);

      const eyeVel = Math.round(Math.sqrt(fX.velocity * fX.velocity + fY.velocity * fY.velocity));
      const isFix = eyeVel < 100 || windowDispersion < 18;

      const clampedX = Math.min(screenW - 5, Math.max(5, fX.value));
      const clampedY = Math.min(screenH - 5, Math.max(5, fY.value));

      this.lastSmoothX = clampedX;
      this.lastSmoothY = clampedY;

      return {
        gazeScreenX: clampedX,
        gazeScreenY: clampedY,
        rawGazeX: smoothedRawX,
        rawGazeY: smoothedRawY,
        headPose,
        faceDetected: true,
        eyesDetected: true,
        pupilLeft: pupilL,
        pupilRight: pupilR,
        faceBox,
        leftEyeBox: lBox,
        rightEyeBox: rBox,
        isFixating: isFix,
        eyeVelocity: eyeVel,
        isSquinting,
        squintScore: avgSquint,
        isBlinking: false,
        signalQuality,
        sensorMetrics,
        posture: {
          isPostureOptimal,
          distanceStatus: distStatus,
          distanceMessage: distMsg,
          tiltStatus: Math.abs(headPose.rollDeg) > 18 ? 'tilted' : 'aligned',
          tiltAngleDeg: headPose.rollDeg,
          tiltMessage: Math.abs(headPose.rollDeg) > 18 ? 'Cabeza ladeada' : 'Alineado',
          faceRatio
        }
      };
    } catch (e) {
      console.error("Frame processing error:", e);
      return defaultData;
    }
  }

  public drawDebugOverlay(canvas: HTMLCanvasElement, data: EyeTrackingData) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    if (this.video && this.video.readyState >= 2) {
      ctx.drawImage(this.video, 0, 0, w, h);
    } else {
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, w, h);
    }

    if (data.faceDetected && data.faceBox) {
      const scaleX = w / (this.video.videoWidth || 640);
      const scaleY = h / (this.video.videoHeight || 480);

      // Face boundary with head pose indicator
      ctx.strokeStyle = data.isSquinting ? "#fbbf24" : "#06b6d4";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        data.faceBox.x * scaleX,
        data.faceBox.y * scaleY,
        data.faceBox.width * scaleX,
        data.faceBox.height * scaleY
      );

      // Sub-pixel iris & pupil crosshairs
      if (data.pupilLeft && data.pupilRight) {
        [data.pupilLeft, data.pupilRight].forEach(pupil => {
          const px = pupil.x * scaleX;
          const py = pupil.y * scaleY;

          ctx.beginPath();
          ctx.arc(px, py, 4, 0, 2 * Math.PI);
          ctx.fillStyle = "#38bdf8";
          ctx.fill();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.stroke();
        });
      }

      // Draw head orientation HUD & Y polarity
      ctx.fillStyle = this.invertY ? "#f59e0b" : "#38bdf8";
      ctx.font = "8px monospace";
      ctx.fillText(
        `EJE Y: ${this.invertY ? 'INVERTIDO' : 'NORMAL'} | YAW ${data.headPose.yawDeg}° | PITCH ${data.headPose.pitchDeg}°`,
        6,
        12
      );

      ctx.fillStyle = "#a5f3fc";
      ctx.fillText(
        `PUPILA V: ${data.rawGazeY.toFixed(2)} | ROLL: ${data.headPose.rollDeg}° | ML-KALMAN`,
        6,
        22
      );

      if (data.isSquinting) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 9px monospace";
        ctx.fillText("CLICK OCULAR ACTIVO", 6, h - 8);
      }
    }

    ctx.restore();
  }
}
