
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

// The 'process' polyfill is now handled in index.html to ensure it's available 
// immediately upon file load.

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
