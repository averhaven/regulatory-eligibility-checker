import { classifyHazardLine, stripMarkerSuffix } from './hazard-classification.js';
import type { ColumnLResult, HazardLineResult, SclEntry } from './types.js';

export interface AteLine {
  route: 'oral' | 'dermal' | 'inhalation';
  value: number;
}

/** Matches an ATE line, e.g. "oral: ATE = 890.0 mg/kg bw" or
 * "inhalation: ATE = 0.75 mg/L dusts or mists". */
export function parseAteLine(line: string): AteLine | undefined {
  const match = /^(oral|dermal|inhalation):\s*ATE\s*=\s*([\d.]+)/i.exec(line.trim());
  if (!match) return undefined;
  return {
    route: (match[1] ?? '').toLowerCase() as AteLine['route'],
    value: Number(match[2] ?? ''),
  };
}

/** A number, allowing scientific notation (e.g. "5.0E-4"), the form used for very small
 * CMR concentration limits. */
const NUMBER_PATTERN = '[\\d.]+(?:[eE][+-]?\\d+)?';

export interface SclLineStructure {
  hazardText: string;
  hCode: string;
  /** The raw, marker-stripped threshold expression — not yet parsed into a number, since
   * whether an unusual form is worth rejecting depends on whether the classification turns
   * out to be v1-relevant (see `classifyColumnLLine`). */
  thresholdExpr: string;
}

/** Splits an SCL line, e.g. "Eye Dam. 1; H318: C ≥ 22.0% ****", into its hazard-class text,
 * H-code, and threshold expression. Returns `undefined` for lines with no
 * "hazardText; hCode: ..." shape at all (e.g. ATE/M-factor lines, or a bare EUH statement). */
function parseSclLineStructure(line: string): SclLineStructure | undefined {
  const outer = /^(.+?);\s*(H\d{3}[a-zA-Z]*)\s*:\s*(.+)$/.exec(line.trim());
  if (!outer) return undefined;
  return {
    hazardText: (outer[1] ?? '').trim(),
    hCode: outer[2] ?? '',
    thresholdExpr: stripMarkerSuffix(outer[3] ?? ''),
  };
}

/**
 * Parses a threshold expression into a single concentration percentage: "C ≥ X%" (also
 * accepting the equivalent "C > X%"/"C >= X%" spellings), or the range form
 * "X% ≤ C < Y%", whose lower bound is the threshold at which *this* classification (not the
 * neighboring one) starts to apply — matching how `SkinEyeCorrosionFacetSchema`/
 * `CmrFacetSchema` already store one threshold per classification code. Returns `undefined`
 * for anything else (e.g. an upper-bound-only "C ≤ Y%" form, seen only on non-v1 hazard
 * classes in practice).
 */
function parseThresholdExpr(expr: string): number | undefined {
  const gte = new RegExp(`^C\\s*(?:≥|>=|>)\\s*(${NUMBER_PATTERN})\\s*%$`).exec(expr);
  if (gte) return Number(gte[1] ?? '');

  const range = new RegExp(
    `^(${NUMBER_PATTERN})\\s*%\\s*(?:≤|<=)\\s*C\\s*(?:<|≤|<=)\\s*(${NUMBER_PATTERN})\\s*%$`,
  ).exec(expr);
  if (range) return Number(range[1] ?? '');

  return undefined;
}

export interface SclLine {
  hazardText: string;
  hCode: string;
  concentrationPercent: number;
}

/** Combines `parseSclLineStructure` and `parseThresholdExpr` — succeeds only when both the
 * line shape and the threshold expression are recognized. */
export function parseSclLine(line: string): SclLine | undefined {
  const structure = parseSclLineStructure(line);
  if (!structure) return undefined;
  const concentrationPercent = parseThresholdExpr(structure.thresholdExpr);
  if (concentrationPercent === undefined) return undefined;
  return { hazardText: structure.hazardText, hCode: structure.hCode, concentrationPercent };
}

