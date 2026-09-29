import { describe, expect, it } from 'vitest';
import {
  hasTcoEnergyConsumption,
  specsOfRelation,
  tcoEnergyConsumption,
} from './tcoEnergy';

/**
 * La même règle que `calculate_candidate_tco` : les cas de
 * supabase/tests/tco_energie.test.sql, lus côté client.
 */
describe('tcoEnergyConsumption', () => {
  it('lit les litres aux 100 km (essence, diesel, hybride simple)', () => {
    expect(tcoEnergyConsumption({ consumptionL100: 6 })).toEqual({
      fuelL100: 6,
      electricityKwh100: null,
    });
  });

  it('lit les kWh aux 100 km (électrique)', () => {
    expect(tcoEnergyConsumption({ consumptionKwh100: 16 })).toEqual({
      fuelL100: null,
      electricityKwh100: 16,
    });
  });

  it('prend la consommation électrique mixte à défaut de l’autre', () => {
    expect(tcoEnergyConsumption({ consumptionKwh100Mixed: 15 })).toEqual({
      fuelL100: null,
      electricityKwh100: 15,
    });
    expect(
      tcoEnergyConsumption({ consumptionKwh100: 0, consumptionKwh100Mixed: 15 })
        .electricityKwh100
    ).toBe(15);
  });

  it('garde les deux énergies d’une hybride rechargeable, et ignore alors la mixte', () => {
    expect(
      tcoEnergyConsumption({
        consumptionL100: 1.5,
        consumptionKwh100: 15,
        consumptionKwh100Mixed: 99,
      })
    ).toEqual({ fuelL100: 1.5, electricityKwh100: 15 });
  });

  it('ignore ce qui n’est pas un nombre positif, comme le formulaire', () => {
    const none = { fuelL100: null, electricityKwh100: null };
    expect(
      tcoEnergyConsumption({ consumptionL100: '6,5', consumptionKwh100: '16' })
    ).toEqual(none);
    expect(
      tcoEnergyConsumption({ consumptionL100: 0, consumptionKwh100: -3 })
    ).toEqual(none);
    expect(tcoEnergyConsumption({ consumptionL100: Number.NaN })).toEqual(none);
    expect(tcoEnergyConsumption({ powerKw: 110 })).toEqual(none);
  });

  it('ne lit pas les anciennes clés `consumption` et `fuelType`', () => {
    expect(
      tcoEnergyConsumption({ consumption: 6, fuelType: 'essence' })
    ).toEqual({ fuelL100: null, electricityKwh100: null });
  });

  it('tolère des données constructeur absentes ou mal formées', () => {
    for (const specs of [undefined, null, 'texte', 42, [6]]) {
      expect(hasTcoEnergyConsumption(tcoEnergyConsumption(specs))).toBe(false);
    }
  });
});

describe('specsOfRelation', () => {
  it('lit la relation en objet comme en tableau', () => {
    expect(specsOfRelation({ specs: { consumptionL100: 6 } })).toEqual({
      consumptionL100: 6,
    });
    expect(specsOfRelation([{ specs: { consumptionL100: 6 } }])).toEqual({
      consumptionL100: 6,
    });
  });

  it('rend undefined sans données constructeur', () => {
    expect(specsOfRelation(null)).toBeUndefined();
    expect(specsOfRelation([])).toBeUndefined();
    expect(specsOfRelation(undefined)).toBeUndefined();
  });
});
