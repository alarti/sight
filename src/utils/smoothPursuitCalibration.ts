/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationAlgorithm, CalibrationSample, HeadPoseCoupling3D } from '../types/index.ts';
import {
  CalibrationMatrixCoeffs,
  fitCalibrationModel,
  evaluateCalibratedGaze,
  aggregateFixationSamples,
  solveLinearSystem,
  stabilizePupilWith3DHeadCoupling,
} from './calibration.ts';

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

export interface RasterPursuitTargetState {
  xPct: number;
  yPct: number;
  lineIndex: number;
  totalLines: number;
  direction: 'ltr' | 'rtl' | 'descent' | 'head-gimbal';
  phase: 'raster-scan' | 'head-gimbal';
  phaseProgress01: number;
}

export interface SmoothPursuitCalibrationResult {
  samples: CalibrationSample[];
  matrix: CalibrationMatrixCoeffs;
  optimalLagMs: number;
  pearsonR2: number;
  inlierCount: number;
  rasterCellsCount: number;
  headCoupling3D: HeadPoseCoupling3D;
}

/** Fraction of total pursuit calibration duration dedicated to the 5-line Boustrophedon raster sweep */
export const RASTER_SCAN_PHASE_END = 0.84;

/**
 * Evaluates a Continuous Boustrophedon (Zigzag) Horizontal Line-by-Line Raster Scan
 * followed by a 2-second Central 3D Head-Pose Gimbal Calibration phase:
 *   - Phase 1 (`progress01` in `[0, 0.84]`):
 *     Starts at Top-Left `(0.07, 0.08)` and sweeps `numLines = 5` horizontal lines across the screen
 *     (`yPct = 0.08, 0.29, 0.50, 0.71, 0.92`). Even lines sweep Left -> Right (`0.07 -> 0.93`),
 *     odd lines sweep Right -> Left (`0.93 -> 0.07`), connected by smooth cosine-eased vertical
 *     descents along the screen edge so the eye never loses smooth-pursuit lock on return jumps.
 *   - Phase 2 (`progress01` in `(0.84, 1.0]`):
 *     Glides smoothly to the Neutral Screen Center `(0.50, 0.50)` and holds there for ~2 seconds
 *     while the user performs a gentle 3D head movement (yaw/pitch/roll) with gaze fixed at center,
 *     enabling exact identification of the 3D Vestibulo-Ocular / Cranial-Parallax Jacobian tensor.
 */
export function evaluateRasterScanPursuitTarget(
  progress01: number,
  numLines: number = 5
): RasterPursuitTargetState {
  const p = Math.min(1, Math.max(0, progress01));
  const xMin = 0.07;
  const xMax = 0.93;
  const yMin = 0.08;
  const yMax = 0.92;
  const lines = Math.max(2, Math.floor(numLines));

  if (p <= RASTER_SCAN_PHASE_END) {
    const rasterP = p / RASTER_SCAN_PHASE_END;
    const sweepWeight = 1.0;
    const descentWeight = 0.16;
    const totalWeight = lines * sweepWeight + (lines - 1) * descentWeight;
    let cursorW = rasterP * totalWeight;

    for (let r = 0; r < lines; r++) {
      const yRow = yMin + (r / (lines - 1)) * (yMax - yMin);
      const isLTR = r % 2 === 0;

      // 1. Horizontal line sweep segment
      if (cursorW <= sweepWeight || r === lines - 1) {
        const s = Math.min(1, Math.max(0, cursorW / sweepWeight));
        // Hybrid linear + cosine easing at turnaround edges to prevent catch-up saccades
        const easedS = 0.82 * s + 0.18 * (0.5 - 0.5 * Math.cos(Math.PI * s));
        const xPct = isLTR ? xMin + easedS * (xMax - xMin) : xMax - easedS * (xMax - xMin);
        return {
          xPct,
          yPct: yRow,
          lineIndex: r,
          totalLines: lines,
          direction: isLTR ? 'ltr' : 'rtl',
          phase: 'raster-scan',
          phaseProgress01: rasterP,
        };
      }
      cursorW -= sweepWeight;

      // 2. Smooth vertical descent segment to next line (no abrupt horizontal jump)
      if (cursorW <= descentWeight) {
        const s = Math.min(1, Math.max(0, cursorW / descentWeight));
        const easedS = 0.5 - 0.5 * Math.cos(Math.PI * s);
        const yNext = yMin + ((r + 1) / (lines - 1)) * (yMax - yMin);
        const xEdge = isLTR ? xMax : xMin;
        return {
          xPct: xEdge,
          yPct: yRow + easedS * (yNext - yRow),
          lineIndex: r,
          totalLines: lines,
          direction: 'descent',
          phase: 'raster-scan',
          phaseProgress01: rasterP,
        };
      }
      cursorW -= descentWeight;
    }
  }

  // Phase 2: 2-Second Guided 3D Head-Pose Gimbal Phase at Neutral Center (0.50, 0.50)
  const gimbalP = (p - RASTER_SCAN_PHASE_END) / (1.0 - RASTER_SCAN_PHASE_END);
  const lastRowIsLTR = (lines - 1) % 2 === 0;
  const endX = lastRowIsLTR ? xMax : xMin;
  const endY = yMax;

  // Smooth 18% transition glide from final line corner to neutral screen center (0.50, 0.50)
  const glideFrac = 0.18;
  if (gimbalP < glideFrac) {
    const s = gimbalP / glideFrac;
    const eased = 0.5 - 0.5 * Math.cos(Math.PI * s);
    return {
      xPct: endX + eased * (0.50 - endX),
      yPct: endY + eased * (0.50 - endY),
      lineIndex: lines - 1,
      totalLines: lines,
      direction: 'head-gimbal',
      phase: 'head-gimbal',
      phaseProgress01: gimbalP,
    };
  }

  return {
    xPct: 0.50,
    yPct: 0.50,
    lineIndex: -1,
    totalLines: lines,
    direction: 'head-gimbal',
    phase: 'head-gimbal',
    phaseProgress01: gimbalP,
  };
}

