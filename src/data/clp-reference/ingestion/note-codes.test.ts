import { describe, expect, it } from 'vitest';
import { parseNoteCodes } from './note-codes.js';

describe('parseNoteCodes', () => {
  it('splits a multi-line notes cell into individual codes', () => {
    expect(parseNoteCodes('A\nC')).toEqual(['A', 'C']);
    expect(parseNoteCodes('A\nX\n12')).toEqual(['A', 'X', '12']);
  });

  it('returns a single-element array for one code', () => {
    expect(parseNoteCodes('11')).toEqual(['11']);
  });

  it('returns an empty array for undefined or blank input', () => {
    expect(parseNoteCodes(undefined)).toEqual([]);
    expect(parseNoteCodes('')).toEqual([]);
  });

  it('trims whitespace and drops blank lines', () => {
    expect(parseNoteCodes(' A \n\n C ')).toEqual(['A', 'C']);
  });
});
