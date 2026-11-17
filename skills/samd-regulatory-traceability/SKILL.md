---
name: samd-regulatory-traceability
description: >
  Maintains Software as a Medical Device (SaMD) regulatory compliance traceability (EU MDR 2017/745 Class I,
  IEC 62304, ISO 14971 Risk Management, and HL7 FHIR R4 clinical biomarker interoperability).
---

# Skill: Trazabilidad Regulatoria de Producto Sanitario por Software (SaMD — IEC 62304 / HL7 FHIR)

Asegura que **SIGHT** mantenga la documentación técnica, controles de mitigación de riesgos clínicos y exportación interoperable exigidos para su comercialización hospitalaria y reembolso sanitario.

---

## 1. Controles de Conformidad SaMD
1. **Interoperabilidad Hospitalaria HL7 FHIR R4 (`src/components/ClinicalCommercialModal.tsx`):**
   - Exportación de observaciones clínicas (`ResourceType: Bundle / Observation`, código LOINC `80318-9`) con métricas objetivas de RMSE, precisión angular, velocidad sacádica, índice de fatiga ocular y $F_0$ vocal.
2. **Gestión de Riesgos Clínicos ISO 14971:**
   - Mitigación contra bloqueo de pantalla en silla de ruedas (`WakeLock`).
   - Mitigación contra pérdida de red (`Service Worker` + motor vocal local `ML-LPC16`).
   - Mitigación contra urgencia respiratoria/dolor (`playEmergencySosSiren` + botón SOS directo).
