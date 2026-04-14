/** URL de base pour les liens magiques Supabase (Pages : origine + `import.meta.env.BASE_URL`). */
export function authEmailRedirectUrl(): string {
  const path = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${path || ''}/`
}
