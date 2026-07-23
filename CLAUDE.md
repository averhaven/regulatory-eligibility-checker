# CLAUDE.md

EU CLP mixture classification + sale-eligibility agent for pesticide formulations. See
`README.md` for the problem statement, `docs/ARCHITECTURE.md` for design/components, and
`docs/PLAN.md` for milestones and the living decision log — check it before assuming the
architecture is settled, since decisions get revised there as work progresses.

## Commands

```
npm run build                  # tsc -> dist/
npm run typecheck              # tsc --noEmit
npm test                       # vitest run
npm run test:watch             # vitest
npm run lint                   # eslint .
npm run format                 # prettier --write .
npm run ingest:annex-vi        # regenerate src/data/clp-reference/generated/ from the vendored xlsx
npm run ingest:annex-vi:smoke  # opt-in sanity check against the real xlsx (not part of `npm test`)
```

## Stack/conventions

- Strict TypeScript (ES2022, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) +
  Zod schemas as the shared contract across mock data, engine I/O, and (later) workflow
  state.
- ESLint (`typescript-eslint` `recommendedTypeChecked`) + Prettier (single quotes, semi,
  90-col). Run `npm run lint` / `npm run format` before considering work done.
- Vitest; tests are colocated as `*.test.ts` next to the source they cover, not in a
  separate tree.

## Repo layout

- `src/schemas/` — Zod schemas (substances, formulants, formulations, CLP reference).
- `src/data/mock/` — hand-authored, deliberately fictional formulations/formulants.
- `src/data/clp-reference/` — two-tier reference data, **never blur the two**:
  `fixtures/` (small hand-authored set for fast engine tests, not verified against a
  primary source) vs `generated/` (the real dataset ingested from Annex VI, 3,740
  entries). See ARCHITECTURE.md's "Reference data" section for why.
- `src/data/clp-reference/ingestion/` — the Annex VI Excel export parser.
- `src/engine/` — pure, deterministic functions: `clp-labeling/` (acute toxicity,
  skin/eye corrosion, CMR), `eligibility/` (co-formulant CMR ban), and `matcher/`
  (`buildSubstanceMatcher` — CAS/name match, flags ambiguity with a reason code).

## Invariants

- Every output number traces to a deterministic function or a cited source — never an
  LLM-asserted number.
- The substance matcher's "no match" must always mean "escalate as unmatched," never
  "treat as non-hazardous" — enforced by `buildSubstanceMatcher` in
  `src/engine/matcher/substance-matcher.ts` (Milestone 4).
- Never describe hand-authored fixture data as "sourced from" or "cross-checked against"
  real documents — this mislabeling happened once already (see PLAN.md's Milestone 2
  correction) and must not recur.
- `src/data/clp-reference/generated/` is real ECHA data — regenerate via `npm run
ingest:annex-vi`, never hand-edit. `src/data/mock/` must stay fictional.

## Status

Milestones 1–4 done (schemas/mock data, CLP labeling engine, real Annex VI ingestion, EU
sale eligibility verdict, substance matcher + ambiguity detection). Milestone 5 (PDF
ingestion + RAG store) is next — see `docs/PLAN.md`.
