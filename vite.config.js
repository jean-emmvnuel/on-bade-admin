import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le dossier dist/ fonctionne servi depuis n'importe quel sous-dossier.
  base: './',
  // Dépendances pré-compilées et écrans préparés dès le démarrage : pas de rechargement à la première visite
  // (sinon les tests de bout en bout, lancés en parallèle, attendent la compilation).
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'gsap'] },
  server: { port: 5175, warmup: { clientFiles: ['./src/main.jsx', './src/App.jsx', './src/views/*.jsx'] } },
  preview: { port: 5175 },
  test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'], include: ['tests/**/*.test.{js,jsx}'], restoreMocks: true },
});
