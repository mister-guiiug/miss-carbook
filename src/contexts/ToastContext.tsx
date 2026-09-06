import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import {
  ToastProvider as DwcToastProvider,
  useToast as useDwcToast,
} from '@mister-guiiug/dev-pwa-config/react/toast';

/**
 * Pont vers le composant partagé Toast (`react/toast` de dev-pwa-config).
 *
 * L'API `showToast(message)` est conservée : dix-sept écrans l'appellent.
 * Le rendu, la file (bornée à 4, le plus ancien cède), la durée (5 s),
 * la suspension au survol/focus et l'accessibilité (régions vivantes
 * permanentes, bouton de fermeture nommé) viennent du socle — qui documente
 * justement l'ancienne copie locale comme l'un de ses modèles corrigés
 * (un seul message à la fois : le suivant écrasait le précédent).
 */
/**
 * Un bouton dans la notification — « Annuler » après une suppression.
 *
 * POURQUOI C'EST ÉCRIT ICI. Le `toast` du socle 4.4.1 ne porte PAS d'action :
 * `ToastApi.show(message, { tone, duration, id })`, rien d'autre. Sa feuille
 * `components.css` habille pourtant déjà `[data-dwc='toast-action']` en
 * prévision — c'est cette classe qu'on réutilise, pour que le bouton ait
 * l'allure de la famille sans une ligne de CSS de plus.
 *
 * La forme retenue est CELLE QUE LE SOCLE PRÉPARE (`ToastAction { label?,
 * onAction }` dans `ToastOptions.action`) : le jour où la version qui la
 * publie arrive, ce pont devient un passe-plat, et aucun des dix-sept écrans
 * appelants ne bouge.
 */
export type ToastAction = {
  /** Par défaut « Annuler ». */
  label?: string;
  onAction: () => void;
};

export type ShowToastOptions = {
  /** Millisecondes avant effacement. Par défaut 8 000 avec une action, celle du socle sinon. */
  duration?: number;
  action?: ToastAction | null;
};

/**
 * Huit secondes : le temps de lire « Supprimé », de comprendre qu'on ne le
 * voulait pas, et d'atteindre le bouton — y compris au pouce sur un téléphone.
 * Cinq (la durée par défaut du socle) suffisent à lire, pas à se raviser.
 */
export const TOAST_UNDO_MS = 8000;

type ToastContextValue = {
  showToast: (message: string, options?: ShowToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook + provider
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans ToastProvider');
  return ctx;
}

function ToastBridge({ children }: { children: ReactNode }) {
  const toast = useDwcToast();

  const showToast = useCallback(
    (message: string, options?: ShowToastOptions) => {
      const action = options?.action;
      if (!action || typeof action.onAction !== 'function') {
        toast.show(message, { duration: options?.duration });
        return;
      }

      // Le socle installé ne rend que `message` : on y glisse donc le bouton.
      // `id` est renseigné par le `show` qui suit, avant le premier clic
      // possible — le bouton n'existe pas encore quand la ligne s'exécute.
      let id: string | null = null;
      const label = action.label ?? 'Annuler';
      id = toast.show(
        <>
          {message}{' '}
          <button
            type="button"
            data-dwc="toast-action"
            onClick={() => {
              action.onAction();
              if (id) toast.dismiss(id);
            }}
          >
            {label}
          </button>
        </>,
        { duration: options?.duration ?? TOAST_UNDO_MS }
      );
    },
    [toast]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <DwcToastProvider>
      <ToastBridge>{children}</ToastBridge>
    </DwcToastProvider>
  );
}
