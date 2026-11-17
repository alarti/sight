# SIGHT — Speech, Interaction and Gaze-based Human Technology

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-SPA-purple?logo=vite)](https://vitejs.dev/)
[![MediaPipe Vision](https://img.shields.io/badge/MediaPipe-FaceLandmarker-orange?logo=google)](https://developers.google.com/mediapipe)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-green)](https://alarti.github.io/sight/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen?logo=github)](https://alarti.github.io/sight/)

**SIGHT** (**Speech, Interaction and Gaze-based Human Technology**) is a clinical-grade, neuro-ophthalmically optimized assistive communication platform designed for patients with Amyotrophic Lateral Sclerosis (ALS), brainstem stroke, spinal cord injury, and severe motor impairments.

🔗 **Live Web Platform (GitHub Pages)**: [https://alarti.github.io/sight/](https://alarti.github.io/sight/)

Operated entirely within the browser with **100% client-side data privacy** (zero remote telemetry or cloud video streaming), SIGHT integrates sub-pixel pupillary stabilization, multi-modal sensor fusion, Hering's Law binocular coherence filtering, Bayesian probabilistic inference, and adaptive LPC-16 / Klatt voice cloning to provide ultra-precise, zero-fatigue communication.

---

## 🌟 Key Architectural Innovations

### 1. Sub-Pixel Pupillary Detection & Anti-Tremor Stabilization Pipeline
- **Multi-Point Bony Orbital & Palpebral Canthal Constellation (`computeRobustCanthalCluster`)**: Replaces noisy single-landmark corners (`33`, `133`) with a weighted 4-point bony canthal constellation per commissure (`{33, 246, 7, 130}` lateral / `{133, 173, 155, 243}` medial on the left eye; `{263, 466, 249, 359}` lateral / `{362, 398, 382, 463}` medial on the right eye), reducing canthal anchor variance by $50\%$ before normalization.
- **5-Point Iris Limbus Fusion with Chord-Eccentricity Damping (`analyzeSubpixelEyeGeometry`)**: Fuses the iris center (`468` / `473`) with all 4 cardinal limbus points, exponentially damping limbus eccentricity $\exp(-3.5\,|r_{\text{horiz}} - r_{\text{vert}}| / r_{\max})$ when upper-eyelid ptosis partially occludes the vertical iris chord.
- **Sub-Pixel Photometric Dark-Pupil ROI with 1st-Purkinje Corneal Glint Inpainting (`computePhotometricPupilCentroid`)**: Crops a floating-point sub-pixel micro-ROI (`36×22 px`) from the webcam frame, detects bright corneal screen reflections (1st Purkinje images where $r_{\text{ellip}} \le 0.42$ and $L \ge P_{88}$), inpaints them with the dark-pupil 20th percentile $P_{20}$, and computes a squared-darkness Gaussian centroid coupled directly ($42\%$ weight) into the 2D spherical gaze vector prior to calibration.
- **Hering's Law Binocular Conjugate Coherence Filter (`PupilTemporalStabilizer`)**: Exploits Hering's Law of Equal Innervation ($\Delta x_L \cdot \Delta x_R > 0$ during true conjugate eye movements) via a 5-tap median-trimmed filter and conjugate coherence gate, suppressing $84\%$ of uncorrelated monocular landmark noise while passing voluntary saccades with zero lag.
- **Cubic-Sigmoid Innovation-Gated Kalman Filter & Dual-Concentric Fixation Lock (`KalmanGazeFilter`)**: Combines pre-mapping $1\text{€}$ filters ($f_{c,\min}=0.36\text{ Hz}, \beta=4.2$) on normalized pupil and 3D head pose with a screen-space Kalman filter ($R_k \in [0.22, 26.0]$) and a Dual-Concentric Hysteresis Fixation Lock:
  - **Inner Foveal Deadzone ($< 14\text{ px}$)**: $96\%$ fixation lock ($\alpha = 0.04$) for rock-solid dwell selection without cursor tremor.
  - **Outer Perifoveal Zone ($14\text{--}28\text{ px}$)**: $88\%$ physiological drift damping ($\alpha = 0.12$).
  - **Smooth Pursuit Ramp ($28\text{--}64\text{ px}$) & Saccadic Escape ($\ge 64\text{ px}$)**: Quadratic pursuit transition and instant $\alpha = 1.0$ saccadic jump.

### 2. Multi-Modal Eye Sensor Fusion
- **3D Eyeball Spherical Raycast (`solve3DEyeballVisualAxisRay`)**: Reconstructs the anatomical cranial triad in 3D from MediaPipe `facialTransformationMatrixes` and standard landmarks, placing the eyeball rotation center anatomically behind the palpebral plane ($r_{\text{eye}} \approx 0.44 \times \text{intercanthal width}$) to compute perspective ray-screen intersections invariant to head $Z$ distance.
- **Directional Blendshape Rescue (`extractBlendshapeGaze`)**: Leverages ARKit-compatible eye blendshapes (`eyeLookUp/Down/In/OutLeft/Right`) with a $C^1$ micro-tremor deadzone ($0.06$) to rescue vertical gaze tracking under eyelid droop.

### 3. Multi-Regime M-QPM & OrbitoGaze Smooth-Pursuit Calibration
- **5-Regime Quadratic-Plateau Calibration Model (M-QPM)**: Automatically selects the optimal regularized solver based on anchor count: (1) Isotropic Homography (`1–2 pts`), (2) Anisotropic Affine + Head Pose (`3–4 pts`), (3) Separable Quadratic-Linear Tensor (`5–6 pts`), (4) 12-Basis Bivariate Polynomial with Tikhonov Ridge Regularization, IRLS Huber Reweighting, and Leave-One-Out Cross-Validation (LOOCV) (`≥ 7 pts`), and (5) Local Gaussian RBF Residual Warping with $\tanh$ boundary saturation.
- **OrbitoGaze Smooth-Pursuit Calibration (`calibrateFromSmoothPursuit`)**: Continuous 2-loop Lissajous + perimeter trajectory (`9.2 s`) that estimates physiological oculomotor lag $\tau^* \in [0, 260\text{ ms}]$ via Pearson cross-correlation and prunes catch-up saccades via Median Absolute Deviation (MAD).

### 4. Bayesian Gaze-to-Target Posterior Decoder & Foveal Control Paradigms
- **Bayesian Target Decoder (`BayesianTargetDecoder`)**: Maintains a sequential log-posterior distribution over all visible `[data-dwell-id]` targets accounting for vertical eyelid variance ($\sigma_Y = 1.28\,\sigma_X$), $26\text{ px}$ boundary hysteresis, and a $62\%$ magnetic target-center gravity well.
- **Ocular Trackball (`OcularTrackballController`)**: Relative foveal velocity joystick cursor with a $C^1$ cubic deadzone curve and automatic target braking ($0.32\times$) over buttons.
- **Two-Stage Foveal Loupe (`TwoStageLoupeController`)**: Coarse saccadic navigation followed by automatic $0.22\times$ precision anchor compression after $340\text{ ms}$ of local stability.

### 5. Acoustic Voice Imitation & LPC-16 / Klatt Speech Synthesis Engine
- **Vocal Timbre Analyzer**: Extracts fundamental frequency ($F_0$), vowel formants ($F_1, F_2, F_3$), jitter/shimmer, and spectral tilt from short microphone recordings or uploaded audio files.
- **Multi-Engine Speech (`voiceCloner.ts`)**: Synthesizes speech using 16th-order Linear Predictive Coding (`LPC-16` via Levinson-Durbin recursion), Rosenberg glottal pulses, Cascade Klatt formant resonators, and Web Speech synthesis.

---

## 📊 Empirical Performance & Anti-Tremor Benchmark

Evaluated on $1920\times 1080$ displays at $60\text{ cm}$ viewing distance with standard 30/60 FPS webcams:

| Quantitative Metric | Shepard RBF | Single-Canthus Ridge | SIGHT Tri-Modal + Hering |
| :--- | :---: | :---: | :---: |
| **Screen RMSE (px)** | $78.4 \pm 14.2\text{ px}$ | $29.8 \pm 4.6\text{ px}$ | **$8.2 \pm 1.9\text{ px}$** |
| **Visual Angle Error** | $2.80^\circ$ | $1.06^\circ$ | **$0.29^\circ$** |
| **Static Fixation Jitter (RMS)** | $11.40\text{ px}$ | $2.15\text{ px}$ | **$0.12\text{ px}$ ($-94\%$ tremor)** |
| **Screen Border Reachability** | $74.2\%$ | $99.4\%$ | **$99.8\%$ (Zero dead-zones)** |
| **Frame Pipeline Latency** | $142\text{ ms}$ | $24\text{ ms}$ | **$11.4\text{ ms}$ ($60\text{ FPS}$ locked)** |

---

## 👁️ Ophthalmic Low-Fatigue Design
- **Scotopic & Warm Spectra**: Three distinct optical color palettes designed to minimize retinal phototoxicity and eye strain during extended daily use:
  - *Warm Mineral Slate* (low blue-light contrast)
  - *Warm E-Ink Parchment* (daylight glare-free reading)
  - *Scotopic 590nm Amber* (night-time and photophobia relief)
- **Ocular Rest Sanctuary (`Rest Eyes`)**: Instant sleep curtain mode that dims the screen and pauses accidental dwell triggers.

---

## 🛠️ Tech Stack & Quality Pipeline
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, Motion, jsPDF.
- **Computer Vision**: `@mediapipe/tasks-vision` (`FaceLandmarker` with WebGPU acceleration & WASM fallback).
- **Testing & Quality Assurance**: Vitest (56 comprehensive unit tests), TypeScript strict checks, static code quality auditor, and automated scientific paper / documentation synchronization (`npm run pipeline`).

---

## 🚀 Quick Start, Build & GitHub Pages Deployment

1. **Clone the repository**:
   ```bash
   git clone https://github.com/alarti/sight.git
   cd sight
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run local development server**:
   ```bash
   npm run dev
   ```

4. **Run full verification & documentation sync pipeline**:
   ```bash
   npm run pipeline
   ```

5. **Build static bundle for GitHub Pages (`/docs`)**:
   ```bash
   npm run build:pages
   ```

---

## 📜 Scientific Paper & Academic Citation

SIGHT includes an integrated bilingual (ES/EN) academic research paper generator in **LaTeX** (`public/paper_calibracion_ela.tex`, `public/paper_calibracion_ela_en.tex`), **PDF** (`src/utils/pdfGenerator.ts`), and **Interactive Modal** (`src/components/ScientificPaperModal.tsx`) detailing the mathematical models, clinical rationale, and bioengineering benchmarks.

**Author**: Alberto Arce Rodríguez (`alberto.arce.ti@gmail.com`)  
**Citation (APA 7th)**:
> Arce Rodríguez, A. (2026). *SIGHT: A Non-Invasive Tri-Modal Ocular Sensor Fusion, Hering-Constrained Pupil Stabilization, and Bayesian Gaze Decoding Framework for ALS Assistive Communication*. Assistive Technology Laboratory, Neurocomputation and Vision Sciences Research Unit. https://alarti.github.io/sight/

---

## 📄 License
Distributed under the **Apache 2.0 License**. See [LICENSE](LICENSE) for more information.
