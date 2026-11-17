/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

console.log('📚 [AGENTE DE DOCUMENTACIÓN Y PAPERS] Verificando sincronización multi-plataforma...\n');

let errors = 0;

function verify(name: string, ok: boolean, detail: string) {
  if (ok) {
    console.log(`  ✅ [OK] ${name}`);
  } else {
    console.error(`  ❌ [ERROR] ${name}: ${detail}`);
    errors++;
  }
}

// 1. Check Spanish LaTeX file existence and content
const texPath = path.resolve('public/paper_calibracion_ela.tex');
const texExists = fs.existsSync(texPath);
verify('Existencia de archivo LaTeX maestro (ES)', texExists, 'No se encuentra public/paper_calibracion_ela.tex');

if (texExists) {
  const texContent = fs.readFileSync(texPath, 'utf-8');
  verify(
    'Autoría de Alberto Arce Rodríguez en LaTeX (ES)',
    texContent.includes('Alberto Arce Rodr'),
    'El autor principal debe ser Alberto Arce Rodríguez.'
  );
  verify(
    'Inclusión de Referencias en formato APA 7 (ES)',
    texContent.includes('References') && texContent.includes('https://doi.org/'),
    'El artículo debe incluir referencias bibliográficas completas en formato APA 7ª edición con DOIs.'
  );
  verify(
    'Ecuaciones de Regresión M-QPM y Estabilización en LaTeX (ES)',
    texContent.includes('Ridge') && texContent.includes('Purkinje') && texContent.includes('Hering'),
    'El artículo LaTeX (ES) debe detallar la Constelación Cantal, Inpainting de Purkinje, Ley de Hering y M-QPM.'
  );
  verify(
    'Estándar OpenReview en LaTeX (ES): Proposición 1, Ablación, ITR, Limitaciones y Ética',
    texContent.includes('proposition') &&
      texContent.includes('tab:ablation') &&
      texContent.includes('148.6') &&
      texContent.includes('sec:limitations') &&
      texContent.includes('AES-256-GCM'),
    'El manuscrito LaTeX (ES) debe incluir Proposición formal, Tabla de Ablación, ITR, Limitaciones/Ética y AES-256-GCM.'
  );
}

// 2. Check English LaTeX file existence and content
const texEnPath = path.resolve('public/paper_calibracion_ela_en.tex');
const texEnExists = fs.existsSync(texEnPath);
verify('Existencia de archivo LaTeX maestro (EN)', texEnExists, 'No se encuentra public/paper_calibracion_ela_en.tex');

if (texEnExists) {
  const texEnContent = fs.readFileSync(texEnPath, 'utf-8');
  verify(
    'Autoría y algoritmos avanzados en LaTeX (EN)',
    texEnContent.includes('Alberto Arce Rodr') &&
      texEnContent.includes('Purkinje') &&
      texEnContent.includes('Hering') &&
      texEnContent.includes('M-QPM'),
    'El artículo LaTeX (EN) debe estar sincronizado con todos los avances.'
  );
  verify(
    'Estándar OpenReview en LaTeX (EN): Proposición 1, Ablación, ITR, Limitaciones y Ética',
    texEnContent.includes('proposition') &&
      texEnContent.includes('tab:ablation') &&
      texEnContent.includes('148.6') &&
      texEnContent.includes('sec:limitations') &&
      texEnContent.includes('AES-256-GCM'),
    'El manuscrito LaTeX (EN) debe incluir Proposición formal, Tabla de Ablación, ITR, Limitaciones/Ética y AES-256-GCM.'
  );
}

// 3. Check PDF Generator sync
const pdfGenPath = path.resolve('src/utils/pdfGenerator.ts');
const pdfGenExists = fs.existsSync(pdfGenPath);
verify('Generador de PDF en TypeScript', pdfGenExists, 'No se encuentra src/utils/pdfGenerator.ts');

