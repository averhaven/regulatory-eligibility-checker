# Implementation plan

Tracks decisions and milestones for the EU regulatory eligibility checker (CLP/GHS
labeling + EU sale eligibility). See
[ARCHITECTURE.md](ARCHITECTURE.md) for the system design these milestones implement.

## Decisions

Resolved:

- **Hazard classes for v1**: acute toxicity + skin/eye corrosion + CMR. Three distinct
  calculation shapes (ATE-weighted, straight additivity, single-substance threshold)
  without M-factor weighting. Aquatic toxicity (M-factor-weighted) is a later addition.
- **LLM provider**: OpenRouter, model `openrouter/poolside/laguna-xs-2.1`, used for the
  ambiguity-resolution step only.
- **CLP reference dataset**: two separate datasets, not one. (1) A small hand-authored
  fixture set (`src/data/clp-reference/fixtures/dataset.ts`) covering the substances used in the
  mock formulations, for fast Vitest engine coverage — labeled as a fixture, not verified
  against a primary source. (2) A real reference dataset ingested from ECHA's Annex VI
  Excel export (see ARCHITECTURE.md's "Reference data: sourcing, authority, and
  versioning"), which is what the application actually runs real formulations against. See
  the correction under Milestone 2 below — (1) was originally mislabeled as if it were (2).
- **Vendored Annex VI artifact location**: commit both the downloaded Excel export
  (`src/data/clp-reference/ingestion/annex_vi_clp_table_atp23_en.xlsx`) and the generated dataset it
  produces (`src/data/clp-reference/generated/annex-vi-data.json` +
  `generated/annex-vi.ts`). Reproducibility (a verdict traces to a specific committed ATP
  snapshot, no build-time re-ingestion needed to run tests) outweighs the ~2MB repo cost for
  a demo project. No separate download/fetch script was built — the xlsx was manually
  vendored (downloaded once, placed in the repo); the ingestion script's job starts from
  that file already being present and only records provenance (ATP version, retrieval/
  ingestion date), not acquisition. A live-lookup alternative (e.g. an MCP against ECHA
  CHEM) is a deliberately deferred future add-on, not required for the demo.
- **What "eligible" means (the final OK/not-OK verdict)**: not derived from the 3 CLP
  hazard-class verdicts (those are classification/labelling outputs, not authorisation
  cut-offs). It's driven by Reg. (EU) 2023/574's Annex, the implementing rules for Art. 27
  of Reg. (EC) 1107/2009: a co-formulant "is or has to be classified as" CMR Category 1A/1B
  is unacceptable for inclusion in a plant protection product outright, regardless of its
  concentration — a ban on the substance's own CLP classification, not a concentration-
  weighted mixture threshold. This is a genuinely different mechanism from CLP Annex I's
  concentration-limit/ATEmix math (already built, see Milestone 2) — that math decides
  whether the *finished formulation* itself must carry a hazard label; this decides whether
  a *co-formulant substance* may be used at all. v1 implements only points 1-3 of the
  Annex's 10 criteria (CMR 1A/1B) — see the TODO below for points 4-10. (See Milestone 3.)
- **Vector store for RAG**: local/embedded store (no external service to stand up).
- **Formulant composition depth**: declared composition only (no below-SDS-threshold
  trace-impurity layer). Optionally mix in a small subset of formulants modeled as
  "own-manufactured" (fuller internal spec) during dataset design at Milestone 1, if that
  turns out to add a useful test case — not required.
- **Milestone 1 scaffolding**: plain TypeScript (package.json/tsconfig/ESLint/Prettier/
  Vitest) — no Mastra dependency yet. Mastra's Tool/Agent/Workflow/RAG primitives don't
  appear until Milestone 2+ (loader/engine), Milestone 5 (RAG), Milestone 6 (agent step),
  and Milestone 7 (workflow orchestration), so introducing it now would sit unused.

- **Mock dataset size**: went smaller than the original 5-8/15-25 proposal — 4
  formulations, 11 distinct formulants (reused across formulations), 14 distinct real
  substances (4 acute toxicity, 4 skin/eye corrosion, 3 CMR, 3 hazard-irrelevant
  controls), 4 of 14 substances (~29%) on the ambiguous path. Rationale: Milestone 1 and
  Milestone 2 are meant to be built in a tight loop and the mock data shape is expected to
  shift once the summation engine exists; and the ambiguous-path cases can't be verified
  as correctly ambiguous until Milestone 4's matcher exists to run against them. Building
  a large dataset now would mean redoing speculative work. **TODO: expand the dataset**
  after Milestone 4 lands (matcher can confirm each ambiguous case produces its intended
  reason code) and again at Milestone 8 (eval suite is the natural home for broader
  adversarial/edge-case fixture coverage).

Still open — confirm when the relevant milestone starts:

- **TODO: co-formulant eligibility ban, points 4-10 of Reg. (EU) 2023/574's Annex.**
  `src/engine/eligibility/co-formulant-eligibility.ts` (Milestone 3) implements only points 1-3 (CMR
  1A/1B). The remaining points need reference data this project doesn't ingest yet: POPs
  Annexes I-V (point 4), the REACH Article 59(1) SVHC candidate list (point 5), REACH Annex
  XVII restrictions (point 9), Reg. 528/2012 biocidal-product-type-6 decisions (points 6-8),
  and 1107/2009 Annex II's broader active-substance approval criteria (point 10, catch-all).
  Each is its own dataset-sourcing problem on the scale of Milestone 2.5's Annex VI
  ingestion.
- **TODO: implement the 1107/2009 Annex III unintentional-impurity exemption in
  `co-formulant-eligibility.ts`.** Real EU law (Annex III as amended by Reg. (EU) 2021/383)
  exempts a banned co-formulant present below 0.1% w/w by default, or below its own CLP
  specific concentration limit (SCL) if one exists (e.g. boric acid's real 5.5% SCL) — the
  ban only bites above that floor. The current implementation bans on any nonzero declared
  concentration, which is stricter than the real rule. Correction to an earlier note here:
  this was previously dismissed as "not applicable to v1's declared-composition-only scope,"
  reasoning that turned out to be wrong — the exemption text is scoped to "unintentional"
  impurities, but a real SDS (which this project's declared-composition model stands in
  for) doesn't disclose a CMR ingredient by name below ~0.1% w/w regardless of whether its
  presence is intentional or incidental (same threshold, REACH Annex II/CLP Article 18
  Section 3 disclosure rules), so there's no real-world data source that could distinguish
  "intentional trace addition" from "unintentional impurity" in the first place. Applying
  the concentration floor uniformly, regardless of stated intent, is therefore the correct
  v1 behavior, not a skippable edge case. Needs a new flat-0.1%-or-SCL constant, distinct
  from `classifyCmr`'s existing GCL table in `cmr.ts` (a different, unrelated CLP Annex I
  mixture-classification limit — e.g. 0.3%/3.0% for reproductive toxicity 1A/1B/2, not
  0.1%).
- **PDF source set**: name the specific ECHA guidance documents to ingest (e.g. the CLP
  mixtures guidance document, Annex VI note-code explanations). Confirm at Milestone 5. Note
  the note-code *reference letters/numbers* (A, B, C…, 1, 2, 3…) are now captured on real
  entries by Milestone 2.5's ingestion (`ClpReferenceEntry.noteCodes`), but their *meaning*
  is not — that text lives in CLP Annex VI Part 1 itself, which should probably be one of
  the documents in this source set, not just the general mixtures guidance.

Milestone 2 correction — **`src/data/clp-reference/fixtures/dataset.ts`'s header comment overclaimed
its provenance.** It says the 14 rows were "sourced from the consolidated Annex VI
harmonised classification table... cross-checked against SDS excerpts" — no such source
file exists anywhere in the repo or was actually fetched; the rows were hand-authored from
recall, not extracted. The engine/math built on top (validated against ECHA's own worked
examples) is unaffected, but the dataset itself must be relabeled as a fixture, and the real
ingestion work described in new Milestone 2.5 below still needs to happen before this is
used against any formulation outside the mock set.

Milestone 2 follow-ups — the mock dataset's Milestone 1 ambiguous-case framing has drifted
from current real regulatory fact for 2 of its 14 substances; fix at the Milestone 4/8
dataset-expansion point rather than mid-Milestone-2:

- **Titanium dioxide's CMR entry is stale.** The historical Carc. 2 classification (index
  022-006-00-2, particle-size-conditioned via a Note — the mock dataset's designed
  "relevant note code" ambiguous CMR case) was annulled by the CJEU on 2025-08-01 and no
  longer exists in Annex VI. Per explicit project decision, `src/data/clp-reference/`
  models titanium dioxide with no CMR classification (reflects current law) rather than the
  stale entry or a forced substitute substance — no real, current, EU-harmonised CMR entry
  exists among plausible pesticide inert ingredients (crystalline silica, talc, etc. aren't
  EU-harmonised despite being hazardous elsewhere). This leaves the dataset with only 2 live
  CMR ambiguity flavors (formaldehyde clean-match, boric acid grouping-entry) instead of the
  originally intended 3. Needs either a real substitute substance or a reframed 3rd
  ambiguity flavor when the dataset is next expanded.
