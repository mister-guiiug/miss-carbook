import { useCallback, useState, useTransition, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * CE QUE CE MODULE CORRIGE : un clic de menu sans aucun effet visible.
 *
 * À la première visite, cliquer sur une destination ne produit rien pendant que
 * le morceau `React.lazy` de la page fait son aller-retour réseau. Mesuré à
 * froid le 20/09/2026 sur deux sites publiés du parc, service worker pas encore
 * installé : 133 ms d'écran figé sur mister-settle, 161 ms sur mister-molkky,
 * `aria-busy` faux d'un bout à l'autre.
 *
 * LA CAUSE N'EST PAS UNE LENTEUR ANORMALE. react-router 7 enveloppe tout
 * changement d'URL dans `startTransition` — littéralement, dans son
 * `BrowserRouter` — et React 19 garde alors délibérément l'écran déjà affiché
 * plutôt que de le remplacer par le repli de `<Suspense>`. Ce repli (le
 * `RouteFallback` d'`App`) est donc du CODE MORT AU CLIC : il ne paraît que sur
 * un atterrissage direct sur l'URL.
 *
 * Ce qui marche : piloter la navigation dans SA PROPRE transition, ce que
 * react-router n'expose pas hors d'un routeur de données (`useNavigation()` est
 * réservé aux `RouterProvider`). `enCours` reste alors vrai tant que le morceau
 * n'est pas arrivé.
 */
export function useTransitionDeMenu() {
  const navigate = useNavigate();
  const [enCours, demarreLaTransition] = useTransition();
  const [ciblePendante, setCiblePendante] = useState<string | null>(null);

  const versLaVue = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, to: string) => {
      // On laisse le navigateur faire son travail quand le visiteur le lui
      // demande : nouvel onglet, nouvelle fenêtre, enregistrement de la cible.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      e.preventDefault();
      setCiblePendante(to);
      demarreLaTransition(() => navigate(to));
    },
    [navigate]
  );

  /** Les props à poser sur un lien pour qu'il se dise occupé au bon moment. */
  const lien = useCallback(
    (to: string) => ({
      onClick: (e: MouseEvent<HTMLAnchorElement>) => versLaVue(e, to),
      'aria-busy': (enCours && ciblePendante === to) || undefined,
    }),
    [enCours, ciblePendante, versLaVue]
  );

  return {
    enCours,
    /** La destination qui charge, ou `null` : de quoi habiller UN lien. */
    enAttente: enCours ? ciblePendante : null,
    versLaVue,
    lien,
  };
}
