import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClpReferenceEntry } from '../../../schemas/clp-reference.js';
import { parseClpExportRow, type RawClpExportRow } from '../loader.js';
import { assembleRowsForSheetRow } from './assemble-row.js';
import { buildProvenance } from './provenance.js';
import type { AnnexViProvenance, RejectRecord } from './types.js';
import { readAnnexViSheetRows } from './workbook.js';

const INGESTION_DIR = path.dirname(fileURLToPath(import.meta.url));
export const SOURCE_XLSX = path.join(INGESTION_DIR, 'annex_vi_clp_table_atp23_en.xlsx');
export const OUTPUT_DIR = path.join(INGESTION_DIR, '..', 'generated');
export const ATP_VERSION = 23;

export interface IngestionResult {
  sheetRowCount: number;
  entries: ClpReferenceEntry[];
  rejects: RejectRecord[];
  provenance: AnnexViProvenance;
}

interface AssembledRawRow {
  raw: RawClpExportRow;
  sourceRowNumber: number;
  sourceIndexNumber: string;
}

/** Runs the full pipeline (read sheet -> assemble rows -> `parseClpExportRow`) in memory, with
 * no file I/O beyond reading the vendored xlsx. Shared by `run.ts` (writes the generated
 * artifacts) and `smoke-check.ts` (asserts against a fresh run without writing anything). */
export async function runIngestion(): Promise<IngestionResult> {
  const sheetRows = await readAnnexViSheetRows(SOURCE_XLSX);

  const rawRows: AssembledRawRow[] = [];
  const rejects: RejectRecord[] = [];

  for (const sheetRow of sheetRows) {
    const assembled = assembleRowsForSheetRow(sheetRow);
    for (const raw of assembled.rows) {
      rawRows.push({ raw, sourceRowNumber: sheetRow.rowNumber, sourceIndexNumber: sheetRow.indexNumber });
    }
    rejects.push(...assembled.rejects);
  }

  const entries: ClpReferenceEntry[] = [];
  for (const { raw, sourceRowNumber, sourceIndexNumber } of rawRows) {
    try {
      entries.push(parseClpExportRow(raw));
    } catch (error) {
      rejects.push({
        rowNumber: sourceRowNumber,
        indexNumber: sourceIndexNumber,
        column: 'assembled-row',
        rawText: JSON.stringify(raw),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const provenance = buildProvenance(path.basename(SOURCE_XLSX), ATP_VERSION, new Date());

  return { sheetRowCount: sheetRows.length, entries, rejects, provenance };
}

export function rejectsByColumn(rejects: RejectRecord[]): Record<string, number> {
  return rejects.reduce<Record<string, number>>((acc, r) => {
    acc[r.column] = (acc[r.column] ?? 0) + 1;
    return acc;
  }, {});
}
