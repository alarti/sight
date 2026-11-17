/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Filter out benign TensorFlow Lite / WebAssembly diagnostic logs that Emscripten routes to stderr / console.error
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    const msg = typeof firstArg === 'string' ? firstArg : (firstArg && typeof firstArg.message === 'string' ? firstArg.message : '');
    if (
      msg.includes('Created TensorFlow Lite XNNPACK delegate for CPU') ||
      msg.includes('TensorFlow Lite XNNPACK delegate') ||
      msg.includes('XNNPACK delegate') ||
      msg.startsWith('INFO:')
    ) {
      console.info(...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);
