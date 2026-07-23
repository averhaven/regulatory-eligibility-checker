import { parseClpExportRow } from '../loader.js';

/**
 * A fictional, engine-tests-only reference entry, NOT linked to any mock formulant. It
 * stands in for a real note-conditioned Annex VI entry (e.g. the real man-made-vitreous-
 * fibres Notes Q/R entry) so the engine's "apply the classification's SCL and surface its
 * note codes in provenance, without ever interpreting the note text" behaviour has test
 * coverage even though the current real 14-substance dataset has no live note-conditioned
 * case.
 */
export const syntheticNoteConditionedEntry = parseClpExportRow({
  indexNumber: 'synthetic-test-only-000-000-00-0',
  name: 'Synthetic Note-Conditioned Test Substance (fictional, not a real CAS/CLP entry)',
  cmr: [{ endpoint: 'carcinogenicity', category: '2', specificConcentrationLimit: 5 }],
  noteCodes: [
    'SYNTHETIC NOTE: classification applies only to material meeting a stated physical-form ' +
      "condition - resolving whether it applies is not this engine's job (TODO: future " +
      "RAG+LLM territory). The engine only needs to apply the SCL and surface this note in " +
      'provenance.',
  ],
});
