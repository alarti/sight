/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HeadPoseData } from '../types/index.ts';
import { LandmarkPoint, SubpixelEyeAnalysis } from './headPose.ts';

export interface BlendshapeGazeSignal {
  deltaX: number; // [-1, +1] horizontal eye rotation estimate from facial blendshapes
  deltaY: number; // [-1, +1] vertical eye rotation (+ downward, - upward)
  downScore: number;
  upScore: number;
  confidence: number;
}

export interface Raycast3DGazeResult {
  rayGazeX: number; // [0, 1] mirrored screen-aligned azimuth from 3D eyeball raycast
  rayGazeY: number; // [0, 1] elevation from 3D eyeball raycast
  vectorX: number;  // normalized optical axis tangent tan(theta_x)
  vectorY: number;  // normalized optical axis tangent tan(theta_y)
  valid: boolean;
}

export interface PhotometricCentroidResult {
  normX: number; // [0, 1] refined sub-pixel dark-pupil centroid X inside ROI
  normY: number; // [0, 1] refined sub-pixel dark-pupil centroid Y inside ROI
  confidence: number; // [0, 1] photometric SNR confidence
  active: boolean;
}

export interface FusedGazeOutput {
  fusedX: number;
  fusedY: number;
  ray3DX: number;
  ray3DY: number;
  blendshapeY: number;
  photometricActive: boolean;
}

/**
 * Extracts directional ocular rotation scores from MediaPipe ARKit-compatible blendshapes.
 * Particularly effective at rescuing downward gaze when the upper eyelid partially occludes the iris.
 */
export function extractBlendshapeGaze(
  categories?: Array<{ categoryName: string; score: number }>
): BlendshapeGazeSignal {
  if (!categories || categories.length === 0) {
    return { deltaX: 0, deltaY: 0, downScore: 0, upScore: 0, confidence: 0 };
  }

  const getScore = (name: string) => categories.find(c => c.categoryName === name)?.score ?? 0;

  const lookOutL = getScore('eyeLookOutLeft');
  const lookInL = getScore('eyeLookInLeft');
  const lookUpL = getScore('eyeLookUpLeft');
  const lookDownL = getScore('eyeLookDownLeft');

  const lookOutR = getScore('eyeLookOutRight');
  const lookInR = getScore('eyeLookInRight');
  const lookUpR = getScore('eyeLookUpRight');
  const lookDownR = getScore('eyeLookDownRight');

  const blinkL = getScore('eyeBlinkLeft');
  const blinkR = getScore('eyeBlinkRight');
  const maxBlink = Math.max(blinkL, blinkR);

  const downScore = (lookDownL + lookDownR) * 0.5;
  const upScore = (lookUpL + lookUpR) * 0.5;
  const rightWard = (lookInL + lookOutR) * 0.5;
  const leftWard = (lookOutL + lookInR) * 0.5;

  const deltaY = Math.max(-1, Math.min(1, downScore - upScore));
  const deltaX = Math.max(-1, Math.min(1, leftWard - rightWard));
  const confidence = maxBlink > 0.5 ? 0 : Math.max(0, Math.min(1, 1 - maxBlink * 1.4));

  return { deltaX, deltaY, downScore, upScore, confidence };
}

function norm3(vx: number, vy: number, vz: number): [number, number, number] {
  const len = Math.hypot(vx, vy, vz);
  if (len < 1e-7) return [0, 0, 1];
  return [vx / len, vy / len, vz / len];
}

