import { z } from 'zod';

/**
 * CAS Registry Number, e.g. "7664-93-9". Optional on a declared substance: a
 * fictional SDS may omit it, which is itself a deliberate ambiguous-match test case
 * (forces the substance matcher to fall back to name/synonym lookup — TODO: matcher
 * not yet implemented).
 */
export const casNumberPattern = /^\d{2,7}-\d{2}-\d$/;

export const DeclaredSubstanceSchema = z.object({
  /** Name as declared on the fictional SDS — may be a trade name/synonym rather than
   * the IUPAC/CLP-listed name. */
  name: z.string().min(1),
  casNumber: z
    .string()
    .regex(casNumberPattern, 'must look like a CAS number, e.g. 7664-93-9')
    .optional(),
  /** Percent by weight within the formulant (not the finished product). */
  concentration: z.number().min(0).max(100),
});

export type DeclaredSubstance = z.infer<typeof DeclaredSubstanceSchema>;
