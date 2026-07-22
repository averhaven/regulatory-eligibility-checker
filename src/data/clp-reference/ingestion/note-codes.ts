/**
 * Column M ("Notes") is a `\n`-joined list of note-code references (e.g. "A", "11", or
 * combinations like "A\nC"). Their meaning lives in CLP Annex VI Part 1, not in this
 * workbook — this just captures the raw codes; resolving what they mean is deferred to a
 * later milestone (RAG over a real downloaded source).
 */
export function parseNoteCodes(notesCell: string | undefined): string[] {
  if (!notesCell) return [];
  return notesCell
    .split('\n')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}
