import { useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activity'
import { candidateSchema } from '../../../lib/validation/schemas'
import type { CandidateStatus } from '../../../types/database'

export type AddCandidateFormState = {
  parent_id: string
  brand: string
  model: string
  trim: string
  engine: string
  price: string
  options: string
  garage_location: string
  manufacturer_url: string
  event_date: string
  status: CandidateStatus
  reject_reason: string
}

const emptyForm = (): AddCandidateFormState => ({
  parent_id: '',
  brand: '',
  model: '',
  trim: '',
  engine: '',
  price: '',
  options: '',
  garage_location: '',
  manufacturer_url: '',
  event_date: '',
  status: 'to_see' as CandidateStatus,
  reject_reason: '',
})

export function useAddCandidateForm({
  workspaceId,
  canWrite,
  load,
  reportException,
  reportMessage,
}: {
  workspaceId: string
  canWrite: boolean
  load: () => Promise<void>
  reportException: (e: unknown, ctx: string) => void
  reportMessage: (msg: string, detail?: string) => void
}) {
  const [form, setForm] = useState<AddCandidateFormState>(emptyForm)

  const addCandidate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!canWrite) return
      const parsed = candidateSchema.safeParse({
        ...form,
        parent_candidate_id: form.parent_id || null,
        price: form.price,
        event_date: form.event_date || null,
      })
      if (!parsed.success) {
        const msg = parsed.error.errors[0]?.message ?? 'Invalide'
        reportMessage(msg, JSON.stringify(parsed.error.flatten(), null, 2))
        return
      }
      try {
        const parentId = parsed.data.parent_candidate_id
        let q = supabase.from('candidates').select('sort_order').eq('workspace_id', workspaceId)
        if (parentId) q = q.eq('parent_candidate_id', parentId)
        else q = q.is('parent_candidate_id', null)
        const { data: lastSort } = await q
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        const prev = (lastSort as { sort_order?: number } | null)?.sort_order
        const nextOrder = (prev == null ? -1 : prev) + 1

        const isRootRow = !parentId
        const { data, error } = await supabase
          .from('candidates')
          .insert({
            workspace_id: workspaceId,
            parent_candidate_id: parsed.data.parent_candidate_id,
            sort_order: nextOrder,
            brand: parsed.data.brand,
            model: parsed.data.model,
            trim: parsed.data.trim,
            engine: isRootRow ? '' : parsed.data.engine,
            price: isRootRow ? null : parsed.data.price,
            options: isRootRow ? '' : parsed.data.options,
            garage_location: isRootRow ? '' : parsed.data.garage_location,
            manufacturer_url: isRootRow ? '' : parsed.data.manufacturer_url,
            event_date: parsed.data.event_date,
            status: parsed.data.status,
            reject_reason: parsed.data.reject_reason,
          })
          .select('id')
          .single()
        if (error) throw error
        await supabase.from('candidate_specs').insert({ candidate_id: data.id, specs: {} })
        await logActivity(workspaceId, 'candidate.create', 'candidate', data.id, {})
        setForm(emptyForm())
        await load()
      } catch (e: unknown) {
        reportException(e, 'Création d’un modèle candidat')
      }
    },
    [canWrite, form, workspaceId, load, reportException, reportMessage]
  )

  return { form, setForm, addCandidate }
}
