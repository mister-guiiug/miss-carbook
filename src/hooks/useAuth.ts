import type { Session, User } from '@supabase/supabase-js';
import { useAuthContext } from '@mister-guiiug/dev-pwa-config/react/auth-provider';

/**
 * La session, lue dans le fournisseur du socle (`AuthProvider`, monté dans
 * `App.tsx` autour de la porte d'entrée).
 *
 * CE FICHIER TENAIT LE CÂBLAGE LUI-MÊME — `getSession()` puis
 * `onAuthStateChange`, un drapeau de montage contre la réponse périmée — et
 * chaque écran qui l'appelait ouvrait SON abonnement : cinq écrans, cinq
 * `getSession()` au démarrage. Le socle a promu ce câblage en 3.33.0, à partir
 * de cette copie entre autres (`auth/index`) : un seul client, une hydratation
 * numérotée qui ferme la course, et une lecture de session qui n'attend pas le
 * réseau hors ligne (`auth/supabase`). Il ne reste ici que la forme que les
 * écrans connaissent : `{ session, user, loading }`.
 */
export function useAuth() {
  const { session, user, ready } = useAuthContext<Session, User>();
  return { session, user, loading: !ready };
}
