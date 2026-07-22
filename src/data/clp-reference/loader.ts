import { z } from 'zod';
import {
  ClpReferenceEntrySchema,
  AcuteToxicityCategorySchema,
  type ClpReferenceEntry,
} from '../../schemas/clp-reference.js';
import { casNumberPattern } from '../../schemas/substance.js';

/**
 * CLP Annex I Table 3.1.2 — oral-route conversion of a hazard category to a point-estimate
 * ATE (mg/kg bw), used when Annex VI publishes only a category and no exact ATE value.
 */
const ORAL_CATEGORY_CONVERSION: Record<
  z.infer<typeof AcuteToxicityCategorySchema>,
  number
> = {
  '1': 0.5,
  '2': 5,
  '3': 100,
  '4': 500,
};

/** A single substance's CLP classification, in the shape the engine consumes. */
export const RawClpExportRowSchema = z.object({
  indexNumber: z.string().min(1),
  casNumber: z.string().regex(casNumberPattern).optional(),
  name: z.string().min(1),
  /** null/omitted => no oral acute-toxicity classification (tested, excluded from the sum). */
  acuteToxicityOral: z
    .object({
      category: z.enum(['1', '2', '3', '4']),
      /** Omitted => no published ATE; falls back to the Table 3.1.2 conversion value. */
      ateMgPerKg: z.number().positive().optional(),
    })
    .nullable()
    .optional(),
  skinEyeCorrosion:
    ClpReferenceEntrySchema.shape.skinEyeCorrosion.shape.classifications.optional(),
  cmr: ClpReferenceEntrySchema.shape.cmr.shape.classifications.optional(),
  noteCodes: z.array(z.string()).optional(),
});

export type RawClpExportRow = z.infer<typeof RawClpExportRowSchema>;

export function parseClpExportRow(row: RawClpExportRow): ClpReferenceEntry {
  const oral = row.acuteToxicityOral;
  return ClpReferenceEntrySchema.parse({
    indexNumber: row.indexNumber,
    ...(row.casNumber !== undefined && { casNumber: row.casNumber }),
    name: row.name,
    acuteToxicity: {
      oral:
        oral == null
          ? null
          : {
              route: 'oral',
              category: oral.category,
              ateMgPerKg: oral.ateMgPerKg ?? ORAL_CATEGORY_CONVERSION[oral.category],
              ateSource:
                oral.ateMgPerKg !== undefined ? 'published' : 'table-3.1.2-conversion',
            },
    },
    skinEyeCorrosion: { classifications: row.skinEyeCorrosion ?? [] },
    cmr: { classifications: row.cmr ?? [] },
    ...(row.noteCodes !== undefined && { noteCodes: row.noteCodes }),
  });
}
