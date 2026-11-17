/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, FileText, Code, BookOpen, Printer, Award, ExternalLink } from 'lucide-react';
import { generateScientificPaperPDF } from '../utils/pdfGenerator.ts';
import { Language, translations } from '../i18n/translations.ts';

interface ScientificPaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage?: Language;
}

export const ScientificPaperModal: React.FC<ScientificPaperModalProps> = ({
  isOpen,
  onClose,
  currentLanguage = 'es',
}) => {
  const [activeTab, setActiveTab] = useState<'article' | 'latex'>('article');
  const [paperLang, setPaperLang] = useState<'es' | 'en'>(currentLanguage);
  const [copied, setCopied] = useState<boolean>(false);
  const [latexSource, setLatexSource] = useState<string>('');
  const [isLoadingLatex, setIsLoadingLatex] = useState<boolean>(true);

  const t = translations[currentLanguage].paperModal;

  useEffect(() => {
    if (isOpen) {
      setIsLoadingLatex(true);
      const filename = paperLang === 'en' ? './paper_calibracion_ela_en.tex' : './paper_calibracion_ela.tex';
      fetch(filename)
        .then(res => res.text())
        .then(text => {
          setLatexSource(text);
          setIsLoadingLatex(false);
        })
        .catch(err => {
          console.error('Error cargando archivo LaTeX:', err);
          setIsLoadingLatex(false);
        });
    }
  }, [isOpen, paperLang]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyLatex = async () => {
    if (!latexSource) return;
    try {
      await navigator.clipboard.writeText(latexSource);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  const handleDownloadLatex = () => {
    const blob = new Blob([latexSource], { type: 'text/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = paperLang === 'en' ? 'paper_calibracion_ela_en.tex' : 'paper_calibracion_ela.tex';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isEn = paperLang === 'en';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[var(--bg-canvas)]/92 backdrop-blur-md animate-in fade-in duration-150 text-[var(--text-primary)]">
      <div
        className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-active)] flex items-center justify-center text-[var(--accent-primary)]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                  {t.title}
                </h2>
                <span className="text-xs text-[var(--text-muted)] font-mono">·</span>
                <span className="text-[11px] font-mono text-[var(--accent-primary)]">
                  {t.badge}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {t.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => generateScientificPaperPDF(paperLang)}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs flex items-center gap-1.5 transition-colors"
              title="Download PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t.downloadPDF} ({paperLang.toUpperCase()})</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] text-xs font-medium flex items-center gap-1.5 transition-colors"
              title={t.printPDF}
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.printPDF}</span>
            </button>

            <button
              onClick={handleDownloadLatex}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] font-medium text-xs flex items-center gap-1.5 transition-colors"
              title={t.downloadTex}
            >
              <FileText className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t.downloadTex}</span>
            </button>

            <button
              onClick={handleCopyLatex}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-hairline)] text-xs font-medium flex items-center gap-1.5 transition-colors"
              title={t.copyLatex}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
              <span className="hidden sm:inline">{copied ? t.copied : t.copyLatex}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ml-1"
              title={t.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TABS SELECTOR & LANGUAGE SWITCH */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-[var(--bg-canvas)] border-b border-[var(--border-hairline)] text-xs font-medium flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('article')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors border ${
                activeTab === 'article'
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)] font-semibold'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {t.tabArticle}
            </button>
            <button
              onClick={() => setActiveTab('latex')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors border ${
                activeTab === 'latex'
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)] font-semibold'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              {t.tabLatex}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[var(--text-muted)]">Idioma / Language:</span>
            <div className="flex items-center bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-lg p-0.5 font-mono">
              <button
                onClick={() => setPaperLang('es')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  paperLang === 'es'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Español (ES)
              </button>
              <button
                onClick={() => setPaperLang('en')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                  paperLang === 'en'
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                English (EN)
              </button>
            </div>
          </div>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-6 text-sm text-[var(--text-secondary)] leading-relaxed font-sans space-y-6">
          {activeTab === 'latex' ? (
            <div className="relative">
              {isLoadingLatex ? (
                <div className="py-20 text-center text-[var(--text-muted)] font-mono">Cargando código fuente LaTeX...</div>
              ) : (
                <pre className="p-4 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] font-mono text-xs text-[var(--text-primary)] overflow-x-auto whitespace-pre leading-5 select-text">
                  {latexSource}
                </pre>
              )}
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 select-text">
              {/* PAPER HEADER BANNER */}
              <div className="border-b border-[var(--border-hairline)] pb-6 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--accent-primary)]">
                  <span>{isEn ? 'Assistive Neuro-Ophthalmic Engineering · Preprint 2026' : 'Ingeniería Neuro-Oftálmica Asistencial · Preprint 2026'}</span>
                  <span>·</span>
                  <span>{isEn ? 'PDF & LaTeX Available' : 'Formato PDF y LaTeX Disponible'}</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] leading-snug">
                  SIGHT: A Non-Invasive Tri-Modal Ocular Sensor Fusion, Hering-Constrained Pupil Stabilization, and Bayesian Gaze Decoding Framework for ALS Assistive Communication
                </h1>

                <div className="pt-1">
                  <div className="text-sm font-semibold text-[var(--accent-primary)]">
                    {isEn ? 'Author: ' : 'Autor: '}
                    <span className="text-[var(--text-primary)] underline underline-offset-4">Alberto Arce Rodríguez</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                    {isEn
                      ? 'Assistive Technology Laboratory, Neurocomputation and Vision Sciences Research Unit'
                      : 'Laboratorio de Tecnología Asistencial, Neurocomputación y Ciencias de la Visión'}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">
                    Contacto: alberto.arce.ti@gmail.com · 100% Client-Side WebGPU/WASM
                  </div>
                </div>

                {/* PROMINENT DOWNLOAD ACTION CARDS */}
                <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={() => generateScientificPaperPDF(paperLang)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isEn ? `Download PDF (${paperLang.toUpperCase()}) - Alberto Arce Rodríguez` : `Descargar PDF (${paperLang.toUpperCase()}) - Alberto Arce Rodríguez`}</span>
                  </button>

                  <button
                    onClick={handleDownloadLatex}
                    className="px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] font-medium text-xs flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>{isEn ? 'Download LaTeX Source (.tex)' : 'Descargar Fuente LaTeX (.tex)'}</span>
                  </button>
                </div>
              </div>

              {/* ABSTRACT */}
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[var(--accent-primary)] font-semibold text-xs uppercase tracking-wider font-mono">
                  <Award className="w-4 h-4" /> {isEn ? 'Scientific Abstract' : 'Resumen Científico (Abstract)'}
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'Patients diagnosed with advanced Amyotrophic Lateral Sclerosis (ALS) experience profound motor neuron degeneration resulting in quadriplegia, anarthria, and locked-in syndrome (LIS), while extraocular motor nuclei (CN III, IV, VI) remain uniquely spared. However, consumer webcam eye-trackers suffer from severe post-calibration cursor tremor caused by single-landmark canthal amplification (25× noise gain), 1st-Purkinje corneal screen reflections, and steep calibration polynomial Jacobians. We present SIGHT, a zero-cost, 100% client-side browser framework featuring: (1) a 4-point Bony Canthal Constellation with 5-point iris chord-eccentricity damping; (2) Sub-Pixel Photometric Dark-Pupil ROI Centroiding with 1st-Purkinje Corneal Specular Glint Inpainting; (3) Hering\'s Law Binocular Conjugate Coherence Filtering (PupilTemporalStabilizer) coupled with a Cubic-Sigmoid Innovation-Gated Kalman Filter and Dual-Concentric Fixation Lock (<14 px foveal lock, <28 px perifoveal damping); (4) Multi-Regime Quadratic-Plateau Calibration (M-QPM) and OrbitoGaze Smooth-Pursuit lag-compensated calibration; (5) a Temporal Bayesian Gaze-to-Target Posterior Decoder, Ocular Trackball, and Two-Stage Foveal Loupe; and (6) an LPC-16 / Cascade Klatt Formant Voice Cloning synthesizer. Empirical evaluation demonstrates an RMSE of 8.2 ± 1.9 px (0.29° visual angle) and a 94% reduction in static fixation tremor (0.12 px RMS jitter).'
                    : 'Los pacientes diagnosticados con Esclerosis Lateral Amiotrófica (ELA) avanzada experimentan tetraplejía y anartria (síndrome de cautiverio o LIS), mientras que las motoneuronas de los núcleos oculomotores (pares III, IV y VI) permanecen preservadas. Sin embargo, los seguidores oculares por webcam sufren temblor post-calibración inducido por la amplificación de ruido en hitos cantales simples (ganancia de ruido 25×), reflejos especulares corneales de la pantalla (1ª imagen de Purkinje) y el elevado gradiente del polinomio de calibración. Presentamos SIGHT, un framework asistencial 100% en el navegador que introduce: (1) una Constelación Cantal Ósea de 4 puntos por comisura con amortiguación de excentricidad de cuerda en las 5 referencias del iris; (2) Centroide Fotométrico Sub-píxel de Pupila Oscura con Inpainting del Reflejo Especular Corneal de Purkinje; (3) Estabilizador Temporal Binocular basado en la Ley de Hering (PupilTemporalStabilizer), Filtro de Kalman con puerta de innovación sigmoidea-cúbica y Bloqueo de Fijación Concéntrico Dual (<14 px bloqueo foveal, <28 px amortiguación perifoveal); (4) Calibración Multi-Régimen Cuadrático-Plateau (M-QPM) y calibración continua OrbitoGaze por seguimiento suave; (5) Decodificador Bayesiano Temporal de Objetivos, Trackball Ocular y Lupa Foveal en 2 Etapas; y (6) Síntesis y Clonación de Voz LPC-16 / Klatt en cascada. La validación experimental demuestra un RMSE de 8.2 ± 1.9 px (0.29° de ángulo visual) y una reducción del 94% en el temblor de fijación (0.12 px RMS).'}
                </p>
                <div className="pt-2 text-[11px] font-mono text-[var(--accent-primary)]">
                  <strong>{isEn ? 'Keywords:' : 'Palabras Clave:'}</strong>{' '}
                  {isEn
                    ? 'ALS, Bony Canthal Constellation, Purkinje Glint Inpainting, Hering Conjugate Filter, M-QPM Calibration, Bayesian Decoder, LPC-16 Voice Cloning.'
                    : 'ELA, Constelación Cantal Ósea, Inpainting Purkinje, Ley de Hering, Calibración M-QPM, Decodificador Bayesiano, Clonación de Voz LPC-16.'}
                </div>
              </div>

              {/* SECTION 1: MULTI-POINT CANTHAL CONSTELLATION & PHOTOMETRIC INPAINTING */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">01.</span>{' '}
                  {isEn
                    ? 'Multi-Point Bony Canthal Constellation & Purkinje Glint Inpainting'
                    : 'Constelación Cantal Ósea Multipunto e Inpainting Fotométrico de Purkinje'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'In single-landmark webcam trackers, normalizing the iris against landmarks 33 and 133 divides coordinate jitter by the narrow palpebral fissure (~0.04 normalized units), magnifying sensor noise by 25× before the steep calibration polynomial (‖∇f‖ ≈ 4000 px/unit). SIGHT anchors each eye to a weighted 4-point Bony Orbital & Palpebral Canthal Constellation and fuses all 5 iris landmarks with chord-eccentricity damping:'
                    : 'En los seguidores por webcam clásicos, normalizar el iris frente a los hitos aislados 33 y 133 divide el ruido del detector entre la estrecha hendidura palpebral (~0.04 unidades), amplificando el jitter 25× antes de atravesar el polinomio de calibración (‖∇f‖ ≈ 4000 px/unidad). SIGHT ancla cada ojo a una Constelación Cantal Ósea de 4 puntos por comisura y fusiona los 5 hitos del iris amortiguando la excentricidad de cuerda:'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1">
                    <span className="text-[var(--accent-primary)] font-semibold block">
                      {isEn ? 'Bony Canthal Cluster (50% Lower Variance):' : 'Clúster Cantal Óseo (-50% Varianza):'}
                    </span>
                    <span className="text-[var(--text-primary)] block">Lat: &#123;33, 246, 7, 130&#125; / &#123;263, 466, 249, 359&#125;</span>
                    <span className="text-[var(--text-primary)] block">Med: &#123;133, 173, 155, 243&#125; / &#123;362, 398, 382, 463&#125;</span>
                    <span className="text-[var(--accent-primary)] block font-semibold">{'c = 0.42·p₀ + 0.22·p₁ + 0.18·p₂ + 0.18·p₃'}</span>
                  </div>
                  <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1">
                    <span className="text-[var(--accent-primary)] font-semibold block">
                      {isEn ? 'Sub-Pixel ROI & Purkinje Glint Inpainting:' : 'ROI Sub-píxel e Inpainting de Purkinje:'}
                    </span>
                    <span className="text-[var(--text-primary)] block">5-Point Iris Chord Damping: exp(-3.5·|r_h - r_v|/r_max)</span>
                    <span className="text-[var(--text-primary)] block">Glint Gate: r_ellip ≤ 0.42 &amp; L(u,v) ≥ P₈₈ → L ← P₂₀</span>
                    <span className="text-[var(--accent-primary)] block font-semibold">{'w(u,v) = (T - L*(u,v))² · exp(-2.2·r²)'}</span>
                  </div>
                </div>
              </section>

              {/* SECTION 2: HERING BINOCULAR STABILIZER & KALMAN / DUAL FIXATION LOCK */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">02.</span>{' '}
                  {isEn
                    ? 'Hering Binocular Conjugate Stabilizer & Dual-Concentric Fixation Lock'
                    : 'Estabilizador Binocular de Hering y Bloqueo de Fijación Concéntrico Dual'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'By Hering\'s Law of Equal Innervation, real saccades and smooth pursuit innervate both eyes in the same direction (Δx_L · Δx_R > 0), whereas webcam sensor noise and monocular landmark slips are anti-conjugate or uncorrelated. PupilTemporalStabilizer applies a 5-tap median-trimmed filter and a Hering Conjugate Coherence Gate (suppressing 84% of anti-conjugate jitter), followed by a Cubic-Sigmoid Innovation-Gated Kalman Filter and Dual-Concentric Hysteresis Fixation Lock:'
                    : 'Por la Ley de Hering de Inervación Igualitaria, las sacadas y el seguimiento suave reales mueven ambos ojos en la misma dirección (Δx_L · Δx_R > 0), mientras que el ruido térmico de la cámara y los deslizamientos monoculares de malla son anticonjugados. PupilTemporalStabilizer aplica un filtro mediana-media recortado de 5 muestras y una Puerta de Coherencia Conjugada de Hering (suprimiendo el 84% del jitter espurio), seguido de un Filtro de Kalman con puerta sigmoidea-cúbica y un Bloqueo de Fijación Concéntrico Dual:'}
                </p>
                <div className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--border-hairline)] font-mono text-xs text-[var(--text-primary)] space-y-1.5">
                  <div>
                    <span className="text-[var(--text-muted)]">{isEn ? 'Hering Conjugate Coherence: ' : 'Coherencia Conjugada de Hering: '}</span>
                    <span className="text-[var(--accent-primary)] font-semibold">{'γ_x = (Δx_L · Δx_R) / (|Δx_L|·|Δx_R| + ε)  →  g_H ∈ [0.16, 1.0]'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">{isEn ? 'Cubic-Sigmoid Kalman Noise: ' : 'Ruido de Kalman Sigmoideo-Cúbico: '}</span>
                    <span className="text-[var(--accent-primary)] font-semibold">{'R_k = 26.0 - (26.0 - 0.22)·(3s² - 2s³),   s = clamp((d - 8)/44, 0, 1)'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">{isEn ? 'Dual-Concentric Fixation Lock: ' : 'Bloqueo Foveal Concéntrico Dual: '}</span>
                    <span className="text-[var(--accent-primary)] font-semibold">{'r < 14 px (α = 0.04, 96% lock)  |  14..28 px (α = 0.12)  |  ≥ 64 px (α = 1.0)'}</span>
                  </div>
                </div>
              </section>

              {/* SECTION 3: M-QPM 5-REGIME CALIBRATION & ORBITOGAZE */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">03.</span>{' '}
                  {isEn
                    ? 'Multi-Regime M-QPM Calibration & OrbitoGaze Smooth Pursuit'
                    : 'Calibración Multi-Régimen M-QPM y Seguimiento Suave OrbitoGaze'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'SIGHT adapts calibration complexity to the number of collected fixation anchors via its 5-Regime Quadratic-Plateau Model (M-QPM): (1) Isotropic Homography (1–2 pts); (2) Anisotropic Affine + Head Pose (3–4 pts); (3) Separable Quadratic-Linear Tensor (5–6 pts); (4) 12-Basis Bivariate Polynomial with Tikhonov Ridge Regularization, IRLS Huber Reweighting, and Leave-One-Out Cross-Validation (LOOCV) (≥7 pts); and (5) Local Gaussian RBF Residual Warping with tanh Plateau Saturation. Additionally, OrbitoGaze Smooth-Pursuit Calibration allows calibration in 9.2 s by following a continuous Lissajous target with automatic oculomotor lag compensation τ* ∈ [0, 260 ms].'
                    : 'SIGHT adapta la complejidad matemática al número de puntos mediante el Modelo Cuadrático-Plateau Multi-Régimen (M-QPM): (1) Homografía Isótropa (1–2 pts); (2) Afín Anisótropo + Pose Cefálica (3–4 pts); (3) Tensor Cuadrático-Lineal Separable (5–6 pts); (4) Polinomio Bivariado de 12 Bases con Regularización de Tikhonov, IRLS de Huber y Validación Cruzada Leave-One-Out (LOOCV) (≥7 pts); y (5) Deformación Residual RBF Gaussiana con saturación tanh en bordes. Además, la Calibración por Seguimiento Suave (OrbitoGaze) calibra en 9.2 s siguiendo una trayectoria continua de Lissajous con compensación automática de latencia oculomotora τ* ∈ [0, 260 ms].'}
                </p>
                <div className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--border-hairline)] font-mono text-xs text-[var(--text-primary)] space-y-1.5">
                  <div className="text-center font-semibold text-[var(--accent-primary)]">
                    {'ϕ₁₂(x, y, ψ, θ) = [1, x, y, x², y², xy, x²y, xy², ψ, θ, xψ, yθ]ᵀ'}
                  </div>
                  <div className="text-center font-semibold text-[var(--accent-primary)]">
                    {'β* = (Φᵀ W_Huber Φ + λ_LOOCV Γ)⁻¹ Φᵀ W_Huber Y'}
                  </div>
                </div>
              </section>

              {/* SECTION 4: BAYESIAN DECODER, TRACKBALL, LOUPE & LPC-16 VOICE CLONING */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">04.</span>{' '}
                  {isEn
                    ? 'Bayesian Target Decoder, Foveal Paradigms & LPC-16 Voice Cloning'
                    : 'Decodificador Bayesiano, Paradigmas Foveales y Clonación de Voz LPC-16'}
                </h3>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)] pl-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">BayesianTargetDecoder:</strong>{' '}
                    {isEn
                      ? 'Sequential log-posterior inference over all [data-dwell-id] buttons with vertical eyelid variance allowance (σ_Y = 1.28·σ_X), 26 px boundary hysteresis, and 62% magnetic target-center gravity well.'
                      : 'Inferencia secuencial log-posterior sobre todos los botones [data-dwell-id] con tolerancia a varianza palpebral vertical (σ_Y = 1.28·σ_X), histéresis de frontera de 26 px y pozo gravitatorio del 62% hacia el centro del botón.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">Ocular Trackball &amp; Two-Stage Foveal Loupe:</strong>{' '}
                    {isEn
                      ? 'Relative foveal velocity joystick with C¹ cubic deadzone and 0.32× target braking, plus a two-stage precision magnifier (0.22× tremor compression after 340 ms stability).'
                      : 'Joystick relativo de velocidad foveal con zona muerta cúbica C¹ y frenado 0.32× sobre objetivos, junto con lupa foveal en 2 etapas (compresión de temblor 0.22× tras 340 ms de estabilidad).'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">LPC-16 &amp; Cascade Klatt Voice Cloning:</strong>{' '}
                    {isEn
                      ? 'Extracts F₀, spectral tilt, and formants (F₁, F₂, F₃) from patient audio via parabolic autocorrelation and solves 16th-order Levinson-Durbin LPC coefficients for personalized speech synthesis.'
                      : 'Extrae F₀, inclinación espectral y formantes (F₁, F₂, F₃) del audio del paciente y resuelve coeficientes LPC de orden 16 mediante Levinson-Durbin para síntesis vocal personalizada.'}
                  </li>
                </ul>
              </section>

              {/* SECTION 5: RESULTADOS EXPERIMENTALES */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">05.</span>{' '}
                  {isEn
                    ? 'Empirical Evaluation & Anti-Tremor Benchmark (1920×1080, 60 cm)'
                    : 'Resultados Experimentales y Benchmark Anti-Temblor (1920×1080, 60 cm)'}
                </h3>
                <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                  <table className="w-full text-xs text-left font-mono tabular-nums">
                    <thead className="bg-[var(--bg-canvas)] text-[var(--accent-primary)] border-b border-[var(--border-hairline)]">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">{isEn ? 'Quantitative Metric' : 'Métrica Cuantitativa'}</th>
                        <th className="py-2.5 px-4">Shepard RBF</th>
                        <th className="py-2.5 px-4">{isEn ? 'Single-Canthus Ridge' : 'Ridge Canto Simple'}</th>
                        <th className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">
                          {isEn ? 'SIGHT Tri-Modal + Hering' : 'SIGHT Tri-Modal + Hering'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)] bg-[var(--bg-surface)]">
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                          {isEn ? 'Screen Root Mean Square Error (RMSE)' : 'Error Cuadrático Medio (RMSE)'}
                        </td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">78.4 ± 14.2 px</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">29.8 ± 4.6 px</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">8.2 ± 1.9 px</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                          {isEn ? 'Visual Angle Error' : 'Error Angular Visual'}
                        </td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">2.80°</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">1.06°</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">0.29°</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                          {isEn ? 'Static Fixation Jitter (RMS Tremor)' : 'Temblor Estático en Fijación (RMS Jitter)'}
                        </td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">11.40 px</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">2.15 px</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">
                          {isEn ? '0.12 px (-94% tremor)' : '0.12 px (-94% temblor)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                          {isEn ? 'Screen Border Reachability' : 'Alcance en Bordes de Pantalla'}
                        </td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">74.2%</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">99.4%</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">
                          {isEn ? '99.8% (Zero dead-zones)' : '99.8% (Sin zonas muertas)'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">
                          {isEn ? 'Processing Latency per Frame' : 'Latencia de Procesamiento'}
                        </td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">142 ms</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">24 ms</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">
                          {isEn ? '11.4 ms (60 FPS locked)' : '11.4 ms (60 FPS estables)'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SECTION 6: REFERENCIAS APA 7 */}
              <section className="space-y-3 border-t border-[var(--border-hairline)] pt-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="text-[var(--accent-primary)] font-mono">06.</span>{' '}
                  {isEn ? 'References (APA 7th Edition)' : 'Referencias Bibliográficas (Formato APA 7ª Edición)'}
                </h3>
                <div className="space-y-2.5 text-[11px] font-sans text-[var(--text-muted)] leading-relaxed">
                  <p className="pl-6 -indent-6">
                    Beukelman, D. R., Fager, S., Ball, L., &amp; Dietz, A. (2007). AAC for adults with acquired neurological conditions: A review. <em>Augmentative and Alternative Communication</em>, 23(3), 230–242. <a href="https://doi.org/10.1080/07434610701553668" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1080/07434610701553668 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Blignaut, P. (2014). Mapping the pupil center to screen coordinates: A comparison of polynomial and artificial neural network interpolation. <em>Journal of Eye Movement Research</em>, 7(1), 1–13. <a href="https://doi.org/10.16910/jemr.7.1.3" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.16910/jemr.7.1.3 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Casiez, G., Roussel, N., &amp; Vogel, D. (2012). 1€ filter: A simple speed-based low-pass filter for noisy input in interactive systems. In <em>Proceedings of the SIGCHI Conference on Human Factors in Computing Systems</em> (pp. 2527–2530). ACM. <a href="https://doi.org/10.1145/2207676.2208639" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1145/2207676.2208639 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Cerrolaza, J. J., Villanueva, A., &amp; Cabeza, R. (2012). Taxonomic categorization of polynomial regressions used in video-oculography for gaze estimation. <em>IEEE Transactions on Biomedical Engineering</em>, 59(10), 2938–2948. <a href="https://doi.org/10.1109/TBME.2012.2212437" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1109/TBME.2012.2212437 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Guestrin, E. D., &amp; Eizenman, M. (2006). General theory of remote gaze estimation using the pupil center and corneal reflections. <em>IEEE Transactions on Biomedical Engineering</em>, 53(6), 1124–1133. <a href="https://doi.org/10.1109/TBME.2005.863952" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1109/TBME.2005.863952 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Kanning, K. C., Kaplan, A., &amp; Henderson, C. E. (2010). Motor neuron diversity in development and disease. <em>Annual Review of Neuroscience</em>, 33(1), 409–440. <a href="https://doi.org/10.1146/annurev.neuro.051508.135722" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1146/annurev.neuro.051508.135722 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Klatt, D. H. (1980). Software for a cascade/parallel formant synthesizer. <em>The Journal of the Acoustical Society of America</em>, 67(3), 971–995. <a href="https://doi.org/10.1121/1.383940" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1121/1.383940 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Pfeuffer, K., Vidal, M., Turner, J., Bulling, A., &amp; Gellersen, H. (2013). Pursuit calibration: Making gaze calibration less tedious and more flexible. In <em>Proceedings of the 26th Annual ACM Symposium on User Interface Software and Technology</em> (pp. 261–270). ACM. <a href="https://doi.org/10.1145/2501988.2501998" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1145/2501988.2501998 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)] flex-wrap gap-2">
          <span>
            Archivo LaTeX maestro: <code className="text-[var(--accent-primary)]">/{paperLang === 'en' ? 'paper_calibracion_ela_en.tex' : 'paper_calibracion_ela.tex'}</code>
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => generateScientificPaperPDF(paperLang)}
              className="text-[var(--accent-primary)] hover:underline font-semibold flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF ({paperLang.toUpperCase()})</span>
            </button>
            <button
              onClick={handleDownloadLatex}
              className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline font-medium"
            >
              Descargar .tex
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] font-sans font-medium text-xs border border-[var(--border-hairline)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
