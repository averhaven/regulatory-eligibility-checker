import { z } from 'zod';
import { DeclaredSubstanceSchema } from './substance.js';

export const FormulantSchema = z
  .object({
    id: z.string().min(1),
    /** Fictional trade name, e.g. "AgriShield Surfactant Blend". */
    name: z.string().min(1),
    /** Percent of this formulant in the finished product. */
    percentOfProduct: z.number().min(0).max(100),
    substances: z.array(DeclaredSubstanceSchema),
  })
  .refine(
    (formulant) => {
      const total = formulant.substances.reduce((sum, s) => sum + s.concentration, 0);
      return total <= 100.001;
    },
    {
      message: 'declared substance concentrations must not exceed 100% of the formulant',
    },
  );

export type Formulant = z.infer<typeof FormulantSchema>;
