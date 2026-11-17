---
name: security-and-privacy-gate
description: >
  Enforces clinical-grade cybersecurity, GDPR/HIPAA privacy, Content-Security-Policy (CSP),
  LLM prompt-injection sanitization in /api/tts, prototype-pollution protection in profile JSON imports,
  and AES-256-GCM biometric encryption verification.
---

# Skill: Auditoría de Seguridad Cibernética y Privacidad Clínica (GDPR / HIPAA)

Este skill define las barreras de seguridad obligatorias para proteger los datos biométricos y las comunicaciones clínicas de los pacientes con ELA en **SIGHT**.

---

## 1. Controles Obligatorios Verificados Automáticamente (`npm run security-audit`)

1. **Sanitización Anti-Prompt Injection y Rate-Limiting Acotado (`server.ts`):**
   - `sanitizeDescriptor` elimina caracteres de control y acota el tamaño de `style` y `detectedTimbre`.
   - `clampNumeric` restringe `fundamentalFreqHz` ($65\text{--}450\text{ Hz}$) y formantes ($F_1, F_2$).
   - `TTS_MAX_TRACKED_IPS` y recolector periódico (`setInterval`) previenen agotamiento de memoria RAM (DoS).
   - Cabeceras HTTP estrictas: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Permissions-Policy`.

2. **Deserialización Segura y Prevención de Exfiltración (`src/profileManager.ts`):**
   - `sanitizeUserProfile` filtra `__proto__` y `constructor` (prevención de *Prototype Pollution*).
   - `isSafeAudioUrl` verifica mediante expresión regular `SAFE_AUDIO_URL_REGEX` que ningún audio apunte a servidores externos (`http://` o `https://`), aceptando exclusivamente `data:audio/...` o `idb://voice-audio/...`.

3. **Consentimiento Informado GDPR/HIPAA (`DEFAULT_VOICE_PROFILE` y `src/utils/voiceCloner.ts`):**
   - El motor vocal por defecto es 100% local (`ml-lpc`).
   - El envío de texto al proxy `/api/tts` requiere `cloudNeuralConsent === true`.

4. **Cifrado Biométrico en Reposo (`encryptProfilesPayloadAES` / `decryptProfilesPayloadAES`):**
   - Derivación de clave `PBKDF2` ($100.000$ iteraciones `SHA-256`) y cifrado autenticado `AES-256-GCM` mediante Web Crypto API.
