import type { RawClpExportRow } from '../loader.js';
import { classifyHazardLine, parseHazardClassCodePairs } from './hazard-classification.js';
import { parseColumnL } from './column-l-notation.js';
import { expandSubstanceIdentities } from './substance-identity.js';
import { parseNoteCodes } from './note-codes.js';
import type { AnnexViRowInput, HazardTarget, ParseFailure, RejectRecord } from './types.js';

/**
 * Composes a single Annex VI sheet row into zero or more `RawClpExportRow`s (zero or many
 * because bracket-tagged grouping entries expand to one row per member substance) plus any
 * rejects encountered along the way. A row that carries no v1-relevant hazard classification
 * at all — the majority of Annex VI, which covers many hazard classes this project doesn't
 * model — produces no output row and is not itself an error.
 *
 * Note: a row that IS emitted but ends up with no oral acute-toxicity classification gets
 * `acuteToxicityOral` omitted, which `parseClpExportRow` treats as `oral: null` — "assessed,
 * not oral-toxic" — the same modeling already used for e.g. xylene in the fixture dataset.
 * Rows filtered out entirely (no v1-relevant classification anywhere) get no entry at all,
 * which the future matcher will treat as "unmatched" (unknown), not "known, zero hazard" —
 * a deliberately more conservative outcome, consistent with the closed-world invariant.
 */
