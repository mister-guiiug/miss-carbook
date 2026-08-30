import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmDialog } from '@mister-guiiug/dev-wpa-config/react/confirm-dialog';
import { explainUnknownError } from '../lib/errorReporting';
import { useI18n } from '../i18n';
import {
  IconActionButton,
  IconCheck,
  IconChevronRight,
  IconChevronUp,
  IconCopy,
} from '../components/ui/IconActionButton';

type ErrorPayload = {
  userMessage: string;
  technical: string;
};

type ErrorDialogContextValue = {
  reportException: (err: unknown, context?: string) => void;
  /** Erreur métier ou de validation : message clair + détail optionnel pour le copier-coller. */
  reportMessage: (userMessage: string, technical?: string) => void;
  dismiss: () => void;
};

const ErrorDialogContext = createContext<ErrorDialogContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components -- hook utilisé avec ErrorDialogProvider
export function useErrorDialog() {
  const ctx = useContext(ErrorDialogContext);
  if (!ctx) {
    throw new Error(
      'useErrorDialog doit être utilisé dans ErrorDialogProvider'
    );
  }
  return ctx;
}

/**
 * Boîte d'erreur de l'application, rendue par le `ConfirmDialog` du socle en
 * MODE MONO-ACTION (`cancelLabel={null}` — et non `undefined`, qui garderait le
 * repli « Annuler »).
 *
 * Cette boîte est l'une des trois que la campagne `components.css` n'avait pas
 * pu migrer : le composant partagé rendait alors deux boutons, et une alerte
 * n'a rien à annuler. La 3.23.0 du socle lève exactement ce blocage. Le rôle
 * `alertdialog` est conservé, le focus initial va sur l'action unique, et Échap
 * comme le clic sur le voile valent « OK » — ils passent par `onConfirm`, donc
 * par `dismiss`. Piège de focus, restitution du focus et verrou de scroll
 * viennent du socle : c'est ce que la copie locale n'avait pas.
 *
 * CE QUI RESTE APPLICATIF, et pourquoi : les détails techniques dépliables et
 * le bouton « copier » n'existent que chez nous — le socle ne les embarque pas
 * et le dit. Ils passent donc en `children`, la voie qu'il prévoit. Attention,
 * `children` REMPLACE `message` côté socle (`children ?? message`) : le message
 * utilisateur est rendu ici, dans le même bloc.
 *
 * L'API du contexte est inchangée : aucun écran n'est touché.
 */
export function ErrorDialogProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<ErrorPayload | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();

  const dismiss = useCallback(() => {
    setPayload(null);
    setDetailsOpen(false);
    setCopied(false);
  }, []);

  const reportException = useCallback((err: unknown, context?: string) => {
    const { userMessage, technical } = explainUnknownError(err, context);
    setPayload({ userMessage, technical });
    setDetailsOpen(false);
    setCopied(false);
  }, []);

  const reportMessage = useCallback(
    (userMessage: string, technical?: string) => {
      setPayload({
        userMessage,
        technical: technical ?? userMessage,
      });
      setDetailsOpen(false);
      setCopied(false);
    },
    []
  );

  const value = useMemo(
    () => ({ reportException, reportMessage, dismiss }),
    [reportException, reportMessage, dismiss]
  );

  const copyTechnical = useCallback(async () => {
    if (!payload?.technical) return;
    try {
      await navigator.clipboard.writeText(payload.technical);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [payload?.technical]);

  return (
    <ErrorDialogContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!payload}
        title={t('dialog.title')}
        cancelLabel={null}
        onConfirm={dismiss}
      >
        {payload ? (
          <>
            <p className="error-dialog-message">{payload.userMessage}</p>

            <div className="error-dialog-details">
              <IconActionButton
                variant="secondary"
                className="error-dialog-details-toggle"
                label={
                  detailsOpen
                    ? t('dialog.hideDetails')
                    : t('dialog.showDetails')
                }
                onClick={() => setDetailsOpen(o => !o)}
                aria-expanded={detailsOpen}
              >
                {detailsOpen ? <IconChevronUp /> : <IconChevronRight />}
              </IconActionButton>
              {detailsOpen ? (
                <div className="error-dialog-technical-wrap">
                  <pre className="error-dialog-technical" tabIndex={0}>
                    {payload.technical}
                  </pre>
                  <IconActionButton
                    variant="primary"
                    label={
                      copied ? t('dialog.copied') : t('dialog.copyDetails')
                    }
                    onClick={() => void copyTechnical()}
                  >
                    {copied ? <IconCheck /> : <IconCopy />}
                  </IconActionButton>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </ConfirmDialog>
    </ErrorDialogContext.Provider>
  );
}
