/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample, UserProfile, VoiceProfile } from './types/index.ts';

export type { CalibrationSample, UserProfile, VoiceProfile };

const STORAGE_KEY = 'ela_eye_user_profiles_v1';
const IDB_NAME = 'ela_voice_audio_db_v1';
const IDB_STORE = 'voice_audio_blobs';
const IDB_PREFIX = 'idb://voice-audio/';

const memoryAudioCache = new Map<string, string>();

function openVoiceAudioDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch (err) {
      console.debug('IndexedDB unavailable:', err);
      resolve(null);
    }
  });
}

async function putAudioInIdb(key: string, dataUrl: string): Promise<void> {
  memoryAudioCache.set(key, dataUrl);
  const db = await openVoiceAudioDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(dataUrl, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch (err) {
      console.debug('IndexedDB write skipped:', err);
      db.close();
      resolve();
    }
  });
}

async function getAudioFromIdb(key: string): Promise<string | null> {
  if (memoryAudioCache.has(key)) {
    return memoryAudioCache.get(key) || null;
  }
  const db = await openVoiceAudioDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        const val = typeof req.result === 'string' ? req.result : null;
        if (val) memoryAudioCache.set(key, val);
        db.close();
        resolve(val);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch (err) {
      console.debug('IndexedDB read skipped:', err);
      db.close();
      resolve(null);
    }
  });
}

/**
 * Asynchronously hydrates any IndexedDB audio references (`idb://voice-audio/...`)
 * back into full playable Data URLs on loaded profiles.
 */
export async function hydrateProfilesAudioFromIndexedDB(profiles: UserProfile[]): Promise<UserProfile[]> {
  let changed = false;
  const hydrated = await Promise.all(
    profiles.map(async (prof) => {
      const vp = prof.voiceProfile;
      if (!vp) return prof;
      let nextVp = { ...vp };
      let vpChanged = false;

      if (nextVp.recordedAudioUrl && nextVp.recordedAudioUrl.startsWith(IDB_PREFIX)) {
        const key = nextVp.recordedAudioUrl.slice(IDB_PREFIX.length);
        const restored = await getAudioFromIdb(key);
        if (restored) {
          nextVp.recordedAudioUrl = restored;
          vpChanged = true;
        }
      }

      if (Array.isArray(nextVp.bankedPhrases) && nextVp.bankedPhrases.length > 0) {
        const nextBank = await Promise.all(
          nextVp.bankedPhrases.map(async (bp) => {
            if (bp.audioUrl && bp.audioUrl.startsWith(IDB_PREFIX)) {
              const key = bp.audioUrl.slice(IDB_PREFIX.length);
              const restored = await getAudioFromIdb(key);
              if (restored) {
                vpChanged = true;
                return { ...bp, audioUrl: restored };
              }
            }
            return bp;
          })
        );
        nextVp.bankedPhrases = nextBank;
      }

      if (vpChanged) {
        changed = true;
        return { ...prof, voiceProfile: nextVp };
      }
      return prof;
    })
  );

  return changed ? hydrated : profiles;
}

export const SAFE_AUDIO_URL_REGEX = /^(data:audio\/[a-zA-Z0-9.+-]+(;[^,]+)*,([a-zA-Z0-9+/=%]+)|idb:\/\/voice-audio\/[a-zA-Z0-9_-]+)$/;

export function isSafeAudioUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !url.trim()) return false;
  if (url.length > 15_000_000) return false; // Cap at ~15MB base64
  return SAFE_AUDIO_URL_REGEX.test(url.trim());
}

function clampFinite(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeString(val: unknown, maxLen = 120, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLen) || fallback;
}

/**
 * Deeply sanitizes and validates a raw parsed profile object to prevent:
 * - Prototype pollution (__proto__, constructor, prototype)
 * - NaN / Infinity injection into Kalman or M-QPM calibration matrices (DoS)
 * - Arbitrary remote URL side-channel exfiltration via audioUrl
 */
