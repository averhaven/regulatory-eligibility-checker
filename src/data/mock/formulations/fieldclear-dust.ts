import type { Formulation } from '../../../schemas/formulation.js';
import {
  acidPhAdjuster,
  aqueousDiluent,
  at,
  humectantCarrier,
  phosphoricConditioningAgent,
} from '../formulants.js';

/**
 * Fictional dust applicator mix. Exercises the "relevant note code" ambiguous case
 * (phosphoric acid, real Annex VI Note B — see the phosphoricConditioningAgent comment in
 * src/data/mock/formulants.ts) and reuses the acidic pH adjuster at a low enough level to test
 * the "below threshold, doesn't contribute" path for skin/eye corrosion.
 */
export const fieldclearDust: Formulation = {
  id: 'form-fieldclear-dust',
  name: 'FieldClear Dust Applicator Mix',
  formulants: [
    at(phosphoricConditioningAgent, 20),
    at(acidPhAdjuster, 5),
    at(humectantCarrier, 5),
    at(aqueousDiluent, 70),
  ],
};
