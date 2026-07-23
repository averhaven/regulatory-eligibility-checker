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
 * Why a substance match needs review before the deterministic path is trusted wholesale.
 * `synonymMismatch` covers both "declared name/synonym not found" and "no Annex VI entry
 * exists at all for this CAS/name" - the matcher can't distinguish those, so they share a
 * code. A substance can carry more than one reason at once (e.g. a grouping entry that also
 * carries a note code), so these are collected as an array, never a single prioritized value.
 */
export type AmbiguityReasonCode =
  'synonymMismatch' | 'groupingEntry' | 'missingScl' | 'relevantNoteCode';

export interface AmbiguityReason {
  code: AmbiguityReasonCode;
  detail: string;
}

/**
 * The result of matching one `CompoundedSubstance` against a CLP reference dataset.
 * `reference: undefined` means no reference entry was found at all - for acute toxicity this
 * specifically means "unknown toxicity" (feeds the >10%-unknown ATEmix correction). There is
 * no analogous correction for skin/eye or CMR: an unmatched substance simply contributes zero
 * there. `ambiguityReasons` is additive provenance on top of that: empty means a clean match
 * safe for the deterministic path; non-empty flags why this substance would need to branch to
 * the future LLM+RAG path instead (Milestone 7) - it doesn't change how today's hazard-class
 * math treats `reference`.
 */
export interface SubstanceMatch {
  reference: ClpReferenceEntry | undefined;
  ambiguityReasons: AmbiguityReason[];
}

/** A `CompoundedSubstance` joined to its match result against the CLP reference dataset. */
export interface MatchedSubstance extends CompoundedSubstance, SubstanceMatch {}

/** A `MatchedSubstance` restated with the role it played in a specific hazard verdict. */
export interface ContributingSubstance {
  key: string;
  name: string;
  casNumber?: string;
  totalConcentration: number;
  contributions: SubstanceContribution[];
  role: string;
}