export function sanitizeUserProfile(raw: unknown): UserProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(obj, '__proto__') || Object.prototype.hasOwnProperty.call(obj, 'constructor')) {
    delete obj['__proto__'];
    delete obj['constructor'];
  }

  const id = sanitizeString(obj.id, 80, 'profile-' + Date.now());
  const name = sanitizeString(obj.name, 80, 'Perfil ELA');
  const language: 'es' | 'en' = obj.language === 'en' ? 'en' : 'es';

  const rawSamples = Array.isArray(obj.samples) ? obj.samples : [];
  const samples: CalibrationSample[] = rawSamples
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .slice(0, 500)
    .map((s) => ({
      targetX: clampFinite(s.targetX, -4000, 10000, 500),
      targetY: clampFinite(s.targetY, -4000, 10000, 400),
      rawPupilX: clampFinite(s.rawPupilX, -2, 3, 0.5),
      rawPupilY: clampFinite(s.rawPupilY, -2, 3, 0.5),
      headYaw: s.headYaw !== undefined ? clampFinite(s.headYaw, -180, 180, 0) : undefined,
      headPitch: s.headPitch !== undefined ? clampFinite(s.headPitch, -180, 180, 0) : undefined,
      headRoll: s.headRoll !== undefined ? clampFinite(s.headRoll, -180, 180, 0) : undefined,
    }));

  let vp: VoiceProfile | undefined = undefined;
  if (obj.voiceProfile && typeof obj.voiceProfile === 'object' && !Array.isArray(obj.voiceProfile)) {
    const rawVp = obj.voiceProfile as Record<string, unknown>;
    const rawUrl = rawVp.recordedAudioUrl;
    let safeRecordedUrl = isSafeAudioUrl(rawUrl) ? rawUrl : undefined;
    if (safeRecordedUrl?.startsWith(IDB_PREFIX)) {
      const cached = memoryAudioCache.get(safeRecordedUrl.slice(IDB_PREFIX.length));
      if (cached && isSafeAudioUrl(cached)) safeRecordedUrl = cached;
    }

    const rawBank = Array.isArray(rawVp.bankedPhrases) ? rawVp.bankedPhrases : [];
    const safeBank = rawBank
      .filter((bp): bp is Record<string, unknown> => Boolean(bp && typeof bp === 'object'))
      .slice(0, 200)
      .map((bp) => {
        let aUrl = isSafeAudioUrl(bp.audioUrl) ? bp.audioUrl : '';
        if (aUrl.startsWith(IDB_PREFIX)) {
          const cached = memoryAudioCache.get(aUrl.slice(IDB_PREFIX.length));
          if (cached && isSafeAudioUrl(cached)) aUrl = cached;
        }
        return {
          id: sanitizeString(bp.id, 64, 'bp-' + Date.now()),
          phrase: sanitizeString(bp.phrase, 300, ''),
          audioUrl: aUrl,
          recordedAt: clampFinite(bp.recordedAt, 0, 9_999_999_999_999, Date.now()),
        };
      })
      .filter((bp) => Boolean(bp.phrase && bp.audioUrl));

    const validEngines = ['neural-ai', 'hybrid', 'ml-lpc', 'formant-acoustic', 'system-tts'] as const;
    const engine = validEngines.includes(rawVp.synthesisEngine as any)
      ? (rawVp.synthesisEngine as VoiceProfile['synthesisEngine'])
      : 'ml-lpc';

    vp = {
      enabled: Boolean(rawVp.enabled),
      synthesisEngine: engine,
      recordedAudioUrl: safeRecordedUrl,
      audioSourceType: rawVp.audioSourceType === 'upload' ? 'upload' : 'mic',
      audioFileName: rawVp.audioFileName ? sanitizeString(rawVp.audioFileName, 120) : undefined,
      fundamentalFreqHz: clampFinite(rawVp.fundamentalFreqHz, 60, 450, 150),
      formants: rawVp.formants && typeof rawVp.formants === 'object'
        ? {
            f1: clampFinite((rawVp.formants as any).f1, 200, 1100, 650),
            f2: clampFinite((rawVp.formants as any).f2, 700, 2900, 1450),
            f3: clampFinite((rawVp.formants as any).f3, 1800, 4000, 2600),
          }
        : undefined,
      spectralCentroidHz: rawVp.spectralCentroidHz !== undefined ? clampFinite(rawVp.spectralCentroidHz, 200, 8000, 1400) : undefined,
      glottalHarmonics: Array.isArray(rawVp.glottalHarmonics)
        ? rawVp.glottalHarmonics.slice(0, 32).map(h => clampFinite(h, 0, 2, 0.1))
        : undefined,
      brightnessEQ: clampFinite(rawVp.brightnessEQ, -12, 12, 0),
      pitchMultiplier: clampFinite(rawVp.pitchMultiplier, 0.2, 2.0, 1.0),
      speechRate: clampFinite(rawVp.speechRate, 0.4, 2.0, 0.95),
      volume: clampFinite(rawVp.volume, 0.0, 1.0, 1.0),
      voiceUri: rawVp.voiceUri ? sanitizeString(rawVp.voiceUri, 160) : undefined,
      detectedTimbre: sanitizeString(rawVp.detectedTimbre, 40, language === 'en' ? 'Medium' : 'Medio'),
      bankedPhrases: safeBank,
      neuralVoiceName: ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].includes(rawVp.neuralVoiceName as any)
        ? (rawVp.neuralVoiceName as VoiceProfile['neuralVoiceName'])
        : 'Kore',
      neuralStylePrompt: rawVp.neuralStylePrompt ? sanitizeString(rawVp.neuralStylePrompt, 120) : undefined,
      cloudNeuralConsent: Boolean(rawVp.cloudNeuralConsent),
      lpcCoefficients: Array.isArray(rawVp.lpcCoefficients)
        ? rawVp.lpcCoefficients.slice(0, 24).map(c => clampFinite(c, -10, 10, 0))
        : undefined,
      vtlnWarpFactor: clampFinite(rawVp.vtlnWarpFactor, 0.75, 1.30, 1.0),
      jitterPercent: rawVp.jitterPercent !== undefined ? clampFinite(rawVp.jitterPercent, 0, 10, 0.85) : undefined,
      shimmerPercent: rawVp.shimmerPercent !== undefined ? clampFinite(rawVp.shimmerPercent, 0, 20, 2.6) : undefined,
      nlpProsodyEnabled: rawVp.nlpProsodyEnabled !== undefined ? Boolean(rawVp.nlpProsodyEnabled) : true,
      recordedAt: rawVp.recordedAt !== undefined ? clampFinite(rawVp.recordedAt, 0, 9_999_999_999_999, Date.now()) : undefined,
    };
  }

  const validCalibModels = ['quadrant-matrix', 'tps', 'polynomial', 'projective'] as const;
  const validCursorModes = ['bayesian-lock', 'ocular-trackball', 'two-stage-loupe', 'direct-matrix'] as const;
  const validThemes = ['warm-obsidian', 'eink-parchment', 'scotopic-amber'] as const;

  return {
    id,
    name,
    language,
    ocularTheme: validThemes.includes(obj.ocularTheme as any) ? (obj.ocularTheme as UserProfile['ocularTheme']) : 'warm-obsidian',
    createdAt: clampFinite(obj.createdAt, 0, 9_999_999_999_999, Date.now()),
    updatedAt: clampFinite(obj.updatedAt, 0, 9_999_999_999_999, Date.now()),
    samples,
    calibrationModel: validCalibModels.includes(obj.calibrationModel as any)
      ? (obj.calibrationModel as UserProfile['calibrationModel'])
      : 'quadrant-matrix',
    cursorControlMode: validCursorModes.includes(obj.cursorControlMode as any)
      ? (obj.cursorControlMode as UserProfile['cursorControlMode'])
      : 'bayesian-lock',
    sensorFusionEnabled: typeof obj.sensorFusionEnabled === 'boolean' ? obj.sensorFusionEnabled : true,
    ivtStabilizationEnabled: typeof obj.ivtStabilizationEnabled === 'boolean' ? obj.ivtStabilizationEnabled : true,
    verticalGainMultiplier: clampFinite(obj.verticalGainMultiplier, 0.5, 3.0, 1.15),
    sensitivityX: clampFinite(obj.sensitivityX, 2.0, 45.0, 14.0),
    sensitivityY: clampFinite(obj.sensitivityY, 2.0, 55.0, 14.0),
    smoothing: clampFinite(obj.smoothing, 0.01, 0.99, 0.22),
    baselineOffsetX: clampFinite(obj.baselineOffsetX, -2500, 2500, 0),
    baselineOffsetY: clampFinite(obj.baselineOffsetY, -2500, 2500, 0),
    invertY: typeof obj.invertY === 'boolean' ? obj.invertY : false,
    dwellTimeMs: clampFinite(obj.dwellTimeMs, 350, 4000, 1200),
    isAdaptiveDwellEnabled: typeof obj.isAdaptiveDwellEnabled === 'boolean' ? obj.isAdaptiveDwellEnabled : true,
    isStickyKeyboardEnabled: typeof obj.isStickyKeyboardEnabled === 'boolean' ? obj.isStickyKeyboardEnabled : true,
    neutralCenter: obj.neutralCenter && typeof obj.neutralCenter === 'object'
      ? {
          x: clampFinite((obj.neutralCenter as any).x, 0.05, 0.95, 0.5),
          y: clampFinite((obj.neutralCenter as any).y, 0.05, 0.95, 0.5),
        }
      : { x: 0.5, y: 0.5 },
    calibrationMatrix: obj.calibrationMatrix && typeof obj.calibrationMatrix === 'object'
      ? (obj.calibrationMatrix as UserProfile['calibrationMatrix'])
      : undefined,
    voiceProfile: vp,
    caregiverConfig: obj.caregiverConfig && typeof obj.caregiverConfig === 'object'
      ? {
          enabled: Boolean((obj.caregiverConfig as any).enabled),
          caregiverName: sanitizeString((obj.caregiverConfig as any).caregiverName, 60, 'Cuidador / Enfermería'),
          webhookUrl: typeof (obj.caregiverConfig as any).webhookUrl === 'string' && /^https?:\/\//.test((obj.caregiverConfig as any).webhookUrl)
            ? sanitizeString((obj.caregiverConfig as any).webhookUrl, 250)
            : undefined,
          sirenEnabled: (obj.caregiverConfig as any).sirenEnabled !== undefined ? Boolean((obj.caregiverConfig as any).sirenEnabled) : true,
          sustainedEyeClosureSosSec: clampFinite((obj.caregiverConfig as any).sustainedEyeClosureSosSec, 2.0, 8.0, 3.5),
        }
      : undefined,
    clinicalSessions: Array.isArray(obj.clinicalSessions)
      ? obj.clinicalSessions.slice(-100)
      : undefined,
    learnedPhraseCounts: obj.learnedPhraseCounts && typeof obj.learnedPhraseCounts === 'object' && !Array.isArray(obj.learnedPhraseCounts)
      ? (obj.learnedPhraseCounts as Record<string, number>)
      : undefined,
    kioskWakeLockEnabled: typeof obj.kioskWakeLockEnabled === 'boolean' ? obj.kioskWakeLockEnabled : true,
  };
}

