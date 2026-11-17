---
name: code-review
description: >
  Performs automated static code quality analysis, performance checks for 60 FPS eye-tracking,
  assistive accessibility compliance (dwell delay, high contrast), and privacy guarantees
  (zero-telemetry, 100% in-browser processing). Launches automated code review agents.
---

# Skill: Revisión de Código y Auditoría de Calidad Asistencial

Este skill define los estándares no negociables de calidad, rendimiento y accesibilidad clínica que deben verificarse en cada revisión de código.

---

## 1. Comprobaciones Esenciales del Agente Revisor

Siempre que se implemente una nueva característica o se refactorice el código, debe ejecutarse:
```bash
npm run review
```
Este script audita automáticamente:

1. **Rendimiento a 60 FPS en el Bucle Ocular:**
   - Cero asignaciones pesadas de memoria en `requestAnimationFrame`.
   - Reutilización de matrices y objetos temporales en la detección de landmarks.
   - Timestamps estrictamente monótonos para llamadas a `detectForVideo`.
   - Supresión de logs repetitivos en consola durante el rastreo continuo.
2. **Arquitectura 100% Sin Servidor y Privacidad:**
   - Cero envío de fotogramas, vídeo o datos faciales a endpoints remotos.
   - Procesamiento exclusivo en GPU/WASM mediante MediaPipe Tasks Vision.
   - Almacenamiento seguro en `localStorage` con copia de seguridad en JSON local.
3. **Accesibilidad para ELA (Navaja de Ockham Asistencial):**
   - Objetivos de mirada con dimensiones generosas (mínimo 48x48px).
   - Temporizador Dwell con feedback visual circular y chimes auditivos claros.
   - Modo Sticky Selector ("método de Mario") con paso discreto entre letras.
   - Clic forzado mediante entrecerrar de ojos (*squint-to-click*).
4. **Resiliencia ante Fallos de Delegado GPU/CPU:**
   - Fallback automático y transparente de `GPU` a `CPU` (XNNPACK) si WebGL está deshabilitado.
   - Redirección de mensajes diagnósticos de WebAssembly (`INFO:`) a `console.info` para evitar falsos positivos de error.

---

## 2. Comandos de Verificación
- `npm run review`: Ejecuta el analizador estático de reglas del proyecto.
- `npm run lint`: Valida tipos de TypeScript y ausencia de imports rotos.
- `npm run pipeline`: Ejecuta `lint` + `test` + `review` en un solo paso.
