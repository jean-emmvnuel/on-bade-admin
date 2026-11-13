import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/admin.css';

// Routeur par « # » (#/users/u1) : le back-office reste un simple dossier statique, sans réglage serveur.
createRoot(document.getElementById('app')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
