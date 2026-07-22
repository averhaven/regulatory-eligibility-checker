import type { CmrCategory, CmrEndpoint } from '../../schemas/clp-reference.js';
import type { ContributingSubstance, MatchedSubstance } from '../shared/types.js';

/** Reg. (EU) 2023/574 Annex point number for each CMR endpoint (points 1-3 only). */
const ANNEX_POINT_BY_ENDPOINT: Record<CmrEndpoint, number> = {
  mutagenicity: 1,
  carcinogenicity: 2,
  reproductiveToxicity: 3,
};

export interface BannedCoFormulant extends ContributingSubstance {
  endpoint: CmrEndpoint;
  category: CmrCategory;
}

export interface CoFormulantEligibilityVerdict {
  eligible: boolean;
  bannedCoFormulants: BannedCoFormulant[];
}

/**
 * Reg. (EU) 2023/574 Annex, points 1-3: a co-formulant that "is or has to be classified as"
 * mutagen/carcinogen/reproductive-toxicant Category 1A or 1B is unacceptable for inclusion
 * in a plant protection product outright - a ban on the *substance's own* CLP
 * classification, unconditional on its concentration in the finished product. This is a
 * different check from classifyCmr's concentration-gated *mixture* classification (CLP
 * Annex I): a substance below its own GCL/SCL there still doesn't trigger a mixture-level
 * CMR label, but it is still a banned co-formulant here regardless of how little is used.
 *
 * v1 scope: only points 1-3 (CMR 1A/1B) are implemented. Points 4-10 of the Annex (POPs
 * Annexes I-V, REACH SVHC candidate list, REACH Annex XVII restrictions, biocidal product
 * decisions, and 1107/2009 Annex II's broader active-substance criteria) need reference
 * data this project doesn't ingest yet - see docs/PLAN.md.
 */
export function classifyCoFormulantEligibility(
  substances: MatchedSubstance[],
): CoFormulantEligibilityVerdict {
  const bannedCoFormulants: BannedCoFormulant[] = [];

  for (const substance of substances) {
    for (const classification of substance.reference?.cmr.classifications ?? []) {
      if (classification.category !== '1A' && classification.category !== '1B') {
        continue;
      }
      bannedCoFormulants.push({
        key: substance.key,
        name: substance.name,
        ...(substance.casNumber !== undefined && { casNumber: substance.casNumber }),
        totalConcentration: substance.totalConcentration,
        contributions: substance.contributions,
        role:
          `${classification.endpoint} Category ${classification.category} - unacceptable ` +
          `co-formulant per Reg. (EU) 2023/574 Annex point ` +
          `${ANNEX_POINT_BY_ENDPOINT[classification.endpoint]}, regardless of concentration`,
        endpoint: classification.endpoint,
        category: classification.category,
      });
    }
  }

  return { eligible: bannedCoFormulants.length === 0, bannedCoFormulants };
}
