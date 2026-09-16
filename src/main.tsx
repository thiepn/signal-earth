import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/styles/tokens.css';
import './ui/styles/global.css';
import './ui/styles/phase19.css';
import './ui/styles/intelligence.css';
import './ui/styles/orbit2.css';
import './ui/styles/phase23.css';
import './ui/styles/phase24.css';
import './ui/styles/phase26.css';
import { registerSignalEarthServiceWorker } from './core/release/serviceWorker';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Signal Earth root element was not found.');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


void registerSignalEarthServiceWorker();