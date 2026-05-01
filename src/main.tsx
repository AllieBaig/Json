import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root');

if (container) {
  try {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    console.error('React Root Failure:', error);
    // Explicitly show error UI if root fails
    const errorUi = document.getElementById('error-ui');
    if (errorUi) {
      errorUi.style.display = 'flex';
      container.style.display = 'none';
    }
  }
}
