import type { Formulant } from '../../schemas/formulant.js';

/**
 * Shared fictional formulants, reused across multiple mock formulations below so
 * formulation-wide summation (same substance arriving via different formulants, or the
 * same formulant reused in different products) is actually exercised once Milestone 2's
 * engine exists.
 *
 * Substance identities (name + CAS) are real, public facts — only the formulant/product
 * names and the declared compositions are fictional. See docs/PLAN.md Milestone 1 for the
 * intended ambiguous-match test cases called out below.
 */

export const chlorpyrifosConcentrate: Formulant = {
  id: 'fnt-chlorpyrifos-conc',
  name: 'Chlorpyrifos Technical Concentrate',
  percentOfProduct: 0, // overridden per-formulation
  substances: [
    // Ambiguous-match case: declared under a historical trade name, no CAS given —
    // forces the Milestone 3 matcher to fall back to name/synonym lookup
    // ("synonym mismatch").
    { name: 'Dursban Technical', concentration: 45 },
    { name: 'Xylene', casNumber: '1330-20-7', concentration: 30 },
  ],
};

export const cypermethrinBase: Formulant = {
  id: 'fnt-cypermethrin-base',
  name: 'Cypermethrin Emulsifiable Base',
  percentOfProduct: 0,
  substances: [
    { name: 'Cypermethrin', casNumber: '52315-07-8', concentration: 10 },
    { name: 'Xylene', casNumber: '1330-20-7', concentration: 55 },
  ],
};

export const methanolCarrier: Formulant = {
  id: 'fnt-methanol-carrier',
  name: 'Methanol Carrier Solvent',
  percentOfProduct: 0,
  substances: [{ name: 'Methanol', casNumber: '67-56-1', concentration: 95 }],
};

export const preservativePackage: Formulant = {
  id: 'fnt-preservative-pkg',
  name: 'Preservative Stabilizer Package',
  percentOfProduct: 0,
  substances: [
    // Clean match (CMR, single-substance threshold). Deliberately also present in
    // biocideReserveBlend below so a single formulation can carry the same CMR
    // substance via two different formulants, exercising cross-formulant summation.
    { name: 'Formaldehyde', casNumber: '50-00-0', concentration: 2 },
    { name: 'Water', casNumber: '7732-18-5', concentration: 90 },
  ],
};

export const biocideReserveBlend: Formulant = {
  id: 'fnt-biocide-reserve',
  name: 'Biocide Reserve Blend',
  percentOfProduct: 0,
  substances: [
    { name: 'Formaldehyde', casNumber: '50-00-0', concentration: 1.5 },
    { name: 'Glycerol', casNumber: '56-81-5', concentration: 80 },
  ],
};

export const acidPhAdjuster: Formulant = {
  id: 'fnt-acid-ph-adjuster',
  name: 'Acidic pH Adjuster Blend',
  percentOfProduct: 0,
  substances: [
    { name: 'Sulfuric acid', casNumber: '7664-93-9', concentration: 20 },
    // Ambiguous-match case: Annex VI lists the hazard class for acetic acid without a
    // substance-specific concentration limit, so the generic Annex I limit must be
    // resolved ("missing SCL").
    { name: 'Acetic acid', casNumber: '64-19-7', concentration: 15 },
  ],
};

export const causticAdjunct: Formulant = {
  id: 'fnt-caustic-adjunct',
  name: 'Caustic Cleaning Adjunct',
  percentOfProduct: 0,
  substances: [
    { name: 'Sodium hydroxide', casNumber: '1310-73-2', concentration: 30 },
    { name: 'Potassium hydroxide', casNumber: '1310-58-3', concentration: 10 },
  ],
};

export const boricMineralCarrier: Formulant = {
  id: 'fnt-boric-carrier',
  name: 'Micronized Mineral Carrier (Boric-Fortified)',
  percentOfProduct: 0,
  substances: [
    // Ambiguous-match case: real Annex VI covers boric acid via a boron-compounds
    // group heading rather than its own standalone row ("grouping entry").
    { name: 'Boric acid', casNumber: '10043-35-3', concentration: 8 },
    { name: 'Kaolin', casNumber: '1332-58-7', concentration: 60 },
  ],
};

export const antiCakingBase: Formulant = {
  id: 'fnt-anticaking-base',
  name: 'Anti-Caking Powder Base',
  percentOfProduct: 0,
  substances: [
    // Ambiguous-match case: real Annex VI entry only applies to a specific physical
    // form (respirable powder above a particle-size threshold, per Note 10) — resolving
    // whether it applies requires reading the note ("relevant note code").
    { name: 'Titanium dioxide', casNumber: '13463-67-7', concentration: 5 },
    { name: 'Kaolin', casNumber: '1332-58-7', concentration: 70 },
  ],
};

export const humectantCarrier: Formulant = {
  id: 'fnt-humectant-carrier',
  name: 'Humectant Carrier Fluid',
  percentOfProduct: 0,
  substances: [
    { name: 'Glycerol', casNumber: '56-81-5', concentration: 50 },
    { name: 'Water', casNumber: '7732-18-5', concentration: 50 },
  ],
};

export const aqueousDiluent: Formulant = {
  id: 'fnt-aqueous-diluent',
  name: 'Bulk Aqueous Diluent',
  percentOfProduct: 0,
  substances: [{ name: 'Water', casNumber: '7732-18-5', concentration: 100 }],
};

/** Clones a shared formulant with the percentOfProduct it takes in a given formulation. */
export function at(formulant: Formulant, percentOfProduct: number): Formulant {
  return { ...formulant, percentOfProduct };
}
