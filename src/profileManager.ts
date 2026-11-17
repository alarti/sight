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

export function loadProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(p => {
        const vp = p.voiceProfile ? { ...p.voiceProfile } : undefined;
        if (vp?.recordedAudioUrl?.startsWith(IDB_PREFIX)) {
          const cached = memoryAudioCache.get(vp.recordedAudioUrl.slice(IDB_PREFIX.length));
          if (cached) vp.recordedAudioUrl = cached;
        }
        if (vp && Array.isArray(vp.bankedPhrases)) {
          vp.bankedPhrases = vp.bankedPhrases.map((bp: { id: string; phrase: string; audioUrl: string; recordedAt: number }) => {
            if (bp.audioUrl?.startsWith(IDB_PREFIX)) {
              const cached = memoryAudioCache.get(bp.audioUrl.slice(IDB_PREFIX.length));
              if (cached) return { ...bp, audioUrl: cached };
            }
            return bp;
          });
        }
        return {
          ...p,
          sensitivityX: typeof p.sensitivityX === 'number' ? p.sensitivityX : 14.0,
          sensitivityY: typeof p.sensitivityY === 'number' ? p.sensitivityY : 14.0,
          invertY: typeof p.invertY === 'boolean' ? p.invertY : false,
          dwellTimeMs: typeof p.dwellTimeMs === 'number' ? p.dwellTimeMs : 1200,
          isAdaptiveDwellEnabled: typeof p.isAdaptiveDwellEnabled === 'boolean' ? p.isAdaptiveDwellEnabled : true,
          isStickyKeyboardEnabled: typeof p.isStickyKeyboardEnabled === 'boolean' ? p.isStickyKeyboardEnabled : true,
          cursorControlMode: p.cursorControlMode || 'bayesian-lock',
          sensorFusionEnabled: typeof p.sensorFusionEnabled === 'boolean' ? p.sensorFusionEnabled : true,
          samples: Array.isArray(p.samples) ? p.samples : [],
          voiceProfile: vp,
        };
      });
    }
    return [];
  } catch (e) {
    console.warn('Error loading profiles from localStorage:', e);
    return [];
  }
}

export function saveProfiles(profiles: UserProfile[]) {
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

export const DEFAULT_VOICE_PROFILE: VoiceProfile = {
  enabled: false,
  synthesisEngine: 'neural-ai',
  neuralVoiceName: 'Kore',
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
  };
}

export function createNewProfile(name: string, language: 'es' | 'en' = 'es'): UserProfile {
  return {
    id: 'profile-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    name: name.trim() || (language === 'en' ? 'New ALS Profile' : 'Nuevo Perfil ELA'),
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
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          saveProfiles(parsed);
          resolve(parsed);
        } else if (parsed && typeof parsed === 'object' && parsed.id && parsed.name) {
          const current = loadProfiles();
          const existingIdx = current.findIndex(p => p.id === parsed.id);
          let updated: UserProfile[];
          if (existingIdx >= 0) {
            updated = current.map(p => p.id === parsed.id ? parsed : p);
          } else {
            updated = [...current, parsed];
          }
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
