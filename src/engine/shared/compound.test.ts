import { describe, expect, it } from 'vitest';
import type { Formulation } from '../../schemas/formulation.js';
import { attachReferences, compoundFormulation } from './compound.js';
import { agriguard480ec } from '../../data/mock/formulations/agriguard-480ec.js';

describe('compoundFormulation', () => {
  it('compounds formulant % x substance % into % of finished product', () => {
    // A formulant at 40% of the product, containing 0.3% of a substance -> 0.12% of the
    // finished product.
    const formulation: Formulation = {
      id: 'form-test',
      name: 'Test Formulation',
      formulants: [
        {
          id: 'fnt-a',
          name: 'Formulant A',
          percentOfProduct: 40,
          substances: [{ name: 'Test Substance', concentration: 0.3 }],
        },
        {
          id: 'fnt-b',
          name: 'Formulant B',
          percentOfProduct: 60,
          substances: [{ name: 'Water', concentration: 100 }],
        },
      ],
    };

    const [testSubstance] = compoundFormulation(formulation);
    expect(testSubstance?.totalConcentration).toBeCloseTo(0.12, 10);
  });

  it('aggregates a substance declared under the same CAS across multiple formulants', () => {
    // Real mock data: formaldehyde (CAS 50-00-0) arrives via both preservativePackage (5%
    // of product x 2% of formulant = 0.1%) and biocideReserveBlend (5% x 1.5% = 0.075%),
    // for a total of 0.175% of the finished product.
    const compounded = compoundFormulation(agriguard480ec);
    const formaldehyde = compounded.find((s) => s.casNumber === '50-00-0');

    expect(formaldehyde?.totalConcentration).toBeCloseTo(0.175, 10);
    expect(formaldehyde?.contributions).toHaveLength(2);
    expect(formaldehyde?.contributions.map((c) => c.formulantName).sort()).toEqual([
      'Biocide Reserve Blend',
      'Preservative Stabilizer Package',
    ]);
  });

  it('does not merge a synonym-declared substance with its CAS-bearing declaration', () => {
    // "Dursban Technical" (no CAS, chlorpyrifosConcentrate) and any CAS-bearing chlorpyrifos
    // declaration would real-world be the same substance, but compoundFormulation groups
    // before matching runs, on exact CAS-or-name only - it must not silently merge them. This
    // remains a known gap even with Milestone 4's real matcher, since matching happens after
    // this grouping step, not before it.
    const compounded = compoundFormulation(agriguard480ec);
    const dursban = compounded.find((s) => s.name === 'Dursban Technical');
    expect(dursban).toBeDefined();
    expect(dursban?.casNumber).toBeUndefined();
  });
});

describe('attachReferences', () => {
  it('marks a substance with no match as reference: undefined', () => {
    const compounded = compoundFormulation({
      id: 'form-test',
      name: 'Test',
      formulants: [
        {
          id: 'fnt-a',
          name: 'Formulant A',
          percentOfProduct: 100,
          substances: [{ name: 'Totally Unmatched Substance', concentration: 50 }],
        },
      ],
    });

    const [matched] = attachReferences(compounded, () => ({
      reference: undefined,
      ambiguityReasons: [],
    }));
    expect(matched?.reference).toBeUndefined();
  });
});
