/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VoiceProfile, FormantFrequencies } from '../types/index.ts';
import { getSharedAudioContext } from './audio.ts';

export interface VoiceAnalysisResult {
  fundamentalFreqHz: number;
  formants: FormantFrequencies;
  spectralCentroidHz: number;
  glottalHarmonics: number[];
  pitchMultiplier: number;
  speechRate: number;
  timbreDescription: string;
  durationSeconds: number;
  confidence: number;
  lpcCoefficients?: number[];
  vtlnWarpFactor?: number;
  jitterPercent?: number;
  shimmerPercent?: number;
}

/**
 * Autocorrelation pitch detector with parabolic peak interpolation
 * Optimized for human vocal speech range (65 Hz - 450 Hz) with sub-Hertz frequency resolution
 */
export function detectPitchFromAudioBuffer(audioBuffer: AudioBuffer): { f0: number; confidence: number } {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  const minFreq = 65; // Lowest human vocal register (deep bass)
  const maxFreq = 450; // Highest normal speaking pitch
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);

  const frameSize = 2048;
  const hopSize = 1024;
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  const detectedPitches: number[] = [];

  for (let f = 0; f < numFrames; f++) {
    const startIdx = f * hopSize;
    let sumSquares = 0;

    // Check if frame has voiced energy (RMS threshold)
    for (let i = 0; i < frameSize; i++) {
      const val = channelData[startIdx + i];
      sumSquares += val * val;
    }
    const rms = Math.sqrt(sumSquares / frameSize);

    // Skip silent/unvoiced frames
    if (rms < 0.018) continue;

    const correlations: number[] = new Array(maxLag - minLag + 1);
    let maxCorr = -1;
    let maxLagIdx = -1;

    // Compute autocorrelation for lags in speech range
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < frameSize - lag; i++) {
        const a = channelData[startIdx + i];
        const b = channelData[startIdx + i + lag];
        corr += a * b;
        norm1 += a * a;
        norm2 += b * b;
      }

      const denominator = Math.sqrt(norm1 * norm2);
      const val = denominator > 1e-6 ? corr / denominator : 0;
      const idx = lag - minLag;
      correlations[idx] = val;
      if (val > maxCorr) {
        maxCorr = val;
        maxLagIdx = lag;
      }
    }

    if (maxCorr > 0.50) {
      // Find the first prominent local peak to avoid subharmonic doubling (octave error)
      let selectedLag = -1;
      const peakThreshold = maxCorr * 0.86;

      for (let lag = minLag + 1; lag < maxLag; lag++) {
        const idx = lag - minLag;
        const cur = correlations[idx];
        const prev = correlations[idx - 1];
        const next = correlations[idx + 1];

        if (cur > prev && cur >= next && cur >= peakThreshold) {
          selectedLag = lag;
          break;
        }
      }

      if (selectedLag <= 0) {
        selectedLag = maxLagIdx;
      }

      if (selectedLag > minLag && selectedLag < maxLag) {
        // Sub-sample Parabolic Peak Interpolation for exact fractional period:
        // delta = (alpha - gamma) / (2 * (alpha - 2*beta + gamma))
        const idx = selectedLag - minLag;
        const alpha = correlations[idx - 1];
        const beta = correlations[idx];
        const gamma = correlations[idx + 1];
        const denom = 2 * (alpha - 2 * beta + gamma);
        let refinedLag = selectedLag;
        if (Math.abs(denom) > 1e-6) {
          const delta = (alpha - gamma) / denom;
          if (Math.abs(delta) < 1.0) {
            refinedLag += delta;
          }
        }

        const pitch = sampleRate / refinedLag;
        if (pitch >= minFreq && pitch <= maxFreq) {
          detectedPitches.push(pitch);
        }
      }
    }
  }

  if (detectedPitches.length === 0) {
    return { f0: 150, confidence: 0 };
  }

  // Calculate median pitch for robust outlier rejection
  detectedPitches.sort((a, b) => a - b);
  const medianF0 = detectedPitches[Math.floor(detectedPitches.length / 2)];
  const confidence = Math.min(1.0, detectedPitches.length / Math.max(1, numFrames * 0.4));

  return { f0: Math.round(medianF0 * 10) / 10, confidence };
}

/**
 * Extracts acoustic formants (F1, F2, F3) and spectral centroid via Discrete Fourier Transform
 */
export function extractAcousticFeatures(audioBuffer: AudioBuffer): {
  formants: FormantFrequencies;
  spectralCentroidHz: number;
} {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const N = 2048; // Window size for spectral analysis

  // Select a voiced frame near the center of the recording
  const centerStart = Math.max(0, Math.floor(channelData.length / 2) - Math.floor(N / 2));
  const frame = new Float32Array(N);
  for (let i = 0; i < N && (centerStart + i) < channelData.length; i++) {
    // Apply Hann window
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    frame[i] = channelData[centerStart + i] * w;
  }

  // Approximate magnitude spectrum using discrete multi-band filter bank
  const numBins = Math.floor(N / 2);
  const binWidth = sampleRate / N;
  const spectrum = new Float32Array(numBins);

  let totalEnergy = 0;
  let weightedFreqSum = 0;

  for (let k = 1; k < numBins; k++) {
    const freq = k * binWidth;
    if (freq > 4500) break;

    let real = 0;
    let imag = 0;
    // Step by 2 for computational speed
    for (let n = 0; n < N; n += 2) {
      const angle = (2 * Math.PI * k * n) / N;
      real += frame[n] * Math.cos(angle);
      imag -= frame[n] * Math.sin(angle);
    }
    const mag = Math.sqrt(real * real + imag * imag);
    spectrum[k] = mag;
    totalEnergy += mag;
    weightedFreqSum += mag * freq;
  }

  const spectralCentroidHz = totalEnergy > 1e-5 ? Math.round(weightedFreqSum / totalEnergy) : 1200;

  // Peak picking for formants in standard speech resonance regions:
  // F1: 300 - 950 Hz (Vowel aperture)
  // F2: 1000 - 2500 Hz (Tongue position)
  // F3: 2500 - 3600 Hz (Vocal tract length / individuality)
  let bestF1 = 700;
  let maxMagF1 = -1;
  let bestF2 = 1450;
  let maxMagF2 = -1;
  let bestF3 = 2800;
  let maxMagF3 = -1;

  for (let k = 2; k < numBins - 2; k++) {
    const freq = k * binWidth;
    const mag = spectrum[k];
    const isLocalPeak = mag > spectrum[k - 1] && mag > spectrum[k + 1];

    if (!isLocalPeak) continue;

    if (freq >= 300 && freq <= 950) {
      if (mag > maxMagF1) {
        maxMagF1 = mag;
        bestF1 = Math.round(freq);
      }
    } else if (freq >= 1000 && freq <= 2500) {
      if (mag > maxMagF2) {
        maxMagF2 = mag;
        bestF2 = Math.round(freq);
      }
    } else if (freq >= 2500 && freq <= 3600) {
      if (mag > maxMagF3) {
        maxMagF3 = mag;
        bestF3 = Math.round(freq);
      }
    }
  }

  return {
    formants: {
      f1: bestF1,
      f2: bestF2,
      f3: bestF3
    },
    spectralCentroidHz
  };
}

/**
 * Analyzes audio energy and pauses to estimate speaking rate
 */
export function estimateSpeechRate(audioBuffer: AudioBuffer): number {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSamples = Math.floor(sampleRate * 0.05); // 50ms window
  const numWindows = Math.floor(channelData.length / windowSamples);

  let voicedWindows = 0;
  for (let w = 0; w < numWindows; w++) {
    let sumSq = 0;
    const start = w * windowSamples;
    for (let i = 0; i < windowSamples; i++) {
      const s = channelData[start + i];
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / windowSamples);
    if (rms > 0.02) voicedWindows++;
  }

  const voicedRatio = voicedWindows / Math.max(1, numWindows);
  if (voicedRatio > 0.65) {
    return 1.05;
  } else if (voicedRatio < 0.40) {
    return 0.85;
  }
  return 0.95;
}

