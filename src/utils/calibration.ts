/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample, CalibrationAlgorithm, QuadrantMatrixSnapshot } from '../types/index.ts';

export type QuadrantMatrixModel = QuadrantMatrixSnapshot;

export interface ThinPlateSplineModel {
  controlPoints: Array<{ x: number; y: number; yaw: number; pitch: number }>;
  weightsX: number[];
  weightsY: number[];
  affineX: [number, number, number]; // [a0, ax, ay]
  affineY: [number, number, number]; // [b0, bx, by]
  yawFactorX: number;
  pitchFactorY: number;
  scaleX?: number;
  scaleY?: number;
  rmsePx?: number;
}

export interface ProjectiveModel {
  H: number[][]; // 3x3 Homography matrix
  h?: number[]; // Flattened 9-element homography coefficients
  radialK: number;
  yawFactorX: number;
  pitchFactorY: number;
  rmsePx?: number;
}

/**
 * Gaussian Process / Radial Basis Function (RBF) Kernel Ridge Regression Model
 * Non-parametric Machine Learning gaze predictor combining an unshrunk affine prior
 * with a scale-adaptive 4D RBF kernel over [pupilX, pupilY, headYaw, headPitch].
 */
export interface RbfKernelModel {
  supportVectors: Array<{ x: number; y: number; yaw: number; pitch: number }>;
  dualWeightsX: number[];
  dualWeightsY: number[];
  linearX: [number, number, number, number, number]; // [w0, wx, wy, wyaw, wpitch]
  linearY: [number, number, number, number, number]; // [w0, wx, wy, wyaw, wpitch]
  gamma: number;
  scaleX?: number;
  scaleY?: number;
  rmsePx?: number;
}

export interface CalibrationMatrixCoeffs {
  modelType?: CalibrationAlgorithm;
  a: number[]; // Coefficients for X: [w0, wx, wy, wxy, wx2, wy2, wyaw, wpitch]
  b: number[]; // Coefficients for Y: [w0, wx, wy, wxy, wx2, wy2, wyaw, wpitch]
  quadrantMatrix?: QuadrantMatrixModel;
  tps?: ThinPlateSplineModel;
  projective?: ProjectiveModel;
  rbf?: RbfKernelModel;
  rmsePx: number; // Root Mean Square Error in pixels
  cvRmsePx?: number; // Leave-One-Out Cross-Validation RMSE in pixels
  reliabilityScore?: number; // Clinical reliability index [0-100]
  accuracyDeg: number; // Estimated angular error in visual degrees
}

/**
 * [Paper Section 5.2: Mathematical Formulation of Ridge Regression]
 * Feature expansion for 2nd-order Bivariate Polynomial + 3D Head Orientation
 * Basis phi(v) = [1, X_tilde, Y_tilde, X_tilde*Y_tilde, X_tilde^2, Y_tilde^2, psi, theta]^T
 */
export function expandFeatures(
  x: number,
  y: number,
  yaw: number = 0,
  pitch: number = 0
): number[] {
  return [
    1.0,
    x,
    y,
    x * y,
    x * x,
    y * y,
    yaw,
    pitch
  ];
}

/**
 * Evaluates the calibrated bivariate polynomial model for a given pupil vector
 */
export function evaluatePolynomialGaze(
  x: number,
  y: number,
  yaw: number,
  pitch: number,
  coeffs: CalibrationMatrixCoeffs
): { x: number; y: number } {
  const phi = expandFeatures(x, y, yaw, pitch);
  let predX = 0;
  let predY = 0;

  for (let i = 0; i < phi.length; i++) {
    predX += coeffs.a[i] * phi[i];
    predY += coeffs.b[i] * phi[i];
  }

  return { x: predX, y: predY };
}

/**
 * Solves Ax = b using Gaussian elimination with scaled partial pivoting
 */
export function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      continue;
    }

    if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / M[col][col];
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    const diag = M[i][i];
    x[i] = Math.abs(diag) > 1e-12 ? sum / diag : 0;
  }

  return x;
}

/**
 * Thin-Plate Spline (TPS) Radial Basis Kernel
 * U(r) = r^2 * ln(r) for r > 0; 0 for r = 0
 */
export function tpsRadialKernel(r: number): number {
  if (r <= 1e-6) return 0.0;
  return r * r * Math.log(r);
}

export interface WeightedCalibrationCentroid extends CalibrationSample {
  precisionWeight: number;
}

/**
 * Dynamic Online Inducing-Point Aggregation (Unlimited Sample Scaling):
 * Compresses arbitrarily large streams of online manual training samples (10, 100, 1000+ presses)
 * into well-conditioned, precision-weighted spatial centroids.
 * Preserves vertically/horizontally distinct screen targets even when anatomical vertical pupil span is narrow.
 */
export function compressToWeightedInducingCentroids(
  samples: CalibrationSample[],
  maxCentroids: number = 64
): WeightedCalibrationCentroid[] {
  const centroids: WeightedCalibrationCentroid[] = [];

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (!Number.isFinite(s.rawPupilX) || !Number.isFinite(s.rawPupilY)) continue;
    if (!Number.isFinite(s.targetX) || !Number.isFinite(s.targetY)) continue;

    const recencyWeight = 1.0 + (i / Math.max(1, samples.length - 1)) * 0.85;

    let merged = false;
    for (let c = 0; c < centroids.length; c++) {
      const cent = centroids[c];
      const pupilDist = Math.hypot(s.rawPupilX - cent.rawPupilX, s.rawPupilY - cent.rawPupilY);
      const targetDist = Math.hypot(s.targetX - cent.targetX, s.targetY - cent.targetY);

      // Merge only when training the same screen region or truly co-located ocular-and-screen pairs
      if ((pupilDist < 0.0018 && targetDist < 90) || (targetDist < 42 && pupilDist < 0.038)) {
        const alpha = 0.72;
        cent.rawPupilX = cent.rawPupilX * (1 - alpha) + s.rawPupilX * alpha;
        cent.rawPupilY = cent.rawPupilY * (1 - alpha) + s.rawPupilY * alpha;
        cent.targetX = cent.targetX * (1 - alpha) + s.targetX * alpha;
        cent.targetY = cent.targetY * (1 - alpha) + s.targetY * alpha;
        cent.headYaw = (cent.headYaw ?? 0) * (1 - alpha) + (s.headYaw ?? 0) * alpha;
        cent.headPitch = (cent.headPitch ?? 0) * (1 - alpha) + (s.headPitch ?? 0) * alpha;
        cent.headRoll = (cent.headRoll ?? 0) * (1 - alpha) + (s.headRoll ?? 0) * alpha;
        cent.precisionWeight += recencyWeight * 1.45;
        merged = true;
        break;
      }
    }

    if (!merged) {
      centroids.push({
        ...s,
        precisionWeight: recencyWeight,
      });
    }
  }

  if (centroids.length <= maxCentroids) {
    return centroids;
  }

  const primary = centroids.slice(0, 9);
  const rest = centroids
    .slice(9)
    .sort((a, b) => b.precisionWeight - a.precisionWeight)
    .slice(0, maxCentroids - 9);
  return [...primary, ...rest];
}

/**
 * Estimates orthogonal 3D head-pose parallax sensitivity gains (yawFactorX, pitchFactorY).
 * Applies an orthogonality gate based on the coefficient of determination (R^2 <= 0.65)
 * between head rotation and eye excursion so that natural head-eye coupling during corner
 * glances never attenuates peripheral cursor reach.
 */
