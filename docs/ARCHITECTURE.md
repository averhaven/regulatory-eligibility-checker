# Architecture

## Functional requirements

1. Decompose formulation → formulants → declared substances, compounding concentrations
   correctly (e.g. formulant at 40% of product, containing 0.3% of a substance → 0.12% of
   finished product).
2. Match each substance against the CLP reference dataset (CAS number, then
   name/synonym). Clean match → deterministic path. No/ambiguous match → escalate to
   LLM+RAG.
3. Aggregate matched substances into per-hazard-class totals across the whole
   formulation (not per-formulant).
4. Apply the hazard-class-specific deterministic rule.
5. Resolve note codes via RAG over PDF guidance when they modify a limit.
6. Emit a verdict per hazard class, with full provenance: every contributing substance,
   which formulant it came from, which data row or PDF clause justified it.

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

## Components

| Component | Job | Mastra primitive |
|---|---|---|
| Mock formulation/formulant DB | Hand-authored fictional dataset | Zod schema + JSON |
| CLP reference loader | Parses ECHA C&L Inventory/Annex VI export | Tool |
| Substance matcher | CAS/synonym match, flags ambiguity with a reason code | Tool |
| PDF ingestion + RAG store | Chunks/embeds ECHA guidance PDFs | RAG pipeline |
| Hazard-class summation engine | One pure function per hazard class | Tools |
| Note-code/ambiguity resolver | The one genuine LLM judgment point: reads retrieved PDF text, returns structured citation | Agent step (embedded, not top-level) |
| Output formatter | Assembles verdict + citations | Workflow step (deterministic) |
| Orchestration | decompose → match → branch(clean/ambiguous) → aggregate → classify → format | Workflow (`.then()`/`.branch()`) |
| Eval suite | Vitest for engine; Mastra evals/scorers for citation validity + groundedness + adversarial cases | Evals |

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