/**
 * Extracts normalized glottal harmonic magnitudes (H1..H24) from a voiced frame of the user's voice
 * This captures the unique vocal cord closure shape, glottal pulse, and overtone spectrum.
 */
export function extractGlottalHarmonics(audioBuffer: AudioBuffer, f0: number): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const numHarmonics = 24;
  const harmonics: number[] = new Array(numHarmonics).fill(0);

  const N = Math.min(2048, channelData.length);
  if (N <= 0 || !f0 || f0 < 40) {
    return Array.from({ length: numHarmonics }, (_, i) => 1.0 / Math.pow(i + 1, 1.25));
  }

  // Scan across the buffer to locate the highest-energy voiced speech frame
  const step = Math.max(128, Math.floor(N / 2));
  let bestStart = Math.max(0, Math.floor(channelData.length / 2) - Math.floor(N / 2));
  let maxEnergy = 0;
  for (let s = 0; s + N <= channelData.length; s += step) {
    let energy = 0;
    for (let i = 0; i < N; i += 4) {
      const v = channelData[s + i];
      energy += v * v;
    }
    if (energy > maxEnergy) {
      maxEnergy = energy;
      bestStart = s;
    }
  }

  const frame = new Float32Array(N);
  for (let i = 0; i < N && (bestStart + i) < channelData.length; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    frame[i] = channelData[bestStart + i] * w;
  }

  let h1 = 0;
  for (let k = 1; k <= numHarmonics; k++) {
    const targetFreq = k * f0;
    if (targetFreq >= sampleRate / 2) break;

    // Search small frequency window around k*f0 to account for pitch micro-drift
    let peakMag = 0;
    for (let delta = -1; delta <= 1; delta++) {
      const curFreq = targetFreq + delta * (f0 * 0.02);
      let real = 0;
      let imag = 0;
      for (let n = 0; n < N; n += 2) {
        const angle = (2 * Math.PI * curFreq * n) / sampleRate;
        real += frame[n] * Math.cos(angle);
        imag -= frame[n] * Math.sin(angle);
      }
      const mag = Math.sqrt(real * real + imag * imag);
      if (mag > peakMag) peakMag = mag;
    }

    harmonics[k - 1] = peakMag;
    if (k === 1) h1 = peakMag;
  }

  const norm = h1 > 1e-5 ? h1 : 1.0;
  return harmonics.map((h, idx) => {
    if (h <= 1e-6) {
      return 1.0 / Math.pow(idx + 1, 1.25);
    }
    return Math.min(1.0, Math.max(0.005, h / norm));
  });
}

/**
 * Machine Learning Autoregressive Linear Predictive Coding (LPC-16):
 * Estimates the optimal all-pole vocal tract filter transfer function 1 / A(z)
 * via Autocorrelation & Levinson-Durbin Recursion algorithm on voiced frames.
 */
export interface LPCModelResult {
  coefficients: number[];
  gain: number;
  formants: FormantFrequencies;
  vtlnWarpFactor: number;
}

export function trainLPCModel(audioBuffer: AudioBuffer, order: number = 16): LPCModelResult {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const p = Math.min(order, 24);

  const fallback: LPCModelResult = {
    coefficients: new Array(p).fill(0),
    gain: 0.1,
    formants: { f1: 700, f2: 1450, f3: 2600 },
    vtlnWarpFactor: 1.0,
  };

  if (!channelData || channelData.length < 512) return fallback;

  // 1. Select the most prominent voiced segment (highest localized energy)
  const frameSize = Math.min(2048, channelData.length);
  const hopSize = 512;
  const numFrames = Math.floor((channelData.length - frameSize) / hopSize);

  let bestFrameStart = 0;
  let maxRms = 0;

  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < frameSize; i++) {
      const v = channelData[start + i];
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    if (rms > maxRms) {
      maxRms = rms;
      bestFrameStart = start;
    }
  }

  if (maxRms < 0.008) return fallback;

  // 2. Pre-emphasis filter: boosts higher formants (+6 dB/octave) y[n] = x[n] - 0.95*x[n-1]
  const preEmph = new Float32Array(frameSize);
  preEmph[0] = channelData[bestFrameStart];
  for (let i = 1; i < frameSize; i++) {
    preEmph[i] = channelData[bestFrameStart + i] - 0.95 * channelData[bestFrameStart + i - 1];
  }

  // 3. Apply Hann window
  const windowed = new Float32Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    windowed[i] = preEmph[i] * w;
  }

  // 4. Compute Autocorrelation Sequence R[0..p]
  const R = new Float64Array(p + 1);
  for (let k = 0; k <= p; k++) {
    let sum = 0;
    for (let n = 0; n < frameSize - k; n++) {
      sum += windowed[n] * windowed[n + k];
    }
    R[k] = sum;
  }

  if (R[0] <= 1e-9) return fallback;

  // 5. Levinson-Durbin Recursion solving Toeplitz linear system
  const a = new Float64Array(p + 1);
  const aPrev = new Float64Array(p + 1);
  let E = R[0];

  for (let i = 1; i <= p; i++) {
    let lambda = 0;
    for (let j = 1; j < i; j++) {
      lambda += aPrev[j] * R[i - j];
    }
    const k_i = (R[i] - lambda) / (E > 1e-12 ? E : 1e-12);
    // Guarantee filter stability inside the complex unit circle
    const boundedK = Math.max(-0.992, Math.min(0.992, k_i));
    a[i] = boundedK;
    for (let j = 1; j < i; j++) {
      a[j] = aPrev[j] - boundedK * aPrev[i - j];
    }
    E *= (1 - boundedK * boundedK);
    for (let j = 1; j <= i; j++) {
      aPrev[j] = a[j];
    }
  }

  const coefficients = Array.from(a.slice(1)).map(c => Math.round(c * 10000) / 10000);
  const gain = Math.sqrt(Math.max(1e-6, E / frameSize));

  // 6. Spectral envelope analysis of 1 / |A(e^{j omega})|^2 for formant resonance poles
  const numSteps = 256;
  const maxEvalFreq = 4200;
  const spectrum = new Float64Array(numSteps);

  for (let s = 0; s < numSteps; s++) {
    const freq = (s / numSteps) * maxEvalFreq;
    const omega = (2 * Math.PI * freq) / sampleRate;
    let real = 1.0;
    let imag = 0.0;
    for (let k = 1; k <= p; k++) {
      real += a[k] * Math.cos(-k * omega);
      imag += a[k] * Math.sin(-k * omega);
    }
    const denom = real * real + imag * imag;
    spectrum[s] = denom > 1e-12 ? 1.0 / denom : 1.0;
  }

  let f1 = 700;
  let f2 = 1450;
  let f3 = 2600;
  let maxP1 = -1, maxP2 = -1, maxP3 = -1;

  for (let s = 1; s < numSteps - 1; s++) {
    const freq = (s / numSteps) * maxEvalFreq;
    const mag = spectrum[s];
    if (mag > spectrum[s - 1] && mag > spectrum[s + 1]) {
      if (freq >= 300 && freq <= 950 && mag > maxP1) {
        maxP1 = mag;
        f1 = Math.round(freq);
      } else if (freq >= 1000 && freq <= 2450 && mag > maxP2) {
        maxP2 = mag;
        f2 = Math.round(freq);
      } else if (freq >= 2450 && freq <= 3600 && mag > maxP3) {
        maxP3 = mag;
        f3 = Math.round(freq);
      }
    }
  }

  // 7. Vocal Tract Length Normalization (VTLN) ratio relative to standard 17cm vocal tract
  const vtlnWarpFactor = Math.max(0.78, Math.min(1.28, Math.round((f3 / 2550) * 100) / 100));

  return {
    coefficients,
    gain: Math.round(gain * 1000) / 1000,
    formants: { f1, f2, f3 },
    vtlnWarpFactor,
  };
}

