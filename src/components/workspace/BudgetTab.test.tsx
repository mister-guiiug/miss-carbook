import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

/**
 * Le poste énergie du calculateur TCO (migrations
 * 20260930120000_tco_energie.sql et
 * 20260930140000_tco_energie_sans_parametres.sql).
 *
 * Le montant vient de `calculate_candidate_tco`, simulée ici : sa règle est
 * éprouvée par supabase/tests/tco_energie*.test.sql. Ce qui se vérifie ici est
 * ce que l'ÉCRAN en fait : le poste s'appelle « Énergie », son coût au
 * kilomètre se lit au centime, un poste à 0 dit pourquoi, et le prix de
 * l'électricité s'enregistre enfin avec celui du carburant.
 */

/** Écritures demandées par l'onglet, table par table. */
const upserts: { table: string; payload: Record<string, unknown> }[] = [];

/** L'erreur que la base rend à la prochaine écriture (`null` : aucune). */
let upsertError: unknown = null;

const variant = (id: string, trim: string, candidate_specs: unknown) => ({
  id,
  brand: 'Marque',
  model: 'Modèle',
  trim,
  parent_candidate_id: 'racine',
  status: 'to_see',
  price: 20000,
  candidate_specs,
});

const params = (candidate_id: string, overrides: object = {}) => ({
  id: `p-${candidate_id}`,
  workspace_id: 'w1',
  candidate_id,
  annual_km: 15000,
  ownership_years: 5,
  insurance_cost: null,
  fuel_price: 1.8,
  electricity_price: 0.2,
  residual_value_percent: 100,
  loan_interest_rate: null,
  loan_months: null,
  ...overrides,
});

const dataByTable: Record<string, unknown[]> = {
  candidates: [
    variant('essence', 'Essence', { specs: { consumptionL100: 6 } }),
    variant('vide', 'Fiche vide', { specs: { powerKw: 110 } }),
    // La relation peut aussi arriver en tableau, selon PostgREST.
    variant('electrique', 'Électrique', [{ specs: { consumptionKwh100: 16 } }]),
  ],
  budget_categories: [],
  budget_items: [],
  // « Électrique » n'a pas encore de paramètres enregistrés.
  tco_parameters: [
    params('essence'),
    params('vide', { loan_interest_rate: 5, loan_months: 84 }),
  ],
};

/** Réponse de la RPC : un total fait de la seule énergie, sur 75 000 km. */
const tco = (candidate_id: string, fuel_cost: number) => ({
  candidate_id,
  total_tco: fuel_cost,
  breakdown: {
    purchase_price: 20000,
    one_time_costs: 0,
    annual_costs: 0,
    per_km_costs: 0,
    fuel_cost,
    insurance_cost: 0,
    depreciation: 0,
    financing_cost: 0,
  },
  parameters: { annual_km: 15000, ownership_years: 5, total_km: 75000 },
});

const tcoByCandidate: Record<string, unknown> = {
  essence: tco('essence', 8100),
  vide: tco('vide', 0),
  // Sans paramètres, la base compte l'énergie aux valeurs par défaut :
  // 16 kWh/100 km × 15 000 km × 0,22 € × 5 ans.
  electrique: tco('electrique', 2640),
};

/** Constructeur de requête Supabase minimal : chaînable, et qui note les écritures. */
function queryBuilder(table: string) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = self;
  chain.eq = self;
  chain.order = self;
  chain.delete = self;
  let isUpsert = false;
  chain.upsert = (payload: Record<string, unknown>) => {
    upserts.push({ table, payload });
    isUpsert = true;
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({
      data: dataByTable[table] ?? [],
      error: isUpsert ? upsertError : null,
    }).then(resolve);
  return chain;
}

vi.mock('../../lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => queryBuilder(table),
    rpc: (_fn: string, args: { p_candidate_id: string }) =>
      Promise.resolve({
        data: tcoByCandidate[args.p_candidate_id] ?? null,
        error: null,
      }),
  }),
}));

