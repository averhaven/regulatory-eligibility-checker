import { describe, expect, it } from 'vitest';
import type {
  ClpReferenceEntry,
  CmrCategory,
  CmrEndpoint,
} from '../../schemas/clp-reference.js';
import type { MatchedSubstance } from '../shared/types.js';
import { classifyCmr } from './cmr.js';
import { syntheticNoteConditionedEntry } from '../../data/clp-reference/fixtures/synthetic.js';

/** Minimal MatchedSubstance builder for hand-crafted engine-level fixtures. */
function matched(
  name: string,
  totalConcentration: number,
  classifications: {
    endpoint: CmrEndpoint;
    category: CmrCategory;
    specificConcentrationLimit?: number;
  }[],
): MatchedSubstance {
  const reference: ClpReferenceEntry = {
    indexNumber: 'test',
    name,
    acuteToxicity: { oral: null },
    skinEyeCorrosion: { classifications: [] },
    cmr: { classifications },
  };
  return {
    key: name,
    name,
    totalConcentration,
    contributions: [],
    reference,
    ambiguityReasons: [],
  };
}

describe('classifyCmr', () => {
  it('triggers Carc. 1B at the 0.1% generic concentration limit (formaldehyde-shaped, GCL boundary)', () => {
    const verdict = classifyCmr([
      matched('Formaldehyde', 0.1, [{ endpoint: 'carcinogenicity', category: '1B' }]),
    ]);
    expect(verdict.classifications).toHaveLength(1);
    expect(verdict.classifications[0]).toMatchObject({
      endpoint: 'carcinogenicity',
      category: '1B',
    });
    expect(verdict.classifications[0]?.triggeredBy[0]?.limitSource).toBe('gcl');
  });

  it('does not trigger below the generic concentration limit', () => {
    const verdict = classifyCmr([
      matched('Formaldehyde', 0.09, [{ endpoint: 'carcinogenicity', category: '1B' }]),
    ]);
    expect(verdict.classifications).toHaveLength(0);
  });

  it("a real SCL overrides the GCL even when it's looser (boric acid: 5.5% SCL vs 0.3% GCL)", () => {
    const belowScl = classifyCmr([
      matched('Boric acid', 2, [
        {
          endpoint: 'reproductiveToxicity',
          category: '1B',
          specificConcentrationLimit: 5.5,
        },
      ]),
    ]);
    expect(belowScl.classifications).toHaveLength(0); // above the 0.3% GCL, but below the real 5.5% SCL

    const atScl = classifyCmr([
      matched('Boric acid', 5.5, [
        {
          endpoint: 'reproductiveToxicity',
          category: '1B',
          specificConcentrationLimit: 5.5,
        },
      ]),
    ]);
    expect(atScl.classifications).toHaveLength(1);
    expect(atScl.classifications[0]?.triggeredBy[0]?.limitSource).toBe('scl');
  });

  it('does not sum across two different CMR substances each below their own threshold', () => {
    const verdict = classifyCmr([
      matched('Formaldehyde', 0.05, [{ endpoint: 'carcinogenicity', category: '1B' }]), // < 0.1% GCL
      matched('Boric acid', 3, [
        {
          endpoint: 'reproductiveToxicity',
          category: '1B',
          specificConcentrationLimit: 5.5,
        },
      ]), // < 5.5% SCL
    ]);
    expect(verdict.classifications).toHaveLength(0);
  });

  it('applies a note-conditioned SCL and surfaces its note codes in provenance without interpreting them', () => {
    const verdict = classifyCmr([
      {
        key: 'synthetic',
        name: syntheticNoteConditionedEntry.name,
        totalConcentration: 6,
        contributions: [],
        reference: syntheticNoteConditionedEntry,
        ambiguityReasons: [],
      },
    ]);
    expect(verdict.classifications).toHaveLength(1);
    expect(verdict.classifications[0]?.triggeredBy[0]?.limitUsed).toBe(5);
    expect(syntheticNoteConditionedEntry.noteCodes?.[0]).toContain('SYNTHETIC NOTE');
  });
});
