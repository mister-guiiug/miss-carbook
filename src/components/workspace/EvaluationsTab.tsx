import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { logActivity } from '../../lib/activity'
import { useErrorDialog } from '../../contexts/ErrorDialogContext'
import type { RequirementLevel } from '../../types/database'

type Req = { id: string; label: string; level: RequirementLevel }
type Cand = { id: string; brand: string; model: string }
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
  const [reqs, setReqs] = useState<Req[]>([])
  const [cands, setCands] = useState<Cand[]>([])
  const [evals, setEvals] = useState<EvalRow[]>([])
  const [votes, setVotes] = useState<Vote[]>([])

  const load = async () => {
    const [r, c, e, v] = await Promise.all([
      supabase.from('requirements').select('id, label, level').eq('workspace_id', workspaceId),
      supabase.from('candidates').select('id, brand, model').eq('workspace_id', workspaceId),
      supabase.from('requirement_candidate_evaluations').select('requirement_id, candidate_id, status, note'),
      supabase.from('requirement_priority_votes').select('requirement_id, user_id, vote'),
    ])
    const firstErr = r.error ?? c.error ?? e.error ?? v.error
    if (firstErr) reportException(firstErr, 'Chargement de la matrice d’évaluation')
    const reqRows = (r.data ?? []) as Req[]
    const candRows = (c.data ?? []) as Cand[]
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
  }

  useEffect(() => {
    void load()
  }, [workspaceId])

  const evalKey = (rid: string, cid: string) => `${rid}:${cid}`
  const evalMap = useMemo(() => {
    const m = new Map<string, EvalRow>()
    for (const x of evals) m.set(evalKey(x.requirement_id, x.candidate_id), x)
    return m
  }, [evals])

  const voteAgg = useMemo(() => {
    const m = new Map<string, Record<string, number>>()
    for (const v of votes) {
      if (!m.has(v.requirement_id)) m.set(v.requirement_id, { must: 0, should: 0, could: 0, wont: 0 })
      const o = m.get(v.requirement_id)!
      if (v.vote in o) o[v.vote] += 1
    }
    return m
  }, [votes])

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
      await logActivity(workspaceId, 'rce.upsert', 'requirement_candidate', requirementId, { candidateId })
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
    else await load()
  }

  const setMyVote = async (requirementId: string, vote: string) => {
    if (!canWrite) return
    const { error } = await supabase.from('requirement_priority_votes').upsert(
      { requirement_id: requirementId, vote },
      { onConflict: 'requirement_id,user_id' }
    )
    if (error) reportException(error, 'Enregistrement du vote MoSCoW')
    else await load()
  }

  const myVote = (rid: string) => votes.find((v) => v.requirement_id === rid && v.user_id === userId)?.vote

  if (!reqs.length || !cands.length) {
    return (
      <p className="muted">
        Ajoutez des <strong>exigences</strong> et des <strong>modèles</strong> pour remplir la matrice
        d’évaluation.
      </p>
    )
  }

  return (
    <div className="stack eval-tab">
      <p className="muted">
        Pour chaque exigence : votre vote MoSCoW (priorisation) et, par modèle, si l’exigence est
        satisfaite.
      </p>

      <div className="table-wrap">
        <table className="eval-matrix">
          <thead>
            <tr>
              <th>Exigence</th>
              <th>MoSCoW (vous)</th>
              <th>Votes agrégés</th>
              {cands.map((c) => (
                <th key={c.id}>
                  {c.brand} {c.model}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reqs.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className={`badge ${r.level}`}>{r.level === 'mandatory' ? 'Obl.' : 'Disc.'}</span>{' '}
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
                {cands.map((c) => {
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
