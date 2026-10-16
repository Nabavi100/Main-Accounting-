import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '@fontsource-variable/vazirmatn';
import './index.css';
import './styles/workspace.css';
import './styles/trade-invoices.css';
import './styles/appearance.css';
import './styles/treasury.css';
import './styles/consignment.css';
import './styles/page-actions.css';
import './styles/workspace-search.css';
import './styles/calm-actions.css';
import './styles/trade-center.css';
import './styles/compact-centers.css';
import './styles/header-utilities.css';
import './styles/currency-calculator.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
