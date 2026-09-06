import { z } from 'zod';
import {
  CARBOOK_EXPORT_SIGNATURE,
  CARBOOK_EXPORT_VERSION,
} from './workspaceExportBundle';

/**
 * Lecture d'un bundle ZIP produit par `ExportWorkspaceButton` — le pendant de
 * `workspaceExportBundle.ts`.
 *
 * POURQUOI CE FICHIER EXISTE. L'export écrivait un ZIP que rien ne savait
 * relire : supprimer un dossier était donc définitif, et l'export ne servait
 * qu'à archiver. Le relevé du 06/09/2026 (VALEUR.md, V19) le comptait comme le
 * premier manque de Miss Carbook.
 *
 * CE QUE L'IMPORT NE FAIT PAS. Il n'efface RIEN : il ajoute. Un bundle relu
 * deux fois crée deux jeux de lignes, jamais un écrasement. C'est la seule
 * garantie qui vaille dans un dossier où plusieurs personnes écrivent en même
 * temps : au pire on a des doublons visibles, jamais un travail perdu en
 * silence.
 *
 * CE QUI EST RESTAURÉ. Les exigences, les modèles (avec leur hiérarchie et
 * leurs caractéristiques) et le bloc-notes partagé s'il est encore vide.
 *
 * CE QUI NE L'EST PAS, ET POURQUOI.
 * - Les photos : le ZIP ne contient QUE les métadonnées des pièces jointes
 *   (`meta.txt` le dit). Réinsérer ces lignes fabriquerait des vignettes
 *   pointant vers des fichiers absents du Storage.
 * - Tout ce qui porte l'identité de quelqu'un d'autre — commentaires, avis,
 *   votes, évaluations, notes personnelles, membres, journal d'activité. Ces
 *   lignes référencent des `user_id` qui peuvent ne pas être membres du
 *   dossier cible : la RLS les refuserait, et les attribuer à l'importateur
 *   serait un faux.
 *
 * Ce module est PUR : il ne connaît ni JSZip ni Supabase. Il prend des entrées
 * de texte et rend un plan d'insertion — c'est ce qui le rend testable sans
 * réseau.
 */

/**
 * Versions de bundle que ce lecteur sait interpréter. Celle qu'écrit l'export
 * en fait partie par construction : le jour où elle change, ce tableau doit
 * dire explicitement si l'ancienne reste lisible.
 */
export const SUPPORTED_EXPORT_VERSIONS: readonly number[] = [
  CARBOOK_EXPORT_VERSION,
];

const candidateStatusSchema = z.enum([
  'to_see',
  'tried',
  'shortlist',
  'selected',
  'rejected',
]);

const manufacturerLinkSchema = z.object({
  url: z.string(),
  label: z.string().nullish(),
});

const requirementRowSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullish(),
  level: z.enum(['mandatory', 'discuss']).nullish(),
  weight: z.number().min(0).max(1000).nullish(),
  tags: z.array(z.string()).max(30).nullish(),
  sort_order: z.number().int().nullish(),
});

/**
 * `candidates.json` embarque la relation `candidate_specs ( specs )`. Selon la
 * version de PostgREST elle arrive en objet (relation 1:1) ou en tableau — les
 * deux sont acceptées, l'inverse ferait échouer un export parfaitement valide.
 */
const candidateSpecsRelationSchema = z.union([
  z.object({ specs: z.unknown() }),
  z.array(z.object({ specs: z.unknown() })),
]);

const candidateRowSchema = z.object({
  id: z.string().min(1),
  parent_candidate_id: z.string().nullish(),
  sort_order: z.number().int().nullish(),
  brand: z.string().nullish(),
  model: z.string().nullish(),
  trim: z.string().nullish(),
  engine: z.string().nullish(),
  price: z.number().nullish(),
  mileage_km: z.number().nullish(),
  first_registration: z.string().nullish(),
  gearbox: z.string().nullish(),
  energy: z.string().nullish(),
  options: z.string().nullish(),
  garage_location: z.string().nullish(),
  manufacturer_url: z.string().nullish(),
  manufacturer_links: z.array(manufacturerLinkSchema).nullish(),
  event_date: z.string().nullish(),
  status: candidateStatusSchema.nullish(),
  reject_reason: z.string().nullish(),
  candidate_specs: candidateSpecsRelationSchema.nullish(),
});

