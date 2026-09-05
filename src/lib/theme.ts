/**
 * Réglage du thème : ce qu'il reste de local après l'adoption du socle.
 *
 * L'état, la persistance, l'écoute du thème système et l'écriture de
 * `data-theme` sont désormais assurés par `ThemeProvider` /  `useTheme`
 * (`@mister-guiiug/dev-pwa-config/react/theme-provider`). Ne subsiste ici que
 * la donnée que le socle ne peut pas deviner : l'ANCIENNE CLÉ de stockage.
 *
 * POURQUOI ELLE COMPTE. Le socle stocke sous `dwc_theme` ; miss-carbook
 * stockait sous `mc-theme`. Adopter le hook sans reprendre l'ancienne clé
 * orpheline la préférence de chaque utilisateur déjà installé : au premier
 * chargement l'app « oublie » son thème sombre, une seule fois, sans erreur ni
 * trace. `legacyKeys` la relit puis la réécrit sous la clé neuve.
 *
 * Le même tableau est passé deux fois : au script anti-FOUC (option
 * `themeBoot` de `pwaSeoPlugin`, dans `vite.config.ts`, qui ne peut pas
 * importer ce module) et à `ThemeProvider` (`main.tsx`). Les deux doivent
 * rester alignés, sinon le script pose un thème que React repeint aussitôt.
 */
export const THEME_LEGACY_KEYS: string[] = ['mc-theme'];
