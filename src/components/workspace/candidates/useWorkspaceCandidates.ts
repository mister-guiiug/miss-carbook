import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import type { CandidateRow } from './candidateTypes'

export function useWorkspaceCandidates(
  workspaceId: string,
  reportException: (e: unknown, ctx: string) => void
) {
  const [candidates, setCandidates] = useState<CandidateRow[]>([])
  const [reviews, setReviews] = useState<{ candidate_id: string; score: number }[]>([])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select('*, candidate_specs ( specs )')
      .eq('workspace_id', workspaceId)
      .order('parent_candidate_id', { ascending: true, nullsFirst: true })
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) reportException(error, 'Chargement des modèles candidats')
    else
      setCandidates(
        (data ?? []).map((row) => ({
          ...(row as unknown as CandidateRow),
          parent_candidate_id:
            (row as { parent_candidate_id?: string | null }).parent_candidate_id ?? null,
          sort_order: Number((row as { sort_order?: number }).sort_order ?? 0),
          mileage_km:
            (row as { mileage_km?: number | null }).mileage_km != null
              ? Number((row as { mileage_km?: number | null }).mileage_km)
              : null,
          first_registration: String(
            (row as { first_registration?: string | null }).first_registration ?? ''
          ),
          gearbox: String((row as { gearbox?: string | null }).gearbox ?? ''),
          energy: String((row as { energy?: string | null }).energy ?? ''),
        }))
      )
    const ids = (data ?? []).map((c: { id: string }) => c.id)
    if (ids.length) {
      const { data: revs } = await supabase
        .from('candidate_reviews')
        .select('candidate_id, score')
        .in('candidate_id', ids)
      setReviews(revs ?? [])
    } else setReviews([])
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  const rootCandidates = useMemo(
    () => candidates.filter((c) => !c.parent_candidate_id),
    [candidates]
  )

  const childrenOf = useCallback(
    (parentId: string) =>
      candidates
        .filter((c) => c.parent_candidate_id === parentId)
        .sort((a, b) => {
          if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
          return (a.trim ?? '').localeCompare(b.trim ?? '', 'fr-FR')
        }),
    [candidates]
  )

  return { candidates, reviews, load, rootCandidates, childrenOf }
}
