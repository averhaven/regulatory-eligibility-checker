# EU CLP Mixture Classification Agent

An AI agent that determines EU CLP (Classification, Labelling and Packaging) hazard
classification for pesticide **formulations** made up of multiple **formulants**, each
with its own declared SDS composition.

## The problem

Given a formulation — a list of formulants, each with its own declared composition —
determine EU CLP mixture classification by:

1. Compounding every substance's declared concentration through formulant % → product %.
2. Summing per hazard class across the *whole formulation*.
3. Comparing the total against CLP thresholds (generic limits, or substance-specific
   limits from ECHA's C&L Inventory / Annex VI).

Different hazard classes use different math: acute toxicity is ATE-weighted, skin/eye
corrosion is straight additivity, CMR substances use a single-substance threshold with no
summation. Annex VI entries also carry note codes (A, B, C, D, J, L, M, N, P, R, S, U...)
defined in prose in PDF guidance documents, which modify how a limit applies.

**Where the LLM adds value:** when a formulant/substance doesn't cleanly match a row in
the reference dataset (synonym mismatch, grouping entry, missing specific concentration
limit, relevant note code), the agent falls back to reading unstructured PDF guidance to
resolve which rule applies — and produces a verdict that cites its exact source (table
row, note code, or PDF clause).

**Where the LLM is never used:** the arithmetic. Summation and threshold comparison are
deterministic, unit-tested TypeScript — never LLM-computed. This split is the project's
core architectural thesis; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full
rationale.

Full functional/non-functional requirements, component breakdown, and the key
architecture decision live in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
Implementation status and milestones are tracked in [docs/PLAN.md](docs/PLAN.md).

## Data disclaimer

All formulations and formulants in this project are **hand-authored and fictional** —
built specifically for this project, not derived from any real product, employer, or
proprietary source. The CLP reference dataset (C&L Inventory / Annex VI) and the PDF
guidance documents are real, public ECHA artifacts, trimmed to the substances used in the
mock data. This project is **not** a source of real regulatory advice.

Scope: EU CLP-style hazard/concentration classification only — not full country-by-country
marketing authorization under Reg 1107/2009.

## Status

Milestone 1 (schemas + mock dataset) done. See [docs/PLAN.md](docs/PLAN.md) for
milestones.

## License

MIT — see [LICENSE](LICENSE).