/**
 * Backward-compatible wrapper returning `{ xPct, yPct }` along the continuous Boustrophedon
 * line-scan and 3D head-gimbal calibration trajectory.
 */
export function evaluateLissajousPursuitTarget(progress01: number): { xPct: number; yPct: number } {
  const state = evaluateRasterScanPursuitTarget(progress01, 5);
  return { xPct: state.xPct, yPct: state.yPct };
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
 * Estimates the 3D Head-Pose Differential Coupling Tensor (Yaw \psi, Pitch \theta, Roll \phi -> \Delta pupil):
 * Uses a two-stage orthogonal decomposition:
 *   1. Fits the baseline 2D screen-to-pupil linear inverse plane (\hat{x}(X, Y), \hat{y}(X, Y)) across the
 *      raster scan so screen target movement is separated from head-pose variation.
 *   2. Solves a Tikhonov-regularized 3x3 linear system over the 3D head-pose deviations
 *      [\Delta\psi, \Delta\theta, \Delta\phi_norm] to capture the exact pupil shift caused by 3D head
 *      rotations, weighting the final 2-second center-locked 3D head-gimbal frames 3.5x higher.
 */
export function estimate3DHeadPoseCoupling(
  alignedSamples: CalibrationSample[],
  gimbalFlags: boolean[]
): HeadPoseCoupling3D {
  const N = alignedSamples.length;
  if (N < 6) {
    return {
      refYaw: 0,
      refPitch: 0,
      refRollDeg: 0,
      jacobianX: [0, 0, 0],
      jacobianY: [0, 0, 0],
      ocularCounterRollGain: 0.12,
    };
  }

  // Compute canonical reference 3D head pose (refYaw, refPitch, refRollDeg) and mean pupil center
  let refYaw = 0;
  let refPitch = 0;
  let refRollDeg = 0;
  let meanPupilX = 0;
  let meanPupilY = 0;
  let meanTargetX = 0;
  let meanTargetY = 0;

  for (let i = 0; i < N; i++) {
    const s = alignedSamples[i];
    refYaw += s.headYaw ?? 0;
    refPitch += s.headPitch ?? 0;
    refRollDeg += s.headRoll ?? 0;
    meanPupilX += s.rawPupilX;
    meanPupilY += s.rawPupilY;
    meanTargetX += s.targetX;
    meanTargetY += s.targetY;
  }
  refYaw /= N;
  refPitch /= N;
  refRollDeg /= N;
  meanPupilX /= N;
  meanPupilY /= N;
  meanTargetX /= N;
  meanTargetY /= N;

  const scaleTX = Math.max(
    50,
    Math.sqrt(alignedSamples.reduce((a, s) => a + (s.targetX - meanTargetX) ** 2, 0) / N)
  );
  const scaleTY = Math.max(
    50,
    Math.sqrt(alignedSamples.reduce((a, s) => a + (s.targetY - meanTargetY) ** 2, 0) / N)
  );

  // Stage 1: Fit baseline screen-target -> pupil affine model [1, txNorm, tyNorm]
  const A2: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bx2 = [0, 0, 0];
  const by2 = [0, 0, 0];
  const ocularCounterRollGain = 0.12;

  const derotPupil = alignedSamples.map(s => {
    const dRollDeg = (s.headRoll ?? 0) - refRollDeg;
    const thetaRad = -(dRollDeg * Math.PI / 180.0) * ocularCounterRollGain;
    const cosT = Math.cos(thetaRad);
    const sinT = Math.sin(thetaRad);
    const rx = s.rawPupilX - meanPupilX;
    const ry = s.rawPupilY - meanPupilY;
    return {
      x: meanPupilX + (rx * cosT - ry * sinT),
      y: meanPupilY + (rx * sinT + ry * cosT),
    };
  });

  for (let i = 0; i < N; i++) {
    const s = alignedSamples[i];
    const f = [1, (s.targetX - meanTargetX) / scaleTX, (s.targetY - meanTargetY) / scaleTY];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        A2[r][c] += f[r] * f[c];
      }
      bx2[r] += f[r] * derotPupil[i].x;
      by2[r] += f[r] * derotPupil[i].y;
    }
  }
  A2[1][1] += 1e-5;
  A2[2][2] += 1e-5;
  const solBaseX = solveLinearSystem(A2, bx2);
  const solBaseY = solveLinearSystem(A2, by2);

  // Stage 2: Regress pupil residuals (\delta x, \delta y) against 3D head-pose deviations [\Delta\psi, \Delta\theta, \Delta\phi]
  const H3: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const rhsX = [0, 0, 0];
  const rhsY = [0, 0, 0];

  for (let i = 0; i < N; i++) {
    const s = alignedSamples[i];
    const txN = (s.targetX - meanTargetX) / scaleTX;
    const tyN = (s.targetY - meanTargetY) / scaleTY;
    const expectedPupilX = solBaseX[0] + solBaseX[1] * txN + solBaseX[2] * tyN;
    const expectedPupilY = solBaseY[0] + solBaseY[1] * txN + solBaseY[2] * tyN;

    const resPupilX = derotPupil[i].x - expectedPupilX;
    const resPupilY = derotPupil[i].y - expectedPupilY;

    const dYaw = (s.headYaw ?? 0) - refYaw;
    const dPitch = (s.headPitch ?? 0) - refPitch;
    const dRollNorm = Math.max(-1.0, Math.min(1.0, ((s.headRoll ?? 0) - refRollDeg) / 45.0));

    // Weight Phase 2 center-locked 3D head-gimbal frames 3.5x higher because target is stationary
    const w = gimbalFlags[i] ? 3.5 : 1.0;
    const h = [dYaw, dPitch, dRollNorm];

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        H3[r][c] += w * h[r] * h[c];
      }
      rhsX[r] += w * h[r] * resPupilX;
      rhsY[r] += w * h[r] * resPupilY;
    }
  }

  // Tikhonov regularization prevents noise amplification when head was held completely still
  const ridgeLambda = 0.015;
  H3[0][0] += ridgeLambda;
  H3[1][1] += ridgeLambda;
  H3[2][2] += ridgeLambda;

  const jxRaw = solveLinearSystem(H3, rhsX);
  const jyRaw = solveLinearSystem(H3, rhsY);

  const clampGain = (v: number) => (Number.isFinite(v) ? Math.max(-0.22, Math.min(0.22, v)) : 0);

  return {
    refYaw,
    refPitch,
    refRollDeg,
    jacobianX: [clampGain(jxRaw[0]), clampGain(jxRaw[1]), clampGain(jxRaw[2])],
    jacobianY: [clampGain(jyRaw[0]), clampGain(jyRaw[1]), clampGain(jyRaw[2])],
    ocularCounterRollGain,
  };
}

