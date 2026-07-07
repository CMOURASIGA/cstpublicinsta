import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { UiFeedbackProvider } from './context/UiFeedbackContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiFeedbackProvider>
      <App />
    </UiFeedbackProvider>
  </StrictMode>,
);
