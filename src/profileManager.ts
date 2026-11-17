/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CalibrationSample, UserProfile, VoiceProfile } from './types/index.ts';

export type { CalibrationSample, UserProfile, VoiceProfile };

const STORAGE_KEY = 'ela_eye_user_profiles_v1';

export function loadProfiles(): UserProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(p => ({
        ...p,
        sensitivityX: typeof p.sensitivityX === 'number' ? p.sensitivityX : 14.0,
        sensitivityY: typeof p.sensitivityY === 'number' ? p.sensitivityY : 14.0,
        invertY: typeof p.invertY === 'boolean' ? p.invertY : false,
        cursorControlMode: p.cursorControlMode || 'bayesian-lock',
        sensorFusionEnabled: typeof p.sensorFusionEnabled === 'boolean' ? p.sensorFusionEnabled : true,
        samples: Array.isArray(p.samples) ? p.samples : [],
      }));
    }
    return [];
  } catch (e) {
    return [];
  }
}

export function saveProfiles(profiles: UserProfile[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error("Error saving profiles to localStorage:", e);
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