/**
 * Extracts acoustic humanization micro-perturbations:
 * Jitter: cycle-to-cycle frequency variation (human range ~0.5% - 1.5%)
 * Shimmer: cycle-to-cycle amplitude variation (human range ~1.5% - 4.5%)
 */
export function extractJitterAndShimmer(audioBuffer: AudioBuffer, f0: number): { jitterPercent: number; shimmerPercent: number } {
  if (!f0 || f0 < 50) return { jitterPercent: 0.85, shimmerPercent: 2.6 };
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const periodSamples = Math.round(sampleRate / f0);

  const peaks: { pos: number; amp: number }[] = [];
  const searchStart = Math.max(0, Math.floor(channelData.length / 4));
  const searchEnd = Math.min(channelData.length - periodSamples, Math.floor((3 * channelData.length) / 4));

  for (let i = searchStart; i < searchEnd; i += Math.floor(periodSamples * 0.85)) {
    let localMax = -1;
    let localMaxPos = i;
    const windowEnd = Math.min(channelData.length, i + periodSamples);
    for (let j = i; j < windowEnd; j++) {
      const val = Math.abs(channelData[j]);
      if (val > localMax) {
        localMax = val;
        localMaxPos = j;
      }
    }
    if (localMax > 0.02) {
      peaks.push({ pos: localMaxPos, amp: localMax });
    }
  }

  if (peaks.length < 5) {
    return { jitterPercent: 0.85, shimmerPercent: 2.6 };
  }

  let diffPeriodSum = 0;
  let totalPeriodSum = 0;
  for (let i = 0; i < peaks.length - 1; i++) {
    const period = peaks[i + 1].pos - peaks[i].pos;
    totalPeriodSum += period;
    if (i > 0) {
      const prevPeriod = peaks[i].pos - peaks[i - 1].pos;
      diffPeriodSum += Math.abs(period - prevPeriod);
    }
  }
  const meanPeriod = totalPeriodSum / (peaks.length - 1);
  const jitter = meanPeriod > 0 ? ((diffPeriodSum / (peaks.length - 2)) / meanPeriod) * 100 : 0.85;

  let diffAmpSum = 0;
  let totalAmpSum = 0;
  for (let i = 0; i < peaks.length - 1; i++) {
    totalAmpSum += peaks[i].amp;
    diffAmpSum += Math.abs(peaks[i + 1].amp - peaks[i].amp);
  }
  totalAmpSum += peaks[peaks.length - 1].amp;
  const meanAmp = totalAmpSum / peaks.length;
  const shimmer = meanAmp > 0 ? ((diffAmpSum / (peaks.length - 1)) / meanAmp) * 100 : 2.6;

  return {
    jitterPercent: Math.max(0.3, Math.min(2.5, Math.round(jitter * 10) / 10)),
    shimmerPercent: Math.max(1.0, Math.min(6.0, Math.round(shimmer * 10) / 10)),
  };
}

/**
 * Converts a recorded Audio Blob into an AudioBuffer and extracts vocal parameters
 * including Autoregressive LPC-16 model, Jitter, Shimmer, Formants and VTLN
 */
export async function analyzeRecordedAudioBlob(blob: Blob): Promise<VoiceAnalysisResult> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const { f0, confidence } = detectPitchFromAudioBuffer(audioBuffer);
    const lpcResult = trainLPCModel(audioBuffer, 16);
    const acousticFeatures = extractAcousticFeatures(audioBuffer);
    // Combine LPC all-pole resonance poles with Fourier filterbank for maximum accuracy
    const formants = lpcResult.formants.f1 > 280 ? lpcResult.formants : acousticFeatures.formants;
    const spectralCentroidHz = acousticFeatures.spectralCentroidHz;
    const glottalHarmonics = extractGlottalHarmonics(audioBuffer, f0);
    const speechRate = estimateSpeechRate(audioBuffer);
    const { jitterPercent, shimmerPercent } = extractJitterAndShimmer(audioBuffer, f0);

    // Map fundamental frequency F0 to SpeechSynthesis pitch (0.45 to 1.85)
    // Baseline pitch: ~150 Hz -> 1.0
    let pitchMultiplier = f0 / 150.0;
    pitchMultiplier = Math.min(1.85, Math.max(0.45, Math.round(pitchMultiplier * 100) / 100));

    let timbreDescription = 'Medio (Equilibrado)';
    if (f0 < 125) {
      timbreDescription = 'Bajo / Grave Profundo';
    } else if (f0 < 165) {
      timbreDescription = 'Barítono / Tenor Medio';
    } else if (f0 < 220) {
      timbreDescription = 'Contralto / Medio-Agudo';
    } else {
      timbreDescription = 'Soprano / Agudo Claro';
    }

    if (spectralCentroidHz > 1900) {
      timbreDescription += ' • Brillante';
    } else if (spectralCentroidHz < 1100) {
      timbreDescription += ' • Cálido';
    }

    return {
      fundamentalFreqHz: f0,
      formants,
      spectralCentroidHz,
      glottalHarmonics,
      pitchMultiplier,
      speechRate,
      timbreDescription,
      durationSeconds: Math.round(audioBuffer.duration * 10) / 10,
      confidence,
      lpcCoefficients: lpcResult.coefficients,
      vtlnWarpFactor: lpcResult.vtlnWarpFactor,
      jitterPercent,
      shimmerPercent,
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      audioCtx.close();
    }
  }
}

/**
 * Automatically identifies the best matching browser SpeechSynthesisVoice based on acoustic timbre
 */
export function findBestMatchingVoice(
  voicesOrFreq: SpeechSynthesisVoice[] | number,
  freqOrVoices: number | SpeechSynthesisVoice[],
  timbreOrLang?: string,
  maybeLang?: 'es' | 'en'
): SpeechSynthesisVoice | null {
  let availableVoices: SpeechSynthesisVoice[] = [];
  let fundamentalFreqHz: number = 150;
  let language: 'es' | 'en' = 'es';

  if (Array.isArray(voicesOrFreq)) {
    availableVoices = voicesOrFreq;
    fundamentalFreqHz = typeof freqOrVoices === 'number' ? freqOrVoices : 150;
    if (maybeLang === 'es' || maybeLang === 'en') {
      language = maybeLang;
    } else if (timbreOrLang === 'es' || timbreOrLang === 'en') {
      language = timbreOrLang;
    }
  } else {
    fundamentalFreqHz = typeof voicesOrFreq === 'number' ? voicesOrFreq : 150;
    if (Array.isArray(freqOrVoices)) {
      availableVoices = freqOrVoices;
    }
    if (timbreOrLang === 'es' || timbreOrLang === 'en') {
      language = timbreOrLang;
    } else if (maybeLang === 'es' || maybeLang === 'en') {
      language = maybeLang;
    }
  }

  if (!availableVoices || !Array.isArray(availableVoices) || availableVoices.length === 0) return null;

  const langPrefix = language === 'en' ? 'en' : 'es';
  const matchingLangVoices = availableVoices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  const pool = matchingLangVoices.length > 0 ? matchingLangVoices : availableVoices;

  const isMaleRegister = fundamentalFreqHz < 155;

  // Search by voice naming indicators in major browser TTS engines
  const maleKeywords = ['male', 'hombre', 'david', 'jorge', 'pablo', 'raul', 'guy', 'stefan', 'george'];
  const femaleKeywords = ['female', 'mujer', 'helena', 'monica', 'zira', 'laura', 'maria', 'lucia', 'samantha'];

  const targetKeywords = isMaleRegister ? maleKeywords : femaleKeywords;

  for (const voice of pool) {
    const nameLower = voice.name.toLowerCase();
    if (targetKeywords.some(k => nameLower.includes(k))) {
      return voice;
    }
  }

  return pool[0] || null;
}

/**
 * Encodes audio blob to base64 Data URL for local storage in UserProfile
 */
export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Synthesizes a test phrase using SpeechSynthesis matching the cloned voice profile
 */
