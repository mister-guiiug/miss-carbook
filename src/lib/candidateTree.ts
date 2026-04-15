/**
 * Logique métier : hiérarchie racine ↔ compléments (variations).
 * Aligné sur la contrainte SQL : un seul niveau — le parent doit être une racine
 * (parent_candidate_id IS NULL sur le parent), même workspace, id ≠ parent.
 */

/** Ligne minimale pour le graphe parent / fils (tri, requêtes). */
export type CandidateTreeRow = {
  id: string
  parent_candidate_id: string | null
  sort_order: number
  trim: string
  brand: string
  model: string
  event_date?: string | null
}

export const CANDIDATE_HIERARCHY_HELP_FR =
  'Règles : une fiche est soit racine (sans parent), soit complément d’une racine du même dossier. Il n’existe qu’un seul niveau : pas de complément d’un complément. La marque, le modèle et la période du racine s’appliquent à tous ses compléments.'

export function isRootCandidate(c: Pick<CandidateTreeRow, 'parent_candidate_id'>): boolean {
  return c.parent_candidate_id == null || c.parent_candidate_id === ''
}

/** Complément dont le parent référencé n’est pas dans l’ensemble chargé (ex. parent supprimé côté serveur, incohérence). */
export function isOrphanVariation(
  c: Pick<CandidateTreeRow, 'parent_candidate_id'>,
  all: Pick<CandidateTreeRow, 'id'>[]
): boolean {
  if (isRootCandidate(c)) return false
  const pid = c.parent_candidate_id as string
  return !all.some((x) => x.id === pid)
}

export function compareCandidatesSiblingOrder(a: CandidateTreeRow, b: CandidateTreeRow): number {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
  return (a.trim ?? '').localeCompare(b.trim ?? '', 'fr-FR')
}

export function listRootCandidates<T extends CandidateTreeRow>(candidates: T[]): T[] {
  return candidates.filter((c) => isRootCandidate(c)).sort(compareCandidatesSiblingOrder)
}

export function listChildrenOf<T extends CandidateTreeRow>(parentId: string, candidates: T[]): T[] {
  return candidates
    .filter((c) => c.parent_candidate_id === parentId)
    .sort(compareCandidatesSiblingOrder)
}

export function listOrphanVariations<T extends CandidateTreeRow>(candidates: T[]): T[] {
  return candidates.filter((c) => isOrphanVariation(c, candidates)).sort(compareCandidatesSiblingOrder)
}

export function countVariationsForRoot(rootId: string, candidates: CandidateTreeRow[]): number {
  return candidates.filter((c) => c.parent_candidate_id === rootId).length
}

/**
 * Racines éligibles comme parent dans un sélecteur pour une fiche donnée
 * (on exclut la fiche elle-même si c’est une racine — ne peut pas être son propre parent).
 */
export function eligibleRootParentsForSelect<T extends CandidateTreeRow>(
  candidateId: string,
  roots: T[]
): T[] {
  return roots.filter((r) => r.id !== candidateId)
}

export type ParentAssignmentValidation =
  | { ok: true }
  | { ok: false; message: string }

/** Contrôles UI alignés sur le trigger Postgres `candidates_enforce_parent`. */
export function validateParentAssignment(
  candidateId: string,
  nextParentId: string | null,
  candidates: CandidateTreeRow[]
): ParentAssignmentValidation {
  if (nextParentId === candidateId) {
    return { ok: false, message: 'Une fiche ne peut pas être son propre parent.' }
  }
  if (!nextParentId) return { ok: true }

  const parent = candidates.find((c) => c.id === nextParentId)
  if (!parent) {
    return { ok: false, message: 'Modèle racine introuvable.' }
  }
  if (!isRootCandidate(parent)) {
    return {
      ok: false,
      message: 'Le parent doit être une racine (pas un complément).',
    }
  }
  const self = candidates.find((c) => c.id === candidateId)
  if (self && isRootCandidate(self) && countVariationsForRoot(candidateId, candidates) > 0) {
    return {
      ok: false,
      message:
        'Ce modèle a des compléments : vous ne pouvez pas le rattacher à une autre racine tant qu’ils existent. Supprimez ou déplacez les compléments d’abord.',
    }
  }
  return { ok: true }
}

/**
 * Même règles que `validateParentAssignment` pour une fiche dont on connaît déjà
 * le nombre de compléments directs (évite de passer tout le tableau dans le détail).
 */
export function validateParentChange(
  candidateId: string,
  nextParentId: string | null,
  opts: { isRoot: boolean; directVariationCount: number }
): ParentAssignmentValidation {
  if (nextParentId === candidateId) {
    return { ok: false, message: 'Une fiche ne peut pas être son propre parent.' }
  }
  if (!nextParentId) return { ok: true }
  if (opts.isRoot && opts.directVariationCount > 0) {
    return {
      ok: false,
      message:
        'Ce modèle a des compléments : vous ne pouvez pas le rattacher à une autre racine tant qu’ils existent. Supprimez ou déplacez les compléments d’abord.',
    }
  }
  return { ok: true }
}

/**
 * Champs identité / période à persister après changement de parent :
 * en complément, marque · modèle · période viennent toujours du racine choisi.
 */
export function resolveIdentityForCandidateUpdate(opts: {
  nextParentId: string | null
  meta: { brand: string; model: string; event_date: string | null | undefined }
  rootCandidates: CandidateTreeRow[]
}): { brand: string; model: string; event_date: string | null } {
  if (!opts.nextParentId) {
    return {
      brand: opts.meta.brand,
      model: opts.meta.model,
      event_date: opts.meta.event_date?.trim() ? String(opts.meta.event_date).trim() : null,
    }
  }
  const p = opts.rootCandidates.find((r) => r.id === opts.nextParentId)
  if (!p) {
    return {
      brand: opts.meta.brand,
      model: opts.meta.model,
      event_date: opts.meta.event_date?.trim() ? String(opts.meta.event_date).trim() : null,
    }
  }
  return {
    brand: p.brand,
    model: p.model,
    event_date: p.event_date?.trim() ? String(p.event_date).trim() : null,
  }
}

/** Suppression post-ordre : descendants d’abord, puis la cible (sécurise même si la donnée contient plusieurs niveaux). */
export function postOrderDeleteIds<T extends CandidateTreeRow>(target: T, all: T[]): string[] {
  const children = all
    .filter((x) => x.parent_candidate_id === target.id)
    .sort(compareCandidatesSiblingOrder)
  const out: string[] = []
  for (const ch of children) {
    out.push(...postOrderDeleteIds(ch, all))
  }
  out.push(target.id)
  return out
}
