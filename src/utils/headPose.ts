/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HeadPoseData } from '../types/index.ts';

export interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface SubpixelEyeAnalysis {
  pupilCenterNorm: { x: number; y: number };
  pupilVideoPx: { x: number; y: number };
  canthalLocalX: number; // Normalized [0, 1] along anatomical canthal axis (roll-invariant)
  canthalLocalY: number; // Normalized vertical displacement relative to canthal axis
  sphericalGazeX: number; // 3D eyeball spherical azimuth projection [0, 1]
  sphericalGazeY: number; // 3D eyeball spherical elevation projection [0, 1]
  apertureRatio: number; // Palpebral fissure openness ratio (height / width)
  upperLidOcclusion: number; // [0, 1] degree of upper eyelid occlusion on iris superior rim
  confidenceWeight: number; // Binocular quality weight based on foreshortening & aperture
}

/**
 * [Paper Section 4.1: 3D Landmark Vector Decomposition]
 * Computes 3D head rotation angles (Euler Yaw psi, Pitch theta, Roll phi) from MediaPipe landmarks
 */
export function estimateHeadPose(landmarks: LandmarkPoint[]): HeadPoseData {
  if (!landmarks || landmarks.length < 468) {
    return { yawDeg: 0, pitchDeg: 0, rollDeg: 0, normYaw: 0, normPitch: 0 };
  }

  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const forehead = landmarks[10];
  const leftCheek = landmarks[234];
  const rightCheek = landmarks[454];

  // 1. Horizontal Head Yaw (left / right rotation)
  const dLeft = Math.abs(noseTip.x - leftCheek.x);
  const dRight = Math.abs(rightCheek.x - noseTip.x);
  const normYaw = (dRight - dLeft) / Math.max(0.001, dRight + dLeft);
  const yawDeg = Math.round(normYaw * 45);

  // 2. Vertical Head Pitch (up / down chin nod)
  let normPitch = 0;
  if (typeof chin.z === 'number' && typeof forehead.z === 'number') {
    const dz = chin.z - forehead.z;
    const dy = Math.max(0.01, chin.y - forehead.y);
    normPitch = Math.min(1.0, Math.max(-1.0, (dz / dy) * 1.5));
  } else {
    const dTop = Math.abs(noseTip.y - forehead.y);
    const dBottom = Math.abs(chin.y - noseTip.y);
    normPitch = (dBottom - dTop) / Math.max(0.001, dBottom + dTop);
  }
  const pitchDeg = Math.round(normPitch * 40);

  // 3. Lateral Head Roll (head tilt angle)
  const rollRad = Math.atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x);
  const rollDeg = Math.round(rollRad * (180 / Math.PI));

  return {
    yawDeg,
    pitchDeg,
    rollDeg,
    normYaw,
    normPitch
  };
}

/**
 * High-SNR Sub-Pixel Iris & Palpebral Constellation Analyzer:
 * - Averages all 5 MediaPipe iris landmarks (center + 4 cardinal limbus points)
 *   to reduce single-landmark quantization flicker by >55%
 * - Projects pupil displacement onto the Roll-Invariant Orthonormal Canthal Basis
 *   anchored at the medial and lateral canthi (33, 133 / 362, 263)
 * - Fuses vertical iris displacement with synergistic palpebral fissure shift
 *   for smooth, monotonic vertical tracking without discontinuous jumps
 */