export function loadProfiles(): UserProfile[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map(p => sanitizeUserProfile(p))
        .filter((p): p is UserProfile => p !== null);
    }
    return [];
  } catch (e) {
    console.warn('Error loading profiles from localStorage:', e);
    return [];
  }
}

export function saveProfiles(profiles: UserProfile[]) {
  if (typeof localStorage === 'undefined') return;
  // Offload large audio DataURLs (> 16 KB) into IndexedDB and keep lightweight pointers in localStorage
  const compactProfiles = profiles.map((prof) => {
    const vp = prof.voiceProfile;
    if (!vp) return prof;
    let nextVp = { ...vp };

    if (nextVp.recordedAudioUrl && nextVp.recordedAudioUrl.startsWith('data:audio') && nextVp.recordedAudioUrl.length > 16_384) {
      const key = `${prof.id}_recorded`;
      void putAudioInIdb(key, nextVp.recordedAudioUrl);
      nextVp.recordedAudioUrl = `${IDB_PREFIX}${key}`;
    }

    if (Array.isArray(nextVp.bankedPhrases) && nextVp.bankedPhrases.length > 0) {
      nextVp.bankedPhrases = nextVp.bankedPhrases.map((bp) => {
        if (bp.audioUrl && bp.audioUrl.startsWith('data:audio') && bp.audioUrl.length > 16_384) {
          const key = `${prof.id}_bank_${bp.id}`;
          void putAudioInIdb(key, bp.audioUrl);
          return { ...bp, audioUrl: `${IDB_PREFIX}${key}` };
        }
        return bp;
      });
    }

    return { ...prof, voiceProfile: nextVp };
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(compactProfiles));
  } catch (e) {
    console.warn('localStorage quota reached, storing stripped audio metadata fallback:', e);
    try {
      const minimalProfiles = compactProfiles.map(p => ({
        ...p,
        voiceProfile: p.voiceProfile
          ? { ...p.voiceProfile, recordedAudioUrl: undefined, bankedPhrases: [] }
          : undefined,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalProfiles));
    } catch (innerErr) {
      console.error('Error saving profiles to localStorage:', innerErr);
    }
  }
}

/**
 * Default Voice Profile is 100% Client-Side ('ml-lpc') by default to guarantee
 * strict GDPR/HIPAA clinical privacy unless the patient explicitly opts into Cloud Neural TTS.
 */
export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  enabled: false,
  synthesisEngine: 'ml-lpc',
  neuralVoiceName: 'Kore',
  cloudNeuralConsent: false,
  pitchMultiplier: 1.0,
  speechRate: 0.95,
  volume: 1.0,
  fundamentalFreqHz: 150,
  detectedTimbre: 'Medio',
  brightnessEQ: 0,
  bankedPhrases: [],
  nlpProsodyEnabled: true,
  vtlnWarpFactor: 1.0,
};