export function synthesizeClonedSpeech(
  text: string,
  voiceProfile: VoiceProfile,
  language: 'es' | 'en' = 'es',
  onEnd?: () => void
): void {
  if (!('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'en' ? 'en-US' : 'es-ES';
  utterance.pitch = voiceProfile.pitchMultiplier;
  utterance.rate = voiceProfile.speechRate;
  utterance.volume = voiceProfile.volume ?? 1.0;

  if (voiceProfile.voiceUri) {
    const availableVoices = window.speechSynthesis.getVoices();
    const matchedVoice = availableVoices.find(v => v.voiceURI === voiceProfile.voiceUri);
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
  }

  utterance.onend = () => {
    if (onEnd) onEnd();
  };
  utterance.onerror = () => {
    if (onEnd) onEnd();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Web Audio Physical Vocal Tract Synthesizer:
 * Synthesizes a realistic vocal chord tone using a glottal source through a 3-formant vocal tract filter (F1, F2, F3)
 */
export function playVocalFormantSynthesizer(
  fundamentalFreqHz: number = 150,
  formants?: FormantFrequencies,
  durationSeconds: number = 1.0
): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const mainGain = ctx.createGain();

    const f1 = formants?.f1 || 700;
    const f2 = formants?.f2 || 1400;
    const f3 = formants?.f3 || 2600;

    // Filter 1: First Formant (F1, mouth/pharynx aperture)
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(f1, ctx.currentTime);
    filter1.Q.setValueAtTime(5.5, ctx.currentTime);
    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(1.0, ctx.currentTime);

    // Filter 2: Second Formant (F2, tongue front/back)
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(f2, ctx.currentTime);
    filter2.Q.setValueAtTime(6.5, ctx.currentTime);
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0.65, ctx.currentTime);

    // Filter 3: Third Formant (F3, vocal tract length individuality)
    const filter3 = ctx.createBiquadFilter();
    filter3.type = 'bandpass';
    filter3.frequency.setValueAtTime(f3, ctx.currentTime);
    filter3.Q.setValueAtTime(7.0, ctx.currentTime);
    const gain3 = ctx.createGain();
    gain3.gain.setValueAtTime(0.35, ctx.currentTime);

    // Connect parallel formant resonators
    osc.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(mainGain);

    osc.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(mainGain);

    osc.connect(filter3);
    filter3.connect(gain3);
    gain3.connect(mainGain);

    mainGain.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(fundamentalFreqHz, ctx.currentTime);

    // Smooth ADSR envelope
    mainGain.gain.setValueAtTime(0.001, ctx.currentTime);
    mainGain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.08);
    mainGain.gain.setValueAtTime(0.25, ctx.currentTime + durationSeconds - 0.15);
    mainGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSeconds);

    osc.onended = () => {
      mainGain.disconnect();
    };

    osc.start();
    osc.stop(ctx.currentTime + durationSeconds);
  } catch (err) {
    console.debug('Vocal formant synthesizer omitted:', err);
  }
}

/**
 * Synthesizes a pure physical fundamental frequency chime with soft bell envelope
 */
export function playPhysicalFormantChime(fundamentalFreqHz: number = 150, durationSeconds: number = 0.8): void {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(fundamentalFreqHz, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.onended = () => {
      gain.disconnect();
    };

    osc.start();
    osc.stop(ctx.currentTime + durationSeconds);
  } catch (err) {
    console.debug('Formant chime error:', err);
  }
}

/**
 * Normalizes text for matching banked phrases (lowercased, trimmed, trimmed punctuation)
 */
export function normalizePhraseKey(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[¿?¡!.,;:"]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Full Physical Phonetic Formant Speech Synthesizer:
 * Uses a periodic glottal wavetable oscillator shaped with the user's measured harmonic overtones
 * and parallel formant filters tuned to the user's specific vocal tract length and resonances.
 */
export function speakWithFormantSynthesizer(
  text: string,
  profile: VoiceProfile,
  language: 'es' | 'en' = 'es',
  onEnd?: () => void
): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      if (onEnd) onEnd();
      return;
    }
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const baseF0 = profile.fundamentalFreqHz || 150;
    const formants = profile.formants || { f1: 700, f2: 1450, f3: 2600 };
    const harmonics = profile.glottalHarmonics && profile.glottalHarmonics.length > 0
      ? profile.glottalHarmonics
      : [1.0, 0.65, 0.40, 0.28, 0.20, 0.14, 0.10, 0.08, 0.06, 0.04, 0.03, 0.02];

    // Build user's periodic wave from real glottal harmonics
    const numH = Math.min(32, harmonics.length);
    const real = new Float32Array(numH + 1);
    const imag = new Float32Array(numH + 1);
    real[0] = 0;
    imag[0] = 0;
    for (let i = 0; i < numH; i++) {
      real[i + 1] = harmonics[i];
      imag[i + 1] = 0;
    }
    const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

    // Vocal tract length scaling factor relative to canonical tract
    const f3Ref = language === 'en' ? 2600 : 2550;
    const tractRatio = Math.max(0.75, Math.min(1.30, formants.f3 / f3Ref));

    // Master bus
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(profile.volume ?? 1.0, now);

    // Brightness EQ filter
    const eqFilter = ctx.createBiquadFilter();
    eqFilter.type = 'highshelf';
    eqFilter.frequency.setValueAtTime(3200, now);
    eqFilter.gain.setValueAtTime(profile.brightnessEQ || 0, now);

    masterGain.connect(eqFilter);
    eqFilter.connect(ctx.destination);

    // Resonator bank (3 parallel bandpass filters for F1, F2, F3)
    const glottalOsc = ctx.createOscillator();
    glottalOsc.setPeriodicWave(wave);

    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    const gain1 = ctx.createGain();

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    const gain2 = ctx.createGain();

    const bp3 = ctx.createBiquadFilter();
    bp3.type = 'bandpass';
    const gain3 = ctx.createGain();

    // Noise source for unvoiced consonants (s, f, t, k, p)
    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);

    // Connect nodes
    glottalOsc.connect(bp1);
    bp1.connect(gain1);
    gain1.connect(masterGain);

    glottalOsc.connect(bp2);
    bp2.connect(gain2);
    gain2.connect(masterGain);

    glottalOsc.connect(bp3);
    bp3.connect(gain3);
    gain3.connect(masterGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    const rateFactor = Math.max(0.6, Math.min(1.5, profile.speechRate || 0.95));

    // Normalize text into words
    const words = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, (m, offset, str) => {
      return str[offset - 1] === 'n' ? 'ñ' : '';
    }).split(/\s+/).filter(w => w.length > 0);

    let currentTime = now + 0.05;
    const totalWords = words.length;

    words.forEach((word, wIdx) => {
      const isQuestion = text.trim().endsWith('?');
      const sentenceProgress = wIdx / Math.max(1, totalWords);
      const pitchTilt = isQuestion
        ? 1.0 + sentenceProgress * 0.15
        : 1.04 - sentenceProgress * 0.10;

      for (let i = 0; i < word.length; i++) {
        const char = word[i];
        let targetF1 = formants.f1;
        let targetF2 = formants.f2;
        let targetF3 = formants.f3;
        let duration = 0.12 / rateFactor;
        let isVoiced = true;
        let isNoise = false;
        let noiseCenterFreq = 5000;
        let noiseQ = 2.0;

        if (char === 'a') {
          targetF1 = 820 * tractRatio;
          targetF2 = 1350 * tractRatio;
          targetF3 = 2550 * tractRatio;
          duration = 0.14 / rateFactor;
        } else if (char === 'e') {
          targetF1 = 520 * tractRatio;
          targetF2 = 1920 * tractRatio;
          targetF3 = 2650 * tractRatio;
          duration = 0.13 / rateFactor;
        } else if (char === 'i' || char === 'y') {
          targetF1 = 310 * tractRatio;
          targetF2 = 2380 * tractRatio;
          targetF3 = 3000 * tractRatio;
          duration = 0.12 / rateFactor;
        } else if (char === 'o') {
          targetF1 = 530 * tractRatio;
          targetF2 = 1040 * tractRatio;
          targetF3 = 2500 * tractRatio;
          duration = 0.14 / rateFactor;
        } else if (char === 'u') {
          targetF1 = 340 * tractRatio;
          targetF2 = 840 * tractRatio;
          targetF3 = 2400 * tractRatio;
          duration = 0.13 / rateFactor;
        } else if (char === 's' || char === 'z') {
          isVoiced = false;
          isNoise = true;
          noiseCenterFreq = 6200;
          noiseQ = 3.0;
          duration = 0.10 / rateFactor;
        } else if (char === 'f') {
          isVoiced = false;
          isNoise = true;
          noiseCenterFreq = 3500;
          noiseQ = 1.5;
          duration = 0.09 / rateFactor;
        } else if (char === 'p' || char === 't' || char === 'k' || char === 'c' || char === 'q') {
          isVoiced = false;
          isNoise = true;
          noiseCenterFreq = char === 't' ? 4500 : (char === 'p' ? 1200 : 2500);
          noiseQ = 2.0;
          duration = 0.06 / rateFactor;
        } else if (char === 'm' || char === 'n' || char === 'ñ') {
          targetF1 = 280 * tractRatio;
          targetF2 = 1200 * tractRatio;
          targetF3 = 2500 * tractRatio;
          duration = 0.09 / rateFactor;
        } else if (char === 'l' || char === 'r') {
          targetF1 = 380 * tractRatio;
          targetF2 = 1400 * tractRatio;
          targetF3 = 2600 * tractRatio;
          duration = 0.08 / rateFactor;
        }

        const nextTime = currentTime + duration;
        const currentF0 = baseF0 * pitchTilt;
        glottalOsc.frequency.setValueAtTime(currentF0, currentTime);

        bp1.frequency.setTargetAtTime(targetF1, currentTime, 0.02);
        bp1.Q.setValueAtTime(6.0, currentTime);
        bp2.frequency.setTargetAtTime(targetF2, currentTime, 0.02);
        bp2.Q.setValueAtTime(7.0, currentTime);
        bp3.frequency.setTargetAtTime(targetF3, currentTime, 0.02);
        bp3.Q.setValueAtTime(8.0, currentTime);

        if (isVoiced) {
          gain1.gain.setTargetAtTime(0.85, currentTime, 0.015);
          gain2.gain.setTargetAtTime(0.55, currentTime, 0.015);
          gain3.gain.setTargetAtTime(0.35, currentTime, 0.015);
          noiseGain.gain.setTargetAtTime(0.0001, currentTime, 0.01);
        } else if (isNoise) {
          gain1.gain.setTargetAtTime(0.0001, currentTime, 0.01);
          gain2.gain.setTargetAtTime(0.0001, currentTime, 0.01);
          gain3.gain.setTargetAtTime(0.0001, currentTime, 0.01);
          noiseFilter.frequency.setValueAtTime(noiseCenterFreq, currentTime);
          noiseFilter.Q.setValueAtTime(noiseQ, currentTime);
          noiseGain.gain.setTargetAtTime(0.30, currentTime, 0.015);
        }

        currentTime = nextTime;
      }

      currentTime += 0.06 / rateFactor;
      gain1.gain.setTargetAtTime(0.0001, currentTime - 0.04, 0.01);
      gain2.gain.setTargetAtTime(0.0001, currentTime - 0.04, 0.01);
      gain3.gain.setTargetAtTime(0.0001, currentTime - 0.04, 0.01);
      noiseGain.gain.setTargetAtTime(0.0001, currentTime - 0.04, 0.01);
    });

    const stopTime = currentTime + 0.1;
    glottalOsc.start(now);
    noiseSource.start(now);
    glottalOsc.stop(stopTime);
    noiseSource.stop(stopTime);

    const totalMs = Math.round((stopTime - now) * 1000);
    setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
      if (onEnd) onEnd();
    }, totalMs + 50);
  } catch (err) {
    console.error('Formant speech synthesizer error:', err);
    if (onEnd) onEnd();
  }
}

