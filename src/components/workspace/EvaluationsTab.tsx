import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatCandidateListLabel } from '../../lib/candidateLabel'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import { useToast } from '../../contexts/ToastContext'
import type { CandidateStatus, RequirementLevel } from '../../types/database'
import { EmptyState } from '../ui/EmptyState'

type Req = { id: string; label: string; level: RequirementLevel }
type Cand = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
  status: CandidateStatus
}
type EvalRow = {
  requirement_id: string
  candidate_id: string
  status: string
  note: string
}
type Vote = { requirement_id: string; user_id: string; vote: string }

const statusOpts = [
  { v: 'unknown', l: '?' },
  { v: 'ok', l: 'OK' },
  { v: 'partial', l: 'Partiel' },
  { v: 'ko', l: 'Non' },
] as const

const moscow = [
  { v: 'must', l: 'Must' },
  { v: 'should', l: 'Should' },
  { v: 'could', l: 'Could' },
  { v: 'wont', l: "Won't" },
] as const

export function EvaluationsTab({
  workspaceId,
  canWrite,
  userId,
}: {
  workspaceId: string
  canWrite: boolean
  userId: string
}) {
  const { reportException } = useErrorDialog()
  const { showToast } = useToast()
  const [reqs, setReqs] = useState<Req[]>([])
  const [cands, setCands] = useState<Cand[]>([])
  const [evals, setEvals] = useState<EvalRow[]>([])
  const [votes, setVotes] = useState<Vote[]>([])
  const [hide, setHide] = useState({
    excluded: false,
    toSee: false,
    parents: false,
    children: false,
  })

  const load = useCallback(async () => {
    const [r, c, e, v] = await Promise.all([
      supabase
        .from('requirements')
        .select('id, label, level')
        .eq('workspace_id', workspaceId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('candidates')
        .select('id, brand, model, trim, parent_candidate_id, status')
        .eq('workspace_id', workspaceId)
        .order('parent_candidate_id', { ascending: true, nullsFirst: true })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('requirement_candidate_evaluations')
        .select('requirement_id, candidate_id, status, note'),
      supabase.from('requirement_priority_votes').select('requirement_id, user_id, vote'),
    ])
    const firstErr = r.error ?? c.error ?? e.error ?? v.error
    if (firstErr) reportException(firstErr, 'Chargement de la matrice d’évaluation')
    const reqRows = (r.data ?? []) as Req[]
    const candRows = (c.data ?? []).map((row) => ({
      ...(row as Cand),
      trim: (row as { trim?: string }).trim ?? '',
      parent_candidate_id:
        (row as { parent_candidate_id?: string | null }).parent_candidate_id ?? null,
      status: (row as { status?: CandidateStatus }).status ?? 'to_see',
    }))
    const reqIds = new Set(reqRows.map((x) => x.id))
    const candIds = new Set(candRows.map((x) => x.id))
    setReqs(reqRows)
    setCands(candRows)
    setEvals(
      (e.data ?? []).filter(
        (x: EvalRow) => reqIds.has(x.requirement_id) && candIds.has(x.candidate_id)
      ) as EvalRow[]
    )
    setVotes((v.data ?? []).filter((x: Vote) => reqIds.has(x.requirement_id)) as Vote[])
  }, [workspaceId, reportException])

  useEffect(() => {
    void load()
  }, [load])

  const evalKey = (rid: string, cid: string) => `${rid}:${cid}`
  const evalMap = useMemo(() => {
    const m = new Map<string, EvalRow>()
    for (const x of evals) m.set(evalKey(x.requirement_id, x.candidate_id), x)
    return m
  }, [evals])

  const voteAgg = useMemo(() => {
    const m = new Map<string, Record<string, number>>()
    for (const v of votes) {
      if (!m.has(v.requirement_id))
        m.set(v.requirement_id, { must: 0, should: 0, could: 0, wont: 0 })
      const o = m.get(v.requirement_id)!
      if (v.vote in o) o[v.vote] += 1
    }
    return m
  }, [votes])

  const filteredCands = useMemo(() => {
    return cands.filter((cand) => {
      const isChild = Boolean(cand.parent_candidate_id)
      const isParent = !isChild
      const isExcluded = cand.status === 'rejected'
      const isToSee = cand.status === 'to_see'

      if (hide.excluded && isExcluded) return false
      if (hide.toSee && isToSee) return false
      if (hide.parents && isParent) return false
      if (hide.children && isChild) return false
      return true
    })
  }, [cands, hide])

  const setStatus = async (requirementId: string, candidateId: string, status: string) => {
    if (!canWrite) return
    const cur = evalMap.get(evalKey(requirementId, candidateId))
    const { error } = await supabase.from('requirement_candidate_evaluations').upsert(
      {
        requirement_id: requirementId,
        candidate_id: candidateId,
        status,
        note: cur?.note ?? '',
      },
      { onConflict: 'requirement_id,candidate_id' }
    )
    if (error) reportException(error, 'Mise à jour du statut d’évaluation (exigence / modèle)')
    else {
      await load()
      await logActivity(workspaceId, 'rce.upsert', 'requirement_candidate', requirementId, {
        candidateId,
      })
    }
  }

  const setNote = async (requirementId: string, candidateId: string, note: string) => {
    if (!canWrite) return
    const cur = evalMap.get(evalKey(requirementId, candidateId)) ?? {
      requirement_id: requirementId,
      candidate_id: candidateId,
      status: 'unknown',
      note: '',
    }
    const { error } = await supabase.from('requirement_candidate_evaluations').upsert(
      {
        requirement_id: requirementId,
        candidate_id: candidateId,
        status: cur.status,
        note: note.slice(0, 1000),
      },
      { onConflict: 'requirement_id,candidate_id' }
    )
    if (error) reportException(error, 'Mise à jour de la note d’évaluation')
    else {
      await load()
      showToast('Note enregistrée')
    }
  }

  const setMyVote = async (requirementId: string, vote: string) => {
    if (!canWrite) return
    const { error } = await supabase
      .from('requirement_priority_votes')
      .upsert({ requirement_id: requirementId, vote }, { onConflict: 'requirement_id,user_id' })
    if (error) reportException(error, 'Enregistrement du vote MoSCoW')
    else {
      await load()
      showToast('Vote MoSCoW enregistré')
    }
  }

  const myVote = (rid: string) =>
    votes.find((v) => v.requirement_id === rid && v.user_id === userId)?.vote

  if (!reqs.length || !cands.length) {
    return (
      <EmptyState
        icon="requirements"
        title="Matrice d’évaluation non disponible"
        text={
          !reqs.length && !cands.length
            ? "Ajoutez des exigences (onglet Exigences) et des modèles (onglet Modèles) pour remplir la matrice d’évaluation."
            : !reqs.length
              ? "Ajoutez des exigences (onglet Exigences) pour remplir la matrice d’évaluation."
              : "Ajoutez des modèles (onglet Modèles) pour remplir la matrice d’évaluation."
        }
      />
    )
  }

  return (
    <div className="stack eval-tab">
      <p className="muted">
        Pour chaque exigence : votre vote MoSCoW (priorisation) et, par modèle, si l’exigence est
        satisfaite.
      </p>

      <div className="row" style={{ flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        <strong>Masquer</strong>
        <label className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={hide.excluded}
            onChange={(e) => setHide((h) => ({ ...h, excluded: e.target.checked }))}
          />
          Exclus
        </label>
        <label className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={hide.toSee}
            onChange={(e) => setHide((h) => ({ ...h, toSee: e.target.checked }))}
          />
          À voir
        </label>
        <label className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={hide.parents}
            onChange={(e) => setHide((h) => ({ ...h, parents: e.target.checked }))}
          />
          Modèles pères
        </label>
        <label className="row" style={{ gap: '0.35rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={hide.children}
            onChange={(e) => setHide((h) => ({ ...h, children: e.target.checked }))}
          />
          Modèles fils
        </label>
        <span className="muted" style={{ fontSize: '0.9rem' }}>
          {filteredCands.length} / {cands.length} affichés
        </span>
      </div>

      <div className="table-wrap eval-table-wrap">
        <table className="eval-matrix">
          <thead>
            <tr>
              <th>Exigence</th>
              <th>MoSCoW (vous)</th>
              <th>Votes agrégés</th>
              {filteredCands.map((c) => (
                <th key={c.id}>{formatCandidateListLabel(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge ${r.level}`}>
                    {r.level === 'mandatory' ? 'Obl.' : 'Disc.'}
                  </span>{' '}
                  {r.label}
                </td>
                <td>
                  {canWrite ? (
                    <select
                      value={myVote(r.id) ?? ''}
                      onChange={(e) => void setMyVote(r.id, e.target.value)}
                    >
                      <option value="">—</option>
                      {moscow.map((m) => (
                        <option key={m.v} value={m.v}>
                          {m.l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="muted" style={{ fontSize: '0.8rem' }}>
                  {JSON.stringify(voteAgg.get(r.id) ?? {})}
                </td>
                {filteredCands.map((c) => {
                  const cell = evalMap.get(evalKey(r.id, c.id))
                  return (
                    <td key={c.id}>
                      <select
                        value={cell?.status ?? 'unknown'}
                        disabled={!canWrite}
                        onChange={(e) => void setStatus(r.id, c.id, e.target.value)}
                      >
                        {statusOpts.map((s) => (
                          <option key={s.v} value={s.v}>
                            {s.l}
                          </option>
                        ))}
                      </select>
                      <input
                        className="eval-note"
                        placeholder="Note"
                        defaultValue={cell?.note ?? ''}
                        disabled={!canWrite}
                        onBlur={(e) => {
                          if ((e.target.value || '') !== (cell?.note ?? ''))
                            void setNote(r.id, c.id, e.target.value)
                        }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
