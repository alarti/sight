/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { estimateHeadPose, applyHeadPoseCompensation, analyzeSubpixelEyeGeometry } from './headPose.ts';

describe('Head Pose Estimation & Sub-Pixel Iris Geometry', () => {
  it('should estimate neutral angles for frontal synthetic face landmarks', () => {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    landmarks[1] = { x: 0.5, y: 0.5, z: -0.05 };
    landmarks[234] = { x: 0.3, y: 0.5, z: 0 };
    landmarks[454] = { x: 0.7, y: 0.5, z: 0 };
    landmarks[10] = { x: 0.5, y: 0.3, z: 0 };
    landmarks[152] = { x: 0.5, y: 0.7, z: 0 };

    const pose = estimateHeadPose(landmarks);

    expect(pose).toBeDefined();
    expect(pose.yawDeg).toBeCloseTo(0, 0);
    expect(pose.pitchDeg).toBeCloseTo(0, 0);
    expect(pose.rollDeg).toBeCloseTo(0, 0);
  });

  it('should apply posture compensation factor with resting deadzone for wheelchair users', () => {
    const rawPupilX = 0.5;
    const rawPupilY = 0.5;
    const headPose = {
      yawDeg: 10,
      pitchDeg: 8,
      rollDeg: 0,
      normYaw: 0.17,
      normPitch: 0.14
    };

    const compensated = applyHeadPoseCompensation(rawPupilX, rawPupilY, headPose, false);

    expect(compensated.compensatedX).toBeDefined();
    expect(compensated.compensatedY).toBeDefined();
    expect(Math.abs(compensated.compensatedY - rawPupilY)).toBeLessThan(0.05);
  });

  it('should extract sub-pixel iris geometry and compensate for upper eyelid occlusion', () => {
    const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    // Left eye canthi (outer 33, inner 133)
    landmarks[33] = { x: 0.30, y: 0.45, z: 0 };
    landmarks[133] = { x: 0.40, y: 0.45, z: 0 };
    // Eyelids (upper 159, lower 145)
    landmarks[159] = { x: 0.35, y: 0.435, z: 0 };
    landmarks[145] = { x: 0.35, y: 0.465, z: 0 };
    // 5-point iris constellation (468..472)
    landmarks[468] = { x: 0.35, y: 0.448, z: 0 };
    landmarks[469] = { x: 0.365, y: 0.448, z: 0 };
    landmarks[470] = { x: 0.35, y: 0.436, z: 0 };
    landmarks[471] = { x: 0.335, y: 0.448, z: 0 };
    landmarks[472] = { x: 0.35, y: 0.463, z: 0 };

    const analysis = analyzeSubpixelEyeGeometry(landmarks, 'left', 640, 480, 1.15);

    expect(analysis.pupilVideoPx.x).toBeCloseTo(0.35 * 640, 1);
    expect(analysis.sphericalGazeX).toBeGreaterThan(0.45);
    expect(analysis.sphericalGazeX).toBeLessThan(0.55);
    expect(analysis.sphericalGazeY).toBeGreaterThan(0.40);
    expect(analysis.sphericalGazeY).toBeLessThan(0.60);
    expect(analysis.confidenceWeight).toBeGreaterThan(0);
  });

  it('should preserve monotonic vertical gaze range without premature saturation at extreme up/down gaze', () => {
    const makeEyeLandmarks = (irisOffsetY: number) => {
      const lm = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      lm[33] = { x: 0.30, y: 0.45, z: 0 };
      lm[133] = { x: 0.40, y: 0.45, z: 0 }; // eyeWidth = 0.10
      const baseY = 0.45 + irisOffsetY;
      lm[159] = { x: 0.35, y: baseY - 0.015, z: 0 };
      lm[145] = { x: 0.35, y: baseY + 0.015, z: 0 };
      lm[468] = { x: 0.35, y: baseY, z: 0 };
      lm[469] = { x: 0.36, y: baseY, z: 0 };
      lm[470] = { x: 0.35, y: baseY - 0.01, z: 0 };
      lm[471] = { x: 0.34, y: baseY, z: 0 };
      lm[472] = { x: 0.35, y: baseY + 0.01, z: 0 };
      return lm;
    };

    const up = analyzeSubpixelEyeGeometry(makeEyeLandmarks(-0.014), 'left', 640, 480, 1.15);
    const mid = analyzeSubpixelEyeGeometry(makeEyeLandmarks(0), 'left', 640, 480, 1.15);
    const downMid = analyzeSubpixelEyeGeometry(makeEyeLandmarks(0.008), 'left', 640, 480, 1.15);
    const downHigh = analyzeSubpixelEyeGeometry(makeEyeLandmarks(0.014), 'left', 640, 480, 1.15);

    expect(up.sphericalGazeY).toBeGreaterThanOrEqual(0.02);
    expect(downHigh.sphericalGazeY).toBeLessThanOrEqual(0.98);
    expect(up.sphericalGazeY).toBeLessThan(mid.sphericalGazeY);
    expect(mid.sphericalGazeY).toBeLessThan(downMid.sphericalGazeY);
    expect(downMid.sphericalGazeY).toBeLessThan(downHigh.sphericalGazeY);
  });

  it('should resist upper-eyelid ptosis/partial-blink center-shift bias and attenuate closed-eye weight', () => {
    const baseLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    baseLandmarks[33] = { x: 0.30, y: 0.45, z: 0 };
    baseLandmarks[133] = { x: 0.40, y: 0.45, z: 0 }; // eyeWidth = 0.10
    baseLandmarks[159] = { x: 0.35, y: 0.435, z: 0 };
    baseLandmarks[145] = { x: 0.35, y: 0.465, z: 0 }; // apertureRatio = 0.30
    // True iris center at (0.35, 0.448)
    baseLandmarks[468] = { x: 0.35, y: 0.448, z: 0 };
    baseLandmarks[469] = { x: 0.365, y: 0.448, z: 0 };
    baseLandmarks[470] = { x: 0.35, y: 0.433, z: 0 };
    baseLandmarks[471] = { x: 0.335, y: 0.448, z: 0 };
    baseLandmarks[472] = { x: 0.35, y: 0.463, z: 0 };

    const open = analyzeSubpixelEyeGeometry(baseLandmarks, 'left', 640, 480, 1.15);

    // Simulate drooping upper eyelid pushing top iris rim (470) & upperLid (159) down while true optical center (468) stays fixed
    const ptosisLandmarks = baseLandmarks.map(pt => ({ ...pt }));
    ptosisLandmarks[159] = { x: 0.35, y: 0.447, z: 0 }; // Drooped upper eyelid
    ptosisLandmarks[470] = { x: 0.35, y: 0.447, z: 0 }; // Upper iris rim occluded downward

    const occluded = analyzeSubpixelEyeGeometry(ptosisLandmarks, 'left', 640, 480, 1.15);

    // Equator symmetry must prevent false downward gaze drop despite upper-lid occlusion
    expect(Math.abs(occluded.sphericalGazeY - open.sphericalGazeY)).toBeLessThan(0.025);
    expect(occluded.upperLidOcclusion).toBeGreaterThan(open.upperLidOcclusion);
    expect(occluded.confidenceWeight).toBeLessThan(open.confidenceWeight * 0.5);
  });
});
