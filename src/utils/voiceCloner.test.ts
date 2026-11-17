/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import { 
  detectPitchFromAudioBuffer, 
  estimateSpeechRate, 
  extractAcousticFeatures, 
  extractGlottalHarmonics,
  normalizePhraseKey,
  findBestMatchingVoice,
  trainLPCModel,
  extractJitterAndShimmer,
  normalizeTextForNLP,
  textToPhoneticSequence,
  getRecommendedNeuralVoice
} from './voiceCloner.ts';

// Helper to create synthetic AudioBuffer-compatible structure
function createSyntheticBuffer(sampleRate: number, durationSeconds: number, generator: (t: number) => number): AudioBuffer {
  const totalSamples = Math.floor(sampleRate * durationSeconds);
  const data = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    data[i] = generator(t);
  }

  return {
    sampleRate,
    length: totalSamples,
    duration: durationSeconds,
    numberOfChannels: 1,
    getChannelData: () => data,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

describe('Client-Side Acoustic Voice Analysis and Pitch Detection', () => {
  const sampleRate = 44100;

  it('should accurately detect 220 Hz pitch in synthetic voiced buffer', () => {
    // Generate a 220 Hz fundamental frequency sine wave (approx. A3 musical note / common speaking range)
    const targetFreq = 220;
    const buffer = createSyntheticBuffer(sampleRate, 1.0, (t) => {
      // Sine wave with gentle harmonics simulating human vocal cords
      return 0.5 * Math.sin(2 * Math.PI * targetFreq * t) + 0.15 * Math.sin(2 * Math.PI * (targetFreq * 2) * t);
    });

    const result = detectPitchFromAudioBuffer(buffer);
    expect(result.f0).toBeGreaterThanOrEqual(210);
    expect(result.f0).toBeLessThanOrEqual(230);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should accurately detect 120 Hz pitch (deep register voice)', () => {
    const targetFreq = 120;
    const buffer = createSyntheticBuffer(sampleRate, 1.0, (t) => {
      return 0.6 * Math.sin(2 * Math.PI * targetFreq * t);
    });

    const result = detectPitchFromAudioBuffer(buffer);
    expect(result.f0).toBeGreaterThanOrEqual(115);
    expect(result.f0).toBeLessThanOrEqual(125);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should fall back safely to 150 Hz when audio is completely silent', () => {
    const buffer = createSyntheticBuffer(sampleRate, 0.5, () => 0.0);
    const result = detectPitchFromAudioBuffer(buffer);
    expect(result.f0).toBe(150);
    expect(result.confidence).toBe(0);
  });

  it('should estimate higher speech rate for dense sustained speech audio', () => {
    // Continuous tone with high RMS energy > 0.02
    const denseBuffer = createSyntheticBuffer(sampleRate, 1.0, (t) => 0.4 * Math.sin(2 * Math.PI * 180 * t));
    const rate = estimateSpeechRate(denseBuffer);
    expect(rate).toBe(1.05);
  });

  it('should estimate lower speech rate for sparse audio with pauses', () => {
    // Bursts of sound with lots of silence
    const sparseBuffer = createSyntheticBuffer(sampleRate, 2.0, (t) => {
      return (t % 0.8 < 0.15) ? 0.3 * Math.sin(2 * Math.PI * 180 * t) : 0;
    });
    const rate = estimateSpeechRate(sparseBuffer);
    expect(rate).toBe(0.85);
  });

  it('should extract acoustic formants and spectral centroid from audio buffer', () => {
    // Generate buffer with prominent formants (500 Hz, 1500 Hz, 2500 Hz)
    const buffer = createSyntheticBuffer(sampleRate, 1.0, (t) => {
      return (
        0.5 * Math.sin(2 * Math.PI * 180 * t) +
        0.3 * Math.sin(2 * Math.PI * 500 * t) +
        0.2 * Math.sin(2 * Math.PI * 1500 * t) +
        0.1 * Math.sin(2 * Math.PI * 2500 * t)
      );
    });

    const features = extractAcousticFeatures(buffer);
    expect(features.formants.f1).toBeGreaterThanOrEqual(250);
    expect(features.formants.f1).toBeLessThanOrEqual(900);
    expect(features.formants.f2).toBeGreaterThanOrEqual(900);
    expect(features.formants.f2).toBeLessThanOrEqual(2500);
    expect(features.formants.f3).toBeGreaterThanOrEqual(2000);
    expect(features.spectralCentroidHz).toBeGreaterThan(0);
  });

  it('should extract glottal harmonic overtone series H1-H24', () => {
    const f0 = 160;
    const buffer = createSyntheticBuffer(sampleRate, 0.8, (t) => {
      let sample = 0;
      for (let h = 1; h <= 8; h++) {
        sample += (1 / h) * Math.sin(2 * Math.PI * (f0 * h) * t);
      }
      return sample * 0.2;
    });

    const harmonics = extractGlottalHarmonics(buffer, f0);
    expect(harmonics.length).toBe(24);
    expect(harmonics[0]).toBe(1.0); // H1 normalized to 1.0
    expect(harmonics[1]).toBeGreaterThan(0);
  });

  it('should normalize phrase keys ignoring accents, punctuation and casing', () => {
    expect(normalizePhraseKey('¡Hola, mundo!')).toBe('hola mundo');
    expect(normalizePhraseKey('SÍ, por favor.')).toBe('si por favor');
    expect(normalizePhraseKey('¿Tengo dolor?')).toBe('tengo dolor');
    expect(normalizePhraseKey('Water please!')).toBe('water please');
  });

  it('should find best matching browser voice based on pitch and language', () => {
    const mockVoices = [
      { name: 'Google Spanish Female', lang: 'es-ES', voiceURI: 'es-fem' },
      { name: 'Google Spanish Male', lang: 'es-ES', voiceURI: 'es-male' },
      { name: 'Microsoft David', lang: 'en-US', voiceURI: 'en-david' },
      { name: 'Microsoft Zira', lang: 'en-US', voiceURI: 'en-zira' },
    ] as unknown as SpeechSynthesisVoice[];

    // Low pitch (~110 Hz) in Spanish -> should match male/deep voice
    const matchedMaleEs = findBestMatchingVoice(mockVoices, 110, 'Grave', 'es');
    expect(matchedMaleEs).toBeDefined();
    expect(matchedMaleEs?.lang.startsWith('es')).toBe(true);

    // High pitch (~240 Hz) in English -> should match female/high voice
    const matchedFemEn = findBestMatchingVoice(mockVoices, 240, 'Agudo', 'en');
    expect(matchedFemEn).toBeDefined();
    expect(matchedFemEn?.lang.startsWith('en')).toBe(true);
  });
});

describe('Local Machine Learning Vocal Analysis (LPC & Perturbations)', () => {
  const sampleRate = 44100;

  it('should compute 16th-order LPC coefficients and vocal tract length warp factor via Levinson-Durbin', () => {
    // Generate synthetic vowel-like sound with distinct formants
    const buffer = createSyntheticBuffer(sampleRate, 0.5, (t) => {
      return (
        0.5 * Math.sin(2 * Math.PI * 150 * t) +
        0.3 * Math.sin(2 * Math.PI * 700 * t) +
        0.2 * Math.sin(2 * Math.PI * 1800 * t) +
        0.1 * Math.sin(2 * Math.PI * 2700 * t)
      );
    });

    const lpc = trainLPCModel(buffer, 16);
    expect(lpc.coefficients.length).toBe(16);
    expect(lpc.gain).toBeGreaterThan(0);
    expect(lpc.vtlnWarpFactor).toBeGreaterThan(0.7);
    expect(lpc.vtlnWarpFactor).toBeLessThan(1.4);
    // Formants extracted from spectral envelope
    expect(lpc.formants.f1).toBeGreaterThanOrEqual(300);
    expect(lpc.formants.f2).toBeGreaterThanOrEqual(1000);
  });

  it('should extract micro-jitter and micro-shimmer perturbations within physiological human ranges', () => {
    const f0 = 160;
    // Buffer with small random perturbations
    const buffer = createSyntheticBuffer(sampleRate, 0.6, (t) => {
      const slightJitter = 1 + 0.005 * Math.sin(2 * Math.PI * 7 * t);
      const slightShimmer = 1 + 0.02 * Math.sin(2 * Math.PI * 11 * t);
      return 0.5 * slightShimmer * Math.sin(2 * Math.PI * f0 * slightJitter * t);
    });

    const perturbations = extractJitterAndShimmer(buffer, f0);
    expect(perturbations.jitterPercent).toBeGreaterThanOrEqual(0.1);
    expect(perturbations.jitterPercent).toBeLessThanOrEqual(4.0);
    expect(perturbations.shimmerPercent).toBeGreaterThanOrEqual(0.5);
    expect(perturbations.shimmerPercent).toBeLessThanOrEqual(10.0);
  });
});

describe('Local Natural Language Processing (NLP & G2P)', () => {
  it('should expand numerical tokens and abbreviations in Spanish and English text', () => {
    expect(normalizeTextForNLP('Tengo 2 opciones', 'es')).toContain('dos');
    expect(normalizeTextForNLP('Dr. García', 'es')).toContain('doctor');
    expect(normalizeTextForNLP('I need 1 glass of water', 'en')).toContain('one');
    expect(normalizeTextForNLP('Dr. Smith', 'en')).toContain('doctor');
  });

  it('should convert Spanish text to phonetic sequence with lexical stress and Fujisaki pitch contour', () => {
    const tokens = textToPhoneticSequence('¿Hola, cómo estás?', 'es');
    expect(tokens.length).toBeGreaterThan(0);

    // Phonemes should have duration, pitch, formant target, and stress
    const vowels = tokens.filter(t => t.isVowel);
    expect(vowels.length).toBeGreaterThan(0);

    // Some vowels should have stress: true
    const stressedVowels = vowels.filter(t => t.isStressed);
    expect(stressedVowels.length).toBeGreaterThan(0);

    // Question marks should lead to final boundary rise or higher relative pitch at the end
    const lastVowel = vowels[vowels.length - 1];
    expect(lastVowel).toBeDefined();
    expect(lastVowel.pitchScale).toBeGreaterThanOrEqual(0.85);

    // Each token must have valid acoustic properties
    tokens.forEach(tok => {
      expect(tok.durationMs).toBeGreaterThan(0);
      expect(tok.pitchScale).toBeGreaterThan(0);
      expect(tok.f1).toBeGreaterThan(0);
      expect(tok.f2).toBeGreaterThan(0);
      expect(tok.f3).toBeGreaterThan(0);
    });
  });

  it('should convert English phrases to phonetic sequence with syllabification and coarticulation', () => {
    const tokens = textToPhoneticSequence('Hello, I need help immediately.', 'en');
    expect(tokens.length).toBeGreaterThan(0);

    // Should include both vowels and consonants
    const consonants = tokens.filter(t => !t.isVowel && !t.isPause);
    expect(consonants.length).toBeGreaterThan(0);

    const pauses = tokens.filter(t => t.isPause);
    expect(pauses.length).toBeGreaterThan(0); // Comma and period produce pauses
  });
});

describe('Neural AI Voice Persona Recommendation & Mapping', () => {
  it('should recommend Charon or Fenrir for deep/baritone pitch registers (F0 < 135 Hz)', () => {
    expect(getRecommendedNeuralVoice(105, 'Muy Grave')).toBe('Fenrir');
    expect(getRecommendedNeuralVoice(125, 'Grave')).toBe('Charon');
  });

  it('should recommend Kore for higher/female pitch registers (F0 > 175 Hz)', () => {
    expect(getRecommendedNeuralVoice(210, 'Agudo')).toBe('Kore');
    expect(getRecommendedNeuralVoice(240, 'Alto / High')).toBe('Kore');
  });

  it('should recommend Zephyr or Puck for balanced mid registers (135 - 175 Hz)', () => {
    expect(getRecommendedNeuralVoice(160, 'Medio')).toBe('Zephyr');
    expect(getRecommendedNeuralVoice(145, 'Medio')).toBe('Puck');
  });
});
