import type {
  AcuteToxicityCategory,
  SkinEyeClassificationCode,
  CmrEndpoint,
  CmrCategory,
} from '../../../schemas/clp-reference.js';

/**
 * One row read directly off the `ATP23` worksheet, columns mapped by letter and cell values
 * flattened to plain trimmed strings. Raw material for the parsers below — nothing here has
 * been interpreted yet.
 */
export interface AnnexViRowInput {
  rowNumber: number;
  indexNumber: string;
  chemicalName: string;
  casNo: string;
  hazardClassCodes: string;
  hazardStatementCodes: string;
  mSclAte: string;
  notes: string;
}

export interface RejectRecord {
  rowNumber: number;
  indexNumber: string;
  column: 'G/H' | 'L' | 'D/F' | 'assembled-row';
  rawText: string;
  reason: string;
}

/** A parse failure with no row context yet — row-level modules attach that to build a
 * full `RejectRecord`. */
export interface ParseFailure {
  rawText: string;
  reason: string;
}

export interface SubstanceIdentity {
  name: string;
  casNumber?: string;
}

/** The v1-relevant hazard-class facet a single G/H line or column-L SCL line can modify. */
export type HazardTarget =
  | { kind: 'acuteToxOral'; category: AcuteToxicityCategory }
  | { kind: 'skinEye'; classification: SkinEyeClassificationCode }
  | { kind: 'cmr'; endpoint: CmrEndpoint; category: CmrCategory };

export type HazardLineResult =
  | HazardTarget
  | { kind: 'irrelevant' }
  | { kind: 'reject'; rawText: string; reason: string };

export interface SclEntry {
  target: HazardTarget;
  concentrationPercent: number;
}

export interface ColumnLResult {
  oralAteMgPerKg?: number;
  sclEntries: SclEntry[];
  rejects: ParseFailure[];
}

export interface AnnexViProvenance {
  sourceFile: string;
  atpVersion: number;
  ingestedAt: string;
}
