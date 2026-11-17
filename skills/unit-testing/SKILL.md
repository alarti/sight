---
name: unit-testing
description: >
  Automated test execution, unit test authoring, and mathematical regression verification
  for ALS gaze tracking, calibration matrices, OneEuroFilter, head pose stabilization,
  and profile persistence. Use to execute and maintain test suites on all code modifications.
---

# Skill: Pruebas Unitarias y Verificación Automatizada

Este skill define los protocolos, arquitecturas y comandos obligatorios para la ejecución de pruebas unitarias y verificación de regresión en el Asistente Ocular para ELA.

---

## 1. Principios de Ejecución y Cobertura

Siempre que se modifiquen algoritmos de visión, calibración o estado de perfiles, el agente de pruebas debe ejecutarse mediante:
```bash
npm run test
# o directamente:
npx vitest run
```

### Módulos Críticos Auditados por Pruebas Unitarias:
1. **Regresión Polinomial Bivariada (`src/utils/calibration.ts`):**
   - Expansión de base $\phi(x, y, \psi, \theta) = [1, x, y, xy, x^2, y^2, \psi, \theta]^T$.
   - Regularización de Tikhonov ($L_2$ Ridge) con parámetro $\lambda = 0.05$.
   - Inversión y eliminación gaussiana con pivoteo parcial.
   - Cálculo de RMSE y error angular visual.
2. **Filtro de Ruido Ocular (`OneEuroFilter` en `src/eyeTracker.ts`):**
   - Atenuación de jitter en reposo sin añadir latencia perceptible en sacadas rápidas.
   - Restablecimiento seguro de estado en cambios de fijación.
3. **Pose Cefálica y Compensación en Silla de Ruedas (`src/utils/headPose.ts`):**
   - Estimación 3D de ángulos Yaw, Pitch y Roll desde landmarks faciales MediaPipe.
   - Amortiguación del cabeceo vertical con factor $\gamma = 0.08$.
4. **Gestor de Perfiles ELA (`src/profileManager.ts`):**
   - Persistencia local sin backend (`localStorage`).
   - Exportación e importación segura de copias de seguridad en formato JSON.
   - Preservación de matrices de calibración y centros de reposo neutro.
5. **Autocompletado Predictivo (`src/utils/predictive.ts`):**
   - Generación de oraciones contextuales en español para comunicación rápida.

---

## 2. Convenciones para Nuevas Pruebas

- Los ficheros de prueba deben ubicarse junto a su módulo con sufijo `*.test.ts`.
- Utilizar aserciones matemáticas con tolerancia flotante (`toBeCloseTo`):
  ```typescript
  expect(prediction.x).toBeCloseTo(targetX, 0);
  expect(prediction.y).toBeCloseTo(targetY, 0);
  ```
- Las pruebas deben completarse en menos de 2000 ms y ser 100% deterministas (sin depender de cámaras físicas ni llamadas a red).

---

## 3. Disparador Continuo del Agente
Para verificar que el sistema es totalmente funcional y no presenta regresiones:
```bash
npm run test
```
Este comando se ejecuta automáticamente en el pipeline de control de calidad.
