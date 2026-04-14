import type { Database } from '../../../types/database'

export type Ws = Database['public']['Tables']['workspaces']['Row']

export type Member = {
  user_id: string
  role: Database['public']['Tables']['workspace_members']['Row']['role']
}

export type InviteRow = {
  id: string
  token: string
  role: string
  expires_at: string
  used_at: string | null
}

export type CandidateOption = {
  id: string
  brand: string
  model: string
  trim: string
  parent_candidate_id: string | null
}