const { BudgetTab } = await import('./BudgetTab');
const { I18nProvider } = await import('../../i18n');
const { ErrorDialogProvider } =
  await import('../../contexts/ErrorDialogContext');
const { ToastProvider } = await import('../../contexts/ToastContext');

/** Ouvre le calculateur TCO et rend la carte du modèle nommé. */
async function openTcoCard(trim: string) {
  render(
    <I18nProvider>
      <ErrorDialogProvider>
        <ToastProvider>
          <BudgetTab workspaceId="w1" canWrite />
        </ToastProvider>
      </ErrorDialogProvider>
    </I18nProvider>
  );
  fireEvent.click(await screen.findByRole('tab', { name: 'Calculateur TCO' }));
  const heading = await screen.findByRole('heading', {
    name: `Marque Modèle · ${trim}`,
  });
  return heading.closest('.card') as HTMLElement;
}

/** Ouvre les paramètres TCO du modèle nommé, et rend sa carte. */
async function openParameters(trim: string) {
  const card = await openTcoCard(trim);
  fireEvent.click(within(card).getByRole('button', { name: 'Paramètres' }));
  return card;
}

/** Le poste « Énergie » du détail de cette carte. */
async function energyPost(card: HTMLElement) {
  const label = await within(card).findByText('Énergie');
  return label.parentElement as HTMLElement;
}

describe('BudgetTab — le poste énergie du TCO', () => {
  beforeEach(() => {
    // Hors navigateur, la détection tombe sur `navigator.language` (en-US) :
    // on fixe la langue, les libellés attendus plus bas sont les français.
    localStorage.setItem('carbook_locale', 'fr');
    upserts.length = 0;
  });

  it('s’appelle « Énergie », et son coût au kilomètre se lit au centime', async () => {
    const post = await energyPost(await openTcoCard('Essence'));
    expect(post).toHaveTextContent(/8\s100\s€/);
    // 8 100 € sur 75 000 km : 0,108 €, qui s'affichait « 0 € ».
    expect(post).toHaveTextContent(/soit 0,11\s€ \/ km/);
  });

  it('dit quand les données constructeur n’ont aucune consommation', async () => {
    const post = await energyPost(await openTcoCard('Fiche vide'));
    expect(post).toHaveTextContent(
      'Aucune consommation dans les données constructeur'
    );
  });

  it('compte l’énergie d’un modèle sans paramètres enregistrés', async () => {
    const post = await energyPost(await openTcoCard('Électrique'));
    expect(post).toHaveTextContent(/2\s640\s€/);
    // 2 640 € sur 75 000 km : 0,0352 €.
    expect(post).toHaveTextContent(/soit 0,04\s€ \/ km/);
    // Plus d'excuse : l'énergie n'attend plus d'enregistrement.
    expect(post).not.toHaveTextContent(/paramètres enregistrés/);
  });

  it('enregistre le prix de l’électricité avec celui du carburant', async () => {
    const card = await openTcoCard('Essence');
    fireEvent.click(within(card).getByRole('button', { name: 'Paramètres' }));

    const fuel = within(card).getByLabelText('Prix carburant (€/L)');
    const electricity = within(card).getByLabelText('Prix électricité (€/kWh)');
    // Les prix déjà enregistrés reviennent dans le formulaire.
    expect(fuel).toHaveValue(1.8);
    expect(electricity).toHaveValue(0.2);

    fireEvent.change(fuel, { target: { value: '1.95' } });
    fireEvent.change(electricity, { target: { value: '0.25' } });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Calculer le TCO' })
    );

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      table: 'tco_parameters',
      payload: {
        candidate_id: 'essence',
        fuel_price: 1.95,
        electricity_price: 0.25,
      },
    });
    expect(
      await screen.findByText('Paramètres TCO enregistrés')
    ).toBeInTheDocument();
  });

  it('annonce les prix par défaut, et d’où vient la consommation', async () => {
    const card = await openTcoCard('Électrique');
    fireEvent.click(within(card).getByRole('button', { name: 'Paramètres' }));

    expect(within(card).getByLabelText('Prix carburant (€/L)')).toHaveAttribute(
      'placeholder',
      'Par défaut : 1,80'
    );
    const electricity = within(card).getByLabelText('Prix électricité (€/kWh)');
    expect(electricity).toHaveValue(null);
    expect(electricity).toHaveAttribute('placeholder', 'Par défaut : 0,22');
    expect(
      within(card).getByText(/données constructeur du modèle/)
    ).toBeInTheDocument();
  });
});