function cross3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function dot3(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * 3D Spherical Eyeball Optical-Axis Raycasting:
 * Reconstructs the anatomical 3D cranial socket basis and places the eyeball rotation center
 * anatomically behind the palpebral plane (r_eye ≈ 0.44 * intercanthal_width).
 * Computes the 3D visual-axis unit vector from eyeball center to 3D iris landmark,
 * projects onto the skull-stabilized basis (or facialTransformationMatrix if provided),
 * and evaluates perspective ray-screen intersection coordinates (invariant to head Z distance).
 */
export function solve3DEyeballVisualAxisRay(
  landmarks: LandmarkPoint[],
  side: 'left' | 'right',
  irisNormX: number,
  irisNormY: number,
  verticalGainMultiplier: number = 1.15,
  facialMatrix?: number[]
): Raycast3DGazeResult {
  if (!landmarks || landmarks.length < 468) {
    return { rayGazeX: 0.5, rayGazeY: 0.5, vectorX: 0, vectorY: 0, valid: false };
  }

  const lOuter = landmarks[33];
  const rOuter = landmarks[263];
  const noseBridge = landmarks[168] || landmarks[6] || landmarks[1];
  const chin = landmarks[152];
  const eyeOuter = landmarks[side === 'left' ? 33 : 263];
  const eyeInner = landmarks[side === 'left' ? 133 : 362];
  const irisCenter = landmarks[side === 'left' ? 468 : 473] || { x: irisNormX, y: irisNormY, z: 0 };

  if (!lOuter || !rOuter || !noseBridge || !chin || !eyeOuter || !eyeInner) {
    return { rayGazeX: 0.5, rayGazeY: 0.5, vectorX: 0, vectorY: 0, valid: false };
  }

  const lz = lOuter.z ?? 0;
  const rz = rOuter.z ?? 0;
  const bz = noseBridge.z ?? 0;
  const cz = chin.z ?? 0;

  const vRight = norm3(rOuter.x - lOuter.x, rOuter.y - lOuter.y, rz - lz);
  const vDown = norm3(chin.x - noseBridge.x, chin.y - noseBridge.y, cz - bz);

  // Orthonormal cranial triad [ex (screen right), ey (screen down), ez (anterior toward camera)]
  let ex: [number, number, number];
  let ey: [number, number, number];
  let ez: [number, number, number];

  if (facialMatrix && facialMatrix.length >= 16) {
    // Column-major 4x4 matrix from MediaPipe FaceLandmarker; align signs with normalized image space
    ex = norm3(facialMatrix[0], facialMatrix[1], facialMatrix[2]);
    if (dot3(ex, vRight) < 0) ex = [-ex[0], -ex[1], -ex[2]];
    ey = norm3(facialMatrix[4], facialMatrix[5], facialMatrix[6]);
    if (dot3(ey, vDown) < 0) ey = [-ey[0], -ey[1], -ey[2]];
    ez = norm3(...cross3(ey, ex));
    if (ez[2] > 0) ez = [-ez[0], -ez[1], -ez[2]];
  } else {
    ex = vRight;
    // ey x ex points toward camera (-Z) when ex is +X and ey is +Y (downward)
    ez = norm3(...cross3(vDown, ex));
    if (ez[2] > 0) {
      ez = [-ez[0], -ez[1], -ez[2]];
    }
    // Re-orthogonalize ey = ex x ez so [ex, ey, ez] matches (+X, +Y, -Z)
    ey = norm3(...cross3(ex, ez));
    if (dot3(ey, vDown) < 0) {
      ey = [-ey[0], -ey[1], -ey[2]];
    }
  }

  const eyeWidth3D = Math.max(
    0.015,
    Math.hypot(
      eyeInner.x - eyeOuter.x,
      eyeInner.y - eyeOuter.y,
      (eyeInner.z ?? 0) - (eyeOuter.z ?? 0)
    )
  );

  // Palpebral socket midpoint in 3D normalized space
  const midX = (eyeOuter.x + eyeInner.x) * 0.5;
  const midY = (eyeOuter.y + eyeInner.y) * 0.5;
  const midZ = ((eyeOuter.z ?? 0) + (eyeInner.z ?? 0)) * 0.5;

  // Eyeball center is posterior to the canthal plane along -ez
  const eyeballRadius = eyeWidth3D * 0.44;
  const cx = midX - eyeballRadius * ez[0];
  const cy = midY - eyeballRadius * ez[1];
  const czEye = midZ - eyeballRadius * ez[2];

  // 3D iris vector from eyeball rotation center
  const irisZ = irisCenter.z ?? midZ;
  const rx = irisNormX - cx;
  const ry = irisNormY - cy;
  const rzVec = irisZ - czEye;

  const rayDir = norm3(rx, ry, rzVec);

  // Project 3D ray direction onto cranial local triad
  const localX = dot3(rayDir, ex);
  const localY = dot3(rayDir, ey);
  const localZ = Math.max(0.25, Math.abs(dot3(rayDir, ez)));

  // Tangent projection onto frontal viewing plane (invariant to Z distance)
  const tanX = localX / localZ;
  const tanY = localY / localZ;

  // Map tangent angles onto normalized [0, 1] gaze domain (mirrored selfie X)
  // Typical comfortable azimuth span ~ [-0.45, +0.45], elevation resting bias ~ -0.055
  const rayGazeX = Math.min(0.98, Math.max(0.02, 0.5 - tanX * 1.12));
  const vertScale = 1.65 * verticalGainMultiplier;
  const rayGazeY = Math.min(0.98, Math.max(0.02, 0.5 + (tanY - (-0.045)) * vertScale));

  return {
    rayGazeX,
    rayGazeY,
    vectorX: tanX,
    vectorY: tanY,
    valid: Number.isFinite(rayGazeX) && Number.isFinite(rayGazeY),
  };
}

/**
 * Pure photometric dark-pupil & iris intensity centroid solver inside a cropped luminance ROI.
 * Eliminates MediaPipe landmark discrete step jitter by weighting squared luminance deficit
 * (threshold - L(x,y))^2 inside an elliptical palpebral mask with a gentle center prior.
 */
export function computePhotometricPupilCentroid(
  luma: ArrayLike<number>,
  width: number,
  height: number,
  initX: number,
  initY: number,
  rx: number,
  ry: number
): PhotometricCentroidResult {
  if (width < 6 || height < 4 || luma.length < width * height) {
    return { normX: 0.5, normY: 0.5, confidence: 0, active: false };
  }

  const samples: number[] = [];
  const invRx2 = 1 / Math.max(2, rx * rx);
  const invRy2 = 1 / Math.max(2, ry * ry);

  for (let py = 0; py < height; py++) {
    const dy = py - initY;
    for (let px = 0; px < width; px++) {
      const dx = px - initX;
      const ellip = dx * dx * invRx2 + dy * dy * invRy2;
      if (ellip <= 1.0) {
        samples.push(luma[py * width + px]);
      }
    }
  }

  if (samples.length < 12) {
    return { normX: initX / width, normY: initY / height, confidence: 0, active: false };
  }

  samples.sort((a, b) => a - b);
  const p10 = samples[Math.floor(samples.length * 0.10)];
  const p75 = samples[Math.floor(samples.length * 0.75)];
  const contrast = p75 - p10;

  if (contrast < 14) {
    // Insufficient contrast (e.g., severe shadow or closed eye)
    return { normX: initX / width, normY: initY / height, confidence: 0, active: false };
  }

  const threshold = p75 - 0.34 * contrast;
  let sumW = 0;
  let sumX = 0;
  let sumY = 0;

  for (let py = 0; py < height; py++) {
    const dy = py - initY;
    for (let px = 0; px < width; px++) {
      const dx = px - initX;
      const ellip = dx * dx * invRx2 + dy * dy * invRy2;
      if (ellip > 1.0) continue;

      const l = luma[py * width + px];
      if (l < threshold) {
        const deficit = (threshold - l) / contrast;
        // Gaussian radial prior around landmark anchor suppresses eyelash border pull
        const spatialPrior = Math.exp(-1.15 * ellip);
        const w = deficit * deficit * spatialPrior;
        sumW += w;
        sumX += w * px;
        sumY += w * py;
      }
    }
  }

  if (sumW < 1e-4) {
    return { normX: initX / width, normY: initY / height, confidence: 0, active: false };
  }

  const cx = sumX / sumW;
  const cy = sumY / sumW;
  const confidence = Math.min(1, Math.max(0, (contrast - 14) / 70));

  return {
    normX: cx / width,
    normY: cy / height,
    confidence,
    active: true,
  };
}

/**
 * Samples the tiny palpebral ROI directly from the live webcam video element onto an offscreen
 * 2D canvas and runs photometric dark-pupil sub-pixel refinement. Zero external data leaves browser.
 */
export function sampleEyeRoiPhotometricCentroid(
  video: HTMLVideoElement,
  roiCanvas: HTMLCanvasElement,
  landmarks: LandmarkPoint[],
  side: 'left' | 'right',
  irisNormX: number,
  irisNormY: number,
  videoW: number,
  videoH: number
): { refinedNormX: number; refinedNormY: number; confidence: number; active: boolean } {
  const outer = landmarks[side === 'left' ? 33 : 263];
  const inner = landmarks[side === 'left' ? 133 : 362];
  const upper = landmarks[side === 'left' ? 159 : 386];
  const lower = landmarks[side === 'left' ? 145 : 374];

  if (!outer || !inner || !upper || !lower || video.readyState < 2 || videoW < 64 || videoH < 48) {
    return { refinedNormX: irisNormX, refinedNormY: irisNormY, confidence: 0, active: false };
  }

  const minX = Math.min(outer.x, inner.x);
  const maxX = Math.max(outer.x, inner.x);
  const eyePxW = Math.max(12, (maxX - minX) * videoW);
  const midX = (outer.x + inner.x) * 0.5 * videoW;
  const midY = (outer.y + inner.y) * 0.5 * videoH;
  const lidPxH = Math.max(8, Math.hypot(lower.x - upper.x, lower.y - upper.y) * videoH);

  const cropW = Math.min(videoW, Math.max(20, Math.round(eyePxW * 1.15)));
  const cropH = Math.min(videoH, Math.max(14, Math.round(lidPxH * 1.35)));
  const sx = Math.max(0, Math.min(videoW - cropW, Math.round(midX - cropW * 0.5)));
  const sy = Math.max(0, Math.min(videoH - cropH, Math.round(midY - cropH * 0.5)));

  const outW = 36;
  const outH = 22;
  if (roiCanvas.width !== outW) roiCanvas.width = outW;
  if (roiCanvas.height !== outH) roiCanvas.height = outH;

  const ctx = roiCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { refinedNormX: irisNormX, refinedNormY: irisNormY, confidence: 0, active: false };
  }

  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, outW, outH);
  const imgData = ctx.getImageData(0, 0, outW, outH).data;
  const luma = new Float32Array(outW * outH);
  for (let i = 0; i < outW * outH; i++) {
    const idx = i * 4;
    // Rec.709 luminance weighted toward red channel (minimizes sclera redness artifact, maximizes iris-sclera contrast)
    luma[i] = 0.38 * imgData[idx] + 0.50 * imgData[idx + 1] + 0.12 * imgData[idx + 2];
  }

  const initX = ((irisNormX * videoW - sx) / cropW) * outW;
  const initY = ((irisNormY * videoH - sy) / cropH) * outH;
  const rx = (eyePxW / cropW) * outW * 0.36;
  const ry = (lidPxH / cropH) * outH * 0.38;

  const res = computePhotometricPupilCentroid(luma, outW, outH, initX, initY, rx, ry);
  if (!res.active) {
    return { refinedNormX: irisNormX, refinedNormY: irisNormY, confidence: 0, active: false };
  }

  const refinedVideoPxX = sx + res.normX * cropW;
  const refinedVideoPxY = sy + res.normY * cropH;

  // Bounded blend (max 28% weight) so landmark topology constrains extreme lighting shadows
  const alpha = 0.28 * res.confidence;
  const refinedNormX = irisNormX * (1 - alpha) + (refinedVideoPxX / videoW) * alpha;
  const refinedNormY = irisNormY * (1 - alpha) + (refinedVideoPxY / videoH) * alpha;

  return {
    refinedNormX,
    refinedNormY,
    confidence: res.confidence,
    active: true,
  };
}

