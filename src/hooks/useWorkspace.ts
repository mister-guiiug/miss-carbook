import { useCallback, useEffect, useState } from 'react'
import { formatCandidateListLabel } from '../lib/candidateLabel'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Ws = Database['public']['Tables']['workspaces']['Row']
type Role = Database['public']['Tables']['workspace_members']['Row']['role']

export function useWorkspace(
  workspaceId: string | undefined,
  userId: string | undefined,
  reportException: (err: unknown, context?: string) => void,
  reportMessage: (userMessage: string, technical?: string) => void
) {
  const [workspace, setWorkspace] = useState<Ws | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [decisionLabel, setDecisionLabel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessBlocked, setAccessBlocked] = useState(false)

  const refresh = useCallback(async () => {
    if (!workspaceId || !userId) return
    setLoading(true)
    try {
      setAccessBlocked(false)
      const { data: ws, error: wErr } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', workspaceId)
        .maybeSingle()
      if (wErr) {
        reportException(wErr, 'Chargement du dossier (workspaces)')
        setWorkspace(null)
        setRole(null)
        setAccessBlocked(true)
        return
      }
      if (!ws) {
        reportMessage(
          'Ce dossier est introuvable. Il a peut-être été supprimé ou l’identifiant dans l’URL est incorrect.',
          `workspaceId=${workspaceId} — requête sans ligne`
        )
        setWorkspace(null)
        setRole(null)
        setAccessBlocked(true)
        return
      }
      setWorkspace(ws as Ws)
      const sid = (ws as Ws).selected_candidate_id
      if (sid) {
        const { data: cand } = await supabase
          .from('candidates')
          .select('brand, model, trim, parent_candidate_id')
          .eq('id', sid)
          .maybeSingle()
        setDecisionLabel(
          cand
            ? formatCandidateListLabel({
                brand: cand.brand,
                model: cand.model,
                trim: cand.trim ?? '',
                parent_candidate_id: cand.parent_candidate_id ?? null,
              })
            : null
        )
      } else setDecisionLabel(null)

      const { data: mem, error: mErr } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .maybeSingle()
      if (mErr) {
        reportException(mErr, 'Vérification du rôle (workspace_members)')
        setRole(null)
        setAccessBlocked(true)
        return
      }
      if (!mem) {
        reportMessage(
          'Vous n’êtes pas membre de ce dossier, ou vous n’avez plus accès.',
          `user_id=${userId} workspace_id=${workspaceId} — aucune ligne membre`
        )
        setRole(null)
        setAccessBlocked(true)
        return
      }
      setRole(mem.role as Role)
      setAccessBlocked(false)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, userId, reportException, reportMessage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    workspace,
    role,
    decisionLabel,
    loading,
    accessBlocked,
    refresh,
  }
}
