import { useEffect, useMemo, useState } from 'react';
import { useUpdatePrompt } from '../hooks/useUpdatePrompt';
import { Link, useNavigate } from 'react-router-dom';
import { getSupabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { authEmailRedirectUrl } from '../lib/authRedirect';
import {
  formatAuthCredentialError,
  formatAuthEmailSendError,
} from '../lib/authEmailErrors';
import { notifyProfileUpdated } from '../lib/profileEvents';
import { formatProfileSaveError } from '../lib/profileErrors';
import { resetAllAssistantFlags } from '../lib/assistantStorage';
import {
  changeEmailSchema,
  displayNameRules,
  displayNameSchema,
} from '../lib/validation/schemas';
import { useErrorDialog } from '../contexts/ErrorDialogContext';
import { useToast } from '../contexts/ToastContext';
import { FamilyApps } from '@mister-guiiug/dev-wpa-config/react';
import { useI18n } from '../i18n';
import type { ThemeMode } from '../lib/theme';

export function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { mode, setMode } = useTheme();
  const { needRefresh, reloadToLatest } = useUpdatePrompt();
  const { reportException, reportMessage } = useErrorDialog();
  const { showToast } = useToast();
  const { t, locale, setLocale, locales } = useI18n();
  const [reloadBusy, setReloadBusy] = useState(false);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [pseudoDraft, setPseudoDraft] = useState('');
  const [pseudoBusy, setPseudoBusy] = useState(false);

  const [emailDraft, setEmailDraft] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    variant: 'info' | 'error';
    text: string;
  } | null>(null);

  const [busyMagic, setBusyMagic] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getSupabase()
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const n = data?.display_name ?? null;
        setDisplayName(n);
        setPseudoDraft(n?.trim() ?? '');
      });
  }, [user]);

  useEffect(() => {
    setEmailDraft(user?.email ?? '');
  }, [user?.email]);

  const pseudoDirty = useMemo(() => {
    return pseudoDraft.trim() !== (displayName?.trim() ?? '');
  }, [pseudoDraft, displayName]);

  const emailUnchanged = useMemo(() => {
    const cur = (user?.email ?? '').trim();
    return (emailDraft.trim() || '') === cur;
  }, [emailDraft, user?.email]);

  const savePseudo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = displayNameSchema.safeParse(pseudoDraft);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ?? t('account.errPseudoInvalid');
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2));
      return;
    }
    setPseudoBusy(true);
    try {
      const { error } = await getSupabase().from('profiles').upsert({
        id: user.id,
        display_name: parsed.data,
      });
      if (error) throw error;
      setDisplayName(parsed.data);
      notifyProfileUpdated();
      showToast(t('account.toastPseudoSaved'));
    } catch (err: unknown) {
      reportMessage(formatProfileSaveError(err), String(err));
    } finally {
      setPseudoBusy(false);
    }
  };

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setEmailFeedback(null);
    const parsed = changeEmailSchema.safeParse({ email: emailDraft });
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ?? t('account.errEmailInvalid');
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2));
      return;
    }
    const next = parsed.data.email;
    if (next === user.email) {
      setEmailFeedback({
        variant: 'info',
        text: t('account.emailAlready'),
      });
      return;
    }
    setEmailBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser(
        { email: next },
        { emailRedirectTo: authEmailRedirectUrl() }
      );
      if (error) throw error;
      setEmailFeedback({
        variant: 'info',
        text: t('account.emailConfirmSent'),
      });
      showToast(t('account.toastEmailRequested'));
    } catch (err: unknown) {
      const friendly =
        formatAuthCredentialError(err) ?? formatAuthEmailSendError(err);
      if (friendly) {
        setEmailFeedback({ variant: 'error', text: friendly });
      } else {
        reportException(err, t('account.ctxEmailChange'));
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const resendMagicLink = async () => {
    if (!user?.email) return;
    setEmailFeedback(null);
    setBusyMagic(true);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: user.email,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      });
      if (error) throw error;
      setEmailFeedback({
        variant: 'info',
        text: t('account.magicResent'),
      });
      showToast(t('account.toastMagicSent'));
    } catch (err: unknown) {
      const friendly = formatAuthEmailSendError(err);
      if (friendly) {
        setEmailFeedback({ variant: 'error', text: friendly });
      } else {
        reportException(err, t('account.ctxMagicResend'));
      }
    } finally {
      setBusyMagic(false);
    }
  };

  const applyTheme = (next: ThemeMode) => {
    setMode(next);
  };

  const onReloadLatest = () => {
    setReloadBusy(true);
    void reloadToLatest();
  };

  if (!user) {
    return (
      <div className="shell">
        <p className="muted">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="shell settings-page">
      <nav className="settings-back" aria-label={t('account.navAria')}>
        <Link to="/">← {t('account.backHome')}</Link>
      </nav>

      <header className="account-settings-header">
        <span className="settings-scope-badge settings-scope-badge--global">
          {t('account.scopeGlobal')}
        </span>
        <h1>{t('account.title')}</h1>
        <p className="muted settings-lead">
          {t('account.leadBefore')}
          <strong>{t('account.leadSettingsTab')}</strong>
          {t('account.leadAfter')}
        </p>
      </header>

      <div className="settings-page-stack">
        <section
          className="card stack settings-card"
          aria-labelledby="settings-account-heading"
        >
          <h2 id="settings-account-heading">{t('account.sectionAccount')}</h2>

          <div className="settings-subsection">
            <h3
              className="settings-subsection-title"
              id="settings-pseudo-title"
            >
              {t('account.pseudoTitle')}
            </h3>
            <p className="muted settings-hint">
              {t('account.pseudoHint')}
              {displayNameRules}
            </p>
            <form
              onSubmit={savePseudo}
              className="stack"
              aria-labelledby="settings-pseudo-title"
            >
              <div>
                <label htmlFor="settings-pseudo">
                  {t('account.pseudoLabel')}
                </label>
                <input
                  id="settings-pseudo"
                  value={pseudoDraft}
                  onChange={e => setPseudoDraft(e.target.value)}
                  autoComplete="nickname"
                  maxLength={30}
                />
              </div>
              <button type="submit" disabled={pseudoBusy || !pseudoDirty}>
                {pseudoBusy ? t('common.saving') : t('account.savePseudo')}
              </button>
            </form>
          </div>

          <hr className="settings-divider" />

          <div className="settings-subsection">
            <h3 className="settings-subsection-title" id="settings-email-title">
              {t('account.emailTitle')}
            </h3>
            <p className="muted settings-hint">
              {t('account.emailIdentifier')}&nbsp;:{' '}
              {user.email ? (
                <code>{user.email}</code>
              ) : (
                <span>{t('account.emailNotSet')}</span>
              )}
            </p>
            {user.email ? (
              <div className="settings-actions-row">
                <button
                  type="button"
                  className="secondary"
                  disabled={busyMagic}
                  onClick={() => void resendMagicLink()}
                >
                  {busyMagic ? t('common.sending') : t('account.resendMagic')}
                </button>
              </div>
            ) : null}
            <form
              onSubmit={saveEmail}
              className="stack"
              aria-labelledby="settings-email-title"
            >
              <div>
                <label htmlFor="settings-email">
                  {t('account.newEmailLabel')}
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={emailDraft}
                  onChange={e => {
                    setEmailDraft(e.target.value);
                    setEmailFeedback(null);
                  }}
                  autoComplete="email"
                />
              </div>
              {emailFeedback ? (
                <p
                  role="status"
                  className={
                    emailFeedback.variant === 'error'
                      ? 'settings-feedback error'
                      : 'settings-feedback muted'
                  }
                >
                  {emailFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={emailBusy || emailUnchanged}>
                {emailBusy
                  ? t('common.sending')
                  : t('account.requestEmailChange')}
              </button>
            </form>
          </div>
        </section>

        <section
          className="card stack settings-card"
          aria-labelledby="settings-display-heading"
        >
          <h2 id="settings-display-heading">{t('account.sectionDisplay')}</h2>
          <p className="muted settings-hint">{t('account.themeHint')}</p>
          <div
            className="settings-theme-row"
            role="group"
            aria-label={t('account.themeGroupAria')}
          >
            <button
              type="button"
              className={mode === 'light' ? undefined : 'secondary'}
              onClick={() => applyTheme('light')}
            >
              {t('account.themeLight')}
            </button>
            <button
              type="button"
              className={mode === 'dark' ? undefined : 'secondary'}
              onClick={() => applyTheme('dark')}
            >
              {t('account.themeDark')}
            </button>
          </div>

          <hr className="settings-divider" />

          <div className="settings-subsection">
            <h3 className="settings-subsection-title">
              {t('account.languageTitle')}
            </h3>
            <p className="muted settings-hint">{t('account.languageHint')}</p>
            <div
              className="settings-theme-row settings-language-row"
              role="group"
              aria-label={t('account.languageGroupAria')}
            >
              {locales.map(l => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  className={locale === l ? undefined : 'secondary'}
                  aria-pressed={locale === l}
                  onClick={() => setLocale(l)}
                >
                  {l === 'fr' ? t('account.langFr') : t('account.langEn')}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section
          className="card stack settings-card"
          aria-labelledby="settings-app-heading"
        >
          <h2 id="settings-app-heading">{t('account.sectionApp')}</h2>

          <div className="settings-subsection">
            <h3 className="settings-subsection-title">
              {t('account.updateTitle')}
            </h3>
            <p className="muted settings-hint">{t('account.updateHint')}</p>
            {needRefresh ? (
              <p className="muted settings-hint" role="status">
                <strong>{t('account.updateReadyTitle')}</strong>
                {t('account.updateReadyNote')}
              </p>
            ) : null}
            <button
              type="button"
              disabled={reloadBusy}
              onClick={onReloadLatest}
            >
              {reloadBusy ? t('account.reloading') : t('account.reloadLatest')}
            </button>
          </div>

          <hr className="settings-divider" />

          <div className="settings-subsection">
            <h3 className="settings-subsection-title">
              {t('account.tourTitle')}
            </h3>
            <p className="muted settings-hint">{t('account.tourHint')}</p>
            <div className="settings-actions-row">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  resetAllAssistantFlags();
                  try {
                    sessionStorage.removeItem('mc_invite_welcome');
                  } catch {
                    /* ignore */
                  }
                  showToast(t('account.toastTourReset'));
                }}
              >
                {t('account.tourReset')}
              </button>
              <button type="button" onClick={() => navigate('/assistant')}>
                {t('account.tourStart')}
              </button>
            </div>
          </div>
        </section>

        <section
          className="card stack settings-card mc-family"
          aria-labelledby="settings-family-heading"
        >
          <FamilyApps
            currentAppId="miss-carbook"
            showSource={false}
            showSponsor={false}
            labels={{ otherApps: t('account.otherApps') }}
          />
        </section>
      </div>
    </div>
  );
}
