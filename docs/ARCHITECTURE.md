# Architecture

## Functional requirements

1. Decompose formulation → formulants → declared substances, compounding concentrations
   correctly (e.g. formulant at 40% of product, containing 0.3% of a substance → 0.12% of
   finished product).
2. Match each substance against the CLP reference dataset (CAS number, then
   name/synonym). Clean match → deterministic path. No/ambiguous match → escalate to
   LLM+RAG. **Closed-world invariant:** "no match" is only a safe signal that a substance
   is genuinely unclassified once the reference dataset is the real, complete Annex VI. On
   any partial/fixture dataset, "no match" must always mean "escalate as unmatched," never
   "treat as non-hazardous" — the two are indistinguishable to the matcher and conflating
   them silently produces false-negative verdicts.
3. Aggregate matched substances into per-hazard-class totals across the whole
   formulation (not per-formulant).
4. Apply the hazard-class-specific deterministic rule.
5. Resolve note codes via RAG over PDF guidance when they modify a limit.
6. **CLP/GHS labeling** (see Milestone 2): emit a verdict per hazard class, with full
   provenance: every contributing substance, which formulant it came from, which data row
   or PDF clause justified it.
7. **EU sale eligibility** (see Milestone 3): emit a final eligible/not-eligible verdict —
   the actual deliverable. Per Reg. (EU) 2023/574 (implementing Art. 27 of Reg. (EC)
   1107/2009), a co-formulant classified CMR Category 1A/1B is unacceptable in a plant
   protection product outright, regardless of its concentration. This is not derived from
   the 3 hazard-class verdicts above — those are classification/labelling outputs, not
   authorisation cut-offs — see `docs/PLAN.md`'s "What 'eligible' means" decision for why
   the two mechanisms are deliberately different and what's still out of scope (the Annex's
   points 4-10).

**Non-negotiable:** every number in the output traces to a deterministic function or a
cited source — never an LLM-asserted number. LLM citation output is Zod-enforced
structured data, not free text.

## Non-functional requirements

- Strict TypeScript + Zod as the single shared schema across mock data, tool I/O, and
  workflow state.
- ESLint + typescript-eslint + Prettier; Vitest for the deterministic engine; Mastra's
  eval/scorer framework for agent-behavior regression; CI (GitHub Actions) running lint +
  typecheck + test + eval.
- Mock data must be unambiguously fictional; CLP reference data and PDF guidance are the
  real public ECHA artifacts, so the repo can't be mistaken for real regulatory advice.
- **Provenance discipline**: any file or comment that claims to represent real regulatory
  data must trace to an actual downloaded/fetched source artifact (URL + retrieval date +
  ATP/version), never to hand-authored or model-recalled content. Hand-authored fixture
  data is legitimate for engine unit tests but must be labeled as a fixture, not described
  as "sourced from" or "cross-checked against" real documents unless that process actually
  happened and is reproducible.

## Components

| Component | Job | Mastra primitive |
|---|---|---|
| Mock formulation/formulant DB | Hand-authored fictional dataset | Zod schema + JSON |
| Reference data sourcing + Annex VI notation parser | Parses ECHA's vendored Annex VI Excel export — free-text notation cells (SCL conditions, category-conditioned entries, note-code references) — into `RawClpExportRow`s; records provenance (ATP version, ingestion date). Acquisition itself was manual (the xlsx was downloaded once and committed, not fetched by this script — see below) | Script (`src/data/clp-reference/ingestion/`, run offline via `npm run ingest:annex-vi`, output committed — not a live workflow Tool touched per-request) |
| CLP reference loader | Normalizes `RawClpExportRow`s into engine-facing `ClpReferenceEntry`s (Table 3.1.2 category→ATE conversion, etc.) — fed by both the hand-authored fixture rows and the real ingestion pipeline's output | Tool |
| Substance matcher | CAS/synonym match, flags ambiguity with a reason code; enforces the closed-world invariant above | Tool |
| PDF ingestion + RAG store | Chunks/embeds ECHA guidance PDFs | RAG pipeline |
| Hazard-class summation engine | One pure function per hazard class | Tools |
| Co-formulant eligibility checker | Reg. (EU) 2023/574 Annex points 1-3 — CMR 1A/1B substance-identity ban, independent of the hazard-class summation engine | Tool |
| Note-code/ambiguity resolver | The one genuine LLM judgment point: reads retrieved PDF text, returns structured citation | Agent step (embedded, not top-level) |
| Output formatter | Assembles verdict + citations, including which Annex VI/ATP version was checked | Workflow step (deterministic) |
| Orchestration | decompose → match → branch(clean/ambiguous) → aggregate → classify → format | Workflow (`.then()`/`.branch()`) |
| Eval suite | Vitest for engine; Mastra evals/scorers for citation validity + groundedness + adversarial cases | Evals |

## Reference data: sourcing, authority, and versioning

Two tiers of ECHA data exist, with different legal weight:

