import { describe, expect, it } from 'vitest';
import { FormulantSchema } from '../../schemas/formulant.js';
import { FormulationSchema } from '../../schemas/formulation.js';
import { mockFormulations } from './formulations/index.js';

describe('mock dataset', () => {
  it('every formulation parses against FormulationSchema', () => {
    for (const formulation of mockFormulations) {
      const result = FormulationSchema.safeParse(formulation);
      expect(
        result.success,
        JSON.stringify(result.success ? null : result.error.issues),
      ).toBe(true);
    }
  });

  it('formulation IDs are unique', () => {
    const ids = mockFormulations.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('formulant IDs are unique within each formulation', () => {
    for (const formulation of mockFormulations) {
      const ids = formulation.formulants.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('rejects a formulation whose formulant percentages do not sum to 100', () => {
    const broken = {
      id: 'form-broken',
      name: 'Broken Formulation',
      formulants: [
        {
          id: 'fnt-a',
          name: 'Formulant A',
          percentOfProduct: 40,
          substances: [{ name: 'Water', casNumber: '7732-18-5', concentration: 100 }],
        },
      ],
    };
    expect(FormulationSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects a formulant whose declared substances exceed 100%', () => {
    const broken = {
      id: 'fnt-broken',
      name: 'Broken Formulant',
      percentOfProduct: 10,
      substances: [
        { name: 'Substance A', concentration: 60 },
        { name: 'Substance B', concentration: 60 },
      ],
    };
    expect(FormulantSchema.safeParse(broken).success).toBe(false);
  });
});
