---
name: gaze-math-benchmark-guard
description: >
  Verifies mathematical stability and sub-degree accuracy across all gaze-tracking and calibration
  algorithms (Canthal Constellation, Purkinje Glint Inpainting, Hering Binocular Filter, M-QPM, OrbitoGaze, and Bayesian Decoder).
---

# Skill: Guardián de Precisión Matemática y Benchmark Oculomotor

Vigila que ninguna modificación del código degrade la precisión espacial ($\text{RMSE} \le 8.5\text{ px}$, ángulo visual $\le 0.30^\circ$) ni la estabilidad temporal ($\text{jitter} \le 0.15\text{ px}$).

---

## 1. Invariantes Matemáticos Auditados
1. **Constelación Cantal Robusta y Fusión Límbica (`src/utils/headPose.ts`)**:
   - `computeRobustCanthalCluster` y `analyzeSubpixelEyeGeometry`.
2. **Inpainting Fotométrico de Reflejos de Purkinje y Ley de Hering (`src/utils/eyeSensorFusion.ts`)**:
   - `computePhotometricPupilCentroid` y `PupilTemporalStabilizer`.
3. **Modelo de Calibración M-QPM de 5 Regímenes y OrbitoGaze (`src/utils/calibration.ts`, `src/utils/smoothPursuitCalibration.ts`)**:
   - Regularización de Tikhonov, reponderación IRLS Huber y validación cruzada LOOCV.
4. **Decodificador Bayesiano Secuencial (`src/utils/bayesianTargetDecoder.ts`)**:
   - Modelo anisotrópico ($\sigma_Y = 1.28\,\sigma_X$) e histéresis de borde de $26\text{ px}$.
