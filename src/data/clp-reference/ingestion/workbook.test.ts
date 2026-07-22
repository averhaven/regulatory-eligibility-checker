import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { extractAnnexViRows } from './workbook.js';

function buildFabricatedSheet(): ExcelJS.Worksheet {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ATP23');

  sheet.getCell('A1').value = 'Disclaimer text spanning A1:M1';
  sheet.mergeCells('A1:M1');
  // row 2 intentionally left blank (spacer row)
  sheet.getRow(3).values = [
    'Index No',
    'ATP',
    'CELEX',
    'Chemical Name',
    'EC No',
    'CAS No',
    'Hazard Class and Category Code(s)',
    'Classification Hazard Statement Code(s)',
    'Labelling Pictogram, Signal Word Code(s)',
    'Labelling Hazard Statement Code(s)',
    'Labelling Suppl. Hazard Statement Code(s)',
    'M, SCL, ATE',
    'Notes',
  ];

  const row4 = sheet.getRow(4);
  row4.getCell('A').value = '001-001-00-9';
  row4.getCell('D').value = { richText: [{ text: 'hydro' }, { text: 'gen' }] };
  row4.getCell('F').value = '1333-74-0';
  row4.getCell('G').value = 'Flam. Gas 1\nPress. Gas';
  row4.getCell('H').value = 'H220\nH220';
  row4.getCell('L').value = '';
  row4.getCell('M').value = '';

  const row5 = sheet.getRow(5);
  row5.getCell('A').value = '006-003-00-3';
  row5.getCell('D').value = 'carbon disulphide';
  row5.getCell('F').value = '75-15-0';
  row5.getCell('G').value = 'Acute Tox. 3';
  row5.getCell('H').value = 'H301';
  row5.getCell('L').value = 'oral: ATE = 100.0 mg/kg bw';
  row5.getCell('M').value = 'A';

  return sheet;
}

describe('extractAnnexViRows', () => {
  it('maps A/D/F/G/H/L/M columns starting at row 4, skipping the disclaimer/spacer/header rows', () => {
    const rows = extractAnnexViRows(buildFabricatedSheet());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      rowNumber: 4,
      indexNumber: '001-001-00-9',
      chemicalName: 'hydrogen',
      casNo: '1333-74-0',
      hazardClassCodes: 'Flam. Gas 1\nPress. Gas',
      hazardStatementCodes: 'H220\nH220',
      mSclAte: '',
      notes: '',
    });
    expect(rows[1]).toEqual({
      rowNumber: 5,
      indexNumber: '006-003-00-3',
      chemicalName: 'carbon disulphide',
      casNo: '75-15-0',
      hazardClassCodes: 'Acute Tox. 3',
      hazardStatementCodes: 'H301',
      mSclAte: 'oral: ATE = 100.0 mg/kg bw',
      notes: 'A',
    });
  });

  it('flattens rich-text cell runs into a plain joined string', () => {
    const rows = extractAnnexViRows(buildFabricatedSheet());
    expect(rows[0]?.chemicalName).toBe('hydrogen');
  });

  it('returns an empty array for a sheet with no data rows', () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('ATP23');
    sheet.getRow(3).values = ['Index No'];
    expect(extractAnnexViRows(sheet)).toEqual([]);
  });
});
