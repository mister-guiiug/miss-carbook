import { type ReactNode, useState } from 'react'
import { supabase } from '../lib/supabase'
import { displayNameRules, displayNameSchema } from '../lib/validation/schemas'
import { useAuth } from '../hooks/useAuth'
import { notifyProfileUpdated } from '../lib/profileEvents'
import { formatProfileSaveError } from '../lib/profileErrors'
import { authEmailRedirectUrl } from '../lib/authRedirect'

export function PseudoGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [pseudo, setPseudo] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [busyMagic, setBusyMagic] = useState(false)
  const [magicMsg, setMagicMsg] = useState<string | null>(null)

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
      notifyProfileUpdated()
    } catch (e: unknown) {
      setErr(formatProfileSaveError(e))
    } finally {
      setBusy(false)
    }
  }

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setMagicMsg(null)
    const email = loginEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Adresse e-mail invalide')
      return
    }
    setBusyMagic(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      })
      if (error) throw error
      setMagicMsg('Lien envoyé : ouvrez l’e-mail pour vous connecter sur cet appareil.')
      setLoginEmail('')
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Envoi impossible')
    } finally {
      setBusyMagic(false)
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
            Carnet collaboratif pour choisir un véhicule. Créez une session anonyme avec un pseudo, ou
            recevez un lien par e-mail si vous avez déjà associé une adresse (fournisseurs « Anonymous »
            et « Email » dans Supabase).
          </p>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Règles pseudo : {displayNameRules}
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
                maxLength={30}
                placeholder="ex. Guillaume_M"
              />
            </div>
            {err ? <p className="error">{err}</p> : null}
            <button type="submit" disabled={busy}>
              {busy ? 'Connexion…' : 'Continuer en anonyme'}
            </button>
          </form>
          <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>Connexion par e-mail</h2>
          <p className="muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
            Indiquez l’adresse liée à votre compte : vous recevrez un lien pour ouvrir la session sur
            cet appareil.
          </p>
          <form onSubmit={sendMagicLink} className="stack">
            <div>
              <label htmlFor="gate-email">E-mail</label>
              <input
                id="gate-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                placeholder="vous@exemple.com"
              />
            </div>
            {magicMsg ? <p className="muted">{magicMsg}</p> : null}
            <button type="submit" className="secondary" disabled={busyMagic}>
              {busyMagic ? 'Envoi…' : 'Recevoir le lien'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
