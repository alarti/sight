/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CalibrationSample {
  targetX: number;
  targetY: number;
  rawPupilX: number;
  rawPupilY: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
}

export interface FormantFrequencies {
  f1: number; // First vowel formant (jaw/throat resonance, 300-900 Hz)
  f2: number; // Second vowel formant (tongue shape resonance, 900-2600 Hz)
  f3: number; // Third vowel formant (vocal tract length individuality, 2400-3600 Hz)
}

export type SynthesisEngineMode = 'neural-ai' | 'hybrid' | 'ml-lpc' | 'formant-acoustic' | 'system-tts';

export interface BankedPhraseAudio {
  id: string;
  phrase: string;
  audioUrl: string;
  recordedAt: number;
}

export interface VoiceProfile {
  enabled: boolean;
  synthesisEngine?: SynthesisEngineMode; // 'neural-ai' (ChatGPT-style) | 'hybrid' (smart bank + neural) | 'ml-lpc' (ML LPC-16 + NLP G2P) | 'formant-acoustic' | 'system-tts'
  recordedAudioUrl?: string; // Base64 data URL for local browser playback
  audioSourceType?: 'mic' | 'upload'; // Live mic recording or user uploaded audio file
  audioFileName?: string;
  fundamentalFreqHz?: number; // Detected F0 in Hz (e.g. 135 Hz)
  formants?: FormantFrequencies; // Formant frequencies F1, F2, F3
  spectralCentroidHz?: number; // Timbre brightness measure
  glottalHarmonics?: number[]; // Extracted harmonic overtone series for periodic wavetable synthesis
  brightnessEQ?: number; // High-frequency presence boost (-6 dB to +6 dB)
  pitchMultiplier: number; // SpeechSynthesis pitch (0.2 to 2.0)
  speechRate: number; // SpeechSynthesis rate (0.5 to 1.8)
  volume: number; // SpeechSynthesis volume (0.0 to 1.0)
  voiceUri?: string; // Selected browser speech synthesis voice URI
  detectedTimbre?: string; // Description e.g. 'Grave' | 'Medio' | 'Agudo' | 'Deep' | 'Medium' | 'High'
  bankedPhrases?: BankedPhraseAudio[]; // Banked real recordings of user phrases
  // Neural AI Voice (ChatGPT-style) parameters:
  neuralVoiceName?: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  neuralStylePrompt?: string;
  // Local NLP & ML Vocoder parameters:
  lpcCoefficients?: number[]; // Autoregressive LPC-16 all-pole filter coefficients
  vtlnWarpFactor?: number; // Vocal Tract Length Normalization factor alpha (0.80 - 1.25)
  spectralTiltDb?: number; // Spectral roll-off in dB/octave
  jitterPercent?: number; // Micro-pitch variation for humanized organic timbre
  shimmerPercent?: number; // Micro-amplitude variation
  nlpProsodyEnabled?: boolean; // Syllabic lexical stress + Fujisaki intonation contour
  recordedAt?: number;
}

export type CalibrationAlgorithm = 'quadrant-matrix' | 'tps' | 'polynomial' | 'projective';

export interface QuadrantMatrixSnapshot {
  regime: '1pt' | '2pt' | '3pt-affine' | '4pt-homography' | 'hybrid-tps';
  meanX: number;
  meanY: number;
  scaleX: number;
  scaleY: number;
  targetMeanX: number;
  targetMeanY: number;
  targetScaleX: number;
  targetScaleY: number;
  homographyNorm: number[][];
  affineNormX: [number, number, number];
  affineNormY: [number, number, number];
  useHomographyBase: boolean;
  controlPointsUV: Array<{ u: number; v: number }>;
  residualWeightsX: number[];
  residualWeightsY: number[];
  residualAffineX: [number, number, number];
  residualAffineY: [number, number, number];
  yawFactorX: number;
  pitchFactorY: number;
  hullMinU: number;
  hullMaxU: number;
  hullMinV: number;
  hullMaxV: number;
  rmsePx?: number;
}

