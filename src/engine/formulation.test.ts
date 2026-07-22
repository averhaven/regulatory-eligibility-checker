import { describe, expect, it } from 'vitest';
import { classifyFormulation } from './index.js';
import { lookupByCasOrName } from '../data/clp-reference/fixtures/dataset.js';
import {
  agriguard480ec,
  agriguard480ecPlus,
  fieldclearDust,
  fieldclearGranular,
} from '../data/mock/formulations/index.js';

/**
 * End-to-end tests running the real deterministic pipeline (compound -> match -> classify)
 * against the real mock formulations, via the exact-CAS-or-name lookup that stands in for
 * the real substance matcher (TODO: not yet implemented). Every expected number below was
 * hand-derived from the real mock data's concentrations and the real CLP reference data in
 * src/data/clp-reference/fixtures/dataset.ts during implementation.
 */
describe('classifyFormulation (end-to-end against real mock formulations)', () => {
  it('agriguard480ec: acute tox Category 4 via unknown-correction, CMR Carc.1B via cross-formulant formaldehyde aggregation', () => {
    const verdict = classifyFormulation(agriguard480ec, lookupByCasOrName);

    // "Dursban Technical" (chlorpyrifos synonym, no CAS) is 15.75% of product and matches
    // nothing in the reference dataset -> unknown toxicity, feeds the >10%-unknown
    // correction. Only cypermethrin (1.5%, Cat 4) and methanol (9.5%, Cat 3) contribute.
    expect(verdict.acuteToxicity.unknownConcentrationPercent).toBeCloseTo(15.75, 5);
    expect(verdict.acuteToxicity.usedUnknownCorrection).toBe(true);
    expect(verdict.acuteToxicity.ateMixMgPerKg).toBeCloseTo(859.69, 1);
    expect(verdict.acuteToxicity.category).toBe('4');
    expect(verdict.acuteToxicity.sameCategoryShortcutApplied).toBe(false);

    // Formaldehyde (0.1% via preservativePackage + 0.075% via biocideReserveBlend = 0.175%
    // total) is too dilute to trigger any skin/eye corrosion classification.
    expect(verdict.skinEyeCorrosion.classifications).toEqual([]);

    // But 0.175% DOES cross the Carc. 1B generic concentration limit (0.1%) - only because
    // of cross-formulant aggregation; neither formulant alone would reach it.
    expect(verdict.cmr.classifications).toHaveLength(1);
    expect(verdict.cmr.classifications[0]).toMatchObject({
      endpoint: 'carcinogenicity',
      category: '1B',
    });

    // Formaldehyde is Carc. 1B in real Annex VI, which bans it as a co-formulant per
    // Reg. (EU) 2023/574 points 1-3 outright - unconditional on the 0.175% concentration
    // that (separately) also crosses the CMR mixture-classification GCL above.
    expect(verdict.eligible).toBe(false);
    expect(verdict.coFormulantEligibility.bannedCoFormulants).toHaveLength(1);
    expect(verdict.coFormulantEligibility.bannedCoFormulants[0]).toMatchObject({
      name: 'Formaldehyde',
      category: '1B',
    });
  });

  it('agriguard480ecPlus: dilution keeps acute tox unclassified, straight additivity triggers Skin Corr. 1A', () => {
    const verdict = classifyFormulation(agriguard480ecPlus, lookupByCasOrName);

    // Cypermethrin (2%, Cat 4) + potassium hydroxide (1%, Cat 4, its real dual
    // classification) are both Category 4, but too dilute for the ATEmix arithmetic to
    // classify (~16667 mg/kg, above the 2000 cutoff) - and the same-category shortcut must
    // NOT escalate a genuinely dilute result up to the shared category.
    expect(verdict.acuteToxicity.sameCategoryShortcutApplied).toBe(false);
    expect(verdict.acuteToxicity.category).toBeNull();

    // Sulfuric acid (3%), acetic acid (2.25%), sodium hydroxide (3%), and potassium
    // hydroxide (1%) combine via SCL-additivity: sum(Ci/SCLi) for Skin Corr. 1A =
    // 3/15 + 2.25/90 + 3/5 + 1/5 = 1.025 >= 1.
    expect(verdict.skinEyeCorrosion.classifications).toEqual(['skinCorr1A']);

    expect(verdict.cmr.classifications).toEqual([]);

    // No formaldehyde/boric acid formulant in this variant - no CMR 1A/1B substance at
    // all, so it's eligible despite the Skin Corr. 1A mixture classification above (skin/
    // eye corrosion isn't a co-formulant cut-off criterion under Reg. (EU) 2023/574).
    expect(verdict.eligible).toBe(true);
  });

  it('fieldclearDust: acidPhAdjuster at low concentration stays below every skin/eye threshold', () => {
    const verdict = classifyFormulation(fieldclearDust, lookupByCasOrName);

    // No oral-acute-toxicity-classified substance is present at all.
    expect(verdict.acuteToxicity.category).toBeNull();
    expect(verdict.acuteToxicity.ateMixMgPerKg).toBeNull();

    // Sulfuric acid (1%) + acetic acid (0.75%) - both SCL-bearing and both well below
    // threshold, by design.
    expect(verdict.skinEyeCorrosion.classifications).toEqual([]);

    // Titanium dioxide (1%) has no CMR classification in the reference dataset.
    expect(verdict.cmr.classifications).toEqual([]);

    // No CMR-1A/1B-classified substance present at all.
    expect(verdict.eligible).toBe(true);
  });

  it('fieldclearGranular: a single dilute Category 3 substance stays unclassified; boric acid stays below its real SCL', () => {
    const verdict = classifyFormulation(fieldclearGranular, lookupByCasOrName);

    // Methanol alone at 4.75% (Cat 3): ATEmix ~= 2105 mg/kg, above the 2000 cutoff -
    // genuinely unclassified, and the single-substance "same category" shortcut must not
    // force it up to Category 3 (dilution isn't the arithmetic artifact the shortcut guards
    // against).
    expect(verdict.acuteToxicity.category).toBeNull();

    expect(verdict.skinEyeCorrosion.classifications).toEqual([]);

    // Boric acid at 2% is above the 0.3% generic limit but below its real 5.5% SCL, so it
    // does NOT trigger Repr. 1B. Formaldehyde at 0.2% (this formulation's only formaldehyde
    // source) DOES cross the 0.1% Carc. 1B generic limit on its own.
    expect(verdict.cmr.classifications).toHaveLength(1);
    expect(verdict.cmr.classifications[0]).toMatchObject({
      endpoint: 'carcinogenicity',
      category: '1B',
    });

    // Both boric acid (Repro. 1B, real classification) and formaldehyde (Carc. 1B) are
    // banned co-formulants regardless of their below-SCL/at-GCL concentrations.
    expect(verdict.eligible).toBe(false);
    expect(verdict.coFormulantEligibility.bannedCoFormulants).toHaveLength(2);
  });
});