- **Acetic acid's "missing SCL" framing is stale.** Real Annex VI does publish an SCL for
  acetic acid (Skin Corr. 1A ≥90%, Corr. 1B 25–90%, Irrit. 2 10–25%) — the Milestone 1
  comment on `acidPhAdjuster` in `src/data/mock/formulants.ts` assumed no SCL exists.
  `src/data/clp-reference/fixtures/dataset.ts` models the real SCL. Needs a corrected comment or a
  different substance to actually exercise the "missing SCL" ambiguity reason code.
- **Formaldehyde's real acute-toxicity classification is
  deliberately not modeled** in `src/data/clp-reference/fixtures/dataset.ts`, to keep the dataset's
  documented "4 acute toxicity substances" count accurate (chlorpyrifos, cypermethrin,
  methanol, xylene). Revisit if/when the dataset is expanded. Correction: this bullet
  previously guessed "Acute Tox. 3, all routes" from recall; Milestone 2.5's real ingestion
  shows formaldehyde's actual Annex VI entry (CAS 50-00-0) is Acute Tox. 4, oral route only
  (published ATE 500 mg/kg) — see `generated/annex-vi-data.json`. The fixture still
  deliberately omits it either way; this just corrects what the omitted real value is.

## Milestones

Each milestone is intended to be implementable as its own separate piece of work.

