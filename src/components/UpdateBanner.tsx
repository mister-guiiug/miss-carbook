import { registerSW } from 'virtual:pwa-register';
import { UpdatePromptBanner } from '@mister-guiiug/dev-pwa-config/react/update-prompt-banner';

/**
 * Bandeau « mise à jour disponible », rendu par le socle
 * (`react/update-prompt-banner`). Ce fichier ne garde que le câblage propre à
 * Carbook : `registerSW`, et rien d'autre.
 *
 * POURQUOI `registerSW` EST PASSÉ ICI. Le bandeau du socle n'importe pas
 * `virtual:pwa-register` — ce module virtuel n'existe que dans un build Vite
 * avec vite-plugin-pwa. Sans cette prop, `needRefresh` reste faux et le bandeau
 * ne s'affiche JAMAIS, sans erreur ni test rouge. C'est le seul point de
 * câblage qui compte, et `UpdateBanner.test.tsx` le verrouille.
 *
 * CE QUI CHANGE POUR L'UTILISATEUR. La copie locale n'offrait aucune sortie :
 * le bandeau restait posé en bas de l'écran jusqu'au rechargement. Le socle
 * pose toujours un second bouton — ici « Plus tard », qui masque le bandeau
 * pour la session (`snoozeHours={0}` ⇒ écartement simple, sans
 * persistance).
 *
 * PLUS AUCUN LIBELLÉ N'EST CÂBLÉ. `I18nProvider` monte lui-même le
 * `LabelsProvider` du socle avec la locale courante : titre, appel à l'action,
 * « Mise à jour… » et « Plus tard » viennent donc tous du même endroit et
 * suivent fr/en ensemble. Le titre et le bouton étaient repris du dictionnaire
 * Carbook « dont la formulation diffère de celle du socle » — c'était vrai, et
 * c'était le problème : relevé du 18/09/2026, onze applications du parc
 * annonçaient une mise à jour de neuf façons, avec trois verbes d'action.
 */
export function UpdateBanner() {
  return (
    <UpdatePromptBanner
      snoozeHours={0}
      checkEvery="1h"
      registerSW={registerSW}
    />
  );
}
