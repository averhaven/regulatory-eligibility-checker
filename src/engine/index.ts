import type { Formulation } from '../schemas/formulation.js';
import type { ClpReferenceEntry } from '../schemas/clp-reference.js';
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
import type { CompoundedSubstance } from './shared/types.js';

export * from './shared/types.js';
export * from './shared/compound.js';
export * from './clp-labeling/acute-toxicity.js';
export * from './clp-labeling/skin-eye-corrosion.js';
export * from './clp-labeling/cmr.js';
export * from './eligibility/co-formulant-eligibility.js';

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
}

/**
 * Runs the full deterministic pipeline for one formulation: decompose + compound -> match
 * against the CLP reference dataset -> classify each of the 3 v1 hazard classes plus
 * co-formulant eligibility.
 *
 * TODO: `lookup` (see engine/compound.ts) is currently `lookupByCasOrName` from
 * src/data/clp-reference/; swap in the real substance matcher.
 */
export function classifyFormulation(
  formulation: Formulation,
  lookup: (substance: CompoundedSubstance) => ClpReferenceEntry | undefined,
): FormulationVerdict {
  const matched = attachReferences(compoundFormulation(formulation), lookup);
  const coFormulantEligibility = classifyCoFormulantEligibility(matched);

  return {
    formulationId: formulation.id,
    eligible: coFormulantEligibility.eligible,
    acuteToxicity: classifyAcuteToxicity(matched),
    skinEyeCorrosion: classifySkinEyeCorrosion(matched),
    cmr: classifyCmr(matched),
    coFormulantEligibility,
  };
}
