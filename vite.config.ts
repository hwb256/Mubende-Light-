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

export default defineConfig(({ command }) => {
  return {
    // In dev mode (serve), base must be '/' for local module resolution.
    // In build mode, relative base allows running on Netlify (/) or GitHub Pages (/Mubende-Light-/)
    base: command === 'serve' ? '/' : (process.env.VITE_BASE_PATH || './'),
    plugins: [react(), tailwindcss(), githubPagesSpaPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
            port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
