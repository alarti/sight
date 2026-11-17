/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TrackballUpdateInput {
  rawGazeX: number;
  rawGazeY: number;
  neutralX: number;
  neutralY: number;
  sensitivityX: number;
  sensitivityY: number;
  dtSec: number;
  screenW: number;
  screenH: number;
  isOverTarget?: boolean;
}

/**
 * Ocular Trackball (Foveal Relative-Velocity Cursor):
 * Alternative cursor positioning paradigm designed for patients with restricted eye excursion,
 * asymmetry, or steep laptop/wheelchair camera angles.
 * Instead of requiring extreme absolute eyeball positions to reach screen corners, looking slightly
 * off the comfortable resting foveal deadzone drives cursor velocity via a C^1 cubic curve,
 * while automatically braking inside interactive buttons so dwelling is effortless.
 */
export class OcularTrackballController {
  private posX: number;
  private posY: number;

  constructor(initialX: number = 640, initialY: number = 360) {
    this.posX = initialX;
    this.posY = initialY;
  }

  public setPosition(x: number, y: number) {
    this.posX = x;
    this.posY = y;
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.posX, y: this.posY };
  }

  public update(input: TrackballUpdateInput): { x: number; y: number; speedPxPerSec: number } {
    const dt = Math.min(0.08, Math.max(0.001, input.dtSec));
    const dx = input.rawGazeX - input.neutralX;
    const dy = input.rawGazeY - input.neutralY;

    // Comfortable resting foveal sanctuary deadzone around neutral center
    const deadzoneX = 0.026;
    const deadzoneY = 0.024;

    const exX = Math.max(0, Math.abs(dx) - deadzoneX);
    const exY = Math.max(0, Math.abs(dy) - deadzoneY);

    // Non-linear cubic velocity transfer curve: fine slow micro-glides near deadzone, rapid reach further out
    const gainX = (input.sensitivityX / 14.0) * 1950;
    const gainY = (input.sensitivityY / 14.0) * 1850;
    const brake = input.isOverTarget ? 0.32 : 1.0;

    const vx = Math.sign(dx) * Math.pow(exX / 0.14, 1.85) * gainX * brake;
    const vy = Math.sign(dy) * Math.pow(exY / 0.12, 1.85) * gainY * brake;

    this.posX = Math.min(input.screenW - 8, Math.max(8, this.posX + vx * dt));
    this.posY = Math.min(input.screenH - 8, Math.max(8, this.posY + vy * dt));

    return {
      x: this.posX,
      y: this.posY,
      speedPxPerSec: Math.hypot(vx, vy),
    };
  }
}

export interface TwoStageLoupeState {
  stage: 'coarse' | 'fine-loupe';
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  loupeRadiusPx: number;
}

/**
 * Dual-Phase Coarse-to-Fine Gaze Loupe Positioning:
 * Stage 1 (Coarse): tracks broad saccades across the full screen. Once gaze stays inside a local
 * cluster (75px) for ~340ms, drops a Foveal Precision Loupe anchor and enters Stage 2.
 * Stage 2 (Fine-Loupe): amplifies micro eye shifts around the anchor so even dense keyboard keys
 * can be aimed with < 3px fine control. A large voluntary saccade (> 230px) immediately releases the loupe.
 */
export class TwoStageLoupeController {
  private stage: 'coarse' | 'fine-loupe' = 'coarse';
  private clusterX = 0;
  private clusterY = 0;
  private clusterStartMs: number | null = null;
  private anchorScreenX = 0;
  private anchorScreenY = 0;
  private anchorCoarseX = 0;
  private anchorCoarseY = 0;
  private readonly loupeRadiusPx = 148;

  public reset() {
    this.stage = 'coarse';
    this.clusterStartMs = null;
  }

  public update(
    coarseScreenX: number,
    coarseScreenY: number,
    nowMs: number,
    screenW: number,
    screenH: number,
    inSanctuaryZone: boolean = false
  ): TwoStageLoupeState {
    if (inSanctuaryZone) {
      this.reset();
      return {
        stage: 'coarse',
        x: coarseScreenX,
        y: coarseScreenY,
        anchorX: coarseScreenX,
        anchorY: coarseScreenY,
        loupeRadiusPx: this.loupeRadiusPx,
      };
    }

    if (this.stage === 'coarse') {
      if (this.clusterStartMs === null) {
        this.clusterX = coarseScreenX;
        this.clusterY = coarseScreenY;
        this.clusterStartMs = nowMs;
      } else {
        const dist = Math.hypot(coarseScreenX - this.clusterX, coarseScreenY - this.clusterY);
        if (dist > 72) {
          this.clusterX = coarseScreenX;
          this.clusterY = coarseScreenY;
          this.clusterStartMs = nowMs;
        } else {
          this.clusterX = this.clusterX * 0.85 + coarseScreenX * 0.15;
          this.clusterY = this.clusterY * 0.85 + coarseScreenY * 0.15;
          if (nowMs - this.clusterStartMs >= 340) {
            this.stage = 'fine-loupe';
            this.anchorScreenX = this.clusterX;
            this.anchorScreenY = this.clusterY;
            this.anchorCoarseX = this.clusterX;
            this.anchorCoarseY = this.clusterY;
            return {
              stage: 'fine-loupe',
              x: this.anchorScreenX,
              y: this.anchorScreenY,
              anchorX: this.anchorScreenX,
              anchorY: this.anchorScreenY,
              loupeRadiusPx: this.loupeRadiusPx,
            };
          }
        }
      }

      return {
        stage: 'coarse',
        x: coarseScreenX,
        y: coarseScreenY,
        anchorX: this.clusterX,
        anchorY: this.clusterY,
        loupeRadiusPx: this.loupeRadiusPx,
      };
    }

    // Fine-Loupe stage: inspect deviation from anchor
    const dx = coarseScreenX - this.anchorCoarseX;
    const dy = coarseScreenY - this.anchorCoarseY;
    const coarseDist = Math.hypot(dx, dy);

    // Voluntary saccade away from the local loupe region exits cleanly back to coarse mode
    if (coarseDist > 235) {
      this.stage = 'coarse';
      this.clusterX = coarseScreenX;
      this.clusterY = coarseScreenY;
      this.clusterStartMs = nowMs;
      return {
        stage: 'coarse',
        x: coarseScreenX,
        y: coarseScreenY,
        anchorX: coarseScreenX,
        anchorY: coarseScreenY,
        loupeRadiusPx: this.loupeRadiusPx,
      };
    }

    // Fine damped precision mapping around anchor (0.58x spatial compression = fine tremor attenuation, high local precision)
    // combined with gentle micro-reach up to loupeRadiusPx
    const fineScale = 0.72;
    const outX = Math.min(screenW - 5, Math.max(5, this.anchorScreenX + Math.max(-this.loupeRadiusPx, Math.min(this.loupeRadiusPx, dx * fineScale))));
    const outY = Math.min(screenH - 5, Math.max(5, this.anchorScreenY + Math.max(-this.loupeRadiusPx, Math.min(this.loupeRadiusPx, dy * fineScale))));

    return {
      stage: 'fine-loupe',
      x: outX,
      y: outY,
      anchorX: this.anchorScreenX,
      anchorY: this.anchorScreenY,
      loupeRadiusPx: this.loupeRadiusPx,
    };
  }
}
