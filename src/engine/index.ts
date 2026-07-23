import type { Formulation } from '../schemas/formulation.js';
import { attachReferences, compoundFormulation } from './shared/compound.js';
import {
  classifyAcuteToxicity,
  type AcuteToxicityVerdict,
} from './clp-labeling/acute-toxicity.js';
import {
  classifySkinEyeCorrosion,
  type SkinEyeCorrosionVerdict,
} from './clp-labeling/skin-eye-corrosion.js';
import { classifyCmr, type CmrVerdict } from './clp-labeling/cmr.js';
import {
  classifyCoFormulantEligibility,
  type CoFormulantEligibilityVerdict,
} from './eligibility/co-formulant-eligibility.js';
import type {
  AmbiguityReason,
  CompoundedSubstance,
  SubstanceMatch,
} from './shared/types.js';

export * from './shared/types.js';
export * from './shared/compound.js';
export * from './matcher/substance-matcher.js';
export * from './clp-labeling/acute-toxicity.js';
export * from './clp-labeling/skin-eye-corrosion.js';
export * from './clp-labeling/cmr.js';
export * from './eligibility/co-formulant-eligibility.js';

/** A matched substance that needs review before its match is trusted wholesale - see `AmbiguityReason`. */
export interface AmbiguousSubstanceSummary {
  key: string;
  name: string;
  casNumber?: string;
  ambiguityReasons: AmbiguityReason[];
}

export interface FormulationVerdict {
  formulationId: string;
  /**
   * Whether this formulation may be authorised for sale as a plant protection product,
   * per Reg. (EU) 2023/574's co-formulant ban (points 1-3 in v1 - see
   * coFormulantEligibility). The 3 CLP hazard verdicts below are classification/labelling
   * outputs, not authorisation cut-offs themselves - see docs/PLAN.md.
   */
  eligible: boolean;
  acuteToxicity: AcuteToxicityVerdict;
  skinEyeCorrosion: SkinEyeCorrosionVerdict;
  cmr: CmrVerdict;
  coFormulantEligibility: CoFormulantEligibilityVerdict;
  /**
   * Every matched substance flagged by the matcher as needing review (see
   * `docs/PLAN.md`'s Milestone 4) - the signal a future workflow (Milestone 7) would branch
   * on to route to the LLM+RAG path instead of trusting the deterministic verdict above as-is.
   */
  ambiguousSubstances: AmbiguousSubstanceSummary[];
}

/**
 * Runs the full deterministic pipeline for one formulation: decompose + compound -> match
 * against the CLP reference dataset (via `match`, e.g. `buildSubstanceMatcher(dataset)` from
 * `./matcher/substance-matcher.js`) -> classify each of the 3 v1 hazard classes plus
 * co-formulant eligibility.
 */
export function classifyFormulation(
  formulation: Formulation,
  match: (substance: CompoundedSubstance) => SubstanceMatch,
): FormulationVerdict {
  const matched = attachReferences(compoundFormulation(formulation), match);
  const coFormulantEligibility = classifyCoFormulantEligibility(matched);
  const ambiguousSubstances = matched
    .filter((substance) => substance.ambiguityReasons.length > 0)
    .map((substance) => ({
      key: substance.key,
      name: substance.name,
      ...(substance.casNumber !== undefined && { casNumber: substance.casNumber }),
      ambiguityReasons: substance.ambiguityReasons,
    }));

  return {
    formulationId: formulation.id,
    eligible: coFormulantEligibility.eligible,
    acuteToxicity: classifyAcuteToxicity(matched),
    skinEyeCorrosion: classifySkinEyeCorrosion(matched),
    cmr: classifyCmr(matched),
    coFormulantEligibility,
    ambiguousSubstances,
  };
}
