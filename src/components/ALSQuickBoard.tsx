/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Droplets,
  BellRing,
  Armchair,
  AlertCircle,
  Thermometer,
  SunMedium,
  Check,
  X,
  HeartHandshake,
  Moon,
  EyeOff,
} from 'lucide-react';
import { PresetItem } from '../types/index.ts';
import { Language, translations } from '../i18n/translations.ts';

export const ALS_QUICK_PRESETS_ES: PresetItem[] = [
  { id: 'water', label: 'Tengo sed / Agua', category: 'Hidratación', icon: 'water', speech: 'Por favor, necesito un vaso de agua fresca.' },
  { id: 'reposition', label: 'Ajustar Postura', category: 'Ergonomía', icon: 'reposition', speech: 'Por favor, necesito cambiar de postura en la silla.' },
  { id: 'blanket', label: 'Frío / Calor', category: 'Clima', icon: 'blanket', speech: 'Por favor ajusta la temperatura o colócame la manta.' },
  { id: 'light', label: 'Luz Ambiental', category: 'Entorno', icon: 'light', speech: 'Por favor regula o apaga la luz de la habitación para descansar la vista.' },
  { id: 'yes', label: 'SÍ · Afirmativo', category: 'Respuesta Directa', icon: 'yes', speech: 'Sí, estoy totalmente de acuerdo con eso.' },
  { id: 'no', label: 'NO · Negativo', category: 'Respuesta Directa', icon: 'no', speech: 'No, no deseo eso en este momento.' },
  { id: 'nurse', label: 'Llamar Cuidador', category: 'Asistencia', icon: 'nurse', speech: 'Atención, necesito ayuda del cuidador o personal clínico.' },
  { id: 'pain', label: 'Tengo Dolor', category: 'Prioridad Clínica', icon: 'pain', speech: 'Tengo molestias o dolor, por favor acércate a ayudarme.' },
  { id: 'thanks', label: 'Muchas Gracias', category: 'Vínculo', icon: 'thanks', speech: 'Muchas gracias por tu cariño y tu valiosa ayuda.' },
  { id: 'rest', label: 'Deseo Descansar', category: 'Reposo Ocular', icon: 'rest', speech: 'Quiero descansar un rato tranquilo y relajar los ojos.' },
];

export const ALS_QUICK_PRESETS_EN: PresetItem[] = [
  { id: 'water', label: 'Thirsty / Water', category: 'Hydration', icon: 'water', speech: 'Please, I need a glass of fresh water.' },
  { id: 'reposition', label: 'Adjust Posture', category: 'Ergonomics', icon: 'reposition', speech: 'Please reposition me in my wheelchair or adjust my pillow.' },
  { id: 'blanket', label: 'Cold / Warmth', category: 'Climate', icon: 'blanket', speech: 'Please adjust the room temperature or my blanket.' },
  { id: 'light', label: 'Ambient Light', category: 'Environment', icon: 'light', speech: 'Please dim or turn off the room light so I can rest my eyes.' },
  { id: 'yes', label: 'YES · Affirmative', category: 'Direct Response', icon: 'yes', speech: 'Yes, I completely agree with that.' },
  { id: 'no', label: 'NO · Negative', category: 'Direct Response', icon: 'no', speech: 'No, I do not want that right now.' },
  { id: 'nurse', label: 'Call Caregiver', category: 'Assistance', icon: 'nurse', speech: 'Attention, I need assistance from my caregiver or nurse.' },
  { id: 'pain', label: 'I Have Pain', category: 'Clinical Priority', icon: 'pain', speech: 'I am in pain or discomfort, please come help me.' },
  { id: 'thanks', label: 'Thank You', category: 'Courtesy', icon: 'thanks', speech: 'Thank you very much for your loving care and help.' },
  { id: 'rest', label: 'Want to Rest', category: 'Ocular Rest', icon: 'rest', speech: 'I would like to rest quietly for a while and relax my eyes.' },
];

interface ALSQuickBoardProps {
  dwellTimeMs: number;
  hoveredDwellId: string | null;
  dwellProgress: number;
  onSelectPreset: (speechText: string, presetId?: string) => void;
  isRestingInSanctuary?: boolean;
  onEnterOcularSleep?: () => void;
  currentLanguage?: Language;
}

const renderClinicalIcon = (iconKey: string, isUrgent: boolean) => {
  const cls = `w-5 h-5 ${isUrgent ? 'text-[var(--accent-urgent)]' : 'text-[var(--accent-primary)]'}`;
  switch (iconKey) {
    case 'water':
      return <Droplets className={cls} />;
    case 'reposition':
      return <Armchair className={cls} />;
    case 'blanket':
      return <Thermometer className={cls} />;
    case 'light':
      return <SunMedium className={cls} />;
    case 'yes':
      return <Check className={cls} />;
    case 'no':
      return <X className="w-5 h-5 text-[var(--accent-amber)]" />;
    case 'nurse':
      return <BellRing className={cls} />;
    case 'pain':
      return <AlertCircle className={cls} />;
    case 'thanks':
      return <HeartHandshake className={cls} />;
    case 'rest':
    default:
      return <Moon className={cls} />;
  }
};