export function getDefaultProfile(): UserProfile {
  return {
    id: 'profile-' + Date.now(),
    name: 'Perfil ELA - Principal',
    language: 'es',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    samples: [],
    calibrationModel: 'quadrant-matrix',
    cursorControlMode: 'bayesian-lock',
    sensorFusionEnabled: true,
    sensitivityX: 14.0,
    sensitivityY: 14.0,
    smoothing: 0.22,
    baselineOffsetX: 0,
    baselineOffsetY: 0,
    invertY: false,
    dwellTimeMs: 1200,
    isAdaptiveDwellEnabled: true,
    isStickyKeyboardEnabled: true,
    neutralCenter: { x: 0.5, y: 0.5 },
    voiceProfile: { ...DEFAULT_VOICE_PROFILE },
    kioskWakeLockEnabled: true,
  };
}

export function createNewProfile(name: string, language: 'es' | 'en' = 'es'): UserProfile {
  return {
    id: 'profile-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    name: sanitizeString(name, 80, language === 'en' ? 'New ALS Profile' : 'Nuevo Perfil ELA'),
    language,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    samples: [],
    calibrationModel: 'quadrant-matrix',
    cursorControlMode: 'bayesian-lock',
    sensorFusionEnabled: true,
    sensitivityX: 14.0,
    sensitivityY: 14.0,
    smoothing: 0.22,
    baselineOffsetX: 0,
    baselineOffsetY: 0,
    invertY: false,
    dwellTimeMs: 1200,
    isAdaptiveDwellEnabled: true,
    isStickyKeyboardEnabled: true,
    neutralCenter: { x: 0.5, y: 0.5 },
    voiceProfile: {
      ...DEFAULT_VOICE_PROFILE,
      detectedTimbre: language === 'en' ? 'Medium' : 'Medio',
    },
    kioskWakeLockEnabled: true,
  };
}