function estimateOrthogonalHeadPoseGains(
  centroids: WeightedCalibrationCentroid[]
): { yawFactorX: number; pitchFactorY: number } {
  if (centroids.length < 5) {
    return { yawFactorX: 0, pitchFactorY: 0 };
  }

  let totalW = 0;
  let meanPx = 0, meanPy = 0, meanYaw = 0, meanPitch = 0;
  let sumYaw2 = 0, sumPitch2 = 0;
  for (const s of centroids) {
    const w = s.precisionWeight;
    const yaw = s.headYaw ?? 0;
    const pitch = s.headPitch ?? 0;
    totalW += w;
    meanPx += w * s.rawPupilX;
    meanPy += w * s.rawPupilY;
    meanYaw += w * yaw;
    meanPitch += w * pitch;
    sumYaw2 += w * yaw * yaw;
    sumPitch2 += w * pitch * pitch;
  }
  meanPx /= Math.max(1e-6, totalW);
  meanPy /= Math.max(1e-6, totalW);
  meanYaw /= Math.max(1e-6, totalW);
  meanPitch /= Math.max(1e-6, totalW);

  let covYawPx = 0, varPx = 0, varYaw = 0;
  let covPitchPy = 0, varPy = 0, varPitch = 0;
  for (const s of centroids) {
    const w = s.precisionWeight;
    const dx = s.rawPupilX - meanPx;
    const dy = s.rawPupilY - meanPy;
    const dyaw = (s.headYaw ?? 0) - meanYaw;
    const dpitch = (s.headPitch ?? 0) - meanPitch;
    covYawPx += w * dyaw * dx;
    varPx += w * dx * dx;
    varYaw += w * dyaw * dyaw;
    covPitchPy += w * dpitch * dy;
    varPy += w * dy * dy;
    varPitch += w * dpitch * dpitch;
  }
  const r2YawPx = (varYaw > 1e-6 && varPx > 1e-6) ? (covYawPx * covYawPx) / (varYaw * varPx) : 1;
  const r2PitchPy = (varPitch > 1e-6 && varPy > 1e-6) ? (covPitchPy * covPitchPy) / (varPitch * varPy) : 1;
  const orthoFactorYaw = Math.max(0, 1 - r2YawPx / 0.65);
  const orthoFactorPitch = Math.max(0, 1 - r2PitchPy / 0.65);

  let yawFactorX = 0;
  if (sumYaw2 > 0.02 && orthoFactorYaw > 0.05) {
    const A4x: number[][] = Array.from({ length: 4 }, () => new Array<number>(4).fill(0));
    const rhs4x = new Array<number>(4).fill(0);
    for (const s of centroids) {
      const w = s.precisionWeight;
      const f = [1, s.rawPupilX, s.rawPupilY, s.headYaw ?? 0];
      for (let r = 0; r < 4; r++) {
        rhs4x[r] += w * f[r] * s.targetX;
        for (let c = 0; c < 4; c++) {
          A4x[r][c] += w * f[r] * f[c];
        }
      }
    }
    A4x[1][1] += 1e-4;
    A4x[2][2] += 1e-4;
    A4x[3][3] += 0.05;
    const coef4x = solveLinearSystem(A4x, rhs4x);
    yawFactorX = Math.max(-500, Math.min(500, (coef4x[3] || 0) * orthoFactorYaw));
  }

  let pitchFactorY = 0;
  if (sumPitch2 > 0.02 && orthoFactorPitch > 0.05) {
    const A4y: number[][] = Array.from({ length: 4 }, () => new Array<number>(4).fill(0));
    const rhs4y = new Array<number>(4).fill(0);
    for (const s of centroids) {
      const w = s.precisionWeight;
      const f = [1, s.rawPupilX, s.rawPupilY, s.headPitch ?? 0];
      for (let r = 0; r < 4; r++) {
        rhs4y[r] += w * f[r] * s.targetY;
        for (let c = 0; c < 4; c++) {
          A4y[r][c] += w * f[r] * f[c];
        }
      }
    }
    A4y[1][1] += 1e-4;
    A4y[2][2] += 1e-4;
    A4y[3][3] += 0.05;
    const coef4y = solveLinearSystem(A4y, rhs4y);
    pitchFactorY = Math.max(-500, Math.min(500, (coef4y[3] || 0) * orthoFactorPitch));
  }

  return { yawFactorX, pitchFactorY };
}

/**
 * Evaluates a normalized 3x3 projective homography from whitened pupil (u, v)
 * to screen coordinates using target normalization (targetMean, targetScale).
 */
function evalNormalizedHomography(
  u: number,
  v: number,
  H: number[][],
  tMeanX: number,
  tMeanY: number,
  tScaleX: number,
  tScaleY: number
): { x: number; y: number; w: number } {
  const numX = H[0][0] * u + H[0][1] * v + H[0][2];
  const numY = H[1][0] * u + H[1][1] * v + H[1][2];
  const w = H[2][0] * u + H[2][1] * v + H[2][2];
  const invW = Math.abs(w) > 1e-6 ? 1.0 / w : 1.0;
  return {
    x: tMeanX + (numX * invW) * tScaleX,
    y: tMeanY + (numY * invW) * tScaleY,
    w,
  };
}

/**
 * Validates that a normalized 3x3 homography preserves orientation (positive Jacobian determinant
 * and no perspective horizon singularity) across the calibrated domain expanded by 0.65 standard units.
 */
function isHomographyWellConditioned(
  H: number[][],
  minU: number,
  maxU: number,
  minV: number,
  maxV: number,
  affDetSign: number
): boolean {
  const testUs = [minU - 0.65, (minU + maxU) * 0.5, maxU + 0.65];
  const testVs = [minV - 0.65, (minV + maxV) * 0.5, maxV + 0.65];
  for (const u of testUs) {
    for (const v of testVs) {
      const w = H[2][0] * u + H[2][1] * v + H[2][2];
      if (w <= 0.22) return false;
      const nx = H[0][0] * u + H[0][1] * v + H[0][2];
      const ny = H[1][0] * u + H[1][1] * v + H[1][2];
      const dXdu = (H[0][0] * w - nx * H[2][0]) / (w * w);
      const dXdv = (H[0][1] * w - nx * H[2][1]) / (w * w);
      const dYdu = (H[1][0] * w - ny * H[2][0]) / (w * w);
      const dYdv = (H[1][1] * w - ny * H[2][1]) / (w * w);
      const det = dXdu * dYdv - dXdv * dYdu;
      if (det * affDetSign <= 0.02) return false;
    }
  }
  return true;
}

/**
 * Fits a precision-weighted Hartley-normalized 3x3 Projective Homography from (u, v) -> (tX, tY)
 * via regularized Direct Linear Transformation (DLT).
 */
function solveNormalizedHomography(
  pointsUV: Array<{ u: number; v: number }>,
  targetsNorm: Array<{ tx: number; ty: number }>,
  weights: number[],
  reg: number = 1e-6
): number[][] {
  const A: number[][] = Array.from({ length: 8 }, () => new Array<number>(8).fill(0));
  const b = new Array<number>(8).fill(0);

  for (let i = 0; i < pointsUV.length; i++) {
    const { u, v } = pointsUV[i];
    const { tx, ty } = targetsNorm[i];
    const w = weights[i];
    const r1 = [u, v, 1, 0, 0, 0, -tx * u, -tx * v];
    const r2 = [0, 0, 0, u, v, 1, -ty * u, -ty * v];
    for (let j = 0; j < 8; j++) {
      for (let k = 0; k < 8; k++) {
        A[j][k] += w * (r1[j] * r1[k] + r2[j] * r2[k]);
      }
      b[j] += w * (r1[j] * tx + r2[j] * ty);
    }
  }

  for (let j = 0; j < 6; j++) A[j][j] += reg * 0.1;
  A[6][6] += reg;
  A[7][7] += reg;

  const h = solveLinearSystem(A, b);
  return [
    [h[0], h[1], h[2]],
    [h[3], h[4], h[5]],
    [h[6], h[7], 1.0],
  ];
}

/**
 * M-QPM (Mahalanobis-Whitened Exact Quadrant Positioning Matrix):
 * Adaptive multi-regime solver that calculates the exact pupil-to-screen quadrant transformation
 * for 1, 2, 3, 4, or N trained points with zero residual error at calibrated coordinates:
 * - N = 1: Exact translation anchor + physiological aspect scaling gain
 * - N = 2: Exact anisotropic/similarity alignment through both points
 * - N = 3: Exact 6-DOF Affine matrix passing through all 3 points
 * - N = 4: Exact Hartley-Normalized Planar Projective Homography capturing keystone eye geometry
 * - N >= 5: Global Normalized Affine-Projective Base + Zero-Residual Whitened TPS Field with
 *           smooth out-of-hull envelope decay for unclipped corner reach.
 */
