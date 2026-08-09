import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useErrorDialog } from '../contexts/ErrorDialogContext';
import { useToast } from '../contexts/ToastContext';
import { shouldOfferAssistantUi } from '../lib/assistantDevice';
import {
  hasSessionAutoOffered,
  isGlobalAssistantDone,
  setSessionAutoOffered,
} from '../lib/assistantStorage';
import {
  shareCodeSchema,
  workspaceCreateSchema,
} from '../lib/validation/schemas';
import { useI18n } from '../i18n';

type Row = {
  workspace_id: string;
  role: string;
  workspaces: {
    id: string;
    name: string;
    description: string;
    share_code: string;
    created_at: string;
  } | null;
};

export function HomePage() {
  const { reportException, reportMessage } = useErrorDialog();
  const { showToast } = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteHandled = useRef(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [replacement, setReplacement] = useState(false);
  const [busyCreate, setBusyCreate] = useState(false);

  const [code, setCode] = useState('');
  const [busyJoin, setBusyJoin] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('workspace_members')
      .select(
        `
        workspace_id,
        role,
        workspaces ( id, name, description, share_code, created_at )
      `
      )
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false });

    if (error) {
      reportException(error, t('home.ctxLoadList'));
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** Itération 1 : première visite mobile / PWA → assistant d’accueil (une fois par session). */
  useEffect(() => {
    if (!user) return;
    if (!shouldOfferAssistantUi()) return;
    if (isGlobalAssistantDone()) return;
    if (hasSessionAutoOffered()) return;
    setSessionAutoOffered();
    navigate('/assistant', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    const token = searchParams.get('invite');
    if (!token || !user || inviteHandled.current) return;
    inviteHandled.current = true;
    void (async () => {
      const { data, error } = await supabase.rpc('accept_workspace_invite', {
        p_token: token,
      });
      if (error) {
        reportException(error, t('home.ctxAcceptInvite'));
        inviteHandled.current = false;
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.delete('invite');
      setSearchParams(next, { replace: true });
      if (data) {
        try {
          sessionStorage.setItem('mc_invite_welcome', data);
        } catch {
          /* ignore */
        }
        showToast(t('home.toastInviteAccepted'));
        navigate(`/w/${data}`, { replace: true });
      }
    })();
  }, [
    user,
    navigate,
    searchParams,
    setSearchParams,
    reportException,
    showToast,
  ]);

  useEffect(() => {
    if (!searchParams.get('invite')) inviteHandled.current = false;
  }, [searchParams]);

  const createWs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = workspaceCreateSchema.safeParse({
      name,
      description: desc,
      replacement_enabled: replacement,
    });
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? t('common.invalidForm');
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2));
      return;
    }
    setBusyCreate(true);
    try {
      const { data, error } = await supabase.rpc('create_workspace', {
        p_name: parsed.data.name,
        p_description: parsed.data.description,
        p_replacement_enabled: parsed.data.replacement_enabled,
      });
      if (error) throw error;
      setName('');
      setDesc('');
      setReplacement(false);
      await load();
      const newId = typeof data === 'string' ? data : null;
      if (newId) {
        sessionStorage.setItem('mc_new_ws', newId);
        showToast(t('home.toastCreated'));
        navigate(`/w/${newId}`);
      }
    } catch (e: unknown) {
      reportException(e, t('home.ctxCreate'));
    } finally {
      setBusyCreate(false);
    }
  };

  const joinWs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const parsed = shareCodeSchema.safeParse(code);
    if (!parsed.success) {
      reportMessage(
        t('home.errInvalidCode'),
        JSON.stringify(parsed.error.flatten(), null, 2)
      );
      return;
    }
    setBusyJoin(true);
    try {
      const { data, error } = await supabase.rpc('join_workspace', {
        p_code: parsed.data,
      });
      if (error) throw error;
      setCode('');
      await load();
      if (data) {
        showToast(t('home.toastJoined'));
        navigate(`/w/${data}`);
      }
    } catch (e: unknown) {
      reportException(e, t('home.ctxJoin'));
    } finally {
      setBusyJoin(false);
    }
  };

  if (!user) {
    return (
      <div className="shell">
        <p className="muted">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="shell home-page">
      <header className="home-hero stack">
        <h1 className="home-hero-title">{t('common.appName')}</h1>
        <p
          className="muted home-hero-lead"
          style={{ margin: 0, maxWidth: '36rem' }}
        >
          {t('home.heroLead')}
        </p>
        {!isGlobalAssistantDone() ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            <Link to="/assistant">{t('home.guidedTourLink')}</Link>
            {t('home.guidedTourNote')}
          </p>
        ) : null}
      </header>

      <div className="home-actions-accordions stack">
        <details className="card home-accordion" name="home-action">
          <summary className="home-accordion-summary">
            {t('home.createTitle')}
          </summary>
          <div className="home-accordion-body stack">
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {t('home.createHint')}
            </p>
            <form onSubmit={createWs} className="stack">
              <div>
                <label htmlFor="ws-name">{t('home.nameLabel')}</label>
                <input
                  id="ws-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="ws-desc">{t('common.description')}</label>
                <textarea
                  id="ws-desc"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
              </div>
              <label className="row" style={{ gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={replacement}
                  onChange={e => setReplacement(e.target.checked)}
                />
                {t('home.replacementToggle')}
              </label>
              <button type="submit" disabled={busyCreate}>
                {busyCreate ? t('home.creating') : t('home.createSubmit')}
              </button>
            </form>
          </div>
        </details>

        <details className="card home-accordion" name="home-action">
          <summary className="home-accordion-summary">
            {t('home.joinTitle')}
          </summary>
          <div className="home-accordion-body stack">
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {t('home.joinHint')}
            </p>
            <form onSubmit={joinWs} className="stack">
              <div>
                <label htmlFor="ws-code">{t('home.codeLabel')}</label>
                <input
                  id="ws-code"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder={t('home.codePlaceholder')}
                  autoComplete="off"
                  maxLength={12}
                />
              </div>
              <button type="submit" className="secondary" disabled={busyJoin}>
                {busyJoin ? t('home.joining') : t('home.joinSubmit')}
              </button>
            </form>
          </div>
        </details>
      </div>

      <section className="card stack home-workspaces">
        <h2 className="home-section-title">{t('home.myWorkspaces')}</h2>
        {loading ? <p className="muted">{t('common.loading')}</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">{t('home.empty')}</p>
        ) : null}
        <ul
          className="stack"
          style={{ listStyle: 'none', padding: 0, margin: 0 }}
        >
          {rows.map(r => {
            const w = r.workspaces;
            if (!w) return null;
            return (
              <li
                key={r.workspace_id}
                className="card"
                style={{ boxShadow: 'none' }}
              >
                <div
                  className="row"
                  style={{ justifyContent: 'space-between' }}
                >
                  <div>
                    <strong>{w.name}</strong>
                    <div className="muted">
                      {t('home.codeMeta')}&nbsp;: <code>{w.share_code}</code> ·{' '}
                      {t('home.roleMeta')}&nbsp;: {r.role}
                    </div>
                  </div>
                  <Link className="btn" to={`/w/${w.id}`}>
                    {t('common.open')}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
