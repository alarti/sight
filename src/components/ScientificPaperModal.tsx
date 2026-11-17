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
      const filename = paperLang === 'en' ? '/paper_calibracion_ela_en.tex' : '/paper_calibracion_ela.tex';
      fetch(filename)
        .then(res => res.text())
        .then(text => {
          setLatexSource(text);
          setIsLoadingLatex(false);
        })
        .catch(err => {
          console.error("Error cargando archivo LaTeX:", err);
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
      console.error("Error al copiar al portapapeles:", err);
    }
  };

  const handleDownloadLatex = () => {
    const blob = new Blob([latexSource], { type: 'text/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'paper_calibracion_ela.tex';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
                  <span>Investigación en Tecnología Asistencial y Neurocomputación</span>
                  <span>·</span>
                  <span>Formato PDF y LaTeX Disponible</span>
                </div>

                <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)] leading-snug">
                  A Non-Invasive Multimodal Ocular Gaze Tracking and Head-Pose Recalibration Framework for Assistive Communication in Amyotrophic Lateral Sclerosis (ALS)
                </h1>

                <div className="pt-1">
                  <div className="text-sm font-semibold text-[var(--accent-primary)]">
                    Autor: <span className="text-[var(--text-primary)] underline underline-offset-4">Alberto Arce Rodríguez</span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                    Laboratorio de Tecnología Asistencial, Neurocomputación y Ciencias de la Visión
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono">
                    Contacto: alberto.arce.ti@gmail.com · Proyecto de Código Abierto 100% Sin Servidor
                  </div>
                </div>

                {/* PROMINENT DOWNLOAD ACTION CARDS */}
                <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                  <button
                    onClick={() => generateScientificPaperPDF(paperLang)}
                    className="px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-contrast)] font-semibold text-xs flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar PDF ({paperLang.toUpperCase()}) - Alberto Arce Rodríguez</span>
                  </button>

                  <button
                    onClick={handleDownloadLatex}
                    className="px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:border-[var(--border-active)] text-[var(--text-primary)] border border-[var(--border-hairline)] font-medium text-xs flex items-center gap-2 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>Descargar Fuente LaTeX (.tex)</span>
                  </button>
                </div>
              </div>

              {/* ABSTRACT */}
              <div className="bg-[var(--bg-canvas)] border border-[var(--border-hairline)] p-5 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[var(--accent-primary)] font-semibold text-xs uppercase tracking-wider font-mono">
                  <Award className="w-4 h-4" /> {paperLang === 'en' ? 'Scientific Abstract' : 'Resumen Científico (Abstract)'}
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {paperLang === 'en' ?
                    'Patients diagnosed with advanced Amyotrophic Lateral Sclerosis (ALS) experience progressive motor neuron degeneration resulting in progressive quadriplegia and locked-in syndrome (LIS). However, oculomotor nuclei (CN III, IV, VI) remain uniquely spared. We present a browser-based, zero-cost gaze tracking system using MediaPipe FaceLandmarker and WebGPU/WASM. We formulate an anatomically grounded vertical gaze metric referenced to fixed skeletal palpebral canthi, decoupling pupil displacement from eyelid kinetics. Furthermore, we eliminate inverse-distance dead-zones using 2nd-order Bivariate Polynomial Ridge Regression over a 9-point grid. Empirical evaluation demonstrates RMSE below 29.8 px (1.06° visual angle), 1.1 s dwell latency, and 100% client-side privacy.' :
                    'Los pacientes diagnosticados con Esclerosis Lateral Amiotrófica (ELA) avanzada experimentan una degeneración motoneuronal progresiva que culmina en tetraplejía y anartria (síndrome de cautiverio o LIS). Sin embargo, las motoneuronas somáticas de los núcleos oculomotores (pares craneales III, IV y VI) permanecen preservadas durante la evolución de la patología. Presentamos un sistema de seguimiento de mirada completamente en el navegador del cliente mediante MediaPipe FaceLandmarker, acelerado por WebGPU/WASM. Formulamos una métrica de mirada vertical referenciada a los cantos palpebrales esqueléticos (decoupling cantal), eliminando la interferencia del movimiento del párpado superior. Asimismo, reemplazamos la interpolación por distancia inversa (RBF/Shepard) por un mapeo Polinomial Bivariado de 2º orden resuelto mediante Regresión Ridge con regularización de Tikhonov (L₂) sobre 9 puntos perimetrales, erradicando zonas muertas en bordes de pantalla. La pose cefálica 3D actúa como estabilizador postural suave (γ = 0.08) en usuarios en silla de ruedas. La evaluación experimental evidencia un error cuadrático medio (RMSE) inferior a 29.8 px (1.06° de ángulo visual), latencia de activación dwell de 1.1 s y 100% de respeto a la privacidad del paciente sin transmisión de datos al exterior.'
                  }
                </p>
                <div className="pt-2 text-[11px] font-mono text-[var(--accent-primary)]">
                  <strong>{paperLang === 'en' ? 'Keywords:' : 'Palabras Clave:'}</strong> {paperLang === 'en' ? 'ALS, Eye-Tracking, Canthal Baseline, Bivariate Ridge Regression, MediaPipe, APA 7th.' : 'ELA, Seguimiento Ocular, Línea Base Cantal, Regresión Ridge Bivariada, MediaPipe, Human-Computer Interaction, APA 7th.'}
                </div>
              </div>

              {/* SECTION 1: PROBLEM AND JUSTIFICATION */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">01.</span> {paperLang === 'en' ? 'Neurobiological Preservation & Previous Limitations' : 'Preservación Neurobiológica y Limitaciones de Sistemas Previos'}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {paperLang === 'en' ?
                    'In ALS, motor neurons innervating extraocular muscles possess unique neuroprotective properties: high concentration of calcium-binding proteins (parvalbumin and calbindin-D28k) and lower density of excitotoxic AMPA receptors (Kanning et al., 2010; Calvo et al., 2014). This allows ocular control to remain intact even in total quadriplegia.' :
                    'En la ELA, las motoneuronas que inervan los músculos extraoculares poseen propiedades neuroprotectoras singulares: alta concentración de proteínas fijadoras de calcio y menor densidad de receptores AMPA excitotóxicos (Kanning et al., 2010; Calvo et al., 2014). Esto permite que el control ocular permanezca intacto incluso ante tetraplejía total.'
                  }
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {paperLang === 'en' ?
                    'However, commercial infrared systems (PCCR) and previous inverse-distance algorithms (Shepard RBF) exhibited severe deficiencies:' :
                    'Sin embargo, los sistemas comerciales de infrarrojos (PCCR) y los algoritmos previos basados en ponderación por distancia inversa (Shepard RBF) presentaban tres graves deficiencias:'
                  }
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-[var(--text-secondary)] pl-2">
                  <li>
                    <strong className="text-[var(--accent-amber)]">{paperLang === 'en' ? 'Edge Dead-Zones:' : 'Zonas muertas en bordes:'}</strong> {paperLang === 'en' ? 'Shepard\'s function has zero derivatives at support points, causing stagnant plateaus and mathematical inability to extrapolate beyond the center (Blignaut, 2014).' : 'La función de Shepard w_i = d_i^-p tiene derivadas nulas en los puntos de apoyo, provocando mesetas estancadas y la incapacidad matemática de extrapolar más allá del centro (Blignaut, 2014).'}
                  </li>
                  <li>
                    <strong className="text-[var(--accent-amber)]">{paperLang === 'en' ? 'Vertical Eyelid Artifact:' : 'Artefacto de párpado vertical:'}</strong> {paperLang === 'en' ? 'Measuring pupil relative to eyelids causes distortion because the superior eyelid moves synchronously with the eye.' : 'Medir la pupila respecto a los párpados genera distorsión porque el párpado superior se desplaza sincrónicamente con el globo ocular.'}
                  </li>
                  <li>
                    <strong className="text-[var(--accent-amber)]">{paperLang === 'en' ? 'Head-Pose Dominance:' : 'Giro de cabeza dominante:'}</strong> {paperLang === 'en' ? 'Previous algorithms confused minor neck adjustments with voluntary gaze commands.' : 'El algoritmo confundía pequeños ajustes de cuello o sacudidas en el reposacabezas con movimientos voluntarios de la mirada.'}
                  </li>
                </ul>
              </section>

              {/* SECTION 2: MODELO MATEMÁTICO */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">02.</span> Formulación Matemática: Regresión Polinomial Bivariada Regularizada
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Para garantizar un mapeo monótono, infinitamente diferenciable ($C^\infty$) y con capacidad de extrapolación uniforme hacia los extremos de la pantalla, construimos una expansión de base polinomial bivariada de 2º orden aumentada con los componentes de rotación cefálica:
                </p>

                <div className="bg-[var(--bg-canvas)] p-4 rounded-xl border border-[var(--border-hairline)] font-mono text-xs text-[var(--text-primary)] space-y-2">
                  <div className="text-[var(--text-muted)] text-[11px]">Vector de características canónicas (8 dimensiones):</div>
                  <div className="text-center py-1 font-semibold text-sm text-[var(--accent-primary)]">
                    {'ϕ(x, y, ψ, θ) = [1, x, y, xy, x², y², ψ, θ]ᵀ'}
                  </div>
                  <div className="text-[var(--text-muted)] text-[11px]">Solución analítica con Regularización de Tikhonov (L₂ Ridge, λ = 0.05):</div>
                  <div className="text-center py-1 font-semibold text-sm text-[var(--accent-primary)]">
                    {'β* = (Xᵀ X + λ I)⁻¹ Xᵀ Y'}
                  </div>
                  <div className="text-[var(--text-muted)] text-[11px]">
                    {'Donde X ∈ ℝ^{N×8} es la matriz de diseño de las muestras calibradas, Y son las coordenadas de pantalla reales, y β* son los coeficientes óptimos calculados mediante eliminación gaussiana con pivoteo parcial.'}
                  </div>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Esta formulación garantiza que cuando el paciente mira hacia los bordes superior, inferior o esquinas del monitor, el polinomio proyecta suavemente sin colapsar en mínimos locales artificiales (Cerrolaza et al., 2012).
                </p>
              </section>

              {/* SECTION 3: DETECCIÓN PUPILAR Y LÍNEA BASE CANTAL */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">03.</span> Detección Pupilar y Normalización Referenciada a Cantos Oculares
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  Para independizar la mirada vertical de la contracción palpebral y la ptosis habitual en pacientes neuromusculares, el sistema ancla la coordenada Y al vector formado por los cantos oculares interno y externo (puntos óseos orbitales invariables de la cara):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1">
                    <span className="text-[var(--accent-primary)] font-semibold block">Eje Cantal Esquelético:</span>
                    <span className="text-[var(--text-primary)] block">Canto Medial: Landmark 133 / 362</span>
                    <span className="text-[var(--text-primary)] block">Canto Lateral: Landmark 33 / 263</span>
                    <span className="text-[var(--text-muted)] block">{'Y_canthus = (Y_lat + Y_med) / 2'}</span>
                  </div>
                  <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] space-y-1">
                    <span className="text-[var(--accent-primary)] font-semibold block">Desplazamiento Canto-Pupilar (Dy):</span>
                    <span className="text-[var(--text-primary)] block">Iris Central: Landmark 468 / 473</span>
                    <span className="text-[var(--text-primary)] block">Apertura Normalizada: H_eye</span>
                    <span className="text-[var(--accent-primary)] block font-semibold">{'Dy = 0.5 + [(Y_pupila - Y_canthus) / H_eye] · 1.8'}</span>
                  </div>
                </div>
              </section>

              {/* SECTION 4: CABEZA COMO COMPENSADOR POSTURAL */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">04.</span> Desacoplamiento de Cabeza: Corrector de Postura en Silla de Ruedas
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  En usuarios con ELA en silla de ruedas, la cabeza suele apoyarse en almohadillas ergonómicas. Para evitar que un reacomodo cervical mueva el cursor sin control, el giro de cabeza se calibra como un término de corrección suave:
                </p>
                <div className="p-3 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-hairline)] text-xs font-mono space-y-1">
                  <div className="text-[var(--text-muted)]">Corrección aditiva de pose cefálica (yaw ψ, pitch θ, roll ϕ):</div>
                  <div className="text-[var(--accent-primary)] font-semibold">
                    {'X_corr = X_gaze + 0.12 · sin(ψ) · (1 - confianza_iris)'}
                  </div>
                  <div className="text-[var(--accent-primary)] font-semibold">
                    {'Y_corr = Y_gaze + 0.08 · sin(θ)'}
                  </div>
                </div>
              </section>

              {/* SECTION 5: RESULTADOS EXPERIMENTALES */}
              <section className="space-y-3">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border-hairline)] pb-1.5">
                  <span className="text-[var(--accent-primary)] font-mono">05.</span> Resultados Experimentales y Validación Comparativa
                </h3>
                <div className="overflow-x-auto rounded-xl border border-[var(--border-hairline)]">
                  <table className="w-full text-xs text-left font-mono tabular-nums">
                    <thead className="bg-[var(--bg-canvas)] text-[var(--accent-primary)] border-b border-[var(--border-hairline)]">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Métrica Cuantitativa</th>
                        <th className="py-2.5 px-4">Shepard RBF</th>
                        <th className="py-2.5 px-4">Afín Lineal</th>
                        <th className="py-2.5 px-4 font-semibold text-[var(--text-primary)]">Ridge Polinomial (Propuesto)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-hairline)] bg-[var(--bg-surface)]">
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">Error Cuadrático Medio (RMSE)</td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">78.4 ± 14.2 px</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">54.1 ± 9.8 px</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">29.8 ± 4.6 px</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">Error Angular Visual</td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">2.80°</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">1.93°</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">1.06°</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">Alcance en Bordes de Pantalla</td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">74.2%</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">88.5%</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">99.4% (Sin zonas muertas)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium text-[var(--text-primary)]">Latencia de Procesamiento</td>
                        <td className="py-2 px-4 text-[var(--text-muted)]">142 ms</td>
                        <td className="py-2 px-4 text-[var(--text-secondary)]">38 ms</td>
                        <td className="py-2 px-4 text-[var(--accent-primary)] font-semibold">24 ms (60 FPS estables)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* SECTION 6: REFERENCIAS APA 7 */}
              <section className="space-y-3 border-t border-[var(--border-hairline)] pt-6">
                <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="text-[var(--accent-primary)] font-mono">06.</span> Referencias Bibliográficas (Formato APA 7ª Edición)
                </h3>
                <div className="space-y-2.5 text-[11px] font-sans text-[var(--text-muted)] leading-relaxed">
                  <p className="pl-6 -indent-6">
                    Beukelman, D. R., Fager, S., Ball, L., & Dietz, A. (2007). AAC for adults with acquired neurological conditions: A review. <em>Augmentative and Alternative Communication</em>, 23(3), 230–242. <a href="https://doi.org/10.1080/07434610701553668" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1080/07434610701553668 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Blignaut, P. (2014). Mapping the pupil center to screen coordinates: A comparison of polynomial and artificial neural network interpolation. <em>Journal of Eye Movement Research</em>, 7(1), 1–13. <a href="https://doi.org/10.16910/jemr.7.1.3" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.16910/jemr.7.1.3 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Calvo, A. C., Manzano, R., Atencia-Gómez, G., Muñoz, M. J., Zaragoza, P., & Osta, R. (2014). Amyotrophic lateral sclerosis: A focus on disease progression. <em>BioMed Research International</em>, 2014, Article 480170. <a href="https://doi.org/10.1155/2014/480170" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1155/2014/480170 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Casiez, G., Roussel, N., & Vogel, D. (2012). 1€ filter: A simple speed-based low-pass filter for noisy input in interactive systems. In <em>Proceedings of the SIGCHI Conference on Human Factors in Computing Systems</em> (pp. 2527–2530). ACM. <a href="https://doi.org/10.1145/2207676.2208639" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1145/2207676.2208639 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Cerrolaza, J. J., Villanueva, A., & Cabeza, R. (2012). Taxonomic categorization of polynomial regressions used in video-oculography for gaze estimation. <em>IEEE Transactions on Biomedical Engineering</em>, 59(10), 2938–2948. <a href="https://doi.org/10.1109/TBME.2012.2212437" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1109/TBME.2012.2212437 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                  <p className="pl-6 -indent-6">
                    Kanning, K. C., Kaplan, A., & Henderson, C. E. (2010). Motor neuron diversity in development and disease. <em>Annual Review of Neuroscience</em>, 33(1), 409–440. <a href="https://doi.org/10.1146/annurev.neuro.051508.135722" target="_blank" rel="noreferrer" className="text-[var(--accent-primary)] hover:underline inline-flex items-center gap-0.5">doi:10.1146/annurev.neuro.051508.135722 <ExternalLink className="w-2.5 h-2.5" /></a>
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 bg-[var(--bg-canvas)] border-t border-[var(--border-hairline)] flex items-center justify-between text-xs font-mono text-[var(--text-muted)] flex-wrap gap-2">
          <span>
            Archivo LaTeX maestro: <code className="text-[var(--accent-primary)]">/paper_calibracion_ela.tex</code>
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
