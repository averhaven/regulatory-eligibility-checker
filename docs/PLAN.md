# Implementation plan

Tracks decisions and milestones for the EU CLP Mixture Classification Agent. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the system design these milestones implement.

## Decisions

Resolved:

- **Hazard classes for v1**: acute toxicity + skin/eye corrosion + CMR. Three distinct
  calculation shapes (ATE-weighted, straight additivity, single-substance threshold)
  without M-factor weighting. Aquatic toxicity (M-factor-weighted) is a later addition.
- **LLM provider**: OpenRouter, model `openrouter/poolside/laguna-xs-2.1`, used for the
  ambiguity-resolution step only.
- **CLP reference dataset**: real, current ECHA C&L Inventory / Annex VI export, trimmed
  to a curated subset covering the substances used in the mock formulations.
- **Vector store for RAG**: local/embedded store (no external service to stand up).
- **Formulant composition depth**: declared composition only (no below-SDS-threshold
  trace-impurity layer). Optionally mix in a small subset of formulants modeled as
  "own-manufactured" (fuller internal spec) during dataset design at Milestone 1, if that
  turns out to add a useful test case — not required.

Still open — confirm when the relevant milestone starts:

- **Mock dataset size**: proposed 5-8 formulations, 15-25 distinct formulants, enough
  substance reuse across formulants that formulation-wide summation is actually
  exercised, 30-40% of formulants hitting the ambiguous path. Confirm at Milestone 1.
- **PDF source set**: name the specific ECHA guidance documents to ingest (e.g. the CLP
  mixtures guidance document, Annex VI note-code explanations). Confirm at Milestone 4.

## Milestones

Each milestone is intended to be implementable as its own separate piece of work.

### 1. Schemas + mock dataset
Zod schemas for formulations, formulants, and declared substances. Hand-author the mock
dataset — deliberately include some clean matches and several ambiguous-path cases across
the 3 v1 hazard classes. Confirm final dataset size here (see Decisions).

### 2. CLP reference loader + deterministic summation engine + unit tests
Parse the trimmed ECHA C&L Inventory/Annex VI export. One pure function per hazard class
(acute toxicity, skin/eye corrosion, CMR). Vitest coverage against known worked examples,
including at least one sourced from official CLP guidance. Build in a tight loop with
Milestone 1 — the mock data shape will be discovered while building the engine.

### 3. Substance matcher + ambiguity detection
CAS-number match, falling back to name/synonym match. Flags ambiguity with a reason code
(synonym mismatch, grouping entry, missing SCL, relevant note code) so the workflow knows
when to branch to the LLM+RAG path.

### 4. PDF ingestion + RAG store
Chunk and embed the real ECHA guidance PDFs (source set confirmed here, see Decisions)
into the local/embedded vector store.

### 5. Ambiguity-resolution agent step + citation schema
The one genuine LLM judgment point: reads retrieved PDF text, returns a Zod-enforced
structured citation (chunk ID, table row, or PDF clause) — never free text.

### 6. Workflow orchestration end-to-end + observability
Wire the full DAG: decompose → match → branch(clean/ambiguous) → aggregate → classify →
format. Enable Mastra's OpenTelemetry export.

### 7. Eval suite in CI
Mastra evals/scorers: schema validity, citation groundedness, adversarial-case handling.
Extend with token-usage/cost logging (clean-match path vs. ambiguous-fallback path) and
guardrail/adversarial fixtures (malformed PDF chunk, contradictory retrieved text,
ungrounded-citation attempts).

### 8. Minimal API + frontend
Thin HTTP API wrapping the workflow, deployed to a free-tier PaaS (Render/Fly.io/Railway).
Minimal frontend: pick a mock formulation, view the JSON verdict rendered readably. Skip
deploy-automation/CI-CD for the deployment itself and skip a fully designed UI.

### 9. Polish
Lint/CI cleanup. README/ARCHITECTURE final pass, trace/span screenshot, cost comparison
numbers.

## Status

Not started — see Milestone 1.
