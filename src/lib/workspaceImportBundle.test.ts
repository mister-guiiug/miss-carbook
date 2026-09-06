import { describe, expect, it } from 'vitest';
import { buildExportMetaText } from './workspaceExportBundle';
import {
  planWorkspaceImport,
  readWorkspaceImportBundle,
  type ZipTextEntries,
} from './workspaceImportBundle';

/**
 * Ce que ces tests prouvent, dans l'ordre où ça compte :
 *
 * 1. L'import REFUSE un ZIP qui n'est pas un export Miss Carbook, et le refuse
 *    avant d'avoir lu quoi que ce soit — donc sans jamais rien pouvoir écrire.
 * 2. L'aller-retour tient : le `meta.txt` que l'export ÉCRIT (même fonction,
 *    pas une copie de sa forme) est celui que l'import SAIT LIRE. C'est le
 *    seul test qui échouerait si quelqu'un renommait la signature d'un côté.
 * 3. La hiérarchie des modèles survit à la refrappe des identifiants, et un
 *    complément orphelin remonte en racine au lieu de porter une clé morte.
 * 4. Le bloc-notes du dossier cible n'est jamais écrasé.
 */

const WS = '3f1c9c62-0000-4000-8000-000000000001';

/** Un ZIP conforme, monté autour du vrai `meta.txt` de l'export. */
function bundleEntries(files: Record<string, unknown>): ZipTextEntries {
  const prefix = 'miss-carbook-3f1c9c62/';
  const entries: ZipTextEntries = {
    [`${prefix}meta.txt`]: buildExportMetaText(WS, '2026-09-06T10:00:00.000Z'),
  };
  for (const [name, value] of Object.entries(files)) {
    entries[`${prefix}${name}.json`] = JSON.stringify(value, null, 2);
  }
  return entries;
}

function candidate(over: Record<string, unknown> = {}) {
  return {
    id: 'c-root',
    workspace_id: WS,
    parent_candidate_id: null,
    sort_order: 0,
    brand: 'Dacia',
    model: 'Jogger',
    trim: '',
    engine: 'Hybrid 140',
    price: 24500,
    mileage_km: null,
    first_registration: '',
    gearbox: 'auto',
    energy: 'hybride',
    options: '',
    garage_location: '',
    manufacturer_url: '',
    manufacturer_links: [],
    event_date: null,
    status: 'to_see',
    reject_reason: '',
    created_at: '2026-05-01T08:00:00Z',
    updated_at: '2026-05-01T08:00:00Z',
    candidate_specs: null,
    ...over,
  };
}

function requirement(over: Record<string, unknown> = {}) {
  return {
    id: 'r-1',
    workspace_id: WS,
    label: 'Sept places',
    description: 'Trois enfants et un chien.',
    level: 'mandatory',
    weight: 40,
    tags: ['famille'],
    sort_order: 0,
    created_at: '2026-05-01T08:00:00Z',
    ...over,
  };
}

/** Compteur déterministe : le test peut prédire chaque identifiant produit. */
function counterIds() {
  let n = 0;
  return () => `new-${++n}`;
}

