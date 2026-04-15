import { formatCandidateListLabel } from './candidateLabel'
import type { WorkspaceExportBundle } from './workspaceExportBundle'

const REQ_LEVEL: Record<string, string> = {
  mandatory: 'Obligatoire',
  discuss: 'À discuter',
}

const CAND_STATUS: Record<string, string> = {
  to_see: 'À voir',
  tried: 'Essayé',
  shortlist: 'Shortlist',
  selected: 'Retenu',
  rejected: 'Rejeté',
}

const EVAL_STATUS: Record<string, string> = {
  unknown: 'Non renseigné',
  ok: 'Satisfait',
  partial: 'Partiellement',
  ko: 'Non satisfait',
}

const VOTE_L: Record<string, string> = {
  must: 'Must (indispensable)',
  should: 'Should (souhaitable)',
  could: 'Could (acceptable)',
  wont: "Won't (hors périmètre)",
}

function esc(s: unknown): string {
  if (s == null) return ''
  const t = String(s).replace(/\r\n/g, '\n').trim()
  return t.replace(/^#/gm, '\\#')
}

function isoDate(s: unknown): string {
  if (s == null || s === '') return ''
  try {
    return new Date(String(s)).toLocaleString('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return String(s)
  }
}

function userLabel(
  profileNames: Record<string, string>,
  userId: string | null | undefined
): string {
  if (!userId) return '—'
  return profileNames[userId] ?? `Utilisateur ${userId.slice(0, 8)}…`
}

type CandRow = {
  id: string
  parent_candidate_id: string | null
  brand: string
  model: string
  trim: string
  engine: string
  price: number | null
  options: string
  garage_location: string
  manufacturer_url: string
  event_date: string | null
  status: string
  reject_reason: string
  candidate_specs?: { specs: unknown } | null
}

type ReqRow = {
  id: string
  label: string
  description: string
  level: string
  weight: number | null
  tags: string[]
}

/** Markdown structuré pour alimenter un assistant (ChatGPT, Claude, etc.). */
export function buildWorkspacePromptMarkdown(bundle: WorkspaceExportBundle): string {
  const { profileNames } = bundle
  const ws = bundle.workspace
  const name = esc(ws?.name ?? 'Dossier sans nom')
  const generated = new Date().toISOString()

  const lines: string[] = []
  const push = (...xs: string[]) => lines.push(...xs)

  push(
    `# Contexte dossier véhicule — ${name}`,
    '',
    '> **Export Miss Carbook (mode prompt)** — généré le ' +
      isoDate(generated) +
      ' (UTC : ' +
      generated +
      ').',
    '> Les jetons d’invitation, codes de partage et chemins Storage exacts sont **volontairement omis** pour limiter les fuites si vous collez ce texte dans un service tiers.',
    '',
    '## Rôle suggéré pour l’assistant',
    '',
    'Tu t’appuies sur les sections suivantes pour aider un groupe à **comparer des véhicules**, prioriser des **exigences**, résumer l’état du dossier, proposer des **questions de clarification** ou une **checklist** avant achat. Tu ne remplaces pas un professionnel (mécanique, finance, assurance). Tu cites les faits tels qu’ils figurent dans le document ; en cas d’ambiguïté, tu le signales.',
    '',
    '---',
    '',
    '## Synthèse du dossier',
    ''
  )

  const cands = bundle.candidates as CandRow[]
  const candById = new Map(cands.map((c) => [c.id, c]))

  if (ws) {
    const w = { ...ws }
    delete w.share_code
    delete w.created_by
    push(
      `- **Nom** : ${esc(w.name)}`,
      `- **Description** : ${esc(w.description) || '_(vide)_'}`,
      `- **Dossier actif** : ${w.is_active === false ? 'non' : 'oui'}`,
      `- **Remplacement** (véhicule actuel renseigné dans l’app) : ${w.replacement_enabled ? 'oui' : 'non'}`
    )
    const sel = w.selected_candidate_id as string | null | undefined
    if (sel) {
      const selCand = candById.get(sel)
      const selLabel = selCand
        ? formatCandidateListLabel(selCand)
        : `référence interne ${sel.slice(0, 8)}…`
      push(
        `- **Modèle retenu (décision)** : ${esc(selLabel)}`,
        `- **Notes de décision** : ${esc(w.decision_notes) || '_(aucune)_'}`,
        `- **Date de décision** : ${isoDate(w.decision_at)}`
      )
    } else {
      push(
        `- **Décision** : aucun modèle officiellement retenu pour l’instant.`,
        `- **Brouillon / notes** : ${esc(w.decision_notes) || '_(aucune)_'}`
      )
    }
  } else {
    push('_(Impossible de lire les métadonnées du dossier.)_')
  }

  push('', '---', '', '## Membres', '')
  const members = bundle.members as { user_id: string; role: string; joined_at?: string }[]
  if (!members.length) {
    push('_(Aucun membre listé.)_')
  } else {
    for (const m of members) {
      push(
        `- **${esc(userLabel(profileNames, m.user_id))}** — rôle : \`${esc(m.role)}\` — depuis ${isoDate(m.joined_at)}`
      )
    }
  }

  const cv = bundle.currentVehicle
  if (cv && Object.keys(cv).length) {
    push('', '---', '', '## Véhicule actuel (remplacement)', '')
    push(
      `- ${esc(cv.brand)} ${esc(cv.model)} — ${esc(cv.engine)} — année : ${cv.year != null ? esc(cv.year) : '—'}`,
      `- Options / remarques : ${esc(cv.options) || '_(vide)_'}`
    )
    const specs = cv.specs
    if (specs != null && typeof specs === 'object' && !Array.isArray(specs)) {
      const s = specs as Record<string, unknown>
      const door = s.doorCount
      const hp = s.powerHp
      const fiscal = s.fiscalCv
      const box = s.gearbox
      const col = s.exteriorColor
      const trunk = s.trunkLiters
      if (door != null && door !== '') push(`- **Nombre de portes** : ${esc(door)}`)
      if (hp != null && hp !== '') push(`- **Puissance (ch)** : ${esc(hp)}`)
      if (fiscal != null && fiscal !== '') push(`- **Puissance fiscale (CV)** : ${esc(fiscal)}`)
      if (trunk != null && trunk !== '') push(`- **Volume du coffre (L)** : ${esc(trunk)}`)
      if (box != null && String(box).trim() !== '') push(`- **Boîte de vitesses** : ${esc(box)}`)
      if (col != null && String(col).trim() !== '') push(`- **Couleur extérieure** : ${esc(col)}`)
      const known = new Set([
        'doorCount',
        'powerHp',
        'fiscalCv',
        'trunkLiters',
        'gearbox',
        'exteriorColor',
      ])
      const rest = Object.fromEntries(
        Object.entries(s).filter(([k, v]) => !known.has(k) && v != null && v !== '')
      )
      if (Object.keys(rest).length) {
        push(
          '',
          '**Autres données techniques (JSON)** :',
          '',
          '```json',
          JSON.stringify(rest, null, 2),
          '```'
        )
      }
    }
  }

  push('', '---', '', '## Exigences', '')
  const reqs = bundle.requirements as ReqRow[]
  if (!reqs.length) {
    push('_(Aucune exigence.)_')
  } else {
    const sorted = [...reqs].sort((a, b) => (a.label || '').localeCompare(b.label || ''))
    for (const r of sorted) {
      const lvl = REQ_LEVEL[r.level] ?? r.level
      const tags = r.tags?.length ? r.tags.join(', ') : ''
      push(
        `### ${esc(r.label)}`,
        '',
        `- **Niveau** : ${lvl}`,
        `- **Poids** : ${r.weight != null ? esc(r.weight) : '_(non défini)_'}`,
        `- **Tags** : ${tags || '_(aucun)_'}`,
        `- **Description** : ${esc(r.description) || '_(vide)_'}`,
        ''
      )
    }
  }

  push('---', '', '## Modèles candidats', '')
  if (!cands.length) {
    push('_(Aucun modèle.)_')
  } else {
    for (const c of cands) {
      const label = formatCandidateListLabel(c)
      const st = CAND_STATUS[c.status] ?? c.status
      push(
        `### ${esc(label)}`,
        '',
        `- **Statut** : ${st}`,
        `- **Motorisation** : ${esc(c.engine) || '—'}`,
        `- **Prix (€)** : ${c.price != null ? esc(c.price) : '—'}`,
        `- **Lieu / garage** : ${esc(c.garage_location) || '—'}`,
        `- **Lien constructeur** : ${esc(c.manufacturer_url) || '—'}`,
        `- **Année / période** : ${esc(c.event_date) || '—'}`,
        `- **Options** : ${esc(c.options) || '_(vide)_'}`,
        `- **Motif si rejet** : ${esc(c.reject_reason) || '—'}`,
        ''
      )
      const specs = c.candidate_specs?.specs
      if (specs != null && typeof specs === 'object' && Object.keys(specs as object).length) {
        push(
          '**Données constructeur (extrait JSON)** :',
          '',
          '```json',
          JSON.stringify(specs, null, 2),
          '```',
          ''
        )
      }
    }
  }

  push('---', '', '## Matrice exigence × modèle (satisfaction)', '')
  const evals = bundle.evaluations as {
    requirement_id: string
    candidate_id: string
    status: string
    note: string
  }[]
  if (!evals.length) {
    push('_(Aucune cellule de matrice renseignée.)_')
  } else {
    const reqMap = new Map(reqs.map((r) => [r.id, r.label]))
    for (const e of evals) {
      const rl = esc(reqMap.get(e.requirement_id) ?? e.requirement_id)
      const cl = esc(
        formatCandidateListLabel(
          candById.get(e.candidate_id) ?? {
            brand: '?',
            model: e.candidate_id.slice(0, 8),
            trim: '',
            parent_candidate_id: null,
          }
        )
      )
      const st = EVAL_STATUS[e.status] ?? e.status
      push(`- **${rl}** × **${cl}** → ${st}${e.note ? ` — _${esc(e.note)}_` : ''}`)
    }
  }

  push('', '---', '', '## Votes de priorité (MoSCoW) par exigence', '')
  const votes = bundle.votes as { requirement_id: string; user_id: string; vote: string }[]
  if (!votes.length) {
    push('_(Aucun vote.)_')
  } else {
    const reqMap = new Map(reqs.map((r) => [r.id, r.label]))
    const grouped = new Map<string, typeof votes>()
    for (const v of votes) {
      if (!grouped.has(v.requirement_id)) grouped.set(v.requirement_id, [])
      grouped.get(v.requirement_id)!.push(v)
    }
    for (const [rid, list] of grouped) {
      push(`### ${esc(reqMap.get(rid) ?? rid)}`, '')
      for (const v of list) {
        const vl = VOTE_L[v.vote] ?? v.vote
        push(`- ${esc(userLabel(profileNames, v.user_id))} : ${vl}`)
      }
      push('')
    }
  }

  push('---', '', '## Avis chiffrés sur les modèles', '')
  const reviews = bundle.reviews as {
    candidate_id: string
    user_id: string
    score: number
    free_text: string
    pros: string
    cons: string
  }[]
  if (!reviews.length) {
    push('_(Aucun avis.)_')
  } else {
    for (const rv of reviews) {
      const c = candById.get(rv.candidate_id)
      const cl = c ? formatCandidateListLabel(c) : rv.candidate_id
      push(
        `### ${esc(cl)} — ${esc(userLabel(profileNames, rv.user_id))}`,
        '',
        `- **Note** : ${esc(rv.score)} / 10`,
        `- **Commentaire** : ${esc(rv.free_text) || '—'}`,
        `- **Points forts** : ${esc(rv.pros) || '—'}`,
        `- **Points faibles** : ${esc(rv.cons) || '—'}`,
        ''
      )
    }
  }

  push('---', '', '## Commentaires', '')
  const comments = bundle.comments as {
    candidate_id: string
    user_id: string
    body: string
    created_at: string
  }[]
  if (!comments.length) {
    push('_(Aucun commentaire.)_')
  } else {
    const sorted = [...comments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    for (const cm of sorted) {
      const c = candById.get(cm.candidate_id)
      const cl = c ? formatCandidateListLabel(c) : cm.candidate_id
      push(
        `- **${esc(cl)}** — ${esc(userLabel(profileNames, cm.user_id))} — ${isoDate(cm.created_at)}`,
        `  ${esc(cm.body).replace(/\n/g, '\n  ') || '_(vide)_'}`
      )
    }
  }

  push('', '---', '', '## Bloc-notes partagé', '')
  const note = bundle.notes
  if (note?.body != null && String(note.body).trim()) {
    push(esc(String(note.body)))
  } else {
    push('_(Bloc-notes vide ou absent.)_')
  }

  push('', '---', '', '## Rappels', '')
  const reminders = bundle.reminders as {
    title: string
    body: string
    due_at: string | null
    done: boolean
    candidate_id: string | null
  }[]
  if (!reminders.length) {
    push('_(Aucun rappel.)_')
  } else {
    for (const r of reminders) {
      const link = r.candidate_id
        ? formatCandidateListLabel(
            candById.get(r.candidate_id) ?? {
              brand: '?',
              model: r.candidate_id.slice(0, 8),
              trim: '',
              parent_candidate_id: null,
            }
          )
        : null
      push(
        `- **${esc(r.title)}** ${r.done ? '_(fait)_' : ''}`,
        `  - Échéance : ${isoDate(r.due_at) || '—'}`,
        `  - Détail : ${esc(r.body) || '—'}`,
        link ? `  - Lié au modèle : ${esc(link)}` : ''
      )
    }
  }

  push('', '---', '', '## Profils de critères (comparaison)', '')
  const presets = bundle.presets as { name: string; criteria_keys: unknown }[]
  if (!presets.length) {
    push('_(Aucun profil enregistré.)_')
  } else {
    for (const p of presets) {
      push(`- **${esc(p.name)}** : \`${esc(JSON.stringify(p.criteria_keys))}\``)
    }
  }

  push('', '---', '', '## Pièces jointes (métadonnées)', '')
  const atts = bundle.attachments as {
    candidate_id: string | null
    mime_type: string
    size_bytes: number
  }[]
  if (!atts.length) {
    push('_(Aucune pièce jointe.)_')
  } else {
    push(`_${atts.length} fichier(s) — pas de contenu binaire dans cet export._`, '')
    for (const a of atts) {
      const c = a.candidate_id ? candById.get(a.candidate_id) : null
      const cl = c ? formatCandidateListLabel(c) : 'dossier'
      push(`- **${esc(cl)}** — type ${esc(a.mime_type)} — ${esc(a.size_bytes)} octets`)
    }
  }

  push('', '---', '', '## Journal d’activité (extrait)', '')
  const acts = bundle.activityLog as {
    user_id: string | null
    action_type: string
    entity_type: string
    metadata: unknown
    created_at: string
  }[]
  const actSlice = acts.slice(0, 120)
  if (!actSlice.length) {
    push('_(Aucune entrée.)_')
  } else {
    for (const a of actSlice) {
      const meta =
        a.metadata != null &&
        typeof a.metadata === 'object' &&
        Object.keys(a.metadata as object).length
          ? JSON.stringify(a.metadata)
          : '{}'
      push(
        `- ${isoDate(a.created_at)} — **${esc(a.action_type)}** / _${esc(a.entity_type)}_ — ${esc(userLabel(profileNames, a.user_id))}`,
        `  - métadonnées : \`${esc(meta)}\``
      )
    }
    if (acts.length > actSlice.length) {
      push('', `_(… ${acts.length - actSlice.length} entrée(s) supplémentaires non affichées.)_`)
    }
  }

  push('', '---', '', '## Invitations (sans jetons)', '')
  const invs = bundle.invites as {
    role: string
    expires_at: string
    used_at: string | null
  }[]
  if (!invs.length) {
    push('_(Aucune invitation gérée par l’app.)_')
  } else {
    for (const inv of invs) {
      push(
        `- Rôle \`${esc(inv.role)}\` — expiration ${isoDate(inv.expires_at)} — ${inv.used_at ? 'utilisée' : 'non utilisée'}`
      )
    }
  }

  push('', '---', '')
  push('## Fin du contexte', '')
  push(
    '_Tu peux maintenant répondre aux questions du groupe en t’appuyant sur les informations ci-dessus lorsque c’est pertinent._'
  )
  return lines.join('\n')
}
