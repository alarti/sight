---
name: translation
description: Guidelines for implementing client-side internationalization (i18n), bilingual UI support (Spanish/English), dictionary structured keys, and localized speech synthesis.
---

# Translation & Internationalization (i18n) Skill

Use this skill when implementing multi-language support, managing translation dictionaries, or translating scientific research papers and UI components between Spanish and English.

## Key Architectural Principles
1. **Centralized Dictionaries**: All UI labels, modals, headings, and messages must reside in strongly typed dictionaries (e.g., `src/i18n/translations.ts`).
2. **Language State Persistence**: User language preference (`es` or `en`) must be stored within the `UserProfile` object in `localStorage` and synchronized across all modals and components.
3. **Dynamic Speech Synthesis**: Speech synthesis (`window.speechSynthesis`) must dynamically adapt its utterance language (`en-US` or `es-ES`) based on the active profile language.
4. **Bilingual Scientific Papers**: Scientific documentation and LaTeX preprints must be made available in both Spanish (`public/paper_calibracion_ela.tex`) and English (`public/paper_calibracion_ela_en.tex`) with complete APA 7th edition references.