export function fitQuadrantPupilMatrix(
  samples: CalibrationSample[]
): QuadrantMatrixModel | null {
  const rawCentroids = compressToWeightedInducingCentroids(samples, 64);
  const N = rawCentroids.length;
  if (N === 0) return null;

  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 720;

  // Estimate orthogonal head-pose sensitivity gains when sufficient samples exist
  const { yawFactorX, pitchFactorY } = estimateOrthogonalHeadPoseGains(rawCentroids);

  let totalW = 0;
  let meanX = 0, meanY = 0;
  let tMeanX = 0, tMeanY = 0;
  for (const s of rawCentroids) {
    const w = s.precisionWeight;
    const tx = s.targetX - yawFactorX * (s.headYaw ?? 0);
    const ty = s.targetY - pitchFactorY * (s.headPitch ?? 0);
    totalW += w;
    meanX += w * s.rawPupilX;
    meanY += w * s.rawPupilY;
    tMeanX += w * tx;
    tMeanY += w * ty;
  }
  meanX /= Math.max(1e-6, totalW);
  meanY /= Math.max(1e-6, totalW);
  tMeanX /= Math.max(1e-6, totalW);
  tMeanY /= Math.max(1e-6, totalW);

  let varX = 0, varY = 0;
  let tVarX = 0, tVarY = 0;
  for (const s of rawCentroids) {
    const w = s.precisionWeight;
    const tx = s.targetX - yawFactorX * (s.headYaw ?? 0);
    const ty = s.targetY - pitchFactorY * (s.headPitch ?? 0);
    varX += w * (s.rawPupilX - meanX) ** 2;
    varY += w * (s.rawPupilY - meanY) ** 2;
    tVarX += w * (tx - tMeanX) ** 2;
    tVarY += w * (ty - tMeanY) ** 2;
  }

  const scaleX = N === 1 ? 0.045 : Math.max(0.004, Math.sqrt(varX / Math.max(1e-6, totalW)));
  const scaleY = N === 1 ? 0.045 : Math.max(0.004, Math.sqrt(varY / Math.max(1e-6, totalW)));
  const targetScaleX = N === 1 ? screenW * 0.35 : Math.max(24, Math.sqrt(tVarX / Math.max(1e-6, totalW)));
  const targetScaleY = N === 1 ? screenH * 0.35 : Math.max(24, Math.sqrt(tVarY / Math.max(1e-6, totalW)));

  const pointsUV = rawCentroids.map(s => ({
    u: (s.rawPupilX - meanX) / scaleX,
    v: (s.rawPupilY - meanY) / scaleY,
  }));

  const targetsAdj = rawCentroids.map(s => ({
    x: s.targetX - yawFactorX * (s.headYaw ?? 0),
    y: s.targetY - pitchFactorY * (s.headPitch ?? 0),
  }));

  const targetsNorm = targetsAdj.map(t => ({
    tx: (t.x - tMeanX) / targetScaleX,
    ty: (t.y - tMeanY) / targetScaleY,
  }));

  let hullMinU = Infinity, hullMaxU = -Infinity;
  let hullMinV = Infinity, hullMaxV = -Infinity;
  for (const p of pointsUV) {
    if (p.u < hullMinU) hullMinU = p.u;
    if (p.u > hullMaxU) hullMaxU = p.u;
    if (p.v < hullMinV) hullMinV = p.v;
    if (p.v > hullMaxV) hullMaxV = p.v;
  }

  const defaultHom = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  // Regime 1: Single-point exact anchor
  if (N === 1) {
    const model: QuadrantMatrixModel = {
      regime: '1pt',
      meanX,
      meanY,
      scaleX,
      scaleY,
      targetMeanX: tMeanX,
      targetMeanY: tMeanY,
      targetScaleX,
      targetScaleY,
      homographyNorm: defaultHom,
      affineNormX: [0, 1, 0],
      affineNormY: [0, 0, 1],
      useHomographyBase: false,
      controlPointsUV: pointsUV,
      residualWeightsX: [0],
      residualWeightsY: [0],
      residualAffineX: [0, 0, 0],
      residualAffineY: [0, 0, 0],
      yawFactorX,
      pitchFactorY,
      hullMinU,
      hullMaxU,
      hullMinV,
      hullMaxV,
      rmsePx: 0,
    };
    return model;
  }

  // Regime 2: Two-point exact transformation
  if (N === 2) {
    const du = pointsUV[1].u - pointsUV[0].u;
    const dv = pointsUV[1].v - pointsUV[0].v;
    const dtx = targetsNorm[1].tx - targetsNorm[0].tx;
    const dty = targetsNorm[1].ty - targetsNorm[0].ty;

    let affX: [number, number, number];
    let affY: [number, number, number];

    if (Math.abs(du) > 0.25 && Math.abs(dv) > 0.25) {
      const kx = dtx / du;
      const ky = dty / dv;
      affX = [targetsNorm[0].tx - kx * pointsUV[0].u, kx, 0];
      affY = [targetsNorm[0].ty - ky * pointsUV[0].v, 0, ky];
    } else {
      const denom = Math.max(1e-6, du * du + dv * dv);
      const a = (du * dtx + dv * dty) / denom;
      const b = (du * dty - dv * dtx) / denom;
      affX = [targetsNorm[0].tx - (a * pointsUV[0].u - b * pointsUV[0].v), a, -b];
      affY = [targetsNorm[0].ty - (b * pointsUV[0].u + a * pointsUV[0].v), b, a];
    }

    const model: QuadrantMatrixModel = {
      regime: '2pt',
      meanX,
      meanY,
      scaleX,
      scaleY,
      targetMeanX: tMeanX,
      targetMeanY: tMeanY,
      targetScaleX,
      targetScaleY,
      homographyNorm: defaultHom,
      affineNormX: affX,
      affineNormY: affY,
      useHomographyBase: false,
      controlPointsUV: pointsUV,
      residualWeightsX: [0, 0],
      residualWeightsY: [0, 0],
      residualAffineX: [0, 0, 0],
      residualAffineY: [0, 0, 0],
      yawFactorX,
      pitchFactorY,
      hullMinU,
      hullMaxU,
      hullMinV,
      hullMaxV,
    };
    model.rmsePx = computeQuadrantRmse(rawCentroids, model);
    return model;
  }

  // Fit Precision-Weighted Normalized Affine Base [1, u, v]
  const AAff: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bAffX = [0, 0, 0];
  const bAffY = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const w = rawCentroids[i].precisionWeight;
    const f = [1, pointsUV[i].u, pointsUV[i].v];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        AAff[r][c] += w * f[r] * f[c];
      }
      bAffX[r] += w * f[r] * targetsNorm[i].tx;
      bAffY[r] += w * f[r] * targetsNorm[i].ty;
    }
  }
  const affReg = N === 3 ? 1e-10 : 1e-6;
  AAff[1][1] += affReg;
  AAff[2][2] += affReg;

  const solAffX = solveLinearSystem(AAff, bAffX);
  const solAffY = solveLinearSystem(AAff, bAffY);
  const affineNormX: [number, number, number] = [solAffX[0], solAffX[1], solAffX[2]];
  const affineNormY: [number, number, number] = [solAffY[0], solAffY[1], solAffY[2]];
  const affDet = affineNormX[1] * affineNormY[2] - affineNormX[2] * affineNormY[1];
  const affDetSign = affDet >= 0 ? 1 : -1;

  // Regime 3: Three-point exact 6-DOF affine plane
  if (N === 3) {
    const model: QuadrantMatrixModel = {
      regime: '3pt-affine',
      meanX,
      meanY,
      scaleX,
      scaleY,
      targetMeanX: tMeanX,
      targetMeanY: tMeanY,
      targetScaleX,
      targetScaleY,
      homographyNorm: defaultHom,
      affineNormX,
      affineNormY,
      useHomographyBase: false,
      controlPointsUV: pointsUV,
      residualWeightsX: [0, 0, 0],
      residualWeightsY: [0, 0, 0],
      residualAffineX: [0, 0, 0],
      residualAffineY: [0, 0, 0],
      yawFactorX,
      pitchFactorY,
      hullMinU,
      hullMaxU,
      hullMinV,
      hullMaxV,
    };
    model.rmsePx = computeQuadrantRmse(rawCentroids, model);
    return model;
  }

  // Fit Hartley-Normalized 3x3 Projective Homography
  const weightsArr = rawCentroids.map(s => s.precisionWeight);
  const homographyNorm = solveNormalizedHomography(
    pointsUV,
    targetsNorm,
    weightsArr,
    N === 4 ? 1e-9 : 1e-4
  );

  const homographySafe =
    Math.abs(affDet) > 1e-4 &&
    isHomographyWellConditioned(homographyNorm, hullMinU, hullMaxU, hullMinV, hullMaxV, affDetSign);

  let sqErrAff = 0;
  let sqErrHom = 0;
  for (let i = 0; i < N; i++) {
    const { u, v } = pointsUV[i];
    const ax = tMeanX + (affineNormX[0] + affineNormX[1] * u + affineNormX[2] * v) * targetScaleX;
    const ay = tMeanY + (affineNormY[0] + affineNormY[1] * u + affineNormY[2] * v) * targetScaleY;
    sqErrAff += (ax - targetsAdj[i].x) ** 2 + (ay - targetsAdj[i].y) ** 2;

    if (homographySafe) {
      const hp = evalNormalizedHomography(u, v, homographyNorm, tMeanX, tMeanY, targetScaleX, targetScaleY);
      sqErrHom += (hp.x - targetsAdj[i].x) ** 2 + (hp.y - targetsAdj[i].y) ** 2;
    }
  }

  const useHomographyBase = homographySafe && (N === 4 || sqErrHom <= sqErrAff * 1.15);

  // Regime 4: Exact 4-corner Projective Homography if well-conditioned and zero residual
  if (N === 4 && useHomographyBase && Math.sqrt(sqErrHom / 4) < 3.0) {
    const model: QuadrantMatrixModel = {
      regime: '4pt-homography',
      meanX,
      meanY,
      scaleX,
      scaleY,
      targetMeanX: tMeanX,
      targetMeanY: tMeanY,
      targetScaleX,
      targetScaleY,
      homographyNorm,
      affineNormX,
      affineNormY,
      useHomographyBase: true,
      controlPointsUV: pointsUV,
      residualWeightsX: [0, 0, 0, 0],
      residualWeightsY: [0, 0, 0, 0],
      residualAffineX: [0, 0, 0],
      residualAffineY: [0, 0, 0],
      yawFactorX,
      pitchFactorY,
      hullMinU,
      hullMaxU,
      hullMinV,
      hullMaxV,
    };
    model.rmsePx = computeQuadrantRmse(rawCentroids, model);
    return model;
  }

  // Regime 5: N >= 4 Exact Zero-Residual Whitened TPS Field over Global Homography/Affine Base
  const resX = new Array<number>(N);
  const resY = new Array<number>(N);
  for (let i = 0; i < N; i++) {
    const { u, v } = pointsUV[i];
    let baseX: number;
    let baseY: number;
    if (useHomographyBase) {
      const hp = evalNormalizedHomography(u, v, homographyNorm, tMeanX, tMeanY, targetScaleX, targetScaleY);
      baseX = hp.x;
      baseY = hp.y;
    } else {
      baseX = tMeanX + (affineNormX[0] + affineNormX[1] * u + affineNormX[2] * v) * targetScaleX;
      baseY = tMeanY + (affineNormY[0] + affineNormY[1] * u + affineNormY[2] * v) * targetScaleY;
    }
    resX[i] = targetsAdj[i].x - baseX;
    resY[i] = targetsAdj[i].y - baseY;
  }

  // Solve Thin-Plate Spline in whitened isotropic (u, v) space with ultra-tight adaptive precision diagonal
  const M = N + 3;
  const L: number[][] = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  const bX = new Array<number>(M).fill(0);
  const bY = new Array<number>(M).fill(0);

  for (let i = 0; i < N; i++) {
    let minNeighborUV = Infinity;
    for (let j = 0; j < N; j++) {
      if (i === j) continue;
      const d = Math.hypot(pointsUV[i].u - pointsUV[j].u, pointsUV[i].v - pointsUV[j].v);
      if (d < minNeighborUV) minNeighborUV = d;
      L[i][j] = tpsRadialKernel(d);
    }
    // Nearly exact zero-residual interpolation on every distinct trained centroid;
    // tiny precision-scaled nugget engages only when centroids sit very close in (u, v)
    const baseDiag = minNeighborUV < 0.08 ? 2e-4 : 1e-7;
    L[i][i] = baseDiag / Math.max(1.0, rawCentroids[i].precisionWeight);

    L[i][N] = 1.0;
    L[i][N + 1] = pointsUV[i].u;
    L[i][N + 2] = pointsUV[i].v;

    L[N][i] = 1.0;
    L[N + 1][i] = pointsUV[i].u;
    L[N + 2][i] = pointsUV[i].v;

    bX[i] = resX[i];
    bY[i] = resY[i];
  }

  L[N][N] = 1e-8;
  L[N + 1][N + 1] = 1e-8;
  L[N + 2][N + 2] = 1e-8;

  const solResX = solveLinearSystem(L, bX);
  const solResY = solveLinearSystem(L, bY);

  const model: QuadrantMatrixModel = {
    regime: 'hybrid-tps',
    meanX,
    meanY,
    scaleX,
    scaleY,
    targetMeanX: tMeanX,
    targetMeanY: tMeanY,
    targetScaleX,
    targetScaleY,
    homographyNorm,
    affineNormX,
    affineNormY,
    useHomographyBase,
    controlPointsUV: pointsUV,
    residualWeightsX: solResX.slice(0, N),
    residualWeightsY: solResY.slice(0, N),
    residualAffineX: [solResX[N], solResX[N + 1], solResX[N + 2]],
    residualAffineY: [solResY[N], solResY[N + 1], solResY[N + 2]],
    yawFactorX,
    pitchFactorY,
    hullMinU,
    hullMaxU,
    hullMinV,
    hullMaxV,
  };
  model.rmsePx = computeQuadrantRmse(rawCentroids, model);
  return model;
}

