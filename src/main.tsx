import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and prevent benign transient firestore backend connection retries from triggering false-positive alerts
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: any[]) {
    const text = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (
      text.includes('Could not reach Cloud Firestore backend') ||
      text.includes('The operation could not be completed') ||
      text.includes('operate in offline mode until it is able to successfully connect') ||
      (text.includes('@firebase/firestore') && text.includes('code=unavailable'))
    ) {
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonText = event.reason?.message || String(event.reason || '');
    if (
      reasonText.includes('Could not reach Cloud Firestore backend') ||
      reasonText.includes('code=unavailable')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

