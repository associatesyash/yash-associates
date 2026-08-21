import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => void registration.unregister());
    });
    caches.keys().then((keys) => keys.forEach((key) => void caches.delete(key)));
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
