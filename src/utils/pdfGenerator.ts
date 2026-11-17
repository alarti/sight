/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';

/**
 * Sanitizes any string for jsPDF's built-in WinAnsiEncoding (ISO-8859-1) fonts
 * so that characters > U+00FF never get truncated modulo 256 into corrupted glyphs.
 */
function sanitizeWinAnsi(input: string): string {
  return input
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/−/g, '-')
    .replace(/•/g, '*')
    .replace(/·/g, '.')
    .replace(/≈/g, '~')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/≠/g, '!=')
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/†/g, '(*)')
    .replace(/↓/g, '(v)')
    .replace(/↑/g, '(^)')
    .replace(/→/g, '->')
    .replace(/‖/g, '||')
    .replace(/∇/g, 'grad ')
    .replace(/∈/g, ' in ')
    .replace(/∑/g, 'Sum ')
    .replace(/√/g, 'sqrt');
}

/**
 * 2D Mathematical Typesetting AST for native vector rendering in jsPDF.
 * Uses built-in PDF Standard 14 Type1 fonts:
 * - 'times' (italic, bold, normal) for mathematical variables, vectors, functions, and numerals
 * - 'symbol' (normal) for Greek letters and mathematical operators in native Adobe SymbolEncoding
 * - Vector lines (doc.line) for horizontal fraction bars, square-root vinculum overbars, and piecewise braces
 */
type MathNode =
  | { kind: 'text'; val: string; style?: 'italic' | 'bold' | 'normal' }
  | { kind: 'sym'; val: string }
  | { kind: 'sub'; base: MathNode; sub: MathNode }
  | { kind: 'sup'; base: MathNode; sup: MathNode }
  | { kind: 'subsup'; base: MathNode; sub: MathNode; sup: MathNode }
  | { kind: 'frac'; num: MathNode; den: MathNode }
  | { kind: 'sum'; lower: MathNode; upper?: MathNode }
  | { kind: 'sqrt'; body: MathNode }
  | { kind: 'cases'; rows: Array<{ expr: MathNode; cond: MathNode }> }
  | { kind: 'seq'; items: MathNode[] };

// Shorthand constructors for building clean 2D equations
const T = (val: string, style: 'italic' | 'bold' | 'normal' = 'normal'): MathNode => ({ kind: 'text', val, style });
const V = (val: string): MathNode => ({ kind: 'text', val, style: 'italic' });
const B = (val: string): MathNode => ({ kind: 'text', val, style: 'bold' });
const S = (val: string): MathNode => ({ kind: 'sym', val });
const SUB = (base: MathNode, sub: MathNode): MathNode => ({ kind: 'sub', base, sub });
const SUP = (base: MathNode, sup: MathNode): MathNode => ({ kind: 'sup', base, sup });
const SUBSUP = (base: MathNode, sub: MathNode, sup: MathNode): MathNode => ({ kind: 'subsup', base, sub, sup });
const FRAC = (num: MathNode, den: MathNode): MathNode => ({ kind: 'frac', num, den });
const SUM = (lower: MathNode, upper?: MathNode): MathNode => ({ kind: 'sum', lower, upper });
const SQRT = (body: MathNode): MathNode => ({ kind: 'sqrt', body });
const CASES = (rows: Array<{ expr: MathNode; cond: MathNode }>): MathNode => ({ kind: 'cases', rows });
const SEQ = (...items: MathNode[]): MathNode => ({ kind: 'seq', items });

// Adobe SymbolEncoding character map for PDF Standard 14 'symbol' font
const SYM = {
  alpha: 'a',
  beta: 'b',
  gamma: 'g',
  delta: 'd',
  epsilon: 'e',
  kappa: 'k',
  lambda: 'l',
  mu: 'm',
  pi: 'p',
  rho: 'r',
  sigma: 's',
  tau: 't',
  phi: 'f',
  theta: 'q',
  psi: 'y',
  omega: 'w',
  Delta: 'D',
  Phi: 'F',
  Gamma: 'G',
  Sigma: 'S',
  le: String.fromCharCode(0xa3),
  ge: String.fromCharCode(0xb3),
  approx: String.fromCharCode(0xbb),
  in: String.fromCharCode(0xce),
  nabla: String.fromCharCode(0xd1),
  pm: String.fromCharCode(0xb1),
  times: String.fromCharCode(0xb4),
  cdot: String.fromCharCode(0xb7),
  to: String.fromCharCode(0xae),
};

function measureMathNode(doc: jsPDF, node: MathNode, fontSize: number): number {
  switch (node.kind) {
    case 'text': {
      doc.setFont('times', node.style || 'normal');
      doc.setFontSize(fontSize);
      return doc.getTextWidth(node.val);
    }
    case 'sym': {
      doc.setFont('symbol', 'normal');
      doc.setFontSize(fontSize);
      return doc.getTextWidth(node.val);
    }
    case 'sub':
      return measureMathNode(doc, node.base, fontSize) + measureMathNode(doc, node.sub, fontSize * 0.72) + 0.2;
    case 'sup':
      return measureMathNode(doc, node.base, fontSize) + measureMathNode(doc, node.sup, fontSize * 0.72) + 0.2;
    case 'subsup': {
      const wBase = measureMathNode(doc, node.base, fontSize);
      const wSub = measureMathNode(doc, node.sub, fontSize * 0.72);
      const wSup = measureMathNode(doc, node.sup, fontSize * 0.72);
      return wBase + Math.max(wSub, wSup) + 0.25;
    }
    case 'frac': {
      const wNum = measureMathNode(doc, node.num, fontSize * 0.88);
      const wDen = measureMathNode(doc, node.den, fontSize * 0.88);
      return Math.max(wNum, wDen) + 2.8;
    }
    case 'sum': {
      doc.setFont('symbol', 'normal');
      doc.setFontSize(fontSize * 1.35);
      const wSym = doc.getTextWidth(SYM.Sigma);
      const wLow = measureMathNode(doc, node.lower, fontSize * 0.65);
      const wUp = node.upper ? measureMathNode(doc, node.upper, fontSize * 0.65) : 0;
      return Math.max(wSym, wLow, wUp) + 1.8;
    }
    case 'sqrt': {
      return measureMathNode(doc, node.body, fontSize) + 4.2;
    }
    case 'cases': {
      let maxW = 0;
      for (const r of node.rows) {
        const rw =
          measureMathNode(doc, r.expr, fontSize * 0.86) +
          3.5 +
          measureMathNode(doc, r.cond, fontSize * 0.84);
        if (rw > maxW) maxW = rw;
      }
      return maxW + 4.5;
    }
    case 'seq':
      return node.items.reduce((acc, item) => acc + measureMathNode(doc, item, fontSize), 0);
  }
}

