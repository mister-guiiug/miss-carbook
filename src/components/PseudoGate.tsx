import { type ReactNode, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { authEmailRedirectUrl } from '../lib/authRedirect';
import {
  formatAuthCredentialError,
  formatAuthEmailSendError,
} from '../lib/authEmailErrors';
import {
  authPasswordLoginSchema,
  authPasswordSignUpSchema,
} from '../lib/validation/schemas';
import { useErrorDialog } from '../contexts/ErrorDialogContext';
import { useI18n } from '../i18n';

type GateMode = 'magic' | 'password_login' | 'password_signup';

type Feedback = { variant: 'success' | 'error'; text: string } | null;

export function PseudoGate({ children }: { children: ReactNode }) {
  const { reportException, reportMessage } = useErrorDialog();
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [gateMode, setGateMode] = useState<GateMode>('magic');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busyMagic, setBusyMagic] = useState(false);
  const [magicFeedback, setMagicFeedback] = useState<Feedback>(null);

  const [busyPassword, setBusyPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);

  const setMode = (mode: GateMode) => {
    setGateMode(mode);
    setMagicFeedback(null);
    setPasswordFeedback(null);
    if (mode === 'magic') {
      setPassword('');
      setConfirmPassword('');
    }
  };

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMagicFeedback(null);
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      reportMessage(
        t('auth.errEmailInvalid'),
        t('auth.inputDetail', { value: JSON.stringify(trimmed) })
      );
      return;
    }
    setBusyMagic(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      });
      if (error) throw error;
      setMagicFeedback({
        variant: 'success',
        text: t('auth.magicSent'),
      });
      setEmail('');
    } catch (e: unknown) {
      const friendly = formatAuthEmailSendError(e);
      if (friendly) {
        setMagicFeedback({ variant: 'error', text: friendly });
      } else {
        reportException(e, t('auth.ctxMagicSend'));
      }
    } finally {
      setBusyMagic(false);
    }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    const parsed = authPasswordLoginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? t('common.invalidForm');
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2));
      return;
    }
    setBusyPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
    } catch (e: unknown) {
      const friendly = formatAuthCredentialError(e);
      if (friendly) {
        setPasswordFeedback({ variant: 'error', text: friendly });
      } else {
        reportException(e, t('auth.ctxPasswordLogin'));
      }
    } finally {
      setBusyPassword(false);
    }
  };

  const signUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    const parsed = authPasswordSignUpSchema.safeParse({
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? t('common.invalidForm');
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2));
      return;
    }
    setBusyPassword(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      });
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      if (data.session) {
        setPasswordFeedback({
          variant: 'success',
          text: t('auth.accountCreatedConnected'),
        });
        setEmail('');
      } else {
        setPasswordFeedback({
          variant: 'success',
          text: t('auth.accountCreatedConfirm'),
        });
      }
    } catch (e: unknown) {
      const friendly = formatAuthCredentialError(e);
      if (friendly) {
        setPasswordFeedback({ variant: 'error', text: friendly });
      } else {
        reportException(e, t('auth.ctxPasswordSignup'));
      }
    } finally {
      setBusyPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="shell">
        <p className="muted">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="shell">
        <div className="card stack">
          <h1>{t('common.appName')}</h1>
          <p className="muted">{t('auth.intro')}</p>

          <div
            className="auth-gate-tabs row"
            role="tablist"
            aria-label={t('auth.methodAria')}
          >
            <button
              type="button"
              className={gateMode === 'magic' ? undefined : 'secondary'}
              role="tab"
              aria-selected={gateMode === 'magic'}
              onClick={() => setMode('magic')}
            >
              {t('auth.tabMagic')}
            </button>
            <button
              type="button"
              className={
                gateMode === 'password_login' ? undefined : 'secondary'
              }
              role="tab"
              aria-selected={gateMode === 'password_login'}
              onClick={() => setMode('password_login')}
            >
              {t('auth.tabPassword')}
            </button>
            <button
              type="button"
              className={
                gateMode === 'password_signup' ? undefined : 'secondary'
              }
              role="tab"
              aria-selected={gateMode === 'password_signup'}
              onClick={() => setMode('password_signup')}
            >
              {t('auth.tabSignup')}
            </button>
          </div>

          {gateMode === 'magic' ? (
            <form onSubmit={sendMagicLink} className="stack">
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {t('auth.magicHint')}
              </p>
              <div>
                <label htmlFor="gate-email">{t('auth.emailLabel')}</label>
                <input
                  id="gate-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  required
                />
              </div>
              {magicFeedback ? (
                <p
                  className={
                    magicFeedback.variant === 'error' ? 'error' : 'muted'
                  }
                >
                  {magicFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={busyMagic}>
                {busyMagic ? t('common.sending') : t('auth.receiveLink')}
              </button>
            </form>
          ) : (
            <form
              onSubmit={
                gateMode === 'password_login'
                  ? signInWithPassword
                  : signUpWithPassword
              }
              className="stack"
            >
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                {gateMode === 'password_login'
                  ? t('auth.loginHint')
                  : t('auth.signupHint')}
              </p>
              <div>
                <label htmlFor="gate-pw-email">{t('auth.emailLabel')}</label>
                <input
                  id="gate-pw-email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder={t('auth.emailPlaceholder')}
                  required
                />
              </div>
              <div>
                <label htmlFor="gate-pw-password">
                  {t('auth.passwordLabel')}
                </label>
                <input
                  id="gate-pw-password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={
                    gateMode === 'password_login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  required
                />
              </div>
              {gateMode === 'password_signup' ? (
                <div>
                  <label htmlFor="gate-pw-confirm">
                    {t('auth.confirmPasswordLabel')}
                  </label>
                  <input
                    id="gate-pw-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              ) : null}
              {passwordFeedback ? (
                <p
                  className={
                    passwordFeedback.variant === 'error' ? 'error' : 'muted'
                  }
                >
                  {passwordFeedback.text}
                </p>
              ) : null}
              <button type="submit" disabled={busyPassword}>
                {busyPassword
                  ? t('auth.pleaseWait')
                  : gateMode === 'password_login'
                    ? t('auth.signIn')
                    : t('auth.createAccount')}
              </button>
            </form>
          )}

          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            {t('auth.providerNote')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
