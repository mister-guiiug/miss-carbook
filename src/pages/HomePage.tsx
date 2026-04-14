import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useErrorDialog } from '../contexts/ErrorDialogContext'
import { useToast } from '../contexts/ToastContext'
import { shouldOfferAssistantUi } from '../lib/assistantDevice'
import {
  hasSessionAutoOffered,
  isGlobalAssistantDone,
  setSessionAutoOffered,
} from '../lib/assistantStorage'
import { shareCodeSchema, workspaceCreateSchema } from '../lib/validation/schemas'

type Row = {
  workspace_id: string
  role: string
  workspaces: {
    id: string
    name: string
    description: string
    share_code: string
    created_at: string
  } | null
}

export function HomePage() {
  const { reportException, reportMessage } = useErrorDialog()
  const { showToast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const inviteHandled = useRef(false)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [replacement, setReplacement] = useState(false)
  const [busyCreate, setBusyCreate] = useState(false)

  const [code, setCode] = useState('')
  const [busyJoin, setBusyJoin] = useState(false)

  const load = async () => {
    if (!user) return
    setLoading(true)
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
      .order('joined_at', { ascending: false })

    if (error) {
      reportException(error, 'Chargement de la liste des dossiers')
      setRows([])
    } else {
      setRows((data ?? []) as unknown as Row[])
    }
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  /** Itération 1 : première visite mobile / PWA → assistant d’accueil (une fois par session). */
  useEffect(() => {
    if (!user) return
    if (!shouldOfferAssistantUi()) return
    if (isGlobalAssistantDone()) return
    if (hasSessionAutoOffered()) return
    setSessionAutoOffered()
    navigate('/assistant', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    const token = searchParams.get('invite')
    if (!token || !user || inviteHandled.current) return
    inviteHandled.current = true
    void (async () => {
      const { data, error } = await supabase.rpc('accept_workspace_invite', { p_token: token })
      if (error) {
        reportException(error, 'Acceptation d’une invitation (paramètre invite)')
        inviteHandled.current = false
        return
      }
      const next = new URLSearchParams(searchParams)
      next.delete('invite')
      setSearchParams(next, { replace: true })
      if (data) {
        try {
          sessionStorage.setItem('mc_invite_welcome', data)
        } catch {
          /* ignore */
        }
        showToast('Invitation acceptée')
        navigate(`/w/${data}`, { replace: true })
      }
    })()
  }, [user, navigate, searchParams, setSearchParams, reportException, showToast])

  useEffect(() => {
    if (!searchParams.get('invite')) inviteHandled.current = false
  }, [searchParams])

  const createWs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const parsed = workspaceCreateSchema.safeParse({
      name,
      description: desc,
      replacement_enabled: replacement,
    })
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Formulaire invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    setBusyCreate(true)
    try {
      const { data, error } = await supabase.rpc('create_workspace', {
        p_name: parsed.data.name,
        p_description: parsed.data.description,
        p_replacement_enabled: parsed.data.replacement_enabled,
      })
      if (error) throw error
      setName('')
      setDesc('')
      setReplacement(false)
      await load()
      const newId = typeof data === 'string' ? data : null
      if (newId) {
        sessionStorage.setItem('mc_new_ws', newId)
        showToast('Dossier créé')
        navigate(`/w/${newId}`)
      }
    } catch (e: unknown) {
      reportException(e, 'Création d’un dossier')
    } finally {
      setBusyCreate(false)
    }
  }

  const joinWs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const parsed = shareCodeSchema.safeParse(code)
    if (!parsed.success) {
      reportMessage('Code invalide', JSON.stringify(parsed.error.flatten(), null, 2))
      return
    }
    setBusyJoin(true)
    try {
      const { data, error } = await supabase.rpc('join_workspace', { p_code: parsed.data })
      if (error) throw error
      setCode('')
      await load()
      if (data) {
        showToast('Vous avez rejoint le dossier')
        navigate(`/w/${data}`)
      }
    } catch (e: unknown) {
      reportException(e, 'Rejoindre un dossier avec un code')
    } finally {
      setBusyJoin(false)
    }
  }

  if (!user) {
    return (
      <div className="shell">
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  return (
    <div className="shell home-page">
      <header className="home-hero stack">
        <h1 className="home-hero-title">Miss Carbook</h1>
        <p className="muted home-hero-lead" style={{ margin: 0, maxWidth: '36rem' }}>
          Dossiers partagés pour comparer des véhicules, noter des exigences et décider ensemble.
          Ouvrez un dossier ci-dessous ou utilisez les actions pliables.
        </p>
        {!isGlobalAssistantDone() ? (
          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
            <Link to="/assistant">Visite guidée</Link> — présentation rapide (recommandée sur
            mobile).
          </p>
        ) : null}
      </header>

      <div className="home-actions-accordions stack">
        <details className="card home-accordion" name="home-action">
          <summary className="home-accordion-summary">Créer un dossier</summary>
          <div className="home-accordion-body stack">
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Nouveau projet véhicule dont vous serez administrateur.
            </p>
            <form onSubmit={createWs} className="stack">
              <div>
                <label htmlFor="ws-name">Nom du projet</label>
                <input
                  id="ws-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="ws-desc">Description</label>
                <textarea id="ws-desc" value={desc} onChange={(e) => setDesc(e.target.value)} />
              </div>
              <label className="row" style={{ gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={replacement}
                  onChange={(e) => setReplacement(e.target.checked)}
                />
                Activer le bloc « véhicule actuel / remplacement »
              </label>
              <button type="submit" disabled={busyCreate}>
                {busyCreate ? 'Création…' : 'Créer le dossier'}
              </button>
            </form>
          </div>
        </details>

        <details className="card home-accordion" name="home-action">
          <summary className="home-accordion-summary">Rejoindre un dossier</summary>
          <div className="home-accordion-body stack">
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              Saisissez le code court partagé par un membre du dossier (6 caractères).
            </p>
            <form onSubmit={joinWs} className="stack">
              <div>
                <label htmlFor="ws-code">Code de partage</label>
                <input
                  id="ws-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex. AB12CD"
                  autoComplete="off"
                  maxLength={12}
                />
              </div>
              <button type="submit" className="secondary" disabled={busyJoin}>
                {busyJoin ? 'Connexion…' : 'Rejoindre'}
              </button>
            </form>
          </div>
        </details>
      </div>

      <section className="card stack home-workspaces">
        <h2 className="home-section-title">Mes dossiers</h2>
        {loading ? <p className="muted">Chargement…</p> : null}
        {!loading && rows.length === 0 ? (
          <p className="muted">Aucun dossier pour l’instant.</p>
        ) : null}
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {rows.map((r) => {
            const w = r.workspaces
            if (!w) return null
            return (
              <li key={r.workspace_id} className="card" style={{ boxShadow: 'none' }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{w.name}</strong>
                    <div className="muted">
                      code&nbsp;: <code>{w.share_code}</code> · rôle&nbsp;: {r.role}
                    </div>
                  </div>
                  <Link className="btn" to={`/w/${w.id}`}>
                    Ouvrir
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
