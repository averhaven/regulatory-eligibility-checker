import { describe, expect, it } from 'vitest';
import { ClpReferenceEntrySchema } from '../../../schemas/clp-reference.js';
import { clpReferenceDataset } from './dataset.js';

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