const notesRowSchema = z.object({ body: z.string().nullish() });

export type ImportRequirementRow = z.infer<typeof requirementRowSchema>;
export type ImportCandidateRow = z.infer<typeof candidateRowSchema>;

/** Ce que le ZIP contient, une fois lu et validé. */
export type WorkspaceImportBundle = {
  exportVersion: number;
  /** Dossier d'origine, tel qu'écrit dans `meta.txt`. Informatif. */
  sourceWorkspaceId: string | null;
  requirements: ImportRequirementRow[];
  candidates: ImportCandidateRow[];
  notesBody: string;
  /** Pièces jointes présentes dans l'export en métadonnées SEULEMENT. */
  attachmentCount: number;
};

export type WorkspaceImportRejection =
  /** `meta.txt` absent ou ne portant pas la signature : ZIP d'une autre app. */
  | { reason: 'not-a-carbook-export' }
  /** Signature reconnue, numéro de version inconnu de ce lecteur. */
  | { reason: 'unsupported-version'; found: string }
  /** Un fichier attendu manque à l'appel. */
  | { reason: 'missing-entry'; entry: string }
  /** JSON illisible. */
  | { reason: 'invalid-json'; entry: string }
  /** JSON lisible mais de forme inattendue. */
  | { reason: 'invalid-shape'; entry: string; detail: string };

export type WorkspaceImportRead =
  | { ok: true; bundle: WorkspaceImportBundle }
  | ({ ok: false } & WorkspaceImportRejection);

/** Entrées textuelles du ZIP : chemin complet → contenu. */
export type ZipTextEntries = Record<string, string>;

function findEntry(entries: ZipTextEntries, suffix: string): string | null {
  for (const path of Object.keys(entries)) {
    if (path === suffix || path.endsWith(`/${suffix}`)) return path;
  }
  return null;
}

function parseMetaLines(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const eq = raw.indexOf('=');
    if (eq <= 0) continue;
    out[raw.slice(0, eq).trim()] = raw.slice(eq + 1).trim();
  }
  return out;
}

function readJsonEntry(
  entries: ZipTextEntries,
  prefix: string,
  name: string
): { ok: true; value: unknown } | ({ ok: false } & WorkspaceImportRejection) {
  const path = `${prefix}${name}`;
  const raw = entries[path];
  if (raw == null) return { ok: false, reason: 'missing-entry', entry: name };
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, reason: 'invalid-json', entry: name };
  }
}

function describeIssue(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return 'forme inattendue';
  const where = first.path.join('.');
  return where ? `${where} : ${first.message}` : first.message;
}

/**
 * Lit et valide les entrées textuelles d'un ZIP.
 *
 * Le premier verdict rendu est TOUJOURS « est-ce bien un export Miss
 * Carbook ? ». Un ZIP étranger est refusé avant même qu'on ait regardé son
 * contenu : rien n'est lu, rien ne sera écrit.
 */
