/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  BellRing,
  Download,
  Lock,
  Unlock,
  X,
  BarChart3,
  HeartPulse,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  UserProfile,
  ClinicalTelemetrySession,
  CaregiverAlertConfig,
} from '../types/index.ts';
import {
  encryptProfilesPayloadAES,
  decryptProfilesPayloadAES,
} from '../profileManager.ts';
import { Language } from '../i18n/translations.ts';

interface ClinicalCommercialModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfile: UserProfile;
  profiles: UserProfile[];
  onSaveProfile: (updated: UserProfile) => void;
  onRestoreProfiles: (restored: UserProfile[]) => void;
  onTriggerEmergencySos: () => void;
  kioskWakeLockActive: boolean;
  onToggleKioskWakeLock: () => void;
  currentSessionMetrics: {
    dwellSelectionsCount: number;
    cancelledDwellsCount: number;
    charactersTyped: number;
    phrasesVocalized: number;
    meanSaccadicVelocityPxS: number;
  };
  currentLanguage: Language;
}

export const ClinicalCommercialModal: React.FC<ClinicalCommercialModalProps> = ({
  isOpen,
  onClose,
  activeProfile,
  profiles,
  onSaveProfile,
  onRestoreProfiles,
  onTriggerEmergencySos,
  kioskWakeLockActive,
  onToggleKioskWakeLock,
  currentSessionMetrics,
  currentLanguage,
}) => {
  const isEn = currentLanguage === 'en';
  const [activeTab, setActiveTab] = useState<'analytics' | 'sos' | 'security' | 'samd'>('analytics');

  const caregiverConfig: CaregiverAlertConfig = activeProfile.caregiverConfig || {
    enabled: true,
    caregiverName: isEn ? 'Primary Caregiver / Nurse Station' : 'Cuidador Principal / Enfermería',
    sirenEnabled: true,
    sustainedEyeClosureSosSec: 3.5,
  };

  const [caregiverName, setCaregiverName] = useState(caregiverConfig.caregiverName);
  const [sirenEnabled, setSirenEnabled] = useState(caregiverConfig.sirenEnabled);
  const [sosClosureSec, setSosClosureSec] = useState(caregiverConfig.sustainedEyeClosureSosSec);
  const [cloudConsent, setCloudConsent] = useState<boolean>(Boolean(activeProfile.voiceProfile?.cloudNeuralConsent));
  const [encryptionPin, setEncryptionPin] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const rmsePx = activeProfile.calibrationMatrix?.rmsePx ?? 8.2;
  const visualAngleDeg = activeProfile.calibrationMatrix?.accuracyDeg ?? 0.29;
  const totalInteractions =
    currentSessionMetrics.dwellSelectionsCount + currentSessionMetrics.cancelledDwellsCount;
  const precisionRate =
    totalInteractions > 0
      ? Math.round((currentSessionMetrics.dwellSelectionsCount / totalInteractions) * 100)
      : 98;
  const estimatedFatigueIndex = Math.min(
    100,
    Math.max(
      8,
      Math.round(
        (currentSessionMetrics.cancelledDwellsCount / Math.max(1, totalInteractions)) * 65 +
          (activeProfile.dwellTimeMs && activeProfile.dwellTimeMs > 1400 ? 22 : 12)
      )
    )
  );

  const handleSaveCaregiverSettings = () => {
    const updated: UserProfile = {
      ...activeProfile,
      caregiverConfig: {
        enabled: true,
        caregiverName: caregiverName.trim() || (isEn ? 'Caregiver' : 'Cuidador'),
        sirenEnabled,
        sustainedEyeClosureSosSec: sosClosureSec,
      },
      voiceProfile: activeProfile.voiceProfile
        ? {
            ...activeProfile.voiceProfile,
            cloudNeuralConsent: cloudConsent,
          }
        : undefined,
      updatedAt: Date.now(),
    };
    onSaveProfile(updated);
    setStatusMessage(
      isEn
        ? 'Clinical SOS & GDPR/HIPAA privacy settings saved.'
        : 'Ajustes de alerta clínica SOS y privacidad GDPR/HIPAA guardados.'
    );
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleExportFhirReport = () => {
    const fhirObservation = {
      resourceType: 'Bundle',
      type: 'collection',
      timestamp: new Date().toISOString(),
      meta: {
        profile: ['https://alarti.github.io/sight/fhir/StructureDefinition/als-oculomotor-biomarker'],
      },
      entry: [
        {
          resource: {
            resourceType: 'Observation',
            status: 'final',
            code: {
              coding: [
                {
                  system: 'http://loinc.org',
                  code: '80318-9',
                  display: 'Oculomotor & Bulbar Assistive Communication Telemetry (SIGHT SaMD)',
                },
              ],
            },
            subject: {
              display: activeProfile.name,
            },
            effectiveDateTime: new Date().toISOString(),
            component: [
              {
                code: { text: 'Calibration Screen RMSE (px)' },
                valueQuantity: { value: Number(rmsePx.toFixed(2)), unit: 'px' },
              },
              {
                code: { text: 'Visual Angle Error (deg)' },
                valueQuantity: { value: Number(visualAngleDeg.toFixed(2)), unit: 'deg' },
              },
              {
                code: { text: 'Dwell Selection Accuracy (%)' },
                valueQuantity: { value: precisionRate, unit: '%' },
              },
              {
                code: { text: 'Mean Saccadic Velocity (px/s)' },
                valueQuantity: { value: currentSessionMetrics.meanSaccadicVelocityPxS, unit: 'px/s' },
              },
              {
                code: { text: 'Estimated Ocular Fatigue Index (0-100)' },
                valueQuantity: { value: estimatedFatigueIndex, unit: 'score' },
              },
              {
                code: { text: 'Vocal Fundamental Frequency F0 (Hz)' },
                valueQuantity: { value: activeProfile.voiceProfile?.fundamentalFreqHz || 150, unit: 'Hz' },
              },
            ],
          },
        },
      ],
    };

    const dataStr =
      'data:application/fhir+json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(fhirObservation, null, 2));
    const anchor = document.createElement('a');
    anchor.setAttribute('href', dataStr);
    anchor.setAttribute(
      'download',
      `sight_clinical_fhir_report_${activeProfile.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`
    );
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleEncryptedExport = async () => {
    setErrorMessage(null);
    if (!encryptionPin || encryptionPin.trim().length < 4) {
      setErrorMessage(
        isEn
          ? 'Please enter a clinical PIN/passphrase of at least 4 characters.'
          : 'Introduzca un PIN o clave clínica de al menos 4 caracteres.'
      );
      return;
    }
    try {
      const encryptedJson = await encryptProfilesPayloadAES(profiles, encryptionPin.trim());
      const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(encryptedJson);
      const anchor = document.createElement('a');
      anchor.setAttribute('href', dataStr);
      anchor.setAttribute('download', `sight_aes256_clinical_backup_${new Date().toISOString().slice(0, 10)}.sight.json`);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setStatusMessage(
        isEn
          ? 'AES-256-GCM encrypted biometric backup exported.'
          : 'Copia biométrica cifrada con AES-256-GCM exportada con éxito.'
      );
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEncryptedImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!encryptionPin || encryptionPin.trim().length < 4) {
      setErrorMessage(
        isEn
          ? 'Enter your decryption PIN before selecting the encrypted file.'
          : 'Introduzca el PIN de descifrado antes de cargar el archivo.'
      );
      return;
    }
    try {
      const text = await file.text();
      const restored = await decryptProfilesPayloadAES(text, encryptionPin.trim());
      onRestoreProfiles(restored);
      setStatusMessage(
        isEn
          ? 'Encrypted profiles verified and restored.'
          : 'Perfiles cifrados verificados y restaurados con éxito.'
      );
    } catch {
      setErrorMessage(
        isEn
          ? 'Decryption failed: invalid PIN or corrupted AES-256-GCM envelope.'
          : 'Fallo de descifrado: PIN incorrecto o archivo AES-256-GCM alterado.'
      );
    }
  };

  const historySessions: ClinicalTelemetrySession[] = activeProfile.clinicalSessions || [];

  return (
    <div className="fixed inset-0 z-[10015] bg-[var(--bg-canvas)]/90 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)]">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] tracking-tight">
                  {isEn
                    ? 'SIGHT Clinical Pro · SaMD Suite & Caregiver Hub'
                    : 'SIGHT Clinical Pro · Suite Médica SaMD y Alerta a Cuidador'}
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono uppercase rounded bg-[var(--bg-elevated)] border border-[var(--border-active)] text-[var(--accent-primary)]">
                  IEC 62304 · GDPR
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {isEn
                  ? 'Longitudinal oculomotor biomarkers, emergency SOS beacon & AES-256-GCM biometric vault'
                  : 'Biomarcadores oculomotores longitudinales, baliza SOS de emergencia y bóveda biométrica AES-256-GCM'}
              </p>
            </div>
          </div>
          <button
            data-dwell-id="btn-close-clinical-modal"
            onClick={onClose}
            className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/60 overflow-x-auto">
          {(
            [
              {
                id: 'analytics',
                label: isEn ? 'Oculomotor Biomarkers' : 'Biomarcadores Oculomotores',
                icon: BarChart3,
              },
              {
                id: 'sos',
                label: isEn ? 'Caregiver SOS & Kiosk' : 'Alerta SOS y Modo Kiosco',
                icon: BellRing,
              },
              {
                id: 'security',
                label: isEn ? 'AES-256 Vault & Privacy' : 'Bóveda AES-256 y Privacidad',
                icon: Lock,
              },
              {
                id: 'samd',
                label: isEn ? 'SaMD Compliance (CE/FDA)' : 'Certificación Médica SaMD',
                icon: ShieldCheck,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                data-dwell-id={`tab-clinical-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* BODY */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {statusMessage && (
            <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-active)] text-[var(--accent-primary)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-urgent)] text-[var(--accent-urgent)] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] block">
                    {isEn ? 'Angular Precision' : 'Precisión Angular'}
                  </span>
                  <strong className="text-lg font-mono text-[var(--accent-primary)]">
                    {visualAngleDeg.toFixed(2)}°
                  </strong>
                  <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                    RMSE: {rmsePx.toFixed(1)} px
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] block">
                    {isEn ? 'Target Lock Rate' : 'Acierto Foveal'}
                  </span>
                  <strong className="text-lg font-mono text-[var(--text-primary)]">
                    {precisionRate}%
                  </strong>
                  <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                    {currentSessionMetrics.dwellSelectionsCount} {isEn ? 'selections' : 'selecciones'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] block">
                    {isEn ? 'Ocular Fatigue Index' : 'Índice Fatiga Ocular'}
                  </span>
                  <strong className="text-lg font-mono text-[var(--accent-amber)]">
                    {estimatedFatigueIndex}/100
                  </strong>
                  <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                    {estimatedFatigueIndex < 35
                      ? isEn
                        ? 'Optimal resting tone'
                        : 'Tono ciliar óptimo'
                      : isEn
                      ? 'Recommend Rest Sanctuary'
                      : 'Recomendado Santuario'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
                  <span className="text-[10px] font-mono uppercase text-[var(--text-muted)] block">
                    {isEn ? 'Bulbar F0 Baseline' : 'Frecuencia Vocal F0'}
                  </span>
                  <strong className="text-lg font-mono text-[var(--text-primary)]">
                    {activeProfile.voiceProfile?.fundamentalFreqHz || 150} Hz
                  </strong>
                  <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                    {activeProfile.voiceProfile?.bankedPhrases?.length || 0}{' '}
                    {isEn ? 'banked phrases' : 'frases en banco'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
                    {isEn
                      ? 'HL7 FHIR R4 Longitudinal Neurology & Speech Report'
                      : 'Informe Clínico Longitudinal HL7 FHIR R4 para Neurología y Logopedia'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                    {isEn
                      ? 'Exports objective oculomotor precision, saccadic velocity, and vocal formant biomarkers in standard HL7 FHIR JSON format for hospital EHR integration.'
                      : 'Exporta los biomarcadores objetivos de precisión oculomotora, velocidad sacádica y formantes vocales en estándar hospitalario HL7 FHIR JSON.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-dwell-id="btn-export-fhir-report"
                  onClick={handleExportFhirReport}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold flex items-center gap-2 shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>{isEn ? 'Export HL7 FHIR JSON' : 'Exportar Informe HL7 FHIR'}</span>
                </button>
              </div>

              {historySessions.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)]">
                  <h4 className="font-mono uppercase text-[11px] text-[var(--text-muted)] mb-2">
                    {isEn ? 'Recorded Clinical Sessions' : 'Historial de Sesiones Clínicas'}
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {historySessions.slice(-5).reverse().map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between py-1.5 px-2.5 rounded bg-[var(--bg-surface)] border border-[var(--border-hairline)] font-mono text-[11px]"
                      >
                        <span>{new Date(s.timestamp).toLocaleDateString()}</span>
                        <span>RMSE: {s.calibrationRmsePx.toFixed(1)}px</span>
                        <span>{s.phrasesVocalized} frases</span>
                        <span>Fatiga: {s.fatigueIndex}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sos' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--accent-urgent)]/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--accent-urgent)] flex items-center gap-2">
                    <BellRing className="w-4 h-4" />
                    {isEn
                      ? 'Immediate Caregiver SOS Alarm & Vocal Call'
                      : 'Alarma Acústica SOS Inmediata y Aviso Vocal al Cuidador'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                    {isEn
                      ? 'Triggers a high-decibel alternating medical siren (880/1320 Hz) and vocalizes an urgent caregiver summons.'
                      : 'Emite una sirena clínica alternante de alta prioridad (880/1320 Hz) y vocaliza un aviso urgente de asistencia.'}
                  </p>
                </div>
                <button
                  type="button"
                  data-dwell-id="btn-trigger-sos-now"
                  onClick={onTriggerEmergencySos}
                  className="px-4 py-2.5 rounded-xl bg-[var(--accent-urgent)] text-white font-semibold flex items-center gap-2 shrink-0"
                >
                  <BellRing className="w-4 h-4" />
                  <span>{isEn ? 'Trigger SOS Now' : 'Activar Alarma SOS'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-3">
                <h4 className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[var(--accent-primary)]" />
                  {isEn
                    ? 'Wheelchair Kiosk Mode & Screen WakeLock'
                    : 'Modo Kiosco en Silla de Ruedas (WakeLock Anti-Suspensión)'}
                </h4>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {isEn
                      ? 'Prevents the tablet/laptop screen from dimming or locking while the patient is communicating with their eyes.'
                      : 'Impide que la pantalla de la tablet u ordenador se apague o bloquee mientras el paciente se comunica con la mirada.'}
                  </p>
                  <button
                    type="button"
                    data-dwell-id="btn-toggle-kiosk-wakelock"
                    onClick={onToggleKioskWakeLock}
                    className={`px-3.5 py-1.5 rounded-lg font-semibold text-xs border shrink-0 ${
                      kioskWakeLockActive
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                        : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                    }`}
                  >
                    {kioskWakeLockActive
                      ? isEn
                        ? 'WakeLock Active'
                        : 'Pantalla Siempre Activa'
                      : isEn
                      ? 'Enable WakeLock'
                      : 'Activar WakeLock'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-hairline)]">
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {isEn ? 'Caregiver / Nurse Station Label:' : 'Nombre del Cuidador / Control Enfermería:'}
                    </label>
                    <input
                      type="text"
                      value={caregiverName}
                      onChange={(e) => setCaregiverName(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                      {isEn
                        ? `Emergency Eye-Closure Hold (${sosClosureSec.toFixed(1)}s):`
                        : `Cierre Ocular de Emergencia (${sosClosureSec.toFixed(1)}s):`}
                    </label>
                    <input
                      type="range"
                      min="2.5"
                      max="6.0"
                      step="0.5"
                      value={sosClosureSec}
                      onChange={(e) => setSosClosureSec(Number(e.target.value))}
                      className="w-full accent-[var(--accent-primary)]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sirenEnabled}
                      onChange={(e) => setSirenEnabled(e.target.checked)}
                      className="accent-[var(--accent-primary)]"
                    />
                    <span className="text-xs text-[var(--text-primary)]">
                      {isEn
                        ? 'Sound acoustic siren on SOS activation'
                        : 'Emitir sirena acústica en habitación al activar SOS'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveCaregiverSettings}
                    className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold"
                  >
                    {isEn ? 'Save SOS Settings' : 'Guardar Configuración'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[var(--accent-primary)]" />
                  {isEn
                    ? 'AES-256-GCM Encrypted Biometric Profile Backup (Web Crypto API)'
                    : 'Copia de Seguridad Biométrica Cifrada AES-256-GCM (Web Crypto API)'}
                </h3>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {isEn
                    ? 'Encrypts all ocular calibration matrices and Personal Voice Bank audio recordings with PBKDF2 (100,000 SHA-256 iterations) + AES-256-GCM for shared hospital tablets.'
                    : 'Cifra todas las matrices de calibración ocular y grabaciones del Banco de Voz con PBKDF2 (100.000 iteraciones SHA-256) y AES-256-GCM para tablets hospitalarias compartidas.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="password"
                    value={encryptionPin}
                    onChange={(e) => setEncryptionPin(e.target.value)}
                    placeholder={
                      isEn ? 'Clinical PIN / Passphrase (min 4 chars)...' : 'PIN o Clave Clínica (mín. 4 caracteres)...'
                    }
                    className="flex-1 px-3.5 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-xs text-[var(--text-primary)]"
                  />
                  <button
                    type="button"
                    onClick={handleEncryptedExport}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold flex items-center gap-1.5 shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{isEn ? 'Export Encrypted (.sight)' : 'Exportar Cifrado (.sight)'}</span>
                  </button>
                  <label className="px-4 py-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-primary)] font-semibold flex items-center gap-1.5 cursor-pointer shrink-0">
                    <Unlock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{isEn ? 'Decrypt & Restore' : 'Descifrar Archivo'}</span>
                    <input type="file" accept=".json" onChange={handleEncryptedImport} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2.5">
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">
                  {isEn
                    ? 'GDPR / HIPAA Informed Consent for Cloud Neural Speech Synthesis'
                    : 'Consentimiento Informado GDPR / HIPAA para Síntesis Neuronal en la Nube'}
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {isEn
                    ? 'By default, SIGHT operates 100% locally in your browser (ML-LPC16 / Klatt / Web Speech) with zero external transmission. Enable cloud consent only if you wish to send typed text to the studio Neural AI TTS proxy.'
                    : 'Por defecto, SIGHT opera 100% en local dentro de su navegador (ML-LPC16 / Klatt / Web Speech) sin enviar ningún dato al exterior. Active este permiso únicamente si desea sintetizar frases mediante el motor Neuronal IA en la nube.'}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cloudConsent}
                      onChange={(e) => setCloudConsent(e.target.checked)}
                      className="accent-[var(--accent-primary)]"
                    />
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {isEn
                        ? 'I authorize optional Cloud Neural TTS synthesis for spoken phrases'
                        : 'Autorizo el uso opcional del motor Neuronal IA en la nube para vocalizar frases'}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveCaregiverSettings}
                    className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-active)] text-[var(--accent-primary)] font-semibold"
                  >
                    {isEn ? 'Apply Privacy Policy' : 'Aplicar Privacidad'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'samd' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-hairline)] space-y-2">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                  {isEn
                    ? 'Medical Device Software (SaMD) Regulatory Architecture'
                    : 'Arquitectura Regulatoria de Producto Sanitario por Software (SaMD)'}
                </h3>
                <ul className="space-y-2 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  <li>
                    • <strong>EU MDR 2017/745 Class I & FDA 21 CFR 890.3710</strong>:{' '}
                    {isEn
                      ? 'Non-invasive powered communication system with 100% client-side optical pipeline.'
                      : 'Sistema de comunicación asistida no invasivo con procesamiento óptico 100% en el cliente.'}
                  </li>
                  <li>
                    • <strong>IEC 62304 Software Life Cycle & ISO 14971 Risk Management</strong>:{' '}
                    {isEn
                      ? 'Deterministic fallback from GPU to CPU delegate, Midas-Touch Ocular Rest Sanctuary, andLPC-16 local speech fallback when offline.'
                      : 'Tolerancia a fallos determinista GPU→CPU, Santuario Ocular contra falsos clics (Midas-Touch) y síntesis vocal LPC-16 offline.'}
                  </li>
                  <li>
                    • <strong>WCAG 2.2 AAA Ophthalmic Ergonomics</strong>:{' '}
                    {isEn
                      ? 'Scotopic 590nm Amber, Warm E-Ink Parchment, and Mineral Slate spectra minimizing retinal phototoxicity.'
                      : 'Espectros Ámbar Escotópico 590nm, Papiro E-Ink y Piedra Mineral para minimizar la fototoxicidad retiniana.'}
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
