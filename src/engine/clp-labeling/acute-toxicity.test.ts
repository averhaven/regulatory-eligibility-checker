import { describe, expect, it } from 'vitest';
import type { MatchedSubstance } from '../shared/types.js';
import {
  categoryFromAteMix,
  classifyAcuteToxicity,
  computeAteMix,
} from './acute-toxicity.js';

/** Minimal MatchedSubstance builder for hand-crafted engine-level fixtures. */
function matched(
  name: string,
  totalConcentration: number,
  oral: { category: '1' | '2' | '3' | '4'; ateMgPerKg: number } | null | undefined,
): MatchedSubstance {
  return {
    key: name,
    name,
    totalConcentration,
    contributions: [],
    ambiguityReasons: [],
    reference:
      oral === undefined
        ? undefined
        : {
            indexNumber: 'test',
            name,
            acuteToxicity: {
              oral:
                oral === null
                  ? null
                  : {
                      route: 'oral',
                      category: oral.category,
                      ateMgPerKg: oral.ateMgPerKg,
                      ateSource: 'published',
                    },
            },
            skinEyeCorrosion: { classifications: [] },
            cmr: { classifications: [] },
          },
  };
}

describe('computeAteMix / categoryFromAteMix', () => {
  it('ECHA CLP guidance v6.0 (Jan 2024) section 3.1.5.3 Example 12a: inhalation additivity', () => {
    // 6% @ 1.5 mg/L (Cat 4), 11% @ 0.6 mg/L (Cat 3), 10% not classified (neglected), 40% @
    // 1.5 mg/L (Cat 4), 33% water (neglected). This checks the ATEmix formula machinery in
    // isolation - it's an inhalation (mist) example, not a v1 oral integration test, so it
    // is NOT run through categoryFromAteMix (that helper's bands are oral-only, mg/kg bw;
    // the real result here, Category 4, comes from the very differently-scaled dust/mist
    // mg/L bands in Table 3.1.2, which v1's oral-only scope does not implement).
    const ateMix = computeAteMix(
      [
        { concentration: 6, ateMgPerKg: 1.5 },
        { concentration: 11, ateMgPerKg: 0.6 },
        { concentration: 40, ateMgPerKg: 1.5 },
      ],
      0,
    );
    expect(ateMix).toBeCloseTo(2.04, 2);
  });
});

describe('classifyAcuteToxicity', () => {
  it('ECHA CLP guidance v6.0 (Jan 2024) section 3.1.5.3 Example 11: >10%-unknown correction', () => {
    // 4% @ ATE 125 (Cat 3), 92% unknown, 3% @ ATE 1500 (Cat 4), 0.9% unknown+irrelevant
    // (omitted here, per the worked example's own pruning), 0.2% @ ATE 10 (Cat 2, kept
    // despite being <1%). Expected: (100-92)/ATEmix = 4/125+3/1500+0.2/10 = 0.054 ->
    // ATEmix = 8/0.054 ~= 148.1 mg/kg -> Category 3.
    const verdict = classifyAcuteToxicity([
      matched('Ingredient 1', 4, { category: '3', ateMgPerKg: 125 }),
      matched('Ingredient 2 (unknown)', 92, undefined),
      matched('Ingredient 3', 3, { category: '4', ateMgPerKg: 1500 }),
      matched('Ingredient 5', 0.2, { category: '2', ateMgPerKg: 10 }),
    ]);

    expect(verdict.usedUnknownCorrection).toBe(true);
    expect(verdict.unknownConcentrationPercent).toBe(92);
    expect(verdict.ateMixMgPerKg).toBeCloseTo(148.1, 1);
    expect(verdict.category).toBe('3');
  });

  it('excludes a known-tested-non-oral-toxic substance (xylene-shaped) from both the sum and the unknown bucket', () => {
    const verdict = classifyAcuteToxicity([
      matched('Chlorpyrifos', 15.75, { category: '3', ateMgPerKg: 100 }),
      matched('Xylene', 18.75, null), // reference found, but no oral classification
    ]);

    expect(verdict.excludedSubstances).toHaveLength(1);
    expect(verdict.unknownSubstances).toHaveLength(0);
    expect(verdict.unknownConcentrationPercent).toBe(0);
    // Only chlorpyrifos contributes: 15.75/100 = 0.1575 -> ATEmix = 100/0.1575 ~= 634.9
    expect(verdict.ateMixMgPerKg).toBeCloseTo(634.92, 1);
    expect(verdict.category).toBe('4');
  });

  it('caps an over-classified ATEmix back to the shared category (3.1.3.3(c) artifact guard)', () => {
    // Three substances individually known as Category 2 (conservative conversion ATE=5),
    // each at 40%. Stacked arithmetic: 40/5 x 3 = 24 -> ATEmix = 100/24 ~= 4.17 mg/kg, which
    // would arithmetically read as Category 1 - a pure artifact of using each substance's
    // conservative point estimate. None of the three individually supports Category 1
    // potency, so the shortcut correctly caps the result at the shared Category 2.
    const verdict = classifyAcuteToxicity([
      matched('A', 40, { category: '2', ateMgPerKg: 5 }),
      matched('B', 40, { category: '2', ateMgPerKg: 5 }),
      matched('C', 40, { category: '2', ateMgPerKg: 5 }),
    ]);

    expect(categoryFromAteMix(verdict.ateMixMgPerKg ?? NaN)).toBe('1'); // raw arithmetic
    expect(verdict.sameCategoryShortcutApplied).toBe(true);
    expect(verdict.category).toBe('2'); // shortcut-corrected
  });

  it('does NOT force a dilute same-category mixture up to that category (dilution is not an artifact)', () => {
    // A single Category 3 substance at 4.75% (methanol-shaped, real fieldclearGranular
    // concentration): ATEmix = 100/(4.75/100) = 2105.3 mg/kg, above the 2000 cutoff -
    // genuinely unclassified. The shared-category shortcut must not escalate this to
    // Category 3; that direction isn't the artifact the rule guards against.
    const verdict = classifyAcuteToxicity([
      matched('Methanol', 4.75, { category: '3', ateMgPerKg: 100 }),
    ]);

    expect(verdict.sameCategoryShortcutApplied).toBe(false);
    expect(verdict.category).toBeNull();
  });

  it('returns category: null, ateMixMgPerKg: null when no substance contributes oral data', () => {
    const verdict = classifyAcuteToxicity([matched('Water', 100, null)]);
    expect(verdict.category).toBeNull();
    expect(verdict.ateMixMgPerKg).toBeNull();
  });
});
