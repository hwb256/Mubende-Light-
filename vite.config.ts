import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Automatically generates dist/404.html from dist/index.html so deep links and unique URLs work on GitHub Pages
function githubPagesSpaPlugin(): Plugin {
  return {
    name: 'github-pages-spa',
    closeBundle() {
      const distDir = path.resolve(import.meta.dirname, 'dist');
      const indexPath = path.resolve(distDir, 'index.html');
      const notFoundPath = path.resolve(distDir, '404.html');
      if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, notFoundPath);
      }
    },
  };
}

export default defineConfig(() => {
  return {
    // Relative base allows the bundle to run on Netlify (root domain /) as well as GitHub Pages (/Mubende-Light-/)
    base: process.env.VITE_BASE_PATH || './',
    plugins: [react(), tailwindcss(), githubPagesSpaPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