/**
 * Perifoveal Single-Screen Quick Communication Board.
 * Fits 10 high-priority clinical presets + the 2-column Ocular Rest Sanctuary (12 grid cells total)
 * inside a 100dvh viewport without vertical page scrolling on both portrait (3x4) and landscape/desktop (4x3) screens.
 */
export const ALSQuickBoard: React.FC<ALSQuickBoardProps> = ({
  dwellTimeMs,
  hoveredDwellId,
  dwellProgress,
  onSelectPreset,
  isRestingInSanctuary = false,
  onEnterOcularSleep,
  currentLanguage = 'es',
}) => {
  const t = translations[currentLanguage].quickBoard;
  const isEn = currentLanguage === 'en';
  const presets = isEn ? ALS_QUICK_PRESETS_EN : ALS_QUICK_PRESETS_ES;

  const topRow = presets.slice(0, 4); // water, reposition, blanket, light
  const yesPreset = presets[4];
  const noPreset = presets[5];
  const bottomRow = presets.slice(6, 10); // nurse, pain, thanks, rest

  const renderTile = (preset: PresetItem, indexNumber: string, isHorizontalMeridian = false) => {
    const dwellId = `preset-${preset.id}`;
    const isHovered = hoveredDwellId === dwellId;
    const isUrgent = preset.id === 'pain' || preset.id === 'nurse';

    return (
      <button
        key={preset.id}
        type="button"
        data-dwell-id={dwellId}
        onClick={() => onSelectPreset(preset.speech, preset.id)}
        className={`group relative overflow-hidden rounded-xl border text-left p-2 sm:p-3.5 flex flex-col justify-between transition-colors h-full min-h-0 ${
          isHovered
            ? isUrgent
              ? 'bg-[var(--bg-elevated)] border-[var(--accent-urgent)] ring-2 ring-[var(--accent-urgent)]'
              : 'bg-[var(--bg-elevated)] border-[var(--border-active)] ring-2 ring-[var(--accent-primary)]'
            : 'bg-[var(--bg-surface)] border-[var(--border-hairline)] hover:border-[var(--text-muted)]'
        }`}
      >
        {/* Top Row: Editorial Number + Unboxed Category Metadata + Clinical Vector Icon */}
        <div className="w-full flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-[var(--text-muted)] min-w-0">
            <span className="text-[var(--text-secondary)] font-semibold shrink-0">{indexNumber}</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="truncate hidden sm:inline">{preset.category}</span>
          </div>
          <div className="shrink-0 opacity-90">{renderClinicalIcon(preset.icon, isUrgent)}</div>
        </div>

        {/* Main Label & Spoken Preview */}
        <div className="my-0.5 sm:my-1 min-w-0">
          <span className="block text-xs sm:text-base font-semibold text-[var(--text-primary)] tracking-tight leading-tight sm:leading-snug truncate">
            {preset.label}
          </span>
          <span className="hidden sm:block text-[11px] text-[var(--text-secondary)] line-clamp-1 mt-0.5">
            {preset.speech}
          </span>
        </div>

        {/* Bottom Status / Linear Dwell Fill Bar */}
        <div className="w-full pt-1 border-t border-[var(--border-hairline)] flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-[var(--text-muted)]">
          <span className="truncate">
            {isHovered
              ? isEn
                ? `Selecting ${dwellProgress}%`
                : `Fijando ${dwellProgress}%`
              : isHorizontalMeridian
              ? isEn
                ? 'Meridian'
                : 'Meridiano'
              : `${(dwellTimeMs / 1000).toFixed(1)}s`}
          </span>
          <span className="tabular-nums shrink-0">{isHovered ? `${dwellProgress}%` : '—'}</span>
        </div>

        {/* Smooth Bottom Progress Bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1 bg-transparent overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <div
            style={{
              transform: `scaleX(${isHovered ? dwellProgress / 100 : 0})`,
              transformOrigin: 'left',
            }}
            className={`h-full w-full transition-transform duration-75 ${
              isUrgent ? 'bg-[var(--accent-urgent)]' : 'bg-[var(--accent-primary)]'
            }`}
          />
        </div>
      </button>
    );
  };

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-1.5 sm:gap-2.5">
      {/* Compact Header Strip (Hidden on constrained mobile viewports to preserve 100% single-screen target space) */}
      <div className="hidden md:flex items-center justify-between gap-2 pb-1 border-b border-[var(--border-hairline)] shrink-0">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight shrink-0">
            {t.title}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] truncate">
            {t.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)] shrink-0">
          <span>
            {isEn ? 'Fixation time' : 'Tiempo de fijación'}:{' '}
            <strong className="text-[var(--text-primary)] tabular-nums">{(dwellTimeMs / 1000).toFixed(1)} s</strong>
          </span>
        </div>
      </div>

      {/* PERIFOVEAL SINGLE-SCREEN GRID ARCHITECTURE:
          10 Clinical Presets + Central Ocular Rest Sanctuary (col-span-2) = 12 Grid Cells:
          - Portrait Mobile (< sm): 3 cols x 4 equal rows = 12 cells (fits 100% in 100dvh)
          - Landscape Mobile / Tablet / Desktop (>= sm): 4 cols x 3 equal rows = 12 cells */}
      <div className="flex-1 min-h-0 grid grid-cols-3 sm:grid-cols-4 auto-rows-fr gap-1.5 sm:gap-3">
        {/* ROW 1: Top 4 Perifoveal Tiles */}
        {topRow.map((preset, idx) => renderTile(preset, `0${idx + 1}`))}

        {/* ROW 2 LEFT: Primary Affirmative Response on Horizontal Meridian */}
        {renderTile(yesPreset, '05', true)}

        {/* ROW 2 CENTER (2 COLUMNS): OCULAR REST SANCTUARY (ANTI-MIDAS TOUCH ZONE) */}
        <div
          data-sanctuary-zone="true"
          className={`col-span-2 rounded-xl border px-2.5 py-2 sm:px-5 sm:py-3 flex flex-col justify-between relative overflow-hidden transition-colors h-full min-h-0 ${
            isRestingInSanctuary
              ? 'bg-[var(--bg-sanctuary)] border-[var(--border-active)]'
              : 'bg-[var(--bg-canvas)] border-[var(--border-hairline)]'
          }`}
        >
          <div className="flex items-center justify-between gap-1.5 z-10">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-[var(--text-secondary)] min-w-0">
              <span className="text-[var(--accent-primary)] font-semibold truncate">
                {isEn ? 'OCULAR REST SANCTUARY' : 'SANTUARIO OCULAR'}
              </span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden sm:inline truncate">
                {isRestingInSanctuary
                  ? isEn
                    ? 'Gaze parked · Dwell disarmed'
                    : 'Mirada en reposo · Clic desactivado'
                  : isEn
                  ? 'Zero-click neutral zone'
                  : 'Zona neutra sin activación'}
              </span>
            </div>

            {onEnterOcularSleep && (
              <button
                type="button"
                data-dwell-id="btn-enter-ocular-sleep"
                onClick={onEnterOcularSleep}
                className={`px-2 sm:px-2.5 py-1 rounded-lg border text-[10px] sm:text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0 ${
                  hoveredDwellId === 'btn-enter-ocular-sleep'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-active)] font-semibold ring-2 ring-[var(--accent-primary)]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-hairline)] hover:text-[var(--text-primary)]'
                }`}
              >
                <EyeOff className="w-3 h-3" />
                <span>
                  {hoveredDwellId === 'btn-enter-ocular-sleep'
                    ? `${isEn ? 'Dimming' : 'Atenuando'} ${dwellProgress}%`
                    : isEn
                    ? 'Sleep Screen'
                    : 'Modo Reposo'}
                </span>
              </button>
            )}
          </div>

          {/* Center Soft Focal Horizon for Ciliary Muscle Relaxation */}
          <div className="my-1 flex items-center gap-2.5 sm:gap-3.5 z-10 min-w-0">
            <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-[var(--accent-primary)] ocular-breathe-ring" />
              <div className="absolute w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] opacity-70" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-medium text-[var(--text-primary)] leading-tight sm:leading-snug line-clamp-2">
                {isRestingInSanctuary
                  ? isEn
                    ? 'Your eyes are resting safely in the neutral zone. No buttons will trigger here.'
                    : 'Sus ojos descansan en la zona neutra. Ningún botón se activará mientras mire aquí.'
                  : isEn
                  ? 'Park your gaze here anytime to relax your eyes without triggering buttons.'
                  : 'Pose aquí la mirada en cualquier momento para descansar la vista sin activar ningún botón.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border-hairline)] z-10">
            <span className="truncate">
              {isEn ? 'Zero-click neutral zone' : 'Zona neutra anti-Midas Touch'}
            </span>
            <span className="shrink-0">{isRestingInSanctuary ? (isEn ? 'RESTING' : 'EN REPOSO') : (isEn ? 'READY' : 'DISPONIBLE')}</span>
          </div>
        </div>

        {/* ROW 2 RIGHT: Primary Negative Response on Horizontal Meridian */}
        {renderTile(noPreset, '06', true)}

        {/* ROW 3: Bottom 4 Perifoveal Tiles */}
        {bottomRow.map((preset, idx) =>
          renderTile(preset, idx + 7 < 10 ? `0${idx + 7}` : `${idx + 7}`)
        )}
      </div>
    </section>
  );
};
