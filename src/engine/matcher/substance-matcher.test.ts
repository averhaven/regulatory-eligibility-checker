import { describe, expect, it } from 'vitest';
import type { ClpReferenceEntry } from '../../schemas/clp-reference.js';
import type { CompoundedSubstance } from '../shared/types.js';
import { annexViDataset } from '../../data/clp-reference/generated/annex-vi.js';
import { compoundFormulation } from '../shared/compound.js';
import {
  agriguard480ec,
  fieldclearDust,
} from '../../data/mock/formulations/index.js';
import { buildSubstanceMatcher } from './substance-matcher.js';

function entry(
  overrides: Partial<ClpReferenceEntry> & { indexNumber: string },
): ClpReferenceEntry {
  return {
    name: 'Test Substance',
    acuteToxicity: { oral: null },
    skinEyeCorrosion: { classifications: [] },
    cmr: { classifications: [] },
    ...overrides,
  };
}

function substance(
  overrides: Partial<CompoundedSubstance> & { name: string },
): CompoundedSubstance {
  return {
    key: overrides.name,
    totalConcentration: 1,
    contributions: [],
    ...overrides,
  };
}

describe('buildSubstanceMatcher', () => {
  it('resolves a clean CAS match with no ambiguity reasons', () => {
    const dataset = [
      entry({
        indexNumber: '001-001-00-1',
        casNumber: '100-00-0',
        name: 'Clean Substance',
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Clean Substance', casNumber: '100-00-0' }));

    expect(result.reference?.casNumber).toBe('100-00-0');
    expect(result.ambiguityReasons).toEqual([]);
  });

  it('resolves a clean name match when no CAS is declared', () => {
    const dataset = [
      entry({
        indexNumber: '001-001-00-1',
        casNumber: '100-00-0',
        name: 'Clean Substance',
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'clean substance' }));

    expect(result.reference?.name).toBe('Clean Substance');
    expect(result.ambiguityReasons).toEqual([]);
  });

  it('flags synonymMismatch when neither CAS nor name resolves', () => {
    const dataset = [
      entry({
        indexNumber: '001-001-00-1',
        casNumber: '100-00-0',
        name: 'Clean Substance',
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Some Trade Name' }));

    expect(result.reference).toBeUndefined();
    expect(result.ambiguityReasons).toHaveLength(1);
    expect(result.ambiguityReasons[0]?.code).toBe('synonymMismatch');
  });

  it('flags groupingEntry when the matched entry shares an index number with a sibling', () => {
    const dataset = [
      entry({
        indexNumber: '005-000-00-0',
        casNumber: '111-11-1',
        name: 'Group Member A',
      }),
      entry({
        indexNumber: '005-000-00-0',
        casNumber: '222-22-2',
        name: 'Group Member B',
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Group Member A', casNumber: '111-11-1' }));

    expect(result.reference?.casNumber).toBe('111-11-1');
    expect(result.ambiguityReasons).toHaveLength(1);
    expect(result.ambiguityReasons[0]?.code).toBe('groupingEntry');
  });

  it('flags groupingEntry via a name collision when no CAS disambiguates', () => {
    const dataset = [
      entry({ indexNumber: '005-000-00-0', casNumber: '111-11-1', name: 'Shared Name' }),
      entry({ indexNumber: '005-000-00-0', casNumber: '222-22-2', name: 'Shared Name' }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Shared Name' }));

    expect(result.reference).toBeDefined();
    expect(result.ambiguityReasons).toHaveLength(1);
    expect(result.ambiguityReasons[0]?.code).toBe('groupingEntry');
  });

  it('flags missingScl for a CMR classification with no specific concentration limit', () => {
    const dataset = [
      entry({
        indexNumber: '001-001-00-1',
        casNumber: '100-00-0',
        name: 'Cmr Substance',
        cmr: {
          classifications: [{ endpoint: 'carcinogenicity', category: '1B' }],
        },
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Cmr Substance', casNumber: '100-00-0' }));

    expect(result.ambiguityReasons).toHaveLength(1);
    expect(result.ambiguityReasons[0]?.code).toBe('missingScl');
  });

  it('does not flag missingScl for a skin/eye classification with no SCL (CMR-only scope)', () => {
    const dataset = [
      entry({
        indexNumber: '001-001-00-1',
        casNumber: '100-00-0',
        name: 'Skin Substance',
        skinEyeCorrosion: {
          classifications: [{ classification: 'skinIrrit2' }],
        },
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Skin Substance', casNumber: '100-00-0' }));

    expect(result.ambiguityReasons).toEqual([]);
  });

  it('flags relevantNoteCode when the matched entry carries note codes', () => {
    const dataset = [
      entry({
        indexNumber: '001-001-00-1',
        casNumber: '100-00-0',
        name: 'Noted Substance',
        noteCodes: ['11'],
      }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'Noted Substance', casNumber: '100-00-0' }));

    expect(result.ambiguityReasons).toHaveLength(1);
    expect(result.ambiguityReasons[0]?.code).toBe('relevantNoteCode');
  });

  it('collects multiple simultaneous ambiguity reasons on one entry (boric-acid-shaped)', () => {
    const dataset = [
      entry({
        indexNumber: '005-007-00-2',
        casNumber: '10043-35-3',
        name: 'boric acid',
        cmr: {
          classifications: [{ endpoint: 'reproductiveToxicity', category: '1B' }],
        },
        noteCodes: ['11'],
      }),
      entry({ indexNumber: '005-007-00-2', casNumber: '11113-50-1', name: 'boric acid' }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'boric acid', casNumber: '10043-35-3' }));

    const codes = result.ambiguityReasons.map((reason) => reason.code).sort();
    expect(codes).toEqual(['groupingEntry', 'missingScl', 'relevantNoteCode']);
  });

  it('flags an unexpected duplicate CAS across the dataset rather than silently picking one', () => {
    const dataset = [
      entry({ indexNumber: '001-001-00-1', casNumber: '100-00-0', name: 'First' }),
      entry({ indexNumber: '002-002-00-2', casNumber: '100-00-0', name: 'Second' }),
    ];
    const match = buildSubstanceMatcher(dataset);

    const result = match(substance({ name: 'First', casNumber: '100-00-0' }));

    expect(result.reference).toBeDefined();
    expect(
      result.ambiguityReasons.some((reason) => reason.code === 'groupingEntry'),
    ).toBe(true);
  });

  describe('against the real Annex VI dataset', () => {
    const match = buildSubstanceMatcher(annexViDataset);

    it('flags boric acid with both groupingEntry and relevantNoteCode', () => {
      const result = match(substance({ name: 'boric acid', casNumber: '10043-35-3' }));

      const codes = result.ambiguityReasons.map((reason) => reason.code);
      expect(codes).toContain('groupingEntry');
      expect(codes).toContain('relevantNoteCode');
    });

    it('flags formaldehyde with missingScl (real Annex VI CMR entries lack an SCL)', () => {
      const result = match(substance({ name: 'Formaldehyde', casNumber: '50-00-0' }));

      expect(result.ambiguityReasons.some((reason) => reason.code === 'missingScl')).toBe(
        true,
      );
    });

    // These three go through compoundFormulation() on real mock formulations, rather than
    // the substance() stub above, so a mismatch between compounding output and matcher input
    // (e.g. name mangling) would also surface here.
    function compoundedByName(
      formulation: Parameters<typeof compoundFormulation>[0],
      name: string,
    ) {
      const found = compoundFormulation(formulation).find((s) => s.name === name);
      if (found === undefined) {
        throw new Error(`no compounded substance named "${name}" in this formulation`);
      }
      return found;
    }

    it('flags Dursban Technical (chlorpyrifos synonym, no CAS) with synonymMismatch', () => {
      const compounded = compoundedByName(agriguard480ec, 'Dursban Technical');
      const result = match(compounded);

      expect(result.reference).toBeUndefined();
      expect(result.ambiguityReasons.map((r) => r.code)).toEqual(['synonymMismatch']);
    });

    it('flags phosphoric acid with relevantNoteCode alone (real Annex VI Note B)', () => {
      const compounded = compoundedByName(fieldclearDust, 'Phosphoric acid');
      const result = match(compounded);

      expect(result.reference).toBeDefined();
      expect(result.ambiguityReasons.map((r) => r.code)).toEqual(['relevantNoteCode']);
    });

    it('resolves Methanol as a clean match with no ambiguity reasons, for contrast', () => {
      const compounded = compoundedByName(agriguard480ec, 'Methanol');
      const result = match(compounded);

      expect(result.reference).toBeDefined();
      expect(result.ambiguityReasons).toEqual([]);
    });
  });
});
