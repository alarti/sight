/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isSafeAudioUrl,
  sanitizeUserProfile,
  encryptProfilesPayloadAES,
  decryptProfilesPayloadAES,
  DEFAULT_VOICE_PROFILE,
} from '../profileManager.ts';
import {
  getCircadianGreetingPhrases,
  recordLearnedUserPhrase,
  getAiAutocompleteSuggestion,
} from './predictive.ts';

describe('Security, Privacy & Commercial SaMD Suite Verification', () => {
  it('enforces 100% local ML-LPC engine and cloudNeuralConsent=false by default', () => {
    expect(DEFAULT_VOICE_PROFILE.synthesisEngine).toBe('ml-lpc');
    expect(DEFAULT_VOICE_PROFILE.cloudNeuralConsent).toBe(false);
  });

  it('validates safe local audio Data URLs and blocks remote HTTP/HTTPS exfiltration URLs', () => {
    expect(isSafeAudioUrl('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEA')).toBe(true);
    expect(isSafeAudioUrl('idb://voice-audio/profile-1_recorded')).toBe(true);
    expect(isSafeAudioUrl('https://evil.example.com/exfiltrate.wav')).toBe(false);
    expect(isSafeAudioUrl('javascript:alert(1)')).toBe(false);
  });

  it('sanitizes untrusted profile objects against NaN/Infinity DoS and remote audio injection', () => {
    const maliciousRaw = {
      id: 'prof-test\u0000',
      name: 'Paciente Test',
      sensitivityX: Number.POSITIVE_INFINITY,
      sensitivityY: Number.NaN,
      dwellTimeMs: -9999,
      samples: [
        { targetX: 99999999, targetY: Number.NaN, rawPupilX: 0.4, rawPupilY: 0.6 },
      ],
      voiceProfile: {
        enabled: true,
        recordedAudioUrl: 'https://attacker.com/spy.mp3',
        fundamentalFreqHz: 99999,
        bankedPhrases: [
          { id: '1', phrase: 'Hola', audioUrl: 'http://attacker.com/1.wav', recordedAt: 100 },
          { id: '2', phrase: 'Agua', audioUrl: 'data:audio/wav;base64,AAAA', recordedAt: 200 },
        ],
      },
    };

    const clean = sanitizeUserProfile(maliciousRaw);
    expect(clean).not.toBeNull();
    expect(clean!.id).toBe('prof-test');
    expect(Number.isFinite(clean!.sensitivityX)).toBe(true);
    expect(clean!.sensitivityY).toBe(14.0);
    expect(clean!.dwellTimeMs).toBeGreaterThanOrEqual(350);
    expect(clean!.voiceProfile?.recordedAudioUrl).toBeUndefined();
    expect(clean!.voiceProfile?.fundamentalFreqHz).toBeLessThanOrEqual(450);
    expect(clean!.voiceProfile?.bankedPhrases?.length).toBe(1);
    expect(clean!.voiceProfile?.bankedPhrases?.[0].phrase).toBe('Agua');
  });

  it('encrypts and decrypts clinical profiles using AES-256-GCM + PBKDF2', async () => {
    const sampleProfile = sanitizeUserProfile({
      id: 'profile-aes-1',
      name: 'Alberto Clinical Test',
      language: 'es',
      sensitivityX: 16.5,
      sensitivityY: 18.0,
      samples: [{ targetX: 500, targetY: 400, rawPupilX: 0.5, rawPupilY: 0.5 }],
    })!;

    const encryptedEnvelope = await encryptProfilesPayloadAES([sampleProfile], 'clinical-pin-2026');
    expect(encryptedEnvelope).toContain('AES-256-GCM-PBKDF2');
    expect(encryptedEnvelope).not.toContain('Alberto Clinical Test');

    const restored = await decryptProfilesPayloadAES(encryptedEnvelope, 'clinical-pin-2026');
    expect(restored.length).toBe(1);
    expect(restored[0].name).toBe('Alberto Clinical Test');
    expect(restored[0].sensitivityX).toBe(16.5);
  });

  it('adapts predictive suggestions using circadian time-of-day and learned user phrases', () => {
    const morningEs = getCircadianGreetingPhrases('es', 8);
    expect(morningEs[0]).toContain('Buenos días');

    const nightEn = getCircadianGreetingPhrases('en', 22);
    expect(nightEn[0]).toContain('Good evening');

    let learned: Record<string, number> = {};
    learned = recordLearnedUserPhrase(learned, 'Necesito aspiración de secreciones por favor.');
    learned = recordLearnedUserPhrase(learned, 'Necesito aspiración de secreciones por favor.');

    const suggestion = getAiAutocompleteSuggestion('nece', 'es', learned);
    expect(suggestion).toBe('Necesito aspiración de secreciones por favor.');
  });
});
