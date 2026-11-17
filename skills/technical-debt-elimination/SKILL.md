---
name: technical-debt-elimination
description: Identifies, flags, and systematically eliminates dead code, unused imports, obsolete variables, redundant routines, and technical debt across passes.
---

# Technical Debt Elimination & Dead Code Pruning Skill

## Purpose
This skill guarantees that the codebase remains lean, maintainable, modular, and free of obsolete code, orphaned functions, redundant variables, dead imports, and architectural baggage on every turn.

## Core Rules & Lifecycle
1. **Unused Imports & Variable Pruning**:
   - Every file must only import symbols that are actively referenced.
   - Any unused React hooks, Lucide icons, or helper functions must be pruned immediately.
   - Remove dead state variables and refs that were superseded by refined algorithms.
2. **Obsolete Algorithm Deprecation**:
   - When an algorithm is upgraded (e.g. Shepard interpolation replaced by Bivariate Ridge Regression, or eye blinking replaced by Dwell Delay / Squint), legacy fallback paths that add confusion or bundle weight must be eliminated.
3. **Dead Code Elimination Runner**:
   - The project provides `scripts/clean_dead_code.ts` and the `npm run clean-code` script.
   - It performs automated static AST and regex scans across `src/` to identify unreferenced exports, empty blocks, commented-out dead code chunks, and duplicate symbols.
4. **Integration into Quality Pipeline**:
   - `npm run clean-code` is integrated into `npm run pipeline`, ensuring that every automated verification cycle passes through dead-code analysis and cleanup.
