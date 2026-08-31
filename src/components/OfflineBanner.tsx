import { ConnectionBanner } from '@mister-guiiug/dev-wpa-config/react/connection-banner';
import { useI18n } from '../i18n';

/**
 * Bandeau « hors connexion », rendu par le socle
 * (`react/connection-banner`). Ce fichier ne garde que le câblage propre à
 * Carbook, comme `UpdateBanner` le fait pour le bandeau de mise à jour.
 *
 * POURQUOI CE BANDEAU EXISTE. Carbook n'a AUCUNE copie locale de ses données :
 * dossiers, candidats, critères, rappels, photos — tout part chez Supabase à
 * chaque lecture comme à chaque écriture. Hors connexion, l'application ne
 * fonctionne pas « en mode dégradé », elle ne fonctionne pas. La barre
 * supérieure porte bien un point vert/rouge depuis toujours, mais un point de
 * 8 px dans un coin ne se remarque pas : l'utilisateur voit des listes vides
 * et des erreurs, sans jamais faire le lien avec son réseau.
 *
 * POURQUOI LE LIBELLÉ EST PASSÉ. Le défaut du socle est un texte français en
 * dur (« Hors ligne — reconnexion… ») : il ne suit pas la locale, et il promet
 * une reconnexion automatique que Carbook n'assure pas. Le texte d'ici dit ce
 * qui est vrai — ni chargement, ni enregistrement, tant que le réseau manque.
 *
 * LA TEMPORISATION EST CELLE DU SOCLE (1,5 s hors ligne CONTINU). Une
 * micro-coupure, un basculement wifi/4G, un tunnel de métro : rien de tout
 * cela ne doit faire clignoter un bandeau. Le seuil n'est pas retouché ici
 * précisément pour que les douze apps de la famille aient le même.
 */
export function OfflineBanner() {
  const { t } = useI18n();

  return (
    <ConnectionBanner
      className="app-connection-banner"
      label={t('app.offlineBanner')}
    />
  );
}
