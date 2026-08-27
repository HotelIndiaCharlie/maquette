import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Inter is self-hosted: no external request, so the app works offline and the
// "zero console errors" boot gate (SPEC.md §4.11) stays strict.
import '@fontsource-variable/inter';
import '@/styles/tokens.css';
import { App } from '@/shell/App';

const container = document.getElementById('root');
if (!container) throw new Error('#root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