### 1. Schemas + mock dataset — done

Zod schemas for formulations, formulants, and declared substances. Hand-author the mock
dataset — deliberately include some clean matches and several ambiguous-path cases across
the 3 v1 hazard classes. Confirm final dataset size here (see Decisions).

Delivered: `src/schemas/` (substance/formulant/formulation Zod schemas), `src/data/mock/`
(4 fictional formulations, 11 reused formulants, 14 real substances with 4 tagged
ambiguous-match cases), Vitest coverage validating the dataset against the schemas.
Dataset-expansion TODO tracked under Decisions above.

### 2. CLP labeling: reference loader + deterministic summation engine + unit tests — done

The CLP/GHS labeling feature — decides what hazard label the *finished formulation* must
carry (see Decisions above for how this differs from Milestone 3's EU sale eligibility
feature). Parse the trimmed ECHA C&L Inventory/Annex VI export. One pure function per hazard class
(acute toxicity, skin/eye corrosion, CMR). Vitest coverage against known worked examples,
including at least one sourced from official CLP guidance. Build in a tight loop with
Milestone 1 — the mock data shape will be discovered while building the engine.

Delivered: `src/schemas/clp-reference.ts` (Zod schemas for the 3 v1 hazard-class facets);
`src/data/clp-reference/` (a trimmed, real 14-substance Annex VI/C&L reference dataset,
`parseClpExportRow` loader with the Table 3.1.2 category→ATE conversion, a
`lookupByCasOrName` exact-match stand-in for Milestone 4's real matcher, and one synthetic
note-conditioned entry for engine test coverage); `src/engine/` (`compoundFormulation` +
`attachReferences` for decompose/aggregate/match, `classifyAcuteToxicity` — oral-only ATEmix
with the >10%-unknown correction and the §3.1.3.3(c) over-classification ceiling guard,
`classifySkinEyeCorrosion` — SCL/GCL additivity, the bridging rule, and GCL sub-category
stepwise resolution, `classifyCmr` — single-substance threshold, no cross-substance
summation, and `classifyFormulation` composing all three). 40 Vitest cases, including both
of ECHA's "Guidance on the Application of the CLP Criteria" v6.0 worked examples (§3.1.5.3,
Examples 11 and 12a) and end-to-end runs against all 4 real mock formulations. See the
Decisions/follow-ups above for 2 known Milestone-1-mock-data staleness issues surfaced while
researching real reference data (titanium dioxide's annulled CMR entry, acetic acid's SCL).

