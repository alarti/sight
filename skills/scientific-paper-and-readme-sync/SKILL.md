---
name: scientific-paper-and-readme-sync
description: >
  Synchronizes all scientific and technical documentation platforms (README.md, Spanish & English
  LaTeX preprints, jsPDF client-side PDF generator, interactive ScientificPaperModal, and GitHub Pages /docs)
  whenever eye-tracking, calibration, pupil detection, or voice synthesis algorithms are added or improved.
---

# Skill: Sincronización Multiplataforma de Paper Científico, PDF, LaTeX y README

Este skill garantiza que cada avance algorítmico en **SIGHT** (detección pupilar sub-píxel, supresión de temblor binocular conjugado, fusión sensorial multimodal, calibración M-QPM / TPS / OrbitoGaze, decodificador bayesiano y clonación acústica LPC-16) quede reflejado de forma íntegra, rigurosa y simultánea en todas las plataformas del proyecto.

---

## 1. Plataformas y Artefactos Obligatorios a Sincronizar

1. **Repositorio y Documentación Técnica (`README.md`)**:
   - Resumen arquitectónico actualizado con todos los módulos matemáticos, ecuaciones clave, métricas de precisión y guía de despliegue en GitHub Pages (`https://alarti.github.io/sight/`).
2. **Artículo Científico Maestro en LaTeX — Español (`public/paper_calibracion_ela.tex`)**:
   - Documento académico IEEE/ACM a doble columna con autoría de **Alberto Arce Rodríguez**, ecuaciones numeradas, arquitectura completa de 6 etapas y bibliografía APA 7ª edición con DOIs.
3. **Artículo Científico Maestro en LaTeX — Inglés (`public/paper_calibracion_ela_en.tex`)**:
   - Versión íntegra en inglés sincronizada sección por sección con el documento maestro en español.
4. **Generador Dinámico de PDF en el Navegador (`src/utils/pdfGenerator.ts`)**:
   - Renderizador `jsPDF` bilingüe (`es` / `en`) que genera `articulo_calibracion_ela_alberto_arce.pdf` y `alberto_arce_als_gaze_paper.pdf` incluyendo todas las secciones algorítmicas y tabla comparativa actualizada.
5. **Visor Académico Interactivo en la App (`src/components/ScientificPaperModal.tsx`)**:
   - Vista web formateada bilingüe (`es` / `en`) y visor de código fuente LaTeX en vivo.
6. **Build Estático para GitHub Pages (`docs/`)**:
   - Ejecución de `npm run build:pages` para sincronizar `/docs/paper_calibracion_ela.tex`, `/docs/paper_calibracion_ela_en.tex` y los bundles compilados.

---

## 2. Flujo de Ejecución y Verificación

Cada vez que se aplique este skill junto con `docs-and-papers`, `code-review`, `unit-testing` y `technical-debt-elimination`:
```bash
npm run pipeline
npm run build:pages
```
El script `scripts/update_docs.ts` verifica automáticamente que todos los artefactos contengan tanto la atribución de autoría de **Alberto Arce Rodríguez** como los últimos avances algorítmicos (fusión fotométrica, estabilizador conjugado Hering, M-QPM, OrbitoGaze, decodificador Bayesiano y síntesis LPC-16).
