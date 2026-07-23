import type { ClpReferenceEntry } from '../../../schemas/clp-reference.js';
import { parseClpExportRow, type RawClpExportRow } from '../loader.js';

/**
 * Fixture data for the 14 substances used in src/data/mock/, hand-authored to resemble
 * real Annex VI harmonised-classification entries closely enough to exercise the engine's
 * math (see engine tests). NOT extracted from a downloaded ECHA export or independently
 * verified against one — no such source file exists in this repo. Do not treat these
 * entries as authoritative for a real formulation; see docs/PLAN.md Milestone 2.5 for the
 * real Annex VI ingestion pipeline this dataset is a stand-in for.
 */
const rawRows: RawClpExportRow[] = [
  {
    indexNumber: '015-084-00-4',
    casNumber: '2921-88-2',
    name: 'Chlorpyrifos',
    acuteToxicityOral: { category: '3' }, // no published ATE -> Table 3.1.2 conversion
  },
  {
    // Models the +/-40/60 cis/trans isomer entry (607-421-00-4). The real +/-80/20 isomer
    // entry additionally carries Skin Irrit. 2 - deliberately not modeled here, to keep
    // cypermethrin a clean single-hazard-class substance.
    indexNumber: '607-421-00-4',
    casNumber: '52315-07-8',
    name: 'Cypermethrin',
    acuteToxicityOral: { category: '4' },
  },
  {
    // Real entry also carries Skin Irrit. 2 (dermal/inhalation-only Acute Tox. 4, no oral
    // classification). Skin/eye deliberately not modeled here so xylene stays purely the
    // dataset's "tested, non-oral-toxic" acute-toxicity exclusion case, without silently
    // becoming a 5th skin/eye corrosion substance.
    indexNumber: '601-022-00-9',
    casNumber: '1330-20-7',
    name: 'Xylene',
    acuteToxicityOral: null,
  },
  {
    indexNumber: '603-001-00-X',
    casNumber: '67-56-1',
    name: 'Methanol',
    acuteToxicityOral: { category: '3' },
  },
  {
    // Real entry is also Acute Tox. 3 (all routes) - deliberately not modeled here, to keep
    // the dataset's documented "4 acute toxicity substances" count accurate. Formaldehyde's
    // designed role is CMR + cross-formulant summation, and Skin Corr. 1B/Irrit. 2.
    indexNumber: '605-001-00-5',
    casNumber: '50-00-0',
    name: 'Formaldehyde',
    skinEyeCorrosion: [
      { classification: 'skinCorr1B', specificConcentrationLimit: 25 },
      { classification: 'skinIrrit2', specificConcentrationLimit: 5 },
    ],
    cmr: [
      // No specificConcentrationLimit for either endpoint - real Annex VI gives none, so
      // the generic Annex I limit applies (0.1% for both).
      { endpoint: 'carcinogenicity', category: '1B' },
      { endpoint: 'mutagenicity', category: '2' },
    ],
  },
  {
    indexNumber: '016-020-00-8',
    casNumber: '7664-93-9',
    name: 'Sulfuric acid',
    skinEyeCorrosion: [
      { classification: 'skinCorr1A', specificConcentrationLimit: 15 },
      { classification: 'skinIrrit2', specificConcentrationLimit: 5 },
    ],
  },
  {
    indexNumber: '607-002-00-6',
    casNumber: '64-19-7',
    name: 'Acetic acid',
    skinEyeCorrosion: [
      { classification: 'skinCorr1A', specificConcentrationLimit: 90 },
      { classification: 'skinCorr1B', specificConcentrationLimit: 25 },
      { classification: 'skinIrrit2', specificConcentrationLimit: 10 },
    ],
  },
  {
    indexNumber: '011-002-00-6',
    casNumber: '1310-73-2',
    name: 'Sodium hydroxide',
    skinEyeCorrosion: [
      { classification: 'skinCorr1A', specificConcentrationLimit: 5 },
      { classification: 'skinCorr1B', specificConcentrationLimit: 2 },
      { classification: 'skinIrrit2', specificConcentrationLimit: 0.5 },
    ],
  },
  {
    // Real, dual-classified entry: modeled with both facets for free real fidelity, even
    // though the mock dataset only names KOH in a skin/eye corrosion context.
    indexNumber: '019-002-00-8',
    casNumber: '1310-58-3',
    name: 'Potassium hydroxide',
    acuteToxicityOral: { category: '4' },
    skinEyeCorrosion: [
      { classification: 'skinCorr1A', specificConcentrationLimit: 5 },
      { classification: 'skinCorr1B', specificConcentrationLimit: 2 },
      { classification: 'skinIrrit2', specificConcentrationLimit: 0.5 },
    ],
  },
  {
    // Real named group entry covering "boric acid" and "boric acid, crude natural...".
    indexNumber: '005-007-00-2',
    casNumber: '10043-35-3',
    name: 'Boric acid',
    cmr: [
      {
        endpoint: 'reproductiveToxicity',
        category: '1B',
        specificConcentrationLimit: 5.5,
      },
    ],
  },
  {
    indexNumber: '015-011-00-6',
    casNumber: '7664-38-2',
    name: 'Phosphoric acid',
    skinEyeCorrosion: [
      { classification: 'skinCorr1B', specificConcentrationLimit: 25 },
      { classification: 'skinIrrit2', specificConcentrationLimit: 10 },
      { classification: 'eyeIrrit2', specificConcentrationLimit: 10 },
    ],
    noteCodes: ['B'],
  },
  {
    indexNumber: 'none (no Annex VI entry, CAS 7732-18-5)',
    casNumber: '7732-18-5',
    name: 'Water',
  },
  {
    indexNumber: 'none (no Annex VI entry, CAS 56-81-5)',
    casNumber: '56-81-5',
    name: 'Glycerol',
  },
  {
    indexNumber: 'none (no Annex VI entry, CAS 1332-58-7)',
    casNumber: '1332-58-7',
    name: 'Kaolin',
  },
];

export const clpReferenceDataset: ClpReferenceEntry[] = rawRows.map(parseClpExportRow);
