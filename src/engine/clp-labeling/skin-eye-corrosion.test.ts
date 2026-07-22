import { describe, expect, it } from 'vitest';
import type {
  ClpReferenceEntry,
  SkinEyeClassificationCode,
} from '../../schemas/clp-reference.js';
import type { MatchedSubstance } from '../shared/types.js';
import { classifySkinEyeCorrosion } from './skin-eye-corrosion.js';

/** Minimal MatchedSubstance builder for hand-crafted engine-level fixtures. */
function matched(
  name: string,
  totalConcentration: number,
  classifications: {
    classification: SkinEyeClassificationCode;
    specificConcentrationLimit?: number;
  }[],
): MatchedSubstance {
  const reference: ClpReferenceEntry = {
    indexNumber: 'test',
    name,
    acuteToxicity: { oral: null },
    skinEyeCorrosion: { classifications },
    cmr: { classifications: [] },
  };
  return { key: name, name, totalConcentration, contributions: [], reference };
}

describe('classifySkinEyeCorrosion', () => {
  it('triggers Skin Corr. 1A via SCL-additivity combining two substances, neither alone sufficient', () => {
    // Sulfuric acid at 10% (SCL 15% -> 10/15=0.667) + sodium hydroxide at 2% (SCL 5% ->
    // 2/5=0.4): neither crosses 1 alone, but combined 0.667+0.4=1.067 >= 1.
    const verdict = classifySkinEyeCorrosion([
      matched('Sulfuric acid', 10, [
        { classification: 'skinCorr1A', specificConcentrationLimit: 15 },
      ]),
      matched('Sodium hydroxide', 2, [
        { classification: 'skinCorr1A', specificConcentrationLimit: 5 },
      ]),
    ]);

    expect(verdict.classifications).toEqual(['skinCorr1A']);
    const skinCorr1A = verdict.perClassification.find(
      (r) => r.classification === 'skinCorr1A',
    );
    expect(skinCorr1A?.additivitySum).toBeCloseTo(1.067, 2);
    expect(skinCorr1A?.contributingSubstances).toHaveLength(2);
  });

  it('does not trigger anything below threshold (real fieldclearDust-shaped case)', () => {
    // Sulfuric acid at 1% (SCL 15%) + acetic acid at 0.75% (SCL 90%/25%/10%) - both well
    // below every threshold, and both SCL-bearing so the bridging rule (GCL-only) doesn't
    // apply either.
    const verdict = classifySkinEyeCorrosion([
      matched('Sulfuric acid', 1, [
        { classification: 'skinCorr1A', specificConcentrationLimit: 15 },
        { classification: 'skinIrrit2', specificConcentrationLimit: 5 },
      ]),
      matched('Acetic acid', 0.75, [
        { classification: 'skinCorr1A', specificConcentrationLimit: 90 },
        { classification: 'skinCorr1B', specificConcentrationLimit: 25 },
        { classification: 'skinIrrit2', specificConcentrationLimit: 10 },
      ]),
    ]);

    expect(verdict.classifications).toEqual([]);
  });

  it('GCL bridging rule: sub-threshold corrosive + irritant concentrations combine to trigger Skin Irrit. 2', () => {
    // Two GCL-fallback (no SCL) substances: 3% Skin Corr. 1A (below its own 5% GCL alone)
    // and 5% Skin Irrit. 2 (below its own 10% GCL alone). Skin bridging: 10*3 + 5 = 35 >= 10.
    // Real Annex I Table 3.3.3 also folds Skin Corr. 1 substances into the EYE bridging sum
    // (a skin-corrosive substance is presumed at least eye-irritant too), so the same 3%
    // Skin Corr. 1A substance independently triggers Eye Irrit. 2 via eye bridging: 10*3+0=30>=10.
    const verdict = classifySkinEyeCorrosion([
      matched('Synthetic Corrosive', 3, [{ classification: 'skinCorr1A' }]),
      matched('Synthetic Irritant', 5, [{ classification: 'skinIrrit2' }]),
    ]);

    expect(verdict.classifications).toEqual(['skinIrrit2', 'eyeIrrit2']);
  });

  it('GCL sub-category stepwise resolution: insufficient 1A alone, but 1A+1B combined reaches 5%', () => {
    // 2% Skin Corr. 1A (GCL) + 4% Skin Corr. 1B (GCL): 1A alone (2%) < 5%, but cumulative
    // 1A+1B (6%) >= 5% -> classified at the less-severe 1B, not 1A. Both substances also
    // feed the eye bridging sum (10*(2+4)+0=60>=10), independently triggering Eye Irrit. 2.
    const verdict = classifySkinEyeCorrosion([
      matched('Synthetic 1A substance', 2, [{ classification: 'skinCorr1A' }]),
      matched('Synthetic 1B substance', 4, [{ classification: 'skinCorr1B' }]),
    ]);

    expect(verdict.classifications).toEqual(['skinCorr1B', 'eyeIrrit2']);
  });
});
