import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

import Toaster from './components/Toaster';
import AppRoutes from './routes';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
    </BrowserRouter>
  </StrictMode>,
);
