import { type ReactNode, useState } from 'react'
import { supabase } from '../lib/supabase'
import { displayNameSchema } from '../lib/validation/schemas'
import { useAuth } from '../hooks/useAuth'

export function PseudoGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const parsed = displayNameSchema.safeParse(pseudo)
    if (!parsed.success) {
      setErr(parsed.error.errors[0]?.message ?? 'Pseudo invalide')
      return
    }
    setBusy(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      if (!sess.session) {
        const { error: anonErr } = await supabase.auth.signInAnonymously()
        if (anonErr) throw anonErr
      }
      const {
        data: { user: u },
      } = await supabase.auth.getUser()
      if (!u) throw new Error('Session indisponible')

      const { error: upErr } = await supabase.from('profiles').upsert({
        id: u.id,
        display_name: parsed.data,
      })
      if (upErr) throw upErr
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Échec de connexion')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="shell">
        <p className="muted">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="shell">
        <div className="card stack">
          <h1>Miss Carbook</h1>
          <p className="muted">
            Carnet collaboratif pour choisir un véhicule. Saisissez un pseudo affiché aux autres
            participants (auth anonyme sécurisée Supabase — activer le fournisseur « Anonymous »
            dans le tableau de bord).
          </p>
          <form onSubmit={submit} className="stack">
            <div>
              <label htmlFor="pseudo">Pseudo</label>
              <input
                id="pseudo"
                value={pseudo}
                onChange={(e) => setPseudo(e.target.value)}
                autoComplete="nickname"
                required
                maxLength={80}
                placeholder="ex. Guillaume"
              />
            </div>
            {err ? <p className="error">{err}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? 'Connexion…' : 'Continuer'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
