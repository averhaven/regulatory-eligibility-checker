import type { AnnexViProvenance } from './types.js';

export function buildProvenance(sourceFile: string, atpVersion: number, ingestedAt: Date): AnnexViProvenance {
  return {
    sourceFile,
    atpVersion,
    ingestedAt: ingestedAt.toISOString().slice(0, 10),
  };
}
