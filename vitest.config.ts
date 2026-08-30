import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { baseTestOptions } from '@mister-guiiug/dev-wpa-config/vitest-base';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent
      // d'ici : sans ce double, tout test qui monte le bandeau de mise à jour
      // échoue à la résolution, avant d'avoir rien éprouvé. Le `vi.mock` du
      // setup partagé ne suffit pas — il agit à l'exécution, quand Vite a déjà
      // refusé de transformer l'importateur.
      'virtual:pwa-register': fileURLToPath(
        new URL('./src/test/pwa-register-stub.ts', import.meta.url)
      ),
    },
  },
  test: baseTestOptions,
});
