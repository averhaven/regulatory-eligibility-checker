import { z } from 'zod';
import { FormulantSchema } from './formulant.js';

export const FormulationSchema = z
  .object({
    id: z.string().min(1),
    /** Fictional product name. */
    name: z.string().min(1),
    formulants: z.array(FormulantSchema).min(1),
  })
  .refine(
    (formulation) => {
      const total = formulation.formulants.reduce(
        (sum, f) => sum + f.percentOfProduct,
        0,
      );
      return Math.abs(total - 100) < 0.001;
    },
    {
      message: 'formulant percentOfProduct values must sum to 100 across the formulation',
    },
  );

export type Formulation = z.infer<typeof FormulationSchema>;
