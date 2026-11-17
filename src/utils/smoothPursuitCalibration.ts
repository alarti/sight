/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationAlgorithm, CalibrationSample } from '../types/index.ts';
import { CalibrationMatrixCoeffs, fitCalibrationModel, evaluateCalibratedGaze } from './calibration.ts';

export interface PursuitStreamFrame {
  tMs: number;
  targetX: number;
  targetY: number;
  rawPupilX: number;
  rawPupilY: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
}

export interface SmoothPursuitCalibrationResult {
  samples: CalibrationSample[];
  matrix: CalibrationMatrixCoeffs;
  optimalLagMs: number;
  pearsonR2: number;
  inlierCount: number;
}

/**
 * Evaluates a continuous, low-strain 2-loop Lissajous + perimeter smooth-pursuit trajectory
 * parameterized over progress p in [0, 1]. Sweeps all 4 screen quadrants, edges, and neutral center
 * without forcing patients to stare statically at harsh corners.
 */
export function evaluateLissajousPursuitTarget(progress01: number): { xPct: number; yPct: number } {
  const p = Math.min(1, Math.max(0, progress01));
  const theta = p * 2 * Math.PI;

  // Smooth amplitude ramp at start/end edges so eye velocity starts and settles gently from center
  const envelope = Math.sin(Math.min(1, p * 5) * (Math.PI / 2)) * Math.sin(Math.min(1, (1 - p) * 5) * (Math.PI / 2));
  const ampScale = 0.25 + 0.75 * envelope;

  const rx = 0.43 * ampScale;
  const ry = 0.41 * ampScale;

  // 2x3 coupled harmonic sweep covers top-left, top-right, bottom-left, bottom-right, edges, and center
  const dx = Math.sin(2 * theta) * rx + Math.sin(theta) * (0.04 * ampScale);
  const dy = (Math.sin(3 * theta) * 0.78 + Math.cos(theta) * 0.24) * ry;

  return {
    xPct: Math.min(0.93, Math.max(0.07, 0.5 + dx)),
    yPct: Math.min(0.92, Math.max(0.08, 0.5 + dy)),
  };
}

function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 4) return 0;

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i];
    my += ys[i];
  }
  mx /= n;
  my /= n;

  let num = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }

  const denom = Math.sqrt(vx * vy);
  return denom > 1e-8 ? num / denom : 0;
}

function interpolateTargetAtTime(
  frames: PursuitStreamFrame[],
  queryTimeMs: number
): { x: number; y: number } {
  if (queryTimeMs <= frames[0].tMs) {
    return { x: frames[0].targetX, y: frames[0].targetY };
  }
  const last = frames[frames.length - 1];
  if (queryTimeMs >= last.tMs) {
    return { x: last.targetX, y: last.targetY };
  }

  let lo = 0;
  let hi = frames.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].tMs <= queryTimeMs) lo = mid;
    else hi = mid;
  }

  const f0 = frames[lo];
  const f1 = frames[hi];
  const span = Math.max(1e-4, f1.tMs - f0.tMs);
  const alpha = (queryTimeMs - f0.tMs) / span;
  return {
    x: f0.targetX + (f1.targetX - f0.targetX) * alpha,
    y: f0.targetY + (f1.targetY - f0.targetY) * alpha,
  };
}

/**
 * OrbitoGaze Lag-Compensated Smooth-Pursuit Calibration:
 * 1. Finds the physiological pursuit + signal-filter delay tau* (0..260ms) that maximizes
 *    cross-correlation between orbital target trajectory and measured eye trajectory.
 * 2. Aligns target-pupil pairs at tau* and prunes catch-up saccade / distraction outliers via MAD.
 * 3. Sub-samples well-conditioned spatial anchors across the trajectory and solves M-QPM / chosen model.
 */
