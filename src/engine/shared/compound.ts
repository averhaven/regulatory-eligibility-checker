import type { Formulation } from '../../schemas/formulation.js';
import type { CompoundedSubstance, MatchedSubstance, SubstanceMatch } from './types.js';

/**
 * Decomposes a formulation into its declared substances, compounding each substance's
 * concentration (declared as percent-of-formulant) into percent-of-finished-product, and
 * aggregating a substance's contributions across every formulant it appears in.
 *
 * Groups by CAS number when present, else by the exact declared name. This is pure
 * arithmetic, not a substance matcher: it will NOT merge a substance declared under a
 * synonym in one formulant with its CAS-bearing declaration in another.
 *
 * TODO: closing that gap requires a real synonym/ambiguity-aware substance matcher.
 */
export function compoundFormulation(formulation: Formulation): CompoundedSubstance[] {
  const byKey = new Map<string, CompoundedSubstance>();

  for (const formulant of formulation.formulants) {
    for (const substance of formulant.substances) {
      const key = substance.casNumber ?? substance.name;
      const concentrationOfProduct =
        (formulant.percentOfProduct * substance.concentration) / 100;

      const existing = byKey.get(key);
      if (existing !== undefined) {
        existing.totalConcentration += concentrationOfProduct;
        existing.contributions.push({
          formulantId: formulant.id,
          formulantName: formulant.name,
          concentrationOfProduct,
        });
        continue;
      }

      byKey.set(key, {
        key,
        name: substance.name,
        ...(substance.casNumber !== undefined && { casNumber: substance.casNumber }),
        totalConcentration: concentrationOfProduct,
        contributions: [
          {
            formulantId: formulant.id,
            formulantName: formulant.name,
            concentrationOfProduct,
          },
        ],
      });
    }
  }

  return [...byKey.values()];
}

/**
 * Joins each compounded substance to its match result against a CLP reference dataset, via a
 * caller-supplied matcher - see `buildSubstanceMatcher` in `../matcher/substance-matcher.js`.
 */
export function attachReferences(
  compounded: CompoundedSubstance[],
  match: (substance: CompoundedSubstance) => SubstanceMatch,
): MatchedSubstance[] {
  return compounded.map((substance) => ({ ...substance, ...match(substance) }));
}
