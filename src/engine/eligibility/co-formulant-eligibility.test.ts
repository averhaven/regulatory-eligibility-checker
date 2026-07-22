import { describe, expect, it } from 'vitest';
import type {
  ClpReferenceEntry,
  CmrCategory,
  CmrEndpoint,
} from '../../schemas/clp-reference.js';
import type { MatchedSubstance } from '../shared/types.js';
import { classifyCoFormulantEligibility } from './co-formulant-eligibility.js';

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
  return { key: name, name, totalConcentration, contributions: [], reference };
}

describe('classifyCoFormulantEligibility', () => {
  it('is eligible when no substance carries a CMR 1A/1B classification', () => {
    const verdict = classifyCoFormulantEligibility([
      matched('Boric acid', 2, [
        {
          endpoint: 'reproductiveToxicity',
          category: '2',
          specificConcentrationLimit: 5.5,
        },
      ]),
    ]);
    expect(verdict.eligible).toBe(true);
    expect(verdict.bannedCoFormulants).toEqual([]);
  });

  it('bans a Category 1B substance even at trace concentration, unlike classifyCmr', () => {
    // 0.05% is below both the 0.1% generic concentration limit and any plausible SCL - it
    // would never trigger classifyCmr's mixture-level classification, but Reg. (EU)
    // 2023/574 points 1-3 ban the co-formulant outright regardless of concentration.
    const verdict = classifyCoFormulantEligibility([
      matched('Formaldehyde', 0.05, [{ endpoint: 'carcinogenicity', category: '1B' }]),
    ]);
    expect(verdict.eligible).toBe(false);
    expect(verdict.bannedCoFormulants).toHaveLength(1);
    expect(verdict.bannedCoFormulants[0]).toMatchObject({
      name: 'Formaldehyde',
      endpoint: 'carcinogenicity',
      category: '1B',
    });
  });

  it('bans a Category 1A substance', () => {
    const verdict = classifyCoFormulantEligibility([
      matched('Fictional Mutagen', 10, [{ endpoint: 'mutagenicity', category: '1A' }]),
    ]);
    expect(verdict.eligible).toBe(false);
    expect(verdict.bannedCoFormulants[0]).toMatchObject({
      endpoint: 'mutagenicity',
      category: '1A',
    });
  });

  it('does not ban Category 2 (only 1A/1B are in the Annex points 1-3)', () => {
    const verdict = classifyCoFormulantEligibility([
      matched('Fictional Category 2', 50, [{ endpoint: 'mutagenicity', category: '2' }]),
    ]);
    expect(verdict.eligible).toBe(true);
  });

  it('reports every banned substance, not just the first', () => {
    const verdict = classifyCoFormulantEligibility([
      matched('Formaldehyde', 0.05, [{ endpoint: 'carcinogenicity', category: '1B' }]),
      matched('Boric acid', 2, [
        {
          endpoint: 'reproductiveToxicity',
          category: '1B',
          specificConcentrationLimit: 5.5,
        },
      ]),
    ]);
    expect(verdict.eligible).toBe(false);
    expect(verdict.bannedCoFormulants).toHaveLength(2);
  });

  it('ignores substances with no CLP reference entry at all', () => {
    const verdict = classifyCoFormulantEligibility([
      {
        key: 'unknown',
        name: 'Unknown Substance',
        totalConcentration: 5,
        contributions: [],
        reference: undefined,
      },
    ]);
    expect(verdict.eligible).toBe(true);
  });
});