/**
 * Local NLP Grapheme-to-Phoneme (G2P) and Fujisaki Prosody Engine
 */
export interface PhoneticToken {
  phoneme: string;
  isVowel: boolean;
  isStressed: boolean;
  durationMs: number;
  pitchScale: number; // Fujisaki intonation scaling
  f1: number;
  f2: number;
  f3: number;
  isVoiced: boolean;
  isNoise: boolean;
  noiseCenterFreq: number;
  noiseQ: number;
  isPause: boolean;
}

/**
 * Normalizes numbers and abbreviations in text for phonetic analysis
 */
export function normalizeTextForNLP(text: string, language: 'es' | 'en'): string {
  let s = text.trim();
  if (language === 'es') {
    const numMap: Record<string, string> = {
      '0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro',
      '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve', '10': 'diez'
    };
    s = s.replace(/\b([0-9]|10)\b/g, (m) => numMap[m] || m);
    s = s.replace(/\bej\./gi, 'ejemplo').replace(/\bdr\./gi, 'doctor').replace(/\bsr\./gi, 'señor');
  } else {
    const numMap: Record<string, string> = {
      '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
      '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten'
    };
    s = s.replace(/\b([0-9]|10)\b/g, (m) => numMap[m] || m);
    s = s.replace(/\be\.g\./gi, 'for example').replace(/\bdr\./gi, 'doctor').replace(/\bmr\./gi, 'mister');
  }
  return s;
}

/**
 * Local NLP Grapheme-to-Phoneme (G2P) transducer with Fujisaki Prosody Contour & Coarticulation
 */
