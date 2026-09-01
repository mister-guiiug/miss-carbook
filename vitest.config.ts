import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import {
  baseTestOptions,
  pwaRegisterAlias,
} from '@mister-guiiug/dev-wpa-config/vitest-base';

export default defineConfig({
  plugins: [react()],
  // `virtual:pwa-register` n'est fourni que par vite-plugin-pwa, absent d'ici :
  // sans ce double, tout test qui monte le bandeau de mise à jour échoue à la
  // résolution, avant d'avoir rien éprouvé. Un `vi.mock` n'y suffirait pas —
  // il agit à l'exécution, quand Vite a déjà refusé de transformer
  // l'importateur. Le double du socle est PILOTABLE (`swStub.needRefresh()`),
  // là où la copie locale était muette.
  resolve: { alias: { ...pwaRegisterAlias } },
  test: baseTestOptions,
});