function computeQuadrantRmse(
  centroids: WeightedCalibrationCentroid[],
  model: QuadrantMatrixModel
): number {
  if (centroids.length === 0) return 0;
  let sqErr = 0;
  for (const c of centroids) {
    const pred = evaluateQuadrantPupilMatrix(
      c.rawPupilX,
      c.rawPupilY,
      c.headYaw ?? 0,
      c.headPitch ?? 0,
      model
    );
    sqErr += (pred.x - c.targetX) ** 2 + (pred.y - c.targetY) ** 2;
  }
  return Math.round(Math.sqrt(sqErr / centroids.length));
}

/**
 * Evaluates the Mahalanobis-Whitened Exact Quadrant Positioning Matrix (M-QPM)
 */
export function evaluateQuadrantPupilMatrix(
  x: number,
  y: number,
  yaw: number = 0,
  pitch: number = 0,
  model: QuadrantMatrixModel
): { x: number; y: number } {
  const u = (x - model.meanX) / Math.max(1e-5, model.scaleX);
  const v = (y - model.meanY) / Math.max(1e-5, model.scaleY);

  let baseX: number;
  let baseY: number;

  if (model.useHomographyBase) {
    const hp = evalNormalizedHomography(
      u,
      v,
      model.homographyNorm,
      model.targetMeanX,
      model.targetMeanY,
      model.targetScaleX,
      model.targetScaleY
    );
    if (hp.w > 0.2) {
      baseX = hp.x;
      baseY = hp.y;
    } else {
      baseX = model.targetMeanX + (model.affineNormX[0] + model.affineNormX[1] * u + model.affineNormX[2] * v) * model.targetScaleX;
      baseY = model.targetMeanY + (model.affineNormY[0] + model.affineNormY[1] * u + model.affineNormY[2] * v) * model.targetScaleY;
    }
  } else {
    baseX = model.targetMeanX + (model.affineNormX[0] + model.affineNormX[1] * u + model.affineNormX[2] * v) * model.targetScaleX;
    baseY = model.targetMeanY + (model.affineNormY[0] + model.affineNormY[1] * u + model.affineNormY[2] * v) * model.targetScaleY;
  }

  let resX = 0;
  let resY = 0;
  if (model.regime === 'hybrid-tps' && model.controlPointsUV.length > 0) {
    const linResX = model.residualAffineX[0] + model.residualAffineX[1] * u + model.residualAffineX[2] * v;
    const linResY = model.residualAffineY[0] + model.residualAffineY[1] * u + model.residualAffineY[2] * v;

    let radialX = 0;
    let radialY = 0;
    for (let i = 0; i < model.controlPointsUV.length; i++) {
      const cp = model.controlPointsUV[i];
      const d = Math.hypot(u - cp.u, v - cp.v);
      const k = tpsRadialKernel(d);
      radialX += model.residualWeightsX[i] * k;
      radialY += model.residualWeightsY[i] * k;
    }

    // Smoothly attenuate non-linear bending far outside calibrated hull so corner extrapolation
    // relies on the unclipped global affine/projective surface without spline overshoot
    const outU = Math.max(0, model.hullMinU - u, u - model.hullMaxU);
    const outV = Math.max(0, model.hullMinV - v, v - model.hullMaxV);
    const outMargin = Math.hypot(outU, outV);
    const hullBlend = outMargin <= 0.45 ? 1.0 : Math.exp(-0.35 * (outMargin - 0.45) ** 2);

    resX = (linResX + radialX) * hullBlend;
    resY = (linResY + radialY) * hullBlend;
  }

  return {
    x: baseX + resX + yaw * model.yawFactorX,
    y: baseY + resY + pitch * model.pitchFactorY,
  };
}

/**
 * Scale-Normalized & Precision-Weighted Thin-Plate Splines (TPS) Calibration:
 * Whitens pupil axes by (scaleX, scaleY) to eliminate horizontal/vertical anisotropy
 * while decaying diagonal regularization as accumulated precision grows.
 */