/**
 * Multi-Modal Ocular Sensor Fusion:
 * Combines 2D Canthal Equator Projection + 3D Eyeball Optical-Axis Raycasting
 * + Directional ARKit Eye Blendshapes (especially downward eyelid occlusion rescue)
 * into a unified, low-noise gaze representation.
 */
export function fuseGazeChannels(
  leftEye: SubpixelEyeAnalysis,
  rightEye: SubpixelEyeAnalysis,
  leftRay3D: Raycast3DGazeResult,
  rightRay3D: Raycast3DGazeResult,
  blendshapes: BlendshapeGazeSignal,
  headPose: HeadPoseData,
  invertY: boolean,
  photometricActive: boolean
): FusedGazeOutput {
  const totalW = Math.max(1e-5, leftEye.confidenceWeight + rightEye.confidenceWeight);
  const wL = leftEye.confidenceWeight / totalW;
  const wR = rightEye.confidenceWeight / totalW;

  const raw2DX = leftEye.sphericalGazeX * wL + rightEye.sphericalGazeX * wR;
  let raw2DY = leftEye.sphericalGazeY * wL + rightEye.sphericalGazeY * wR;

  let ray3DX = raw2DX;
  let ray3DY = raw2DY;
  const hasRay3D = leftRay3D.valid && rightRay3D.valid;
  if (hasRay3D) {
    ray3DX = leftRay3D.rayGazeX * wL + rightRay3D.rayGazeX * wR;
    ray3DY = leftRay3D.rayGazeY * wL + rightRay3D.rayGazeY * wR;
  }

  if (invertY) {
    raw2DY = 1.0 - raw2DY;
    ray3DY = 1.0 - ray3DY;
  }

  // Blend 3D visual-axis raycast (~32%) with 2D canthal projection (~68%) for geometric depth robustness
  let fusedX = hasRay3D ? raw2DX * 0.68 + ray3DX * 0.32 : raw2DX;
  let fusedY = hasRay3D ? raw2DY * 0.68 + ray3DY * 0.32 : raw2DY;

  // Rescues downward/upward eyelid occlusion using directional eye blendshapes
  const occlusionAvg = (leftEye.upperLidOcclusion + rightEye.upperLidOcclusion) * 0.5;
  const blendSignY = invertY ? -blendshapes.deltaY : blendshapes.deltaY;
  const blendGainY = (0.045 + Math.min(0.065, occlusionAvg * 0.14)) * blendshapes.confidence;
  const blendContributionY = blendSignY * blendGainY;
  fusedY = Math.min(0.99, Math.max(0.01, fusedY + blendContributionY));

  // Subtle head roll/pitch sanity clamp
  if (!Number.isFinite(fusedX) || !Number.isFinite(fusedY) || Math.abs(headPose.rollDeg) > 85) {
    fusedX = raw2DX;
    fusedY = raw2DY;
  }

  return {
    fusedX,
    fusedY,
    ray3DX,
    ray3DY,
    blendshapeY: blendSignY,
    photometricActive,
  };
}