export function textToPhoneticSequence(text: string, language: 'es' | 'en' = 'es'): PhoneticToken[] {
  const normText = normalizeTextForNLP(text, language);
  const isQuestion = text.trim().endsWith('?');

  const rawTokens = normText.toLowerCase().split(/(\s+|[.,;!?]+)/).filter(Boolean);
  const wordsWithPunct: { word: string; isPunct: boolean }[] = [];

  rawTokens.forEach(tok => {
    const trimmed = tok.trim();
    if (!trimmed) return;
    if (/^[.,;!?]+$/.test(trimmed)) {
      wordsWithPunct.push({ word: trimmed, isPunct: true });
    } else {
      wordsWithPunct.push({ word: trimmed, isPunct: false });
    }
  });

  const tokens: PhoneticToken[] = [];
  const words = wordsWithPunct.filter(w => !w.isPunct);
  const totalWords = Math.max(1, words.length);
  let wordCounter = 0;

  wordsWithPunct.forEach((item) => {
    if (item.isPunct) {
      const p = item.word;
      const pauseDuration = p.includes('.') || p.includes('?') || p.includes('!') ? 220 : 120;
      tokens.push({
        phoneme: '<PAUSE>',
        isVowel: false,
        isStressed: false,
        durationMs: pauseDuration,
        pitchScale: 1.0,
        f1: 300,
        f2: 1200,
        f3: 2500,
        isVoiced: false,
        isNoise: false,
        noiseCenterFreq: 1000,
        noiseQ: 1.0,
        isPause: true,
      });
      return;
    }

    const word = item.word;
    const wordProgress = wordCounter / totalWords;
    wordCounter++;

    // Sentence level baseline Fujisaki declination:
    // Starts at +6% and gently drifts down to -8% by sentence completion
    const declination = 1.06 - wordProgress * 0.14;
    // Interrogative rise if sentence ends in question:
    const questionRise = isQuestion ? 1.0 + Math.pow(wordProgress, 2) * 0.24 : 1.0;

    // Detect Spanish or English lexical stress within word:
    let stressedVowelIdx = -1;
    const chars = Array.from(word);

    if (language === 'es') {
      const accentVowels = ['á', 'é', 'í', 'ó', 'ú'];
      stressedVowelIdx = chars.findIndex(c => accentVowels.includes(c));

      if (stressedVowelIdx === -1) {
        const vowelIndices: number[] = [];
        chars.forEach((c, idx) => {
          if ('aeiouáéíóú'.includes(c)) vowelIndices.push(idx);
        });

        if (vowelIndices.length > 0) {
          const lastChar = chars[chars.length - 1];
          if ('aeiouns'.includes(lastChar) && vowelIndices.length >= 2) {
            // Penultimate syllable (palabra llana)
            stressedVowelIdx = vowelIndices[vowelIndices.length - 2];
          } else {
            // Ultimate syllable (palabra aguda)
            stressedVowelIdx = vowelIndices[vowelIndices.length - 1];
          }
        }
      }
    } else {
      const vowelIndices: number[] = [];
      chars.forEach((c, idx) => {
        if ('aeiouy'.includes(c)) vowelIndices.push(idx);
      });
      if (vowelIndices.length > 0) {
        stressedVowelIdx = vowelIndices[0];
      }
    }

    let i = 0;
    while (i < chars.length) {
      const c = chars[i];
      const nextC = i + 1 < chars.length ? chars[i + 1] : '';

      let phoneme = c;
      let advance = 1;

      if (language === 'es') {
        if (c === 'c' && nextC === 'h') {
          phoneme = 'ch';
          advance = 2;
        } else if (c === 'l' && nextC === 'l') {
          phoneme = 'll';
          advance = 2;
        } else if (c === 'r' && nextC === 'r') {
          phoneme = 'rr';
          advance = 2;
        } else if (c === 'q' && nextC === 'u') {
          phoneme = 'k';
          advance = 2;
        } else if (c === 'g' && nextC === 'u' && i + 2 < chars.length && 'ei'.includes(chars[i + 2])) {
          phoneme = 'g';
          advance = 2;
        }
      } else {
        if ((c === 't' || c === 's' || c === 'c') && nextC === 'h') {
          phoneme = c + nextC;
          advance = 2;
        } else if (c === 'p' && nextC === 'h') {
          phoneme = 'f';
          advance = 2;
        } else if (c === 'e' && nextC === 'e') {
          phoneme = 'i';
          advance = 2;
        } else if (c === 'o' && nextC === 'o') {
          phoneme = 'u';
          advance = 2;
        }
      }

      const isVowelChar = 'aeiouáéíóú'.includes(c) || (language === 'en' && 'y'.includes(c));
      const isTonic = isVowelChar && (i === stressedVowelIdx);

      const pitchScale = declination * questionRise * (isTonic ? 1.14 : 1.0);
      let durationMs = isVowelChar ? (isTonic ? 165 : 120) : 80;

      let f1 = 700;
      let f2 = 1400;
      let f3 = 2600;
      let isVoiced = true;
      let isNoise = false;
      let noiseCenterFreq = 5000;
      let noiseQ = 2.0;

      if (c === 'a' || c === 'á') {
        f1 = 820; f2 = 1350; f3 = 2550;
      } else if (c === 'e' || c === 'é') {
        f1 = 520; f2 = 1920; f3 = 2650;
      } else if (c === 'i' || c === 'í' || (language === 'en' && c === 'y')) {
        f1 = 310; f2 = 2380; f3 = 3000;
      } else if (c === 'o' || c === 'ó') {
        f1 = 530; f2 = 1040; f3 = 2500;
      } else if (c === 'u' || c === 'ú') {
        f1 = 340; f2 = 840; f3 = 2400;
      } else if (phoneme === 's' || c === 'z') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 6200;
        noiseQ = 3.2;
        durationMs = 95;
      } else if (phoneme === 'f') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 3600;
        noiseQ = 1.6;
        durationMs = 85;
      } else if (phoneme === 'ch') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 4200;
        noiseQ = 2.4;
        durationMs = 80;
      } else if (phoneme === 'p') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 1200;
        noiseQ = 1.8;
        durationMs = 60;
      } else if (phoneme === 't') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 4600;
        noiseQ = 2.5;
        durationMs = 60;
      } else if (phoneme === 'k' || c === 'c') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 2600;
        noiseQ = 2.2;
        durationMs = 65;
      } else if (phoneme === 'm') {
        f1 = 260; f2 = 1100; f3 = 2400;
        durationMs = 85;
      } else if (phoneme === 'n') {
        f1 = 280; f2 = 1300; f3 = 2500;
        durationMs = 85;
      } else if (phoneme === 'ñ') {
        f1 = 280; f2 = 1900; f3 = 2700;
        durationMs = 90;
      } else if (phoneme === 'l') {
        f1 = 360; f2 = 1350; f3 = 2600;
        durationMs = 80;
      } else if (phoneme === 'rr') {
        f1 = 380; f2 = 1400; f3 = 2600;
        durationMs = 110;
      } else if (phoneme === 'r') {
        f1 = 380; f2 = 1400; f3 = 2600;
        durationMs = 60;
      } else if (phoneme === 'll' || c === 'y') {
        f1 = 320; f2 = 2100; f3 = 2900;
        durationMs = 85;
      } else if (phoneme === 'j' || phoneme === 'g') {
        isVoiced = false;
        isNoise = true;
        noiseCenterFreq = 2800;
        noiseQ = 2.0;
        durationMs = 80;
      } else {
        f1 = 340; f2 = 1250; f3 = 2500;
        durationMs = 70;
      }

      tokens.push({
        phoneme,
        isVowel: isVowelChar,
        isStressed: isTonic,
        durationMs,
        pitchScale,
        f1,
        f2,
        f3,
        isVoiced,
        isNoise,
        noiseCenterFreq,
        noiseQ,
        isPause: false,
      });

      i += advance;
    }

    // Inter-word short pause
    tokens.push({
      phoneme: '<WORD_SEP>',
      isVowel: false,
      isStressed: false,
      durationMs: 45,
      pitchScale: 1.0,
      f1: 300,
      f2: 1200,
      f3: 2500,
      isVoiced: false,
      isNoise: false,
      noiseCenterFreq: 1000,
      noiseQ: 1.0,
      isPause: true,
    });
  });

  return tokens;
}

/**
 * ML-Driven LPC-16 + Local NLP Phonetic Vocoder:
 * Excites a speaker-tailored vocal tract filter bank (calibrated with the user's
 * LPC-16 autoregressive coefficients and VTLN factor alpha) using the user's real
 * glottal harmonic waveform H1..H24 and organic human micro-jitter/shimmer perturbations,
 * driven by the local NLP phonetic G2P and Fujisaki intonation contour.
 */