export function fitThinPlateSpline(
  samples: CalibrationSample[],
  lambda: number = 0.002
): ThinPlateSplineModel | null {
  if (samples.length < 3) return null;

  const centroids = compressToWeightedInducingCentroids(samples, 64);
  const N = centroids.length;
  if (N < 3) return null;

  const { yawFactorX, pitchFactorY } = estimateOrthogonalHeadPoseGains(centroids);

  let totalW = 0, meanX = 0, meanY = 0;
  for (const s of centroids) {
    totalW += s.precisionWeight;
    meanX += s.precisionWeight * s.rawPupilX;
    meanY += s.precisionWeight * s.rawPupilY;
  }
  meanX /= Math.max(1e-6, totalW);
  meanY /= Math.max(1e-6, totalW);

  let varX = 0, varY = 0;
  for (const s of centroids) {
    varX += s.precisionWeight * (s.rawPupilX - meanX) ** 2;
    varY += s.precisionWeight * (s.rawPupilY - meanY) ** 2;
  }
  const scaleX = Math.max(0.005, Math.sqrt(varX / Math.max(1e-6, totalW)));
  const scaleY = Math.max(0.005, Math.sqrt(varY / Math.max(1e-6, totalW)));

  // Step 2: Solve Whitened TPS kernel on the head-pose-corrected spatial targets
  const M = N + 3;
  const L: number[][] = Array.from({ length: M }, () => new Array<number>(M).fill(0));
  const bX: number[] = new Array<number>(M).fill(0);
  const bY: number[] = new Array<number>(M).fill(0);

  const sampleCountFactor = 1.0 / Math.sqrt(Math.max(1, samples.length / 9));
  const baseAdaptiveLambda = lambda * 0.12 * sampleCountFactor;

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        L[i][j] = baseAdaptiveLambda / Math.max(1.0, centroids[i].precisionWeight);
      } else {
        const dx = (centroids[i].rawPupilX - centroids[j].rawPupilX) / scaleX;
        const dy = (centroids[i].rawPupilY - centroids[j].rawPupilY) / scaleY;
        const r = Math.hypot(dx, dy);
        L[i][j] = tpsRadialKernel(r);
      }
    }
    const ui = centroids[i].rawPupilX / scaleX;
    const vi = centroids[i].rawPupilY / scaleY;
    L[i][N] = 1.0;
    L[i][N + 1] = ui;
    L[i][N + 2] = vi;

    L[N][i] = 1.0;
    L[N + 1][i] = ui;
    L[N + 2][i] = vi;

    bX[i] = centroids[i].targetX - yawFactorX * (centroids[i].headYaw ?? 0);
    bY[i] = centroids[i].targetY - pitchFactorY * (centroids[i].headPitch ?? 0);
  }

  L[N][N] = 1e-8;
  L[N + 1][N + 1] = 1e-8;
  L[N + 2][N + 2] = 1e-8;

  const solX = solveLinearSystem(L, bX);
  const solY = solveLinearSystem(L, bY);

  const weightsX = solX.slice(0, N);
  const weightsY = solY.slice(0, N);
  // Rescale linear coefficients back to raw (x, y)
  const affineX: [number, number, number] = [solX[N], solX[N + 1] / scaleX, solX[N + 2] / scaleY];
  const affineY: [number, number, number] = [solY[N], solY[N + 1] / scaleX, solY[N + 2] / scaleY];

  const controlPoints = centroids.map(s => ({
    x: s.rawPupilX,
    y: s.rawPupilY,
    yaw: s.headYaw ?? 0,
    pitch: s.headPitch ?? 0
  }));

  const model: ThinPlateSplineModel = {
    controlPoints,
    weightsX,
    weightsY,
    affineX,
    affineY,
    yawFactorX,
    pitchFactorY,
    scaleX,
    scaleY
  };

  let totalSqErr = 0;
  for (const s of centroids) {
    const pred = evaluateThinPlateSpline(s.rawPupilX, s.rawPupilY, s.headYaw ?? 0, s.headPitch ?? 0, model);
    const dx = pred.x - s.targetX;
    const dy = pred.y - s.targetY;
    totalSqErr += dx * dx + dy * dy;
  }
  model.rmsePx = Math.round(Math.sqrt(totalSqErr / N));

  return model;
}

/**
 * Evaluates Thin-Plate Spline (TPS) Model (supports whitened anisotropic scales or legacy isotropic)
 */
export function evaluateThinPlateSpline(
  x: number,
  y: number,
  yaw: number = 0,
  pitch: number = 0,
  model: ThinPlateSplineModel
): { x: number; y: number } {
  let predX = model.affineX[0] + model.affineX[1] * x + model.affineX[2] * y;
  let predY = model.affineY[0] + model.affineY[1] * x + model.affineY[2] * y;

  const sx = model.scaleX || 1.0;
  const sy = model.scaleY || 1.0;

  for (let i = 0; i < model.controlPoints.length; i++) {
    const cp = model.controlPoints[i];
    const dx = (x - cp.x) / sx;
    const dy = (y - cp.y) / sy;
    const r = Math.hypot(dx, dy);
    const u = tpsRadialKernel(r);
    predX += model.weightsX[i] * u;
    predY += model.weightsY[i] * u;
  }

  predX += yaw * model.yawFactorX;
  predY += pitch * model.pitchFactorY;

  return { x: predX, y: predY };
}

/**
 * Fits a Scale-Normalized & Precision-Weighted Gaussian Process / RBF Kernel Model
 */
export function fitRbfKernelModel(
  samples: CalibrationSample[],
  gamma: number = 1.5,
  lambda: number = 0.005
): RbfKernelModel | null {
  if (samples.length < 4) return null;

  const centroids = compressToWeightedInducingCentroids(samples, 64);
  const N = centroids.length;
  if (N < 4) return null;

  let meanX = 0;
  let meanY = 0;
  let totalW = 0;
  for (const s of centroids) {
    meanX += s.rawPupilX * s.precisionWeight;
    meanY += s.rawPupilY * s.precisionWeight;
    totalW += s.precisionWeight;
  }
  meanX /= totalW;
  meanY /= totalW;

  let varX = 0;
  let varY = 0;
  for (const s of centroids) {
    varX += s.precisionWeight * (s.rawPupilX - meanX) ** 2;
    varY += s.precisionWeight * (s.rawPupilY - meanY) ** 2;
  }
  const scaleX = Math.max(0.005, Math.sqrt(varX / totalW));
  const scaleY = Math.max(0.005, Math.sqrt(varY / totalW));

  const ALin: number[][] = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  const bLinX = [0, 0, 0];
  const bLinY = [0, 0, 0];

  for (const s of centroids) {
    const w = s.precisionWeight;
    const nx = (s.rawPupilX - meanX) / scaleX;
    const ny = (s.rawPupilY - meanY) / scaleY;
    const feat = [1.0, nx, ny];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        ALin[i][j] += w * feat[i] * feat[j];
      }
      bLinX[i] += w * feat[i] * s.targetX;
      bLinY[i] += w * feat[i] * s.targetY;
    }
  }
  ALin[1][1] += 1e-6;
  ALin[2][2] += 1e-6;

  const normLinX = solveLinearSystem(ALin, bLinX);
  const normLinY = solveLinearSystem(ALin, bLinY);

  const wxX = normLinX[1] / scaleX;
  const wyX = normLinX[2] / scaleY;
  const w0X = normLinX[0] - wxX * meanX - wyX * meanY;

  const wxY = normLinY[1] / scaleX;
  const wyY = normLinY[2] / scaleY;
  const w0Y = normLinY[0] - wxY * meanX - wyY * meanY;

  let rbfSumYaw2 = 0;
  let rbfSumPitch2 = 0;
  let rbfSumYawResX = 0;
  let rbfSumPitchResY = 0;
  for (const s of centroids) {
    const yaw = s.headYaw ?? 0;
    const pitch = s.headPitch ?? 0;
    const pX = w0X + wxX * s.rawPupilX + wyX * s.rawPupilY;
    const pY = w0Y + wxY * s.rawPupilX + wyY * s.rawPupilY;
    rbfSumYaw2 += s.precisionWeight * yaw * yaw;
    rbfSumPitch2 += s.precisionWeight * pitch * pitch;
    rbfSumYawResX += s.precisionWeight * yaw * (s.targetX - pX);
    rbfSumPitchResY += s.precisionWeight * pitch * (s.targetY - pY);
  }
  const wyawX = rbfSumYaw2 > 0.02 ? Math.max(-500, Math.min(500, rbfSumYawResX / (rbfSumYaw2 + 0.35))) : 0;
  const wpitchY = rbfSumPitch2 > 0.02 ? Math.max(-500, Math.min(500, rbfSumPitchResY / (rbfSumPitch2 + 0.35))) : 0;

  const linX: [number, number, number, number, number] = [w0X, wxX, wyX, wyawX, 0];
  const linY: [number, number, number, number, number] = [w0Y, wxY, wyY, 0, wpitchY];

  const adaptiveGamma = gamma * Math.min(2.8, 1.0 + Math.max(0, N - 9) * 0.035);

  const K: number[][] = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const resX: number[] = new Array<number>(N).fill(0);
  const resY: number[] = new Array<number>(N).fill(0);

  const supportVectors = centroids.map(s => ({
    x: s.rawPupilX,
    y: s.rawPupilY,
    yaw: s.headYaw ?? 0,
    pitch: s.headPitch ?? 0
  }));

  for (let i = 0; i < N; i++) {
    const s = centroids[i];
    const priorX = linX[0] + linX[1] * s.rawPupilX + linX[2] * s.rawPupilY + linX[3] * (s.headYaw ?? 0);
    const priorY = linY[0] + linY[1] * s.rawPupilX + linY[2] * s.rawPupilY + linY[4] * (s.headPitch ?? 0);
    resX[i] = s.targetX - priorX;
    resY[i] = s.targetY - priorY;

    const localNoiseLambda = lambda / Math.max(1.0, s.precisionWeight);
    for (let j = 0; j < N; j++) {
      const dx = (supportVectors[i].x - supportVectors[j].x) / scaleX;
      const dy = (supportVectors[i].y - supportVectors[j].y) / scaleY;
      const distSq = dx * dx + dy * dy;
      K[i][j] = Math.exp(-adaptiveGamma * distSq) + (i === j ? localNoiseLambda : 0);
    }
  }

  const dualWeightsX = solveLinearSystem(K, resX);
  const dualWeightsY = solveLinearSystem(K, resY);

  const model: RbfKernelModel = {
    supportVectors,
    dualWeightsX,
    dualWeightsY,
    linearX: linX,
    linearY: linY,
    gamma: adaptiveGamma,
    scaleX,
    scaleY
  };

  let sqErr = 0;
  for (const s of centroids) {
    const pred = evaluateRbfKernelGaze(s.rawPupilX, s.rawPupilY, s.headYaw ?? 0, s.headPitch ?? 0, model);
    sqErr += (pred.x - s.targetX) ** 2 + (pred.y - s.targetY) ** 2;
  }
  model.rmsePx = Math.round(Math.sqrt(sqErr / N));

  return model;
}