export function assembleRowsForSheetRow(input: AnnexViRowInput): {
  rows: RawClpExportRow[];
  rejects: RejectRecord[];
} {
  const rejects: RejectRecord[] = [];
  const pushReject = (column: RejectRecord['column'], failure: ParseFailure): void => {
    rejects.push({
      rowNumber: input.rowNumber,
      indexNumber: input.indexNumber,
      column,
      ...failure,
    });
  };

  const pairsResult = parseHazardClassCodePairs(input.hazardClassCodes, input.hazardStatementCodes);
  if ('reject' in pairsResult) {
    pushReject('G/H', pairsResult.reject);
    return { rows: [], rejects };
  }

  const targets: HazardTarget[] = [];
  for (const pair of pairsResult.pairs) {
    const classified = classifyHazardLine(pair.classText, pair.hCode);
    if (classified.kind === 'reject') {
      pushReject('G/H', { rawText: classified.rawText, reason: classified.reason });
    } else if (classified.kind !== 'irrelevant') {
      targets.push(classified);
    }
  }

  const columnL = parseColumnL(input.mSclAte);
  for (const failure of columnL.rejects) {
    pushReject('L', failure);
  }

  if (
    targets.length === 0 &&
    columnL.oralAteMgPerKg === undefined &&
    columnL.sclEntries.length === 0
  ) {
    return { rows: [], rejects }; // no v1-relevant classification on this row — filtered out
  }

  // --- acute toxicity (oral) ---
  const oralTargets = targets.filter(
    (t): t is Extract<HazardTarget, { kind: 'acuteToxOral' }> => t.kind === 'acuteToxOral',
  );
  const uniqueOralCategories = [...new Set(oralTargets.map((t) => t.category))];
  if (uniqueOralCategories.length > 1) {
    pushReject('assembled-row', {
      rawText: uniqueOralCategories.join(', '),
      reason: 'multiple distinct oral acute-toxicity categories on one row',
    });
  }
  if (columnL.oralAteMgPerKg !== undefined && uniqueOralCategories.length !== 1) {
    pushReject('L', {
      rawText: String(columnL.oralAteMgPerKg),
      reason: 'oral ATE value with no single corresponding Acute Tox. oral category in G/H',
    });
  }
  const oralCategory = uniqueOralCategories[0];
  const acuteToxicityOral: RawClpExportRow['acuteToxicityOral'] =
    uniqueOralCategories.length === 1 && oralCategory !== undefined
      ? {
          category: oralCategory,
          ...(columnL.oralAteMgPerKg !== undefined && { ateMgPerKg: columnL.oralAteMgPerKg }),
        }
      : undefined;

  for (const stray of columnL.sclEntries.filter((e) => e.target.kind === 'acuteToxOral')) {
    pushReject('L', {
      rawText: `acuteToxOral ${stray.target.kind === 'acuteToxOral' ? stray.target.category : ''} @ ${stray.concentrationPercent}%`,
      reason: 'unexpected concentration-limit line for acute toxicity (no such facet)',
    });
  }

  // --- skin/eye corrosion ---
  // Column L's SCL cell is trusted as its own source of classifications, not merely a
  // modifier of what G/H already declared: Annex VI's convention is that G/H states a
  // substance's headline classification (e.g. Skin Corr. 1B), while the SCL cell separately
  // spells out lower-severity bridging tiers (e.g. Skin Irrit. 2 between two concentration
  // bands) that never get their own line in G/H at all. Requiring an SCL to match a G/H
  // line first was silently discarding this real bridging data (confirmed against the real
  // ATP23 export — see docs/PLAN.md Milestone 2.5).
  const skinEyeTargets = targets.filter(
    (t): t is Extract<HazardTarget, { kind: 'skinEye' }> => t.kind === 'skinEye',
  );
  const skinEyeScls = columnL.sclEntries.filter(
    (e): e is typeof e & { target: Extract<HazardTarget, { kind: 'skinEye' }> } =>
      e.target.kind === 'skinEye',
  );
  const skinEyeLimits = new Map<string, number>(skinEyeScls.map((e) => [e.target.classification, e.concentrationPercent]));
  const skinEyeClassifications = [
    ...new Set([...skinEyeTargets.map((t) => t.classification), ...skinEyeScls.map((e) => e.target.classification)]),
  ];
  const skinEyeCorrosion = skinEyeClassifications.map((classification) => {
    const specificConcentrationLimit = skinEyeLimits.get(classification);
    return {
      classification,
      ...(specificConcentrationLimit !== undefined && { specificConcentrationLimit }),
    };
  });

  // --- CMR --- (same "SCL is its own source" reasoning as skin/eye, above)
  const cmrTargets = targets.filter(
    (t): t is Extract<HazardTarget, { kind: 'cmr' }> => t.kind === 'cmr',
  );
  const cmrScls = columnL.sclEntries.filter(
    (e): e is typeof e & { target: Extract<HazardTarget, { kind: 'cmr' }> } => e.target.kind === 'cmr',
  );
  const cmrKey = (t: { endpoint: string; category: string }): string => `${t.endpoint}:${t.category}`;
  const cmrLimits = new Map<string, number>(cmrScls.map((e) => [cmrKey(e.target), e.concentrationPercent]));
  const cmrPairs = new Map<string, { endpoint: (typeof cmrTargets)[number]['endpoint']; category: (typeof cmrTargets)[number]['category'] }>();
  for (const t of [...cmrTargets, ...cmrScls.map((e) => e.target)]) {
    cmrPairs.set(cmrKey(t), t);
  }
  const cmr = [...cmrPairs.values()].map(({ endpoint, category }) => {
    const specificConcentrationLimit = cmrLimits.get(cmrKey({ endpoint, category }));
    return {
      endpoint,
      category,
      ...(specificConcentrationLimit !== undefined && { specificConcentrationLimit }),
    };
  });

  // --- substance identity (handles bracket-tagged grouping-entry expansion) ---
  const identitiesResult = expandSubstanceIdentities(input.chemicalName, input.casNo);
  if ('reject' in identitiesResult) {
    pushReject('D/F', identitiesResult.reject);
    return { rows: [], rejects };
  }

  const noteCodes = parseNoteCodes(input.notes);

  const rows: RawClpExportRow[] = identitiesResult.identities.map((identity) => ({
    indexNumber: input.indexNumber,
    ...(identity.casNumber !== undefined && { casNumber: identity.casNumber }),
    name: identity.name,
    ...(acuteToxicityOral !== undefined && { acuteToxicityOral }),
    ...(skinEyeCorrosion.length > 0 && { skinEyeCorrosion }),
    ...(cmr.length > 0 && { cmr }),
    ...(noteCodes.length > 0 && { noteCodes }),
  }));

  return { rows, rejects };
}
