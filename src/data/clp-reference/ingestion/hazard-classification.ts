import type {
  AcuteToxicityCategory,
  CmrCategory,
  CmrEndpoint,
  SkinEyeClassificationCode,
} from '../../../schemas/clp-reference.js';
import type { HazardLineResult, ParseFailure } from './types.js';

/** H-codes for the oral route of acute toxicity (H300 fatal, H301 toxic, H302 harmful).
 * Dermal (H310-H312) and inhalation (H330-H332) are out of v1 scope. */
const ACUTE_TOX_ORAL_H_CODES = new Set(['H300', 'H301', 'H302']);

const SKIN_EYE_TEXT_MAP: Record<string, SkinEyeClassificationCode> = {
  'Skin Corr. 1A': 'skinCorr1A',
  'Skin Corr. 1B': 'skinCorr1B',
  'Skin Corr. 1C': 'skinCorr1C',
  'Skin Irrit. 2': 'skinIrrit2',
  'Eye Dam. 1': 'eyeDam1',
  'Eye Irrit. 2': 'eyeIrrit2',
};

const CMR_PREFIX_MAP: Record<string, CmrEndpoint> = {
  'Carc.': 'carcinogenicity',
  'Muta.': 'mutagenicity',
  'Repr.': 'reproductiveToxicity',
};

/** Strips CLP's own trailing route/minimum-classification markers, e.g. "Acute Tox. 2 *" ->
 * "Acute Tox. 2", "H372 **" -> "H372". */
export function stripMarkerSuffix(text: string): string {
  return text.replace(/\s*\*+\s*$/, '').trim();
}

/** Strips a fertility/development qualifier letter suffix directly appended to an H-code,
 * e.g. "H361fd" -> "H361", "H360F" -> "H360" — not needed for v1, which only tracks category. */
export function stripHCodeSuffix(hCodeRaw: string): string {
  const withoutMarker = stripMarkerSuffix(hCodeRaw);
  const match = /^(H\d{3})[a-zA-Z]*$/.exec(withoutMarker);
  return match?.[1] ?? withoutMarker;
}

export interface HazardClassCodePair {
  classText: string;
  hCode: string;
}

/** Hazard classes in column G that carry no hazard-statement code of their own — CLP's
 * "Press. Gas" (compressed/liquefied/dissolved gas) is listed as a category with no H-code
 * line, unlike every other hazard class, which breaks the usual positional G/H zip. Always
 * irrelevant to v1 scope regardless, so it's simplest to drop it before pairing. */
const NO_H_CODE_CLASSES = new Set(['Press. Gas']);

/**
 * Splits and zips columns G (`Hazard Class and Category Code(s)`) and H
 * (`Classification Hazard Statement Code(s)`), which are `\n`-delimited and positionally
 * parallel once `NO_H_CODE_CLASSES` lines are removed from G. A line-count mismatch after
 * that removal means the pairing can't be trusted — reject rather than guess which class
 * goes with which H-code.
 */
export function parseHazardClassCodePairs(
  columnG: string,
  columnH: string,
): { pairs: HazardClassCodePair[] } | { reject: ParseFailure } {
  const gLines = columnG
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !NO_H_CODE_CLASSES.has(stripMarkerSuffix(s)));
  const hLines = columnH
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (gLines.length !== hLines.length) {
    return {
      reject: {
        rawText: `G: ${columnG}\nH: ${columnH}`,
        reason: `hazard class/H-code line count mismatch (${gLines.length} vs ${hLines.length})`,
      },
    };
  }

  return { pairs: gLines.map((classText, i) => ({ classText, hCode: hLines[i] ?? '' })) };
}

/**
 * Classifies a single hazard-class-text/H-code pair against the 3 v1 hazard families. Most
 * lines (physical hazards, aquatic toxicity, STOT, sensitization, non-oral acute-tox routes)
 * are recognized-and-discarded as `irrelevant`, not rejected — only a line that looks like it
 * belongs to a v1 family but doesn't parse cleanly is a `reject`.
 */
export function classifyHazardLine(classTextRaw: string, hCodeRaw: string): HazardLineResult {
  const text = stripMarkerSuffix(classTextRaw);
  const hCode = stripHCodeSuffix(hCodeRaw);

  if (text.startsWith('Acute Tox.')) {
    const match = /^Acute Tox\.\s*([1-4])$/.exec(text);
    if (!match) {
      return {
        kind: 'reject',
        rawText: `${classTextRaw} / ${hCodeRaw}`,
        reason: 'unrecognized Acute Tox. category',
      };
    }
    if (!ACUTE_TOX_ORAL_H_CODES.has(hCode)) {
      return { kind: 'irrelevant' }; // dermal/inhalation route, out of v1 scope
    }
    return { kind: 'acuteToxOral', category: (match[1] ?? '') as AcuteToxicityCategory };
  }

  const skinEyeClassification = SKIN_EYE_TEXT_MAP[text];
  if (skinEyeClassification) {
    return { kind: 'skinEye', classification: skinEyeClassification };
  }

  for (const [prefix, endpoint] of Object.entries(CMR_PREFIX_MAP)) {
    if (text.startsWith(prefix)) {
      const match = /^\S+\s*(1A|1B|2)$/.exec(text);
      if (!match) {
        return {
          kind: 'reject',
          rawText: `${classTextRaw} / ${hCodeRaw}`,
          reason: `unrecognized ${prefix} category`,
        };
      }
      return { kind: 'cmr', endpoint, category: (match[1] ?? '') as CmrCategory };
    }
  }

  return { kind: 'irrelevant' };
}
