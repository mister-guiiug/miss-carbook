import { supabase } from './supabase'
import { assertImageFile } from './validation/schemas'

export async function uploadCandidateImage(
  workspaceId: string,
  candidateId: string,
  file: File,
  userId: string
) {
  assertImageFile(file)
  const safeName = file.name.replace(/[^\w.-]+/g, '_').slice(0, 120)
  const path = `${workspaceId}/${candidateId}/${crypto.randomUUID()}-${safeName}`

  const { error: upErr } = await supabase.storage.from('workspace-media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (upErr) throw upErr

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      workspace_id: workspaceId,
      candidate_id: candidateId,
      storage_path: path,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      created_by: userId,
    })
    .select('id')
    .single()

  if (error) {
    await supabase.storage.from('workspace-media').remove([path])
    throw error
  }
  return data.id as string
}

export async function signedUrlForPath(path: string, expiresSec = 3600) {
  const { data, error } = await supabase.storage
    .from('workspace-media')
    .createSignedUrl(path, expiresSec)
  if (error) throw error
  return data.signedUrl
}