function drawMathNode(doc: jsPDF, node: MathNode, x: number, y: number, fontSize: number): number {
  doc.setTextColor(12, 35, 78);
  doc.setDrawColor(12, 35, 78);

  switch (node.kind) {
    case 'text': {
      doc.setFont('times', node.style || 'normal');
      doc.setFontSize(fontSize);
      doc.text(node.val, x, y);
      return x + doc.getTextWidth(node.val);
    }
    case 'sym': {
      doc.setFont('symbol', 'normal');
      doc.setFontSize(fontSize);
      doc.text(node.val, x, y);
      return x + doc.getTextWidth(node.val);
    }
    case 'sub': {
      const nx = drawMathNode(doc, node.base, x, y, fontSize);
      return drawMathNode(doc, node.sub, nx + 0.1, y + 1.15, fontSize * 0.72) + 0.1;
    }
    case 'sup': {
      const nx = drawMathNode(doc, node.base, x, y, fontSize);
      return drawMathNode(doc, node.sup, nx + 0.1, y - 1.35, fontSize * 0.72) + 0.1;
    }
    case 'subsup': {
      const nx = drawMathNode(doc, node.base, x, y, fontSize);
      const xSub = drawMathNode(doc, node.sub, nx + 0.1, y + 1.15, fontSize * 0.72);
      const xSup = drawMathNode(doc, node.sup, nx + 0.1, y - 1.35, fontSize * 0.72);
      return Math.max(xSub, xSup) + 0.15;
    }
    case 'frac': {
      const subSize = fontSize * 0.88;
      const wNum = measureMathNode(doc, node.num, subSize);
      const wDen = measureMathNode(doc, node.den, subSize);
      const totalW = Math.max(wNum, wDen) + 2.8;
      const xNum = x + (totalW - wNum) / 2;
      const xDen = x + (totalW - wDen) / 2;

      drawMathNode(doc, node.num, xNum, y - 2.1, subSize);
      doc.setLineWidth(0.28);
      doc.line(x + 0.5, y - 0.85, x + totalW - 0.5, y - 0.85);
      drawMathNode(doc, node.den, xDen, y + 2.4, subSize);
      return x + totalW;
    }
    case 'sum': {
      const totalW = measureMathNode(doc, node, fontSize);
      doc.setFont('symbol', 'normal');
      doc.setFontSize(fontSize * 1.35);
      const wSym = doc.getTextWidth(SYM.Sigma);
      doc.text(SYM.Sigma, x + (totalW - wSym) / 2, y + 0.4);

      if (node.upper) {
        const wUp = measureMathNode(doc, node.upper, fontSize * 0.65);
        drawMathNode(doc, node.upper, x + (totalW - wUp) / 2, y - 3.4, fontSize * 0.65);
      }
      const wLow = measureMathNode(doc, node.lower, fontSize * 0.65);
      drawMathNode(doc, node.lower, x + (totalW - wLow) / 2, y + 2.9, fontSize * 0.65);
      return x + totalW;
    }
    case 'sqrt': {
      const wBody = measureMathNode(doc, node.body, fontSize);
      const topY = y - 4.3;
      const botY = y + 2.8;
      doc.setLineWidth(0.3);
      // Draw vector radical sign √ and top vinculum bar
      doc.line(x + 0.3, y - 0.4, x + 1.0, y + 0.2);
      doc.line(x + 1.0, y + 0.2, x + 1.8, botY);
      doc.line(x + 1.8, botY, x + 3.0, topY);
      doc.line(x + 3.0, topY, x + 3.6 + wBody, topY);
      drawMathNode(doc, node.body, x + 3.3, y, fontSize);
      return x + 4.2 + wBody;
    }
    case 'cases': {
      const nRows = node.rows.length;
      const rowSpacing = 4.1;
      const totalH = (nRows - 1) * rowSpacing;
      const startY = y - totalH / 2;
      const topBrace = startY - 2.6;
      const botBrace = startY + totalH + 1.2;
      const midBrace = (topBrace + botBrace) / 2;

      // Draw crisp left curly brace {
      doc.setLineWidth(0.32);
      doc.line(x + 2.2, topBrace, x + 1.3, topBrace + 0.6);
      doc.line(x + 1.3, topBrace + 0.6, x + 1.3, midBrace - 0.6);
      doc.line(x + 1.3, midBrace - 0.6, x + 0.6, midBrace);
      doc.line(x + 0.6, midBrace, x + 1.3, midBrace + 0.6);
      doc.line(x + 1.3, midBrace + 0.6, x + 1.3, botBrace - 0.6);
      doc.line(x + 1.3, botBrace - 0.6, x + 2.2, botBrace);

      let maxExprW = 0;
      for (const r of node.rows) {
        const ew = measureMathNode(doc, r.expr, fontSize * 0.86);
        if (ew > maxExprW) maxExprW = ew;
      }

      node.rows.forEach((r, idx) => {
        const ry = startY + idx * rowSpacing;
        drawMathNode(doc, r.expr, x + 3.0, ry, fontSize * 0.86);
        drawMathNode(doc, r.cond, x + 3.0 + maxExprW + 3.5, ry, fontSize * 0.84);
      });

      return x + measureMathNode(doc, node, fontSize);
    }
    case 'seq': {
      let cx = x;
      for (const item of node.items) {
        cx = drawMathNode(doc, item, cx, y, fontSize);
      }
      return cx;
    }
  }
}

interface EquationSpec {
  num: number;
  title: string;
  heightMm: number;
  math: MathNode;
  legend: string;
}

/**
 * Generates and downloads an OpenReview-ready academic PDF of the scientific paper
 * authored by Alberto Arce Rodríguez (supports both Spanish and English),
 * featuring 16 genuine 2D vector-typeset mathematical equations (fractions, summations,
 * square-root radicals, piecewise braces, subscripts/superscripts, and Greek Symbol glyphs).
 */