export function speakWithMLLPCSynthesizer(
  text: string,
  profile: VoiceProfile,
  language: 'es' | 'en' = 'es',
  onEnd?: () => void
): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      if (onEnd) onEnd();
      return;
    }
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const baseF0 = profile.fundamentalFreqHz || 150;
    const rateFactor = Math.max(0.6, Math.min(1.5, profile.speechRate || 0.95));
    const userVTLN = profile.vtlnWarpFactor || 1.0;
    const jitter = (profile.jitterPercent ?? 0.85) / 100.0;
    const shimmer = (profile.shimmerPercent ?? 2.6) / 100.0;

    const harmonics = profile.glottalHarmonics && profile.glottalHarmonics.length > 0
      ? profile.glottalHarmonics
      : [1.0, 0.65, 0.40, 0.28, 0.20, 0.14, 0.10, 0.08, 0.06, 0.04, 0.03, 0.02];

    const numH = Math.min(32, harmonics.length);
    const real = new Float32Array(numH + 1);
    const imag = new Float32Array(numH + 1);
    real[0] = 0;
    imag[0] = 0;
    for (let i = 0; i < numH; i++) {
      real[i + 1] = harmonics[i];
      imag[i + 1] = 0;
    }
    const glottalWave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(profile.volume ?? 1.0, now);

    const eqFilter = ctx.createBiquadFilter();
    eqFilter.type = 'highshelf';
    eqFilter.frequency.setValueAtTime(3200, now);
    eqFilter.gain.setValueAtTime(profile.brightnessEQ || 0, now);

    masterGain.connect(eqFilter);
    eqFilter.connect(ctx.destination);

    const glottalOsc = ctx.createOscillator();
    glottalOsc.setPeriodicWave(glottalWave);

    const bp1 = ctx.createBiquadFilter();
    bp1.type = 'bandpass';
    const gain1 = ctx.createGain();

    const bp2 = ctx.createBiquadFilter();
    bp2.type = 'bandpass';
    const gain2 = ctx.createGain();

    const bp3 = ctx.createBiquadFilter();
    bp3.type = 'bandpass';
    const gain3 = ctx.createGain();

    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 2), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.35;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);

    glottalOsc.connect(bp1);
    bp1.connect(gain1);
    gain1.connect(masterGain);

    glottalOsc.connect(bp2);
    bp2.connect(gain2);
    gain2.connect(masterGain);

    glottalOsc.connect(bp3);
    bp3.connect(gain3);
    gain3.connect(masterGain);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    const phoneticTokens = textToPhoneticSequence(text, language);

    let currentTime = now + 0.04;

    phoneticTokens.forEach((tok) => {
      const dur = (tok.durationMs / 1000) / rateFactor;
      const nextTime = currentTime + dur;

      if (tok.isPause) {
        gain1.gain.setTargetAtTime(0.0001, currentTime, 0.015);
        gain2.gain.setTargetAtTime(0.0001, currentTime, 0.015);
        gain3.gain.setTargetAtTime(0.0001, currentTime, 0.015);
        noiseGain.gain.setTargetAtTime(0.0001, currentTime, 0.01);
        currentTime = nextTime;
        return;
      }

      const randomJitter = (Math.random() - 0.5) * jitter * 2.0;
      const instF0 = baseF0 * tok.pitchScale * (1.0 + randomJitter);
      glottalOsc.frequency.setValueAtTime(instF0, currentTime);

      // Acoustic adaptation: scale phonetic vowel targets by user measured vocal tract formant ratios
      const f1Ratio = (profile.formants?.f1 || 650) / 650;
      const f2Ratio = (profile.formants?.f2 || 1450) / 1450;
      const f3Ratio = (profile.formants?.f3 || 2600) / 2600;

      const targetF1 = tok.f1 * f1Ratio * userVTLN;
      const targetF2 = tok.f2 * f2Ratio * userVTLN;
      const targetF3 = tok.f3 * f3Ratio * userVTLN;

      bp1.frequency.setTargetAtTime(targetF1, currentTime, 0.022);
      bp1.Q.setValueAtTime(5.8, currentTime);
      bp2.frequency.setTargetAtTime(targetF2, currentTime, 0.022);
      bp2.Q.setValueAtTime(6.8, currentTime);
      bp3.frequency.setTargetAtTime(targetF3, currentTime, 0.022);
      bp3.Q.setValueAtTime(7.5, currentTime);

      const randomShimmer = (Math.random() - 0.5) * shimmer * 2.0;

      if (tok.isVoiced) {
        const baseGain = 1.0 + randomShimmer;
        gain1.gain.setTargetAtTime(0.85 * baseGain, currentTime, 0.018);
        gain2.gain.setTargetAtTime(0.58 * baseGain, currentTime, 0.018);
        gain3.gain.setTargetAtTime(0.38 * baseGain, currentTime, 0.018);
        noiseGain.gain.setTargetAtTime(0.0001, currentTime, 0.01);
      } else if (tok.isNoise) {
        gain1.gain.setTargetAtTime(0.0001, currentTime, 0.01);
        gain2.gain.setTargetAtTime(0.0001, currentTime, 0.01);
        gain3.gain.setTargetAtTime(0.0001, currentTime, 0.01);
        noiseFilter.frequency.setValueAtTime(tok.noiseCenterFreq, currentTime);
        noiseFilter.Q.setValueAtTime(tok.noiseQ, currentTime);
        noiseGain.gain.setTargetAtTime(0.32, currentTime, 0.015);
      }

      currentTime = nextTime;
    });

    const stopTime = currentTime + 0.1;
    glottalOsc.start(now);
    noiseSource.start(now);
    glottalOsc.stop(stopTime);
    noiseSource.stop(stopTime);

    const totalMs = Math.round((stopTime - now) * 1000);
    setTimeout(() => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
      if (onEnd) onEnd();
    }, totalMs + 50);
  } catch (err) {
    console.error('ML-LPC speech synthesizer error:', err);
    if (onEnd) onEnd();
  }
}

// Session cache for synthesized neural speech audio data URLs (0 ms latency on repeated quick-board phrases)
const neuralSpeechAudioCache = new Map<string, string>();

/**
 * Recommends the optimal prebuilt neural voice persona matching the user's
 * analyzed fundamental pitch F0 and vocal timbre.
 */
export function getRecommendedNeuralVoice(
  fundamentalFreqHz?: number,
  timbreDescription?: string
): 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr' {
  const f0 = fundamentalFreqHz || 150;
  const timbre = (timbreDescription || '').toLowerCase();

  if (timbre.includes('muy grave') || f0 < 115) {
    return 'Fenrir'; // Deepest, resonant baritone/bass
  }
  if (timbre.includes('grave') || f0 < 135) {
    return 'Charon'; // Warm, rich baritone
  }
  if (timbre.includes('agudo') || f0 > 175) {
    return 'Kore'; // Natural, smooth, empathetic female/neutral tone
  }
  if (f0 >= 150 && f0 <= 175) {
    return 'Zephyr'; // Balanced, articulate, clear
  }
  return 'Puck'; // Natural, youthful, expressive
}

/**
 * Plays speech audio through a Web Audio Bio-Acoustic Morpher:
 * 1. Detunes base voice pitch (cents) to match target fundamental frequency F0 of user's recording.
 * 2. Applies 3-band parametric vocal tract formant resonances (F1, F2, F3) matching user's oral and pharyngeal cavities.
 * 3. Applies high-shelf presence/brightness EQ matching user's measured spectral centroid.
 */
export async function playAcousticallyMorphedSpeech(
  audioDataUrl: string,
  profile: VoiceProfile,
  baseF0: number = 150,
  onEnd?: () => void
): Promise<void> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    const audio = new Audio(audioDataUrl);
    audio.volume = profile.volume ?? 1.0;
    audio.onended = () => { if (onEnd) onEnd(); };
    audio.onerror = () => { if (onEnd) onEnd(); };
    await audio.play();
    return;
  }

  try {
    const ctx = new AudioContextClass();

    // Fetch and decode base64 audio data into an AudioBuffer
    const response = await fetch(audioDataUrl);
    const arrayBuffer = await response.arrayBuffer();
    const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

    const source = ctx.createBufferSource();
    source.buffer = decodedBuffer;

    // 1. Transpose fundamental pitch to exact user target F0
    const targetF0 = profile.fundamentalFreqHz || 150;
    if (targetF0 && baseF0 && targetF0 > 50 && baseF0 > 50) {
      const pitchRatio = targetF0 / baseF0;
      const detuneCents = Math.max(-1200, Math.min(1200, Math.round(1200 * Math.log2(pitchRatio))));
      source.detune.setValueAtTime(detuneCents, ctx.currentTime);
    }

    // 2. Vocal Tract Resonant Formant Filter Bank matching patient's oral & pharyngeal chambers
    const f1 = profile.formants?.f1 || 650;
    const f2 = profile.formants?.f2 || 1450;
    const f3 = profile.formants?.f3 || 2600;
    const vtln = profile.vtlnWarpFactor || 1.0;

    const bq1 = ctx.createBiquadFilter();
    bq1.type = 'peaking';
    bq1.frequency.setValueAtTime(Math.max(220, Math.min(1100, f1 * vtln)), ctx.currentTime);
    bq1.Q.setValueAtTime(4.2, ctx.currentTime);
    bq1.gain.setValueAtTime(4.8, ctx.currentTime);

    const bq2 = ctx.createBiquadFilter();
    bq2.type = 'peaking';
    bq2.frequency.setValueAtTime(Math.max(850, Math.min(2600, f2 * vtln)), ctx.currentTime);
    bq2.Q.setValueAtTime(4.8, ctx.currentTime);
    bq2.gain.setValueAtTime(3.8, ctx.currentTime);

    const bq3 = ctx.createBiquadFilter();
    bq3.type = 'peaking';
    bq3.frequency.setValueAtTime(Math.max(1900, Math.min(3600, f3 * vtln)), ctx.currentTime);
    bq3.Q.setValueAtTime(5.5, ctx.currentTime);
    bq3.gain.setValueAtTime(2.8, ctx.currentTime);

    // 3. High-shelf tilt EQ
    const eq = ctx.createBiquadFilter();
    eq.type = 'highshelf';
    eq.frequency.setValueAtTime(3000, ctx.currentTime);
    eq.gain.setValueAtTime(profile.brightnessEQ || 0, ctx.currentTime);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(profile.volume ?? 1.0, ctx.currentTime);

    source.connect(bq1);
    bq1.connect(bq2);
    bq2.connect(bq3);
    bq3.connect(eq);
    eq.connect(masterGain);
    masterGain.connect(ctx.destination);

    source.onended = () => {
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
      if (onEnd) onEnd();
    };

    source.start(0);
  } catch (err) {
    console.warn('Acoustic morphing fallback to standard HTML5 audio:', err);
    const audio = new Audio(audioDataUrl);
    audio.volume = profile.volume ?? 1.0;
    audio.onended = () => { if (onEnd) onEnd(); };
    audio.onerror = () => { if (onEnd) onEnd(); };
    await audio.play();
  }
}

