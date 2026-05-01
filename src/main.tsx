import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root');

if (container) {
  // Timeout guard: If React hasn't replaced the fallback in 2.5s, 
  // allow the user to see a retry option or stay in the fallback.
  const bootTimer = setTimeout(() => {
    const fallbackInfo = document.querySelector('#fallback-ui p');
    if (fallbackInfo) {
      fallbackInfo.innerHTML = "Taking longer than usual... <a href='#' onclick='window.location.reload()' style='color: #000; text-decoration: underline;'>Try Refreshing</a>";
    }
  }, 2500);

  try {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    clearTimeout(bootTimer);
  } catch (error) {
    console.error('Safe Boot Failure:', error);
    clearTimeout(bootTimer);
    
    // Explicitly show error recovery UI if root fails
    const errorUi = document.getElementById('error-ui');
    if (errorUi) {
      errorUi.style.display = 'flex';
      container.style.display = 'none';
    }
  }
}
