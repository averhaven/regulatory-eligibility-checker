import type { Formulant } from '../../schemas/formulant.js';

/**
 * Shared fictional formulants, reused across multiple mock formulations below so
 * formulation-wide summation (same substance arriving via different formulants, or the
 * same formulant reused in different products) is actually exercised by the engine.
 *
 * Substance identities (name + CAS) are real, public facts — only the formulant/product
 * names and the declared compositions are fictional. Individual formulants below are
 * annotated with the ambiguous-match case they're designed to exercise.
 */

export const chlorpyrifosConcentrate: Formulant = {
  id: 'fnt-chlorpyrifos-conc',
  name: 'Chlorpyrifos Technical Concentrate',
  percentOfProduct: 0, // overridden per-formulation
  substances: [
    // Ambiguous-match case: declared under a historical trade name, no CAS given —
    // forces the substance matcher to fall back to name/synonym lookup, which finds nothing
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
    // Ambiguous-match case: Annex VI gives formaldehyde's Carc. 1B/Muta. 2 classifications
    // no substance-specific concentration limit, so the generic Annex I limit must be
    // resolved ("missing SCL"). Deliberately also present in biocideReserveBlend below so
    // a single formulation can carry the same CMR substance via two different formulants,
    // exercising cross-formulant summation.
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
    // Clean match: Annex VI gives acetic acid its own substance-specific concentration
    // limits (90/25/10%), so no generic-limit fallback is needed here.
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
    // Ambiguous-match case: real Annex VI covers boric acid via a named group entry
    // (index 005-007-00-2) shared with a second CAS-numbered identity, rather than its own
    // standalone row ("grouping entry"). That same real entry also carries Note 11 and
    // publishes no SCL on its reproductive-toxicity classification, so matching against the
    // real Annex VI dataset additionally surfaces "relevant note code" and "missing SCL" for
    // this substance, all 3 reasons at once — see the "against the real Annex VI dataset"
    // describe block in src/engine/matcher/substance-matcher.test.ts.
    // The small fixture only models one row (with an explicit SCL) for it, so none of this
    // triple-reason behavior is visible there.
    { name: 'Boric acid', casNumber: '10043-35-3', concentration: 8 },
    { name: 'Kaolin', casNumber: '1332-58-7', concentration: 60 },
  ],
};

export const phosphoricConditioningAgent: Formulant = {
  id: 'fnt-phosphoric-conditioning',
  name: 'Phosphoric Acid Conditioning Blend',
  percentOfProduct: 0,
  substances: [
    // Ambiguous-match case: real Annex VI entry (index 015-011-00-6) carries Note B, whose
    // specific meaning the engine doesn't interpret (opaque, future RAG territory) —
    // resolving whether/how it modifies the classification requires reading the note
    // ("relevant note code"). A real, current, single-row entry on both the small fixture and
    // the real Annex VI dataset, so this case is consistent either way.
    { name: 'Phosphoric acid', casNumber: '7664-38-2', concentration: 5 },
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