if (pdfGenExists) {
  const pdfContent = fs.readFileSync(pdfGenPath, 'utf-8');
  verify(
    'Autor Alberto Arce Rodríguez en generador PDF',
    pdfContent.includes('Alberto Arce Rodríguez'),
    'El generador de PDF debe acreditar a Alberto Arce Rodríguez.'
  );
  verify(
    'Nombre de archivo descargable en PDF',
    pdfContent.includes('articulo_calibracion_ela_alberto_arce.pdf'),
    'El PDF debe descargarse como articulo_calibracion_ela_alberto_arce.pdf'
  );
  verify(
    'Últimos algoritmos y estándar OpenReview en generador PDF (Purkinje, Hering, M-QPM, LPC-16, Ablación, ITR)',
    pdfContent.includes('Purkinje') &&
      pdfContent.includes('Hering') &&
      pdfContent.includes('M-QPM') &&
      pdfContent.includes('LPC-16') &&
      pdfContent.includes('148.6') &&
      pdfContent.includes('OpenReview'),
    'El generador PDF debe incluir todos los últimos avances algorítmicos y secciones OpenReview.'
  );
  verify(
    'Motor de 16 Ecuaciones Matemáticas 2D Vectoriales en generador PDF',
    pdfContent.includes('drawEquationCard') &&
      pdfContent.includes('num: 1,') &&
      pdfContent.includes('num: 16,') &&
      pdfContent.includes("doc.setFont('symbol', 'normal')"),
    'El generador de PDF debe renderizar las 16 ecuaciones matemáticas 2D vectoriales con fuente Symbol y barras de fracción.'
  );
}

// 4. Check Modal Viewer & 2D Math Equations sync
const modalPath = path.resolve('src/components/ScientificPaperModal.tsx');
const mathEqPath = path.resolve('src/components/MathEquations.tsx');
const modalExists = fs.existsSync(modalPath) && fs.existsSync(mathEqPath);
verify('Modal Académico Interactivo y Motor Tipográfico 2D (MathEquations.tsx)', modalExists, 'No se encuentra ScientificPaperModal.tsx o MathEquations.tsx');

if (modalExists) {
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
  const mathEqContent = fs.readFileSync(mathEqPath, 'utf-8');
  verify(
    'Botón de descarga PDF en modal',
    modalContent.includes('generateScientificPaperPDF'),
    'El modal debe incluir la llamada directa a generateScientificPaperPDF.'
  );
  verify(
    'Autor Alberto Arce Rodríguez visible en modal',
    modalContent.includes('Alberto Arce Rodríguez'),
    'El modal debe mostrar a Alberto Arce Rodríguez como autor en la vista formateada.'
  );
  verify(
    'Renderizado de las 16 Ecuaciones 2D en Modal Interactivo y Pestaña de Fórmulas',
    modalContent.includes('Section1Equations') &&
      modalContent.includes('Section2Equations') &&
      modalContent.includes('Section3Equations') &&
      modalContent.includes('Section4Equations') &&
      mathEqContent.includes('number={1}') &&
      mathEqContent.includes('number={16}'),
    'El modal académico debe renderizar las 16 ecuaciones tipográficas 2D (Section1Equations..Section4Equations).'
  );
  verify(
    'Últimos algoritmos y estándar OpenReview en Modal Interactivo (Purkinje, Hering, M-QPM, LPC-16, Ablación, ITR)',
    modalContent.includes('Purkinje') &&
      modalContent.includes('Hering') &&
      modalContent.includes('M-QPM') &&
      modalContent.includes('LPC-16') &&
      modalContent.includes('148.6') &&
      modalContent.includes('OpenReview'),
    'El modal académico debe mostrar todas las secciones algorítmicas y tablas de ablación OpenReview actualizadas.'
  );
}

// 5. Check README.md sync
const readmePath = path.resolve('README.md');
const readmeExists = fs.existsSync(readmePath);
verify('Documentación maestra README.md', readmeExists, 'No se encuentra README.md');

if (readmeExists) {
  const readmeContent = fs.readFileSync(readmePath, 'utf-8');
  verify(
    'Sincronización de algoritmos, 16 ecuaciones matemáticas y estudio de ablación OpenReview en README.md',
    readmeContent.includes('computeRobustCanthalCluster') &&
      readmeContent.includes('PupilTemporalStabilizer') &&
      readmeContent.includes('Purkinje') &&
      readmeContent.includes('M-QPM') &&
      readmeContent.includes('Mathematical Compendium — Core Equations (1) to (16)') &&
      readmeContent.includes('148.6'),
    'README.md debe documentar los últimos algoritmos, las 16 ecuaciones y tablas OpenReview.'
  );
}

console.log('\n======================================================');
if (errors === 0) {
  console.log('📖 [SINCRONIZACIÓN EXITOSA] Toda la documentación, README y papers (LaTeX ES/EN, PDF, Modal) están perfectamente actualizados y alineados.');
  process.exit(0);
} else {
  console.error(`⚠️ [DISCREPANCIAS] Se encontraron ${errors} problemas en la documentación.`);
  process.exit(1);
}
