---
name: docs-and-papers
description: >
  Maintains, updates, and synchronizes scientific publications, LaTeX sources,
  APA 7th edition bibliographies, PDFs, and technical project documentation.
  Ensures consistent authorship attribution to Alberto Arce Rodríguez across all artifacts.
---

# Skill: Actualización de Documentación, Artículos Científicos y Papers

Este skill gobierna la sincronización continua entre los algoritmos implementados en el código fuente, el artículo científico en formato LaTeX (`/public/paper_calibracion_ela.tex`), el generador de PDF (`src/utils/pdfGenerator.ts`), el modal académico (`src/components/ScientificPaperModal.tsx`) y los manuales del proyecto.

---

## 1. Atribución Obligatoria de Autoría
Toda publicación, preimpresión académica, encabezado de artículo o exportación PDF debe acreditar formalmente como autor principal a:
* **Autor:** Alberto Arce Rodríguez
* **Filiación:** Laboratorio de Tecnología Asistencial, Neurocomputación y Ciencias de la Visión
* **Contacto:** alberto.arce.ti@gmail.com
* **Contexto:** Asistente Ocular 100% Sin Servidor para Pacientes con Esclerosis Lateral Amiotrófica (ELA).

---

## 2. Artefactos Auditados y Sincronizados
1. **Archivo Maestro LaTeX:** `/public/paper_calibracion_ela.tex`
   - Formato de 2 columnas estilo IEEE/ACM (`article`, `twocolumn`, 10pt).
   - Ecuaciones matemáticas rigurosas (Ridge regression, expansión de base polinomial, regularización de Tikhonov).
   - Tabla comparativa de métricas experimentales (RMSE, ángulo visual, alcance en bordes).
   - Bibliografía completa en formato APA 7ª edición con identificadores DOI activos.
2. **Generador Dinámico de PDF en el Cliente:** `src/utils/pdfGenerator.ts`
   - Utiliza `jsPDF` para renderizar el documento completo en el navegador del usuario.
   - Incluye encabezados, pie de página ("Página X"), abstract sombreado, tabla formateada y referencias.
   - Descarga directa con el nombre `articulo_calibracion_ela_alberto_arce.pdf`.
3. **Visor Académico Interactivo:** `src/components/ScientificPaperModal.tsx`
   - Pestaña de lectura académica formateada y pestaña de código fuente LaTeX.
   - Botón directo "Descargar PDF (Alberto Arce Rodríguez)".
   - Botón de copia al portapapeles y descarga de archivo `.tex`.
4. **Script de Auditoría y Verificación:** `scripts/update_docs.ts`
   - Ejecuta: `npm run update-docs` para validar que el autor Alberto Arce Rodríguez, las referencias APA 7 y las fórmulas coincidan en todos los archivos.

---

## 3. Guía de Referencias Bibliográficas APA (7ª Edición)
Cada referencia debe seguir el formato estándar:
- *Apellido, Inicial(es). (Año). Título del artículo. Nombre de la Revista, Volumen(Número), Páginas. https://doi.org/...*
- Citas clave incluidas: Beukelman et al. (2007), Blignaut (2014), Calvo et al. (2014), Casiez et al. (2012), Cerrolaza et al. (2012), Hansen & Ji (2010), Holmqvist et al. (2011), Kanning et al. (2010), Kübler & Birbaumer (2008), Lugaresi et al. (2019), Morimoto & Mimica (2005), Zhang et al. (2017).