### 2.5. Real Annex VI ingestion pipeline — done

Replaces the assumption (baked into Milestone 2's original framing) that a "trimmed real
export" already existed. No download/fetch step: the ECHA Annex VI Excel export (ATP23,
`src/data/clp-reference/ingestion/annex_vi_clp_table_atp23_en.xlsx`) was manually vendored; the
pipeline starts from that file already being present.

Delivered: `src/data/clp-reference/ingestion/` — a notation parser broken into small, unit-
tested pure functions (`hazard-classification.ts` for columns G/H, `column-l-notation.ts`
for column L's SCL/ATE/M-factor mini-language, `substance-identity.ts` for columns D/F
including bracket-tagged grouping-entry expansion, `note-codes.ts` for column M),
`assemble-row.ts` composing them per sheet row into `RawClpExportRow[]` (unchanged from
Milestone 2) plus a reject list, `workbook.ts` for the ExcelJS read (including a workaround
for ExcelJS's hard-coded refusal to load a workbook containing a sheet literally named
"History", which the real export has), and `pipeline.ts`/`run.ts`/`smoke-check.ts` wiring it
together. New devDependencies: `exceljs`, `jszip`, `tsx`, `@types/node`. New npm scripts:
`ingest:annex-vi` (regenerates the dataset) and `ingest:annex-vi:smoke` (opt-in sanity check
against the real xlsx, kept out of `npm test`).

Output: `src/data/clp-reference/generated/annex-vi-data.json` (the real `{provenance,
dataset}`, committed) + `generated/annex-vi.ts` (a thin typed wrapper re-exporting it as
`ClpReferenceEntry[]` — the dataset is JSON rather than a `.ts` array literal because
TypeScript's checker fails with "union type too complex to represent" on a literal this
large checked directly against `ClpReferenceEntry[]`). Barrel-exported from
`src/data/clp-reference/index.ts` alongside the fixture; `dataset.ts` and the engine's
`lookup` seam are otherwise untouched.

Scope is targeted, not full-fidelity: only the 3 v1 hazard families (acute toxicity oral,
skin/eye corrosion, CMR) are extracted; physical hazards, aquatic toxicity, M-factors, STOT,
sensitization, and non-oral acute-tox routes are recognized and discarded, not modeled. Of
4,441 real Annex VI rows, 3,740 entries were emitted (most of the sheet turned out to be
v1-relevant after all — acute toxicity/skin-eye/CMR are common hazard classes, unlike the
originally-assumed "most rows contribute nothing"). Only 4 rows (0.09%) ended up as
unexplained rejects after iterating the parser against the real export's reject report
twice — see `generated/annex-vi.rejects.json`; each remaining reject is a genuine one-off
notation anomaly (e.g. two H-codes on a single hazard-class line), not a systematic gap.

One real-data discovery worth noting for future ingestion work: column L's SCL cell is not
merely a modifier of what columns G/H declare — Annex VI's convention is that G/H states a
substance's headline classification (e.g. Skin Corr. 1B), while the SCL cell separately
spells out lower-severity bridging tiers (e.g. Skin Irrit. 2 at a lower concentration band)
that never get their own G/H line at all. The parser treats L as its own classification
source, unioned with G/H, rather than requiring every SCL to match a pre-declared G/H line —
an earlier, stricter version of the parser was silently discarding this real bridging data
for ~85 rows before this was caught by reviewing the reject report.