export function readWorkspaceImportBundle(
  entries: ZipTextEntries
): WorkspaceImportRead {
  const metaPath = findEntry(entries, 'meta.txt');
  if (!metaPath) return { ok: false, reason: 'not-a-carbook-export' };

  const metaText = entries[metaPath] ?? '';
  const firstLine = metaText.split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (firstLine !== CARBOOK_EXPORT_SIGNATURE) {
    return { ok: false, reason: 'not-a-carbook-export' };
  }

  const meta = parseMetaLines(metaText);
  const versionRaw = meta.export_version ?? '';
  const version = Number(versionRaw);
  if (
    !Number.isInteger(version) ||
    !SUPPORTED_EXPORT_VERSIONS.includes(version)
  ) {
    return { ok: false, reason: 'unsupported-version', found: versionRaw };
  }

  // Le ZIP range tout sous un dossier `miss-carbook-xxxxxxxx/` ; on le déduit
  // de l'emplacement de `meta.txt` plutôt que de le deviner.
  const slash = metaPath.lastIndexOf('/');
  const prefix = slash === -1 ? '' : metaPath.slice(0, slash + 1);

  const requirementsJson = readJsonEntry(entries, prefix, 'requirements.json');
  if (!requirementsJson.ok) return requirementsJson;
  const requirements = z
    .array(requirementRowSchema)
    .safeParse(requirementsJson.value);
  if (!requirements.success) {
    return {
      ok: false,
      reason: 'invalid-shape',
      entry: 'requirements.json',
      detail: describeIssue(requirements.error),
    };
  }

  const candidatesJson = readJsonEntry(entries, prefix, 'candidates.json');
  if (!candidatesJson.ok) return candidatesJson;
  const candidates = z
    .array(candidateRowSchema)
    .safeParse(candidatesJson.value);
  if (!candidates.success) {
    return {
      ok: false,
      reason: 'invalid-shape',
      entry: 'candidates.json',
      detail: describeIssue(candidates.error),
    };
  }

  // Bloc-notes et pièces jointes sont facultatifs : un export ancien ou
  // partiel reste importable, il aura simplement moins à restaurer.
  let notesBody = '';
  const notesRaw = entries[`${prefix}notes.json`];
  if (notesRaw != null) {
    try {
      const parsed = notesRowSchema.safeParse(JSON.parse(notesRaw));
      if (parsed.success) notesBody = parsed.data.body ?? '';
    } catch {
      notesBody = '';
    }
  }

  let attachmentCount = 0;
  const attachmentsRaw = entries[`${prefix}attachments.json`];
  if (attachmentsRaw != null) {
    try {
      const parsed: unknown = JSON.parse(attachmentsRaw);
      if (Array.isArray(parsed)) attachmentCount = parsed.length;
    } catch {
      attachmentCount = 0;
    }
  }

  return {
    ok: true,
    bundle: {
      exportVersion: version,
      sourceWorkspaceId: meta.workspace_id ?? null,
      requirements: requirements.data,
      candidates: candidates.data,
      notesBody,
      attachmentCount,
    },
  };
}

export type RequirementInsert = {
  id: string;
  workspace_id: string;
  label: string;
  description: string;
  level: 'mandatory' | 'discuss';
  weight: number | null;
  tags: string[];
  sort_order: number;
};

export type CandidateInsert = {
  id: string;
  workspace_id: string;
  parent_candidate_id: string | null;
  sort_order: number;
  brand: string;
  model: string;
  trim: string;
  engine: string;
  price: number | null;
  mileage_km: number | null;
  first_registration: string;
  gearbox: string;
  energy: string;
  options: string;
  garage_location: string;
  manufacturer_url: string;
  manufacturer_links: { url: string; label: string }[];
  event_date: string | null;
  status: z.infer<typeof candidateStatusSchema>;
  reject_reason: string;
};

export type CandidateSpecInsert = {
  candidate_id: string;
  specs: unknown;
};

export type WorkspaceImportPlan = {
  requirements: RequirementInsert[];
  /** Racines d'abord : `parent_candidate_id` ne référence jamais une ligne à venir. */
  candidates: CandidateInsert[];
  candidateSpecs: CandidateSpecInsert[];
  /** `null` quand le bundle n'a pas de bloc-notes à restaurer. */
  notesBody: string | null;
  /** Compléments dont le parent manquait au bundle : rattachés à la racine. */
  detachedCount: number;
};

function firstSpecs(
  rel: z.infer<typeof candidateSpecsRelationSchema> | null | undefined
): unknown {
  if (rel == null) return null;
  if (Array.isArray(rel)) return rel[0]?.specs ?? null;
  return rel.specs ?? null;
}

function isEmptySpecs(specs: unknown): boolean {
  if (specs == null) return true;
  if (typeof specs !== 'object' || Array.isArray(specs)) return true;
  return Object.keys(specs as Record<string, unknown>).length === 0;
}