/**
 * Continuous Line-Scan & 3D Head-Pose Coupled Smooth-Pursuit Calibration:
 *   1. Estimates the optimal physiological smooth-pursuit + filter latency \tau^* (0..260 ms)
 *      maximizing Pearson cross-correlation along the horizontal raster sweep lines.
 *   2. Solves the 3D Head-Pose Differential Coupling Tensor (`headCoupling3D`) over Yaw, Pitch, and Roll
 *      using the raster scan and the 2-second central 3D head-gimbal calibration phase.
 *   3. Stabilizes all captured pupil coordinates to the canonical 3D head posture `(refYaw, refPitch, refRollDeg)`
 *      and prunes catch-up saccade / distraction outliers via Median Absolute Deviation (MAD).
 *   4. Partitions the screen into a dense 5x9 (up to 45 cells) spatial raster grid and aggregates
 *      each cell via Interquartile Trimmed Mean (`aggregateFixationSamples`) to build an exact,
 *      zero-residual positioning matrix across the entire monitor.
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

  // Discard initial 300ms reaction-time transient at top-left start
  const tStart = valid[0].tMs + 300;
  const totalSpanMs = Math.max(1, valid[valid.length - 1].tMs - valid[0].tMs);
  const tRasterEnd = valid[0].tMs + totalSpanMs * RASTER_SCAN_PHASE_END;

  const activeFrames = valid.filter(f => f.tMs >= tStart);
  const working = activeFrames.length >= 16 ? activeFrames : valid;

  // Use Phase 1 raster sweep frames for cross-correlation lag estimation
  const rasterFrames = working.filter(f => f.tMs <= tRasterEnd);
  const lagSearchFrames = rasterFrames.length >= 12 ? rasterFrames : working;

  let bestLagMs = 80;
  let bestAbsScore = -Infinity;

  for (let lag = 0; lag <= maxLagMs; lag += stepMs) {
    const txs: number[] = [];
    const tys: number[] = [];
    const pxs: number[] = [];
    const pys: number[] = [];

    for (const f of lagSearchFrames) {
      const tgt = interpolateTargetAtTime(valid, f.tMs - lag);
      txs.push(tgt.x);
      tys.push(tgt.y);
      pxs.push(f.rawPupilX);
      pys.push(f.rawPupilY);
    }

    const rx = pearsonCorrelation(txs, pxs);
    const ry = pearsonCorrelation(tys, pys);
    const score = Math.abs(rx) + Math.abs(ry);
    if (score > bestAbsScore) {
      bestAbsScore = score;
      bestLagMs = lag;
    }
  }

  const rawAlignedSamples: CalibrationSample[] = [];
  const gimbalFlags: boolean[] = [];

  for (const f of working) {
    const tgt = interpolateTargetAtTime(valid, f.tMs - bestLagMs);
    rawAlignedSamples.push({
      targetX: tgt.x,
      targetY: tgt.y,
      rawPupilX: f.rawPupilX,
      rawPupilY: f.rawPupilY,
      headYaw: f.headYaw ?? 0,
      headPitch: f.headPitch ?? 0,
      headRoll: f.headRoll ?? 0,
    });
    gimbalFlags.push(f.tMs > tRasterEnd + 250);
  }

  // 2. Estimate 3D Head-Pose Differential Coupling Tensor (Yaw, Pitch, Roll)
  const headCoupling3D = estimate3DHeadPoseCoupling(rawAlignedSamples, gimbalFlags);

  const meanPupilX = rawAlignedSamples.reduce((a, s) => a + s.rawPupilX, 0) / rawAlignedSamples.length;
  const meanPupilY = rawAlignedSamples.reduce((a, s) => a + s.rawPupilY, 0) / rawAlignedSamples.length;

  // 3. Stabilize every frame's pupil coordinate to the canonical 3D reference posture
  const alignedSamples: CalibrationSample[] = rawAlignedSamples.map(s => {
    const stab = stabilizePupilWith3DHeadCoupling(
      s.rawPupilX,
      s.rawPupilY,
      s.headYaw ?? 0,
      s.headPitch ?? 0,
      s.headRoll ?? 0,
      headCoupling3D,
      meanPupilX,
      meanPupilY
    );
    return {
      targetX: s.targetX,
      targetY: s.targetY,
      rawPupilX: stab.x,
      rawPupilY: stab.y,
      headYaw: headCoupling3D.refYaw,
      headPitch: headCoupling3D.refPitch,
      headRoll: headCoupling3D.refRollDeg,
    };
  });

  // 4. Pass 1 fit + MAD residual outlier rejection (drops catch-up saccades or momentary blinks)
  const pass1Model = fitCalibrationModel(alignedSamples.slice(0, 48), algorithm);
  let cleanAligned = alignedSamples;

  if (pass1Model) {
    const residuals = alignedSamples.map(s => {
      const pred = evaluateCalibratedGaze(
        s.rawPupilX,
        s.rawPupilY,
        s.headYaw ?? 0,
        s.headPitch ?? 0,
        pass1Model,
        algorithm,
        s.headRoll ?? 0
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

  // 5. Dense 5x9 (45-Cell) Spatial Raster Grid Quantization:
  // Partitions the swept screen area into 5 horizontal lines x 9 columns and computes the
  // interquartile trimmed mean pupil imprint inside each cell so the entire screen is covered
  // by exact line-by-line anchors.
  let minTX = Infinity;
  let maxTX = -Infinity;
  let minTY = Infinity;
  let maxTY = -Infinity;
  for (const s of cleanAligned) {
    if (s.targetX < minTX) minTX = s.targetX;
    if (s.targetX > maxTX) maxTX = s.targetX;
    if (s.targetY < minTY) minTY = s.targetY;
    if (s.targetY > maxTY) maxTY = s.targetY;
  }

  const gridRows = 5;
  const gridCols = 9;
  const spanTX = Math.max(1, maxTX - minTX);
  const spanTY = Math.max(1, maxTY - minTY);

  const cellBuckets: Map<string, CalibrationSample[]> = new Map();
  for (const s of cleanAligned) {
    const r = Math.min(gridRows - 1, Math.max(0, Math.floor(((s.targetY - minTY) / spanTY) * gridRows)));
    const c = Math.min(gridCols - 1, Math.max(0, Math.floor(((s.targetX - minTX) / spanTX) * gridCols)));
    const key = `${r}:${c}`;
    const bucket = cellBuckets.get(key);
    if (bucket) {
      bucket.push(s);
    } else {
      cellBuckets.set(key, [s]);
    }
  }

  const anchorSamples: CalibrationSample[] = [];
  for (const bucket of cellBuckets.values()) {
    const aggPupil = aggregateFixationSamples(
      bucket.map(b => ({ rawX: b.rawPupilX, rawY: b.rawPupilY }))
    );
    const aggTarget = aggregateFixationSamples(
      bucket.map(b => ({ rawX: b.targetX, rawY: b.targetY }))
    );
    anchorSamples.push({
      targetX: aggTarget.rawX,
      targetY: aggTarget.rawY,
      rawPupilX: aggPupil.rawX,
      rawPupilY: aggPupil.rawY,
      headYaw: headCoupling3D.refYaw,
      headPitch: headCoupling3D.refPitch,
      headRoll: headCoupling3D.refRollDeg,
    });
  }

  // Supplement with uniform temporal-spatial anchors if the stream was short (< 16 populated cells)
  if (anchorSamples.length < 16) {
    const targetAnchors = Math.min(20, cleanAligned.length);
    const stride = cleanAligned.length / targetAnchors;
    anchorSamples.length = 0;
    for (let i = 0; i < targetAnchors; i++) {
      const idx = Math.min(cleanAligned.length - 1, Math.floor(i * stride));
      anchorSamples.push({ ...cleanAligned[idx] });
    }
  }

  // Attach the learned 3D Head-Pose Coupling Tensor to the anchor set so fitCalibrationModel embeds it
  if (anchorSamples.length > 0) {
    anchorSamples[0] = {
      ...anchorSamples[0],
      headCoupling3D,
    };
  }

  const finalModel = fitCalibrationModel(anchorSamples, algorithm);
  if (!finalModel) return null;

  if (finalModel.quadrantMatrix) {
    finalModel.quadrantMatrix.headCoupling3D = headCoupling3D;
  }

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
    rasterCellsCount: anchorSamples.length,
    headCoupling3D,
  };
}
