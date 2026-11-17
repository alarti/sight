/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Eye, Camera, User, CheckCircle, AlertCircle, Loader2, Globe } from 'lucide-react';
import { Language, translations } from '../i18n/translations.ts';

interface OnboardingSetupModalProps {
  isOpen: boolean;
  cameraActive: boolean;
  onRequestCamera: () => Promise<boolean | void>;
  onComplete: (profileName: string, language: Language) => void;
  onSpeak: (text: string) => void;
  cameraError?: string | null;
  currentLanguage?: Language;
}

export const OnboardingSetupModal: React.FC<OnboardingSetupModalProps> = ({
  isOpen,
  cameraActive,
  onRequestCamera,
  onComplete,
  onSpeak,
  cameraError,
  currentLanguage = 'es'
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(currentLanguage);
  const [patientName, setPatientName] = useState<string>(selectedLanguage === 'en' ? 'ALS Patient 1' : 'Paciente ELA 1');
  const [isActivatingCamera, setIsActivatingCamera] = useState<boolean>(false);

  const t = translations[selectedLanguage].onboarding;

  if (!isOpen) return null;

  const handleActivateCameraClick = async () => {
    setIsActivatingCamera(true);
    onSpeak(selectedLanguage === 'en'
      ? 'Requesting webcam access. Please grant camera permissions in your browser.'
      : 'Solicitando activación de cámara frontal. Por favor conceda los permisos en su navegador.'
    );
    try {
      await onRequestCamera();
    } finally {
      setIsActivatingCamera(false);
    }
  };

  const handleCreateProfileSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const defaultName = selectedLanguage === 'en' ? 'ALS Patient 1' : 'Paciente ELA 1';
    const name = patientName.trim() || defaultName;
    onSpeak(selectedLanguage === 'en'
      ? `Profile ${name} created successfully. Starting 9-point calibration wizard.`
      : `Perfil ${name} creado con éxito. Iniciando asistente de calibración de 9 puntos.`
    );
    onComplete(name, selectedLanguage);
  };

  return (
    <div className="fixed inset-0 z-[10020] bg-[var(--bg-canvas)]/95 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl max-w-lg w-full flex flex-col overflow-hidden text-[var(--text-primary)] p-7 sm:p-8 gap-6">
        
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)] shrink-0">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[var(--accent-primary)] font-semibold block">
              {t.badge}
            </span>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)] tracking-tight">
              {!cameraActive ? t.step1Title : t.step2Title}
            </h2>
          </div>
        </div>

        {/* STEP PROGRESS INDICATOR */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-[var(--accent-primary)] transition-colors" />
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${cameraActive ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-hairline)]'}`} />
        </div>

        {cameraError && (
          <div className="p-3 bg-[var(--bg-canvas)] border border-[var(--accent-urgent)] text-[var(--accent-urgent)] rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t.cameraErrorPrefix} {cameraError}</span>
          </div>
        )}

        {/* STEP 1: CAMERA ACTIVATION */}
        {!cameraActive ? (
          <div className="flex flex-col gap-5 animate-in fade-in">
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {t.step1Desc}
            </p>

            <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl p-4 flex items-start gap-3.5">
              <Camera className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
              <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                <strong className="text-[var(--text-primary)] block mb-0.5 font-semibold">
                  {selectedLanguage === 'en' ? 'Positioning & Privacy:' : 'Dispositivo Fijo en Silla o Cama:'}
                </strong>
                {selectedLanguage === 'en'
                  ? 'Keep head comfortable on wheelchair headrest 35-50 cm from camera. MediaPipe runs 100% locally in browser (zero telemetry).'
                  : 'Coloque el dispositivo a 25-45 cm a la altura de los ojos. El procesamiento ocular se ejecuta 100% en local en el navegador, sin enviar imágenes a ningún servidor.'
                }
              </div>
            </div>

            <button
              onClick={handleActivateCameraClick}
              disabled={isActivatingCamera}
              className="w-full py-3.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-60"
            >
              {isActivatingCamera ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {selectedLanguage === 'en' ? 'Connecting Camera...' : 'Conectando Sensor...'}
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  {t.enableCameraBtn}
                </>
              )}
            </button>
          </div>
        ) : (
          /* STEP 2: PROFILE CREATION & LANGUAGE SELECTION */
          <form onSubmit={handleCreateProfileSubmit} className="flex flex-col gap-5 animate-in fade-in">
            <div className="bg-[var(--bg-canvas)] border border-[var(--border-active)] rounded-xl p-4 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[var(--accent-primary)] shrink-0" />
              <div className="text-xs text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)] block font-semibold">{t.cameraActiveSuccess}</strong>
                {selectedLanguage === 'en'
                  ? 'MediaPipe FaceLandmarker active at 60 FPS. Select language and create your clinical profile.'
                  : 'MediaPipe FaceLandmarker activo a 60 FPS. Seleccione el idioma y cree el perfil clínico.'}
              </div>
            </div>

            {/* LANGUAGE SELECTOR */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-[var(--accent-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                {t.languageLabel}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLanguage('es');
                    setPatientName('Paciente ELA 1');
                  }}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    selectedLanguage === 'es'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                  }`}
                >
                  <span className="font-mono">ES</span>
                  <span>·</span>
                  <span>{t.langSpanish}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLanguage('en');
                    setPatientName('ALS Patient 1');
                  }}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                    selectedLanguage === 'en'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)]'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)]'
                  }`}
                >
                  <span className="font-mono">EN</span>
                  <span>·</span>
                  <span>{t.langEnglish}</span>
                </button>
              </div>
            </div>

            {/* PROFILE NAME INPUT */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono text-[var(--accent-primary)] uppercase tracking-wider">
                {t.profileNameLabel}
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder={t.profileNamePlaceholder}
                  autoFocus
                  className="w-full bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-xl px-4 py-2.5 pl-10 text-[var(--text-primary)] font-medium text-sm outline-none focus:border-[var(--border-active)]"
                />
              </div>
              <span className="text-[11px] text-[var(--text-muted)]">
                {selectedLanguage === 'en'
                  ? 'Once confirmed, the 9-point perimeter calibration wizard will begin.'
                  : 'Al confirmar, se iniciará el asistente automático de calibración de 9 zonas perimetrales.'}
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              {t.startBtn}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
