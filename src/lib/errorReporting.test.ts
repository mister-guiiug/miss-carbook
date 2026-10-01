import { describe, expect, it } from 'vitest';
import { explainUnknownError } from './errorReporting';

/**
 * Une erreur PostgREST telle que la rend supabase-js (`PostgrestError`). Pour
 * une contrainte, c'est le message qui la nomme : le code, lui, vaut pour
 * toutes les tables.
 */
const postgrest = (code: string, message: string, details = '') => ({
  code,
  message,
  details,
  hint: null,
});

const userMessage = (err: unknown) => explainUnknownError(err).userMessage;

const HORS_LIMITES =
  'Une valeur saisie sort des limites acceptées. Vérifiez les champs du formulaire.';

describe('explainUnknownError — les contraintes de la base', () => {
  it('garde les messages du pseudo pour les deux contraintes du profil', () => {
    expect(
      userMessage(
        postgrest(
          '23514',
          'new row for relation "profiles" violates check constraint "profiles_display_name_check"'
        )
      )
    ).toBe('Pseudo refusé par la base : respectez les règles de format.');
    expect(
      userMessage(
        postgrest(
          '23505',
          'duplicate key value violates unique constraint "profiles_display_name_lower_uidx"'
        )
      )
    ).toBe(
      'Ce pseudo est déjà utilisé (unicité, sans tenir compte des majuscules).'
    );
  });

  it('ne parle plus de pseudo pour la contrainte d’une autre table', () => {
    const { userMessage: message, technical } = explainUnknownError(
      postgrest(
        '23514',
        'new row for relation "tco_parameters" violates check constraint "tco_parameters_annual_km_check"',
        'Failing row contains (200000, 5).'
      ),
      'Enregistrement des paramètres TCO'
    );
    expect(message).toBe(HORS_LIMITES);
    expect(message).not.toMatch(/pseudo/i);
    // Le nom de la contrainte, qui désigne le champ, reste pour le support.
    expect(technical).toContain('tco_parameters_annual_km_check');
    expect(technical).toContain('Enregistrement des paramètres TCO');
  });

  it('traite un nombre trop grand pour sa colonne comme une valeur hors limites', () => {
    expect(
      userMessage(
        postgrest(
          '22003',
          'numeric field overflow',
          'A field with precision 6, scale 3 must round to an absolute value less than 10^3.'
        )
      )
    ).toBe(HORS_LIMITES);
  });

  it('rend le message d’unicité générique hors du profil', () => {
    expect(
      userMessage(
        postgrest(
          '23505',
          'duplicate key value violates unique constraint "tco_parameters_workspace_id_candidate_id_key"'
        )
      )
    ).toBe('Cette valeur existe déjà (contrainte d’unicité en base).');
  });
});

describe('explainUnknownError — le reste ne change pas', () => {
  it('les droits refusés (42501)', () => {
    expect(
      userMessage(
        postgrest(
          '42501',
          'new row violates row-level security policy for table "tco_parameters"'
        )
      )
    ).toBe(
      'Cette action n’est pas autorisée avec votre compte ou pour ce dossier (droits d’accès).'
    );
  });

  it('le réseau coupé', () => {
    expect(userMessage(new TypeError('Failed to fetch'))).toBe(
      'Connexion réseau impossible. Vérifiez votre connexion ou réessayez plus tard.'
    );
  });

  it('le préfixe [dwc] du socle, retiré du message mais gardé dans le bloc technique', () => {
    const { userMessage: message, technical } = explainUnknownError(
      new Error('[dwc] Impossible de lire cette image.')
    );
    expect(message).toBe('Impossible de lire cette image.');
    expect(technical).toContain('[dwc]');
  });
});
