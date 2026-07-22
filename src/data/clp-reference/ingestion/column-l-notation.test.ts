import { describe, expect, it } from 'vitest';
import {
  classifyColumnLLine,
  parseAteLine,
  parseColumnL,
  parseSclLine,
} from './column-l-notation.js';

describe('parseAteLine', () => {
  it('parses an oral ATE line', () => {
    expect(parseAteLine('oral: ATE = 890.0 mg/kg bw')).toEqual({ route: 'oral', value: 890 });
  });

  it('parses an inhalation ATE line', () => {
    expect(parseAteLine('inhalation: ATE = 0.75 mg/L dusts or mists')).toEqual({
      route: 'inhalation',
      value: 0.75,
    });
  });

  it('returns undefined for a non-ATE line', () => {
    expect(parseAteLine('M = 10')).toBeUndefined();
  });
});

describe('parseSclLine', () => {
  it('parses the gte form', () => {
    expect(parseSclLine('Eye Dam. 1; H318: C ≥ 22.0%')).toEqual({
      hazardText: 'Eye Dam. 1',
      hCode: 'H318',
      concentrationPercent: 22,
    });
  });

  it('parses the range form, taking the lower bound', () => {
    expect(parseSclLine('Eye Irrit. 2; H319: 14.0% ≤ C < 22.0%')).toEqual({
      hazardText: 'Eye Irrit. 2',
      hCode: 'H319',
      concentrationPercent: 14,
    });
  });

  it('returns undefined for a non-SCL line', () => {
    expect(parseSclLine('oral: ATE = 890.0 mg/kg bw')).toBeUndefined();
    expect(parseSclLine('M = 10')).toBeUndefined();
  });
});

describe('classifyColumnLLine', () => {
  it('classifies an oral ATE line', () => {
    expect(classifyColumnLLine('oral: ATE = 890.0 mg/kg bw')).toEqual({
      kind: 'oralAte',
      value: 890,
    });
  });

  it('discards a non-oral ATE line', () => {
    expect(classifyColumnLLine('inhalation: ATE = 0.75 mg/L dusts or mists')).toEqual({
      kind: 'discardedAte',
    });
  });

  it('discards an M-factor line', () => {
    expect(classifyColumnLLine('M = 10')).toEqual({ kind: 'mFactor' });
  });

  it('classifies a v1-relevant SCL line into an SclEntry', () => {
    expect(classifyColumnLLine('Eye Dam. 1; H318: C ≥ 22.0%')).toEqual({
      kind: 'scl',
      entry: { target: { kind: 'skinEye', classification: 'eyeDam1' }, concentrationPercent: 22 },
    });
  });

  it('discards an SCL line for a non-v1 hazard class', () => {
    expect(classifyColumnLLine('Skin Sens. 1; H317: C ≥ 1.0%')).toEqual({ kind: 'discardedScl' });
  });

  it('propagates a hazard-classifier reject as a line reject', () => {
    const result = classifyColumnLLine('Repr.; H360: C ≥ 0.3%');
    expect(result.kind).toBe('reject');
  });

  it('rejects a wholly unrecognized line', () => {
    const result = classifyColumnLLine('some unrecognized free text');
    expect(result.kind).toBe('reject');
  });
});

describe('parseColumnL', () => {
  it('partitions a mixed cell into oral ATE, SCL entries, and rejects', () => {
    const cell = [
      'inhalation: ATE = 0.75 mg/L dusts or mists',
      'oral: ATE = 890.0 mg/kg bw',
      'Eye Dam. 1; H318: C ≥ 22.0%',
      'Eye Irrit. 2; H319: 14.0% ≤ C < 22.0%',
      'this line is garbage',
    ].join('\n');

    const result = parseColumnL(cell);

    expect(result.oralAteMgPerKg).toBe(890);
    expect(result.sclEntries).toEqual([
      { target: { kind: 'skinEye', classification: 'eyeDam1' }, concentrationPercent: 22 },
      { target: { kind: 'skinEye', classification: 'eyeIrrit2' }, concentrationPercent: 14 },
    ]);
    expect(result.rejects).toHaveLength(1);
    expect(result.rejects[0]?.rawText).toBe('this line is garbage');
  });

  it('discards M-factor-only cells with no rejects', () => {
    const result = parseColumnL('M = 10');
    expect(result).toEqual({ sclEntries: [], rejects: [] });
  });

  it('flags a duplicate oral ATE line as a reject instead of silently overwriting', () => {
    const result = parseColumnL('oral: ATE = 100 mg/kg bw\noral: ATE = 200 mg/kg bw');
    expect(result.oralAteMgPerKg).toBe(100);
    expect(result.rejects).toHaveLength(1);
  });
});