/**
 * Evaluates the Gaussian Process / RBF Kernel Ridge Regression Model
 */
export function evaluateRbfKernelGaze(
  x: number,
  y: number,
  yaw: number = 0,
  pitch: number = 0,
  model: RbfKernelModel
): { x: number; y: number } {
  let predX = model.linearX[0] + model.linearX[1] * x + model.linearX[2] * y + model.linearX[3] * yaw + model.linearX[4] * pitch;
  let predY = model.linearY[0] + model.linearY[1] * x + model.linearY[2] * y + model.linearY[3] * yaw + model.linearY[4] * pitch;

  const sx = model.scaleX || 0.15;
  const sy = model.scaleY || 0.15;

  for (let i = 0; i < model.supportVectors.length; i++) {
    const sv = model.supportVectors[i];
    const dx = (x - sv.x) / sx;
    const dy = (y - sv.y) / sy;
    const distSq = dx * dx + dy * dy;
    const kVal = Math.exp(-model.gamma * distSq);
    predX += model.dualWeightsX[i] * kVal;
    predY += model.dualWeightsY[i] * kVal;
  }

  return { x: predX, y: predY };
}

function matMul3x3(A: number[][], B: number[][]): number[][] {
  const C = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      C[r][c] = A[r][0] * B[0][c] + A[r][1] * B[1][c] + A[r][2] * B[2][c];
    }
  }
  return C;
}

/**
 * Hartley-Normalized Planar Projective Homography (DLT):
 * Standardizes pupil coordinates and pixel coordinates to zero mean / unit scale before solving
 * the 8x8 linear system, then composes H = T_target^-1 * H_norm * T_pupil and normalizes H[2][2] = 1.0.
 */
export function fitProjectiveHomography(samples: CalibrationSample[]): ProjectiveModel | null {
  const centroids = compressToWeightedInducingCentroids(samples, 64);
  const N = centroids.length;
  if (N < 4) return null;

  let totalW = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  for (const s of centroids) {
    const w = s.precisionWeight;
    totalW += w;
    mx += w * s.rawPupilX;
    my += w * s.rawPupilY;
    tmx += w * s.targetX;
    tmy += w * s.targetY;
  }
  mx /= totalW;
  my /= totalW;
  tmx /= totalW;
  tmy /= totalW;

  let vx = 0, vy = 0, tvx = 0, tvy = 0;
  for (const s of centroids) {
    const w = s.precisionWeight;
    vx += w * (s.rawPupilX - mx) ** 2;
    vy += w * (s.rawPupilY - my) ** 2;
    tvx += w * (s.targetX - tmx) ** 2;
    tvy += w * (s.targetY - tmy) ** 2;
  }
  const sx = Math.max(0.005, Math.sqrt(vx / totalW));
  const sy = Math.max(0.005, Math.sqrt(vy / totalW));
  const tsx = Math.max(24, Math.sqrt(tvx / totalW));
  const tsy = Math.max(24, Math.sqrt(tvy / totalW));

  const pointsUV = centroids.map(s => ({ u: (s.rawPupilX - mx) / sx, v: (s.rawPupilY - my) / sy }));
  const targetsNorm = centroids.map(s => ({ tx: (s.targetX - tmx) / tsx, ty: (s.targetY - tmy) / tsy }));
  const weights = centroids.map(s => s.precisionWeight);

  const HNorm = solveNormalizedHomography(pointsUV, targetsNorm, weights, N === 4 ? 1e-8 : 1e-5);

  const TPupil = [
    [1 / sx, 0, -mx / sx],
    [0, 1 / sy, -my / sy],
    [0, 0, 1],
  ];
  const TTargetInv = [
    [tsx, 0, tmx],
    [0, tsy, tmy],
    [0, 0, 1],
  ];

  const HRaw = matMul3x3(TTargetInv, matMul3x3(HNorm, TPupil));
  const normScale = Math.abs(HRaw[2][2]) > 1e-8 ? HRaw[2][2] : 1.0;
  const H = [
    [HRaw[0][0] / normScale, HRaw[0][1] / normScale, HRaw[0][2] / normScale],
    [HRaw[1][0] / normScale, HRaw[1][1] / normScale, HRaw[1][2] / normScale],
    [HRaw[2][0] / normScale, HRaw[2][1] / normScale, 1.0],
  ];

  const { yawFactorX, pitchFactorY } = estimateOrthogonalHeadPoseGains(centroids);

  const projModel: ProjectiveModel = {
    H,
    h: [
      H[0][0], H[0][1], H[0][2],
      H[1][0], H[1][1], H[1][2],
      H[2][0], H[2][1], 1.0,
    ],
    radialK: 0.0,
    yawFactorX,
    pitchFactorY
  };

  let totalSqErrProj = 0;
  for (const s of centroids) {
    const pred = evaluateProjectiveHomography(s.rawPupilX, s.rawPupilY, s.headYaw ?? 0, s.headPitch ?? 0, projModel);
    const dx = pred.x - s.targetX;
    const dy = pred.y - s.targetY;
    totalSqErrProj += dx * dx + dy * dy;
  }
  projModel.rmsePx = Math.round(Math.sqrt(totalSqErrProj / N));

  return projModel;
}

/**
 * Evaluates Projective Homography Model
 */
export function evaluateProjectiveHomography(
  x: number,
  y: number,
  yaw: number = 0,
  pitch: number = 0,
  model: ProjectiveModel
): { x: number; y: number } {
  const H = model.H;
  const u = H[0][0] * x + H[0][1] * y + H[0][2];
  const v = H[1][0] * x + H[1][1] * y + H[1][2];
  const w = H[2][0] * x + H[2][1] * y + H[2][2];

  const scale = Math.abs(w) > 1e-6 ? 1.0 / w : 1.0;
  let predX = u * scale;
  let predY = v * scale;

  predX += yaw * model.yawFactorX;
  predY += pitch * model.pitchFactorY;

  return { x: predX, y: predY };
}

/**
 * Unified Gaze Evaluator: Dispatches to M-QPM Quadrant Matrix, Whitened TPS, Polynomial Ridge, or Hartley Projective
 */
