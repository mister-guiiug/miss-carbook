import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { displayNameSchema, shareCodeSchema, workspaceCreateSchema } from '../lib/validation/schemas'

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
  const { user } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [replacement, setReplacement] = useState(false)
  const [busyCreate, setBusyCreate] = useState(false)

  const [code, setCode] = useState('')
  const [busyJoin, setBusyJoin] = useState(false)

  const [pseudoEdit, setPseudoEdit] = useState('')
  const [busyPseudo, setBusyPseudo] = useState(false)

  const load = async () => {
    if (!user) return
    setLoading(true)
    setErr(null)
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
      setErr(error.message)
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

  const createWs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setErr(null)
    const parsed = workspaceCreateSchema.safeParse({
      name,
      description: desc,
      replacement_enabled: replacement,
    })
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Formulaire invalide')
      return
    }
    setBusyCreate(true)
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({
          name: parsed.data.name,
          description: parsed.data.description,
          replacement_enabled: parsed.data.replacement_enabled,
          created_by: user.id,
        })
        .select('id')
        .single()
      if (error) throw error
      setName('')
      setDesc('')
      setReplacement(false)
      await load()
      if (data?.id) navigate(`/w/${data.id}`)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Création impossible')
    } finally {
      setBusyCreate(false)
    }
  }

  const joinWs = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setErr(null)
    const parsed = shareCodeSchema.safeParse(code)
    if (!parsed.success) {
      setErr('Code invalide')
      return
    }
    setBusyJoin(true)
    try {
      const { data, error } = await supabase.rpc('join_workspace', { p_code: parsed.data })
      if (error) throw error
      setCode('')
      await load()
      if (data) navigate(`/w/${data}`)
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Code inconnu ou accès refusé')
    } finally {
      setBusyJoin(false)
    }
  }

  const savePseudo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setBusyPseudo(true)
    setErr(null)
    const parsed = displayNameSchema.safeParse(pseudoEdit)
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Pseudo invalide')
      setBusyPseudo(false)
      return
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: parsed.data })
        .eq('id', user.id)
      if (error) throw error
      setPseudoEdit('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Mise à jour impossible')
    } finally {
      setBusyPseudo(false)
    }
  }

  return (
    <div className="shell">
      <header className="row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Miss Carbook</h1>
        <span className="muted">connecté</span>
      </header>

      <div className="card stack">
        <h2 style={{ marginTop: 0 }}>Modifier le pseudo</h2>
        <form onSubmit={savePseudo} className="row">
          <input
            value={pseudoEdit}
            onChange={(e) => setPseudoEdit(e.target.value)}
            placeholder="Nouveau pseudo"
            maxLength={80}
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

      {err ? <p className="error">{err}</p> : null}

      <section className="card stack">
        <h2 style={{ marginTop: 0 }}>Mes dossiers</h2>
        {loading ? <p className="muted">Chargement…</p> : null}
        {!loading && rows.length === 0 ? <p className="muted">Aucun dossier pour l’instant.</p> : null}
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
