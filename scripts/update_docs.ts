/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

console.log('📚 [AGENTE DE DOCUMENTACIÓN Y PAPERS] Verificando sincronización de publicaciones...\n');

let errors = 0;

function verify(name: string, ok: boolean, detail: string) {
  if (ok) {
    console.log(`  ✅ [OK] ${name}`);
  } else {
    console.error(`  ❌ [ERROR] ${name}: ${detail}`);
    errors++;
  }
}

// 1. Check LaTeX file existence and size
const texPath = path.resolve('public/paper_calibracion_ela.tex');
const texExists = fs.existsSync(texPath);
verify('Existencia de archivo LaTeX maestro', texExists, 'No se encuentra public/paper_calibracion_ela.tex');

if (texExists) {
  const texContent = fs.readFileSync(texPath, 'utf-8');
  verify(
    'Autoría de Alberto Arce Rodríguez en LaTeX',
    texContent.includes('Alberto Arce Rodr'),
    'El autor principal debe ser Alberto Arce Rodríguez.'
  );
  verify(
    'Inclusión de Referencias en formato APA 7',
    texContent.includes('References') && texContent.includes('https://doi.org/'),
    'El artículo debe incluir referencias bibliográficas completas en formato APA 7ª edición con DOIs.'
  );
  verify(
    'Ecuaciones de Regresión Polinomial en LaTeX',
    texContent.includes('\\boldsymbol{\\phi}') || texContent.includes('Ridge'),
    'El artículo debe detallar la formulación matemática de la regresión Ridge bivariada.'
  );
}

// 2. Check PDF Generator sync
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
}

// 3. Check Modal Viewer sync
const modalPath = path.resolve('src/components/ScientificPaperModal.tsx');
const modalExists = fs.existsSync(modalPath);
verify('Modal Académico Interactivo', modalExists, 'No se encuentra src/components/ScientificPaperModal.tsx');

if (modalExists) {
  const modalContent = fs.readFileSync(modalPath, 'utf-8');
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
}

console.log('\n======================================================');
if (errors === 0) {
  console.log('📖 [SINCRONIZACIÓN EXITOSA] Toda la documentación y papers están perfectamente actualizados y alineados.');
  process.exit(0);
} else {
  console.error(`⚠️ [DISCREPANCIAS] Se encontraron ${errors} problemas en la documentación.`);
  process.exit(1);
}
