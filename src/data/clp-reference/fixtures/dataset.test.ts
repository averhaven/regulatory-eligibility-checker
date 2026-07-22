import { describe, expect, it } from 'vitest';
import { ClpReferenceEntrySchema } from '../../../schemas/clp-reference.js';
import { clpReferenceDataset, lookupByCasOrName } from './dataset.js';

describe('clpReferenceDataset', () => {
  it('every entry parses against ClpReferenceEntrySchema', () => {
    for (const entry of clpReferenceDataset) {
      const result = ClpReferenceEntrySchema.safeParse(entry);
      expect(
        result.success,
        JSON.stringify(result.success ? null : result.error.issues),
      ).toBe(true);
    }
  });

  it('covers the 14 real substances used in the mock dataset', () => {
    expect(clpReferenceDataset).toHaveLength(14);
  });

  it('CAS numbers are unique', () => {
    const casNumbers = clpReferenceDataset
      .map((entry) => entry.casNumber)
      .filter((cas): cas is string => cas !== undefined);
    expect(new Set(casNumbers).size).toBe(casNumbers.length);
  });

  it('index numbers are unique', () => {
    const indexNumbers = clpReferenceDataset.map((entry) => entry.indexNumber);
    expect(new Set(indexNumbers).size).toBe(indexNumbers.length);
  });
});

describe('lookupByCasOrName', () => {
  it('matches by CAS number', () => {
    const found = lookupByCasOrName({
      key: '1310-58-3',
      name: 'Potassium Hydroxide Anhydrous', // deliberately different casing/wording than the dataset name
      casNumber: '1310-58-3',
      totalConcentration: 1,
      contributions: [],
    });
    expect(found?.name).toBe('Potassium hydroxide');
  });

  it('falls back to an exact case-insensitive name match when no CAS is given', () => {
    const found = lookupByCasOrName({
      key: 'chlorpyrifos',
      name: 'chlorpyrifos',
      totalConcentration: 1,
      contributions: [],
    });
    expect(found?.casNumber).toBe('2921-88-2');
  });

  it('returns undefined for a synonym not present in the dataset (e.g. "Dursban Technical")', () => {
    const found = lookupByCasOrName({
      key: 'Dursban Technical',
      name: 'Dursban Technical',
      totalConcentration: 1,
      contributions: [],
    });
    expect(found).toBeUndefined();
  });
});
