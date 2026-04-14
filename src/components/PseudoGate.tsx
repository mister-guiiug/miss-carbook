import { type ReactNode, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { authEmailRedirectUrl } from '../lib/authRedirect'
import { useErrorDialog } from '../contexts/ErrorDialogContext'

export function PseudoGate({ children }: { children: ReactNode }) {
  const { reportException, reportMessage } = useErrorDialog()
  const { user, loading } = useAuth()
  const [loginEmail, setLoginEmail] = useState('')
  const [busyMagic, setBusyMagic] = useState(false)
  const [magicMsg, setMagicMsg] = useState<string | null>(null)

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setMagicMsg(null)
    const email = loginEmail.trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      reportMessage('Adresse e-mail invalide', `Saisie : ${JSON.stringify(email)}`)
      return
    }
    setBusyMagic(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: authEmailRedirectUrl() },
      })
      if (error) throw error
      setMagicMsg('Lien envoyé : ouvrez l’e-mail et cliquez sur le lien pour vous connecter.')
      setLoginEmail('')
    } catch (e: unknown) {
      reportException(e, 'Envoi du lien magique (connexion)')
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
            Carnet collaboratif pour choisir un véhicule. Connectez-vous avec votre adresse e-mail : vous
            recevrez un lien sécurisé (sans mot de passe). Le fournisseur <strong>Email</strong> doit être
            activé dans Supabase ; le fournisseur <strong>Anonymous</strong> doit être désactivé.
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
                required
              />
            </div>
            {magicMsg ? <p className="muted">{magicMsg}</p> : null}
            <button type="submit" disabled={busyMagic}>
              {busyMagic ? 'Envoi…' : 'Recevoir le lien de connexion'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
