import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type { AnnexViRowInput } from './types.js';

const SHEET_NAME = 'ATP23';
const FIRST_DATA_ROW = 4; // row 1 = disclaimer, row 2 = blank spacer, row 3 = header

const COLUMNS = {
  indexNumber: 'A',
  chemicalName: 'D',
  casNo: 'F',
  hazardClassCodes: 'G',
  hazardStatementCodes: 'H',
  mSclAte: 'L',
  notes: 'M',
} as const;

/** Flattens an ExcelJS cell value (plain string, number, Date, or rich-text run list) to a
 * plain trimmed string, joining rich-text runs with no separator since Annex VI cells never
 * mix runs across a `\n` line break — the break itself is embedded in the text. */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((run) => run.text).join('').trim();
  }
  if (typeof value === 'object' && 'text' in value) {
    return String(value.text).trim();
  }
  return JSON.stringify(value);
}

/**
 * Extracts one `AnnexViRowInput` per data row (row `FIRST_DATA_ROW` through the sheet's last
 * row) from an already-loaded `ATP23` worksheet. Pure/no I/O — the seam the in-memory test
 * exercises directly, without touching disk.
 */
export function extractAnnexViRows(sheet: ExcelJS.Worksheet): AnnexViRowInput[] {
  const rows: AnnexViRowInput[] = [];
  const lastRow = Math.max(sheet.actualRowCount, sheet.rowCount);

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= lastRow; rowNumber++) {
    const excelRow = sheet.getRow(rowNumber);
    const indexNumber = cellText(excelRow.getCell(COLUMNS.indexNumber).value);
    if (indexNumber.length === 0) continue; // no stray blank/footer rows expected, but skip defensively

    rows.push({
      rowNumber,
      indexNumber,
      chemicalName: cellText(excelRow.getCell(COLUMNS.chemicalName).value),
      casNo: cellText(excelRow.getCell(COLUMNS.casNo).value),
      hazardClassCodes: cellText(excelRow.getCell(COLUMNS.hazardClassCodes).value),
      hazardStatementCodes: cellText(excelRow.getCell(COLUMNS.hazardStatementCodes).value),
      mSclAte: cellText(excelRow.getCell(COLUMNS.mSclAte).value),
      notes: cellText(excelRow.getCell(COLUMNS.notes).value),
    });
  }

  return rows;
}

/**
 * ExcelJS refuses to load any workbook containing a worksheet literally named "History"
 * (Excel's own reserved name for legacy shared-workbook change tracking) — and ECHA's real
 * export ships exactly that second sheet. We only ever read `ATP23`, so this renames the
 * `History` sheet in the raw `xl/workbook.xml` part before handing the zip to ExcelJS,
 * sidestepping the guard without touching the vendored file on disk. The patched zip is
 * written to a throwaway temp file rather than loaded from a buffer directly — ExcelJS's
 * bundled types pin an incompatible `Buffer` generic that only `readFile(path)` avoids.
 */
async function loadWorkbookAvoidingReservedSheetName(filePath: string): Promise<ExcelJS.Workbook> {
  const buffer = await readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const workbookXmlPart = zip.file('xl/workbook.xml');
  if (workbookXmlPart) {
    const workbookXml = await workbookXmlPart.async('text');
    zip.file('xl/workbook.xml', workbookXml.replace('name="History"', 'name="History_orig"'));
  }
  const patchedBuffer = await zip.generateAsync({ type: 'nodebuffer' });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'annex-vi-ingestion-'));
  const tempPath = path.join(tempDir, 'patched.xlsx');
  try {
    await writeFile(tempPath, patchedBuffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempPath);
    return workbook;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

/** Opens the vendored Annex VI export and extracts its `ATP23` worksheet's data rows. */
export async function readAnnexViSheetRows(filePath: string): Promise<AnnexViRowInput[]> {
  const workbook = await loadWorkbookAvoidingReservedSheetName(filePath);
  const sheet = workbook.getWorksheet(SHEET_NAME);
  if (!sheet) {
    throw new Error(`worksheet "${SHEET_NAME}" not found in ${filePath}`);
  }
  return extractAnnexViRows(sheet);
}