/**
 * La durée du crédit : la colonne `loan_months` et sa lecture par
 * `calculate_candidate_tco` existaient, mais aucun champ ne la saisissait. Le
 * crédit était donc toujours calculé sur 60 mois (voir
 * supabase/tests/tco_credit.test.sql pour ce que la base en fait).
 */
describe('BudgetTab — la durée du crédit', () => {
  beforeEach(() => {
    localStorage.setItem('carbook_locale', 'fr');
    upserts.length = 0;
  });

  it('enregistre la durée saisie', async () => {
    const card = await openParameters('Essence');
    const months = within(card).getByLabelText('Durée du crédit (mois)');
    expect(months).toHaveValue(null);
    expect(months).toHaveAttribute('placeholder', 'Par défaut : 60');

    fireEvent.change(months, { target: { value: '48' } });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Calculer le TCO' })
    );

    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      table: 'tco_parameters',
      payload: { candidate_id: 'essence', loan_months: 48 },
    });
    expect(
      await screen.findByText('Paramètres TCO enregistrés')
    ).toBeInTheDocument();
  });

  it('reprend la durée enregistrée, et un champ vidé rend la main aux 60 mois', async () => {
    const card = await openParameters('Fiche vide');
    const months = within(card).getByLabelText('Durée du crédit (mois)');
    expect(months).toHaveValue(84);

    fireEvent.change(months, { target: { value: '' } });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Calculer le TCO' })
    );

    expect(upserts[0]).toMatchObject({
      table: 'tco_parameters',
      payload: { candidate_id: 'vide', loan_months: null },
    });
  });

  it('refuse une durée que la base refuserait, avec un message qui la nomme', async () => {
    const card = await openParameters('Essence');
    const months = within(card).getByLabelText('Durée du crédit (mois)');

    for (const value of ['120', '6', '48.5']) {
      fireEvent.change(months, { target: { value } });
      fireEvent.click(
        within(card).getByRole('button', { name: 'Calculer le TCO' })
      );
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent(
        'La durée du crédit doit être un nombre entier de mois, de 12 à 96.'
      );
      // Rien n'est parti vers la base.
      expect(upserts).toHaveLength(0);
      fireEvent.click(within(dialog).getByRole('button', { name: 'OK' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    }
  });
});

/**
 * Un refus de la base sur un champ que l'écran ne vérifie pas : la boîte
 * d'erreur annonçait « Pseudo refusé par la base » pour TOUTE contrainte
 * violée (voir src/lib/errorReporting.test.ts).
 */
describe('BudgetTab — un refus de la base', () => {
  beforeEach(() => {
    localStorage.setItem('carbook_locale', 'fr');
    upserts.length = 0;
  });

  afterEach(() => {
    upsertError = null;
  });

  it('s’affiche comme une valeur hors limites, et non comme un pseudo refusé', async () => {
    upsertError = {
      code: '23514',
      message:
        'new row for relation "tco_parameters" violates check constraint "tco_parameters_annual_km_check"',
      details: 'Failing row contains (200000).',
      hint: null,
    };
    const card = await openParameters('Essence');
    fireEvent.change(within(card).getByLabelText('Km annuel'), {
      target: { value: '200000' },
    });
    fireEvent.click(
      within(card).getByRole('button', { name: 'Calculer le TCO' })
    );

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Une valeur saisie sort des limites acceptées. Vérifiez les champs du formulaire.'
    );
    expect(dialog).not.toHaveTextContent(/pseudo/i);
    expect(upserts[0]).toMatchObject({
      table: 'tco_parameters',
      payload: { annual_km: 200000 },
    });
  });
});
