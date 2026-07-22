import { describe, expect, it } from 'vitest';
import { assembleRowsForSheetRow } from './assemble-row.js';
import type { AnnexViRowInput } from './types.js';

function row(overrides: Partial<AnnexViRowInput>): AnnexViRowInput {
  return {
    rowNumber: 4,
    indexNumber: '000-000-00-0',
    chemicalName: 'test substance',
    casNo: '111-11-1',
    hazardClassCodes: '',
    hazardStatementCodes: '',
    mSclAte: '',
    notes: '',
    ...overrides,
  };
}

describe('assembleRowsForSheetRow', () => {
  it('filters out a row with no v1-relevant hazard classification (e.g. hydrogen)', () => {
    const result = assembleRowsForSheetRow(
      row({
        indexNumber: '001-001-00-9',
        chemicalName: 'hydrogen',
        casNo: '1333-74-0',
        hazardClassCodes: 'Flam. Gas 1\nPress. Gas',
        hazardStatementCodes: 'H220',
      }),
    );
    expect(result).toEqual({ rows: [], rejects: [] });
  });

  it('drops "Press. Gas" before zipping G/H, since it carries no H-code of its own', () => {
    const result = assembleRowsForSheetRow(
      row({
        chemicalName: 'compressed corrosive gas',
        hazardClassCodes: 'Press. Gas\nSkin Corr. 1A',
        hazardStatementCodes: 'H314',
      }),
    );
    expect(result.rejects).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.skinEyeCorrosion).toEqual([{ classification: 'skinCorr1A' }]);
  });

  it('drops a non-oral acute-tox line but keeps the CMR classification (beryllium-shaped row)', () => {
    const result = assembleRowsForSheetRow(
      row({
        indexNumber: '004-001-00-7',
        chemicalName: 'beryllium',
        casNo: '7440-41-7',
        hazardClassCodes:
          'Carc. 1B\nAcute Tox. 2 *\nAcute Tox. 3 *\nSTOT SE 3\nSTOT RE 1\nSkin Irrit. 2\nEye Irrit. 2\nSkin Sens. 1',
        hazardStatementCodes: 'H350i\nH330\nH301\nH335\nH372 **\nH315\nH319\nH317',
      }),
    );
    expect(result.rejects).toEqual([]);
    expect(result.rows).toEqual([
      {
        indexNumber: '004-001-00-7',
        casNumber: '7440-41-7',
        name: 'beryllium',
        acuteToxicityOral: { category: '3' },
        skinEyeCorrosion: [
          { classification: 'skinIrrit2' },
          { classification: 'eyeIrrit2' },
        ],
        cmr: [{ endpoint: 'carcinogenicity', category: '1B' }],
      },
    ]);
  });

  it('attaches SCLs from column L to their declared classifications', () => {
    const result = assembleRowsForSheetRow(
      row({
        indexNumber: '005-022-00-4',
        chemicalName: 'test substance',
        casNo: '111-11-1',
        hazardClassCodes: 'Eye Dam. 1\nEye Irrit. 2',
        hazardStatementCodes: 'H318\nH319',
        mSclAte: 'Eye Dam. 1; H318: C ≥ 22.0%\nEye Irrit. 2; H319: 14.0% ≤ C < 22.0%',
      }),
    );
    expect(result.rejects).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.skinEyeCorrosion).toEqual([
      { classification: 'eyeDam1', specificConcentrationLimit: 22 },
      { classification: 'eyeIrrit2', specificConcentrationLimit: 14 },
    ]);
  });

  it('expands a bracket-tagged grouping entry into one row per member', () => {
    const result = assembleRowsForSheetRow(
      row({
        indexNumber: '005-022-00-4',
        chemicalName: 'perboric acid, sodium salt [1]\nsodium peroxoborate [4]',
        casNo: '11138-47-9 [1]\n- [4]',
        hazardClassCodes: 'Repr. 1B',
        hazardStatementCodes: 'H360FD',
      }),
    );
    expect(result.rejects).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.name)).toEqual([
      'perboric acid, sodium salt',
      'sodium peroxoborate',
    ]);
    expect(result.rows[0]?.casNumber).toBe('11138-47-9');
    expect(result.rows[1]?.casNumber).toBeUndefined();
    expect(result.rows[0]?.cmr).toEqual([{ endpoint: 'reproductiveToxicity', category: '1B' }]);
  });

  it('rejects on a G/H line-count mismatch and emits no rows', () => {
    const result = assembleRowsForSheetRow(
      row({
        hazardClassCodes: 'Skin Corr. 1A\nEye Dam. 1',
        hazardStatementCodes: 'H314',
      }),
    );
    expect(result.rows).toEqual([]);
    expect(result.rejects).toHaveLength(1);
    expect(result.rejects[0]?.column).toBe('G/H');
  });

  it('adds a skin/eye classification introduced only via column L (bridging tier not listed in G/H)', () => {
    // Real Annex VI shape: G/H states only the headline classification (Eye Dam. 1); L's SCL
    // cell separately spells out a lower-severity bridging tier (Eye Irrit. 2) with its own
    // concentration band that never gets its own G/H line at all.
    const result = assembleRowsForSheetRow(
      row({
        hazardClassCodes: 'Eye Dam. 1',
        hazardStatementCodes: 'H318',
        mSclAte: 'Eye Dam. 1; H318: C ≥ 22.0%\nEye Irrit. 2; H319: 14.0% ≤ C < 22.0%',
      }),
    );
    expect(result.rejects).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.skinEyeCorrosion).toEqual([
      { classification: 'eyeDam1', specificConcentrationLimit: 22 },
      { classification: 'eyeIrrit2', specificConcentrationLimit: 14 },
    ]);
  });

  it('carries note codes through onto the emitted row', () => {
    const result = assembleRowsForSheetRow(
      row({
        hazardClassCodes: 'Eye Dam. 1',
        hazardStatementCodes: 'H318',
        notes: 'A\n11',
      }),
    );
    expect(result.rows[0]?.noteCodes).toEqual(['A', '11']);
  });
});