describe('readWorkspaceImportBundle — ce qui est refusé', () => {
  it('refuse un ZIP sans meta.txt (archive quelconque)', () => {
    const read = readWorkspaceImportBundle({
      'photos/img.json': '[]',
      'README.txt': 'rien à voir',
    });
    expect(read).toEqual({ ok: false, reason: 'not-a-carbook-export' });
  });

  it("refuse un ZIP dont le meta.txt vient d'une autre application", () => {
    const read = readWorkspaceImportBundle({
      'export/meta.txt': 'Export Mister Footcoach\nexport_version=2\n',
      'export/candidates.json': '[]',
      'export/requirements.json': '[]',
    });
    expect(read).toEqual({ ok: false, reason: 'not-a-carbook-export' });
  });

  it('refuse une version de bundle inconnue, en la nommant', () => {
    const entries = bundleEntries({ requirements: [], candidates: [] });
    const metaKey = Object.keys(entries).find(k => k.endsWith('meta.txt'));
    entries[metaKey as string] = (entries[metaKey as string] as string).replace(
      'export_version=2',
      'export_version=99'
    );
    expect(readWorkspaceImportBundle(entries)).toEqual({
      ok: false,
      reason: 'unsupported-version',
      found: '99',
    });
  });

  it('refuse un bundle amputé de candidates.json', () => {
    const read = readWorkspaceImportBundle(bundleEntries({ requirements: [] }));
    expect(read).toEqual({
      ok: false,
      reason: 'missing-entry',
      entry: 'candidates.json',
    });
  });

  it('refuse un JSON illisible en nommant le fichier fautif', () => {
    const entries = bundleEntries({ requirements: [], candidates: [] });
    entries['miss-carbook-3f1c9c62/candidates.json'] = '{ pas du json';
    expect(readWorkspaceImportBundle(entries)).toEqual({
      ok: false,
      reason: 'invalid-json',
      entry: 'candidates.json',
    });
  });

  it('refuse une exigence sans libellé, et dit où', () => {
    const read = readWorkspaceImportBundle(
      bundleEntries({
        requirements: [requirement({ label: '   ' })],
        candidates: [],
      })
    );
    expect(read.ok).toBe(false);
    if (read.ok) return;
    expect(read.reason).toBe('invalid-shape');
    if (read.reason !== 'invalid-shape') return;
    expect(read.entry).toBe('requirements.json');
    expect(read.detail).toContain('0.label');
  });
});

describe("readWorkspaceImportBundle — l'aller-retour", () => {
  it("relit le meta.txt que l'export écrit vraiment", () => {
    const read = readWorkspaceImportBundle(
      bundleEntries({
        requirements: [requirement()],
        candidates: [candidate()],
        attachments: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
        notes: { body: 'Rendez-vous samedi.' },
      })
    );
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.bundle.exportVersion).toBe(2);
    expect(read.bundle.sourceWorkspaceId).toBe(WS);
    expect(read.bundle.requirements).toHaveLength(1);
    expect(read.bundle.candidates).toHaveLength(1);
    // Les photos sont comptées pour être ANNONCÉES comme non restaurables :
    // le ZIP n'en contient que les métadonnées.
    expect(read.bundle.attachmentCount).toBe(3);
    expect(read.bundle.notesBody).toBe('Rendez-vous samedi.');
  });

  it('accepte un ZIP sans dossier racine et sans fichiers facultatifs', () => {
    const read = readWorkspaceImportBundle({
      'meta.txt': buildExportMetaText(WS, '2026-09-06T10:00:00.000Z'),
      'requirements.json': '[]',
      'candidates.json': JSON.stringify([candidate()]),
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.bundle.attachmentCount).toBe(0);
    expect(read.bundle.notesBody).toBe('');
  });

  it('accepte la relation candidate_specs en objet comme en tableau', () => {
    const asObject = readWorkspaceImportBundle(
      bundleEntries({
        requirements: [],
        candidates: [candidate({ candidate_specs: { specs: { doors: 5 } } })],
      })
    );
    const asArray = readWorkspaceImportBundle(
      bundleEntries({
        requirements: [],
        candidates: [candidate({ candidate_specs: [{ specs: { doors: 5 } }] })],
      })
    );
    expect(asObject.ok).toBe(true);
    expect(asArray.ok).toBe(true);
  });
});

