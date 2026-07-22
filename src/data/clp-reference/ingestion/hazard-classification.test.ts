import { describe, expect, it } from 'vitest';
import {
  classifyHazardLine,
  parseHazardClassCodePairs,
  stripHCodeSuffix,
  stripMarkerSuffix,
} from './hazard-classification.js';

describe('stripMarkerSuffix', () => {
  it('strips a trailing single or double asterisk marker', () => {
    expect(stripMarkerSuffix('Acute Tox. 2 *')).toBe('Acute Tox. 2');
    expect(stripMarkerSuffix('H372 **')).toBe('H372');
  });

  it('leaves unmarked text untouched', () => {
    expect(stripMarkerSuffix('Skin Corr. 1A')).toBe('Skin Corr. 1A');
  });
});

describe('stripHCodeSuffix', () => {
  it('strips a fertility/development qualifier suffix', () => {
    expect(stripHCodeSuffix('H361fd')).toBe('H361');
    expect(stripHCodeSuffix('H360F')).toBe('H360');
    expect(stripHCodeSuffix('H361d')).toBe('H361');
  });

  it('strips a trailing marker before checking for a letter suffix', () => {
    expect(stripHCodeSuffix('H372 **')).toBe('H372');
  });

  it('leaves a plain H-code untouched', () => {
    expect(stripHCodeSuffix('H301')).toBe('H301');
  });
});

describe('parseHazardClassCodePairs', () => {
  it('zips equal-length G/H columns by line', () => {
    const result = parseHazardClassCodePairs(
      'Carc. 1B\nAcute Tox. 2 *\nAcute Tox. 3 *',
      'H350i\nH330\nH301',
    );
    expect(result).toEqual({
      pairs: [
        { classText: 'Carc. 1B', hCode: 'H350i' },
        { classText: 'Acute Tox. 2 *', hCode: 'H330' },
        { classText: 'Acute Tox. 3 *', hCode: 'H301' },
      ],
    });
  });

  it('rejects on a line-count mismatch', () => {
    const result = parseHazardClassCodePairs('Skin Corr. 1A\nEye Dam. 1', 'H314');
    expect('reject' in result).toBe(true);
    if ('reject' in result) {
      expect(result.reject.reason).toContain('line count mismatch');
    }
  });
});

describe('classifyHazardLine', () => {
  it('classifies an oral acute-toxicity line', () => {
    expect(classifyHazardLine('Acute Tox. 3 *', 'H301')).toEqual({
      kind: 'acuteToxOral',
      category: '3',
    });
  });

  it('discards a non-oral acute-toxicity route as irrelevant', () => {
    expect(classifyHazardLine('Acute Tox. 2 *', 'H330')).toEqual({ kind: 'irrelevant' });
  });

  it('rejects an unrecognized Acute Tox. category', () => {
    const result = classifyHazardLine('Acute Tox. X', 'H301');
    expect(result.kind).toBe('reject');
  });

  it('classifies skin/eye corrosion and irritation lines', () => {
    expect(classifyHazardLine('Skin Corr. 1B', 'H314')).toEqual({
      kind: 'skinEye',
      classification: 'skinCorr1B',
    });
    expect(classifyHazardLine('Skin Irrit. 2', 'H315')).toEqual({
      kind: 'skinEye',
      classification: 'skinIrrit2',
    });
    expect(classifyHazardLine('Eye Dam. 1', 'H318')).toEqual({
      kind: 'skinEye',
      classification: 'eyeDam1',
    });
    expect(classifyHazardLine('Eye Irrit. 2', 'H319')).toEqual({
      kind: 'skinEye',
      classification: 'eyeIrrit2',
    });
  });

  it('classifies CMR lines across all three endpoints', () => {
    expect(classifyHazardLine('Carc. 1B', 'H350i')).toEqual({
      kind: 'cmr',
      endpoint: 'carcinogenicity',
      category: '1B',
    });
    expect(classifyHazardLine('Muta. 2', 'H341')).toEqual({
      kind: 'cmr',
      endpoint: 'mutagenicity',
      category: '2',
    });
    expect(classifyHazardLine('Repr. 1A', 'H360F')).toEqual({
      kind: 'cmr',
      endpoint: 'reproductiveToxicity',
      category: '1A',
    });
  });

  it('rejects an unrecognized CMR category suffix', () => {
    const result = classifyHazardLine('Repr.', 'H360');
    expect(result.kind).toBe('reject');
  });

  it('discards a non-v1 hazard class as irrelevant, not a reject', () => {
    expect(classifyHazardLine('Flam. Liq. 2', 'H225')).toEqual({ kind: 'irrelevant' });
    expect(classifyHazardLine('Skin Sens. 1', 'H317')).toEqual({ kind: 'irrelevant' });
    expect(classifyHazardLine('STOT RE 1', 'H372')).toEqual({ kind: 'irrelevant' });
  });
});
