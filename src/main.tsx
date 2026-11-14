import { createRoot } from 'react-dom/client';
import { App } from './App';
import { t, uiLocale } from './i18n';
document.documentElement.lang = uiLocale;
document.title = t('extensionName');
createRoot(document.getElementById('root')!).render(<App />);