- **Table 3, Annex VI to CLP Regulation (EC) 1272/2008** — the harmonised classification
  list. This is the only legally binding source, published in the Official Journal of the
  EU via EUR-Lex, and amended a few times a year by ATPs (Adaptations to Technical
  Progress). ECHA separately publishes an Excel convenience export of the same table at
  echa.europa.eu/information-on-chemicals/annex-vi-to-clp, per-ATP-versioned — but ECHA
  itself marks that export **unofficial** and disclaims responsibility for it; EUR-Lex is
  the source of truth if a specific entry is ever disputed. This project ingests the ECHA
  Excel export (practical, structured, ATP-versioned) rather than parsing EUR-Lex HTML, and
  records which ATP version was ingested.
- **C&L Inventory self-notifications** (ECHA CHEM, chem.echa.europa.eu) — company-submitted
  classifications for substances with no harmonised entry. Not legally binding, and
  different notifiers can disagree. Out of v1 scope: a substance with no harmonised Annex VI
  entry gets no reference entry at all and must be surfaced as unmatched, not silently
  resolved via self-notification data. Revisit only if the matcher's false-negative rate on
  real formulations makes this necessary.

Because Annex VI changes over time, `ClpReferenceEntry`'s provenance (dataset ingestion
date + ATP version) is captured at the dataset level today —
`generated/annex-vi.ts`'s `annexViProvenance` records the source filename, ATP23 (the
version vendored in this repo), and ingestion date. Threading that provenance through to
each individual verdict's *output* is still later workflow/formatter work (not part of
Milestone 2.5), so a verdict is not yet self-describing about which ATP it was checked
against — only the dataset as a whole is. Re-ingestion (new ATP published) is a manual,
re-run-the-pipeline-and-diff-the-output process (`npm run ingest:annex-vi`), not automatic
polling — no v1 requirement for that.

The closed-world invariant above (see Functional requirements) is enforced at ingestion
time too, not only at match time: any row or cell the notation parser can't confidently
structure into one of the 3 v1 hazard families is collected into
`src/data/clp-reference/generated/annex-vi.rejects.json` rather than silently dropped or
best-effort-guessed, so a gap in parsing coverage stays visible and reviewable instead of
silently producing a false "not classified" for some substance.

**Two separate datasets, two trust levels, never blurred:**
- `src/data/clp-reference/fixtures/dataset.ts` — a small, hand-authored, 14-entry fixture for fast
  engine unit tests, explicitly labeled as a fixture, not verified against a primary
  source.
- `src/data/clp-reference/generated/annex-vi.ts` (backed by
  `generated/annex-vi-data.json`) — the real, full reference dataset (3,740 entries, ATP23),
  produced by `src/data/clp-reference/ingestion/` parsing the vendored Excel export — this
  is what the application actually runs formulations against. Machine-generated and marked
  as such in its own header comment; never hand-edited, regenerated via
  `npm run ingest:annex-vi` instead.

These are two different files with two different trust levels, and neither should claim to
be the other.

## Key architecture decision: workflow-first, not a free-roaming agent

The pipeline is a fixed DAG with only one point of genuine open-ended reasoning
(ambiguous-match/note-code resolution). Letting an LLM decide *whether* to run the
summation step or *whether* to check a CMR threshold adds risk (skipped steps,
nondeterminism) with no benefit. The ambiguity-resolution step is scoped as a single
embedded LLM node inside an otherwise deterministic workflow.

## Observability, cost, and guardrails

- **Observability/tracing** — Mastra's built-in OpenTelemetry export (dev
  server/playground visualizes traces locally); document a real trace/span in this
  README/docs once implemented.
- **Cost/latency tracking** — log token usage per run and surface the cost delta between
  the "clean match" path (near-zero) and "ambiguous fallback" path (LLM+RAG call).
- **Guardrail/adversarial evals** — adversarial eval fixtures (malformed PDF chunk,
  contradictory retrieved text, attempts to produce a citation not grounded in a real
  ingested chunk) plus a validator ("citation must reference an actual retrieved chunk
  ID, else fail").
- **Deployment** — a thin HTTP API wrapping the workflow, deployed to a free-tier PaaS
  (Render/Fly.io/Railway), with a minimal frontend (pick a mock formulation, view the
  JSON verdict rendered readably). Deliberately minimal: no deploy-automation/CI-CD for
  the deployment itself, no fully designed UI.

## Verification approach

- Unit tests (Vitest) for every hazard-class summation function against known worked
  examples, including at least one sourced from official CLP guidance so correctness is
  externally verifiable.
- Mastra evals/scorers run in CI: schema validity of agent output, citation groundedness
  (does the cited chunk/row actually exist and support the verdict), adversarial-case
  handling.
- End-to-end manual run against the mock dataset, checking the full
  decompose → match → branch → aggregate → classify → cite → format path for both a
  clean-match formulation and one that exercises the ambiguous/RAG fallback path.
