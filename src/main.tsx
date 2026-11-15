import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/nunito';
import '@fontsource-variable/lexend';
import '@fontsource-variable/lora';
import '@fontsource/comic-neue/400.css';
import '@fontsource/comic-neue/700.css';
import './styles.css';
import { applyCachedAppearance } from './lib/appearance';

applyCachedAppearance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
