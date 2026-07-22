import { describe, expect, it } from 'vitest';
import { expandSubstanceIdentities } from './substance-identity.js';

describe('expandSubstanceIdentities', () => {
  it('handles a plain single substance', () => {
    expect(expandSubstanceIdentities('hydrogen', '1333-74-0')).toEqual({
      identities: [{ name: 'hydrogen', casNumber: '1333-74-0' }],
    });
  });

  it('handles a class-of-substances grouping entry (no CAS, untagged name)', () => {
    const name =
      'beryllium compounds with the exception of aluminium beryllium silicates, and with those specified elsewhere in this Annex';
    expect(expandSubstanceIdentities(name, '-')).toEqual({
      identities: [{ name, casNumber: undefined }],
    });
  });

  it('expands a bracket-tagged multi-substance entry, including a member with no CAS', () => {
    const name = [
      'perboric acid, sodium salt [1]',
      'perboric acid, sodium salt, monohydrate [2]',
      'perboric acid (HBO(O2)), sodium salt, monohydrate [3]',
      'sodium peroxoborate [4]',
      'sodium perborate [5]',
    ].join('\n');
    const cas = [
      '11138-47-9 [1]',
      '12040-72-1 [2]',
      '10332-33-9 [3]',
      '- [4]',
      '15120-21-5 [5]',
    ].join('\n');

    const result = expandSubstanceIdentities(name, cas);
    expect(result).toEqual({
      identities: [
        { name: 'perboric acid, sodium salt', casNumber: '11138-47-9' },
        { name: 'perboric acid, sodium salt, monohydrate', casNumber: '12040-72-1' },
        { name: 'perboric acid (HBO(O2)), sodium salt, monohydrate', casNumber: '10332-33-9' },
        { name: 'sodium peroxoborate', casNumber: undefined },
        { name: 'sodium perborate', casNumber: '15120-21-5' },
      ],
    });
  });

  it('rejects a multi-line chemical name with no bracket tags', () => {
    const result = expandSubstanceIdentities('foo\nbar', '-');
    expect('reject' in result).toBe(true);
  });

  it('rejects a bracket-tagged name with an untagged CAS column', () => {
    const result = expandSubstanceIdentities('foo [1]\nbar [2]', '111-11-1');
    expect('reject' in result).toBe(true);
  });

  it('rejects a bracket-tag mismatch between name and CAS columns', () => {
    const result = expandSubstanceIdentities('foo [1]\nbar [2]', '111-11-1 [1]\n222-22-2 [3]');
    expect('reject' in result).toBe(true);
  });
});
