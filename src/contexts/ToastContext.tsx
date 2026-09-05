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
type ToastContextValue = {
  showToast: (message: string) => void;
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
    (message: string) => {
      toast.show(message);
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
