import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { notifyProfileUpdated } from '../lib/profileEvents'
import { authEmailRedirectUrl } from '../lib/authRedirect'
import { useErrorDialog } from '../contexts/ErrorDialogContext'
import { useToast } from '../contexts/ToastContext'
import {
  displayNameRules,
  displayNameSchema,
  shareCodeSchema,
  workspaceCreateSchema,
} from '../lib/validation/schemas'

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

  const [pseudoEdit, setPseudoEdit] = useState('')
  const [busyPseudo, setBusyPseudo] = useState(false)
  const [profilePseudo, setProfilePseudo] = useState<string | null>(null)
  const [busyEmail, setBusyEmail] = useState(false)
  const [emailHint, setEmailHint] = useState<string | null>(null)

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

  useEffect(() => {
    if (!user) {
      setProfilePseudo(null)
      return
    }
    void supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => setProfilePseudo(data?.display_name ?? null))
  }, [user])

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

  const savePseudo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setBusyPseudo(true)
    const parsed = displayNameSchema.safeParse(pseudoEdit)
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? 'Pseudo invalide'
      reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
      setBusyPseudo(false)
      return
    }
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: parsed.data,
      })
      if (error) throw error
      setPseudoEdit('')
      setProfilePseudo(parsed.data)
      notifyProfileUpdated()
      showToast('Pseudo mis à jour')
    } catch (e: unknown) {
      reportException(e, 'Mise à jour du pseudo (page d’accueil)')
    } finally {
      setBusyPseudo(false)
    }
  }

  const resendMagicLink = async () => {
    if (!user?.email) return
    setEmailHint(null)
    setBusyEmail(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      })
      if (error) throw error
      setEmailHint('Nouveau lien envoyé sur votre adresse.')
    } catch (e: unknown) {
      reportException(e, 'Renvoi du lien magique')
    } finally {
      setBusyEmail(false)
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
    <div className="shell">
      <header style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Miss Carbook</h1>
      </header>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Compte</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.9rem' }}>
          Connecté avec {user.email ? <code>{user.email}</code> : <span>votre session e-mail</span>}
          . Pour ouvrir une session sur un autre appareil, déconnectez-vous ou utilisez un autre
          navigateur, puis saisissez la même adresse sur l’écran de bienvenue.
          {user.email ? (
            <button
              type="button"
              className="secondary"
              style={{ marginLeft: '0.5rem' }}
              disabled={busyEmail}
              onClick={() => void resendMagicLink()}
            >
              Renvoyer un lien
            </button>
          ) : null}
        </p>
        {emailHint ? <p className="muted">{emailHint}</p> : null}
      </div>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Modifier le pseudo</h2>
        <p className="muted" style={{ marginTop: 0, fontSize: '0.85rem' }}>
          Actuel : <strong>{profilePseudo ?? '…'}</strong>. {displayNameRules}
        </p>
        <form onSubmit={savePseudo} className="row">
          <input
            value={pseudoEdit}
            onChange={(e) => setPseudoEdit(e.target.value)}
            placeholder="Nouveau pseudo"
            maxLength={30}
            autoComplete="nickname"
            style={{ flex: '1 1 200px' }}
          />
          <button type="submit" className="secondary" disabled={busyPseudo || !pseudoEdit.trim()}>
            Enregistrer
          </button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Créer un dossier</h2>
        <form onSubmit={createWs} className="stack">
          <div>
            <label htmlFor="ws-name">Nom du projet véhicule</label>
            <input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} required />
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
            Créer
          </button>
        </form>
      </div>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Rejoindre avec un code</h2>
        <form onSubmit={joinWs} className="row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE PARTAGE"
            style={{ flex: '1 1 160px' }}
          />
          <button type="submit" className="secondary" disabled={busyJoin}>
            Rejoindre
          </button>
        </form>
      </div>

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Mes dossiers</h2>
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
