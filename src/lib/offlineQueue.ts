const KEY = 'mc-offline-queue'

export type QueuedOp = {
  id: string
  kind: string
  payload: unknown
  at: number
}

export function enqueueOffline(kind: string, payload: unknown) {
  const raw = localStorage.getItem(KEY)
  const list: QueuedOp[] = raw ? (JSON.parse(raw) as QueuedOp[]) : []
  list.push({ id: crypto.randomUUID(), kind, payload, at: Date.now() })
  localStorage.setItem(KEY, JSON.stringify(list))
}

export function peekQueue(): QueuedOp[] {
  const raw = localStorage.getItem(KEY)
  return raw ? (JSON.parse(raw) as QueuedOp[]) : []
}

export function clearQueue() {
  localStorage.removeItem(KEY)
}
