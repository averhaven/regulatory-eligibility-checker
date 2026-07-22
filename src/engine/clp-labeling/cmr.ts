import type { CmrCategory, CmrEndpoint } from '../../schemas/clp-reference.js';
import type { ContributingSubstance, MatchedSubstance } from '../shared/types.js';

export interface CmrTrigger extends ContributingSubstance {
  limitUsed: number;
  limitSource: 'scl' | 'gcl';
}

export interface CmrClassificationResult {
  endpoint: CmrEndpoint;
  category: CmrCategory;
  triggeredBy: CmrTrigger[];
}

export interface CmrVerdict {
  hazardClass: 'cmr';
  /** Only endpoint/category pairs triggered by at least one substance. */
  classifications: CmrClassificationResult[];
}

/**
 * Annex I generic concentration limits (sections 3.5 mutagenicity, 3.6 carcinogenicity,
 * 3.7 reproductive toxicity), used when a substance has no specific concentration limit.
 */
const GENERIC_CONCENTRATION_LIMIT: Record<CmrEndpoint, Record<CmrCategory, number>> = {
  mutagenicity: { '1A': 0.1, '1B': 0.1, '2': 1.0 },
  carcinogenicity: { '1A': 0.1, '1B': 0.1, '2': 1.0 },
  reproductiveToxicity: { '1A': 0.3, '1B': 0.3, '2': 3.0 },
};

/**
 * Classifies a formulation's CMR status from its already-matched substances. Unlike acute
 * toxicity or skin/eye corrosion, CMR is a single-substance threshold: the mixture is
 * classified if ANY ONE substance's total (compounded) concentration meets its own SCL (if
 * any, per Article 10(6)) or else the generic concentration limit for its category - there
 * is never cross-substance summation between different CMR substances.
 */
export function classifyCmr(substances: MatchedSubstance[]): CmrVerdict {
  const byPair = new Map<string, CmrClassificationResult>();

  for (const substance of substances) {
    for (const classification of substance.reference?.cmr.classifications ?? []) {
      const limit =
        classification.specificConcentrationLimit ??
        GENERIC_CONCENTRATION_LIMIT[classification.endpoint][classification.category];
      if (substance.totalConcentration < limit) {
        continue;
      }

      const limitSource: 'scl' | 'gcl' =
        classification.specificConcentrationLimit !== undefined ? 'scl' : 'gcl';
      const trigger: CmrTrigger = {
        key: substance.key,
        name: substance.name,
        ...(substance.casNumber !== undefined && { casNumber: substance.casNumber }),
        totalConcentration: substance.totalConcentration,
        contributions: substance.contributions,
        role: `${classification.endpoint} Category ${classification.category} (limit ${limit}%, ${limitSource.toUpperCase()})`,
        limitUsed: limit,
        limitSource,
      };

      const pairKey = `${classification.endpoint}:${classification.category}`;
      const existing = byPair.get(pairKey);
      if (existing !== undefined) {
        existing.triggeredBy.push(trigger);
      } else {
        byPair.set(pairKey, {
          endpoint: classification.endpoint,
          category: classification.category,
          triggeredBy: [trigger],
        });
      }
    }
  }

  return { hazardClass: 'cmr', classifications: [...byPair.values()] };
}
