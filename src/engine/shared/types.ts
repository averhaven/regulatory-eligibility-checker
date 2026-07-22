import type { ClpReferenceEntry } from '../../schemas/clp-reference.js';

/** Where a substance's compounded concentration came from, for provenance in a verdict. */
export interface SubstanceContribution {
  formulantId: string;
  formulantName: string;
  /** Percent of the finished product contributed by this formulant. */
  concentrationOfProduct: number;
}

/**
 * A declared substance aggregated across every formulant it appears in, compounded to
 * percent-of-finished-product. `key` groups by CAS number when present, else by the exact
 * declared name - this is pure arithmetic aggregation, not a substance matcher: two
 * formulants declaring the same real substance under different names/no CAS (e.g. a
 * synonym-only declaration) will NOT be merged here.
 *
 * TODO: merging those requires a real synonym/ambiguity-aware substance matcher.
 */
export interface CompoundedSubstance {
  key: string;
  name: string;
  casNumber?: string;
  totalConcentration: number;
  contributions: SubstanceContribution[];
}

/**
 * A `CompoundedSubstance` joined to its CLP reference entry. `reference: undefined` means
 * no reference entry was found at all - for acute toxicity this specifically means
 * "unknown toxicity" (feeds the >10%-unknown ATEmix correction). There is no analogous
 * correction for skin/eye or CMR: an unmatched substance simply contributes zero there.
 */
export interface MatchedSubstance extends CompoundedSubstance {
  reference: ClpReferenceEntry | undefined;
}

/** A `MatchedSubstance` restated with the role it played in a specific hazard verdict. */
export interface ContributingSubstance {
  key: string;
  name: string;
  casNumber?: string;
  totalConcentration: number;
  contributions: SubstanceContribution[];
  role: string;
}