export function generateScientificPaperPDF(language: 'es' | 'en' = 'es') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginLeft = 15;
  const marginRight = 15;
  const printableWidth = pageWidth - marginLeft - marginRight;
  let cursorY = 20;

  const drawHeaderFooter = () => {
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(105, 115, 132);
    doc.text(
      sanitizeWinAnsi(
        language === 'en'
          ? 'OPENREVIEW PREPRINT MANUSCRIPT * SIGHT ALS ASSISTIVE TECHNOLOGY (IEC 62304 SaMD) * OPEN ACCESS'
          : 'MANUSCRITO PREPRINT OPENREVIEW * SIGHT TECNOLOGÍA ASISTENCIAL ELA (SaMD IEC 62304) * ACCESO ABIERTO'
      ),
      marginLeft,
      11
    );
    doc.setDrawColor(210, 218, 230);
    doc.setLineWidth(0.3);
    doc.line(marginLeft, 13, pageWidth - marginRight, 13);

    // Footer
    doc.line(marginLeft, pageHeight - 12, pageWidth - marginRight, pageHeight - 12);
    doc.text(
      sanitizeWinAnsi(
        language === 'en'
          ? 'Author: Alberto Arce Rodríguez (alberto.arce.ti@gmail.com) * Reproducible Artifact: https://alarti.github.io/sight/'
          : 'Autor: Alberto Arce Rodríguez (alberto.arce.ti@gmail.com) * Artefacto Reproducible: https://alarti.github.io/sight/'
      ),
      marginLeft,
      pageHeight - 8
    );
    doc.text(
      sanitizeWinAnsi(language === 'en' ? `Page ${pageCount}` : `Página ${pageCount}`),
      pageWidth - marginRight - 14,
      pageHeight - 8
    );
  };

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 17) {
      doc.addPage();
      cursorY = 19;
      drawHeaderFooter();
    }
  };

  const drawEquationCard = (eq: EquationSpec) => {
    const totalCardH = eq.heightMm + 11.5;
    checkPageBreak(totalCardH + 2);

    // Background box
    doc.setFillColor(247, 250, 254);
    doc.setDrawColor(198, 212, 232);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginLeft + 1, cursorY, printableWidth - 2, totalCardH, 1.8, 1.8, 'FD');

    // Header bar inside equation card
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(12, 78, 152);
    const headerLabel = language === 'en' ? `EQUATION (${eq.num}) - ${eq.title}` : `ECUACIÓN (${eq.num}) - ${eq.title}`;
    doc.text(sanitizeWinAnsi(headerLabel), marginLeft + 4, cursorY + 4.0);

    // Right-aligned equation number badge (k)
    doc.setFont('times', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(15, 30, 60);
    doc.text(`(${eq.num})`, pageWidth - marginRight - 9, cursorY + 4.2 + eq.heightMm / 2);

    // Divider line under header
    doc.setDrawColor(222, 230, 242);
    doc.setLineWidth(0.2);
    doc.line(marginLeft + 3, cursorY + 5.2, pageWidth - marginRight - 3, cursorY + 5.2);

    // Measure & center 2D math formula
    const mathFontSize = 9.6;
    const mathWidth = measureMathNode(doc, eq.math, mathFontSize);
    const startX = Math.max(marginLeft + 5, marginLeft + (printableWidth - 12 - mathWidth) / 2);
    const mathCenterY = cursorY + 5.5 + eq.heightMm / 2 + 1.0;

    drawMathNode(doc, eq.math, startX, mathCenterY, mathFontSize);

    // Legend footer inside card
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.0);
    doc.setTextColor(80, 92, 110);
    const legendPrefix = language === 'en' ? 'Where: ' : 'Donde: ';
    const legendStr = sanitizeWinAnsi(legendPrefix + eq.legend);
    doc.text(legendStr, marginLeft + 4, cursorY + totalCardH - 2.0);

    cursorY += totalCardH + 2.4;
  };

  drawHeaderFooter();

  // Venue & Track Badge
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(12, 85, 165);
  doc.text(
    sanitizeWinAnsi(
      language === 'en'
        ? '[OPENREVIEW SUBMISSION FORMAT * NEURO-OPHTHALMIC ENGINEERING & MEDICAL AI TRACK]'
        : '[FORMATO DE PUBLICACIÓN OPENREVIEW * TRACK DE INGENIERÍA NEURO-OFTÁLMICA E IA MÉDICA]'
    ),
    marginLeft,
    cursorY
  );
  cursorY += 4.5;

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(18, 28, 52);
  const titleText = sanitizeWinAnsi(
    language === 'en'
      ? 'SIGHT: A Non-Invasive Multimodal Ocular Sensor Fusion, Binocular Conjugate Anti-Tremor Filtering, M-QPM Calibration, and Bayesian Decoding Framework for Assistive Communication in Amyotrophic Lateral Sclerosis (ALS)'
      : 'SIGHT: Un Framework No Invasivo de Fusión Sensorial Ocular Multimodal, Filtrado Anti-Temblor Binocular Conjugado, Calibración M-QPM y Decodificación Bayesiana para Comunicación Asistencial en Esclerosis Lateral Amiotrófica (ELA)'
  );
  const titleLines = doc.splitTextToSize(titleText, printableWidth);
  doc.text(titleLines, marginLeft, cursorY);
  cursorY += titleLines.length * 4.9 + 2.0;

  // Author & Affiliations
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(10, 80, 160);
  doc.text('Alberto Arce Rodríguez', marginLeft, cursorY);
  cursorY += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.1);
  doc.setTextColor(75, 85, 100);
  doc.text(
    sanitizeWinAnsi(
      language === 'en'
        ? 'Assistive Technology Laboratory, Neurocomputation and Vision Sciences Research Unit | alberto.arce.ti@gmail.com'
        : 'Laboratorio de Tecnología Asistencial, Neurocomputación y Ciencias de la Visión | alberto.arce.ti@gmail.com'
    ),
    marginLeft,
    cursorY
  );
  cursorY += 4.8;

  // Structured Abstract Box
  const abstractText = sanitizeWinAnsi(
    language === 'en'
      ? 'Abstract - Patients with advanced Amyotrophic Lateral Sclerosis (ALS) suffer progressive tetraplegia and bulbar anarthria (Locked-In Syndrome), whereas extraocular motor nuclei (CN III, IV, VI) remain uniquely spared due to high parvalbumin and calbindin-D28k buffering. However, commercial infrared PCCR trackers cost $3,000-$15,000 USD, while consumer webcam trackers suffer severe post-calibration tremor (25-60 px RMS) caused by single-landmark canthal variance amplification (25x noise gain across W_eye ~ 0.04), steep calibration Jacobians (||grad f|| ~ 4000 px/unit), and 1st-Purkinje corneal screen glints. We present SIGHT, a 100% client-side, zero-telemetry SaMD framework executing at 60 FPS via WebAssembly/WebGPU. SIGHT introduces six core contributions formalized across 16 mathematical equations: (1) a 4-Point Bony Orbital Canthal Constellation with formal variance attenuation (>60.3% reduction, Eq. 1-3) fused with a chord-consistent 5-point iris estimator (Eq. 4) and 3D Spherical Eyeball Raycasting (Eq. 6); (2) Sub-Pixel Photometric Dark-Pupil ROI Centroiding (36x22 px) with automated 1st-Purkinje corneal glint inpainting (Eq. 5); (3) a Zero-Tremor Oculomotor Cascade governed by Hering\'s Law of Equal Innervation (Eq. 7), speed-adaptive 1-Euro filters (Eq. 8), a Cubic-Sigmoid Mahalanobis Kalman Filter (Eq. 9), and a Dual-Concentric Hysteresis Fixation Lock (Eq. 10); (4) a 5-Regime Mahalanobis-Whitened Calibration Suite (M-QPM, Eq. 11), 2-pass Huber IRLS Bivariate Polynomial Ridge Regression (Eq. 12) with closed-form hat-matrix LOOCV (Eq. 13), and OrbitoGaze lag-compensated smooth pursuit (Eq. 14); (5) a Sequential Bayesian Target Decoder (Eq. 15); and (6) an LPC-16 / Klatt Voice Cloning Engine (Eq. 16) with AES-256-GCM encryption and HL7 FHIR R4 telemetry. Benchmarks and ablations (N=20) demonstrate an RMSE of 8.2 +/- 1.9 px (0.29 deg, p < 0.001), 0.12 px RMS static jitter (-94.4% tremor), 99.8% border reachability, and an ITR of 148.6 bits/min (24.8 WPM).'
      : 'Resumen (Abstract) - Los pacientes con Esclerosis Lateral Amiotrófica (ELA) avanzada sufren tetraplejía y anartria bulbar (Síndrome de Cautiverio), mientras que los núcleos oculomotores (pares III, IV, VI) permanecen preservados gracias a su expresión de parvalbúmina y calbindina-D28k. Sin embargo, los seguidores infrarrojos PCCR cuestan $3,000-$15,000 USD, y los sistemas por webcam sufren un severo temblor post-calibración (25-60 px RMS) causado por la amplificación de varianza en hitos cantales aislados (25x sobre W_eye ~ 0.04), el elevado Jacobiano de calibración (||grad f|| ~ 4000 px/unidad) y los reflejos corneales (1ª imagen de Purkinje). Presentamos SIGHT, un framework SaMD 100% en cliente y sin telemetría que opera a 60 FPS vía WebAssembly/WebGPU con seis contribuciones formalizadas en 16 ecuaciones matemáticas: (1) Constelación Cantal Orbital Ósea de 4 puntos con demostración formal de reducción de varianza (>60.3%, Ec. 1-3), estimador de iris de 5 puntos consistente en cuerda (Ec. 4) y Raycasting Esférico 3D (Ec. 6); (2) Centroide Fotométrico Sub-píxel de Pupila Oscura (36x22 px) con inpainting automático de Purkinje (Ec. 5); (3) Cascada Anti-Temblor basada en la Ley de Hering (Ec. 7), filtros 1-Euro (Ec. 8), Filtro de Kalman Sigmoideo-Cúbico de Mahalanobis (Ec. 9) y Bloqueo de Fijación Concéntrico Dual (Ec. 10); (4) Calibración Multi-Régimen M-QPM (Ec. 11), Regresión Polinómica Bivariada Ridge con IRLS de Huber (Ec. 12), validación LOOCV exacta por matriz sombrero (Ec. 13) y seguimiento suave OrbitoGaze (Ec. 14); (5) Decodificador Bayesiano Secuencial (Ec. 15); y (6) Clonación de Voz LPC-16 / Klatt (Ec. 16) con cifrado AES-256-GCM y exportación clínica HL7 FHIR R4. Los estudios de ablación (N=20) demuestran un RMSE de 8.2 +/- 1.9 px (0.29°, p < 0.001), 0.12 px RMS de temblor (-94.4%), 99.8% de alcance perimetral y una ITR de 148.6 bits/min (24.8 WPM).'
  );

  const abstractLines = doc.splitTextToSize(abstractText, printableWidth - 8);
  const boxHeight = abstractLines.length * 3.45 + 5.5;
  checkPageBreak(boxHeight + 4);

  doc.setFillColor(245, 248, 253);
  doc.setDrawColor(195, 212, 235);
  doc.roundedRect(marginLeft, cursorY, printableWidth, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.7);
  doc.setTextColor(35, 45, 65);
  doc.text(abstractLines, marginLeft + 4, cursorY + 4.2);
  cursorY += boxHeight + 3.5;

  const addSectionHeader = (num: string, title: string, introParagraph: string) => {
    checkPageBreak(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.6);
    doc.setTextColor(12, 32, 68);
    doc.text(sanitizeWinAnsi(`${num}. ${title}`), marginLeft, cursorY);
    cursorY += 4.2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.0);
    doc.setTextColor(45, 55, 70);
    const lines = doc.splitTextToSize(sanitizeWinAnsi(introParagraph), printableWidth);
    checkPageBreak(lines.length * 3.5 + 2);
    doc.text(lines, marginLeft, cursorY);
    cursorY += lines.length * 3.5 + 2.0;
  };

  // ============================================================================
  // SECTION 1 & EQUATIONS (1) TO (6)
  // ============================================================================
  addSectionHeader(
    '1',
    language === 'en'
      ? 'Multi-Modal Ocular Pupil Detection, Canthal Variance Proof & Purkinje Inpainting'
      : 'Detección Pupilar Multimodal, Demostración de Varianza Cantal e Inpainting de Purkinje',
    language === 'en'
      ? 'Why do standard webcam eye-trackers tremble after calibration? Normalizing iris coordinates against single MediaPipe corner landmarks (33, 133) divides coordinate jitter by the narrow palpebral fissure (W_eye ~ 0.04), magnifying sensor noise by 25x before entering the steep calibration polynomial Jacobian (||grad f|| ~ 4000 px/unit). SIGHT resolves this via Equations (1)-(6):'
      : '¿Por qué tiembla el cursor tras la calibración en los seguidores por webcam clásicos? Normalizar el iris frente a un único hito cantal (33, 133) divide el ruido del detector por la estrecha hendidura palpebral (W_eye ~ 0.04), amplificando el jitter 25x antes de atravesar el elevado Jacobiano del polinomio de calibración (||grad f|| ~ 4000 px/unidad). SIGHT resuelve este fenómeno mediante las Ecuaciones (1)-(6):'
  );

  // Eq (1): Single-Canthus Error Propagation
  drawEquationCard({
    num: 1,
    title:
      language === 'en'
        ? 'Single-Canthus Variance Amplification & Screen Jacobian Gain'
        : 'Amplificación de Varianza en Canto Simple y Ganancia del Jacobiano',
    heightMm: 11.5,
    math: SEQ(
      SUBSUP(S(SYM.sigma), V('x'), T('2')),
      T(' '),
      S(SYM.approx),
      T(' '),
      FRAC(
        SEQ(SUBSUP(S(SYM.sigma), T('iris'), T('2')), T(' + '), SUBSUP(S(SYM.sigma), T('canthus'), T('2'))),
        SUBSUP(V('W'), T('eye'), T('2'))
      ),
      T(',     '),
      SUB(V('G'), T('noise')),
      T(' = '),
      FRAC(T('1'), SUB(V('W'), T('eye'))),
      T(' '),
      S(SYM.approx),
      T(' 25'),
      S(SYM.times),
      T(',     '),
      SUB(S(SYM.sigma), T('screen')),
      T(' '),
      S(SYM.approx),
      T(' ||'),
      S(SYM.nabla),
      V('f'),
      T('|| '),
      S(SYM.cdot),
      T(' '),
      SUB(S(SYM.sigma), V('x'))
    ),
    legend:
      language === 'en'
        ? 'W_eye ~ 0.04 is normalized palpebral fissure width; ||grad f|| ~ 4000 px/unit is the screen calibration Jacobian.'
        : 'W_eye ~ 0.04 es la apertura palpebral normalizada; ||grad f|| ~ 4000 px/unidad es el Jacobiano de calibración en pantalla.',
  });

  // Eq (2): 4-Point Bony Orbital Canthal Constellation
  drawEquationCard({
    num: 2,
    title:
      language === 'en'
        ? '4-Point Bony Orbital Canthal Constellation'
        : 'Constelación Cantal Orbital Ósea de 4 Puntos',
    heightMm: 12.0,
    math: SEQ(
      SUB(B('C'), T('cluster')),
      T(' = '),
      FRAC(
        SEQ(
          SUB(V('w'), T('0')),
          SUB(B('c'), T('0')),
          T(' + '),
          SUB(V('w'), T('pair')),
          T('('),
          SUB(B('p'), T('up')),
          T(' + '),
          SUB(B('p'), T('lo')),
          T(')/2 + '),
          SUB(V('w'), T('orb')),
          SUB(B('p'), T('orb'))
        ),
        SEQ(SUB(V('w'), T('0')), T(' + '), SUB(V('w'), T('pair')), T(' + '), SUB(V('w'), T('orb')))
      ),
      T(' = 0.58 '),
      SUB(B('c'), T('0')),
      T(' + 0.12('),
      SUB(B('p'), T('up')),
      T(' + '),
      SUB(B('p'), T('lo')),
      T(') + 0.18 '),
      SUB(B('p'), T('orb'))
    ),
    legend:
      language === 'en'
        ? 'c_0 is the primary commissure (33/133 left; 263/362 right), (p_up, p_lo) the symmetric palpebral fissure pair, and p_orb the bony orbital tubercle.'
        : 'c_0 es la comisura primaria (33/133 izq.; 263/362 der.), (p_up, p_lo) el par palpebral simétrico y p_orb el tubérculo orbital óseo.',
  });

  // Eq (3): Proposition 1 Variance Attenuation Bound
  drawEquationCard({
    num: 3,
    title:
      language === 'en'
        ? 'Proposition 1: Canthal Constellation Variance Attenuation Bound (>60.3% Reduction)'
        : 'Proposición 1: Cota de Atenuación de Varianza de la Constelación Cantal (>60.3% Reducción)',
    heightMm: 13.0,
    math: SEQ(
      T('Var('),
      SUB(B('C'), T('cluster')),
      T(') = '),
      SUBSUP(S(SYM.sigma), T('0'), T('2')),
      T(' [ '),
      SUM(T('i=0'), T('3')),
      SUBSUP(V('w'), V('i'), T('2')),
      T(' + 2 '),
      SUM(T('0 <= i < j <= 3')),
      SUB(V('w'), V('i')),
      SUB(V('w'), V('j')),
      SUB(S(SYM.rho), V('ij')),
      T(' ] '),
      S(SYM.le),
      T(' 0.397 '),
      SUBSUP(S(SYM.sigma), T('0'), T('2'))
    ),
    legend:
      language === 'en'
        ? 'For weights w = [0.58, 0.12, 0.12, 0.18]^T and residual sub-pixel mesh correlation rho_ij <= 0.05, variance drops by >60.3%.'
        : 'Para pesos w = [0.58, 0.12, 0.12, 0.18]^T y correlación residual de malla rho_ij <= 0.05, la varianza se reduce más de un 60.3%.',
  });

  // Eq (4): Chord-Consistent 5-Point Iris Estimator
  drawEquationCard({
    num: 4,
    title:
      language === 'en'
        ? 'Chord-Consistent 5-Point Iris Estimator with Piecewise Exponential Damping'
        : 'Estimador de Iris de 5 Puntos Consistente en Cuerda con Amortiguación Exponencial',
    heightMm: 13.5,
    math: SEQ(
      SUB(S(SYM.alpha), T('center')),
      T('('),
      S(SYM.epsilon),
      T(') = '),
      CASES([
        { expr: T('0.52,'), cond: SEQ(S(SYM.epsilon), T(' '), S(SYM.le), T(' 0.14')) },
        {
          expr: SEQ(T('max(0.25, 0.52 exp(-3.5('), S(SYM.epsilon), T(' - 0.14))),')),
          cond: SEQ(S(SYM.epsilon), T(' > 0.14')),
        },
      ]),
      T('    '),
      S(SYM.epsilon),
      T(' = '),
      FRAC(
        SEQ(T('||'), SUB(B('p'), T('center')), T(' - '), SUB(B('m'), T('chord')), SUB(T('||'), T('2'))),
        SUB(V('D'), T('horiz'))
      )
    ),
    legend:
      language === 'en'
        ? 'm_chord = (p_left + p_right)/2 is the horizontal limbus chord midpoint (invariant to upper-eyelid ptosis); D_horiz is limbus diameter.'
        : 'm_chord = (p_left + p_right)/2 es el punto medio horizontal del limbo (invariante a ptosis palpebral superior); D_horiz es el diámetro.',
  });

  // Eq (5): Sub-Pixel Photometric Dark-Pupil ROI with Purkinje Glint Inpainting
  drawEquationCard({
    num: 5,
    title:
      language === 'en'
        ? 'Sub-Pixel Photometric Dark-Pupil Centroid with 1st-Purkinje Glint Inpainting'
        : 'Centroide Fotométrico Sub-Píxel con Inpainting del Reflejo Corneal de Purkinje',
    heightMm: 13.5,
    math: SEQ(
      SUB(B('c'), T('photo')),
      T(' = '),
      FRAC(
        SEQ(
          SUM(SEQ(B('x'), T(' '), S(SYM.in), T(' E'))),
          T(' max(0, '),
          V('T'),
          T(' - '),
          SUB(V('L'), T('inpaint')),
          T('('),
          B('x'),
          SUP(T('))'), T('2')),
          T(' exp(-1.15 '),
          SUBSUP(V('r'), T('E'), T('2')),
          T('('),
          B('x'),
          T(')) '),
          B('x')
        ),
        SEQ(
          SUM(SEQ(B('x'), T(' '), S(SYM.in), T(' E'))),
          T(' max(0, '),
          V('T'),
          T(' - '),
          SUB(V('L'), T('inpaint')),
          T('('),
          B('x'),
          SUP(T('))'), T('2')),
          T(' exp(-1.15 '),
          SUBSUP(V('r'), T('E'), T('2')),
          T('('),
          B('x'),
          T(')) + '),
          S(SYM.epsilon)
        )
      )
    ),
    legend:
      language === 'en'
        ? 'L_inpaint replaces specular Purkinje corneal glints (r_E <= 0.42, L >= P_88) with dark-pupil P_20 over L = 0.38R + 0.50G + 0.12B.'
        : 'L_inpaint reemplaza los reflejos corneales de Purkinje (r_E <= 0.42, L >= P_88) por el percentil P_20 sobre L = 0.38R + 0.50G + 0.12B.',
  });

  // Eq (6): 3D Spherical Eyeball Optical-Axis Raycasting
  drawEquationCard({
    num: 6,
    title:
      language === 'en'
        ? '3D Spherical Eyeball Rotation Center & Optical-Axis Raycasting'
        : 'Centro de Rotación de Globo Ocular Esférico 3D y Raycasting de Eje Óptico',
    heightMm: 11.5,
    math: SEQ(
      SUB(B('O'), T('eye')),
      T(' = '),
      SUB(B('M'), T('canthus')),
      T(' - 0.44 '),
      SUBSUP(V('W'), T('eye'), T('3D')),
      T(' '),
      SUB(B('e'), V('z')),
      T(',       '),
      SUB(B('d'), T('ray')),
      T(' = '),
      FRAC(
        SEQ(SUBSUP(B('P'), T('pupil'), T('3D')), T(' - '), SUB(B('O'), T('eye'))),
        SEQ(T('||'), SUBSUP(B('P'), T('pupil'), T('3D')), T(' - '), SUB(B('O'), T('eye')), SUB(T('||'), T('2')))
      )
    ),
    legend:
      language === 'en'
        ? 'O_eye anchors the anatomical globe center 12 mm posterior to the canthal midpoint M_canthus along cranial anteroposterior axis e_z.'
        : 'O_eye sitúa el centro anatómico del globo ocular 12 mm detrás del punto medio cantal M_canthus sobre el eje craneal e_z.',
  });

  // ============================================================================
  // SECTION 2 & EQUATIONS (7) TO (10)
  // ============================================================================
  addSectionHeader(
    '2',
    language === 'en'
      ? 'Zero-Tremor Oculomotor Filtering Cascade: Hering\'s Law, 1-Euro & Cubic-Sigmoid Kalman'
      : 'Cascada de Filtrado Oculomotor de Temblor Cero: Ley de Hering, 1-Euro y Kalman Cúbico',
    language === 'en'
      ? 'By Hering\'s Law of Equal Innervation, voluntary version eye movements drive both eyes conjugately in the same direction (cos theta_LR -> +1), whereas webcam sensor noise is uncorrelated or anti-conjugate. SIGHT suppresses 94.4% of static fixation tremor via Equations (7)-(10):'
      : 'Por la Ley de Hering de Inervación Igualitaria, los movimientos oculares voluntarios impulsan ambos ojos de forma conjugada (cos theta_LR -> +1), mientras que el ruido del sensor CMOS es incorrelado o anticonjugado. SIGHT suprime el 94.4% del temblor mediante las Ecuaciones (7)-(10):'
  );

  // Eq (7): Hering's Law Binocular Conjugate Coherence Gate
  drawEquationCard({
    num: 7,
    title:
      language === 'en'
        ? 'Hering\'s Law Binocular Conjugate Coherence Gate & 5-Tap Trimmed Pre-Filter'
        : 'Puerta de Coherencia Binocular Conjugada (Ley de Hering) y Pre-Filtro Recortado',
    heightMm: 13.0,
    math: SEQ(
      SUB(V('C'), T('binoc')),
      T(' = clip'),
      T('('),
      FRAC(
        SEQ(
          FRAC(
            SEQ(S(SYM.Delta), SUB(B('g'), V('L')), T(' '), S(SYM.cdot), T(' '), S(SYM.Delta), SUB(B('g'), V('R'))),
            SEQ(T('||'), S(SYM.Delta), SUB(B('g'), V('L')), T('|| ||'), S(SYM.Delta), SUB(B('g'), V('R')), T('|| + '), S(SYM.epsilon))
          ),
          T(' + 0.35')
        ),
        T('1.15')
      ),
      T(', 0.18, 1.0),    '),
      SUB(V('g'), T('trim')),
      T(' = '),
      FRAC(
        SEQ(SUM(T('k=1'), T('5')), SUB(V('g'), V('k')), T(' - min '), SUB(V('g'), V('k')), T(' - max '), SUB(V('g'), V('k'))),
        T('3')
      )
    ),
    legend:
      language === 'en'
        ? 'Delta g_L, Delta g_R are inter-frame displacements of left/right eyes; C_binoc damps uncorrelated monocular glitches prior to mapping.'
        : 'Delta g_L, Delta g_R son desplazamientos inter-fotograma de ambos ojos; C_binoc atenúa saltos monoculares incorrelados.',
  });

  // Eq (8): Speed-Adaptive 1-Euro Filter
  drawEquationCard({
    num: 8,
    title:
      language === 'en'
        ? 'Speed-Adaptive 1-Euro Low-Pass Filter Cutoff & Smoothing Factor'
        : 'Frecuencia de Corte y Factor de Suavizado del Filtro Paso-Bajo Adaptativo 1-Euro',
    heightMm: 12.0,
    math: SEQ(
      SUB(V('f'), V('c')),
      T('('),
      V('t'),
      T(') = '),
      SUB(V('f'), T('c,min')),
      T(' + '),
      S(SYM.beta),
      T(' ||'),
      SUB(B('v'), T('gaze')),
      T('('),
      V('t'),
      SUB(T(')||'), T('2')),
      T(',       '),
      SUB(S(SYM.alpha), T('1E')),
      T('('),
      V('t'),
      T(') = '),
      FRAC(
        T('1'),
        SEQ(T('1 + '), FRAC(T('1'), SEQ(T('2'), S(SYM.pi), T(' '), SUB(V('f'), V('c')), T('('), V('t'), T(') '), S(SYM.Delta), V('t'))))
      )
    ),
    legend:
      language === 'en'
        ? 'f_{c,min} = 0.36 Hz filters micro-tremor during fixation; beta = 4.2 opens the bandwidth instantaneously during saccades.'
        : 'f_{c,min} = 0.36 Hz filtra el micro-temblor en fijación; beta = 4.2 abre el ancho de banda instantáneamente durante las sacadas.',
  });

  // Eq (9): Cubic-Sigmoid Mahalanobis Innovation-Gated Kalman Filter
  drawEquationCard({
    num: 9,
    title:
      language === 'en'
        ? 'Cubic-Sigmoid Mahalanobis Innovation-Gated Kalman Measurement Covariance'
        : 'Covarianza de Observación de Kalman con Puerta de Innovación Sigmoidea-Cúbica',
    heightMm: 15.0,
    math: SEQ(
      SUB(V('R'), V('k')),
      T('('),
      SUB(V('d'), T('innov')),
      T(') = '),
      CASES([
        { expr: T('26.0,'), cond: SEQ(SUB(V('d'), T('innov')), T(' '), S(SYM.le), T(' 22 px')) },
        {
          expr: SEQ(T('26.0(1 - '), V('s'), T('('), V('t'), T(')) + 1.4 '), V('s'), T('('), V('t'), T('),')),
          cond: SEQ(T('22 < '), SUB(V('d'), T('innov')), T(' '), S(SYM.le), T(' 64 px')),
        },
        { expr: T('0.22,'), cond: SEQ(SUB(V('d'), T('innov')), T(' > 64 px')) },
      ]),
      T('   '),
      V('s'),
      T('('),
      V('t'),
      T(') = 3'),
      SUP(V('t'), T('2')),
      T(' - 2'),
      SUP(V('t'), T('3'))
    ),
    legend:
      language === 'en'
        ? 'd_innov = ||z_k - x_hat_{k|k-1}||_2 is innovation norm; s(t) is the C^1 cubic Hermite sigmoid with t = clip((d_innov - 22)/42, 0, 1).'
        : 'd_innov = ||z_k - x_hat_{k|k-1}||_2 es la distancia de innovación; s(t) es la sigmoide hermítica C^1 con t = clip((d_innov - 22)/42, 0, 1).',
  });

  // Eq (10): Dual-Concentric Hysteresis Fixation Lock
  drawEquationCard({
    num: 10,
    title:
      language === 'en'
        ? 'Dual-Concentric Hysteresis Fixation Lock'
        : 'Bloqueo de Fijación Concéntrico Dual con Histéresis',
    heightMm: 17.5,
    math: SEQ(
      SUB(B('a'), V('k')),
      T(' = (1 - '),
      SUB(S(SYM.alpha), T('lock')),
      T(')'),
      SUB(B('a'), SEQ(V('k'), T('-1'))),
      T(' + '),
      SUB(S(SYM.alpha), T('lock')),
      SUB(B('x'), V('k')),
      T(',    '),
      SUB(S(SYM.alpha), T('lock')),
      T('('),
      V('d'),
      T(') = '),
      CASES([
        { expr: T('0.04  (96% foveal lock),'), cond: SEQ(V('d'), T(' < 14 px')) },
        { expr: T('0.12  (88% perifoveal),'), cond: SEQ(T('14 '), S(SYM.le), T(' '), V('d'), T(' < 28 px')) },
        {
          expr: SEQ(T('0.14 + 0.56(('), V('d'), T(' - 28)/36'), SUP(T(')'), T('2')), T(',')),
          cond: SEQ(T('28 '), S(SYM.le), T(' '), V('d'), T(' < 64 px')),
        },
        { expr: T('1.00  (0 ms saccadic snap),'), cond: SEQ(V('d'), T(' '), S(SYM.ge), T(' 64 px')) },
      ])
    ),
    legend:
      language === 'en'
        ? 'Freezes 96% of residual micro-tremor inside the 14 px foveal dwell zone while preserving 0 ms latency for saccades >= 64 px.'
        : 'Bloquea el 96% del micro-temblor dentro del radio foveal de 14 px mientras preserva latencia 0 ms para sacadas >= 64 px.',
  });

  // ============================================================================
  // SECTION 3 & EQUATIONS (11) TO (14)
  // ============================================================================
  addSectionHeader(
    '3',
    language === 'en'
      ? 'Multi-Regime Spatial Calibration (M-QPM), Hat-Matrix LOOCV & OrbitoGaze Smooth Pursuit'
      : 'Calibración Espacial Multi-Régimen (M-QPM), LOOCV por Matriz Sombrero y OrbitoGaze',
    language === 'en'
      ? 'To accommodate the 5:1 horizontal-to-vertical ocular excursion anisotropy and arbitrary calibration sample counts N, SIGHT unifies Mahalanobis-whitened projective/TPS surfaces, 2-pass Huber IRLS Bivariate Ridge Regression, exact leverage LOOCV, and lag-compensated Lissajous smooth pursuit in Equations (11)-(14):'
      : 'Para compensar la anisotropía horizontal-vertical (5:1) y cualquier número de muestras N, SIGHT unifica superficies proyectivas/TPS blanqueadas por Mahalanobis, Regresión Polinómica Bivariada Ridge con IRLS de Huber, validación LOOCV exacta y seguimiento suave de Lissajous en las Ecuaciones (11)-(14):'
  );

  // Eq (11): M-QPM Hybrid Homography + Thin-Plate Spline
  drawEquationCard({
    num: 11,
    title:
      language === 'en'
        ? 'M-QPM Regime 5 Hybrid Surface (Hartley Projective Homography + Whitened Thin-Plate Spline)'
        : 'Superficie Híbrida M-QPM Régimen 5 (Homografía de Hartley + Thin-Plate Spline Blanqueado)',
    heightMm: 12.5,
    math: SEQ(
      SUB(B('g'), T('M-QPM')),
      T('('),
      B('u'),
      T(') = '),
      SUB(V('P'), B('H')),
      T('('),
      B('u'),
      T(') + '),
      SUB(S(SYM.tau), T('hull')),
      T('('),
      B('u'),
      T(') '),
      SUM(T('i=1'), V('N')),
      SUB(B('w'), V('i')),
      T(' ||'),
      B('u'),
      T(' - '),
      SUB(B('c'), V('i')),
      SUBSUP(T('||'), T('2'), T('2')),
      T(' ln(||'),
      B('u'),
      T(' - '),
      SUB(B('c'), V('i')),
      SUB(T('||'), T('2')),
      T(' + '),
      S(SYM.epsilon),
      T(')')
    ),
    legend:
      language === 'en'
        ? 'u = ((x - mu_x)/sigma_x, (y - mu_y)/sigma_y) are Mahalanobis-whitened pupil coordinates; P_H is the 4-corner Hartley homography.'
        : 'u = ((x - mu_x)/sigma_x, (y - mu_y)/sigma_y) son las coordenadas pupilares blanqueadas; P_H es la homografía proyectiva de Hartley.',
  });

  // Eq (12): 2-Pass Huber IRLS Bivariate Polynomial Ridge Regression
  drawEquationCard({
    num: 12,
    title:
      language === 'en'
        ? '2-Pass Huber IRLS Bivariate Polynomial Ridge Regression (Golub-Kahan SVD)'
        : 'Regresión Polinómica Bivariada Ridge con IRLS de Huber en 2 Pasos (SVD de Golub-Kahan)',
    heightMm: 11.5,
    math: SEQ(
      SUP(B('W'), T('*')),
      T(' = ('),
      SUP(S(SYM.Phi), T('T')),
      SUB(B('W'), T('Huber')),
      S(SYM.Phi),
      T(' + '),
      S(SYM.lambda),
      S(SYM.Gamma),
      SUP(T(')'), T('-1')),
      SUP(S(SYM.Phi), T('T')),
      SUB(B('W'), T('Huber')),
      B('Y'),
      T(',    '),
      S(SYM.phi),
      T(' = [1, '),
      V('X'),
      T(', '),
      V('Y'),
      T(', '),
      V('XY'),
      T(', '),
      SUP(V('X'), T('2')),
      T(', '),
      SUP(V('Y'), T('2')),
      T(', '),
      S(SYM.psi),
      T(', '),
      S(SYM.theta),
      T(', '),
      V('X'),
      S(SYM.psi),
      T(', '),
      V('Y'),
      S(SYM.theta),
      SUP(T(']'), T('T'))
    ),
    legend:
      language === 'en'
        ? 'phi in R^10 couples quadratic pupil coordinates (X, Y) with 3D head yaw/pitch (psi, theta); W_Huber downweights outliers (delta = 1.345*MAD).'
        : 'phi in R^10 acopla coordenadas cuadráticas pupilares (X, Y) con pose cefálica 3D (psi, theta); W_Huber atenúa outliers (delta = 1.345*MAD).',
  });

  // Eq (13): Closed-Form Leverage Hat-Matrix LOOCV
  drawEquationCard({
    num: 13,
    title:
      language === 'en'
        ? 'Exact Closed-Form Leverage Hat-Matrix Leave-One-Out Cross-Validation (LOOCV)'
        : 'Validación Cruzada Exacta Leave-One-Out (LOOCV) mediante Diagonal de Matriz Sombrero',
    heightMm: 13.5,
    math: SEQ(
      SUB(T('RMSE'), T('LOOCV')),
      T(' = '),
      SQRT(
        SEQ(
          FRAC(T('1'), V('N')),
          T(' '),
          SUM(T('i=1'), V('N')),
          T(' ||'),
          FRAC(
            SEQ(SUB(B('y'), V('i')), T(' - '), SUB(B('y'), SEQ(T('hat,'), V('i')))),
            SEQ(T('1 - '), SUB(V('H'), V('ii')))
          ),
          SUBSUP(T('||'), T('2'), T('2'))
        )
      ),
      T(',     '),
      B('H'),
      T(' = '),
      S(SYM.Phi),
      T('('),
      SUP(S(SYM.Phi), T('T')),
      SUB(B('W'), T('Huber')),
      S(SYM.Phi),
      T(' + '),
      S(SYM.lambda),
      S(SYM.Gamma),
      SUP(T(')'), T('-1')),
      SUP(S(SYM.Phi), T('T')),
      SUB(B('W'), T('Huber'))
    ),
    legend:
      language === 'en'
        ? 'Certifies exact generalization error in O(N) closed form via leverage diagonal H_ii without refitting N separate regression models.'
        : 'Certifica el error exacto de generalización en forma cerrada O(N) mediante la diagonal H_ii sin reentrenar N modelos.',
  });

  // Eq (14): OrbitoGaze Smooth-Pursuit Cross-Correlation Latency Recovery
  drawEquationCard({
    num: 14,
    title:
      language === 'en'
        ? 'OrbitoGaze Oculomotor Pursuit Latency Recovery via Bivariate Pearson Cross-Correlation'
        : 'Recuperación de Latencia Oculomotora en OrbitoGaze por Correlación Cruzada de Pearson',
    heightMm: 12.5,
    math: SEQ(
      SUP(S(SYM.tau), T('*')),
      T(' = '),
      SUB(T('arg max'), SEQ(S(SYM.tau), T(' '), S(SYM.in), T(' [0, 260 ms]'))),
      T(' [ '),
      FRAC(
        SEQ(T('Cov('), SUB(V('g'), V('x')), T('('), V('t'), T('), '), SUB(V('s'), V('x')), T('('), V('t'), T(' - '), S(SYM.tau), T('))')),
        SEQ(SUB(S(SYM.sigma), SEQ(V('g'), V('x'))), T(' '), SUB(S(SYM.sigma), SEQ(V('s'), V('x'))))
      ),
      T(' + '),
      FRAC(
        SEQ(T('Cov('), SUB(V('g'), V('y')), T('('), V('t'), T('), '), SUB(V('s'), V('y')), T('('), V('t'), T(' - '), S(SYM.tau), T('))')),
        SEQ(SUB(S(SYM.sigma), SEQ(V('g'), V('y'))), T(' '), SUB(S(SYM.sigma), SEQ(V('s'), V('y'))))
      ),
      T(' ]')
    ),
    legend:
      language === 'en'
        ? 'Recovers patient physiological pursuit latency tau* before pruning catch-up saccades exceeding 2.2x MAD along the 9.2 s Lissajous orbit.'
        : 'Recupera la latencia fisiológica de seguimiento tau* antes de podar sacadas correctivas (>2.2x MAD) sobre la órbita de Lissajous (9.2 s).',
  });

  // ============================================================================
  // SECTION 4 & EQUATIONS (15) TO (16)
  // ============================================================================
  addSectionHeader(
    '4',
    language === 'en'
      ? 'Sequential Bayesian Target Decoder, LPC-16 Voice Cloning & SaMD Regulatory Architecture'
      : 'Decodificador Bayesiano Secuencial, Clonación Vocal LPC-16 y Arquitectura Clínica SaMD',
    language === 'en'
      ? 'Rather than fragile single-pixel hit-testing, SIGHT maintains a sequential log-posterior probability distribution over all UI targets (Eq. 15) and synthesizes personalized patient speech via a 16th-order all-pole Linear Predictive Coding (LPC-16) vocal tract filter solved via Levinson-Durbin recursion (Eq. 16), within an IEC 62304 Class B, HL7 FHIR R4 (LOINC 80318-9), and AES-256-GCM encrypted architecture:'
      : 'En lugar de evaluar colisiones puntuales inestables, SIGHT mantiene una distribución log-posterior secuencial sobre todos los botones interactivos (Ec. 15) y sintetiza la voz personalizada del paciente mediante un filtro todo-polos LPC de orden 16 resuelto por Levinson-Durbin (Ec. 16), bajo una arquitectura IEC 62304 Clase B, HL7 FHIR R4 (LOINC 80318-9) y cifrado AES-256-GCM:'
  );

  // Eq (15): Sequential Bayesian Gaze-to-Target Posterior Decoder
  drawEquationCard({
    num: 15,
    title:
      language === 'en'
        ? 'Sequential Bayesian Gaze-to-Target Log-Posterior Decoder'
        : 'Decodificador Bayesiano Secuencial Log-Posterior de Objetivos Visuales',
    heightMm: 13.0,
    math: SEQ(
      SUB(V('l'), V('i')),
      T('('),
      V('t'),
      T(') = '),
      S(SYM.gamma),
      SUB(V('l'), V('i')),
      T('('),
      V('t'),
      T('-1) - '),
      FRAC(SUP(SEQ(T('('), SUB(V('g'), T('x,t')), T(' - '), SUB(S(SYM.mu), T('i,x')), T(')')), T('2')), SEQ(T('2'), SUBSUP(S(SYM.sigma), V('X'), T('2')))),
      T(' - '),
      FRAC(SUP(SEQ(T('('), SUB(V('g'), T('y,t')), T(' - '), SUB(S(SYM.mu), T('i,y')), T(')')), T('2')), SEQ(T('2'), SUBSUP(S(SYM.sigma), V('Y'), T('2')))),
      T(',    '),
      V('P'),
      T('('),
      SUB(V('T'), V('i')),
      T(' | '),
      SUB(B('g'), T('1:t')),
      T(') = '),
      FRAC(
        SEQ(T('exp('), SUB(V('l'), V('i')), T('('), V('t'), T('))')),
        SEQ(SUM(SEQ(V('j'), T(' '), S(SYM.in), T(' T'))), T(' exp('), SUB(V('l'), V('j')), T('('), V('t'), T('))'))
      )
    ),
    legend:
      language === 'en'
        ? 'sigma_Y = 40 px > sigma_X = 28 px accommodates vertical eyelid variance; gamma = 0.86 is temporal forgetting factor.'
        : 'sigma_Y = 40 px > sigma_X = 28 px acomoda la varianza vertical palpebral; gamma = 0.86 es el factor de olvido temporal.',
  });

  // Eq (16): LPC-16 Vocal Tract Transfer Function & Wolpaw ITR
  drawEquationCard({
    num: 16,
    title:
      language === 'en'
        ? '16th-Order All-Pole LPC Vocal Tract Filter & Wolpaw Information Transfer Rate (ITR)'
        : 'Función de Transferencia LPC-16 de Tracto Vocal y Tasa de Transferencia de Información (ITR)',
    heightMm: 13.0,
    math: SEQ(
      SUB(V('H'), T('LPC')),
      T('('),
      V('z'),
      T(') = '),
      FRAC(
        V('G'),
        SEQ(T('1 - '), SUM(T('k=1'), T('16')), SUB(V('a'), V('k')), SUP(V('z'), SEQ(T('-'), V('k'))))
      ),
      T(',     ITR = '),
      FRAC(T('60'), SUB(V('T'), T('sel'))),
      T(' [ '),
      SUB(T('log'), T('2')),
      V('M'),
      T(' + '),
      V('P'),
      SUB(T(' log'), T('2')),
      V('P'),
      T(' + (1-'),
      V('P'),
      T(')'),
      SUB(T('log'), T('2')),
      FRAC(SEQ(T('1 - '), V('P')), SEQ(V('M'), T(' - 1'))),
      T(' ]')
    ),
    legend:
      language === 'en'
        ? 'LPC-16 poles satisfy |z_k| <= 0.985 via Levinson-Durbin; Wolpaw ITR yields 148.6 bits/min (24.8 WPM) across M = 36 AAC targets.'
        : 'Los polos LPC-16 verifican |z_k| <= 0.985 vía Levinson-Durbin; la ITR de Wolpaw alcanza 148.6 bits/min (24.8 WPM) sobre M = 36 teclas.',
  });

  // ============================================================================
  // SECTION 5: COMPARATIVE BENCHMARK & ABLATION TABLES
  // ============================================================================
  checkPageBreak(42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(12, 32, 68);
  doc.text(
    sanitizeWinAnsi(
      language === 'en'
        ? '5. Comparative Benchmark & Component-Wise Ablation Study (1920x1080, 60 cm, N=20, p < 0.001)'
        : '5. Benchmark Comparativo y Estudio de Ablación por Componentes (1920x1080, 60 cm, N=20, p < 0.001)'
    ),
    marginLeft,
    cursorY
  );
  cursorY += 4.2;

  const benchRows =
    language === 'en'
      ? [
          ['Architecture / Method', 'RMSE (px)', 'Angle (deg)', 'Jitter (RMS)', 'Edge Reach.', 'ITR (bits/m)', 'Speed (WPM)'],
          ['Shepard Inverse Distance (IDW)', '78.4 +/- 14.2', '2.80 deg', '18.60 px', '74.2%', '46.2', '7.7 WPM'],
          ['Global Barycentric Affine (6-DOF)', '54.1 +/- 9.8', '1.93 deg', '11.40 px', '88.5%', '68.4', '11.4 WPM'],
          ['Single-Canthus Bivariate Ridge', '29.8 +/- 4.6', '1.06 deg', '2.15 px', '99.4%', '104.8', '17.5 WPM'],
          ['Isotropic Thin-Plate Spline (TPS)', '22.4 +/- 3.9', '0.80 deg', '1.84 px', '96.1%', '116.5', '19.4 WPM'],
          ['OrbitoGaze Pursuit (9.2 s Lissajous)', '10.6 +/- 2.3*', '0.38 deg*', '0.16 px*', '99.6%', '141.2*', '23.5 WPM*'],
          ['SIGHT Full (M-QPM + Hering + ROI)', '8.2 +/- 1.9*', '0.29 deg*', '0.12 px*', '99.8%', '148.6*', '24.8 WPM*'],
        ]
      : [
          ['Arquitectura / Método', 'RMSE (px)', 'Ángulo (deg)', 'Jitter (RMS)', 'Alcance', 'ITR (bits/m)', 'Velocidad'],
          ['Shepard Distancia Inversa (IDW)', '78.4 +/- 14.2', '2.80 deg', '18.60 px', '74.2%', '46.2', '7.7 WPM'],
          ['Afín Baricéntrico Global (6-DOF)', '54.1 +/- 9.8', '1.93 deg', '11.40 px', '88.5%', '68.4', '11.4 WPM'],
          ['Ridge Bivariado Canto Simple', '29.8 +/- 4.6', '1.06 deg', '2.15 px', '99.4%', '104.8', '17.5 WPM'],
          ['Thin-Plate Spline Isótropo (TPS)', '22.4 +/- 3.9', '0.80 deg', '1.84 px', '96.1%', '116.5', '19.4 WPM'],
          ['OrbitoGaze Seguimiento (9.2 s)', '10.6 +/- 2.3*', '0.38 deg*', '0.16 px*', '99.6%', '141.2*', '23.5 WPM*'],
          ['SIGHT Completo (M-QPM + Hering)', '8.2 +/- 1.9*', '0.29 deg*', '0.12 px*', '99.8%', '148.6*', '24.8 WPM*'],
        ];

  const colWidths = [54, 23, 19, 21, 20, 21, 22];
  const rowH = 4.8;
  benchRows.forEach((row, rIdx) => {
    if (rIdx === 0) {
      doc.setFillColor(228, 236, 248);
      doc.rect(marginLeft, cursorY, printableWidth, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.1);
      doc.setTextColor(15, 35, 70);
    } else {
      if (rIdx % 2 === 0) {
        doc.setFillColor(248, 250, 254);
        doc.rect(marginLeft, cursorY, printableWidth, rowH, 'F');
      }
      doc.setFont('helvetica', rIdx === benchRows.length - 1 ? 'bold' : 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(
        rIdx === benchRows.length - 1 ? 10 : 45,
        rIdx === benchRows.length - 1 ? 85 : 55,
        rIdx === benchRows.length - 1 ? 160 : 70
      );
    }
    let cx = marginLeft + 1.5;
    row.forEach((cell, cIdx) => {
      doc.text(sanitizeWinAnsi(cell), cx, cursorY + 3.4);
      cx += colWidths[cIdx];
    });
    cursorY += rowH;
  });
  cursorY += 3.5;

  // Table 2: Ablation Study Table
  checkPageBreak(38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.3);
  doc.setTextColor(20, 40, 75);
  doc.text(
    sanitizeWinAnsi(
      language === 'en'
        ? 'Table 2: Component-Wise Ablation Study & Sub-Frame Latency Budget (Total: 11.40 ms / frame @ 60 FPS)'
        : 'Tabla 2: Estudio de Ablación por Componentes y Presupuesto de Latencia (Total: 11.40 ms / fotograma @ 60 FPS)'
    ),
    marginLeft,
    cursorY
  );
  cursorY += 3.8;

  const ablationRows =
    language === 'en'
      ? [
          ['Incremental Pipeline Configuration', 'RMSE (px)', 'Angle (deg)', 'Fixation Jitter', 'Stage Latency'],
          ['1. Raw Single-Canthus Iris + Bivariate Poly2 (Eq. 1)', '46.2 +/- 8.4 px', '1.65 deg', '14.80 px RMS', '8.20 ms (WASM)'],
          ['2. + 4-Pt Bony Canthal Constellation & Chord Iris (Eq. 2-4)', '29.8 +/- 4.6 px', '1.06 deg', '6.42 px RMS', '+0.25 ms'],
          ['3. + Sub-Pixel Photometric ROI & Purkinje Inpaint (Eq. 5)', '19.4 +/- 3.2 px', '0.69 deg', '4.10 px RMS', '+1.35 ms'],
          ['4. + 3D Eyeball Raycast + SE(3) + Blendshapes (Eq. 6)', '14.1 +/- 2.6 px', '0.50 deg', '2.85 px RMS', '+0.20 ms'],
          ['5. + Hering Conjugate Gate + 5-Tap + 1-Euro (Eq. 7-8)', '11.3 +/- 2.2 px', '0.40 deg', '0.48 px RMS', '+0.18 ms'],
          ['6. + M-QPM + IRLS + Cubic Kalman + Dual Lock (Eq. 9-16)', '8.2 +/- 1.9 px', '0.29 deg', '0.12 px (-94%)', '+1.22 ms (11.4 ms)'],
        ]
      : [
          ['Configuración Incremental del Pipeline', 'RMSE (px)', 'Ángulo (deg)', 'Jitter Fijación', 'Latencia Etapa'],
          ['1. Iris Canto Simple Crudo + Polinomio Bivariado (Ec. 1)', '46.2 +/- 8.4 px', '1.65 deg', '14.80 px RMS', '8.20 ms (WASM)'],
          ['2. + Constelación Cantal Ósea 4-Pt e Iris Cuerda (Ec. 2-4)', '29.8 +/- 4.6 px', '1.06 deg', '6.42 px RMS', '+0.25 ms'],
          ['3. + ROI Fotométrica Sub-Píxel e Inpainting Purkinje (Ec. 5)', '19.4 +/- 3.2 px', '0.69 deg', '4.10 px RMS', '+1.35 ms'],
          ['4. + Raycast Esférico 3D + SE(3) + Blendshapes (Ec. 6)', '14.1 +/- 2.6 px', '0.50 deg', '2.85 px RMS', '+0.20 ms'],
          ['5. + Puerta Conjugada Hering + 5-Tap + 1-Euro (Ec. 7-8)', '11.3 +/- 2.2 px', '0.40 deg', '0.48 px RMS', '+0.18 ms'],
          ['6. + M-QPM + IRLS + Kalman Cúbico + Lock Dual (Ec. 9-16)', '8.2 +/- 1.9 px', '0.29 deg', '0.12 px (-94%)', '+1.22 ms (11.4 ms)'],
        ];

  const abWidths = [78, 26, 20, 28, 28];
  ablationRows.forEach((row, rIdx) => {
    if (rIdx === 0) {
      doc.setFillColor(232, 240, 250);
      doc.rect(marginLeft, cursorY, printableWidth, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.1);
      doc.setTextColor(15, 35, 70);
    } else {
      if (rIdx % 2 === 0) {
        doc.setFillColor(248, 250, 254);
        doc.rect(marginLeft, cursorY, printableWidth, rowH, 'F');
      }
      doc.setFont('helvetica', rIdx === ablationRows.length - 1 ? 'bold' : 'normal');
      doc.setFontSize(7.1);
      doc.setTextColor(
        rIdx === ablationRows.length - 1 ? 10 : 45,
        rIdx === ablationRows.length - 1 ? 85 : 55,
        rIdx === ablationRows.length - 1 ? 160 : 70
      );
    }
    let cx = marginLeft + 1.5;
    row.forEach((cell, cIdx) => {
      doc.text(sanitizeWinAnsi(cell), cx, cursorY + 3.4);
      cx += abWidths[cIdx];
    });
    cursorY += rowH;
  });
  cursorY += 4.2;

  // ============================================================================
  // SECTION 6: OPENREVIEW MANDATORY STATEMENTS
  // ============================================================================
  addSectionHeader(
    '6',
    language === 'en'
      ? 'OpenReview Mandatory Statements: Limitations, Ethics & Reproducibility'
      : 'Declaraciones Obligatorias OpenReview: Limitaciones, Ética y Reproducibilidad',
    language === 'en'
      ? 'Limitations: Operating in visible light without active NIR LEDs means extreme ambient darkness (<15 lux) or dark-tinted lenses reduce sub-pixel photometric contrast, gracefully falling back to geometric canthal-iris landmarks (~0.55 deg error). Complete external ophthalmoplegia (total LIS) requires EEG/fNIRS BCIs. Ethics & Societal Impact: Eliminates the $3,000-$15,000 USD proprietary hardware barrier with 100% local privacy, explicit opt-in consent, and PBKDF2 + AES-256-GCM encrypted patient vaults. Reproducibility: Full TypeScript code, 61 deterministic unit tests, and automated clinical/security auditors (npm run pipeline) are openly available at https://github.com/alarti/sight.'
      : 'Limitaciones: Al operar en luz visible sin iluminación NIR activa, la oscuridad severa (<15 lux) o lentes tintadas reducen el contraste fotométrico sub-píxel, degradando de forma segura hacia los hitos cantales (~0.55 deg de error). En oftalmoplejía externa total (LIS completo) se requieren BCIs (EEG/fNIRS). Ética e Impacto Social: Elimina la barrera de $3,000-$15,000 USD operando 100% en local sin telemetría, con consentimiento opt-in y bóveda cifrada PBKDF2 + AES-256-GCM. Reproducibilidad: Código completo en TypeScript, 61 tests unitarios deterministas y auditores (npm run pipeline) abiertos en https://github.com/alarti/sight.'
  );

  // ============================================================================
  // SECTION 7: APA 7th EDITION REFERENCES
  // ============================================================================
  checkPageBreak(42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(12, 32, 68);
  doc.text(
    sanitizeWinAnsi(
      language === 'en' ? '7. References (APA 7th Edition)' : '7. Referencias Bibliográficas (Formato APA 7ª Edición)'
    ),
    marginLeft,
    cursorY
  );
  cursorY += 4.2;

  const references = [
    'Beukelman, D. R., Fager, S., Ball, L., & Dietz, A. (2007). AAC for adults with acquired neurological conditions: A review. Augmentative and Alternative Communication, 23(3), 230-242. https://doi.org/10.1080/07434610701553668',
    'Blignaut, P. (2014). Mapping the pupil center to screen coordinates: A comparison of polynomial and artificial neural network interpolation. Journal of Eye Movement Research, 7(1), 1-13. https://doi.org/10.16910/jemr.7.1.3',
    'Bookstein, F. L. (1989). Principal warps: Thin-plate splines and the decomposition of deformations. IEEE Transactions on Pattern Analysis and Machine Intelligence, 11(6), 567-585. https://doi.org/10.1109/34.24792',
    'Calvo, A. C., Manzano, R., Atencia-Gómez, G., Muñoz, M. J., Zaragoza, P., & Osta, R. (2014). Amyotrophic lateral sclerosis: A focus on disease progression. BioMed Research International, 2014, Article 480170. https://doi.org/10.1155/2014/480170',
    'Casiez, G., Roussel, N., & Vogel, D. (2012). 1-Euro filter: A simple speed-based low-pass filter for noisy input in interactive systems. In Proceedings of the SIGCHI Conference on Human Factors in Computing Systems (pp. 2527-2530). ACM. https://doi.org/10.1145/2207676.2208639',
    'Cerrolaza, J. J., Villanueva, A., & Cabeza, R. (2012). Taxonomic categorization of polynomial regressions used in video-oculography for gaze estimation. IEEE Transactions on Biomedical Engineering, 59(10), 2938-2948. https://doi.org/10.1109/TBME.2012.2212437',
    'Guestrin, E. D., & Eizenman, M. (2006). General theory of remote gaze estimation using the pupil center and corneal reflections. IEEE Transactions on Biomedical Engineering, 53(6), 1124-1133. https://doi.org/10.1109/TBME.2005.863952',
    'Hansen, D. W., & Ji, Q. (2010). In the eye of the beholder: A survey of models for eyes and gaze. IEEE Transactions on Pattern Analysis and Machine Intelligence, 32(3), 478-500. https://doi.org/10.1109/TPAMI.2009.30',
    'Huber, P. J. (1964). Robust estimation of a location parameter. The Annals of Mathematical Statistics, 35(1), 73-101. https://doi.org/10.1214/aoms/1177703732',
    'Kanning, K. C., Kaplan, A., & Henderson, C. E. (2010). Motor neuron diversity in development and disease. Annual Review of Neuroscience, 33(1), 409-440. https://doi.org/10.1146/annurev.neuro.051508.135722',
    'Klatt, D. H. (1980). Software for a cascade/parallel formant synthesizer. The Journal of the Acoustical Society of America, 67(3), 971-995. https://doi.org/10.1121/1.383940',
    'Lugaresi, C., Tang, J., Nash, H., McClanahan, C., Uboweja, E., Hays, M., Zhang, F., Chang, C.-L., Yong, M. G., Lee, J., Chang, W.-T., Hua, W., Georg, M., & Grundmann, M. (2019). MediaPipe: A framework for building perception pipelines. arXiv preprint arXiv:1906.08172. https://doi.org/10.48550/arXiv.1906.08172',
    'Pfeuffer, K., Vidal, M., Turner, J., Bulling, A., & Gellersen, H. (2013). Pursuit calibration: Making gaze calibration less tedious and more flexible. In Proceedings of the 26th Annual ACM Symposium on User Interface Software and Technology (pp. 261-270). ACM. https://doi.org/10.1145/2501988.2501998',
    'Wolpaw, J. R., Birbaumer, N., McFarland, D. J., Pfurtscheller, G., & Vaughan, T. M. (2002). Brain-computer interfaces for communication and control. Clinical Neurophysiology, 113(6), 767-791. https://doi.org/10.1016/S1388-2457(02)00057-3',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.1);
  doc.setTextColor(55, 65, 80);

  for (const ref of references) {
    const refLines = doc.splitTextToSize(sanitizeWinAnsi(ref), printableWidth);
    checkPageBreak(refLines.length * 3.3 + 1.5);
    doc.text(refLines, marginLeft, cursorY);
    cursorY += refLines.length * 3.3 + 1.3;
  }

  // Trigger immediate download in browser
  const filename = language === 'en' ? 'alberto_arce_als_gaze_paper.pdf' : 'articulo_calibracion_ela_alberto_arce.pdf';
  doc.save(filename);
}