export function evaluateCalibratedGaze(
  x: number,
  y: number,
  yaw: number = 0,
  pitch: number = 0,
  modelOrCoeffs: CalibrationMatrixCoeffs | QuadrantMatrixModel | ThinPlateSplineModel | ProjectiveModel | RbfKernelModel | null | undefined,
  overrideAlgorithm?: CalibrationAlgorithm
): { x: number; y: number } | null {
  if (!modelOrCoeffs) return null;

  if ('regime' in modelOrCoeffs && 'controlPointsUV' in modelOrCoeffs) {
    return evaluateQuadrantPupilMatrix(x, y, yaw, pitch, modelOrCoeffs);
  }

  if ('controlPoints' in modelOrCoeffs && 'weightsX' in modelOrCoeffs) {
    return evaluateThinPlateSpline(x, y, yaw, pitch, modelOrCoeffs);
  }

  if ('supportVectors' in modelOrCoeffs && 'dualWeightsX' in modelOrCoeffs) {
    return evaluateRbfKernelGaze(x, y, yaw, pitch, modelOrCoeffs);
  }

  if ('H' in modelOrCoeffs && Array.isArray(modelOrCoeffs.H)) {
    return evaluateProjectiveHomography(x, y, yaw, pitch, modelOrCoeffs);
  }

  const coeffs = modelOrCoeffs as CalibrationMatrixCoeffs;
  const activeModel = overrideAlgorithm || coeffs.modelType || 'quadrant-matrix';

  if (activeModel === 'quadrant-matrix' && coeffs.quadrantMatrix) {
    return evaluateQuadrantPupilMatrix(x, y, yaw, pitch, coeffs.quadrantMatrix);
  }
  if (activeModel === 'tps' && coeffs.tps) {
    return evaluateThinPlateSpline(x, y, yaw, pitch, coeffs.tps);
  }
  if (activeModel === 'projective' && coeffs.projective) {
    return evaluateProjectiveHomography(x, y, yaw, pitch, coeffs.projective);
  }
  if (activeModel === 'polynomial' && coeffs.a && coeffs.b) {
    return evaluatePolynomialGaze(x, y, yaw, pitch, coeffs);
  }
  if (coeffs.quadrantMatrix) {
    return evaluateQuadrantPupilMatrix(x, y, yaw, pitch, coeffs.quadrantMatrix);
  }
  if (coeffs.tps) {
    return evaluateThinPlateSpline(x, y, yaw, pitch, coeffs.tps);
  }
  if (coeffs.projective) {
    return evaluateProjectiveHomography(x, y, yaw, pitch, coeffs.projective);
  }
  if (coeffs.a && coeffs.b) {
    return evaluatePolynomialGaze(x, y, yaw, pitch, coeffs);
  }
  return null;
}

/**
 * Robust Interquartile / MAD (Median Absolute Deviation) Fixation Sample Aggregator
 */
export function aggregateFixationSamples(
  rawSamples: Array<{ rawX: number; rawY: number }>
): { rawX: number; rawY: number } {
  if (rawSamples.length === 0) {
    return { rawX: 0.5, rawY: 0.5 };
  }
  if (rawSamples.length <= 3) {
    const sx = rawSamples.reduce((acc, s) => acc + s.rawX, 0) / rawSamples.length;
    const sy = rawSamples.reduce((acc, s) => acc + s.rawY, 0) / rawSamples.length;
    return { rawX: sx, rawY: sy };
  }

  // Discard initial 20% of samples (post-saccadic settling oscillation)
  const startIdx = Math.floor(rawSamples.length * 0.20);
  const settled = rawSamples.slice(startIdx);

  const sortedX = settled.map(s => s.rawX).sort((a, b) => a - b);
  const sortedY = settled.map(s => s.rawY).sort((a, b) => a - b);

  // Compute Interquartile Trimmed Mean (25% to 75% quantiles)
  const lowIdx = Math.floor(settled.length * 0.25);
  const highIdx = Math.max(lowIdx + 1, Math.ceil(settled.length * 0.75));

  let sumX = 0;
  let sumY = 0;
  const count = highIdx - lowIdx;
  for (let i = lowIdx; i < highIdx; i++) {
    sumX += sortedX[i];
    sumY += sortedY[i];
  }

  return {
    rawX: sumX / count,
    rawY: sumY / count
  };
}

/**
 * Robust Outlier Filter for Calibration Samples
 */
export function filterCalibrationOutliers(samples: CalibrationSample[]): CalibrationSample[] {
  if (samples.length <= 6) return samples;

  const bounded = samples.filter(s => {
    if (!Number.isFinite(s.rawPupilX) || !Number.isFinite(s.rawPupilY)) return false;
    if (s.rawPupilX < 0.01 || s.rawPupilX > 0.99) return false;
    if (s.rawPupilY < 0.01 || s.rawPupilY > 0.99) return false;
    return true;
  });

  if (bounded.length <= 6) return bounded;

  const sortedX = [...bounded].map(s => s.rawPupilX).sort((a, b) => a - b);
  const sortedY = [...bounded].map(s => s.rawPupilY).sort((a, b) => a - b);
  const medX = sortedX[Math.floor(sortedX.length / 2)];
  const medY = sortedY[Math.floor(sortedY.length / 2)];

  const devX = bounded.map(s => Math.abs(s.rawPupilX - medX)).sort((a, b) => a - b);
  const devY = bounded.map(s => Math.abs(s.rawPupilY - medY)).sort((a, b) => a - b);
  const madX = Math.max(0.05, devX[Math.floor(devX.length / 2)] * 1.4826);
  const madY = Math.max(0.05, devY[Math.floor(devY.length / 2)] * 1.4826);

  const madFiltered = bounded.filter(s => {
    const zX = Math.abs(s.rawPupilX - medX) / madX;
    const zY = Math.abs(s.rawPupilY - medY) / madY;
    return zX <= 3.5 && zY <= 3.5;
  });

  return madFiltered.length >= 6 ? madFiltered : bounded;
}

/**
 * [Paper Section 5.1 & 5.2: Scale-Invariant Standardized Bivariate Polynomial Ridge Regression]
 * Standardizes raw pupil coordinates (x, y) to zero mean and unit variance before solving
 * Tikhonov-regularized regression, then analytically transforms the coefficients back to raw space.
 */
