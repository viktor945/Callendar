import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './features/intimacy/catalog.css';
import './phone.css';
import { staticPreview } from './lib/api';
import { registerWorker } from './lib/pwa';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
if (!staticPreview && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => { void registerWorker().catch(() => { /* The calendar remains usable without installation. */ }); }, { once: true });
}
