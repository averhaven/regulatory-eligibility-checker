import type { SkinEyeClassificationCode } from '../../schemas/clp-reference.js';
import type { ContributingSubstance, MatchedSubstance } from '../shared/types.js';

export interface SkinEyeClassificationResult {
  classification: SkinEyeClassificationCode;
  /** Sum of Ci/limit_i across substances carrying this classification (SCL or GCL fallback). */
  additivitySum: number;
  triggered: boolean;
  contributingSubstances: ContributingSubstance[];
}

export interface SkinEyeCorrosionVerdict {
  hazardClass: 'skinEyeCorrosion';
  /** Every classification that ultimately applies, most severe first within each family. */
  classifications: SkinEyeClassificationCode[];
  /** Every evaluated code, for full audit/provenance - not filtered by severity. */
  perClassification: SkinEyeClassificationResult[];
}

/** Annex I Table 3.2.3/3.3.3 generic concentration limits, used when a substance has no SCL. */
const GENERIC_CONCENTRATION_LIMIT: Record<SkinEyeClassificationCode, number> = {
  skinCorr1A: 5,
  skinCorr1B: 5,
  skinCorr1C: 5,
  skinIrrit2: 10,
  eyeDam1: 3,
  eyeIrrit2: 10,
};

const ALL_CODES = Object.keys(GENERIC_CONCENTRATION_LIMIT) as SkinEyeClassificationCode[];

/** Most severe first, within each family. A mixture is classified at its worst applicable code. */
const SKIN_SEVERITY_ORDER: SkinEyeClassificationCode[] = [
  'skinCorr1A',
  'skinCorr1B',
  'skinCorr1C',
  'skinIrrit2',
];
const EYE_SEVERITY_ORDER: SkinEyeClassificationCode[] = ['eyeDam1', 'eyeIrrit2'];
const SKIN_CORR_CODES: SkinEyeClassificationCode[] = [
  'skinCorr1A',
  'skinCorr1B',
  'skinCorr1C',
];

function toContributingSubstance(
  substance: MatchedSubstance,
  role: string,
): ContributingSubstance {
  return {
    key: substance.key,
    name: substance.name,
    ...(substance.casNumber !== undefined && { casNumber: substance.casNumber }),
    totalConcentration: substance.totalConcentration,
    contributions: substance.contributions,
    role,
  };
}

/**
 * Classifies a formulation's skin/eye corrosion from its already-matched substances. Skin
 * and eye share one function because the additivity math is structurally identical,
 * differing only in which classification codes and limits apply.
 */
export function classifySkinEyeCorrosion(
  substances: MatchedSubstance[],
): SkinEyeCorrosionVerdict {
  const results: Record<SkinEyeClassificationCode, SkinEyeClassificationResult> =
    Object.fromEntries(
      ALL_CODES.map((code) => [code, computeClassification(code, substances)]),
    ) as Record<SkinEyeClassificationCode, SkinEyeClassificationResult>;

  // Annex I bridging rule (Table 3.2.3/3.3.3): a substance below its own corrosion
  // threshold still contributes irritation potential. 10x(sum of Skin Corr. 1 sub-category
  // concentrations) + sum of Skin/Eye Irrit. 2 concentrations >= 10% also triggers Irrit. 2,
  // even if neither additivity sum alone reached its own threshold.
  applyBridgingRule(results, 'skinIrrit2', SKIN_CORR_CODES, substances);
  applyBridgingRule(results, 'eyeIrrit2', ['eyeDam1', ...SKIN_CORR_CODES], substances);
  applyStepwiseSubCategoryGcl(results, substances);

  const classifications = [
    ...mostSevereTriggered(SKIN_SEVERITY_ORDER, results),
    ...mostSevereTriggered(EYE_SEVERITY_ORDER, results),
  ];
  const perClassification = ALL_CODES.map((code) => results[code]);

  return { hazardClass: 'skinEyeCorrosion', classifications, perClassification };
}

function computeClassification(
  code: SkinEyeClassificationCode,
  substances: MatchedSubstance[],
): SkinEyeClassificationResult {
  let additivitySum = 0;
  const contributingSubstances: ContributingSubstance[] = [];

  for (const substance of substances) {
    const entry = substance.reference?.skinEyeCorrosion.classifications.find(
      (c) => c.classification === code,
    );
    if (entry === undefined) {
      continue;
    }
    const limit = entry.specificConcentrationLimit ?? GENERIC_CONCENTRATION_LIMIT[code];
    additivitySum += substance.totalConcentration / limit;
    contributingSubstances.push(
      toContributingSubstance(
        substance,
        `${code} (limit ${limit}%, ${entry.specificConcentrationLimit !== undefined ? 'SCL' : 'GCL'})`,
      ),
    );
  }

  return {
    classification: code,
    additivitySum,
    triggered: additivitySum >= 1,
    contributingSubstances,
  };
}