export function calibrateFromSmoothPursuit(
  stream: PursuitStreamFrame[],
  algorithm: CalibrationAlgorithm = 'quadrant-matrix',
  maxLagMs: number = 260,
  stepMs: number = 20
): SmoothPursuitCalibrationResult | null {
  const valid = stream
    .filter(
      f =>
        Number.isFinite(f.tMs) &&
        Number.isFinite(f.targetX) &&
        Number.isFinite(f.targetY) &&
        Number.isFinite(f.rawPupilX) &&
        Number.isFinite(f.rawPupilY)
    )
    .sort((a, b) => a.tMs - b.tMs);

  if (valid.length < 18) return null;

  // Discard initial 350ms reaction-time transient
  const tStart = valid[0].tMs + 350;
  const activeFrames = valid.filter(f => f.tMs >= tStart);
  const working = activeFrames.length >= 16 ? activeFrames : valid;

  let bestLagMs = 80;
  let bestAbsScore = -Infinity;

  for (let lag = 0; lag <= maxLagMs; lag += stepMs) {
    const txs: number[] = [];
    const tys: number[] = [];
    const pxs: number[] = [];
    const pys: number[] = [];

    for (const f of working) {
      const tgt = interpolateTargetAtTime(valid, f.tMs - lag);
      txs.push(tgt.x);
      tys.push(tgt.y);
      pxs.push(f.rawPupilX);
      pys.push(f.rawPupilY);
    }

    const rx = pearsonCorrelation(txs, pxs);
    const ry = pearsonCorrelation(tys, pys);
    // Favor positive/consistent monotonic alignment across both axes
    const score = Math.abs(rx) + Math.abs(ry);
    if (score > bestAbsScore) {
      bestAbsScore = score;
      bestLagMs = lag;
    }
  }

  const alignedSamples: CalibrationSample[] = working.map(f => {
    const tgt = interpolateTargetAtTime(valid, f.tMs - bestLagMs);
    return {
      targetX: tgt.x,
      targetY: tgt.y,
      rawPupilX: f.rawPupilX,
      rawPupilY: f.rawPupilY,
      headYaw: f.headYaw ?? 0,
      headPitch: f.headPitch ?? 0,
      headRoll: f.headRoll ?? 0,
    };
  });

  // Pass 1 fit + MAD residual outlier rejection (drops catch-up saccades or momentary blinks)
  const pass1Model = fitCalibrationModel(alignedSamples, algorithm);
  let cleanAligned = alignedSamples;

  if (pass1Model) {
    const residuals = alignedSamples.map(s => {
      const pred = evaluateCalibratedGaze(
        s.rawPupilX,
        s.rawPupilY,
        s.headYaw ?? 0,
        s.headPitch ?? 0,
        pass1Model,
        algorithm
      );
      return pred ? Math.hypot(pred.x - s.targetX, pred.y - s.targetY) : 0;
    });
    const sorted = [...residuals].sort((a, b) => a - b);
    const medianErr = sorted[Math.floor(sorted.length * 0.5)];
    const mad = sorted.map(r => Math.abs(r - medianErr)).sort((a, b) => a - b)[Math.floor(sorted.length * 0.5)];
    const thresh = Math.max(70, medianErr + Math.max(25, mad * 2.5));

    const trimmed = alignedSamples.filter((_, idx) => residuals[idx] <= thresh);
    if (trimmed.length >= 12) {
      cleanAligned = trimmed;
    }
  }

  // Uniform temporal-spatial sub-sampling to ~18 well-conditioned anchors for snappy TPS/M-QPM solve
  const targetAnchors = Math.min(20, cleanAligned.length);
  const stride = cleanAligned.length / targetAnchors;
  const anchorSamples: CalibrationSample[] = [];
  for (let i = 0; i < targetAnchors; i++) {
    const idx = Math.min(cleanAligned.length - 1, Math.floor(i * stride));
    anchorSamples.push(cleanAligned[idx]);
  }

  const finalModel = fitCalibrationModel(anchorSamples, algorithm);
  if (!finalModel) return null;

  const rxFinal = pearsonCorrelation(
    cleanAligned.map(s => s.targetX),
    cleanAligned.map(s => s.rawPupilX)
  );
  const ryFinal = pearsonCorrelation(
    cleanAligned.map(s => s.targetY),
    cleanAligned.map(s => s.rawPupilY)
  );
  const pearsonR2 = Number(((rxFinal * rxFinal + ryFinal * ryFinal) * 0.5).toFixed(3));

  return {
    samples: anchorSamples,
    matrix: finalModel,
    optimalLagMs: bestLagMs,
    pearsonR2,
    inlierCount: cleanAligned.length,
  };
}
