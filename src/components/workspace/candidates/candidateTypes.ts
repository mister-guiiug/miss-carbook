import type { CandidateStatus, Json } from '../../../types/database'

export type CandidateRow = {
  id: string
  parent_candidate_id: string | null
  sort_order: number
  brand: string
  model: string
  trim: string
  engine: string
  price: number | null
  options: string
  garage_location: string
  manufacturer_url: string
  event_date: string | null
  status: CandidateStatus
  reject_reason: string
  candidate_specs: { specs: Json } | null
}

export const statusLabels: Record<CandidateStatus, string> = {
  to_see: 'À voir',
  tried: 'Essayé',
  shortlist: 'Shortlist',
  selected: 'Retenu',
  rejected: 'Rejeté',
}
