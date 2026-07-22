import assert from 'node:assert/strict';
import { rejectsByColumn, runIngestion } from './pipeline.js';

/**
 * Opt-in sanity check against the real vendored xlsx — deliberately kept out of `npm test`
 * (Vitest's default `*.test.ts` glob), since it depends on a 1.1MB binary and real-world data
 * shape that drifts with each ATP re-ingestion; it shouldn't be able to break the fast unit
 * test loop. Run manually via `npm run ingest:annex-vi:smoke`.
 */
async function main(): Promise<void> {
  const { sheetRowCount, entries, rejects, provenance } = await runIngestion();

  assert.ok(sheetRowCount > 1000, `expected a substantial sheet row count, got ${sheetRowCount}`);
  assert.ok(entries.length > 0, 'expected at least one entry to be emitted');

  const byColumn = rejectsByColumn(rejects);
  const rejectRate = rejects.length / sheetRowCount;

  console.log(`Annex VI ingestion smoke check (ATP${provenance.atpVersion}, ${provenance.sourceFile})`);
  console.log(`  sheet rows read:  ${sheetRowCount}`);
  console.log(`  entries emitted:  ${entries.length}`);
  console.log(`  rejects:          ${rejects.length} (${(rejectRate * 100).toFixed(2)}%)`, byColumn);

  if (rejects.length > 0) {
    console.log('  reject samples (up to 10):');
    for (const reject of rejects.slice(0, 10)) {
      console.log(`    [${reject.column}] ${reject.indexNumber}: ${reject.reason} — ${reject.rawText}`);
    }
  }

  // A loud, human-reviewable warning rather than a hard failure: a reject rate creeping up
  // after a future ATP re-ingestion is a signal to look at the report, not necessarily a bug.
  const REJECT_RATE_WARNING_THRESHOLD = 0.01;
  if (rejectRate > REJECT_RATE_WARNING_THRESHOLD) {
    console.warn(
      `  WARNING: reject rate ${(rejectRate * 100).toFixed(2)}% exceeds ${REJECT_RATE_WARNING_THRESHOLD * 100}% — review generated/annex-vi.rejects.json after the next full run.`,
    );
  }

  console.log('smoke check passed.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
