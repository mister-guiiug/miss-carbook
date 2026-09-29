/**
 * Les consommations que compte le poste énergie de `calculate_candidate_tco`
 * (migration 20260930120000_tco_energie.sql), relues côté client. L'onglet
 * Budget s'en sert pour dire POURQUOI ce poste vaut 0 ; le montant, lui, vient
 * toujours de la base, qui fait foi.
 *
 * La règle est celle de la fonction, à l'identique :
 * - seul un nombre positif compte, comme dans le formulaire des données
 *   constructeur, qui n'affiche qu'un nombre ;
 * - `consumptionL100` est comptée au prix du carburant ;
 * - `consumptionKwh100` est comptée au prix de l'électricité, et à défaut
 *   `consumptionKwh100Mixed` ;
 * - une hybride rechargeable a les deux.
 */
export type TcoEnergyConsumption = {
  /** L/100 km, au prix du carburant. */
  fuelL100: number | null;
  /** kWh/100 km, au prix de l'électricité. */
  electricityKwh100: number | null;
};

function positiveNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

export function tcoEnergyConsumption(specs: unknown): TcoEnergyConsumption {
  const s =
    specs !== null && typeof specs === 'object' && !Array.isArray(specs)
      ? (specs as Record<string, unknown>)
      : {};
  return {
    fuelL100: positiveNumber(s.consumptionL100),
    electricityKwh100:
      positiveNumber(s.consumptionKwh100) ??
      positiveNumber(s.consumptionKwh100Mixed),
  };
}

export function hasTcoEnergyConsumption(c: TcoEnergyConsumption): boolean {
  return c.fuelL100 !== null || c.electricityKwh100 !== null;
}

/**
 * Les `specs` d'une relation `candidate_specs ( specs )`. Selon la version de
 * PostgREST, elle arrive en objet (relation 1:1) ou en tableau (voir
 * workspaceImportBundle.ts).
 */
export function specsOfRelation(rel: unknown): unknown {
  const row: unknown = Array.isArray(rel) ? rel[0] : rel;
  return row !== null && typeof row === 'object'
    ? (row as { specs?: unknown }).specs
    : undefined;
}