/**
 * Annex I's literal bridging formula (Table 3.2.3/3.3.3) sums plain concentrations, which
 * only holds together dimensionally at the generic 5%/10% limits it was written around. A
 * substance carrying its own SCL for the "more severe" classification already has a
 * calibrated potency-specific threshold (checked directly via computeClassification's own
 * Ci/SCLi additivity) - counting it a second time here, at its raw concentration, would
 * double-count and can trigger on trace amounts of a highly potent SCL-bearing substance.
 * So bridging only draws from substances using the GCL fallback (no SCL of their own for
 * that classification); v1's real reference dataset happens to give every corrosive
 * substance an SCL, so bridging is exercised only by a synthetic GCL-only fixture.
 */
function applyBridgingRule(
  results: Record<SkinEyeClassificationCode, SkinEyeClassificationResult>,
  irritCode: SkinEyeClassificationCode,
  moreSevereCodes: SkinEyeClassificationCode[],
  substances: MatchedSubstance[],
): void {
  const irritResult = results[irritCode];
  if (irritResult.triggered) {
    return;
  }

  const viaGclOnly = (substance: MatchedSubstance, codes: SkinEyeClassificationCode[]) =>
    substance.reference?.skinEyeCorrosion.classifications.some(
      (c) =>
        codes.includes(c.classification) && c.specificConcentrationLimit === undefined,
    ) === true;

  const sumConcentrationWhere = (predicate: (s: MatchedSubstance) => boolean) =>
    substances.reduce((sum, s) => (predicate(s) ? sum + s.totalConcentration : sum), 0);

  const corrosiveConcentration = sumConcentrationWhere((s) =>
    viaGclOnly(s, moreSevereCodes),
  );
  const irritantConcentration = sumConcentrationWhere((s) => viaGclOnly(s, [irritCode]));
  const bridgingSum = 10 * corrosiveConcentration + irritantConcentration;

  if (bridgingSum >= 10) {
    results[irritCode] = { ...irritResult, triggered: true };
  }
}

/**
 * Sub-category stepwise resolution (Annex I Table 3.2.3), GCL-fallback substances only: a
 * substance carrying its own SCL is already directly resolved by computeClassification's
 * additivity check (it has calibrated per-substance data, no accumulation needed). For
 * GCL-fallback substances, accumulate concentrations from most-to-least severe sub-category
 * (1A, then 1A+1B, then 1A+1B+1C); the mixture is classified at the first (most severe)
 * sub-category whose cumulative sum reaches the 5% GCL. This only kicks in when none of the
 * 3 sub-categories already triggered directly (an SCL-based direct trigger is already the
 * most severe available answer).
 */
function applyStepwiseSubCategoryGcl(
  results: Record<SkinEyeClassificationCode, SkinEyeClassificationResult>,
  substances: MatchedSubstance[],
): void {
  if (SKIN_CORR_CODES.some((code) => results[code].triggered)) {
    return;
  }

  let cumulativeConcentration = 0;
  const cumulativeContributors: ContributingSubstance[] = [];

  for (const code of SKIN_CORR_CODES) {
    for (const substance of substances) {
      const entry = substance.reference?.skinEyeCorrosion.classifications.find(
        (c) => c.classification === code && c.specificConcentrationLimit === undefined,
      );
      if (entry === undefined) {
        continue;
      }
      cumulativeConcentration += substance.totalConcentration;
      cumulativeContributors.push(
        toContributingSubstance(
          substance,
          `${code} (limit 5%, GCL, stepwise-accumulated)`,
        ),
      );
    }

    if (cumulativeConcentration >= GENERIC_CONCENTRATION_LIMIT[code]) {
      results[code] = {
        classification: code,
        additivitySum: cumulativeConcentration / GENERIC_CONCENTRATION_LIMIT[code],
        triggered: true,
        contributingSubstances: cumulativeContributors,
      };
      return;
    }
  }
}

function mostSevereTriggered(
  severityOrder: SkinEyeClassificationCode[],
  results: Record<SkinEyeClassificationCode, SkinEyeClassificationResult>,
): SkinEyeClassificationCode[] {
  const mostSevere = severityOrder.find((code) => results[code].triggered);
  return mostSevere === undefined ? [] : [mostSevere];
}