export interface CalibrationMatrixSnapshot {
  modelType?: CalibrationAlgorithm;
  a: number[];
  b: number[];
  quadrantMatrix?: QuadrantMatrixSnapshot;
  tps?: {
    controlPoints: Array<{ x: number; y: number; yaw: number; pitch: number }>;
    weightsX: number[];
    weightsY: number[];
    affineX: [number, number, number];
    affineY: [number, number, number];
    yawFactorX: number;
    pitchFactorY: number;
    scaleX?: number;
    scaleY?: number;
    rmsePx?: number;
  };
  projective?: {
    H: number[][];
    h?: number[];
    radialK: number;
    yawFactorX: number;
    pitchFactorY: number;
    rmsePx?: number;
  };
  rbf?: {
    supportVectors: Array<{ x: number; y: number; yaw: number; pitch: number }>;
    dualWeightsX: number[];
    dualWeightsY: number[];
    linearX: [number, number, number, number, number];
    linearY: [number, number, number, number, number];
    gamma: number;
    scaleX?: number;
    scaleY?: number;
    rmsePx?: number;
  };
  rmsePx?: number;
  cvRmsePx?: number;
  reliabilityScore?: number;
  accuracyDeg?: number;
}

export type OcularTheme = 'warm-obsidian' | 'eink-parchment' | 'scotopic-amber';

export type CursorControlMode = 'bayesian-lock' | 'ocular-trackball' | 'two-stage-loupe' | 'direct-matrix';

export interface UserProfile {
  id: string;
  name: string;
  language?: 'es' | 'en';
  ocularTheme?: OcularTheme;
  createdAt: number;
  updatedAt: number;
  samples: CalibrationSample[];
  calibrationModel?: CalibrationAlgorithm; // M-QPM, TPS, Polynomial Ridge, or Projective
  cursorControlMode?: CursorControlMode; // Bayesian Target Lock, Ocular Trackball, Two-Stage Loupe, or Direct Matrix
  sensorFusionEnabled?: boolean; // 3D Eyeball Raycast + Photometric Dark-Pupil ROI + Directional Blendshapes
  ivtStabilizationEnabled?: boolean; // I-VT Saccade-Fixation Anti-Jitter Filter
  verticalGainMultiplier?: number; // Asymmetric vertical eye amplitude adjustment (default ~1.15x)
  sensitivityX: number;
  sensitivityY: number;
  smoothing: number;
  baselineOffsetX: number;
  baselineOffsetY: number;
  invertY?: boolean;
  neutralCenter?: { x: number; y: number };
  calibrationMatrix?: CalibrationMatrixSnapshot;
  voiceProfile?: VoiceProfile;
}

export interface HeadPoseData {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  normYaw: number;
  normPitch: number;
}

export interface EyeTrackingData {
  gazeScreenX: number;
  gazeScreenY: number;
  rawGazeX: number;
  rawGazeY: number;
  headPose: HeadPoseData;
  faceDetected: boolean;
  eyesDetected: boolean;
  pupilLeft: { x: number; y: number } | null;
  pupilRight: { x: number; y: number } | null;
  faceBox: { x: number; y: number; width: number; height: number } | null;
  leftEyeBox: { x: number; y: number; width: number; height: number } | null;
  rightEyeBox: { x: number; y: number; width: number; height: number } | null;
  isFixating: boolean;
  eyeVelocity: number;
  isSquinting: boolean;
  squintScore: number;
  isBlinking?: boolean;
  signalQuality?: number;
  sensorMetrics?: {
    ray3DX: number;
    ray3DY: number;
    blendshapeY: number;
    photometricActive: boolean;
    fusionActive: boolean;
  };
  posture?: {
    isPostureOptimal: boolean;
    distanceStatus: string;
    distanceMessage?: string;
    tiltStatus: string;
    tiltAngleDeg: number;
    tiltMessage?: string;
    faceRatio?: number;
  };
}

export interface PresetItem {
  id: string;
  label: string;
  category: string;
  icon: string;
  speech: string;
}
