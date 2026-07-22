import type { ParseFailure, SubstanceIdentity } from './types.js';

interface TaggedLine {
  tag: number;
  text: string;
}

/**
 * Parses a `\n`-delimited, `[n]`-tagged cell (e.g. columns D/F on a bracket-tagged grouping
 * entry: "perboric acid, sodium salt [1]\nperboric acid, sodium salt, monohydrate [2]"). Returns
 * `undefined` if any line doesn't end in a `[n]` tag — including the common case of a single
 * plain, untagged line.
 */
function parseBracketTaggedLines(text: string): TaggedLine[] | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const tagged: TaggedLine[] = [];
  for (const line of lines) {
    const match = /^(.*?)\s*\[(\d+)\]$/.exec(line);
    if (!match) return undefined;
    tagged.push({ tag: Number(match[2] ?? ''), text: (match[1] ?? '').trim() });
  }
  return tagged;
}

function normalizeCas(casText: string | undefined): string | undefined {
  if (casText === undefined) return undefined;
  const trimmed = casText.trim();
  return trimmed === '-' || trimmed === '' ? undefined : trimmed;
}

function makeIdentity(name: string, casNumber: string | undefined): SubstanceIdentity {
  return { name, ...(casNumber !== undefined && { casNumber }) };
}

/**
 * Expands columns D (`Chemical Name`) and F (`CAS No`) into one or more substance identities.
 * Handles the 3 shapes seen in Annex VI: (1) a plain single substance, (2) a "class of
 * substances" grouping entry (untagged name, `casNo = '-'`), (3) a bracket-tagged grouping
 * entry covering several distinct substances that share one classification — expanded here
 * into N separate identities so nothing downstream needs to know Excel bracket notation
 * exists.
 */
export function expandSubstanceIdentities(
  chemicalNameCell: string,
  casNoCell: string,
): { identities: SubstanceIdentity[] } | { reject: ParseFailure } {
  const rawText = `D: ${chemicalNameCell}\nF: ${casNoCell}`;
  const nameLines = chemicalNameCell
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const nameTagged = parseBracketTaggedLines(chemicalNameCell);

  if (!nameTagged) {
    if (nameLines.length > 1) {
      return {
        reject: { rawText, reason: 'multi-line chemical name without consistent bracket tags' },
      };
    }
    return {
      identities: [
        makeIdentity(nameLines[0] ?? chemicalNameCell.trim(), normalizeCas(casNoCell)),
      ],
    };
  }

  const casTagged = parseBracketTaggedLines(casNoCell);
  if (!casTagged) {
    return {
      reject: { rawText, reason: 'chemical name is bracket-tagged but CAS No column is not' },
    };
  }

  const casByTag = new Map(casTagged.map((entry) => [entry.tag, entry.text]));
  const missingTag = nameTagged.find((entry) => !casByTag.has(entry.tag));
  if (missingTag) {
    return {
      reject: { rawText, reason: `no matching CAS No entry for tag [${missingTag.tag}]` },
    };
  }

  return {
    identities: nameTagged.map(({ tag, text }) => makeIdentity(text, normalizeCas(casByTag.get(tag)))),
  };
}
