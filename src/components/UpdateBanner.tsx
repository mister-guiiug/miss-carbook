import { registerSW } from 'virtual:pwa-register';
import { UpdatePromptBanner } from '@mister-guiiug/dev-wpa-config/react/update-prompt-banner';
import { useI18n } from '../i18n';

/**
 * Bandeau « nouvelle version disponible », rendu par le socle
 * (`react/update-prompt-banner`). Ce fichier ne garde que le câblage propre à
 * Carbook : `registerSW` et les deux libellés qui portent le ton de l'app.
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
 * pour la session (`snoozeHours` non fourni ⇒ écartement simple, sans
 * persistance).
 *
 * LES AUTRES LIBELLÉS NE SONT PAS CÂBLÉS : `I18nProvider` monte lui-même le
 * `LabelsProvider` du socle avec la locale courante, donc « Mise à jour… » et
 * « Plus tard » suivent déjà fr/en. Seuls le titre et l'appel à l'action sont
 * repris du dictionnaire Carbook, dont la formulation diffère de celle du
 * socle.
 */
export function UpdateBanner() {
  const { t } = useI18n();

  return (
    <UpdatePromptBanner
      registerSW={registerSW}
      title={t('app.updateAvailable')}
      updateLabel={t('common.update')}
    />
  );
}
