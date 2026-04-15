import { useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { logActivity } from '../../../lib/activity'
import { legacyManufacturerUrlFromLinks } from '../../../lib/manufacturerLinks'
import type { Json } from '../../../types/database'
import type { CandidateRow } from './candidateTypes'

export function useCandidateMutations({
  workspaceId,
  canWrite,
  load,
  reportException,
}: {
  workspaceId: string
  canWrite: boolean
  load: () => Promise<void>
  reportException: (e: unknown, ctx: string) => void
}) {
  const duplicateOne = useCallback(
    async (c: CandidateRow) => {
      if (!canWrite) return
      try {
        let q = supabase.from('candidates').select('sort_order').eq('workspace_id', workspaceId)
        if (c.parent_candidate_id) q = q.eq('parent_candidate_id', c.parent_candidate_id)
        else q = q.is('parent_candidate_id', null)
        const { data: lastSort } = await q
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        const prev = (lastSort as { sort_order?: number } | null)?.sort_order
        const nextOrder = (prev == null ? -1 : prev) + 1

        const { data, error } = await supabase
          .from('candidates')
          .insert({
            workspace_id: workspaceId,
            parent_candidate_id: c.parent_candidate_id,
            sort_order: nextOrder,
            brand: c.brand,
            model: c.model ? `${c.model} (copie)` : '(copie)',
            trim: c.trim,
            engine: c.engine,
            price: c.price,
            mileage_km: c.mileage_km,
            first_registration: c.first_registration,
            gearbox: c.gearbox,
            energy: c.energy,
            options: c.options,
            garage_location: c.garage_location,
            manufacturer_links: c.manufacturer_links as unknown as Json,
            manufacturer_url: legacyManufacturerUrlFromLinks(c.manufacturer_links),
            event_date: c.event_date,
            status: 'to_see',
            reject_reason: '',
          })
          .select('id')
          .single()
        if (error) throw error
        const specs = (c.candidate_specs?.specs ?? {}) as Json
        await supabase.from('candidate_specs').insert({ candidate_id: data.id, specs })
        await logActivity(workspaceId, 'candidate.duplicate', 'candidate', data.id, { from: c.id })
        await load()
      } catch (e: unknown) {
        reportException(e, 'Duplication d’un modèle candidat')
      }
    },
    [canWrite, workspaceId, load, reportException]
  )

  const importCsv = useCallback(
    async (file: File | null) => {
      if (!file || !canWrite) return
      try {
        const text = await file.text()
        const lines = text.split(/\r?\n/).filter((l) => l.trim())
        if (lines.length < 2) throw new Error('CSV vide')
        const head = lines[0].split(',').map((s) => s.trim().toLowerCase())
        const col = (name: string, ...alts: string[]) => {
          const i = head.indexOf(name)
          if (i >= 0) return i
          for (const a of alts) {
            const j = head.indexOf(a)
            if (j >= 0) return j
          }
          return -1
        }
        const iBrand = col('brand', 'marque')
        const iModel = col('model', 'modele', 'modèle')
        const iTrim = col('trim', 'finition')
        const iEngine = col('engine', 'motorisation')
        const iPrice = col('price', 'prix')
        if (iBrand < 0 || iModel < 0) throw new Error('Colonnes brand et model requises')
        const { data: lastRoot } = await supabase
          .from('candidates')
          .select('sort_order')
          .eq('workspace_id', workspaceId)
          .is('parent_candidate_id', null)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
        const lastSo = (lastRoot as { sort_order?: number } | null)?.sort_order
        let nextOrder = (lastSo == null ? -1 : lastSo) + 1
        for (let li = 1; li < lines.length; li++) {
          const cols = lines[li].split(',').map((s) => s.trim())
          const brand = cols[iBrand] ?? ''
          const model = cols[iModel] ?? ''
          if (!brand && !model) continue
          const priceRaw = iPrice >= 0 ? cols[iPrice] : ''
          const price = priceRaw ? Number(priceRaw.replace(',', '.')) : null
          const { data, error } = await supabase
            .from('candidates')
            .insert({
              workspace_id: workspaceId,
              sort_order: nextOrder,
              brand,
              model,
              trim: iTrim >= 0 ? (cols[iTrim] ?? '') : '',
              engine: iEngine >= 0 ? (cols[iEngine] ?? '') : '',
              price: Number.isFinite(price as number) ? price : null,
            })
            .select('id')
            .single()
          if (error) throw error
          await supabase.from('candidate_specs').insert({ candidate_id: data.id, specs: {} })
          nextOrder += 1
        }
        await load()
        await logActivity(workspaceId, 'candidate.import_csv', 'workspace', workspaceId, {})
      } catch (e: unknown) {
        reportException(e, 'Import CSV des modèles')
      }
    },
    [canWrite, workspaceId, load, reportException]
  )

  return { duplicateOne, importCsv }
}