/**
 * Traduit un bundle en lignes prêtes à insérer dans le dossier cible.
 *
 * LES IDENTIFIANTS SONT REFRAPPÉS. Réutiliser ceux de l'export interdirait de
 * relire le même ZIP deux fois (clé primaire en double) et, pire, de le relire
 * dans le dossier d'origine. `newId` est injecté pour que le test puisse
 * prédire la sortie.
 */
export function planWorkspaceImport(
  bundle: WorkspaceImportBundle,
  options: {
    workspaceId: string;
    newId: () => string;
    /** Le bloc-notes cible n'est écrasé sous AUCUN prétexte : on ne remplit que le vide. */
    targetNotesBody?: string;
  }
): WorkspaceImportPlan {
  const { workspaceId, newId } = options;

  const requirements: RequirementInsert[] = bundle.requirements.map(
    (r, index) => ({
      id: newId(),
      workspace_id: workspaceId,
      label: r.label,
      description: r.description ?? '',
      level: r.level ?? 'discuss',
      weight: r.weight ?? null,
      tags: r.tags ?? [],
      sort_order: r.sort_order ?? index,
    })
  );

  // Une fiche est soit racine, soit complément d'une RACINE du même dossier
  // (un seul niveau, cf. candidateTree.ts). Un parent absent du bundle, ou
  // lui-même complément, ne peut pas être respecté : la fiche remonte en
  // racine plutôt que de porter une clé étrangère morte.
  const inBundle = new Set(bundle.candidates.map(c => c.id));
  const isRootInBundle = new Map(
    bundle.candidates.map(c => [
      c.id,
      c.parent_candidate_id == null || c.parent_candidate_id === '',
    ])
  );

  const idMap = new Map<string, string>();
  for (const c of bundle.candidates) idMap.set(c.id, newId());

  let detachedCount = 0;
  const ordered = [...bundle.candidates].sort((a, b) => {
    const aRoot = isRootInBundle.get(a.id) ? 0 : 1;
    const bRoot = isRootInBundle.get(b.id) ? 0 : 1;
    return aRoot - bRoot;
  });

  const candidates: CandidateInsert[] = [];
  const candidateSpecs: CandidateSpecInsert[] = [];

  ordered.forEach((c, index) => {
    const id = idMap.get(c.id) as string;
    const rawParent = c.parent_candidate_id ?? null;
    let parent: string | null = null;
    if (rawParent) {
      const keep = inBundle.has(rawParent) && isRootInBundle.get(rawParent);
      if (keep) parent = idMap.get(rawParent) ?? null;
      else detachedCount += 1;
    }

    candidates.push({
      id,
      workspace_id: workspaceId,
      parent_candidate_id: parent,
      sort_order: c.sort_order ?? index,
      brand: c.brand ?? '',
      model: c.model ?? '',
      trim: c.trim ?? '',
      engine: c.engine ?? '',
      price: c.price ?? null,
      mileage_km: c.mileage_km ?? null,
      first_registration: c.first_registration ?? '',
      gearbox: c.gearbox ?? '',
      energy: c.energy ?? '',
      options: c.options ?? '',
      garage_location: c.garage_location ?? '',
      manufacturer_url: c.manufacturer_url ?? '',
      manufacturer_links: (c.manufacturer_links ?? []).map(l => ({
        url: l.url,
        label: l.label ?? '',
      })),
      event_date: c.event_date ?? null,
      status: c.status ?? 'to_see',
      reject_reason: c.reject_reason ?? '',
    });

    const specs = firstSpecs(c.candidate_specs);
    if (!isEmptySpecs(specs)) candidateSpecs.push({ candidate_id: id, specs });
  });

  const target = (options.targetNotesBody ?? '').trim();
  const incoming = bundle.notesBody.trim();
  const notesBody = target === '' && incoming !== '' ? bundle.notesBody : null;

  return {
    requirements,
    candidates,
    candidateSpecs,
    notesBody,
    detachedCount,
  };
}
