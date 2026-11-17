/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 [AGENTE REVISOR] Iniciando auditoría estática de calidad, rendimiento y privacidad...\n');

let issuesFound = 0;

function check(ruleName: string, passed: boolean, detail: string) {
  if (passed) {
    console.log(`  ✅ [PASS] ${ruleName}`);
  } else {
    console.error(`  ❌ [FAIL] ${ruleName}: ${detail}`);
    issuesFound++;
  }
}

// 1. Audit Privacy & Serverless Architecture
const srcDir = path.resolve('src');
const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
const codeFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

let hasRemoteTelemetry = false;
for (const file of codeFiles) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  if (content.includes('navigator.sendBeacon') || content.includes('/api/telemetry')) {
    hasRemoteTelemetry = true;
    break;
  }
}
check(
  'Arquitectura 100% Cliente (Cero Telemetría Remota)',
  !hasRemoteTelemetry,
  'Se encontraron llamadas de telemetría remota que comprometen la privacidad clínica del paciente.'
);

// 2. Audit Monotonic Timestamps for MediaPipe
const eyeTrackerFile = path.resolve('src/eyeTracker.ts');
const eyeTrackerCode = fs.readFileSync(eyeTrackerFile, 'utf-8');
check(
  'Timestamps Monótonos para MediaPipe detectForVideo',
  eyeTrackerCode.includes('timestampMs <= this.lastTimestampMs'),
  'detectForVideo debe recibir timestamps crecientes para evitar excepciones en MediaPipe.'
);

// 3. Audit GPU Fallback to CPU Delegate
check(
  'Tolerancia a Fallos: Delegado GPU con Fallback a CPU',
  eyeTrackerCode.includes('delegate: "CPU"') && eyeTrackerCode.includes('delegate: "GPU"'),
  'eyeTracker.ts debe incluir fallback automático a CPU cuando WebGL no esté disponible.'
);

// 4. Audit WebAssembly/TFLite Info Log Redirection
const mainFile = path.resolve('src/main.tsx');
const mainCode = fs.readFileSync(mainFile, 'utf-8');
check(
  'Filtrado de Mensajes Diagnósticos WebAssembly INFO (XNNPACK)',
  mainCode.includes('Created TensorFlow Lite XNNPACK delegate') || mainCode.includes('INFO:'),
  'main.tsx debe redirigir los logs diagnósticos de Emscripten para evitar falsos positivos de error.'
);

// 5. Audit Paper Authorship Attribution (Alberto Arce Rodríguez)
const texFile = path.resolve('public/paper_calibracion_ela.tex');
const texCode = fs.readFileSync(texFile, 'utf-8');
check(
  'Atribución de Autoría en Artículo LaTeX (Alberto Arce Rodríguez)',
  texCode.includes('Alberto Arce Rodr') || texCode.includes('Alberto Arce Rodríguez'),
  'El artículo LaTeX debe acreditar formalmente a Alberto Arce Rodríguez como autor principal.'
);

// 6. Audit PDF Generation Utility
const pdfFile = path.resolve('src/utils/pdfGenerator.ts');
const pdfExists = fs.existsSync(pdfFile);
const pdfCode = pdfExists ? fs.readFileSync(pdfFile, 'utf-8') : '';
check(
  'Generador de PDF Académico Disponible con Autoría de Alberto Arce Rodríguez',
  pdfExists && pdfCode.includes('Alberto Arce Rodríguez'),
  'src/utils/pdfGenerator.ts debe existir y generar el PDF con el nombre de Alberto Arce Rodríguez.'
);

// 7. Audit Bivariate Polynomial Ridge Calibration
const calibFile = path.resolve('src/utils/calibration.ts');
const calibCode = fs.readFileSync(calibFile, 'utf-8');
check(
  'Modelo Matemático: Regresión Polinomial Bivariada Regularizada',
  calibCode.includes('fitBivariateCalibration') && calibCode.includes('evaluatePolynomialGaze'),
  'src/utils/calibration.ts debe resolver la regresión Ridge de 2º orden con 8 coeficientes.'
);

console.log('\n======================================================');
if (issuesFound === 0) {
  console.log('🎉 [RESULTADO] Todos los controles de revisión de código han sido superados con éxito.');
  process.exit(0);
} else {
  console.error(`⚠️ [RESULTADO] Se encontraron ${issuesFound} discrepancias en la revisión.`);
  process.exit(1);
}