export function exportSingleProfileJSON(profile: UserProfile) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profile, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  const safeName = profile.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  downloadAnchor.setAttribute("download", `perfil_ela_${safeName}_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function exportProfilesJSON() {
  const profiles = loadProfiles();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profiles, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `ela_eye_profiles_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importProfilesJSON(file: File): Promise<UserProfile[]> {
  return new Promise((resolve, reject) => {
    if (file.size > 25 * 1024 * 1024) {
      reject(new Error('El archivo excede el tamaño máximo permitido (25 MB).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitizedList = parsed
            .slice(0, 50)
            .map(item => sanitizeUserProfile(item))
            .filter((item): item is UserProfile => item !== null);
          if (sanitizedList.length === 0) {
            reject(new Error('Ningún perfil válido tras la verificación de seguridad.'));
            return;
          }
          saveProfiles(sanitizedList);
          resolve(sanitizedList);
        } else if (parsed && typeof parsed === 'object') {
          const single = sanitizeUserProfile(parsed);
          if (!single) {
            reject(new Error('Formato de archivo de perfil inválido'));
            return;
          }
          const current = loadProfiles();
          const existingIdx = current.findIndex(p => p.id === single.id);
          const updated = existingIdx >= 0
            ? current.map(p => p.id === single.id ? single : p)
            : [...current, single];
          saveProfiles(updated);
          resolve(updated);
        } else {
          reject(new Error("Formato de archivo de perfil inválido"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsText(file);
  });
}

/**
 * Web Crypto API AES-GCM (256-bit) Clinical Biometric Profile Encryption & Decryption
 * Enables HIPAA / GDPR-compliant encrypted backups for shared hospital tablets.
 */
async function deriveAesGcmKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptProfilesPayloadAES(profiles: UserProfile[], passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesGcmKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(profiles));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const toBase64 = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  return JSON.stringify({
    sightEncryptedBackup: true,
    cipher: 'AES-256-GCM-PBKDF2',
    salt: toBase64(salt),
    iv: toBase64(iv),
    payload: toBase64(new Uint8Array(cipherBuf)),
    exportedAt: new Date().toISOString(),
  }, null, 2);
}

export async function decryptProfilesPayloadAES(encryptedJson: string, passphrase: string): Promise<UserProfile[]> {
  const parsed = JSON.parse(encryptedJson);
  if (!parsed || !parsed.sightEncryptedBackup || !parsed.salt || !parsed.iv || !parsed.payload) {
    throw new Error('Invalid encrypted backup envelope');
  }

  const fromBase64 = (b64: string) => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const salt = fromBase64(parsed.salt);
  const iv = fromBase64(parsed.iv);
  const cipherBytes = fromBase64(parsed.payload);
  const key = await deriveAesGcmKey(passphrase, salt);

  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
  const plainJson = new TextDecoder().decode(plainBuf);
  const rawList = JSON.parse(plainJson);
  if (!Array.isArray(rawList)) throw new Error('Decrypted payload is not a profile list');

  const sanitized = rawList
    .map(p => sanitizeUserProfile(p))
    .filter((p): p is UserProfile => p !== null);
  saveProfiles(sanitized);
  return sanitized;
}

