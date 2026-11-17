/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UiTargetRect {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BayesianTargetState {
  lockedTargetId: string | null;
  confidence: number; // Posterior probability [0, 1] of the winning target
  displayX: number;   // Posterior-stabilized screen X
  displayY: number;   // Posterior-stabilized screen Y
  runnerUpId: string | null;
}

/**
 * Computes anisotropic Mahalanobis-Gaussian likelihood of gaze (gx, gy) belonging to a UI rectangle.
 * Accounts for physiological eye-tracking vertical uncertainty (sigmaY > sigmaX) so minor vertical
 * eyelid variance never causes missed button hits.
 */
export function computeTargetGaussianLikelihood(
  gx: number,
  gy: number,
  rect: UiTargetRect,
  sigmaX: number,
  sigmaY: number
): number {
  const clampedX = Math.max(rect.left, Math.min(rect.right, gx));
  const clampedY = Math.max(rect.top, Math.min(rect.bottom, gy));
  const edgeDx = (gx - clampedX) / Math.max(10, sigmaX);
  const edgeDy = (gy - clampedY) / Math.max(12, sigmaY);
  const edgeDistSq = edgeDx * edgeDx + edgeDy * edgeDy;

  // Mild center-of-target tie-breaker so adjacent tight keys resolve cleanly
  const cx = (rect.left + rect.right) * 0.5;
  const cy = (rect.top + rect.bottom) * 0.5;
  const w = Math.max(24, rect.right - rect.left);
  const h = Math.max(24, rect.bottom - rect.top);
  const centerDistSq = (((gx - cx) / w) ** 2 + ((gy - cy) / h) ** 2) * 0.14;

  return Math.exp(-0.5 * (edgeDistSq + centerDistSq));
}

/**
 * Sequential Bayesian Gaze-to-Target Posterior Decoder:
 * Instead of fragile single-pixel `elementFromPoint` hit-testing, maintains a temporal log-posterior
 * probability distribution over all visible UI targets `[data-dwell-id]`, eliminating boundary tremor
 * and "vertical slip" near button edges while instantly releasing during voluntary saccades.
 */
export class BayesianTargetDecoder {
  private posteriors = new Map<string, number>();
  private lastLockedId: string | null = null;
  private lastRawX = 0;
  private lastRawY = 0;

  public reset() {
    this.posteriors.clear();
    this.lastLockedId = null;
  }

  public update(
    gx: number,
    gy: number,
    targets: UiTargetRect[],
    eyeVelocityPxPerSec: number,
    signalQuality: number = 0.85,
    inSanctuaryZone: boolean = false
  ): BayesianTargetState {
    if (inSanctuaryZone || targets.length === 0) {
      this.reset();
      this.lastRawX = gx;
      this.lastRawY = gy;
      return {
        lockedTargetId: null,
        confidence: 0,
        displayX: gx,
        displayY: gy,
        runnerUpId: null,
      };
    }

    const stepJump = Math.hypot(gx - this.lastRawX, gy - this.lastRawY);
    this.lastRawX = gx;
    this.lastRawY = gy;

    // Reset temporal memory on fast saccadic jump so navigation stays responsive with zero stickiness lag
    if (eyeVelocityPxPerSec > 230 || stepJump > 95) {
      this.posteriors.clear();
    }

    // Anisotropic physiological noise model (vertical eye aperture has ~1.4x larger variance)
    const qualityBoost = 1.0 + Math.max(0, 0.9 - signalQuality) * 0.7;
    const sigmaX = 28 * qualityBoost;
    const sigmaY = 40 * qualityBoost;

    // "Background / empty canvas" null hypothesis competes against target locks
    const nullPrior = 0.085;
    let totalMass = nullPrior;
    const unnorm = new Map<string, number>();

    const decayExponent = eyeVelocityPxPerSec > 110 ? 0.45 : 0.78;
    const uniformFloor = 1.0 / (targets.length + 1);

    for (const target of targets) {
      const likelihood = computeTargetGaussianLikelihood(gx, gy, target, sigmaX, sigmaY);
      const prev = this.posteriors.get(target.id) ?? uniformFloor;
      const prior = Math.pow(Math.max(0.015, prev), decayExponent);
      const score = prior * likelihood;
      unnorm.set(target.id, score);
      totalMass += score;
    }

    let bestTarget: UiTargetRect | null = null;
    let bestProb = 0;
    let runnerUpId: string | null = null;
    let runnerUpProb = 0;

    this.posteriors.clear();
    for (const target of targets) {
      const prob = (unnorm.get(target.id) ?? 0) / Math.max(1e-8, totalMass);
      this.posteriors.set(target.id, prob);
      if (prob > bestProb) {
        runnerUpProb = bestProb;
        runnerUpId = bestTarget?.id ?? null;
        bestProb = prob;
        bestTarget = target;
      } else if (prob > runnerUpProb) {
        runnerUpProb = prob;
        runnerUpId = target.id;
      }
    }

    // Hysteresis lock threshold: 0.48 to acquire, 0.36 to retain once locked
    const acquireThreshold = this.lastLockedId && bestTarget?.id === this.lastLockedId ? 0.36 : 0.48;
    const isLocked = Boolean(bestTarget && bestProb >= acquireThreshold && bestProb > runnerUpProb * 1.12);

    if (!isLocked || !bestTarget) {
      this.lastLockedId = null;
      return {
        lockedTargetId: null,
        confidence: bestProb,
        displayX: gx,
        displayY: gy,
        runnerUpId,
      };
    }

    this.lastLockedId = bestTarget.id;

    // Smooth posterior-weighted attraction toward target's interior anchor
    const targetCenterX = (bestTarget.left + bestTarget.right) * 0.5;
    const targetCenterY = (bestTarget.top + bestTarget.bottom) * 0.5;
    const pullWeight = Math.min(0.72, Math.max(0.22, (bestProb - 0.30) * 1.05));

    return {
      lockedTargetId: bestTarget.id,
      confidence: bestProb,
      displayX: gx * (1 - pullWeight) + targetCenterX * pullWeight,
      displayY: gy * (1 - pullWeight) + targetCenterY * pullWeight,
      runnerUpId,
    };
  }
}

/**
 * Helper to gather visible interactive `[data-dwell-id]` targets from DOM safely.
 */
export function collectVisibleDwellTargets(
  allowedTargetId?: string | null
): UiTargetRect[] {
  if (typeof document === 'undefined') return [];
  const els = document.querySelectorAll('[data-dwell-id]');
  const result: UiTargetRect[] = [];

  for (let i = 0; i < els.length; i++) {
    const el = els[i] as HTMLElement;
    const id = el.getAttribute('data-dwell-id');
    if (!id) continue;
    if (allowedTargetId && id !== allowedTargetId) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) {
      continue;
    }

    result.push({
      id,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  }

  return result;
}
