/** Message lisible pour erreurs profiles / contraintes. */
export function formatProfileSaveError(err: unknown): string {
  const o = err as { code?: string; message?: string } | null
  const code = o?.code
  const msg = o?.message ?? (err instanceof Error ? err.message : '')

  if (code === '23505' || msg.includes('profiles_display_name_lower_uidx')) {
    return 'Ce pseudo est déjà utilisé (unicité, sans tenir compte des majuscules).'
  }
  if (code === '23514' || msg.includes('profiles_display_name_check')) {
    return 'Pseudo refusé par la base : respectez les règles de format.'
  }
  return msg || 'Enregistrement impossible'
}
