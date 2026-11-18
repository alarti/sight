/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Eye, User, Volume2, VolumeX, FileText, Mic, Crosshair, Moon, Sun, Sunset, HeartPulse, BellRing } from 'lucide-react';
import { UserProfile, OcularTheme } from '../types/index.ts';
import { Language, translations } from '../i18n/translations.ts';

interface HeaderBarProps {
  activeTab: 'eye-comm' | 'virtual-keyboard';
  setActiveTab: (tab: 'eye-comm' | 'virtual-keyboard') => void;
  activeProfile: UserProfile;
  isAdvancedPanelOpen: boolean;
  setIsAdvancedPanelOpen: (val: boolean | ((prev: boolean) => boolean)) => void;
  isAudioEnabled: boolean;
  setIsAudioEnabled: (val: boolean | ((prev: boolean) => boolean)) => void;
  hoveredDwellId: string | null;
  onOpenProfilesModal: () => void;
  onOpenPaperModal: () => void;
  onOpenVoiceCloningModal: () => void;
  onOpenClinicalModal?: () => void;
  onTriggerSos?: () => void;
  isManualAimingMode?: boolean;
  onToggleManualAimingMode?: () => void;
  ocularTheme?: OcularTheme;
  onChangeOcularTheme?: (theme: OcularTheme) => void;
  isOcularRestMode?: boolean;
  onToggleOcularRestMode?: () => void;
  currentLanguage: Language;
  onToggleLanguage: (lang: Language) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeTab,
  setActiveTab,
  activeProfile,
  isAdvancedPanelOpen,
  setIsAdvancedPanelOpen,
  isAudioEnabled,
  setIsAudioEnabled,
  hoveredDwellId,
  onOpenProfilesModal,
  onOpenPaperModal,
  onOpenVoiceCloningModal,
  onOpenClinicalModal,
  onTriggerSos,
  isManualAimingMode = false,
  onToggleManualAimingMode,
  ocularTheme = 'warm-obsidian',
  onChangeOcularTheme,
  isOcularRestMode = false,
  onToggleOcularRestMode,
  currentLanguage,
  onToggleLanguage,
}) => {
  const t = translations[currentLanguage];
  const isVoiceCloned = activeProfile.voiceProfile?.enabled;
  const isEn = currentLanguage === 'en';

  return (
    <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1.5 sm:gap-2 px-2 sm:px-5 py-1.5 sm:py-2 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 z-50">
      {/* Top / Left Row: Brand + Primary Workspace Tabs + Ocular Theme + Language */}
      <div className="flex items-center justify-between lg:justify-start gap-1.5 sm:gap-3 flex-wrap">
        {/* Clinical Instrument Wordmark */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-elevated)] flex items-center justify-center shrink-0">
            <Eye className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          </div>
          <span className="text-xs sm:text-sm font-semibold tracking-tight text-[var(--text-primary)] whitespace-nowrap hidden sm:inline">
            {t.appTitle}
          </span>
        </div>

        {/* Primary Workspace Switcher */}
        <nav className="flex items-center p-0.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] shrink-0">
          <button
            type="button"
            data-dwell-id="tab-eye-comm"
            onClick={() => setActiveTab('eye-comm')}
            className={`px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'eye-comm'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${hoveredDwellId === 'tab-eye-comm' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
          >
            {t.tabs.quickBoard}
          </button>
          <button
            type="button"
            data-dwell-id="tab-virtual-keyboard"
            onClick={() => setActiveTab('virtual-keyboard')}
            className={`px-2 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'virtual-keyboard'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${hoveredDwellId === 'tab-virtual-keyboard' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
          >
            {t.tabs.virtualKeyboard}
          </button>
        </nav>

        {/* Ophthalmic Low-Fatigue Light Spectrum Switcher (Always visible & gaze-targetable) */}
        {onChangeOcularTheme && (
          <div
            className="flex items-center p-0.5 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] shrink-0"
            role="group"
            aria-label={isEn ? 'Ophthalmic Color Spectrum' : 'Espectro de Luz Ocular'}
          >
            <button
              type="button"
              data-dwell-id="theme-warm-obsidian"
              onClick={() => onChangeOcularTheme('warm-obsidian')}
              className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                ocularTheme === 'warm-obsidian'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-active)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${hoveredDwellId === 'theme-warm-obsidian' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
              title={isEn ? 'Warm Mineral Slate (Low Blue Light)' : 'Piedra Cálida (Baja Emisión Azul)'}
            >
              <Moon className="w-3 h-3 text-[var(--accent-primary)]" />
              <span className="hidden xs:inline sm:inline">{isEn ? 'Mineral' : 'Piedra'}</span>
            </button>
            <button
              type="button"
              data-dwell-id="theme-eink-parchment"
              onClick={() => onChangeOcularTheme('eink-parchment')}
              className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                ocularTheme === 'eink-parchment'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-active)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${hoveredDwellId === 'theme-eink-parchment' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
              title={isEn ? 'Warm E-Ink Parchment (Zero Glare Daylight)' : 'Papiro E-Ink Cálido (Lectura Diurna sin Reflejos)'}
            >
              <Sun className="w-3 h-3 text-[var(--accent-amber)]" />
              <span className="hidden xs:inline sm:inline">{isEn ? 'E-Ink' : 'Papiro'}</span>
            </button>
            <button
              type="button"
              data-dwell-id="theme-scotopic-amber"
              onClick={() => onChangeOcularTheme('scotopic-amber')}
              className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
                ocularTheme === 'scotopic-amber'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-active)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              } ${hoveredDwellId === 'theme-scotopic-amber' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
              title={isEn ? 'Scotopic 590nm Amber (Night & Photophobia Relief)' : 'Ámbar Escotópico 590nm (Noche y Fotofobia)'}
            >
              <Sunset className="w-3 h-3 text-[var(--accent-amber)]" />
              <span className="hidden xs:inline sm:inline">{isEn ? 'Amber' : 'Ámbar'}</span>
            </button>
          </div>
        )}

        {/* Language Selector (Always visible & gaze-targetable) */}
        <div className="flex items-center bg-[var(--bg-canvas)] border border-[var(--border-hairline)] rounded-lg p-0.5 font-mono text-[10px] sm:text-[11px] shrink-0">
          <button
            type="button"
            data-dwell-id="btn-lang-es"
            onClick={() => onToggleLanguage('es')}
            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentLanguage === 'es'
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            } ${hoveredDwellId === 'btn-lang-es' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
            title="Español (es-ES)"
          >
            ES
          </button>
          <button
            type="button"
            data-dwell-id="btn-lang-en"
            onClick={() => onToggleLanguage('en')}
            className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded font-medium transition-colors whitespace-nowrap shrink-0 ${
              currentLanguage === 'en'
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            } ${hoveredDwellId === 'btn-lang-en' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
            title="English (en-US)"
          >
            EN
          </button>
        </div>
      </div>

      {/* Bottom / Right Row: Ocular Rest Sanctuary Action & Instrument Controls (All visible & gaze-targetable) */}
      <div className="flex items-center justify-between sm:justify-end gap-1 sm:gap-1.5 flex-wrap">
        {/* EMERGENCY SOS QUICK BUTTON */}
        {onTriggerSos && (
          <button
            type="button"
            data-dwell-id="btn-header-sos"
            onClick={onTriggerSos}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold flex items-center gap-1 transition-colors border border-[var(--accent-urgent)] bg-[var(--bg-canvas)] text-[var(--accent-urgent)] hover:bg-[var(--accent-urgent)] hover:text-white whitespace-nowrap shrink-0 ${
              hoveredDwellId === 'btn-header-sos' ? 'ring-2 ring-[var(--accent-urgent)]' : ''
            }`}
            title={isEn ? 'Emergency SOS Caregiver Siren' : 'Alarma Acústica SOS al Cuidador'}
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>SOS</span>
          </button>
        )}

        {/* DEDICATED OCULAR REST / SLEEP CURTAIN BUTTON */}
        {onToggleOcularRestMode && (
          <button
            type="button"
            data-dwell-id="btn-ocular-rest-toggle"
            onClick={onToggleOcularRestMode}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-colors border whitespace-nowrap shrink-0 ${
              isOcularRestMode
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold'
                : 'bg-[var(--bg-canvas)] text-[var(--text-primary)] border-[var(--border-active)] hover:bg-[var(--bg-elevated)]'
            } ${hoveredDwellId === 'btn-ocular-rest-toggle' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
            title={
              isEn
                ? 'Rest Eyes: dims screen and pauses all accidental dwell clicks'
                : 'Descansar Ojos: atenúa la pantalla y pausa los clics por fijación'
            }
          >
            <Moon className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden xs:inline sm:inline">{isEn ? 'Rest' : 'Reposo'}</span>
          </button>
        )}

        {/* CLINICAL PRO / SaMD SUITE BUTTON */}
        {onOpenClinicalModal && (
          <button
            type="button"
            data-dwell-id="btn-clinical-pro-modal"
            onClick={onOpenClinicalModal}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-colors bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 ${
              hoveredDwellId === 'btn-clinical-pro-modal' ? 'ring-2 ring-[var(--accent-primary)]' : ''
            }`}
            title={isEn ? 'Clinical Pro SaMD Telemetry, HL7 FHIR & AES-256 Vault' : 'Suite Clínica SaMD, HL7 FHIR y Bóveda AES-256'}
          >
            <HeartPulse className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span className="hidden xl:inline">{isEn ? 'Clinical SaMD' : 'Suite Clínica'}</span>
          </button>
        )}

        {/* VOICE CLONING / IMITATION BUTTON */}
        <button
          type="button"
          data-dwell-id="btn-voice-cloning-modal"
          onClick={onOpenVoiceCloningModal}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-colors border whitespace-nowrap shrink-0 ${
            isVoiceCloned
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-active)]'
              : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
          } ${hoveredDwellId === 'btn-voice-cloning-modal' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
          title={t.header.voiceCloningTitle}
        >
          <Mic className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="hidden lg:inline">{t.header.voiceCloningButton}</span>
        </button>

        {/* SCIENTIFIC PAPER MODAL BUTTON */}
        <button
          type="button"
          data-dwell-id="btn-paper-modal"
          onClick={onOpenPaperModal}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-colors bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 ${
            hoveredDwellId === 'btn-paper-modal' ? 'ring-2 ring-[var(--accent-primary)]' : ''
          }`}
          title={t.header.paperTitle}
        >
          <FileText className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
          <span className="hidden xl:inline">{t.header.paperButton}</span>
        </button>

        {/* PROFILES BUTTON */}
        <button
          type="button"
          data-dwell-id="btn-profiles-modal"
          onClick={onOpenProfilesModal}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-colors bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] whitespace-nowrap shrink-0 ${
            hoveredDwellId === 'btn-profiles-modal' ? 'ring-2 ring-[var(--accent-primary)]' : ''
          }`}
          title={t.header.profiles}
        >
          <User className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="font-semibold text-[var(--text-primary)] max-w-[68px] truncate">{activeProfile.name}</span>
        </button>

        {/* LIVE MANUAL AIMING & ML CALIBRATION TOGGLE */}
        {onToggleManualAimingMode && (
          <button
            type="button"
            data-dwell-id="btn-manual-aiming-mode"
            onClick={onToggleManualAimingMode}
            className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium flex items-center gap-1 transition-colors border whitespace-nowrap shrink-0 ${
              isManualAimingMode
                ? 'bg-[var(--accent-amber)] text-[var(--accent-contrast)] border-[var(--accent-amber)] font-semibold'
                : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            } ${hoveredDwellId === 'btn-manual-aiming-mode' ? 'ring-2 ring-[var(--accent-amber)]' : ''}`}
            title={
              isEn
                ? 'Live Manual Aiming: drag cursor or use Arrow Keys to train ML'
                : 'Ajuste de Puntería en Directo: arrastra el cursor o usa las flechas para entrenar el ML'
            }
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {isEn ? 'Aiming ML' : 'Puntería ML'}
            </span>
          </button>
        )}

        {/* ADVANCED SETTINGS PANEL TOGGLE */}
        <button
          type="button"
          data-dwell-id="btn-advanced-panel"
          onClick={() => setIsAdvancedPanelOpen(prev => !prev)}
          className={`px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
            isAdvancedPanelOpen
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border-[var(--border-active)] font-semibold'
              : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          } ${hoveredDwellId === 'btn-advanced-panel' ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}
        >
          {t.header.panel}
        </button>

        {/* AUDIO MUTE TOGGLE */}
        <button
          type="button"
          data-dwell-id="btn-audio-toggle"
          onClick={() => setIsAudioEnabled(prev => !prev)}
          className={`p-1.5 sm:p-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0 ${
            hoveredDwellId === 'btn-audio-toggle' ? 'ring-2 ring-[var(--accent-primary)]' : ''
          }`}
          title={isAudioEnabled ? t.header.muteAudio : t.header.unmuteAudio}
        >
          {isAudioEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--accent-primary)]" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-muted)]" />}
        </button>
      </div>
    </header>
  );
};