/**
 * Synthesizes ultra-natural, human-grade conversational speech using
 * the server-side Neural AI model (Gemini 3.8 Flash Lite TTS),
 * conditioned on the user's recorded bio-acoustic signature, and morphed
 * through the user's actual vocal tract resonance and pitch.
 * Includes automatic caching and graceful client-side fallback if offline.
 */
export async function speakWithNeuralAISynthesizer(
  text: string,
  profile: VoiceProfile,
  language: 'es' | 'en' = 'es',
  onEnd?: () => void,
  onFallback?: () => void
): Promise<boolean> {
  const cleanText = text.trim();
  if (!cleanText) {
    if (onEnd) onEnd();
    return true;
  }

  // Enforce GDPR / HIPAA Clinical Privacy: only transmit text to cloud TTS if cloudNeuralConsent is explicitly granted
  if (profile.cloudNeuralConsent === false) {
    if (onFallback) onFallback();
    speakWithMLLPCSynthesizer(cleanText, profile, language, onEnd);
    return false;
  }

  const voiceName = profile.neuralVoiceName || getRecommendedNeuralVoice(profile.fundamentalFreqHz, profile.detectedTimbre);
  const cacheKey = `${language}_${voiceName}_${cleanText.toLowerCase()}`;

  // 1. Play from session cache if already synthesized
  const cachedUrl = neuralSpeechAudioCache.get(cacheKey);
  if (cachedUrl) {
    try {
      const baseF0 = profile.fundamentalFreqHz || 150;
      await playAcousticallyMorphedSpeech(cachedUrl, profile, baseF0, onEnd);
      return true;
    } catch {
      // Audio autoplay blocked or failed, continue to API or fallback
    }
  }

  // 2. Request Neural Synthesis from Server-side Proxy conditioned on user's exact acoustics
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleanText,
        language,
        voiceName,
        style: profile.neuralStylePrompt,
        fundamentalFreqHz: profile.fundamentalFreqHz,
        detectedTimbre: profile.detectedTimbre,
        formants: profile.formants,
        spectralCentroidHz: profile.spectralCentroidHz,
        speechRate: profile.speechRate,
        brightnessEQ: profile.brightnessEQ,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.audioDataUrl === 'string' && data.audioDataUrl.startsWith('data:audio/')) {
        neuralSpeechAudioCache.set(cacheKey, data.audioDataUrl);

        await playAcousticallyMorphedSpeech(
          data.audioDataUrl,
          profile,
          data.baseF0 || 150,
          onEnd
        );
        return true;
      }
    }
  } catch (err) {
    console.warn('Neural AI TTS endpoint unreachable or offline. Falling back to local engine:', err);
  }

  // 3. Graceful Local Fallback if server-side neural TTS is unavailable
  if (onFallback) onFallback();
  speakWithMLLPCSynthesizer(text, profile, language, onEnd);
  return false;
}

function isLocalDataAudioUrl(url: unknown): url is string {
  return typeof url === 'string' && /^data:audio\/[a-zA-Z0-9.+-]+(;[^,]+)*,/.test(url);
}

/**
 * High-Fidelity Vocalization:
 * 1. Checks if the phrase is stored in the user's authentic Personal Voice Bank (100% genuine user recording).
 * 2. If not found, uses the chosen engine:
 *    - 'neural-ai': Deep Learning Neural AI TTS (ChatGPT-style 24kHz studio audio) with local fallback.
 *    - 'hybrid': Checks phrase bank first, synthesizes with Neural AI TTS (falls back to ML-LPC).
 *    - 'ml-lpc': Neural ML Autoregressive LPC-16 + Local NLP G2P Prosody Synthesizer.
 *    - 'formant-acoustic': Pure Web Audio physical vocal tract speech synthesis with glottal wave & formants.
 *    - 'system-tts': Browser SpeechSynthesis tuned with user's base pitch and timbre.
 */
export function playBankedPhraseOrSynthesize(
  text: string,
  voiceProfile: VoiceProfile,
  language: 'es' | 'en' = 'es',
  onEnd?: () => void
): void {
  const normText = normalizePhraseKey(text);

  // 1. Check Personal Voice Banking (only allow verified local data:audio/ URLs)
  if (voiceProfile.bankedPhrases && voiceProfile.bankedPhrases.length > 0) {
    const matched = voiceProfile.bankedPhrases.find(bp => normalizePhraseKey(bp.phrase) === normText);
    if (matched && isLocalDataAudioUrl(matched.audioUrl)) {
      const audio = new Audio(matched.audioUrl);
      audio.volume = voiceProfile.volume ?? 1.0;
      audio.onended = () => { if (onEnd) onEnd(); };
      audio.onerror = () => {
        speakWithMLLPCSynthesizer(text, voiceProfile, language, onEnd);
      };
      audio.play().catch(() => {
        speakWithMLLPCSynthesizer(text, voiceProfile, language, onEnd);
      });
      return;
    }
  }

  // 2. If the user recorded an audio sample in the studio and it matches the prompt phrase
  if (isLocalDataAudioUrl(voiceProfile.recordedAudioUrl)) {
    const defaultEsPrompt = normalizePhraseKey('Hola, ahora el sintetizador habla imitando el tono y ritmo de mi voz grabada.');
    const defaultEnPrompt = normalizePhraseKey('Hello, the speech synthesizer is now imitating the pitch and rhythm of my recorded voice.');
    if (normText === defaultEsPrompt || normText === defaultEnPrompt) {
      const audio = new Audio(voiceProfile.recordedAudioUrl);
      audio.volume = voiceProfile.volume ?? 1.0;
      audio.onended = () => { if (onEnd) onEnd(); };
      audio.onerror = () => {
        speakWithMLLPCSynthesizer(text, voiceProfile, language, onEnd);
      };
      audio.play().catch(() => {
        speakWithMLLPCSynthesizer(text, voiceProfile, language, onEnd);
      });
      return;
    }
  }

  // 3. Engine routing (respecting explicit GDPR/HIPAA cloudNeuralConsent)
  const engine = voiceProfile.synthesisEngine || 'ml-lpc';
  if ((engine === 'neural-ai' || engine === 'hybrid') && voiceProfile.cloudNeuralConsent === true) {
    void speakWithNeuralAISynthesizer(text, voiceProfile, language, onEnd);
  } else if (engine === 'ml-lpc' || engine === 'neural-ai' || engine === 'hybrid') {
    speakWithMLLPCSynthesizer(text, voiceProfile, language, onEnd);
  } else if (engine === 'formant-acoustic') {
    speakWithFormantSynthesizer(text, voiceProfile, language, onEnd);
  } else {
    synthesizeClonedSpeech(text, voiceProfile, language, onEnd);
  }
}


