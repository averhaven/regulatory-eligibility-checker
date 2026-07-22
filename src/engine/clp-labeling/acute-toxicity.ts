import type { AcuteToxicityCategory } from '../../schemas/clp-reference.js';
import type { ContributingSubstance, MatchedSubstance } from '../shared/types.js';

export interface AcuteToxicityVerdict {
  hazardClass: 'acuteToxicity';
  category: AcuteToxicityCategory | null;
  /** null when there are no oral-toxicity-contributing substances at all. */
  ateMixMgPerKg: number | null;
  unknownConcentrationPercent: number;
  usedUnknownCorrection: boolean;
  /** Whether Annex I section 3.1.3.3(c)'s same-category shortcut overrode the raw ATEmix category. */
  sameCategoryShortcutApplied: boolean;
  contributingSubstances: ContributingSubstance[];
  /** Known/tested substances with no oral classification (e.g. xylene) - contribute zero. */
  excludedSubstances: ContributingSubstance[];
  /** No CLP reference entry found at all - feeds the >10%-unknown ATEmix correction. */
  unknownSubstances: ContributingSubstance[];
}

/** Oral ATEmix category bands, CLP Annex I Table 1.1 / section 3.1.2. */
export function categoryFromAteMix(ateMgPerKg: number): AcuteToxicityCategory | null {
  if (ateMgPerKg <= 5) return '1';
  if (ateMgPerKg <= 50) return '2';
  if (ateMgPerKg <= 300) return '3';
  if (ateMgPerKg <= 2000) return '4';
  return null;
}

/** Lower number = more severe; unclassified (null) is least severe of all. */
const CATEGORY_SEVERITY_RANK: Record<AcuteToxicityCategory, number> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
};
function severityRank(category: AcuteToxicityCategory | null): number {
  return category === null ? 5 : CATEGORY_SEVERITY_RANK[category];
}

/**
 * The core ATEmix formula, Annex I section 3.1.3.6.1, oral route:
 *   100 / ATEmix = Sum(Ci / ATEi)                          when unknown concentration <= 10%
 *   (100 - Cunknown) / ATEmix = Sum(Ci / ATEi)              when unknown concentration > 10%
 * `entries` must already exclude substances with no relevant oral data (see
 * classifyAcuteToxicity) - this function only implements the arithmetic.
 */
export function computeAteMix(
  entries: { concentration: number; ateMgPerKg: number }[],
  unknownConcentrationPercent: number,
): number {
  const sumOfFractions = entries.reduce(
    (sum, entry) => sum + entry.concentration / entry.ateMgPerKg,
    0,
  );
  const numerator =
    unknownConcentrationPercent > 10 ? 100 - unknownConcentrationPercent : 100;
  return numerator / sumOfFractions;
}

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
 * Classifies a formulation's oral acute toxicity from its already-matched substances (see
 * engine/compound.ts). v1 scope is oral-only.
 */
export function classifyAcuteToxicity(
  substances: MatchedSubstance[],
): AcuteToxicityVerdict {
  const contributingSubstances: ContributingSubstance[] = [];
  const excludedSubstances: ContributingSubstance[] = [];
  const unknownSubstances: ContributingSubstance[] = [];
  const ateEntries: { concentration: number; ateMgPerKg: number }[] = [];
  let sharedCategory: AcuteToxicityCategory | undefined;
  let allSameCategory = true;

  for (const substance of substances) {
    if (substance.reference === undefined) {
      unknownSubstances.push(
        toContributingSubstance(
          substance,
          'no CLP reference entry found (unknown toxicity)',
        ),
      );
      continue;
    }
    const oral = substance.reference.acuteToxicity.oral;
    if (oral === null) {
      excludedSubstances.push(
        toContributingSubstance(
          substance,
          'no oral acute-toxicity classification (tested, excluded from sum)',
        ),
      );
      continue;
    }
    ateEntries.push({
      concentration: substance.totalConcentration,
      ateMgPerKg: oral.ateMgPerKg,
    });
    if (sharedCategory === undefined) {
      sharedCategory = oral.category;
    } else if (sharedCategory !== oral.category) {
      allSameCategory = false;
    }
    contributingSubstances.push(
      toContributingSubstance(
        substance,
        `Category ${oral.category} oral (ATE ${oral.ateMgPerKg} mg/kg bw, ${oral.ateSource})`,
      ),
    );
  }

  const unknownConcentrationPercent = unknownSubstances.reduce(
    (sum, s) => sum + s.totalConcentration,
    0,
  );

  if (ateEntries.length === 0) {
    return {
      hazardClass: 'acuteToxicity',
      category: null,
      ateMixMgPerKg: null,
      unknownConcentrationPercent,
      usedUnknownCorrection: false,
      sameCategoryShortcutApplied: false,
      contributingSubstances,
      excludedSubstances,
      unknownSubstances,
    };
  }

  const ateMixMgPerKg = computeAteMix(ateEntries, unknownConcentrationPercent);
  const arithmeticCategory = categoryFromAteMix(ateMixMgPerKg);

  // Annex I section 3.1.3.3(c): Table 3.1.2's conversion values are deliberately the most
  // conservative (lowest-ATE) point within each category's range, so stacking several
  // same-category ingredients can push the ATEmix arithmetic to a MORE severe category
  // than any ingredient's own data supports (a pure artifact of the approximation). When
  // every contributing ingredient shares one category, this shortcut caps the result back
  // down to that shared category - it never escalates a genuinely dilute mixture (where the
  // arithmetic is already less severe, e.g. unclassified) up to the shared category, since
  // that direction isn't an artifact, it's the correct effect of dilution.
  const sameCategoryShortcutApplied =
    allSameCategory &&
    sharedCategory !== undefined &&
    severityRank(sharedCategory) > severityRank(arithmeticCategory);
  const category = sameCategoryShortcutApplied
    ? (sharedCategory ?? null)
    : arithmeticCategory;

  return {
    hazardClass: 'acuteToxicity',
    category,
    ateMixMgPerKg,
    unknownConcentrationPercent,
    usedUnknownCorrection: unknownConcentrationPercent > 10,
    sameCategoryShortcutApplied,
    contributingSubstances,
    excludedSubstances,
    unknownSubstances,
  };
}
