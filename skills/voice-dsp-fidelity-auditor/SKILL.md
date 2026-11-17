---
name: voice-dsp-fidelity-auditor
description: >
  Audits the acoustic DSP and speech synthesis pipeline (LPC-16 Levinson-Durbin recursion stability,
  Klatt cascade formant resonators, VTLN warping, Fujisaki prosody, and singleton AudioContext lifecycle).
---

# Skill: Auditoría de Fidelidad Acústica DSP y Síntesis Vocal (LPC-16 / Klatt)

Garantiza que el motor de clonación e imitación vocal de **SIGHT** opere con estabilidad numérica, sin fugas de contextos de audio y con paridad acústica respecto al timbre del paciente.

---

## 1. Controles DSP Obligatorios
1. **Estabilidad de Predicción Lineal `LPC-16` (`src/utils/voiceCloner.ts`):**
   - Extracción de coeficientes autorregresivos mediante recursión de Levinson-Durbin con ventana de Hamming y pre-énfasis.
2. **Síntesis Formántica y Prosodia NLP (`speakWithMLLPCSynthesizer`):**
   - Escalado de formantes ($F_1, F_2, F_3$) mediante factor de normalización de longitud de tracto vocal ($\text{VTLN }\alpha \in [0.75, 1.30]$).
3. **Gestión Segura de `AudioContext` (`src/utils/audio.ts`):**
   - Uso de `getSharedAudioContext()` y cierre ordenado de contextos de síntesis para evitar superar el límite de instancias de Web Audio del navegador.
