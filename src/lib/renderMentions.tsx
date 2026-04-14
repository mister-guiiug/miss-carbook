import { Fragment } from 'react'

/** Surligne les segments commençant par @ jusqu’au prochain espace. */
export function renderMentions(body: string) {
  const parts = body.split(/(@\S+)/g)
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <mark key={i} className="mention-mark">
        {p}
      </mark>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    )
  )
}
