/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { 
  fitBivariateCalibration, 
  evaluatePolynomialGaze, 
  fitQuadrantPupilMatrix,
  evaluateQuadrantPupilMatrix,
  fitThinPlateSpline,
  evaluateThinPlateSpline,
  fitProjectiveHomography,
  evaluateProjectiveHomography,
  fitRbfKernelModel,
  evaluateRbfKernelGaze,
  aggregateFixationSamples,
  filterCalibrationOutliers,
  evaluateCalibratedGaze,
  fitCalibrationModel,
  CalibrationMatrixCoeffs 
} from './calibration.ts';
import { CalibrationSample } from '../types/index.ts';

describe('Modern Gaze Calibration Algorithms (TPS, Polynomial, Projective)', () => {
  // Generate 9 synthetic calibration points simulating 3x3 grid
  const createSyntheticGrid = (): CalibrationSample[] => {
    const samples: CalibrationSample[] = [];
    const screenW = 1920;
    const screenH = 1080;
    const xPoints = [0.15, 0.50, 0.85];
    const yPoints = [0.15, 0.50, 0.85];

    for (const py of yPoints) {
      for (const px of xPoints) {
        samples.push({
          targetX: px * screenW,
          targetY: py * screenH,
          rawPupilX: px + 0.005, // Slight pupil offset
          rawPupilY: py + 0.005,
          headYaw: 0,
          headPitch: 0,
          headRoll: 0,
        });
      }
    }
    return samples;
  };

  describe('Polynomial Ridge Regression', () => {
    it('should successfully fit 2nd-order polynomial coefficients for 9-point grid', () => {
      const samples = createSyntheticGrid();
      const coeffs = fitBivariateCalibration(samples, 0.01);

      expect(coeffs).not.toBeNull();
      expect(coeffs!.a).toHaveLength(8);
      expect(coeffs!.b).toHaveLength(8);
      expect(coeffs!.rmsePx).toBeLessThan(75);
      expect(coeffs!.accuracyDeg).toBeLessThan(3.0);
    });

    it('should evaluate gaze accurately for center point', () => {
      const samples = createSyntheticGrid();
      const coeffs = fitBivariateCalibration(samples, 0.01) as CalibrationMatrixCoeffs;

      const result = evaluatePolynomialGaze(0.505, 0.505, 0, 0, coeffs);
      expect(Math.abs(result.x - 960)).toBeLessThan(90);
      expect(Math.abs(result.y - 540)).toBeLessThan(90);
    });

    it('should continuously extrapolate to screen edges without boundary dead-zones', () => {
      const samples = createSyntheticGrid();
      const coeffs = fitBivariateCalibration(samples, 0.01) as CalibrationMatrixCoeffs;

      const rightEdge = evaluatePolynomialGaze(0.95, 0.505, 0, 0, coeffs);
      const leftEdge = evaluatePolynomialGaze(0.05, 0.505, 0, 0, coeffs);

      expect(rightEdge.x).toBeGreaterThan(1500);
      expect(leftEdge.x).toBeLessThan(450);
      expect(rightEdge.x).toBeGreaterThan(leftEdge.x);
    });
  });

  describe('Thin-Plate Splines (TPS) - Bookstein Non-Rigid Ocular Mapping', () => {
    it('should fit Thin-Plate Spline model with minimal bending energy and low RMSE', () => {
      const samples = createSyntheticGrid();
      const tps = fitThinPlateSpline(samples, 0.005);

      expect(tps).not.toBeNull();
      expect(tps!.weightsX.length).toBe(samples.length);
      expect(tps!.weightsY.length).toBe(samples.length);
      expect(tps!.rmsePx).toBeLessThan(50);
    });

    it('should evaluate TPS center point accurately', () => {
      const samples = createSyntheticGrid();
      const tps = fitThinPlateSpline(samples, 0.005);
      expect(tps).not.toBeNull();

      const center = evaluateThinPlateSpline(0.505, 0.505, 0, 0, tps!);
      expect(Math.abs(center.x - 960)).toBeLessThan(40);
      expect(Math.abs(center.y - 540)).toBeLessThan(40);
    });

    it('should preserve linear extrapolation outside the grid via affine coefficients', () => {
      const samples = createSyntheticGrid();
      const tps = fitThinPlateSpline(samples, 0.005);
      expect(tps).not.toBeNull();

      // Outside the grid
      const farRight = evaluateThinPlateSpline(1.10, 0.505, 0, 0, tps!);
      expect(farRight.x).toBeGreaterThan(1920);
      expect(Number.isFinite(farRight.x)).toBe(true);
      expect(Number.isFinite(farRight.y)).toBe(true);
    });
  });

  describe('Projective Homography (DLT)', () => {
    it('should compute 3x3 homography matrix with H[8] normalized to 1', () => {
      const samples = createSyntheticGrid();
      const homography = fitProjectiveHomography(samples);

      expect(homography).not.toBeNull();
      expect(homography!.h).toBeDefined();
      expect(homography!.h!).toHaveLength(9);
      expect(homography!.h![8]).toBeCloseTo(1.0, 4);
      expect(homography!.rmsePx).toBeLessThan(100);
    });

    it('should evaluate projective gaze accurately for center point', () => {
      const samples = createSyntheticGrid();
      const homography = fitProjectiveHomography(samples);
      expect(homography).not.toBeNull();

      const center = evaluateProjectiveHomography(0.505, 0.505, 0, 0, homography!);
      expect(Math.abs(center.x - 960)).toBeLessThan(120);
      expect(Math.abs(center.y - 540)).toBeLessThan(120);
    });
  });

  describe('Outlier Filtering & Unified Evaluator', () => {
    it('should identify and remove extreme ocular drift outliers', () => {
      const samples = createSyntheticGrid();
      // Inject an outlier
      samples.push({
        targetX: 960,
        targetY: 540,
        rawPupilX: 0.999, // Wildly divergent pupil
        rawPupilY: 0.001,
        headYaw: 0,
        headPitch: 0,
        headRoll: 0,
      });

      const filtered = filterCalibrationOutliers(samples);
      expect(filtered.length).toBe(9); // Outlier removed
    });

    it('should route evaluateCalibratedGaze according to selected algorithm', () => {
      const samples = createSyntheticGrid();
      const tps = fitThinPlateSpline(samples);
      const poly = fitBivariateCalibration(samples);
      const proj = fitProjectiveHomography(samples);

      const resTps = evaluateCalibratedGaze(0.505, 0.505, 0, 0, tps, 'tps');
      const resPoly = evaluateCalibratedGaze(0.505, 0.505, 0, 0, poly, 'polynomial');
      const resProj = evaluateCalibratedGaze(0.505, 0.505, 0, 0, proj, 'projective');

      expect(resTps).not.toBeNull();
      expect(resPoly).not.toBeNull();
      expect(resProj).not.toBeNull();
      expect(Math.abs(resTps!.x - 960)).toBeLessThan(80);
      expect(Math.abs(resPoly!.x - 960)).toBeLessThan(80);
      expect(Math.abs(resProj!.x - 960)).toBeLessThan(150);
    });

    it('should train Gaussian Process / RBF Kernel ML model and reject blink outliers in fixation aggregation', () => {
      const samples = createSyntheticGrid();
      const rbf = fitRbfKernelModel(samples, 4.5, 0.008);
      expect(rbf).not.toBeNull();
      const centerPred = evaluateRbfKernelGaze(0.505, 0.505, 0, 0, rbf!);
      expect(Math.abs(centerPred.x - 960)).toBeLessThan(35);
      expect(Math.abs(centerPred.y - 540)).toBeLessThan(35);

      // Test IQR fixation sample aggregation with simulated blink outlier
      const rawFrames = Array.from({ length: 20 }, () => ({ rawX: 0.50, rawY: 0.50 }));
      rawFrames[0] = { rawX: 0.15, rawY: 0.90 }; // Saccadic arrival frame
      rawFrames[18] = { rawX: 0.50, rawY: 0.98 }; // Blink transient frame
      const agg = aggregateFixationSamples(rawFrames);
      expect(agg.rawX).toBeCloseTo(0.50, 2);
      expect(agg.rawY).toBeCloseTo(0.50, 2);
    });

    it('should accurately map narrow anatomical pupil dynamic range to full screen corners without center compression', () => {
      // Simulate real webcam user where rawPupilX only moves between [0.45, 0.55] and rawPupilY between [0.46, 0.54]
      const narrowSamples: CalibrationSample[] = [];
      const xTargets = [0.12 * 1920, 0.50 * 1920, 0.88 * 1920];
      const yTargets = [0.12 * 1080, 0.50 * 1080, 0.88 * 1080];
      const pupilXs = [0.45, 0.50, 0.55];
      const pupilYs = [0.46, 0.50, 0.54];

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          narrowSamples.push({
            targetX: xTargets[c],
            targetY: yTargets[r],
            rawPupilX: pupilXs[c],
            rawPupilY: pupilYs[r],
            headYaw: 0,
            headPitch: 0,
            headRoll: 0,
          });
        }
      }

      const poly = fitBivariateCalibration(narrowSamples);
      const tps = fitThinPlateSpline(narrowSamples);

      expect(poly).not.toBeNull();
      expect(tps).not.toBeNull();

      // Verify top-left and bottom-right corners coincide with target points (< 15px error)
      const topLeftPoly = evaluateCalibratedGaze(0.45, 0.46, 0, 0, poly, 'polynomial')!;
      const bottomRightPoly = evaluateCalibratedGaze(0.55, 0.54, 0, 0, poly, 'polynomial')!;
      expect(Math.abs(topLeftPoly.x - xTargets[0])).toBeLessThan(15);
      expect(Math.abs(topLeftPoly.y - yTargets[0])).toBeLessThan(15);
      expect(Math.abs(bottomRightPoly.x - xTargets[2])).toBeLessThan(15);
      expect(Math.abs(bottomRightPoly.y - yTargets[2])).toBeLessThan(15);

      const topLeftTps = evaluateCalibratedGaze(0.45, 0.46, 0, 0, tps, 'tps')!;
      const bottomRightTps = evaluateCalibratedGaze(0.55, 0.54, 0, 0, tps, 'tps')!;
      expect(Math.abs(topLeftTps.x - xTargets[0])).toBeLessThan(15);
      expect(Math.abs(topLeftTps.y - yTargets[0])).toBeLessThan(15);
      expect(Math.abs(bottomRightTps.x - xTargets[2])).toBeLessThan(15);
      expect(Math.abs(bottomRightTps.y - yTargets[2])).toBeLessThan(15);
    });

    it('should dynamically improve accuracy as unlimited manual training samples accumulate without a sample cap', () => {
      const samples = createSyntheticGrid();
      // Introduce a localized non-linear target correction at pupil (0.62, 0.62) -> screen (1350, 780)
      const customPoint: CalibrationSample = {
        targetX: 1350,
        targetY: 780,
        rawPupilX: 0.62,
        rawPupilY: 0.62,
        headYaw: 0,
        headPitch: 0,
        headRoll: 0,
      };

      const baseModel = fitCalibrationModel(samples, 'tps')!;
      const predBefore = evaluateCalibratedGaze(0.62, 0.62, 0, 0, baseModel, 'tps')!;
      const errBefore = Math.hypot(predBefore.x - 1350, predBefore.y - 780);

      // Train 1st manual press at that coordinate
      samples.push({ ...customPoint });
      const modelAfter1 = fitCalibrationModel(samples, 'tps')!;
      const predAfter1 = evaluateCalibratedGaze(0.62, 0.62, 0, 0, modelAfter1, 'tps')!;
      const errAfter1 = Math.hypot(predAfter1.x - 1350, predAfter1.y - 780);

      // Train 25 additional presses (total > 35 samples, exceeding any old 15-point cap)
      for (let i = 0; i < 25; i++) {
        samples.push({ ...customPoint });
      }
      const modelAfterMany = fitCalibrationModel(samples, 'tps')!;
      const predAfterMany = evaluateCalibratedGaze(0.62, 0.62, 0, 0, modelAfterMany, 'tps')!;
      const errAfterMany = Math.hypot(predAfterMany.x - 1350, predAfterMany.y - 780);

      expect(samples.length).toBeGreaterThan(30);
      expect(errAfter1).toBeLessThan(errBefore);
      expect(errAfterMany).toBeLessThanOrEqual(errAfter1);
      expect(errAfterMany).toBeLessThan(2.0);
    });

    it('should fit 1-point cold-start manual calibration directly on the trained coordinate without pulling toward screen center', () => {
      const singleSample: CalibrationSample[] = [
        {
          targetX: 280,
          targetY: 190,
          rawPupilX: 0.44,
          rawPupilY: 0.42,
          headYaw: 0,
          headPitch: 0,
          headRoll: 0,
        },
      ];

      const model = fitCalibrationModel(singleSample, 'tps')!;
      expect(model).not.toBeNull();

      const atTrained = evaluateCalibratedGaze(0.44, 0.42, 0, 0, model, 'tps')!;
      expect(Math.hypot(atTrained.x - 280, atTrained.y - 190)).toBeLessThan(8.0);

      // Looking further right and down should monotonically increase screen X and Y
      const shiftedRightDown = evaluateCalibratedGaze(0.48, 0.46, 0, 0, model, 'tps')!;
      expect(shiftedRightDown.x).toBeGreaterThan(atTrained.x + 150);
      expect(shiftedRightDown.y).toBeGreaterThan(atTrained.y + 80);
    });

    it('should resist gross outlier contamination via 2-pass Huber IRLS in polynomial calibration', () => {
      const cleanSamples = createSyntheticGrid();
      const contaminated = cleanSamples.map(s => ({ ...s }));
      // Contaminate an early grid point (#1) with a huge transient artifact (+180px optical jump)
      contaminated[1] = {
        ...contaminated[1],
        rawPupilX: contaminated[1].rawPupilX + 0.16,
        rawPupilY: contaminated[1].rawPupilY + 0.14,
      };

      const polyRobust = fitBivariateCalibration(contaminated, 0.01);
      expect(polyRobust).not.toBeNull();

      // Clean center point (#4) must still project near (960, 540) despite the contaminated sample
      const centerPred = evaluatePolynomialGaze(0.505, 0.505, 0, 0, polyRobust!);
      expect(Math.hypot(centerPred.x - 960, centerPred.y - 540)).toBeLessThan(110);
    });

    it('should compute LOOCV cvRmsePx and higher clinical reliabilityScore for clean vs noisy calibration', () => {
      const clean = createSyntheticGrid();
      const cleanModel = fitCalibrationModel(clean, 'tps')!;
      expect(cleanModel.cvRmsePx).toBeDefined();
      expect(cleanModel.reliabilityScore).toBeDefined();
      expect(cleanModel.reliabilityScore!).toBeGreaterThanOrEqual(75);
      expect(cleanModel.cvRmsePx!).toBeLessThan(120);

      // Degrade calibration samples with heavy random-like scatter
      const noisy = clean.map((s, idx) => ({
        ...s,
        rawPupilX: s.rawPupilX + (idx % 2 === 0 ? 0.11 : -0.10),
        rawPupilY: s.rawPupilY + (idx % 3 === 0 ? -0.12 : 0.09),
      }));
      const noisyModel = fitCalibrationModel(noisy, 'tps')!;
      expect(noisyModel.reliabilityScore!).toBeLessThan(cleanModel.reliabilityScore!);
      expect(noisyModel.cvRmsePx!).toBeGreaterThan(cleanModel.cvRmsePx!);
    });

    it('should learn bounded 3D head-pose parallax factors in TPS when posture varies across points', () => {
      const screenW = 1920;
      const screenH = 1080;
      const poses = [
        { yaw: -0.25, pitch: -0.15 },
        { yaw: 0.0, pitch: 0.0 },
        { yaw: 0.25, pitch: 0.15 },
      ];
      const gridVals = [0.2, 0.5, 0.8];
      const poseSamples: CalibrationSample[] = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const px = gridVals[c];
          const py = gridVals[r];
          const p = poses[(r + c) % 3];
          poseSamples.push({
            targetX: px * screenW + 180 * p.yaw,
            targetY: py * screenH + 140 * p.pitch,
            rawPupilX: px,
            rawPupilY: py,
            headYaw: p.yaw,
            headPitch: p.pitch,
            headRoll: 0,
          });
        }
      }

      const tps = fitThinPlateSpline(poseSamples, 0.002)!;
      expect(tps).not.toBeNull();
      expect(tps.yawFactorX).toBeGreaterThan(20);
      expect(tps.pitchFactorY).toBeGreaterThan(20);

      const rotatedPred = evaluateThinPlateSpline(0.5, 0.5, 0.25, 0.15, tps);
      const flatPred = evaluateThinPlateSpline(0.5, 0.5, 0, 0, tps);
      expect(rotatedPred.x).toBeGreaterThan(flatPred.x + 15);
      expect(rotatedPred.y).toBeGreaterThan(flatPred.y + 10);
    });

    it('should preserve full top-left and bottom-right reach even when user naturally turns head toward corners during calibration', () => {
      const screenW = 1920;
      const screenH = 1080;
      const xVals = [0.07, 0.50, 0.93];
      const yVals = [0.08, 0.50, 0.92];
      // Simulate real anatomical pupil range [0.43..0.57] x [0.44..0.56] + synergistic head rotation toward corners
      const pupilXs = [0.43, 0.50, 0.57];
      const pupilYs = [0.44, 0.50, 0.56];
      const calSamples: CalibrationSample[] = [];

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          calSamples.push({
            targetX: xVals[c] * screenW,
            targetY: yVals[r] * screenH,
            rawPupilX: pupilXs[c],
            rawPupilY: pupilYs[r],
            headYaw: (c - 1) * 0.15,
            headPitch: (r - 1) * 0.12,
            headRoll: 0,
          });
        }
      }

      const model = fitCalibrationModel(calSamples, 'tps')!;
      expect(model).not.toBeNull();

      // With head stationary (yaw=0, pitch=0), looking at top-left & bottom-right pupil positions must reach both corners
      const topLeft = evaluateCalibratedGaze(0.43, 0.44, 0, 0, model, 'tps')!;
      const bottomRight = evaluateCalibratedGaze(0.57, 0.56, 0, 0, model, 'tps')!;
      expect(topLeft.x).toBeLessThan(200);
      expect(topLeft.y).toBeLessThan(150);
      expect(bottomRight.x).toBeGreaterThan(screenW - 200);
      expect(bottomRight.y).toBeGreaterThan(screenH - 150);

      // Looking slightly past the calibrated corners must continue advancing outward (zero inward pullback)
      const extremeTopLeft = evaluateCalibratedGaze(0.415, 0.425, 0, 0, model, 'tps')!;
      const extremeBottomRight = evaluateCalibratedGaze(0.585, 0.575, 0, 0, model, 'tps')!;
      expect(extremeTopLeft.x).toBeLessThan(topLeft.x);
      expect(extremeTopLeft.y).toBeLessThan(topLeft.y);
      expect(extremeBottomRight.x).toBeGreaterThan(bottomRight.x);
      expect(extremeBottomRight.y).toBeGreaterThan(bottomRight.y);
    });

    it('should maintain unclipped edge sensitivity when manually calibrating directly near top-left or bottom-right', () => {
      const topLeftManual: CalibrationSample[] = [
        { targetX: 60, targetY: 50, rawPupilX: 0.44, rawPupilY: 0.43, headYaw: 0, headPitch: 0, headRoll: 0 },
      ];
      const model = fitCalibrationModel(topLeftManual, 'tps')!;
      const atCorner = evaluateCalibratedGaze(0.44, 0.43, 0, 0, model, 'tps')!;
      const furtherUpLeft = evaluateCalibratedGaze(0.42, 0.41, 0, 0, model, 'tps')!;

      expect(Math.hypot(atCorner.x - 60, atCorner.y - 50)).toBeLessThan(12);
      expect(furtherUpLeft.x).toBeLessThan(atCorner.x - 80);
      expect(furtherUpLeft.y).toBeLessThan(atCorner.y - 40);
    });
  });

  describe('M-QPM (Mahalanobis-Whitened Exact Quadrant Positioning Matrix)', () => {
    it('should fit 2-point and 3-point trainings with near-zero pixel error on every trained coordinate', () => {
      const twoPts: CalibrationSample[] = [
        { targetX: 140, targetY: 120, rawPupilX: 0.43, rawPupilY: 0.47, headYaw: 0, headPitch: 0, headRoll: 0 },
        { targetX: 1780, targetY: 960, rawPupilX: 0.57, rawPupilY: 0.52, headYaw: 0, headPitch: 0, headRoll: 0 },
      ];
      const qm2 = fitQuadrantPupilMatrix(twoPts)!;
      expect(qm2.regime).toBe('2pt');
      for (const s of twoPts) {
        const pred = evaluateQuadrantPupilMatrix(s.rawPupilX, s.rawPupilY, 0, 0, qm2);
        expect(Math.hypot(pred.x - s.targetX, pred.y - s.targetY)).toBeLessThan(1.0);
      }

      const threePts: CalibrationSample[] = [
        ...twoPts,
        { targetX: 140, targetY: 960, rawPupilX: 0.44, rawPupilY: 0.525, headYaw: 0, headPitch: 0, headRoll: 0 },
      ];
      const qm3 = fitQuadrantPupilMatrix(threePts)!;
      expect(qm3.regime).toBe('3pt-affine');
      for (const s of threePts) {
        const pred = evaluateQuadrantPupilMatrix(s.rawPupilX, s.rawPupilY, 0, 0, qm3);
        expect(Math.hypot(pred.x - s.targetX, pred.y - s.targetY)).toBeLessThan(1.0);
      }
    });

    it('should solve exact 4-corner trapezoidal projective homography across the full action quadrant', () => {
      // Simulate realistic trapezoidal/keystone ocular geometry under a slightly angled webcam
      const fourCorners: CalibrationSample[] = [
        { targetX: 100, targetY: 80, rawPupilX: 0.42, rawPupilY: 0.470, headYaw: 0, headPitch: 0, headRoll: 0 },
        { targetX: 1820, targetY: 80, rawPupilX: 0.59, rawPupilY: 0.466, headYaw: 0, headPitch: 0, headRoll: 0 },
        { targetX: 1820, targetY: 1000, rawPupilX: 0.61, rawPupilY: 0.522, headYaw: 0, headPitch: 0, headRoll: 0 },
        { targetX: 100, targetY: 1000, rawPupilX: 0.40, rawPupilY: 0.526, headYaw: 0, headPitch: 0, headRoll: 0 },
      ];

      const model = fitCalibrationModel(fourCorners, 'quadrant-matrix')!;
      expect(model.quadrantMatrix).toBeDefined();
      expect(model.quadrantMatrix!.regime).toBe('4pt-homography');

      for (const s of fourCorners) {
        const pred = evaluateCalibratedGaze(s.rawPupilX, s.rawPupilY, 0, 0, model, 'quadrant-matrix')!;
        expect(Math.hypot(pred.x - s.targetX, pred.y - s.targetY)).toBeLessThan(1.5);
      }

      // Check Hartley-normalized projective homography directly as well
      const proj = fitProjectiveHomography(fourCorners)!;
      for (const s of fourCorners) {
        const pred = evaluateProjectiveHomography(s.rawPupilX, s.rawPupilY, 0, 0, proj);
        expect(Math.hypot(pred.x - s.targetX, pred.y - s.targetY)).toBeLessThan(2.0);
      }

      // By projective invariance, intersection of trapezoid diagonals in pupil space must map to screen center (960, 540)
      const [p1, p2, p3, p4] = fourCorners;
      const denom =
        (p1.rawPupilX - p3.rawPupilX) * (p2.rawPupilY - p4.rawPupilY) -
        (p1.rawPupilY - p3.rawPupilY) * (p2.rawPupilX - p4.rawPupilX);
      const t =
        ((p1.rawPupilX - p2.rawPupilX) * (p2.rawPupilY - p4.rawPupilY) -
          (p1.rawPupilY - p2.rawPupilY) * (p2.rawPupilX - p4.rawPupilX)) /
        denom;
      const diagInterX = p1.rawPupilX + t * (p3.rawPupilX - p1.rawPupilX);
      const diagInterY = p1.rawPupilY + t * (p3.rawPupilY - p1.rawPupilY);

      const centerPred = evaluateCalibratedGaze(diagInterX, diagInterY, 0, 0, model, 'quadrant-matrix')!;
      expect(Math.hypot(centerPred.x - 960, centerPred.y - 540)).toBeLessThan(2.0);
    });

    it('should achieve < 1.5px residual across all 9 points even with extreme 5:1 horizontal-vs-vertical pupil anisotropy', () => {
      const screenW = 1920;
      const screenH = 1080;
      const xVals = [0.07, 0.50, 0.93];
      const yVals = [0.08, 0.50, 0.92];
      // Extreme realistic anisotropy: pupilX moves 0.24 while pupilY moves only 0.044
      const pupilXs = [0.38, 0.50, 0.62];
      const pupilYs = [0.478, 0.500, 0.522];
      const samples: CalibrationSample[] = [];

      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          samples.push({
            targetX: xVals[c] * screenW + (r === 1 && c === 1 ? 12 : 0),
            targetY: yVals[r] * screenH - (r === 2 ? 8 : 0),
            rawPupilX: pupilXs[c] + (r - 1) * 0.004,
            rawPupilY: pupilYs[r] + (c - 1) * 0.0015,
            headYaw: 0,
            headPitch: 0,
            headRoll: 0,
          });
        }
      }

      const model = fitCalibrationModel(samples, 'quadrant-matrix')!;
      expect(model.quadrantMatrix).toBeDefined();
      expect(model.quadrantMatrix!.rmsePx).toBeLessThanOrEqual(1);

      for (const s of samples) {
        const pred = evaluateCalibratedGaze(s.rawPupilX, s.rawPupilY, 0, 0, model, 'quadrant-matrix')!;
        expect(Math.hypot(pred.x - s.targetX, pred.y - s.targetY)).toBeLessThan(1.5);
      }

      // Extrapolating past top-left and bottom-right corners must remain monotonic outward
      const extraTL = evaluateCalibratedGaze(0.35, 0.470, 0, 0, model, 'quadrant-matrix')!;
      const extraBR = evaluateCalibratedGaze(0.65, 0.530, 0, 0, model, 'quadrant-matrix')!;
      expect(extraTL.x).toBeLessThan(samples[0].targetX);
      expect(extraTL.y).toBeLessThan(samples[0].targetY);
      expect(extraBR.x).toBeGreaterThan(samples[8].targetX);
      expect(extraBR.y).toBeGreaterThan(samples[8].targetY);
    });
  });
});
