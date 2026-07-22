import { z } from 'zod';
import { casNumberPattern } from './substance.js';

export const AcuteToxicityCategorySchema = z.enum(['1', '2', '3', '4']);

// v1 scope: oral route only.
export const AcuteToxicityRouteEntrySchema = z.object({
  route: z.literal('oral'),
  category: AcuteToxicityCategorySchema,
  /** mg/kg bw. Either a published ATE or the Table 3.1.2 category conversion value. */
  ateMgPerKg: z.number().positive(),
  ateSource: z.enum(['published', 'table-3.1.2-conversion']),
});

export const AcuteToxicityFacetSchema = z.object({
  /**
   * `null` = tested, not oral-toxic (excluded from the ATE sum) — distinct from no
   * reference entry at all (unknown toxicity, see engine/types.ts).
   */
  oral: AcuteToxicityRouteEntrySchema.nullable(),
});

export const SkinEyeClassificationCodeSchema = z.enum([
  'skinCorr1A',
  'skinCorr1B',
  'skinCorr1C',
  'skinIrrit2',
  'eyeDam1',
  'eyeIrrit2',
]);

export const SkinEyeCorrosionFacetSchema = z.object({
  classifications: z.array(
    z.object({
      classification: SkinEyeClassificationCodeSchema,
      /** Omitted => engine falls back to the generic concentration limit for this code. */
      specificConcentrationLimit: z.number().min(0).max(100).optional(),
    }),
  ),
});

export const CmrEndpointSchema = z.enum([
  'carcinogenicity',
  'mutagenicity',
  'reproductiveToxicity',
]);
export const CmrCategorySchema = z.enum(['1A', '1B', '2']);

export const CmrFacetSchema = z.object({
  classifications: z.array(
    z.object({
      endpoint: CmrEndpointSchema,
      category: CmrCategorySchema,
      specificConcentrationLimit: z.number().min(0).max(100).optional(),
    }),
  ),
});

/**
 * Every entry states its position on all 3 v1 hazard classes explicitly (empty/null,
 * not absent), so the engine never has to branch on "is this substance even in the
 * dataset" — water/glycerol/kaolin get the same shape as a hazardous substance, just empty.
 */
export const ClpReferenceEntrySchema = z.object({
  indexNumber: z.string().min(1),
  casNumber: z.string().regex(casNumberPattern).optional(),
  /** The CLP-listed name. TODO: matching a declared SDS synonym to this is not yet implemented. */
  name: z.string().min(1),
  acuteToxicity: AcuteToxicityFacetSchema,
  skinEyeCorrosion: SkinEyeCorrosionFacetSchema,
  cmr: CmrFacetSchema,
  /** Opaque — the engine never interprets note text. TODO: future note-interpretation (RAG) layer. */
  noteCodes: z.array(z.string()).optional(),
});

export type AcuteToxicityCategory = z.infer<typeof AcuteToxicityCategorySchema>;
export type AcuteToxicityRouteEntry = z.infer<typeof AcuteToxicityRouteEntrySchema>;
export type SkinEyeClassificationCode = z.infer<typeof SkinEyeClassificationCodeSchema>;
export type CmrEndpoint = z.infer<typeof CmrEndpointSchema>;
export type CmrCategory = z.infer<typeof CmrCategorySchema>;
export type ClpReferenceEntry = z.infer<typeof ClpReferenceEntrySchema>;