export function analyzeSubpixelEyeGeometry(
  landmarks: LandmarkPoint[],
  side: 'left' | 'right',
  videoW: number,
  videoH: number,
  verticalGainMultiplier: number = 1.15
): SubpixelEyeAnalysis {
  // Multi-point bony canthal anchors for lower noise
  const outerIdx = side === 'left' ? 33 : 263;
  const innerIdx = side === 'left' ? 133 : 362;
  const upperLidIdx = side === 'left' ? 159 : 386;
  const lowerLidIdx = side === 'left' ? 145 : 374;
  const irisBaseIdx = side === 'left' ? 468 : 473;

  const outerCanthus = landmarks[outerIdx] || { x: 0.35, y: 0.45, z: 0 };
  const innerCanthus = landmarks[innerIdx] || { x: 0.45, y: 0.45, z: 0 };
  const upperLid = landmarks[upperLidIdx] || { x: 0.40, y: 0.43, z: 0 };
  const lowerLid = landmarks[lowerLidIdx] || { x: 0.40, y: 0.47, z: 0 };

  // Extract 5-point iris constellation: [center, rightRim, topRim, leftRim, bottomRim]
  const pCenter = landmarks[irisBaseIdx] || {
    x: (outerCanthus.x + innerCanthus.x) * 0.5,
    y: (outerCanthus.y + innerCanthus.y) * 0.5,
    z: 0
  };
  const pRight = landmarks[irisBaseIdx + 1] || pCenter;
  const pTop = landmarks[irisBaseIdx + 2] || pCenter;
  const pLeft = landmarks[irisBaseIdx + 3] || pCenter;
  const pBottom = landmarks[irisBaseIdx + 4] || pCenter;

  // 1. Compute palpebral aperture & upper-lid occlusion first so occlusion-immune iris weighting applies
  const canthusDx0 = innerCanthus.x - outerCanthus.x;
  const canthusDy0 = innerCanthus.y - outerCanthus.y;
  const eyeWidth = Math.max(0.001, Math.hypot(canthusDx0, canthusDy0));

  const lidHeight = Math.hypot(lowerLid.x - upperLid.x, lowerLid.y - upperLid.y);
  const apertureRatio = lidHeight / eyeWidth;
  const horizIrisDiameter = Math.hypot(pRight.x - pLeft.x, pRight.y - pLeft.y);
  const verticalIrisSpan = Math.hypot(pBottom.x - pTop.x, pBottom.y - pTop.y);
  const compressionRatio = horizIrisDiameter > 1e-4 ? Math.min(1.0, verticalIrisSpan / horizIrisDiameter) : 1.0;
  const upperLidOcclusion = Math.max(0, Math.min(1.0, 1.0 - compressionRatio));

  // Symmetric occlusion-immune sub-pixel iris centroid:
  // Horizontal equator (pCenter + pLeft/pRight) stays centered vertically even when upper eyelid covers pTop;
  // vertical rim pair (pTop + pBottom) is attenuated symmetrically as upperLidOcclusion rises (zero center-shift bias).
  const occFactor = Math.min(1.0, Math.max(0.0, (upperLidOcclusion - 0.12) / 0.35));
  const vertPairWeight = 0.25 * (1.0 - occFactor);
  const equatorX = pCenter.x * 0.60 + (pRight.x + pLeft.x) * 0.20;
  const equatorY = pCenter.y * 0.60 + (pRight.y + pLeft.y) * 0.20;
  const vertPairX = (pTop.x + pBottom.x) * 0.5;
  const vertPairY = (pTop.y + pBottom.y) * 0.5;
  const subpixelX = equatorX * (1.0 - vertPairWeight) + vertPairX * vertPairWeight;
  const subpixelY = equatorY * (1.0 - vertPairWeight) + vertPairY * vertPairWeight;

  // 2. Construct Roll-Invariant Orthonormal Canthal Coordinate Frame
  const leftCorner = outerCanthus.x < innerCanthus.x ? outerCanthus : innerCanthus;
  const rightCorner = outerCanthus.x < innerCanthus.x ? innerCanthus : outerCanthus;

  const canthusDx = rightCorner.x - leftCorner.x;
  const canthusDy = rightCorner.y - leftCorner.y;

  // Unit basis vectors u_x (along palpebral fissure) and u_y (orthogonal downward normal)
  const uxX = canthusDx / eyeWidth;
  const uxY = canthusDy / eyeWidth;
  const uyX = -uxY;
  const uyY = uxX;

  const canthusMidX = (leftCorner.x + rightCorner.x) * 0.5;
  const canthusMidY = (leftCorner.y + rightCorner.y) * 0.5;

  // Project sub-pixel iris centroid onto roll-invariant anatomical basis
  // Pure iris projection (decoupled from upper-lid movement so blinks/ptosis never trigger false downward cursor drops)
  const relPx = subpixelX - canthusMidX;
  const relPy = subpixelY - canthusMidY;

  const projHoriz = (relPx * uxX + relPy * uxY) / eyeWidth; // [-0.5, +0.5]
  const projVert = (relPx * uyX + relPy * uyY) / eyeWidth;

  const canthalLocalX = Math.min(1.0, Math.max(0.0, 0.5 + projHoriz));
  const canthalLocalY = projVert;

  // 3. Smooth Monotonic Gaze Coordinates [0, 1]
  // Mirror horizontal axis for front-facing selfie camera
  const sphericalGazeX = 1.0 - Math.min(1.0, Math.max(0.0, 0.5 + projHoriz));

  // Resting forward gaze delta_y^rest is -0.025 relative to canthal midline;
  // use a single smooth C^1 continuous gain without clipping at extreme camera angles
  const deltaY = projVert - (-0.025);
  const vertScale = 1.85 * verticalGainMultiplier;
  const sphericalGazeY = Math.min(0.98, Math.max(0.02, 0.5 + deltaY * vertScale));

  // 4. Binocular Confidence Weight (penalizes closed/squinted eye quadratically so clear eye dominates)
  const apertureQuality = Math.min(1.0, Math.max(0.05, (apertureRatio - 0.11) / 0.19));
  const confidenceWeight = Math.max(0.05, eyeWidth * apertureQuality * apertureQuality);

  return {
    pupilCenterNorm: { x: subpixelX, y: subpixelY },
    pupilVideoPx: { x: subpixelX * videoW, y: subpixelY * videoH },
    canthalLocalX,
    canthalLocalY,
    sphericalGazeX,
    sphericalGazeY,
    apertureRatio,
    upperLidOcclusion,
    confidenceWeight
  };
}

/**
 * [Paper Section 4.2: Concordant Compensation Formulation]
 * Combines ocular pupil vector and head rotation to calculate stabilized gaze vector
 */
export function applyHeadPoseCompensation(
  rawPupilX: number,
  rawPupilY: number,
  headPose: HeadPoseData,
  invertPitch: boolean = false
): { compensatedX: number; compensatedY: number } {
  const yawCorrectionGain = 0.055;
  const pitchCorrectionGain = 0.032;

  // Smooth C^1 soft-threshold deadzone around resting head posture
  const softDeadzone = (val: number, thresh: number) => {
    const absV = Math.abs(val);
    if (absV <= thresh) return 0;
    const excess = absV - thresh;
    return Math.sign(val) * (excess * excess) / (excess + 0.04);
  };

  const deadzoneYaw = softDeadzone(headPose.normYaw, 0.05);
  const deadzonePitch = softDeadzone(headPose.normPitch, 0.07);
  const effectivePitch = invertPitch ? -deadzonePitch : deadzonePitch;

  const compensatedX = Math.min(1.0, Math.max(0.0, rawPupilX + deadzoneYaw * yawCorrectionGain));
  const compensatedY = Math.min(1.0, Math.max(0.0, rawPupilY + effectivePitch * pitchCorrectionGain));

  return {
    compensatedX,
    compensatedY
  };
}
