import type { Formulation } from '../../../schemas/formulation.js';
import {
  at,
  aqueousDiluent,
  biocideReserveBlend,
  chlorpyrifosConcentrate,
  cypermethrinBase,
  humectantCarrier,
  methanolCarrier,
  preservativePackage,
} from '../formulants.js';

/**
 * Fictional insecticide EC (emulsifiable concentrate). Exercises acute toxicity
 * (chlorpyrifos via a synonym-only declaration, cypermethrin as a clean match) and CMR
 * (formaldehyde, contributed by two different formulants — cross-formulant summation).
 */
export const agriguard480ec: Formulation = {
  id: 'form-agriguard-480ec',
  name: 'AgriGuard 480EC',
  formulants: [
    at(chlorpyrifosConcentrate, 35),
    at(cypermethrinBase, 15),
    at(methanolCarrier, 10),
    at(preservativePackage, 5),
    at(biocideReserveBlend, 5),
    at(humectantCarrier, 10),
    at(aqueousDiluent, 20),
  ],
};
