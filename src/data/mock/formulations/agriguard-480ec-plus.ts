import type { Formulation } from '../../../schemas/formulation.js';
import {
  acidPhAdjuster,
  aqueousDiluent,
  at,
  causticAdjunct,
  cypermethrinBase,
  humectantCarrier,
} from '../formulants.js';

/**
 * Fictional variant of AgriGuard 480EC with added corrosive cleaning adjuncts.
 * Reuses the cypermethrin formulant from the base product and exercises skin/eye
 * corrosion straight-additivity (sulfuric acid + acetic acid + sodium/potassium
 * hydroxide), including the acetic acid "missing SCL" ambiguous case.
 */
export const agriguard480ecPlus: Formulation = {
  id: 'form-agriguard-480ec-plus',
  name: 'AgriGuard 480EC Plus',
  formulants: [
    at(cypermethrinBase, 20),
    at(acidPhAdjuster, 15),
    at(causticAdjunct, 10),
    at(humectantCarrier, 15),
    at(aqueousDiluent, 40),
  ],
};