/** Bare footnote-reference lines seen in real column L cells, e.g. "*" or "* oral" —
 * unrelated to any hazard class, always discarded. */
const FOOTNOTE_MARKER_LINE = /^\*+\s*(oral|dermal|inhalation)?$/i;

/** EU-specific supplementary hazard statements (e.g. "EUH031: C ≥ 1.0%") — never one of the
 * 3 v1 hazard families, and structurally different from an SCL line (no hazard-class prefix
 * before the code), so recognized directly rather than via `classifyHazardLine`. */
const EUH_STATEMENT_LINE = /^EUH\d{3}/;

export type ColumnLLineResult =
  | { kind: 'oralAte'; value: number }
  | { kind: 'discardedAte' }
  | { kind: 'mFactor' }
  | { kind: 'discardedScl' }
  | { kind: 'discardedOther' }
  | { kind: 'scl'; entry: SclEntry }
  | { kind: 'reject'; reason: string };

/**
 * Classifies a single `\n`-split line from column L (`M, SCL, ATE`). M-factors (aquatic-only),
 * non-oral ATE, bare footnote markers, and EUH supplementary statements are
 * recognized-and-discarded, matching the v1 scope decision in `hazard-classification.ts`. An
 * SCL line for a v1-irrelevant hazard class is discarded even if its threshold expression is
 * unusual — only a v1-*relevant* classification with an unparseable threshold is rejected,
 * since guessing a wrong concentration limit for a class the engine actually sums would be
 * worse than a loud failure. `hazardClassifier` is injectable for isolated testing; defaults
 * to the real `classifyHazardLine`.
 */
export function classifyColumnLLine(
  line: string,
  hazardClassifier: (classText: string, hCode: string) => HazardLineResult = classifyHazardLine,
): ColumnLLineResult {
  const trimmed = line.trim();

  if (FOOTNOTE_MARKER_LINE.test(trimmed) || EUH_STATEMENT_LINE.test(trimmed)) {
    return { kind: 'discardedOther' };
  }

  if (/^M\s*=\s*[\d.]+$/.test(trimmed)) {
    return { kind: 'mFactor' };
  }

  const ate = parseAteLine(trimmed);
  if (ate) {
    return ate.route === 'oral' ? { kind: 'oralAte', value: ate.value } : { kind: 'discardedAte' };
  }

  const structure = parseSclLineStructure(trimmed);
  if (structure) {
    const classified = hazardClassifier(structure.hazardText, structure.hCode);
    if (classified.kind === 'irrelevant') {
      return { kind: 'discardedScl' };
    }
    if (classified.kind === 'reject') {
      return { kind: 'reject', reason: classified.reason };
    }
    const concentrationPercent = parseThresholdExpr(structure.thresholdExpr);
    if (concentrationPercent === undefined) {
      return {
        kind: 'reject',
        reason: 'unrecognized concentration-limit expression for a v1-relevant classification',
      };
    }
    return { kind: 'scl', entry: { target: classified, concentrationPercent } };
  }

  return { kind: 'reject', reason: 'unrecognized column L line' };
}

/** Parses the full `\n`-delimited column L cell into an oral ATE (if any) and the SCL entries
 * relevant to the 3 v1 hazard families, collecting anything unrecognized as a reject. */
export function parseColumnL(text: string): ColumnLResult {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const result: ColumnLResult = { sclEntries: [], rejects: [] };

  for (const line of lines) {
    const classified = classifyColumnLLine(line);
    switch (classified.kind) {
      case 'oralAte':
        if (result.oralAteMgPerKg !== undefined) {
          result.rejects.push({ rawText: line, reason: 'duplicate oral ATE line' });
        } else {
          result.oralAteMgPerKg = classified.value;
        }
        break;
      case 'scl':
        result.sclEntries.push(classified.entry);
        break;
      case 'reject':
        result.rejects.push({ rawText: line, reason: classified.reason });
        break;
      case 'discardedAte':
      case 'mFactor':
      case 'discardedScl':
      case 'discardedOther':
        break;
    }
  }

  return result;
}