Verified end-to-end: an ad hoc exact-match lookup (throwaway, not committed — explicitly not
Milestone 4's real matcher) fed `classifyFormulation` the real generated dataset against a
mock formulation. It ran without error, and the resolved acetic acid Skin Irrit. 2 SCL
(10%) independently matches the real-world correction already noted below under "Milestone 2
follow-ups" for `acidPhAdjuster`.

The full dataset now exists for Milestone 4's matcher to be built and evaluated against —
previously that work was blocked on nothing beyond the mock formulations being available to
test against.

### 3. EU sale eligibility (the OK/not-OK verdict) — done

The EU sale eligibility feature — adds the final eligibility gate that was the actual point
of the application but had no implementation yet, see the "What 'eligible' means" decision
above. Legally and mechanically distinct from Milestone 2's CLP/GHS labeling feature, not
derived from it: a substance-identity ban (Reg. (EU) 2023/574) vs. concentration-weighted
mixture-classification math. Sits alongside the 3 CLP hazard-class verdicts as an
independent output.

Delivered: `src/engine/eligibility/co-formulant-eligibility.ts` (`classifyCoFormulantEligibility` —
Reg. (EU) 2023/574 Annex points 1-3, CMR 1A/1B substance-identity ban, unconditional on
concentration); `FormulationVerdict.eligible` + `.coFormulantEligibility` in
`src/engine/index.ts`, wired into `classifyFormulation`. 6 new unit tests plus updated
end-to-end assertions in `formulation.test.ts` against all 4 real mock formulations —
`agriguard480ec` and `fieldclearGranular` come back ineligible (both carry formaldehyde,
real Carc. 1B; `fieldclearGranular` also carries boric acid, real Repro. 1B), even though
in `agriguard480ec`'s case the formaldehyde concentration is well below any mixture-
classification threshold on its own path (see Milestone 2's cross-formulant-summation
CMR test) — the two mechanisms disagree on purpose, per the decision above.

Known follow-ups, both tracked under "Still open" above: points 4-10 of the Annex are
deferred (need reference data this project doesn't ingest yet); and the 1107/2009 Annex III
unintentional-impurity concentration exemption (0.1% w/w default, or the substance's own
CLP SCL) is not yet implemented — the current code bans on any nonzero declared
concentration, stricter than the real rule.

### 4. Substance matcher + ambiguity detection

CAS-number match, falling back to name/synonym match. Flags ambiguity with a reason code
(synonym mismatch, grouping entry, missing SCL, relevant note code) so the workflow knows
when to branch to the LLM+RAG path.

### 5. PDF ingestion + RAG store

Chunk and embed the real ECHA guidance PDFs (source set confirmed here, see Decisions)
into the local/embedded vector store.

### 6. Ambiguity-resolution agent step + citation schema

The one genuine LLM judgment point: reads retrieved PDF text, returns a Zod-enforced
structured citation (chunk ID, table row, or PDF clause) — never free text.

### 7. Workflow orchestration end-to-end + observability

Wire the full DAG: decompose → match → branch(clean/ambiguous) → aggregate → classify →
format. Enable Mastra's OpenTelemetry export.

### 8. Eval suite in CI

Mastra evals/scorers: schema validity, citation groundedness, adversarial-case handling.
Extend with token-usage/cost logging (clean-match path vs. ambiguous-fallback path) and
guardrail/adversarial fixtures (malformed PDF chunk, contradictory retrieved text,
ungrounded-citation attempts).

### 9. Minimal API + frontend

Thin HTTP API wrapping the workflow, deployed to a free-tier PaaS (Render/Fly.io/Railway).
Minimal frontend: pick a mock formulation, view the JSON verdict rendered readably. Skip
deploy-automation/CI-CD for the deployment itself and skip a fully designed UI.

### 10. Polish

Lint/CI cleanup. README/ARCHITECTURE final pass, trace/span screenshot, cost comparison
numbers.

## Status

Milestones 1, 2, 2.5, and 3 done. Milestone 2's reference dataset was a fixture, not real
ingested data (see the correction above); Milestone 2.5 supplied the real one
(`src/data/clp-reference/generated/annex-vi.ts`, 3,740 entries from ATP23), ingested from
the vendored Excel export via `src/data/clp-reference/ingestion/`. Milestone 3 added the
EU sale eligibility verdict (the OK/not-OK gate) that was missing until now — see "What
'eligible' means" under Decisions — as its own feature, distinct from Milestone 2's CLP/GHS
labeling. Two follow-ups remain open on Milestone 3: points 4-10 of the Annex, and the
1107/2009 Annex III concentration-exemption threshold (see "Still open" above). Milestone 4
(substance matcher) is next — it can now be built and evaluated against the real dataset's
breadth, not just the 14-row fixture.
