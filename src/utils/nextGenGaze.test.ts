/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  extractBlendshapeGaze,
  solve3DEyeballVisualAxisRay,
  computePhotometricPupilCentroid,
  fuseGazeChannels,
} from './eyeSensorFusion.ts';
import {
  computeTargetGaussianLikelihood,
  BayesianTargetDecoder,
  UiTargetRect,
} from './bayesianTargetDecoder.ts';
import {
  evaluateLissajousPursuitTarget,
  calibrateFromSmoothPursuit,
  PursuitStreamFrame,
} from './smoothPursuitCalibration.ts';
import {
  OcularTrackballController,
  TwoStageLoupeController,
} from './cursorPositioning.ts';
import { LandmarkPoint, SubpixelEyeAnalysis } from './headPose.ts';
import { HeadPoseData } from '../types/index.ts';

function buildSyntheticFaceLandmarks(irisShiftX: number, irisShiftY: number): LandmarkPoint[] {
  const landmarks: LandmarkPoint[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

  // Cranial anchors: left outer (33), right outer (263), nose bridge (168), chin (152)
  landmarks[33] = { x: 0.36, y: 0.44, z: -0.01 };
  landmarks[133] = { x: 0.44, y: 0.44, z: -0.015 };
  landmarks[362] = { x: 0.56, y: 0.44, z: -0.015 };
  landmarks[263] = { x: 0.64, y: 0.44, z: -0.01 };
  landmarks[168] = { x: 0.50, y: 0.43, z: -0.04 };
  landmarks[152] = { x: 0.50, y: 0.72, z: -0.02 };

  // Iris centers (left 468, right 473) slightly anterior to the socket midpoint
  landmarks[468] = { x: 0.40 + irisShiftX, y: 0.44 + irisShiftY, z: -0.014 };
  landmarks[473] = { x: 0.60 + irisShiftX, y: 0.44 + irisShiftY, z: -0.014 };

  return landmarks;
}

describe('Next-Gen Gaze Detection & Cursor Positioning Suite', () => {
  describe('Multi-Modal Eye Sensor Fusion (Blendshapes, 3D Raycast, Photometric ROI)', () => {
    it('extracts directional downward and lateral gaze from ARKit blendshapes and drops confidence during blinks', () => {
      const downward = extractBlendshapeGaze([
        { categoryName: 'eyeLookDownLeft', score: 0.72 },
        { categoryName: 'eyeLookDownRight', score: 0.68 },
        { categoryName: 'eyeLookUpLeft', score: 0.05 },
        { categoryName: 'eyeLookUpRight', score: 0.05 },
        { categoryName: 'eyeLookOutLeft', score: 0.4 },
        { categoryName: 'eyeLookInRight', score: 0.36 },
        { categoryName: 'eyeBlinkLeft', score: 0.05 },
        { categoryName: 'eyeBlinkRight', score: 0.04 },
      ]);

      expect(downward.deltaY).toBeGreaterThan(0.55);
      expect(downward.deltaX).toBeGreaterThan(0.3);
      expect(downward.confidence).toBeGreaterThan(0.8);

      const blinking = extractBlendshapeGaze([
        { categoryName: 'eyeLookDownLeft', score: 0.8 },
        { categoryName: 'eyeBlinkLeft', score: 0.85 },
      ]);
      expect(blinking.confidence).toBe(0);
    });

    it('solves 3D spherical eyeball visual-axis raycast across lateral and vertical iris shifts', () => {
      const centerLandmarks = buildSyntheticFaceLandmarks(0, 0);
      const rightLookLandmarks = buildSyntheticFaceLandmarks(-0.018, 0);
      const downLookLandmarks = buildSyntheticFaceLandmarks(0, 0.012);

      const centerRay = solve3DEyeballVisualAxisRay(centerLandmarks, 'left', 0.40, 0.44, 1.15);
      const rightRay = solve3DEyeballVisualAxisRay(rightLookLandmarks, 'left', 0.382, 0.44, 1.15);
      const downRay = solve3DEyeballVisualAxisRay(downLookLandmarks, 'left', 0.40, 0.452, 1.15);

      expect(centerRay.valid).toBe(true);
      expect(rightRay.rayGazeX).toBeGreaterThan(centerRay.rayGazeX);
      expect(downRay.rayGazeY).toBeGreaterThan(centerRay.rayGazeY);
    });

    it('recovers sub-pixel dark-pupil centroid inside synthetic luminance ROI', () => {
      const width = 36;
      const height = 22;
      const luma = new Float32Array(width * height).fill(180);
      const trueCx = 21.4;
      const trueCy = 10.7;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const d2 = (x - trueCx) ** 2 + (y - trueCy) ** 2;
          luma[y * width + x] = 190 - 155 * Math.exp(-d2 / 8.5);
        }
      }

      const res = computePhotometricPupilCentroid(luma, width, height, 20, 11, 12, 7.5);
      expect(res.active).toBe(true);
      expect(res.confidence).toBeGreaterThan(0.5);
      expect(res.normX * width).toBeCloseTo(trueCx, 0);
      expect(res.normY * height).toBeCloseTo(trueCy, 0);
    });

    it('fuses 2D canthal, 3D raycast, and downward blendshape rescue cleanly', () => {
      const eyeStub: SubpixelEyeAnalysis = {
        pupilCenterNorm: { x: 0.5, y: 0.5 },
        pupilVideoPx: { x: 320, y: 240 },
        canthalLocalX: 0.5,
        canthalLocalY: 0.5,
        sphericalGazeX: 0.5,
        sphericalGazeY: 0.55,
        apertureRatio: 0.3,
        upperLidOcclusion: 0.35,
        confidenceWeight: 0.5,
      };
      const landmarks = buildSyntheticFaceLandmarks(0, 0.008);
      const rayL = solve3DEyeballVisualAxisRay(landmarks, 'left', 0.4, 0.448, 1.15);
      const rayR = solve3DEyeballVisualAxisRay(landmarks, 'right', 0.6, 0.448, 1.15);
      const blend = extractBlendshapeGaze([
        { categoryName: 'eyeLookDownLeft', score: 0.8 },
        { categoryName: 'eyeLookDownRight', score: 0.8 },
      ]);
      const headPose: HeadPoseData = { yawDeg: 0, pitchDeg: 0, rollDeg: 0, normYaw: 0, normPitch: 0 };

      const fused = fuseGazeChannels(eyeStub, eyeStub, rayL, rayR, blend, headPose, false, true);
      expect(fused.photometricActive).toBe(true);
      expect(fused.fusedY).toBeGreaterThan(0.55);
      expect(fused.blendshapeY).toBeGreaterThan(0.5);
    });
  });

  describe('Bayesian Gaze-to-Target Posterior Decoder', () => {
    const targets: UiTargetRect[] = [
      { id: 'key-a', left: 100, top: 200, right: 220, bottom: 280 },
      { id: 'key-b', left: 240, top: 200, right: 360, bottom: 280 },
    ];

    it('scores inside targets higher than distant targets using anisotropic vertical tolerance', () => {
      const inside = computeTargetGaussianLikelihood(160, 240, targets[0], 28, 40);
      const vertSlip = computeTargetGaussianLikelihood(160, 304, targets[0], 28, 40);
      const horizSlip = computeTargetGaussianLikelihood(224, 240, targets[0], 28, 40);

      expect(inside).toBeGreaterThan(vertSlip);
      expect(vertSlip).toBeGreaterThan(horizSlip * 0.5);
    });

    it('accumulates posterior lock on fixated button, pulls cursor smoothly, and releases on saccade', () => {
      const decoder = new BayesianTargetDecoder();
      let state = decoder.update(155, 235, targets, 12, 0.9, false);
      for (let i = 0; i < 6; i++) {
        state = decoder.update(158, 238, targets, 10, 0.9, false);
      }

      expect(state.lockedTargetId).toBe('key-a');
      expect(state.confidence).toBeGreaterThan(0.5);
      // Display coordinates pulled toward center (160, 240)
      expect(Math.abs(state.displayX - 160)).toBeLessThanOrEqual(Math.abs(158 - 160) + 0.01);

      // Fast voluntary saccade away immediately clears lock
      const saccadeState = decoder.update(550, 240, targets, 380, 0.9, false);
      expect(saccadeState.lockedTargetId).toBeNull();
    });
  });

  describe('OrbitoGaze Lag-Compensated Smooth-Pursuit Calibration', () => {
    it('recovers synthetic 120ms oculomotor lag and high Pearson R^2 across Lissajous orbit', () => {
      const screenW = 1280;
      const screenH = 720;
      const trueLagMs = 120;
      const stream: PursuitStreamFrame[] = [];

      for (let t = 0; t <= 8000; t += 40) {
        const tgtNow = evaluateLissajousPursuitTarget(t / 8000);
        const laggedProgress = Math.max(0, (t - trueLagMs) / 8000);
        const eyePos = evaluateLissajousPursuitTarget(laggedProgress);

        // Mild anisotropic warping to simulate real ocular nonlinearities
        const rawPupilX = 0.5 + (eyePos.xPct - 0.5) * 0.42 + 0.018;
        const rawPupilY = 0.5 + (eyePos.yPct - 0.5) * 0.36 - 0.012;

        stream.push({
          tMs: t,
          targetX: tgtNow.xPct * screenW,
          targetY: tgtNow.yPct * screenH,
          rawPupilX,
          rawPupilY,
          headYaw: 0,
          headPitch: 0,
          headRoll: 0,
        });
      }

      const result = calibrateFromSmoothPursuit(stream, 'quadrant-matrix', 260, 20);
      expect(result).not.toBeNull();
      expect(result!.optimalLagMs).toBeGreaterThanOrEqual(80);
      expect(result!.optimalLagMs).toBeLessThanOrEqual(160);
      expect(result!.pearsonR2).toBeGreaterThan(0.95);
      expect(result!.samples.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Alternative Cursor Positioning Paradigms', () => {
    it('OcularTrackballController holds still inside resting deadzone and brakes over targets', () => {
      const tb = new OcularTrackballController(640, 360);

      // Inside deadzone -> zero displacement
      const rest = tb.update({
        rawGazeX: 0.51,
        rawGazeY: 0.495,
        neutralX: 0.5,
        neutralY: 0.5,
        sensitivityX: 12,
        sensitivityY: 12,
        dtSec: 0.016,
        screenW: 1280,
        screenH: 720,
        isOverTarget: false,
      });
      expect(rest.speedPxPerSec).toBe(0);
      expect(rest.x).toBe(640);

      // Outside deadzone in free space vs over target
      const freeMove = tb.update({
        rawGazeX: 0.65,
        rawGazeY: 0.5,
        neutralX: 0.5,
        neutralY: 0.5,
        sensitivityX: 14,
        sensitivityY: 14,
        dtSec: 0.02,
        screenW: 1280,
        screenH: 720,
        isOverTarget: false,
      });
      const brakedMove = tb.update({
        rawGazeX: 0.65,
        rawGazeY: 0.5,
        neutralX: 0.5,
        neutralY: 0.5,
        sensitivityX: 14,
        sensitivityY: 14,
        dtSec: 0.02,
        screenW: 1280,
        screenH: 720,
        isOverTarget: true,
      });
      expect(freeMove.speedPxPerSec).toBeGreaterThan(100);
      expect(brakedMove.speedPxPerSec).toBeLessThan(freeMove.speedPxPerSec * 0.4);
    });

    it('TwoStageLoupeController locks into fine-loupe after 340ms cluster and unlocks on large saccade', () => {
      const loupe = new TwoStageLoupeController();

      let state = loupe.update(500, 300, 1000, 1280, 720, false);
      expect(state.stage).toBe('coarse');

      // Maintain steady cluster >= 340ms
      state = loupe.update(508, 304, 1380, 1280, 720, false);
      expect(state.stage).toBe('fine-loupe');

      // Micro movement within loupe is compressed (0.72x gain)
      const fine = loupe.update(530, 304, 1420, 1280, 720, false);
      expect(fine.stage).toBe('fine-loupe');
      expect(Math.abs(fine.x - fine.anchorX)).toBeLessThan(30);

      // Large saccade (> 235px) releases back to coarse
      const released = loupe.update(900, 300, 1450, 1280, 720, false);
      expect(released.stage).toBe('coarse');
    });
  });
});
