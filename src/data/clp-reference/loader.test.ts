import { describe, expect, it } from 'vitest';
import { parseClpExportRow } from './loader.js';

describe('parseClpExportRow', () => {
  it('applies the Table 3.1.2 conversion when no ATE is published', () => {
    const entry = parseClpExportRow({
      indexNumber: '015-084-00-4',
      casNumber: '2921-88-2',
      name: 'Chlorpyrifos',
      acuteToxicityOral: { category: '3' },
    });
    expect(entry.acuteToxicity.oral).toEqual({
      route: 'oral',
      category: '3',
      ateMgPerKg: 100,
      ateSource: 'table-3.1.2-conversion',
    });
  });

  it('uses a published ATE value when given, instead of the conversion table', () => {
    const entry = parseClpExportRow({
      indexNumber: 'test-index',
      name: 'Test Substance',
      acuteToxicityOral: { category: '3', ateMgPerKg: 142 },
    });
    expect(entry.acuteToxicity.oral).toEqual({
      route: 'oral',
      category: '3',
      ateMgPerKg: 142,
      ateSource: 'published',
    });
  });

  it('models "no oral classification" (e.g. xylene) as null, not omitted', () => {
    const entry = parseClpExportRow({
      indexNumber: '601-022-00-9',
      casNumber: '1330-20-7',
      name: 'Xylene',
      acuteToxicityOral: null,
    });
    expect(entry.acuteToxicity.oral).toBeNull();
  });

  it('models a dual-classified substance (KOH: acute tox + skin/eye corrosion)', () => {
    const entry = parseClpExportRow({
      indexNumber: '019-002-00-8',
      casNumber: '1310-58-3',
      name: 'Potassium hydroxide',
      acuteToxicityOral: { category: '4' },
      skinEyeCorrosion: [
        { classification: 'skinCorr1A', specificConcentrationLimit: 5 },
        { classification: 'skinCorr1B', specificConcentrationLimit: 2 },
        { classification: 'skinIrrit2', specificConcentrationLimit: 0.5 },
      ],
    });
    expect(entry.acuteToxicity.oral?.category).toBe('4');
    expect(entry.skinEyeCorrosion.classifications).toHaveLength(3);
  });

  it('defaults skin/eye and CMR classifications to an empty array when omitted', () => {
    const entry = parseClpExportRow({
      indexNumber: 'none',
      casNumber: '7732-18-5',
      name: 'Water',
    });
    expect(entry.acuteToxicity.oral).toBeNull();
    expect(entry.skinEyeCorrosion.classifications).toEqual([]);
    expect(entry.cmr.classifications).toEqual([]);
  });
});
