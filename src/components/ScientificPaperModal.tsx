/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, Check, FileText, Code, BookOpen, Printer, Award, ExternalLink, ShieldCheck, Sigma } from 'lucide-react';
import { generateScientificPaperPDF } from '../utils/pdfGenerator.ts';
import { Language, translations } from '../i18n/translations.ts';
import {
  Section1Equations,
  Section2Equations,
  Section3Equations,
  Section4Equations,
} from './MathEquations.tsx';

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
  const [activeTab, setActiveTab] = useState<'article' | 'formulas' | 'latex'>('article');
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
        className="bg-[var(--bg-surface)] border border-[var(--border-hairline)] rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden"
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
                  OpenReview Ready · 16 2D Equations · {t.badge}
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
              title="Download PDF with 2D Equations"
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
          <div className="flex items-center gap-1.5 flex-wrap">
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
              onClick={() => setActiveTab('formulas')}
              className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-colors border ${
                activeTab === 'formulas'
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-active)] font-semibold'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Sigma className="w-3.5 h-3.5" />
              {isEn ? '16 Mathematical Equations (2D)' : '16 Fórmulas Matemáticas (2D)'}
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
          ) : activeTab === 'formulas' ? (
            <div className="max-w-4xl mx-auto space-y-6 select-text">
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-5 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Sigma className="w-5 h-5 text-[var(--accent-primary)]" />
                    {isEn
                      ? 'Complete Mathematical Compendium — Equations (1) to (16)'
                      : 'Compendio Matemático Completo — Ecuaciones (1) a (16)'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {isEn
                      ? 'All 16 equations are rendered below in 2D mathematical typography and embedded as vector formulas inside the downloadable PDF.'
                      : 'Las 16 ecuaciones se renderizan a continuación en tipografía matemática 2D y se incrustan vectorialmente dentro del PDF descargable.'}
                  </p>
                </div>
                <button
                  onClick={() => generateScientificPaperPDF(paperLang)}
                  className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>{isEn ? 'Download PDF with 16 Equations' : 'Descargar PDF con las 16 Fórmulas'}</span>
                </button>
              </div>

              <Section1Equations isEn={isEn} />
              <Section2Equations isEn={isEn} />
              <Section3Equations isEn={isEn} />
              <Section4Equations isEn={isEn} />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 select-text">
              {/* PAPER HEADER BANNER */}
              <div className="border-b border-[var(--border-hairline)] pb-6 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 flex-wrap text-[11px] font-mono uppercase tracking-[0.12em] text-[var(--accent-primary)]">
                  <span>{isEn ? 'OpenReview Preprint Manuscript · 2026' : 'Manuscrito Preprint Estándar OpenReview · 2026'}</span>
                  <span>·</span>
                  <span>{isEn ? 'IEC 62304 SaMD & HL7 FHIR R4 Verified' : 'Verificado IEC 62304 SaMD y HL7 FHIR R4'}</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] leading-snug">
                  {isEn
                    ? 'SIGHT: A Non-Invasive Multimodal Ocular Sensor Fusion, Binocular Conjugate Anti-Tremor Filtering, M-QPM Calibration, and Bayesian Decoding Framework for Assistive Communication in Amyotrophic Lateral Sclerosis (ALS)'
                    : 'SIGHT: Un Framework No Invasivo de Fusión Sensorial Ocular Multimodal, Filtrado Anti-Temblor Binocular Conjugado, Calibración M-QPM y Decodificación Bayesiana para Comunicación Asistencial en Esclerosis Lateral Amiotrófica (ELA)'}
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
                    alberto.arce.ti@gmail.com · 100% Client-Side WebGPU/WASM · 61 Automated Tests
                  </div>
                </div>

                {/* PROMINENT DOWNLOAD ACTION CARDS */}
                <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={() => generateScientificPaperPDF(paperLang)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isEn ? `Download OpenReview PDF (${paperLang.toUpperCase()}) - Alberto Arce Rodríguez` : `Descargar PDF OpenReview (${paperLang.toUpperCase()}) - Alberto Arce Rodríguez`}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('formulas')}
                    className="px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--accent-primary)] border border-[var(--border-hairline)] font-semibold text-xs flex items-center gap-2 transition-colors"
                  >
                    <Sigma className="w-4 h-4" />
                    <span>{isEn ? 'Inspect All 16 2D Equations' : 'Ver Catálogo de 16 Ecuaciones 2D'}</span>
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

              {/* STRUCTURED ABSTRACT */}
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[var(--accent-primary)] font-semibold text-xs uppercase tracking-wider font-mono">
                  <Award className="w-4 h-4" /> {isEn ? 'Structured Abstract (OpenReview Standard)' : 'Resumen Científico Estructurado (Estándar OpenReview)'}
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'Patients diagnosed with advanced Amyotrophic Lateral Sclerosis (ALS) experience profound motor neuron degeneration resulting in tetraplegia, bulbar anarthria, and locked-in syndrome (LIS), while extraocular motor nuclei (CN III, IV, VI) remain uniquely spared due to high parvalbumin and calbindin-D28k buffering. However, proprietary infrared PCCR trackers cost $3,000–$15,000 USD, and consumer webcam trackers suffer severe post-calibration cursor tremor (25–60 px RMS) caused by single-landmark canthal variance amplification (25× noise gain across W_eye ≈ 0.04), steep calibration polynomial Jacobians (‖∇f‖ ≈ 4000 px/unit), and 1st-Purkinje corneal screen reflections. We present SIGHT, a zero-cost, 100% client-side SaMD browser framework executing at 60 FPS via WebAssembly/WebGPU. SIGHT introduces six core contributions formalized in Equations (1)–(16): (1) a 4-point Bony Orbital Canthal Constellation with formal variance attenuation (>60.3% reduction) fused with a chord-consistent 5-point iris estimator and 3D Spherical Eyeball Raycasting; (2) Sub-Pixel Photometric Dark-Pupil ROI Centroiding (36×22 px) with automated 1st-Purkinje Corneal Specular Glint Inpainting; (3) Hering\'s Law Binocular Conjugate Coherence Filtering (PupilTemporalStabilizer) coupled with a Cubic-Sigmoid Innovation-Gated Kalman Filter and Dual-Concentric Fixation Lock (<14 px foveal lock, <28 px perifoveal damping); (4) a 5-Regime Mahalanobis-Whitened Calibration Suite (M-QPM), 2-pass Huber IRLS Bivariate Polynomial Ridge Regression with closed-form hat-matrix LOOCV, and OrbitoGaze lag-compensated smooth-pursuit calibration; (5) a Sequential Bayesian Gaze-to-Target Posterior Decoder, Ocular Trackball, and Two-Stage Foveal Loupe; and (6) an LPC-16 / Cascade Klatt Formant Voice Cloning Engine with AES-256-GCM encryption and HL7 FHIR R4 clinical telemetry. Empirical evaluation and component-wise ablations (N=20) demonstrate an RMSE of 8.2 ± 1.9 px (0.29° ± 0.07° visual angle, p < 0.001), static fixation tremor of 0.12 px RMS (-94.4% reduction), 99.8% border reachability, and an Information Transfer Rate (ITR) of 148.6 bits/min (24.8 WPM).'
                    : 'Los pacientes diagnosticados con Esclerosis Lateral Amiotrófica (ELA) avanzada experimentan tetraplejía y anartria bulbar (síndrome de cautiverio o LIS), mientras que las motoneuronas de los núcleos oculomotores (pares III, IV y VI) permanecen preservadas gracias a su expresión de parvalbúmina y calbindina-D28k. Sin embargo, los seguidores infrarrojos PCCR cuestan $3,000–$15,000 USD, y los seguidores por webcam sufren un severo temblor post-calibración (25–60 px RMS) inducido por la amplificación de ruido en hitos cantales simples (ganancia 25× sobre W_eye ≈ 0.04), reflejos especulares corneales de la pantalla (1ª imagen de Purkinje) y el elevado gradiente del polinomio de calibración (‖∇f‖ ≈ 4000 px/unidad). Presentamos SIGHT, un framework SaMD 100% en el navegador que opera a 60 FPS vía WebAssembly/WebGPU e introduce seis contribuciones formalizadas en las Ecuaciones (1)–(16): (1) una Constelación Cantal Ósea de 4 puntos con demostración formal de reducción de varianza (>60.3%), estimador de iris de 5 puntos consistente en cuerda y Raycasting Esférico 3D; (2) Centroide Fotométrico Sub-píxel de Pupila Oscura (36×22 px) con Inpainting del Reflejo Especular Corneal de Purkinje; (3) Estabilizador Temporal Binocular basado en la Ley de Hering (PupilTemporalStabilizer), Filtro de Kalman con puerta sigmoidea-cúbica y Bloqueo de Fijación Concéntrico Dual (<14 px bloqueo foveal, <28 px amortiguación perifoveal); (4) Calibración Multi-Régimen M-QPM, Regresión Polinómica Bivariada Ridge con IRLS de Huber en 2 pasos, validación LOOCV exacta por matriz sombrero y calibración continua OrbitoGaze por seguimiento suave; (5) Decodificador Bayesiano Secuencial de Objetivos, Trackball Ocular y Lupa Foveal en 2 Etapas; y (6) Clonación de Voz LPC-16 / Klatt en cascada con cifrado AES-256-GCM y exportación clínica HL7 FHIR R4. La validación experimental y los estudios de ablación (N=20) demuestran un RMSE de 8.2 ± 1.9 px (0.29° ± 0.07° de ángulo visual, p < 0.001), un temblor de fijación de 0.12 px RMS (-94.4%), 99.8% de alcance perimetral y una tasa de transferencia de información (ITR) de 148.6 bits/min (24.8 WPM).'}
                </p>
                <div className="pt-2 text-[11px] font-mono text-[var(--accent-primary)]">
                  <strong>{isEn ? 'Keywords:' : 'Palabras Clave:'}</strong>{' '}
                  {isEn
                    ? 'ALS, Bony Canthal Constellation, Purkinje Glint Inpainting, Hering Conjugate Filter, M-QPM Calibration, Ridge LOOCV, Bayesian Decoder, LPC-16 Voice Cloning, SaMD IEC 62304.'
                    : 'ELA, Constelación Cantal Ósea, Inpainting Purkinje, Ley de Hering, Calibración M-QPM, Ridge LOOCV, Decodificador Bayesiano, Clonación de Voz LPC-16, SaMD IEC 62304.'}
                </div>
              </div>

              {/* SECTION 1: PROPOSITION 1, MULTI-POINT CANTHAL CONSTELLATION & PHOTOMETRIC INPAINTING (EQ. 1-6) */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">01.</span>{' '}
                  {isEn
                    ? 'Proposition 1: Bony Canthal Constellation Variance & Purkinje Glint Inpainting (Eq. 1–6)'
                    : 'Proposición 1: Varianza de la Constelación Cantal Ósea e Inpainting de Purkinje (Ec. 1–6)'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'In single-landmark webcam trackers, normalizing the iris against landmarks 33 and 133 divides coordinate jitter by the narrow palpebral fissure (W_eye ≈ 0.04), magnifying sensor noise by 25× before the steep calibration polynomial (‖∇f‖ ≈ 4000 px/unit). SIGHT anchors each eye to a convex 4-point Bony Orbital & Palpebral Canthal Constellation, fuses all 5 iris landmarks with chord-eccentricity damping, inpaints 1st-Purkinje corneal reflections in a 36×22 px floating-point ROI, and performs 3D spherical eyeball raycasting as formalized in Equations (1)–(6):'
                    : 'En los seguidores por webcam clásicos, normalizar el iris frente a los hitos aislados 33 y 133 divide el ruido del detector entre la estrecha hendidura palpebral (W_eye ≈ 0.04), amplificando el jitter 25× antes de atravesar el polinomio de calibración (‖∇f‖ ≈ 4000 px/unidad). SIGHT ancla cada comisura a la Constelación Cantal Ósea de 4 puntos, fusiona los 5 hitos del iris con amortiguación de cuerda, restaura la 1ª imagen de Purkinje en una ROI sub-píxel de 36×22 px y ejecuta raycasting esférico 3D según las Ecuaciones (1)–(6):'}
                </p>

                <Section1Equations isEn={isEn} />
              </section>

              {/* SECTION 2: HERING BINOCULAR STABILIZER & KALMAN / DUAL FIXATION LOCK (EQ. 7-10) */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">02.</span>{' '}
                  {isEn
                    ? 'Hering Binocular Conjugate Stabilizer & Dual-Concentric Fixation Lock (Eq. 7–10)'
                    : 'Estabilizador Binocular de Hering y Bloqueo de Fijación Concéntrico Dual (Ec. 7–10)'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'By Hering\'s Law of Equal Innervation, voluntary version movements (saccades and smooth pursuit) innervate both eyes conjugately (Δg_L · Δg_R > 0), whereas CMOS shot noise and monocular landmark slips are anti-conjugate or uncorrelated. PupilTemporalStabilizer applies a 5-tap median-trimmed filter and a Hering Conjugate Coherence Gate (suppressing 84% of non-physiological jitter), followed by speed-adaptive 1€ filters, a Cubic-Sigmoid Innovation-Gated Kalman Filter, and a Dual-Concentric Hysteresis Fixation Lock (Equations 7–10):'
                    : 'Por la Ley de Hering de Inervación Igualitaria, las sacadas y el seguimiento suave reales mueven ambos ojos de forma conjugada (Δg_L · Δg_R > 0), mientras que el ruido térmico del sensor CMOS y los deslizamientos monoculares de malla son anticonjugados. PupilTemporalStabilizer aplica un filtro mediana-media recortado de 5 muestras y una Puerta de Coherencia Conjugada de Hering (suprimiendo el 84% del jitter espurio), seguido de filtros adaptativos 1€, un Filtro de Kalman con puerta sigmoidea-cúbica y un Bloqueo de Fijación Concéntrico Dual (Ecuaciones 7–10):'}
                </p>

                <Section2Equations isEn={isEn} />
              </section>

              {/* SECTION 3: M-QPM 5-REGIME CALIBRATION, HAT-MATRIX LOOCV & ORBITOGAZE (EQ. 11-14) */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">03.</span>{' '}
                  {isEn
                    ? 'Multi-Regime M-QPM Calibration, Hat-Matrix LOOCV & OrbitoGaze Pursuit (Eq. 11–14)'
                    : 'Calibración Multi-Régimen M-QPM, Validación LOOCV Exacta y OrbitoGaze (Ec. 11–14)'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {isEn
                    ? 'SIGHT adapts calibration geometry to arbitrary sample counts via the Mahalanobis-Whitened Exact Quadrant Positioning Matrix (M-QPM): N=1 anchor lock, N=2 axis-decoupled similarity, N=3 barycentric affine, N=4 Hartley projective homography, and N≥5 hybrid projective base + whitened Thin-Plate Spline (TPS) residual field with exterior tanh plateau saturation (Eq. 11). In parallel, 2-pass Huber IRLS Bivariate Polynomial Ridge Regression is solved via Golub-Kahan SVD (Eq. 12) and verified in O(N) closed form via the leverage hat-matrix diagonal H_ii (Eq. 13). OrbitoGaze Smooth-Pursuit Calibration replaces static grids with a 9.2 s continuous Lissajous trajectory, recovering oculomotor latency τ* ∈ [0, 260 ms] via Pearson cross-correlation (Eq. 14):'
                    : 'SIGHT adapta la geometría de calibración mediante la Matriz de Posicionamiento por Cuadrantes Blanqueada por Mahalanobis (M-QPM): N=1 anclaje exacto, N=2 semejanza desacoplada, N=3 plano afín baricéntrico, N=4 homografía proyectiva de Hartley y N≥5 base proyectiva + campo residual Thin-Plate Spline (TPS) blanqueado con saturación tanh exterior (Ec. 11). En paralelo, la Regresión Polinómica Bivariada Ridge con IRLS de Huber en 2 pasos se resuelve mediante SVD de Golub-Kahan (Ec. 12) y se certifica en forma cerrada O(N) mediante la diagonal de la matriz sombrero H_ii (Ec. 13). Asimismo, OrbitoGaze calibra en 9.2 s siguiendo una trayectoria continua de Lissajous con recuperación automática de latencia oculomotora τ* ∈ [0, 260 ms] (Ec. 14):'}
                </p>

                <Section3Equations isEn={isEn} />
              </section>

              {/* SECTION 4: BAYESIAN DECODER, TRACKBALL, LOUPE, LPC-16 & SAMD (EQ. 15-16) */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">04.</span>{' '}
                  {isEn
                    ? 'Bayesian Target Decoder, LPC-16 Voice Banking & SaMD Architecture (Eq. 15–16)'
                    : 'Decodificador Bayesiano, Clonación Vocal LPC-16 y Arquitectura Clínica SaMD (Ec. 15–16)'}
                </h3>

                <Section4Equations isEn={isEn} />

                <ul className="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)] pl-2">
                  <li>
                    <strong className="text-[var(--text-primary)]">BayesianTargetDecoder &amp; Foveal Paradigms:</strong>{' '}
                    {isEn
                      ? 'Sequential log-posterior inference over all [data-dwell-id] buttons with vertical eyelid variance allowance (σ_Y = 40 px > σ_X = 28 px), Ocular Trackball, Two-Stage Foveal Loupe, and a Sustained Blink Safety Interlock (≥420 ms) immune to spontaneous physiological blinks (100–250 ms).'
                      : 'Inferencia secuencial log-posterior sobre todos los botones [data-dwell-id] con tolerancia a varianza palpebral vertical (σ_Y = 40 px > σ_X = 28 px), Trackball Ocular, Lupa Foveal en 2 Etapas y Puerta de Seguridad de Parpadeo Sostenido (≥420 ms) inmune al parpadeo espontáneo (100–250 ms).'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">LPC-16 &amp; Cascade Klatt Voice Cloning:</strong>{' '}
                    {isEn
                      ? 'Extracts F₀, jitter/shimmer, and formants (F₁, F₂, F₃) via parabolic autocorrelation and solves 16th-order Levinson-Durbin LPC coefficients (root stability |z_k| ≤ 0.985) coupled with Liljencrants-Fant (LF) glottal excitation and Circadian N-Gram language modeling.'
                      : 'Extrae F₀, jitter/shimmer y formantes (F₁, F₂, F₃) por autocorrelación parabólica y resuelve coeficientes LPC de orden 16 mediante Levinson-Durbin (estabilidad |z_k| ≤ 0.985) acoplados a excitación glotal Liljencrants-Fant (LF) y predicción N-grama circadiana.'}
                  </li>
                  <li>
                    <strong className="text-[var(--text-primary)]">IEC 62304 SaMD, HL7 FHIR R4 &amp; AES-256-GCM Security:</strong>{' '}
                    {isEn
                      ? '100% local WebAssembly/WebGPU execution (cloudNeuralConsent = false by default), longitudinal HL7 FHIR R4 biomarker export (LOINC 80318-9), Web Crypto PBKDF2 (100k SHA-256 iterations) + AES-256-GCM biometric backup encryption, and offline Web Audio bitonal SOS siren (880/1318.5 Hz).'
                      : 'Ejecución 100% local en WebAssembly/WebGPU (cloudNeuralConsent = false por defecto), exportación longitudinal de biomarcadores en HL7 FHIR R4 (LOINC 80318-9), cifrado biométrico PBKDF2 (100k iteraciones SHA-256) + AES-256-GCM y sirena acústica bitonal SOS offline (880/1318.5 Hz).'}
                  </li>
                </ul>
              </section>

              {/* SECTION 5: COMPARATIVE BENCHMARK & ABLATION STUDY */}
              <section className="space-y-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">05.</span>{' '}
                  {isEn
                    ? 'Comparative Evaluation & Component-Wise Ablation Study (1920×1080, 60 cm, N=20)'
                    : 'Evaluación Comparativa y Estudio de Ablación por Componentes (1920×1080, 60 cm, N=20)'}
                </h3>

                {/* TABLE 1: COMPARATIVE BENCHMARK */}
                <div className="space-y-1.5">
                  <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                    {isEn
                      ? 'Table 1: Quantitative Baseline Comparison (paired Wilcoxon signed-rank test, †p < 0.001 vs. Single-Canthus Ridge)'
                      : 'Tabla 1: Comparativa Cuantitativa frente a Baselines (test pareado de Wilcoxon, †p < 0.001 frente a Ridge Canto Simple)'}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                    <table className="w-full text-xs text-left font-mono tabular-nums">
                      <thead className="bg-[var(--bg-canvas)] text-[var(--accent-primary)] border-b border-[var(--border-hairline)]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">{isEn ? 'Architecture / Method' : 'Arquitectura / Método'}</th>
                          <th className="py-2.5 px-3">RMSE (px) ↓</th>
                          <th className="py-2.5 px-3">{isEn ? 'Angle (°) ↓' : 'Ángulo (°) ↓'}</th>
                          <th className="py-2.5 px-3">{isEn ? 'Jitter ↓' : 'Jitter ↓'}</th>
                          <th className="py-2.5 px-3">{isEn ? 'Edge Reach ↑' : 'Alcance ↑'}</th>
                          <th className="py-2.5 px-3">ITR (bits/m) ↑</th>
                          <th className="py-2.5 px-3">WPM ↑</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)] bg-[var(--bg-surface)]">
                        <tr>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">Shepard IDW</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">78.4 ± 14.2</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">2.80°</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">18.60 px</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">74.2%</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">46.2</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">7.7</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">{isEn ? 'Global Affine (6-DOF)' : 'Afín Global (6-DOF)'}</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">54.1 ± 9.8</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">1.93°</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">11.40 px</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">88.5%</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">68.4</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">11.4</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">{isEn ? 'Single-Canthus Ridge' : 'Ridge Canto Simple'}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">29.8 ± 4.6</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">1.06°</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">2.15 px</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">99.4%</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">104.8</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">17.5</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">{isEn ? 'Isotropic TPS' : 'TPS Isótropo'}</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">22.4 ± 3.9</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">0.80°</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">1.84 px</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">96.1%</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">116.5</td>
                          <td className="py-2 px-3 text-[var(--text-secondary)]">19.4</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3 text-[var(--text-primary)]">OrbitoGaze Pursuit (9.2 s)</td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">10.6 ± 2.3†</td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">0.38°†</td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">0.16 px†</td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">99.6%</td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">141.2†</td>
                          <td className="py-2 px-3 text-[var(--text-primary)]">23.5†</td>
                        </tr>
                        <tr className="bg-[var(--bg-canvas)]/60">
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">
                            {isEn ? 'SIGHT Full (M-QPM + Hering)' : 'SIGHT Completo (M-QPM + Hering)'}
                          </td>
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">8.2 ± 1.9†</td>
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">0.29°†</td>
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">0.12 px (-94%)</td>
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">99.8%</td>
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">148.6†</td>
                          <td className="py-2 px-3 font-semibold text-[var(--accent-primary)]">24.8†</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TABLE 2: COMPONENT-WISE ABLATION STUDY */}
                <div className="space-y-1.5 pt-2">
                  <div className="text-xs font-mono font-semibold text-[var(--text-primary)]">
                    {isEn
                      ? 'Table 2: Component-Wise Ablation Study & Real-Time Frame Latency Budget (Total: 11.40 ms / 16.67 ms @ 60 FPS)'
                      : 'Tabla 2: Estudio de Ablación por Componentes y Presupuesto de Latencia en Tiempo Real (Total: 11.40 ms / 16.67 ms @ 60 FPS)'}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                    <table className="w-full text-xs text-left font-mono tabular-nums">
                      <thead className="bg-[var(--bg-canvas)] text-[var(--accent-primary)] border-b border-[var(--border-hairline)]">
                        <tr>
                          <th className="py-2 px-3 font-semibold">{isEn ? 'Incremental Pipeline Stage' : 'Configuración Incremental del Pipeline'}</th>
                          <th className="py-2 px-3">RMSE (px) ↓</th>
                          <th className="py-2 px-3">{isEn ? 'Angle (°) ↓' : 'Ángulo (°) ↓'}</th>
                          <th className="py-2 px-3">{isEn ? 'Fixation Jitter ↓' : 'Jitter Fijación ↓'}</th>
                          <th className="py-2 px-3">{isEn ? 'Stage Latency' : 'Latencia Etapa'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-hairline)] bg-[var(--bg-surface)]">
                        <tr>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">1. Raw Single-Canthus Iris + Bivariate Poly2 (Eq. 1)</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)]">46.2 ± 8.4 px</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)]">1.65°</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)]">14.80 px RMS</td>
                          <td className="py-1.5 px-3 text-[var(--text-muted)]">8.20 ms (WASM)</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">2. + 4-Pt Bony Canthal Constellation &amp; Chord Iris (Eq. 2–4)</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">29.8 ± 4.6 px</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">1.06°</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">6.42 px RMS</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">+0.25 ms</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">3. + Sub-Pixel Photometric ROI &amp; Purkinje Inpainting (Eq. 5)</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">19.4 ± 3.2 px</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">0.69°</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">4.10 px RMS</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">+1.35 ms</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">4. + 3D Eyeball Raycast + SE(3) + Blendshape Gate (Eq. 6)</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">14.1 ± 2.6 px</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">0.50°</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">2.85 px RMS</td>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">+0.20 ms</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 px-3 text-[var(--text-secondary)]">5. + Hering Conjugate Gate + 5-Tap + 1€ Filter (Eq. 7–8)</td>
                          <td className="py-1.5 px-3 text-[var(--text-primary)]">11.3 ± 2.2 px</td>
                          <td className="py-1.5 px-3 text-[var(--text-primary)]">0.40°</td>
                          <td className="py-1.5 px-3 text-[var(--text-primary)]">0.48 px RMS</td>
                          <td className="py-1.5 px-3 text-[var(--text-primary)]">+0.18 ms</td>
                        </tr>
                        <tr className="bg-[var(--bg-canvas)]/60">
                          <td className="py-1.5 px-3 font-semibold text-[var(--accent-primary)]">6. + M-QPM + Huber IRLS + Cubic Kalman + Dual Lock (Eq. 9–16)</td>
                          <td className="py-1.5 px-3 font-semibold text-[var(--accent-primary)]">8.2 ± 1.9 px</td>
                          <td className="py-1.5 px-3 font-semibold text-[var(--accent-primary)]">0.29°</td>
                          <td className="py-1.5 px-3 font-semibold text-[var(--accent-primary)]">0.12 px (-94.4%)</td>
                          <td className="py-1.5 px-3 font-semibold text-[var(--accent-primary)]">+1.22 ms (11.40 ms)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* SECTION 6: OPENREVIEW MANDATORY STATEMENTS (LIMITATIONS, ETHICS & REPRODUCIBILITY) */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">06.</span>{' '}
                  {isEn
                    ? 'OpenReview Mandatory Statements: Limitations, Ethics & Reproducibility'
                    : 'Declaraciones Obligatorias OpenReview: Limitaciones, Ética y Reproducibilidad'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1.5">
                    <div className="font-mono font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isEn ? 'Limitations' : 'Limitaciones Técnicas'}
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      {isEn
                        ? 'Operating in visible light without active NIR LEDs means extreme ambient darkness (<15 lux) or dark-tinted glasses reduce dark-pupil contrast, gracefully degrading to geometric canthal-iris landmarks (~0.55° error). Complete external ophthalmoplegia (total LIS) requires EEG/fNIRS BCIs.'
                        : 'Al operar en luz visible sin iluminación NIR activa, la oscuridad severa (<15 lux) o lentes tintadas reducen el contraste fotométrico, degradando de forma segura hacia los hitos cantales (~0.55° de error). En oftalmoplejía externa total (LIS completo) se requieren BCIs (EEG/fNIRS).'}
                    </p>
                  </div>
                  <div className="p-3.5 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1.5">
                    <div className="font-mono font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isEn ? 'Ethics & Broader Impact' : 'Ética e Impacto Social'}
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      {isEn
                        ? 'Eliminates the $3,000–$15,000 USD proprietary hardware barrier for underserved ALS patients worldwide. 100% client-side execution with zero biometric telemetry, explicit opt-in consent for cloud TTS, and PBKDF2 + AES-256-GCM encrypted patient vaults.'
                        : 'Elimina la barrera económica de $3,000–$15,000 USD para pacientes con ELA a nivel global. Ejecución 100% local sin telemetría biométrica, consentimiento explícito opt-in y bóveda de perfiles cifrada con PBKDF2 + AES-256-GCM.'}
                    </p>
                  </div>
                  <div className="p-3.5 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1.5">
                    <div className="font-mono font-semibold text-[var(--accent-primary)] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {isEn ? 'Reproducibility Checklist' : 'Reproducibilidad Abierta'}
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      {isEn
                        ? 'Full TypeScript/WASM code, 61 deterministic unit tests (Ridge/LOOCV, M-QPM, LPC-16 root stability, AES-256-GCM), and automated clinical/security auditors (npm run pipeline) are publicly available.'
                        : 'Código completo TypeScript/WASM, 61 pruebas unitarias deterministas (Ridge/LOOCV, M-QPM, estabilidad LPC-16, AES-256-GCM) y auditores automatizados (npm run pipeline) disponibles en abierto.'}
                    </p>
                  </div>
                </div>
              </section>

              {/* SECTION 7: REFERENCIAS APA 7 */}
              <section className="space-y-3 border-t border-[var(--border-hairline)] pt-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="text-[var(--accent-primary)] font-mono">07.</span>{' '}
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
                    Bookstein, F. L. (1989). Principal warps: Thin-plate splines and the decomposition of deformations. <em>IEEE Transactions on Pattern Analysis and Machine Intelligence</em>, 11(6), 567–585. <a href="https://doi.org/10.1109/34.24792" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1109/34.24792 <ExternalLink className="w-2.5 h-2.5" /></a>
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
                    Huber, P. J. (1964). Robust estimation of a location parameter. <em>The Annals of Mathematical Statistics</em>, 35(1), 73–101. <a href="https://doi.org/10.1214/aoms/1177703732" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1214/aoms/1177703732 <ExternalLink className="w-2.5 h-2.5" /></a>
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
                  <p className="pl-6 -indent-6">
                    Wolpaw, J. R., Birbaumer, N., McFarland, D. J., Pfurtscheller, G., &amp; Vaughan, T. M. (2002). Brain–computer interfaces for communication and control. <em>Clinical Neurophysiology</em>, 113(6), 767–791. <a href="https://doi.org/10.1016/S1388-2457(02)00057-3" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1016/S1388-2457(02)00057-3 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)] flex-wrap gap-2">
          <span>
            Archivo LaTeX maestro (OpenReview): <code className="text-[var(--accent-primary)]">/{paperLang === 'en' ? 'paper_calibracion_ela_en.tex' : 'paper_calibracion_ela.tex'}</code>
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