export function fitBivariateCalibration(
  samples: CalibrationSample[],
  lambda: number = 0.001
): CalibrationMatrixCoeffs | null {
  const cleanSamples = filterCalibrationOutliers(samples);
  if (cleanSamples.length < 6) {
    return null;
  }

  const N = cleanSamples.length;

  const sampleWeights: number[] = [];
  let totalWeight = 0;
  let muX = 0;
  let muY = 0;
  for (let k = 0; k < N; k++) {
    const s = cleanSamples[k];
    const w = 1.0 + (k / Math.max(1, N - 1)) * 1.25;
    sampleWeights.push(w);
    totalWeight += w;
    muX += w * s.rawPupilX;
    muY += w * s.rawPupilY;
  }
  muX /= totalWeight;
  muY /= totalWeight;

  let varX = 0;
  let varY = 0;
  for (let k = 0; k < N; k++) {
    const s = cleanSamples[k];
    const w = sampleWeights[k];
    varX += w * (s.rawPupilX - muX) ** 2;
    varY += w * (s.rawPupilY - muY) ** 2;
  }
  const sX = Math.max(0.005, Math.sqrt(varX / totalWeight));
  const sY = Math.max(0.005, Math.sqrt(varY / totalWeight));

  const D = 8;
  const XStd: number[][] = [];
  const targetsX: number[] = [];
  const targetsY: number[] = [];

  for (const s of cleanSamples) {
    const u = (s.rawPupilX - muX) / sX;
    const v = (s.rawPupilY - muY) / sY;
    XStd.push(expandFeatures(u, v, s.headYaw ?? 0, s.headPitch ?? 0));
    targetsX.push(s.targetX);
    targetsY.push(s.targetY);
  }

  const curvReg = Math.max(0.005, (lambda * 8) / Math.sqrt(Math.max(1, N / 9)));
  const diagPenalty = [
    0.0,
    lambda * 0.005,
    lambda * 0.005,
    curvReg,
    curvReg,
    curvReg,
    2.5,
    2.5
  ];

  const solveWeightedRidge = (weights: number[]) => {
    const A: number[][] = Array.from({ length: D }, () => new Array<number>(D).fill(0));
    const bX: number[] = new Array<number>(D).fill(0);
    const bY: number[] = new Array<number>(D).fill(0);

    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        let sum = 0;
        for (let k = 0; k < N; k++) {
          sum += weights[k] * XStd[k][i] * XStd[k][j];
        }
        if (i === j) {
          sum += diagPenalty[i];
        }
        A[i][j] = sum;
      }

      let sumX = 0;
      let sumY = 0;
      for (let k = 0; k < N; k++) {
        sumX += weights[k] * XStd[k][i] * targetsX[k];
        sumY += weights[k] * XStd[k][i] * targetsY[k];
      }
      bX[i] = sumX;
      bY[i] = sumY;
    }

    return {
      wStdX: solveLinearSystem(A, bX),
      wStdY: solveLinearSystem(A, bY)
    };
  };

  let { wStdX, wStdY } = solveWeightedRidge(sampleWeights);

  if (N >= 9) {
    const residuals: number[] = [];
    for (let k = 0; k < N; k++) {
      let px = 0;
      let py = 0;
      for (let i = 0; i < D; i++) {
        px += wStdX[i] * XStd[k][i];
        py += wStdY[i] * XStd[k][i];
      }
      residuals.push(Math.hypot(px - targetsX[k], py - targetsY[k]));
    }
    const sortedRes = [...residuals].sort((a, b) => a - b);
    const medRes = sortedRes[Math.floor(sortedRes.length / 2)];
    const huberThresh = Math.max(110, medRes * 2.5);
    const irlsWeights = sampleWeights.map((w, k) => {
      if (k >= N - 2) return w;
      const r = residuals[k];
      if (r <= huberThresh) return w;
      return w * Math.max(0.15, huberThresh / r);
    });
    const pass2 = solveWeightedRidge(irlsWeights);
    wStdX = pass2.wStdX;
    wStdY = pass2.wStdY;
  }

  const unscaleWeights = (w: number[]): number[] => {
    const [w0Hat, wxHat, wyHat, wxyHat, wx2Hat, wy2Hat, wyawHat, wpitchHat] = w;
    const wx2 = wx2Hat / (sX * sX);
    const wy2 = wy2Hat / (sY * sY);
    const wxy = wxyHat / (sX * sY);
    const wx = (wxHat / sX) - (2 * muX * wx2) - (muY * wxy);
    const wy = (wyHat / sY) - (2 * muY * wy2) - (muX * wxy);
    const w0 = w0Hat - (muX * wxHat) / sX - (muY * wyHat) / sY + (muX * muX * wx2) + (muY * muY * wy2) + (muX * muY * wxy);
    return [w0, wx, wy, wxy, wx2, wy2, wyawHat, wpitchHat];
  };

  const aCoeffs = unscaleWeights(wStdX);
  const bCoeffs = unscaleWeights(wStdY);

  const quadrantMatrix = fitQuadrantPupilMatrix(cleanSamples);
  const tpsModel = fitThinPlateSpline(cleanSamples, 0.002);
  const projModel = fitProjectiveHomography(cleanSamples);
  const rbfModel = fitRbfKernelModel(cleanSamples, 1.5, 0.005);

  let totalSqError = 0;
  for (const s of cleanSamples) {
    const phi = expandFeatures(s.rawPupilX, s.rawPupilY, s.headYaw ?? 0, s.headPitch ?? 0);
    let pX = 0;
    let pY = 0;
    for (let i = 0; i < D; i++) {
      pX += aCoeffs[i] * phi[i];
      pY += bCoeffs[i] * phi[i];
    }
    const dX = pX - s.targetX;
    const dY = pY - s.targetY;
    totalSqError += (dX * dX + dY * dY);
  }

  const polyRmsePx = Math.round(Math.sqrt(totalSqError / N));
  const candidates = [polyRmsePx];
  if (quadrantMatrix?.rmsePx !== undefined) candidates.push(quadrantMatrix.rmsePx);
  if (tpsModel?.rmsePx !== undefined) candidates.push(tpsModel.rmsePx);
  if (rbfModel?.rmsePx !== undefined) candidates.push(rbfModel.rmsePx);
  const bestRmsePx = Math.min(...candidates);

  let cvRmsePx = bestRmsePx;
  const cvCentroids = compressToWeightedInducingCentroids(cleanSamples, 12);
  if (cvCentroids.length >= 6) {
    let cvSqErr = 0;
    for (let holdIdx = 0; holdIdx < cvCentroids.length; holdIdx++) {
      const held = cvCentroids[holdIdx];
      const trainSub = cvCentroids.filter((_, idx) => idx !== holdIdx);
      const subQm = trainSub.length >= 5 ? fitQuadrantPupilMatrix(trainSub) : null;
      if (subQm) {
        const pred = evaluateQuadrantPupilMatrix(held.rawPupilX, held.rawPupilY, held.headYaw ?? 0, held.headPitch ?? 0, subQm);
        cvSqErr += (pred.x - held.targetX) ** 2 + (pred.y - held.targetY) ** 2;
      }
    }
    if (cvSqErr > 0) {
      cvRmsePx = Math.round(Math.sqrt(cvSqErr / cvCentroids.length));
    }
  }

  const effectiveErr = Math.round(bestRmsePx * 0.4 + cvRmsePx * 0.6);
  const reliabilityScore = Math.max(0, Math.min(100, Math.round(100 - effectiveErr * 0.55)));
  const accuracyDeg = Number((bestRmsePx / 28.0).toFixed(2));

  return {
    modelType: 'quadrant-matrix',
    a: aCoeffs,
    b: bCoeffs,
    quadrantMatrix: quadrantMatrix || undefined,
    tps: tpsModel || undefined,
    projective: projModel || undefined,
    rbf: rbfModel || undefined,
    rmsePx: bestRmsePx,
    cvRmsePx,
    reliabilityScore,
    accuracyDeg
  };
}

/**
 * Extracts raw affine [w0, wx, wy, 0, 0, 0, yaw, pitch] fallback coefficients
 * directly from a QuadrantMatrixModel when sample count is 1..5.
 */
function buildLinearCoeffsFromQuadrant(qm: QuadrantMatrixModel): { a: number[]; b: number[] } {
  const sx = Math.max(1e-5, qm.scaleX);
  const sy = Math.max(1e-5, qm.scaleY);
  const wxX = (qm.affineNormX[1] * qm.targetScaleX) / sx;
  const wyX = (qm.affineNormX[2] * qm.targetScaleX) / sy;
  const w0X = qm.targetMeanX + qm.affineNormX[0] * qm.targetScaleX - wxX * qm.meanX - wyX * qm.meanY;

  const wxY = (qm.affineNormY[1] * qm.targetScaleY) / sx;
  const wyY = (qm.affineNormY[2] * qm.targetScaleY) / sy;
  const w0Y = qm.targetMeanY + qm.affineNormY[0] * qm.targetScaleY - wxY * qm.meanX - wyY * qm.meanY;

  return {
    a: [w0X, wxX, wyX, 0, 0, 0, qm.yawFactorX, 0],
    b: [w0Y, wxY, wyY, 0, 0, 0, 0, qm.pitchFactorY],
  };
}

/**
 * High-Level Calibration Fitting Function supporting M-QPM Quadrant Matrix, TPS, Polynomial Ridge, and Hartley Homography.
 * Handles 1, 2, 3, 4, 5+ trained points natively without injecting fake synthetic anchors that distort user points.
 */
export function fitCalibrationModel(
  samples: CalibrationSample[],
  algorithm: CalibrationAlgorithm = 'quadrant-matrix',
  lambda: number = 0.002
): CalibrationMatrixCoeffs | null {
  if (samples.length === 0) return null;

  if (samples.length < 6) {
    const qm = fitQuadrantPupilMatrix(samples);
    if (!qm) return null;
    const tps = samples.length >= 3 ? fitThinPlateSpline(samples, lambda) : null;
    const proj = samples.length >= 4 ? fitProjectiveHomography(samples) : null;
    const rbf = samples.length >= 4 ? fitRbfKernelModel(samples, 1.5, 0.005) : null;
    const lin = buildLinearCoeffsFromQuadrant(qm);
    const rmsePx = qm.rmsePx ?? 0;

    return {
      modelType: algorithm,
      a: lin.a,
      b: lin.b,
      quadrantMatrix: qm,
      tps: tps || undefined,
      projective: proj || undefined,
      rbf: rbf || undefined,
      rmsePx,
      cvRmsePx: rmsePx,
      reliabilityScore: Math.max(0, Math.min(100, Math.round(100 - rmsePx * 0.55))),
      accuracyDeg: Number((rmsePx / 28.0).toFixed(2)),
    };
  }

  const result = fitBivariateCalibration(samples, lambda);
  if (!result) return null;
  result.modelType = algorithm;
  return result;
}
