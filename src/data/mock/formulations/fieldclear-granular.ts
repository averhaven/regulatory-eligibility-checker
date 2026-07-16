import type { Formulation } from '../../../schemas/formulation.js';
import {
  aqueousDiluent,
  at,
  boricMineralCarrier,
  humectantCarrier,
  methanolCarrier,
  preservativePackage,
} from '../formulants.js';

/**
 * Fictional granular herbicide base. Exercises the CMR "grouping entry" ambiguous
 * case (boric acid) alongside a clean-match CMR substance (formaldehyde) reused from
 * the AgriGuard 480EC preservative package.
 */
export const fieldclearGranular: Formulation = {
  id: 'form-fieldclear-granular',
  name: 'FieldClear Granular Herbicide Base',
  formulants: [
    at(methanolCarrier, 5),
    at(boricMineralCarrier, 25),
    at(preservativePackage, 10),
    at(humectantCarrier, 10),
    at(aqueousDiluent, 50),
  ],
};
