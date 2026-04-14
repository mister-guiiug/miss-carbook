import { supabase } from './supabase'
import type { Json } from '../types/database'

export async function logActivity(
  workspaceId: string,
  actionType: string,
  entityType: string,
  entityId?: string | null,
  metadata: Json = {}
) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('activity_log').insert({
    workspace_id: workspaceId,
    user_id: user.id,
    action_type: actionType,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata,
  })
}
