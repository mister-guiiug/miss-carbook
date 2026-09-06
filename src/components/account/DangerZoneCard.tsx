import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '@mister-guiiug/dev-pwa-config/react/confirm-dialog';
import { useActionGuard } from '@mister-guiiug/dev-pwa-config/react/use-action-guard';
import { useErrorDialog } from '../../contexts/ErrorDialogContext';
import { useI18n } from '../../i18n';
import { getSupabase } from '../../lib/supabase';

/**
 * Supprimer son compte, depuis l'application (RGPD, art. 17).
 *
 * POURQUOI DEUX VERROUS ET NON UN. Le geste est définitif et se joue sur un
 * dossier PARTAGÉ : une confirmation à un clic serait à un clic de trop. Il
 * faut donc RECOPIER un mot — la seule barrière qu'un clic malheureux, un
 * lecteur d'écran mal placé ou un enfant sur le téléphone ne franchit pas par
 * accident —, puis confirmer dans la boîte du socle. Rien n'est préchargé dans
 * le champ, et il se vide à chaque annulation : on ne peut pas « reprendre là
 * où on en était ».
 *
 * CE QUE LA CARTE DOIT DIRE AVANT QU'ON CLIQUE. Ce qui part, ce qui reste, et
 * surtout ce qu'il advient des dossiers partagés — la règle du dernier
 * administrateur, écrite dans
 * `supabase/migrations/20260906120000_delete_my_account.sql`. Un utilisateur
 * qui découvrirait APRÈS coup que son dossier a changé de main aurait été
 * trompé, même si le résultat est le bon.
 *
 * LE TRAVAIL EST FAIT PAR LE SERVEUR. `delete_my_account()` est une fonction
 * `security definer` : le rôle `authenticated` n'a aucun droit sur
 * `auth.users`, et la transmission des dossiers doit être ATOMIQUE avec la
 * suppression — une moitié de règle jouée depuis le navigateur laisserait des
 * dossiers sans administrateur.
 */
export function DangerZoneCard() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { reportException } = useErrorDialog();
  const [typed, setTyped] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // Une suppression à mi-chemin (dossiers transmis, compte encore là) serait
  // le pire des états : autant refuser tant que le réseau n'est pas là.
  const guard = useActionGuard({ online: true });

  const word = t('account.dangerWord');
  const matches = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();

  const runDelete = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await getSupabase().rpc('delete_my_account');
      if (error) throw error;
      // Le compte n'existe plus : la session en cours ne vaut plus rien, mais
      // son jeton d'accès reste valide jusqu'à son expiration. On la ferme
      // nous-mêmes plutôt que de laisser une coquille se cogner à des 401.
      await getSupabase().auth.signOut();
      navigate('/', { replace: true });
    } catch (e: unknown) {
      reportException(e, t('account.ctxAccountDelete'));
      setBusy(false);
      setConfirming(false);
    }
  }, [busy, navigate, reportException, t]);

  return (
    <section
      className="card stack settings-card"
      aria-labelledby="settings-danger-heading"
      data-destructive
    >
      <h2 id="settings-danger-heading">{t('account.dangerTitle')}</h2>
      <p className="muted settings-hint">{t('account.dangerLead')}</p>
      <ul className="muted settings-hint">
        <li>{t('account.dangerBulletMine')}</li>
        <li>{t('account.dangerBulletShared')}</li>
        <li>{t('account.dangerBulletAlone')}</li>
        <li>{t('account.dangerBulletLog')}</li>
      </ul>

      <div>
        <label htmlFor="settings-danger-word">
          {t('account.dangerTypeLabel', { word })}
        </label>
        <input
          id="settings-danger-word"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {guard.reason ? (
        <p role="status" className="muted settings-hint">
          {guard.reason}
        </p>
      ) : null}

      <div className="settings-actions-row">
        <button
          type="button"
          className="danger"
          disabled={!matches || busy}
          {...guard.disabledProps}
          onClick={guard.wrap(() => setConfirming(true))}
        >
          {t('account.dangerButton')}
        </button>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t('account.dangerConfirmTitle')}
        destructive
        loading={busy}
        confirmLabel={
          busy ? t('account.dangerBusy') : t('account.dangerConfirmLabel')
        }
        cancelLabel={t('common.cancel')}
        onConfirm={() => void runDelete()}
        onCancel={() => {
          if (busy) return;
          setConfirming(false);
          // Le mot recopié ne survit pas à une annulation : se raviser doit
          // coûter le même geste que la première fois.
          setTyped('');
        }}
      >
        <p style={{ margin: 0 }}>{t('account.dangerConfirmBody')}</p>
      </ConfirmDialog>
    </section>
  );
}
