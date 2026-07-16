import type { Formulation } from '../../../schemas/formulation.js';
import {
  acidPhAdjuster,
  antiCakingBase,
  aqueousDiluent,
  at,
  humectantCarrier,
} from '../formulants.js';

/**
 * Fictional dust applicator mix. Exercises the CMR "relevant note code" ambiguous
 * case (titanium dioxide, real Annex VI entry conditional on particle-size form) and
 * reuses the acidic pH adjuster at a low enough level to test the "below threshold,
 * doesn't contribute" path for skin/eye corrosion.
 */
export const fieldclearDust: Formulation = {
  id: 'form-fieldclear-dust',
  name: 'FieldClear Dust Applicator Mix',
  formulants: [
    at(antiCakingBase, 20),
    at(acidPhAdjuster, 5),
    at(humectantCarrier, 5),
    at(aqueousDiluent, 70),
  ],
};
