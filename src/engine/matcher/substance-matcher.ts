import type { ClpReferenceEntry } from '../../schemas/clp-reference.js';
import type {
  AmbiguityReason,
  CompoundedSubstance,
  SubstanceMatch,
} from '../shared/types.js';

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const existing = map.get(key);
  if (existing !== undefined) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function hasGroupingSiblings(
  byIndexNumber: Map<string, ClpReferenceEntry[]>,
  entry: ClpReferenceEntry,
): boolean {
  const siblings = byIndexNumber.get(entry.indexNumber);
  return siblings !== undefined && siblings.length > 1;
}

function findMissingSclClassifications(entry: ClpReferenceEntry): string[] {
  return entry.cmr.classifications
    .filter((classification) => classification.specificConcentrationLimit === undefined)
    .map((classification) => `${classification.endpoint} ${classification.category}`);
}

/**
 * Resolves the ambiguity reasons for an already-identified candidate entry: grouping-entry
 * siblings, note codes, and missing CMR SCLs. Does not itself decide *which* entry is the
 * candidate - that's the CAS/name resolution in `buildSubstanceMatcher`.
 */
function ambiguityReasonsFor(
  entry: ClpReferenceEntry,
  byIndexNumber: Map<string, ClpReferenceEntry[]>,
  alreadyFlagged: AmbiguityReason[],
): AmbiguityReason[] {
  const reasons = [...alreadyFlagged];

  if (
    hasGroupingSiblings(byIndexNumber, entry) &&
    !reasons.some((reason) => reason.code === 'groupingEntry')
  ) {
    const siblingCount = byIndexNumber.get(entry.indexNumber)?.length ?? 1;
    reasons.push({
      code: 'groupingEntry',
      detail: `shares index number ${entry.indexNumber} with ${siblingCount - 1} other entr${siblingCount - 1 === 1 ? 'y' : 'ies'} (grouping/named-group entry)`,
    });
  }

  if (entry.noteCodes !== undefined && entry.noteCodes.length > 0) {
    reasons.push({
      code: 'relevantNoteCode',
      detail: `carries note code(s) ${entry.noteCodes.join(', ')} - meaning not interpreted by the engine`,
    });
  }

  const missingSclEndpoints = findMissingSclClassifications(entry);
  if (missingSclEndpoints.length > 0) {
    reasons.push({
      code: 'missingScl',
      detail: `no specific concentration limit published for: ${missingSclEndpoints.join(', ')} - generic Annex I limit applies`,
    });
  }

  return reasons;
}

/**
 * Builds a substance matcher over a CLP reference dataset (either the small hand-authored
 * fixture or the real ingested Annex VI dataset). CAS-number match, falling back to exact
 * case-insensitive name match; flags ambiguity with a reason code so a workflow knows when to
 * branch to the LLM+RAG path instead of trusting the deterministic path (see
 * `docs/PLAN.md`'s Milestone 4). This does not do fuzzy or synonym resolution itself - an
 * unrecognized name is flagged `synonymMismatch`, not guessed at.
 */
export function buildSubstanceMatcher(
  dataset: ClpReferenceEntry[],
): (substance: CompoundedSubstance) => SubstanceMatch {
  const byCas = new Map<string, ClpReferenceEntry[]>();
  const byName = new Map<string, ClpReferenceEntry[]>();
  const byIndexNumber = new Map<string, ClpReferenceEntry[]>();

  for (const entry of dataset) {
    if (entry.casNumber !== undefined) {
      pushInto(byCas, entry.casNumber, entry);
    }
    pushInto(byName, entry.name.toLowerCase(), entry);
    pushInto(byIndexNumber, entry.indexNumber, entry);
  }

  return function match(substance: CompoundedSubstance): SubstanceMatch {
    const preResolutionReasons: AmbiguityReason[] = [];
    let candidate: ClpReferenceEntry | undefined;

    if (substance.casNumber !== undefined) {
      const casHits = byCas.get(substance.casNumber);
      const [firstCasHit] = casHits ?? [];
      if (firstCasHit !== undefined) {
        candidate = firstCasHit;
        if (casHits !== undefined && casHits.length > 1) {
          preResolutionReasons.push({
            code: 'groupingEntry',
            detail: `CAS number ${substance.casNumber} matches ${casHits.length} reference entries unexpectedly - picked the first`,
          });
        }
      }
    }

    if (candidate === undefined) {
      const nameHits = byName.get(substance.name.toLowerCase());
      const [firstNameHit] = nameHits ?? [];
      if (firstNameHit === undefined) {
        return {
          reference: undefined,
          ambiguityReasons: [
            {
              code: 'synonymMismatch',
              detail: `no Annex VI entry found for CAS ${substance.casNumber ?? '(none declared)'} or name "${substance.name}"`,
            },
          ],
        };
      }
      candidate = firstNameHit;
      if (nameHits !== undefined && nameHits.length > 1) {
        preResolutionReasons.push({
          code: 'groupingEntry',
          detail: `${nameHits.length} entries share the name "${substance.name}" with no CAS number to disambiguate`,
        });
      }
    }

    return {
      reference: candidate,
      ambiguityReasons: ambiguityReasonsFor(
        candidate,
        byIndexNumber,
        preResolutionReasons,
      ),
    };
  };
}
