import type { Formulation } from '../../../schemas/formulation.js';
import { agriguard480ec } from './agriguard-480ec.js';
import { agriguard480ecPlus } from './agriguard-480ec-plus.js';
import { fieldclearGranular } from './fieldclear-granular.js';
import { fieldclearDust } from './fieldclear-dust.js';

export { agriguard480ec, agriguard480ecPlus, fieldclearGranular, fieldclearDust };

export const mockFormulations: Formulation[] = [
  agriguard480ec,
  agriguard480ecPlus,
  fieldclearGranular,
  fieldclearDust,
];
