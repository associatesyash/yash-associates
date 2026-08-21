import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((registration) => {
      void registration.update();
    }).catch(() => undefined);
  });
}

function removeNetlifyBadge(node: ParentNode = document) {
  node.querySelectorAll('[id*="netlify"], [class*="netlify"], iframe[title*="Netlify"]').forEach((element) => element.remove());
}

removeNetlifyBadge();
new MutationObserver(() => removeNetlifyBadge()).observe(document.documentElement, { childList: true, subtree: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
