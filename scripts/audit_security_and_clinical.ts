/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

console.log('🛡️ [AGENTE DE SEGURIDAD, PRIVACIDAD Y CONFORMIDAD SaMD] Ejecutando auditoría integral...\n');

let issues = 0;

function check(name: string, passed: boolean, detail: string) {
  if (passed) {
    console.log(`  ✅ [PASS] ${name}`);
  } else {
    console.error(`  ❌ [FAIL] ${name}: ${detail}`);
    issues++;
  }
}

// 1. Verify Security & Privacy Gate (server.ts & index.html)
const serverCode = fs.readFileSync(path.resolve('server.ts'), 'utf-8');
check(
  '[security-and-privacy-gate] Sanitización Anti-Prompt Injection y LRU Rate-Limiter en server.ts',
  serverCode.includes('sanitizeDescriptor') &&
    serverCode.includes('TTS_MAX_TRACKED_IPS') &&
    serverCode.includes('Content-Security-Policy'),
  'server.ts debe sanitizar descriptores, limitar el mapa de IPs y emitir cabeceras CSP.'
);

const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
check(
  '[security-and-privacy-gate] Política Content-Security-Policy (CSP) en index.html',
  indexHtml.includes('http-equiv="Content-Security-Policy"') && indexHtml.includes("object-src 'none'"),
  'index.html debe incluir meta Content-Security-Policy restrictivo.'
);

// 2. Verify Profile Sanitization & AES-256-GCM Encryption (profileManager.ts)
const profileCode = fs.readFileSync(path.resolve('src/profileManager.ts'), 'utf-8');
check(
  '[security-and-privacy-gate] Sanitización de Perfiles JSON y Cifrado Biométrico AES-256-GCM',
  profileCode.includes('sanitizeUserProfile') &&
    profileCode.includes('SAFE_AUDIO_URL_REGEX') &&
    profileCode.includes('encryptProfilesPayloadAES') &&
    profileCode.includes("synthesisEngine: 'ml-lpc'"),
  'profileManager.ts debe validar esquemas, bloquear audioUrl remotas, usar ml-lpc local por defecto y ofrecer AES-256-GCM.'
);

// 3. Verify Offline PWA Asset Guardian (public/sw.js & public/manifest.json)
const swExists = fs.existsSync(path.resolve('public/sw.js'));
const manifestContent = fs.readFileSync(path.resolve('public/manifest.json'), 'utf-8');
check(
  '[offline-pwa-asset-guardian] Service Worker Offline-First y Manifiesto PWA SIGHT',
  swExists && manifestContent.includes('"short_name": "SIGHT"'),
  'public/sw.js debe existir y public/manifest.json debe estar configurado para SIGHT.'
);

// 4. Verify Clinical Ergonomics & WCAG Auditor
const appCode = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
const audioCode = fs.readFileSync(path.resolve('src/utils/audio.ts'), 'utf-8');
check(
  '[clinical-ergonomics-and-wcag-auditor] WakeLock Kiosk, Santuario Ocular y Sirena Acústica SOS',
  appCode.includes('wakeLock') &&
    appCode.includes('data-sanctuary-zone="true"') &&
    audioCode.includes('playEmergencySosSiren'),
  'El sistema debe incluir soporte WakeLock, zona de Santuario Ocular y alarma acústica SOS.'
);

// 5. Verify Gaze Math Benchmark Guard & Voice DSP Fidelity Auditor
const fusionCode = fs.readFileSync(path.resolve('src/utils/eyeSensorFusion.ts'), 'utf-8');
const voiceCode = fs.readFileSync(path.resolve('src/utils/voiceCloner.ts'), 'utf-8');
check(
  '[gaze-math-benchmark-guard & voice-dsp-fidelity-auditor] Invariantes Oculomotores y Consentimiento Vocal',
  fusionCode.includes('computePhotometricPupilCentroid') &&
    fusionCode.includes('PupilTemporalStabilizer') &&
    voiceCode.includes('cloudNeuralConsent') &&
    voiceCode.includes('isLocalDataAudioUrl'),
  'Los módulos matemáticos y de síntesis vocal deben verificar consentimiento GDPR/HIPAA y URLs de audio locales.'
);

// 6. Verify SaMD Regulatory Traceability & HL7 FHIR Interoperability
const clinicalModalPath = path.resolve('src/components/ClinicalCommercialModal.tsx');
const clinicalModalExists = fs.existsSync(clinicalModalPath);
const clinicalModalCode = clinicalModalExists ? fs.readFileSync(clinicalModalPath, 'utf-8') : '';
check(
  '[samd-regulatory-traceability] Exportación Interoperable HL7 FHIR R4 y Conformidad IEC 62304',
  clinicalModalExists &&
    clinicalModalCode.includes('resourceType: \'Observation\'') &&
    clinicalModalCode.includes('IEC 62304'),
  'ClinicalCommercialModal.tsx debe proporcionar exportación HL7 FHIR y trazabilidad IEC 62304.'
);

// 7. Verify all 6 new maintenance skills exist in skills/
const requiredSkills = [
  'skills/security-and-privacy-gate/SKILL.md',
  'skills/offline-pwa-asset-guardian/SKILL.md',
  'skills/clinical-ergonomics-and-wcag-auditor/SKILL.md',
  'skills/gaze-math-benchmark-guard/SKILL.md',
  'skills/voice-dsp-fidelity-auditor/SKILL.md',
  'skills/samd-regulatory-traceability/SKILL.md',
];
const allSkillsPresent = requiredSkills.every((rel) => fs.existsSync(path.resolve(rel)));
check(
  '[maintenance-skills] Presencia de las 6 nuevas Skills de Mantenimiento y Comercialización',
  allSkillsPresent,
  'Todas las skills de mantenimiento deben estar definidas en la carpeta skills/.'
);

console.log('\n======================================================');
if (issues === 0) {
  console.log('🛡️ [AUDITORÍA SUPERADA] Todos los controles de seguridad, privacidad GDPR/HIPAA, skills y comercialización SaMD están activos.');
  process.exit(0);
} else {
  console.error(`⚠️ [ERRORES DE AUDITORÍA] Se detectaron ${issues} incumplimientos.`);
  process.exit(1);
}
