
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

/**
 * World-Class Frontend Safety Layer
 * Browsers do not have a 'process' object. This polyfill prevents a 
 * hard crash (blank screen) on static hosting like GitHub Pages.
 */
if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {
      API_KEY: '' // Default to empty string to avoid ReferenceErrors
    }
  };
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