describe('planWorkspaceImport', () => {
  function plan(files: Record<string, unknown>, targetNotesBody?: string) {
    const read = readWorkspaceImportBundle(bundleEntries(files));
    if (!read.ok) throw new Error(`bundle refusé : ${read.reason}`);
    return planWorkspaceImport(read.bundle, {
      workspaceId: 'cible-42',
      newId: counterIds(),
      targetNotesBody,
    });
  }

  it('refrappe les identifiants et vise le dossier cible', () => {
    const p = plan({
      requirements: [requirement()],
      candidates: [candidate()],
    });
    expect(p.requirements[0]?.id).not.toBe('r-1');
    expect(p.candidates[0]?.id).not.toBe('c-root');
    expect(p.requirements[0]?.workspace_id).toBe('cible-42');
    expect(p.candidates[0]?.workspace_id).toBe('cible-42');
    // Aucune colonne serveur ne part avec l'insertion.
    expect(p.candidates[0]).not.toHaveProperty('created_at');
    expect(p.candidates[0]).not.toHaveProperty('candidate_specs');
  });

  it('conserve la hiérarchie malgré la refrappe, racines en premier', () => {
    const p = plan({
      requirements: [],
      candidates: [
        candidate({
          id: 'c-child',
          parent_candidate_id: 'c-root',
          trim: 'GPL',
        }),
        candidate({ id: 'c-root' }),
      ],
    });
    expect(p.candidates).toHaveLength(2);
    const root = p.candidates[0];
    const child = p.candidates[1];
    expect(root?.parent_candidate_id).toBeNull();
    // Le fils pointe vers le NOUVEL identifiant du père, jamais l'ancien.
    expect(child?.parent_candidate_id).toBe(root?.id);
    expect(child?.parent_candidate_id).not.toBe('c-root');
    expect(p.detachedCount).toBe(0);
  });

  it('remonte en racine un complément dont le parent manque au bundle', () => {
    const p = plan({
      requirements: [],
      candidates: [
        candidate({ id: 'c-child', parent_candidate_id: 'c-absent' }),
      ],
    });
    expect(p.candidates[0]?.parent_candidate_id).toBeNull();
    expect(p.detachedCount).toBe(1);
  });

  it('refuse un deuxième niveau de hiérarchie (règle SQL : un seul niveau)', () => {
    const p = plan({
      requirements: [],
      candidates: [
        candidate({ id: 'c-root', trim: 'racine' }),
        candidate({
          id: 'c-child',
          parent_candidate_id: 'c-root',
          trim: 'complément',
        }),
        candidate({
          id: 'c-grand',
          parent_candidate_id: 'c-child',
          trim: 'petit-fils',
        }),
      ],
    });
    const root = p.candidates.find(c => c.trim === 'racine');
    const child = p.candidates.find(c => c.trim === 'complément');
    const grand = p.candidates.find(c => c.trim === 'petit-fils');
    expect(child?.parent_candidate_id).toBe(root?.id);
    // Le petit-fils ne peut pas rester sous un complément : il remonte.
    expect(grand?.parent_candidate_id).toBeNull();
    expect(p.detachedCount).toBe(1);
  });

  it('sépare les caractéristiques du modèle, et ignore les specs vides', () => {
    const p = plan({
      requirements: [],
      candidates: [
        candidate({ id: 'a', candidate_specs: { specs: { doors: 5 } } }),
        candidate({ id: 'b', candidate_specs: { specs: {} } }),
        candidate({ id: 'c', candidate_specs: null }),
      ],
    });
    expect(p.candidateSpecs).toHaveLength(1);
    expect(p.candidateSpecs[0]?.specs).toEqual({ doors: 5 });
    // La ligne de specs porte le NOUVEL identifiant de sa fiche.
    const ids = p.candidates.map(c => c.id);
    expect(ids).toContain(p.candidateSpecs[0]?.candidate_id);
  });

  it("remplit le bloc-notes cible s'il est vide", () => {
    const p = plan({
      requirements: [],
      candidates: [],
      notes: { body: 'Voir le garage de Riom.' },
    });
    expect(p.notesBody).toBe('Voir le garage de Riom.');
  });

  it("n'écrase JAMAIS un bloc-notes cible déjà écrit", () => {
    const p = plan(
      {
        requirements: [],
        candidates: [],
        notes: { body: 'Voir le garage de Riom.' },
      },
      'Ce que quelqu’un a déjà écrit ici.'
    );
    expect(p.notesBody).toBeNull();
  });

  it('applique les valeurs par défaut du schéma aux champs absents', () => {
    const p = plan({
      requirements: [{ id: 'r', label: 'Coffre de 500 L' }],
      candidates: [{ id: 'c' }],
    });
    expect(p.requirements[0]).toMatchObject({
      description: '',
      level: 'discuss',
      weight: null,
      tags: [],
      sort_order: 0,
    });
    expect(p.candidates[0]).toMatchObject({
      brand: '',
      status: 'to_see',
      manufacturer_links: [],
      price: null,
    });
  });
});
