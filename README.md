# SIGHT — Speech, Interaction and Gaze-based Human Technology

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-SPA-purple?logo=vite)](https://vitejs.dev/)
[![MediaPipe Vision](https://img.shields.io/badge/MediaPipe-FaceLandmarker-orange?logo=google)](https://developers.google.com/mediapipe)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-green)](https://github.com)

**SIGHT** (**Speech, Interaction and Gaze-based Human Technology**) is a clinical-grade, neuro-ophthalmically optimized assistive communication platform designed for patients with Amyotrophic Lateral Sclerosis (ALS), brainstem stroke, spinal cord injury, and severe motor impairments. 

Operated entirely within the browser with **100% client-side data privacy** (zero remote telemetry or cloud video streaming), SIGHT integrates advanced computer vision, multi-modal sensor fusion, Bayesian probabilistic inference, and adaptive voice cloning to provide robust, low-fatigue communication.

---

## 🌟 Key Architectural Innovations

### 1. Multi-Modal Eye Sensor Fusion
- **3D Eyeball Spherical Raycast (`solve3DEyeballVisualAxisRay`)**: Reconstructs the anatomical cranial triad in 3D from MediaPipe `facialTransformationMatrixes` and standard landmarks, placing the eyeball rotation center anatomically behind the palpebral plane ($r_{\text{eye}} \approx 0.44 \times \text{intercanthal width}$) to compute perspective ray-screen intersections invariant to head $Z$ distance.
- **Photometric Dark-Pupil Sub-Pixel ROI (`computePhotometricPupilCentroid`)**: Crops a micro-ROI (`36×22 px`) from the webcam feed onto an offscreen canvas, masking inside the palpebral ellipse and weighting squared luminance deficits $(\text{threshold} - L(x,y))^2$ with Gaussian spatial priors to eliminate discrete landmark jump jitter.
- **Directional Blendshape Rescue (`extractBlendshapeGaze`)**: Leverages ARKit-compatible eye blendshapes (`eyeLookUp/Down/In/OutLeft/Right`) to rescue vertical gaze tracking when upper eyelids partially occlude the iris.

### 2. Bayesian Gaze-to-Target Posterior Decoder (`BayesianTargetDecoder`)
- Replaces fragile single-pixel hit-testing with a temporal log-posterior probability distribution over all visible interactive elements (`[data-dwell-id]`).
- Accounts for physiological vertical eye-tracking uncertainty ($\sigma_Y > \sigma_X$) so minor eyelid variance never causes missed button hits.
- Features **hysteresis lock** ($0.48$ acquisition / $0.36$ retention), smooth posterior-weighted cursor attraction toward target centers, and **instant reset** on voluntary saccades ($\text{velocity} > 230\text{ px/s}$ or jump $> 95\text{ px}$).

### 3. OrbitoGaze Smooth-Pursuit Lag-Compensated Calibration (`calibrateFromSmoothPursuit`)
- Provides continuous 2-loop Lissajous and perimeter pursuit trajectories (`9.2 s`) covering all four screen quadrants and neutral center without forcing patients to stare statically at harsh grid points.
- Automatically computes physiological oculomotor lag $\tau^* \in [0, 260\text{ ms}]$ maximizing Pearson correlation, prunes catch-up saccade outliers via Median Absolute Deviation (MAD), and fits regularized polynomial / M-QPM calibration models.

### 4. Advanced Alternative Cursor Control Paradigms
- **Ocular Trackball (`OcularTrackballController`)**: A relative foveal velocity joystick cursor for patients with restricted eye excursion or steep camera angles. Looking slightly off the comfortable resting deadzone drives cursor velocity via a $C^1$ cubic curve with automatic target braking ($0.32\times$) over buttons.
- **Two-Stage Foveal Loupe (`TwoStageLoupeController`)**: Stage 1 tracks broad saccades in coarse mode; once stable inside a local cluster for $\ge 340\text{ ms}$, drops a precision anchor and enters Stage 2, compressing micro-eye tremors around the anchor for $< 3\text{ px}$ fine targeting on dense virtual keyboards.

### 5. Acoustic Voice Imitation & Speech Synthesis Engine
- **Vocal Timbre Analyzer**: Extracts fundamental frequency ($F_0$), vowel formants ($F_1, F_2, F_3$), and spectral tilt from short microphone recordings or uploaded audio files.
- **Multi-Engine Speech**: Supports LPC-16 all-pole vocoder synthesis, formant acoustic resonators, web speech synthesis, and neural AI voice presets.

---

## 👁️ Ophthalmic Low-Fatigue Design
- **Scotopic & Warm Spectra**: Three distinct optical color palettes designed to minimize retinal phototoxicity and eye strain during extended daily use:
  - *Warm Mineral Slate* (low blue-light contrast)
  - *Warm E-Ink Parchment* (daylight glare-free reading)
  - *Scotopic 590nm Amber* (night-time and photophobia relief)
- **Ocular Rest Sanctuary (`Rest Eyes`)**: Instant sleep curtain mode that dims the screen and pauses accidental dwell triggers.

---

## 🛠️ Tech Stack & Requirements
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, Motion.
- **Computer Vision**: `@mediapipe/tasks-vision` (`FaceLandmarker` with GPU acceleration & CPU fallback).
- **Testing & Quality Assurance**: Vitest (53 comprehensive unit tests), TypeScript strict checks, and static code linters.

---

## 🚀 Quick Start & Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/sight-assistive-tech.git
   cd sight-assistive-tech
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run local development server**:
   ```bash
   npm run dev
   ```

4. **Run verification test pipeline**:
   ```bash
   npm run pipeline
   ```

---

## 📜 Scientific Paper & Academic Citation

SIGHT includes an integrated academic research paper generator in LaTeX and PDF format detailing the mathematical models, clinical trials, and bioengineering principles.

**Author**: Alberto Arce Rodríguez  
**Citation (APA 7th)**:
> Arce Rodríguez, A. (2026). *SIGHT: Speech, Interaction and Gaze-based Human Technology — Multi-Modal Ocular Sensor Fusion and Bayesian Posterior Decoding for ALS Assistive Communication*. Clinical Ocular Engineering & Bio-Mechatronics Lab.

---

## 📄 License
Distributed under the **Apache 2.0 License**. See [LICENSE](LICENSE) for more information.
