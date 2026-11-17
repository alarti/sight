---
name: offline-pwa-asset-guardian
description: >
  Guarantees 100% offline clinical availability for ALS patients in hospitals or homes without internet.
  Verifies PWA manifest.json, Service Worker (public/sw.js), and WakeLock Kiosk persistence.
---

# Skill: Guardián de Autonomía Offline-First y Kiosco Clínico (PWA)

Garantiza que **SIGHT** funcione de manera ininterrumpida en entornos hospitalarios con firewalls restrictivos o domicilios sin conexión a internet.

---

## 1. Requisitos Auditados
1. **Service Worker Clínico (`public/sw.js`):**
   - Cachea el shell de la aplicación (`index.html`, `manifest.json`, `icon.svg`, preprints LaTeX) y almacena de forma persistente los binarios WebAssembly y `face_landmarker.task` tras la primera carga.
2. **Manifiesto PWA (`public/manifest.json`):**
   - Configurado en modo `standalone` y orientación `landscape` con identidad oficial de **SIGHT**.
3. **Kiosco con `WakeLock` Anti-Suspensión (`src/App.tsx`):**
   - Mantiene activa la pantalla mediante `navigator.wakeLock.request('screen')` y la renueva automáticamente en `visibilitychange`.
