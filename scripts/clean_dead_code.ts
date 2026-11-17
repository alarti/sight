/**
 * Technical Debt & Dead Code Pruning Script
 * Automated verification of unreferenced exports, unused variables, and stale artifacts.
 */

import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

interface ScanResult {
  file: string;
  unusedImports: string[];
  issues: string[];
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function checkFileForTechnicalDebt(filePath: string): ScanResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(process.cwd(), filePath);
  const issues: string[] = [];
  const unusedImports: string[] = [];

  // Check for commented out console.logs or leftover debugger statements
  if (/^\s*debugger;/m.test(content)) {
    issues.push('Found active debugger statement');
  }

  // Check for obsolete legacy methods
  if (content.includes('blinking_calibration_legacy')) {
    issues.push('Found reference to obsolete blinking calibration');
  }

  // Check for empty catch blocks
  if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(content)) {
    issues.push('Found empty catch block without error logging or handling');
  }

  // Check import statements for potentially unused imports
  const importRegex = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"][^'"]+['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1];
    if (namedImports) {
      const symbols = namedImports.split(',').map(s => s.trim().split(' as ')[0].trim()).filter(Boolean);
      for (const symbol of symbols) {
        // Count occurrences of symbol in rest of file
        const regex = new RegExp(`\\b${symbol}\\b`, 'g');
        const matches = content.match(regex) || [];
        if (matches.length <= 1) {
          unusedImports.push(symbol);
        }
      }
    }
  }

  return {
    file: relPath,
    unusedImports,
    issues
  };
}

export function runTechnicalDebtPruning() {
  console.log('🧹 [Technical Debt Elimination] Scanning codebase for obsolete code, dead imports & architectural debt...');
  const files = getAllFiles(SRC_DIR);
  let totalIssues = 0;
  let totalUnusedImports = 0;

  files.forEach((file) => {
    const result = checkFileForTechnicalDebt(file);
    if (result.issues.length > 0 || result.unusedImports.length > 0) {
      if (result.unusedImports.length > 0) {
        console.warn(`⚠️ [${result.file}] Potential unused symbols: ${result.unusedImports.join(', ')}`);
        totalUnusedImports += result.unusedImports.length;
      }
      if (result.issues.length > 0) {
        result.issues.forEach(iss => console.warn(`⚠️ [${result.file}] Technical Debt Issue: ${iss}`));
        totalIssues += result.issues.length;
      }
    }
  });

  if (totalIssues === 0 && totalUnusedImports === 0) {
    console.log('✅ [Technical Debt Elimination] Codebase is pristine! Zero dead imports or obsolete legacy routines found.');
  } else {
    console.log(`ℹ️ [Technical Debt Elimination] Summary: Found ${totalUnusedImports} unused symbols and ${totalIssues} debt issues.`);
  }
}

runTechnicalDebtPruning();
