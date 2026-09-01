# Ciatta Final Semantic Refactor Specification — v1.0

**Status:** Awaiting approval — no code changed
**Governing documents:** Ciatta Expert Council v0.2; Ciatta Intelligence & Experience Model v0.1
**Supersedes:** the informal "rename Understanding" plan from the earlier repository audit

---

## 0. Locked decisions (per explicit direction)

1. **Discovery is not a persistent intelligence object.** Discovery is a *process*: the engine surfaces potentially meaningful information through Relationship/Pattern/Finding generation; the Experience layer decides whether it's worth showing. No standalone `Discovery` table survives this refactor unless a clearly-defined purpose is found that Finding/Ciatta Knowledge/Pattern cannot cover — see §5.5 for the concrete resolution, and Approval Checkpoint item 1.
2. **Relationship vs. Pattern**, for MVP:
   - **Relationship** = an evidence-supported connection between two or more observations/features/contextual factors.
   - **Pattern** = a Relationship or Change that demonstrates sufficient recurrence, temporal consistency, persistence/stability, adequate data, and consideration of plausible alternative explanations.
   - Correlation alone never promotes to Pattern.
   - When evidence supports only a Relationship, it is called a Relationship.
   - When evidence is insufficient for either, Ciatta produces neither and stays silent.

---

## 1. Canonical object definitions

Fifteen objects, each defined against both governing documents. Where a concrete numeric threshold appears, it is a **proposed implementation default**, not a number either spec mandates verbatim — these are flagged again in the Approval Checkpoint.

### 1.1 Observation
| Field | Definition |
|---|---|
| Canonical name | **Observation** |
| Precise definition | A recorded measurement, event, or user-reported input at a defined time or interval. |
| Purpose | Capture what happened, when, and from where — without interpretation. |
| Required inputs | source (apple-health / arc / manual / curiosity), type, value, unit, `recorded_at`, capture-time context metadata |
| Output | A stored Observation row |
| What it is NOT | A conclusion, evidence, or interpretation. Not yet quality-assessed. |
| Evidence requirements | None — Observation is the input to evidence generation, not evidence itself |
| Confidence requirements | None — confidence attaches to what's *derived* from Observations |
| Safety requirements | None directly |
| Persisted | Yes — `observations` |
| User-facing | Indirectly (the user is a source for manual/curiosity entries; never reads Observations back as such) |
| Downstream consumers | Normalization, Quality assessment, Feature generation |

### 1.2 Feature
| Field | Definition |
|---|---|
| Canonical name | **Feature** |
| Precise definition | A reproducible value calculated from one or more Observations (e.g. nightly sleep minutes, daily HRV average). |
| Purpose | Turn raw Observations into consistent, comparable, well-defined quantities that Baseline/Change/Relationship/Pattern computation can operate on without re-deriving from scratch. |
| Required inputs | A defined Observation set (domain/type/time-window), a versioned calculation method |
| Output | A Feature value + calculation version + the `observation_ids` it was derived from |
| What it is NOT | Clinical meaning by itself. Not evidence. Not a finding. |
| Evidence requirements | A defined, reproducible calculation over valid Observations — nothing more |
| Confidence requirements | Tracks sample size/quality inputs for downstream use; does not itself assert a claim |
| Safety requirements | None directly |
| Persisted | Yes (new) — required for traceability/versioning under the Evidence Ledger |
| User-facing | No — internal computation object |
| Downstream consumers | Baseline, Change, Relationship, Pattern |

### 1.3 Context
| Field | Definition |
|---|---|
| Canonical name | **Context** |
| Precise definition | Relevant circumstances surrounding health data — cycle phase, life stage, medication/contraception, sleep, exercise, illness, symptoms, clinical events, schedule disruption. |
| Purpose | Supply the circumstantial backdrop that *Contextualization* (a reasoning operation, not an object — see §2.3) uses to adjust interpretation, relevance, comparison, or presentation. |
| Required inputs | Profile fields (life_stage, medications, etc.), cycle-phase computation, user-reported context Observations |
| Output | A structured Context record attachable to a time window or domain |
| What it is NOT | An explanation or causal claim |
| Evidence requirements | Must be sourced from real Observations/profile data, never inferred |
| Confidence requirements | Varies by source certainty (self-reported cycle phase vs. clinically confirmed); tracked, not ignored |
| Safety requirements | None directly, though incorrect Context can propagate error downstream — quality discipline matters |
| Persisted | Yes (new) — today only exists as ad hoc jsonb fields and onboarding-derived data with no formal shape |
| User-facing | Indirectly — feeds Explanation/Experience copy ("during your luteal phase"), not its own screen |
| Downstream consumers | Contextualization, Baseline window selection, Relationship/Pattern alternative-explanation checking, Explanation |

### 1.4 Baseline
| Field | Definition |
|---|---|
| Canonical name | **Baseline** |
| Precise definition | An individual's reference representation for a Feature, derived from an appropriate comparison window. |
| Purpose | Give Change something legitimate — personal, not population-level — to be measured against. |
| Required inputs | A Feature time series, a defined reference window, minimum sample/quality thresholds, explicit missingness handling |
| Output | A Baseline value/distribution + window + calculation version + eligibility flag |
| What it is NOT | A universal normal range — always personal, never population-derived |
| Evidence requirements | Minimum sample size within the window (today's scattered `BASELINE_MIN_NIGHTS`/`BASELINE_MIN_DAYS` constants, consolidated); adequate quality |
| Confidence requirements | Scales with sample size/window completeness (same shape as today's `confidence = min(1, n/cap)`), tracked on the Baseline itself |
| Safety requirements | An ineligible/thin Baseline must block downstream Change computation, not silently support it |
| Persisted | Yes (new) — versioned and reproducible |
| User-facing | Sometimes, as "your usual" language — never raw numbers |
| Downstream consumers | Change, Relationship, Pattern, Explanation |

### 1.5 Change
| Field | Definition |
|---|---|
| Canonical name | **Change** |
| Precise definition | Difference from an appropriate personal reference (Baseline), prior state, or defined comparison window. |
| Purpose | Distinguish "numerically different" from "meaningfully different" — only the latter is a Finding candidate. |
| Required inputs | Current Feature value(s), the relevant Baseline, a significance rule (not an arbitrary per-file constant) |
| Output | A Change record — magnitude, direction, whether it clears the meaningful-change bar, and why |
| What it is NOT | Automatically meaningful — a numeric difference alone never justifies surfacing |
| Evidence requirements | Eligible underlying Baseline; deviation clears a defined, reproducible significance threshold |
| Confidence requirements | Inherits/combines Baseline confidence with deviation magnitude |
| Safety requirements | Must carry its own confidence; cannot be surfaced as concerning without it |
| Persisted | Yes (new/renamed) — closest replacement for `understanding_history`, rebuilt to carry the measured-vs-meaningful distinction it currently lacks |
| User-facing | Yes — directly answers "What changed?" |
| Downstream consumers | Relationship, Pattern, Finding, Explanation, Experience |

### 1.6 Relationship
| Field | Definition |
|---|---|
| Canonical name | **Relationship** |
| Precise definition | An evidence-supported connection between two or more observations/features/contextual factors. |
| Purpose | Answer "what appears connected?" without claiming causation. |
| Required inputs | Two or more Features/Changes/Context factors with sufficient co-occurring data; a defined statistical test (the two-independent-signals comparison already implemented) |
| Output | A Relationship record — factors, direction/strength of association, sample size, confidence |
| What it is NOT | Causation. Not automatically a Pattern — recurrence is not required to be a Relationship, only association support. |
| Evidence requirements | Minimum paired sample size per group; a defined confirms/does-not-confirm test — never "moved together once" |
| Confidence requirements | Scales with sample size; never reported below its evidence threshold |
| Safety requirements | Never worded causally; downstream Guidance must never imply "X causes Y" from a Relationship alone |
| Persisted | Yes — `relationships`, largely preserved |
| User-facing | Yes, when it clears gates — "What connects?" |
| Downstream consumers | Pattern evaluation (candidate input, not the same object), Finding, Explanation |

### 1.7 Pattern
| Field | Definition |
|---|---|
| Canonical name | **Pattern** |
| Precise definition | A Relationship or Change that demonstrates sufficient recurrence, temporal consistency, persistence/stability, adequate data, and consideration of plausible alternative explanations. |
| Purpose | Answer "does this structure repeat or persist enough to be meaningful?" — strictly higher bar than Relationship. |
| Required inputs | A qualifying Relationship or Change, evaluated across multiple independent windows/instances; an explicit alternative-explanations check; explicit missingness/quality accounting |
| Output | A Pattern record — underlying Relationship/Change, recurrence count, stability measure, confidence, alternative explanations considered and ruled out |
| What it is NOT | A single coincidence. **Never promoted from correlation alone.** |
| Evidence requirements (proposed concrete bar) | Recurrence across **≥3 independent windows/instances**; temporal consistency across sampled windows; **stability under a sensitivity check** (holds if the single strongest contributing window is removed); **at least one plausible alternative explanation actively checked and not better supported** |
| Confidence requirements | Never exceeds the confidence of its weakest qualifying input (generalizes today's `weakerStrength()` logic) |
| Safety requirements | Same as Relationship, plus: recurrence increases confidence, never causal-claim strength |
| Persisted | Yes (new) — today's `cross_domain_understandings` tests none of these criteria, so this is genuinely new, not a rename |
| User-facing | Yes, when it clears gates — "What has happened over time?" |
| Downstream consumers | Finding, Ciatta Knowledge (strong retention candidates), Explanation, Guidance |

### 1.8 Evidence
| Field | Definition |
|---|---|
| Canonical name | **Evidence** |
| Precise definition | Information judged sufficiently valid and relevant to support a specific statement — sits *after* Relationship/Pattern in the pipeline, immediately supporting a candidate Finding. |
| Purpose | The bridge between "we computed something" and "we're willing to state something" — where quality, provenance, and sufficiency are checked together before a claim may exist. |
| Required inputs | One or more qualifying Change/Relationship/Pattern records; their full provenance chain; a quality/sufficiency check |
| Output | An Evidence record bundling everything a Finding will cite, plus a pass/fail sufficiency verdict |
| What it is NOT | Raw data — already judged, not a dump |
| Evidence requirements | Completeness of provenance chain; no unresolved quality flags; no unaddressed contradictory evidence |
| Confidence requirements | Can only be as strong as its weakest supporting Change/Relationship/Pattern |
| Safety requirements | Must record contradictory evidence/alternative explanations even when they don't block the Finding — required for the Ledger |
| Persisted | Yes (new/restructured) — **repositions today's `evidence` table's name**; today's table is Feature-shaped and must be relabeled, while a new table fills this role |
| User-facing | No — what a Finding cites, surfaced via Explanation |
| Downstream consumers | Finding, Evidence Ledger |

### 1.9 Finding
| Field | Definition |
|---|---|
| Canonical name | **Finding** |
| Precise definition | A specific supported statement produced from a defined Evidence set. May be temporary, contextual, or limited in scope. |
| Purpose | The first point in the pipeline where Ciatta is willing to make a claim about the individual. |
| Required inputs | A passing Evidence record |
| Output | Statement text (enumerated templates, never free-generated), the Evidence it cites, a scope/expiry if temporary |
| What it is NOT | Automatically a diagnosis or prediction. Not automatically retained — most Findings should **not** become Ciatta Knowledge. |
| Evidence requirements | A passing Evidence record — no Finding without one |
| Confidence requirements | Explicit gate, must clear a defined threshold to be produced at all (separate from being surfaced) |
| Safety requirements | Independent gate from Confidence — a well-evidenced Finding can still be judged unsafe to surface as worded |
| Persisted | Yes (new) — replaces the narrative field embedded directly in `understandings` today |
| User-facing | Sometimes — only if it also clears Experience selection; an internal Finding can exist and never surface |
| Downstream consumers | Ciatta Knowledge (retention candidate), Explanation, Experience, Guidance |

### 1.10 Ciatta Knowledge
| Field | Definition |
|---|---|
| Canonical name | **Ciatta Knowledge** |
| Precise definition | Information established sufficiently for its intended purpose and permitted to be retained and reused within the individual's longitudinal model. |
| Purpose | The standing, cross-session memory of what Ciatta has established — distinct from any single Finding. |
| Required inputs | One or more Findings clearing a retention bar stricter than Finding-production (see §2.1 for the concrete rule) |
| Output | A versioned, revisable Ciatta Knowledge record, traceable to the Finding(s)/Evidence that established it, explicit about its limits |
| What it is NOT | Everything Ciatta can calculate — retention is selective, per the governing principle "Calculate broadly. Validate rigorously. **Retain selectively.**" |
| Evidence requirements | Traces to ≥1 qualifying Finding; stable over time, not retained off a single run |
| Confidence requirements | Retention bar stricter than Finding production |
| Safety requirements | Must be revisable/decayable — if supporting evidence weakens or contradicts, Knowledge updates or withdraws, never stays stale (preserves today's `decayStaleUnderstandings()` mechanism in spirit) |
| Persisted | Yes — closest analog to today's `understandings`, but scoped to only what earned retention |
| User-facing | Yes — "What does Ciatta actually know?" |
| Downstream consumers | Future Baseline/Context (Knowledge informs future Contextualization), Explanation, Experience, Guidance |

### 1.11 Confidence
| Field | Definition |
|---|---|
| Canonical name | **Confidence** |
| Precise definition | A bounded representation of evidential support for a Finding or Knowledge item. |
| Purpose | Answer "how sure is Ciatta" strictly as a function of evidence quality/quantity. |
| Required inputs | Sample size, data quality, temporal stability, alternative-explanation checks — composed from upstream Feature/Baseline/Change/Relationship/Pattern confidence |
| Output | A bounded tier — reuse today's four-tier ladder (emerging / moderate / strong / very-strong), which already behaves correctly |
| What it is NOT | Probability of disease |
| Evidence/Confidence/Safety requirements | N/A — self-referential; independent of Safety by design |
| Persisted | Yes — field on Evidence/Finding/Ciatta Knowledge/Relationship/Pattern records |
| User-facing | Yes, as a label ("still learning," "confident," ...) — already implemented well, preserve as-is |
| Downstream consumers | Evidence gate, Finding production, Experience selection |

### 1.12 Safety
| Field | Definition |
|---|---|
| Canonical name | **Safety** |
| Precise definition | Assessment of foreseeable harm if an output is wrong or misunderstood. |
| Purpose | A second, **independent** gate alongside Confidence — a well-evidenced Finding can still be unsafe to surface as worded. |
| Required inputs | The Finding's domain/subject (cycle and mood already carry different routing than sleep/steps via `DOMAIN_CARE_TYPE`), its proposed wording, any attached Guidance |
| Output | A bounded Safety tier + required mitigations (softer wording, added context, suppression, care-connection routing) |
| What it is NOT | Scientific confidence — high confidence never implies low risk, nor the reverse; the two are orthogonal |
| Evidence/Confidence requirements | N/A — independent dimension, never derived from Confidence |
| Persisted | Yes — new field alongside Confidence on Finding/Ciatta Knowledge/Guidance; **does not exist today**, `strength` currently does double duty for both jobs |
| User-facing | Indirectly — shapes wording and whether Guidance/care-routing appears, never shown as a raw score |
| Downstream consumers | Experience selection, Guidance production |

### 1.13 Explanation
| Field | Definition |
|---|---|
| Canonical name | **Explanation** |
| Precise definition | A bounded account of supporting evidence, reasoning, uncertainty, and limitations. |
| Purpose | Answer, for any surfaced Finding/Knowledge/Pattern, the 8-point model: what Ciatta noticed; what evidence supports it; what changed relative to reference; what context matters; what relationship/pattern is supported; how confident; what Ciatta doesn't know; what the finding doesn't mean. |
| Required inputs | The Finding/Knowledge/Pattern being explained, its full Evidence Ledger entry |
| Output | Structured explanation content answering "why did Ciatta tell me this," traceable end to end |
| What it is NOT | An invented causal story — grounded only in the Ledger, never generated from general knowledge |
| Evidence requirements | Fully traceable to an Evidence Ledger entry — no explanation without one |
| Confidence requirements | Must state the Confidence tier explicitly |
| Safety requirements | Must state limitations/what-it-doesn't-mean explicitly — itself a safety mechanism, not color |
| Persisted | Generated on read from the Ledger + Finding; no independent storage needed |
| User-facing | Yes — today's `guidance`/`narrative` text answers 3 of these 8 questions; must expand to all 8 |
| Downstream consumers | Experience |

### 1.14 Experience
| Field | Definition |
|---|---|
| Canonical name | **Experience** |
| Precise definition | How validated Ciatta Knowledge/Findings and useful Context are communicated to the user. |
| Purpose | The selection and presentation layer — decides what reaches the user, not just what was computed. "A valid finding is not automatically a product experience." |
| Required inputs | Candidate Findings/Ciatta Knowledge/Patterns/Relationships that already cleared Confidence + Safety, plus selection criteria: evidence strength, individual relevance, novelty, longitudinal significance, user value, safety, explainability, cognitive burden, interruption cost, claims boundaries |
| Output | What actually renders — screens, cards, notifications, timeline entries |
| What it is NOT | A dashboard of every metric — selection is deliberate, not exhaustive |
| Evidence/Confidence/Safety requirements | Inherits from what it presents; adds no new evidence, only selects and frames; independently evaluates interruption cost/cognitive burden |
| Persisted | No — a rendering/selection layer (though *what was shown, when* is worth logging for research per Model v0.1 §19) |
| User-facing | Yes — entirely; this is the user-facing layer |
| Downstream consumers | None (terminal) — the user |

### 1.15 Guidance
| Field | Definition |
|---|---|
| Canonical name | **Guidance** |
| Precise definition | Separately justified, bounded action-oriented communication. |
| Purpose | Answer "what should I do?" — only when *separately* justified, never the default output of a Finding. |
| Required inputs | A Finding/Ciatta Knowledge item clearing Confidence + Safety at a stricter, "actionable" tier (preserve today's `ACTIONABLE = strong/very-strong` gate) |
| Output | Bounded, enumerated action language + care-routing recommendation, exactly as `careGuidance.ts` produces today |
| What it is NOT | The default outcome of every Finding — most Findings produce no Guidance |
| Evidence requirements | Same Evidence Ledger entry as the Finding/Knowledge it's attached to |
| Confidence requirements | Stricter tier than a bare Finding requires |
| Safety requirements | Never diagnoses, prescribes, or determines treatment (preserve exactly); routes to care category, never invents clinical content |
| Persisted | Yes — fields on Finding/Ciatta Knowledge, as today |
| User-facing | Yes, when present |
| Downstream consumers | Experience, Care Connection/Provider Search |

---

## 2. Cross-cutting distinctions

### 2.1 Finding vs. Ciatta Knowledge
A **Finding** is a per-evaluation supported statement — it may be temporary, contextual, or narrowly scoped, and most Findings are never retained. **Ciatta Knowledge** is the subset that earns durable retention in the user's longitudinal model.

**Proposed promotion rule** (fills a qualitative spec requirement with a concrete one — needs approval): a Finding is promoted to Ciatta Knowledge when (a) it has been independently reproduced across **≥2 engine runs/time windows** with consistent conclusions, (b) its Confidence tier is `strong` or `very-strong`, and (c) it has not been contradicted by more recent evidence. This mirrors today's `upsertUnderstanding()` + `decayStaleUnderstandings()` mechanism almost exactly — that mechanism is already doing the Finding→Knowledge promotion/decay job, just without the intermediate Finding stage or the name.

### 2.2 Relationship vs. Pattern
Restated from §0: Relationship = evidence-supported connection; Pattern = a Relationship/Change that additionally demonstrates recurrence, temporal consistency, stability, adequate data, and a checked alternative explanation. See §1.7 for the proposed concrete evidence bar. Correlation alone is never sufficient for Pattern.

### 2.3 Context vs. Contextualization
**Context** is an object — the circumstantial data itself (cycle phase, medication, sleep, illness, ...). **Contextualization** is a reasoning *operation* — it takes Context and uses it to change the interpretation, relevance, comparison, or presentation of a Feature/Baseline/Change/Relationship. Context is stored; Contextualization is applied. Contextualization must never invent meaning from Context that the Context data doesn't itself support.

### 2.4 Confidence vs. Safety
Two independent axes, never derived from one another. **Confidence** measures evidential support strength. **Safety** measures foreseeable harm if the output is wrong or misunderstood. A Finding must pass both gates independently before it can be produced/surfaced — high Confidence never substitutes for Safety clearance, and vice versa.

### 2.5 Evidence gate behavior (the full chain, each a hard stop)
1. **Feature** requires valid, sufficiently-recent Observations → else no Feature.
2. **Baseline** requires minimum sample size within an appropriate window → else insufficient-for-baseline, no Change computed.
3. **Change** requires an eligible Baseline + deviation clearing a defined significance threshold → else no meaningful Change.
4. **Relationship** requires minimum paired sample size + a passing confirms/does-not-confirm test → else no Relationship.
5. **Pattern** requires a qualifying Relationship/Change + recurrence/stability/alternative-explanation criteria → else it remains a Relationship (or Change), never inflated.
6. **Evidence** requires a full, unbroken provenance chain + no unresolved quality flags → else no Evidence, no Finding.
7. **Finding** requires passing Evidence + the Confidence gate → else no Finding ("Evidence insufficient → No Finding → Silence").
8. **Ciatta Knowledge** requires a Finding clearing the stricter retention rule (§2.1) → else the Finding exists but is not retained.
9. **Experience** requires Confidence + Safety + the selection criteria (§1.14) → else no surfacing.
10. **Guidance** requires the stricter actionable tier on top of everything above → else no guidance.

Each stage's failure is a legitimate terminal outcome — never backfilled with a weaker guess.

### 2.6 Silence behavior
Four documented forms, mapped to where each occurs in the gate chain above:
- **No finding** — gate 7 fails (Evidence insufficient).
- **No surfacing** — a Finding/Knowledge exists (gates 1–8 passed) but gate 9 (Experience selection) doesn't clear it (low novelty, high interruption cost, thin claims boundary).
- **No notification** — a valid, surfaced Finding exists but doesn't justify interrupting the user (visible if the user looks, doesn't push).
- **No guidance** — Finding/Knowledge is shown, but gate 10 fails.

### 2.7 How Experience selects what reaches the user
Per Model v0.1 §17: evidence strength, individual relevance, novelty, longitudinal significance, user value, safety, explainability, cognitive burden, interruption cost, claims boundaries — goal is "maximum useful signal with minimum unsupported inference and noise." Concretely: **Experience never reprocesses or reinterprets evidence** — it only ranks/filters/paces what already passed the Confidence + Safety gates upstream. This preserves the "no second inference layer" discipline already present in `careGuidance.ts`.

### 2.8 Handling insufficient, conflicting, missing, or low-quality evidence
- **Insufficient** → the relevant gate in §2.5 fails, producing silence at that stage — never a lower-confidence guess.
- **Conflicting** → recorded explicitly (contradictory evidence is a required Evidence Ledger field); a Finding whose Evidence has material unresolved contradiction fails the Evidence gate; contradiction reduces Confidence, it is never silently averaged away.
- **Missing** → Quality assessment (upstream of Feature) flags missingness explicitly; a Feature/Baseline over a window with excessive missingness is marked ineligible rather than silently gap-filled.
- **Low-quality** → Quality is a gate before Feature generation; low-quality Observations may be excluded or down-weighted, never treated as equal to high-quality ones.

---

## 3. Mapping to the existing implementation

### 3.1 Preserved as-is
- `observations` table — matches the Observation definition well.
- `relationships` table — matches Relationship; only what's allowed to read *from* it as Pattern-eligible changes.
- RLS model and the narrow client write surface (Observations, Discovery-naming, Curiosity-answers only; everything else service-role-computed).
- `deriveGuidance()`'s enumerated-sentence discipline, `NO_GUIDANCE` default, actionable-tier gating — reused as Guidance's implementation; only the header glossary comment is rewritten.
- `decayStaleUnderstandings()` — reused in spirit as Ciatta Knowledge's decay/revision mechanism.
- Core statistical primitives: `median()`, sample-size confidence scaling (`min(1, n/cap)`), two-independent-signals relationship testing — reusable as Baseline/Change/Relationship's computational core, consolidated into shared, versioned functions instead of duplicated per analysis file.
- Curiosity Engine / `curiosities` table — **out of scope for this resolution**; not part of the 15-object vocabulary and not addressed by your directive. Left untouched, flagged as a separate future decision (see Approval Checkpoint item 7).

### 3.2 Renamed (mechanical, no structural change)
- `evidence_type` (health_data / user_reported / clinical_record / derived) → carries forward unchanged as a provenance tag on the new Evidence object.
- `domain_type`, `strength_type` enums → reused directly as the Confidence tier ladder; no change needed.
- `TamponWearUnderstanding` → `TamponWearStatus` (unrelated subsystem — tampon-wear safety timer, not part of the intelligence pipeline; simple, independent rename).

### 3.3 Must be structurally refactored
- `evidence` table → repurposed as **`features`** (its current shape — `observation_ids[]`, `weight`, `confidence`, per-domain aggregate — is a Feature, not the new Evidence).
- `understandings` table → **splits into `findings` + `ciatta_knowledge`** (two tables, not one rename).
- `understanding_history` table → becomes **`change_events`**, rebuilt to carry the measured-vs-meaningful distinction it currently lacks.
- `cross_domain_understandings` table + `crossDomainSynthesis.ts` → becomes cross-domain **`relationships`** rows by default; a new, separate Pattern-evaluation step (real recurrence/stability criteria) decides if/when a cross-domain Relationship additionally qualifies as a Pattern.
- `contextualUnderstanding.ts` → renamed/repositioned as a **self-reported Finding path** (its actual job — turning onboarding-reported concerns into a Finding) — explicitly **not** relabeled "Context," which is reserved for circumstantial data per the spec.
- `careGuidance.ts` → keep the mechanism; rewrite the glossary comment; add the independent Safety dimension; expand narrative generation toward the 8-point Explanation model.
- `discoveries` table + its per-domain promotion functions (e.g. `buildSleepRatingDiscovery`) → collapsed into Pattern evaluation + an Experience-layer naming annotation (§3.5).

### 3.4 Must be newly created
- `features` table (formal version — versioning/reproducibility metadata beyond what the repurposed old `evidence` table carries).
- `baselines` table.
- `patterns` table (real recurrence/stability/alternative-explanation criteria — nothing like this exists today).
- `evidence` table (new, later-pipeline sense — provenance-complete, cites Change/Relationship/Pattern, carries a sufficiency verdict).
- `evidence_ledger` table (or ledger fields folded onto `evidence`/`findings` — implementation choice, Approval Checkpoint item 8).
- Safety field(s) on Finding/Knowledge/Guidance records (does not exist today; `strength` currently does both jobs).
- Explanation generation answering the full 8-point model (today answers 3 of 8).
- Experience-selection logic as an explicit, separate step (today, everything clearing the Guidance gate is shown outright; there's no distinct novelty/interruption-cost/claims-boundary filter).

### 3.5 Becomes obsolete
- `understandings`, `understanding_history`, `cross_domain_understandings`, `discoveries` tables, in their current shape — retired, not renamed.
- `UnderstandingSheet.tsx` as a single "one object" detail view — becomes multiple, precise views (Finding detail, Ciatta Knowledge detail, or one merged view that clearly separates the two).
- Every "Understanding" identifier catalogued in the prior repository audit (types, functions, table references, UI copy) — superseded by this spec's names, never blind-replaced.
- **Discovery resolution, concretely:** the "named story chapter" UX becomes an Experience-layer behavior. When a Pattern or a retained Ciatta Knowledge item clears a "worth naming" bar within Experience's selection criteria, the UI offers naming — stored as a lightweight annotation (`user_label`, `named_at`) directly on the Pattern/Ciatta Knowledge record, not a separate object with its own `pending/named/dismissed` lifecycle. No purpose was found in the current implementation that this doesn't cover — flagged for confirmation at Approval Checkpoint item 1.

### 3.6 Database migration requirements
- All existing migrations remain immutable; every change lands as a new forward migration.
- Migrations are staged (§4) so old and new tables coexist during transition — no single big-bang schema cutover.
- `discoveries.understanding_ids`, `cross_domain_understandings.contributing_understanding_ids` retire with their parent tables.
- The ad hoc jsonb key `context.understandingId` (used for provider-feedback correlation) needs a backfill or dual-read shim once its target object is renamed — real production-data risk, unchanged from the prior audit.

### 3.7 API/client changes
- `queries.ts` gains `fetchFindings`, `fetchCiattaKnowledge`, `fetchRelationships` (existing), `fetchPatterns` — replacing `fetchUnderstandings`, `fetchUnderstandingHistory`, `fetchCrossDomainUnderstandings`.
- `types.ts`'s `Understanding` interface splits into `Finding` and `CiattaKnowledge` client-side types.
- `careConnection.ts`, `priority.ts`, `voice.ts`, `visitPrep.ts`, `providerSearch.ts` all re-target the new objects — same conclusion as the prior audit, now against the richer object set.
- `account.ts`'s GDPR `EXPORT_TABLES` list updates to the new table names.

### 3.8 UI changes
- Every "Understanding" copy surface catalogued previously (`UnderstandingSheet.tsx`, `CoreScreen.tsx`, `TodayScreen.tsx`, onboarding flow, `DataPrivacySheet.tsx`, `TodayInfoSheet.tsx`, `BodySilhouette.tsx` a11y label) is rewritten idiomatically against the new vocabulary — not mechanically substituted.
- The onboarding step literally keyed `'understanding'` is renamed and its copy rewritten.
- New UI surface needed: an Explanation view answering the 8-point model (today's sheet answers 3 of 8); a way to show "what Ciatta doesn't know" (currently no such surface exists at all).

### 3.9 Edge Function / cron changes
- `understanding-engine` → renamed function, restructured internally into stages matching §2.5's gate chain.
- `provider-search` updated in the same deploy window (it reads `understandings`/`cross_domain_understandings` directly today — must move to `findings`/`ciatta_knowledge`/`patterns`).
- `delete-account` updated to delete from the new table set.
- The two `cron.schedule()` jobs and the `understanding_engine_key` vault secret renamed in a follow-up migration, sequenced **after** the redeployed function is confirmed live (same silent-failure risk as the prior audit if sequenced wrong).

### 3.10 Test requirements
- Reproducibility tests for Feature/Baseline (same inputs → same outputs, versioned).
- Pattern-criteria tests, including **required negative tests**: "two correlated variables, insufficient recurrence → must NOT produce a Pattern" (directly verifies §0's instruction).
- Evidence Ledger completeness tests — every Finding must carry every required field.
- Silence-path tests for all four forms in §2.6.
- Confidence/Safety independence tests — a case with high Confidence + low Safety, and the reverse, must both gate correctly.
- Regression tests preserving current Guidance output byte-for-byte where inputs are unchanged.

---

## 4. Staged implementation plan

Strategy: **dual-write, then cutover.** New tables are introduced and populated alongside the existing ones for several stages before any client/UI switch — this is how "preserve existing working behavior wherever compatible" is honored concretely, not just as a principle.

| Stage | Work | User-facing change |
|---|---|---|
| 0 | This document — approval checkpoint | None |
| 1 | Foundation migration: `features`, `baselines`, `change_events`; consolidate duplicated `median()`/threshold logic into shared, versioned helpers; existing domain analyzers dual-write into these tables | None |
| 2 | `patterns` table + real recurrence/stability/alternative-explanation evaluator; cross-domain synthesis rewritten to produce cross-domain Relationships by default, Pattern only when criteria met | None |
| 3 | New `evidence` table (ledger-complete) + `findings` table; `upsertUnderstanding()` logic repurposed into `produceFinding()` (Evidence gate → Confidence gate); dual-write alongside `understandings`, which still drives production UI | None |
| 4 | `ciatta_knowledge` table; promotion/decay logic ported from `upsertUnderstanding`/`decayStaleUnderstandings`, gated on §2.1's retention rule; dual-write continues | None |
| 5 | Safety field/logic added alongside Confidence; `careGuidance.ts` output expanded toward the 8-point Explanation model; glossary comment rewritten | None |
| 6 | Explicit Experience-selection layer (novelty/interruption-cost/claims-boundary filtering); Discovery-naming becomes a Pattern/Knowledge annotation; `discoveries` stops receiving new writes | None |
| 7 | Cutover: client/API switches reads to the new tables; UI rebuilt around Finding/Ciatta Knowledge as two objects; copy rewritten per vocabulary; `provider-search` updated in the same window | **Yes — this is the visible cutover** |
| 8 | Coordinated Edge Function redeploy + cron/vault-secret migration, sequenced after Stage 7 is confirmed live | None (if sequenced correctly) |
| 9 | Retirement migration: drop `understandings`, `understanding_history`, `cross_domain_understandings`, `discoveries`, old `evidence` shape — only after a confirmed bake-in period | None |
| 10 | Final repo-wide audit: zero "Understanding" residue; full Evidence Ledger coverage for every user-facing Finding | None |

---

## 5. Approval checkpoint

Decisions that need explicit sign-off before any code is written:

1. **Discovery resolution** (§3.5): naming becomes an annotation on Pattern/Ciatta Knowledge records, no persisted `Discovery` object. Confirm no clearly-defined purpose is being missed — e.g., does product need a `dismissed` workflow independent of Knowledge's own lifecycle?
2. **Pattern's concrete evidence bar** (§1.7): ≥3 independent recurring windows, a stability-under-removal check, a mandatory alternative-explanation check. These are proposed defaults filling a qualitative spec requirement, not numbers either governing document mandates verbatim.
3. **Finding → Ciatta Knowledge promotion rule** (§2.1): ≥2 reproduced runs + strong/very-strong confidence + no recent contradiction. Same status as item 2 — a proposed concrete rule, needs sign-off.
4. **Table split**: `understandings` → `findings` + `ciatta_knowledge` as two tables, not a rename. Confirm this is the intended data-model shape.
5. **`evidence` table repurposing**: today's `evidence` table becomes `features`; a new table takes the name `evidence`. Confirmed safe against current dependencies — `provider-search` does not read `evidence` directly today.
6. **Dual-write migration strategy** (§4, Stages 1–6): slower, but preserves working production behavior throughout, versus a faster single-cutover approach. Confirm dual-write is preferred.
7. **Curiosity Engine / `curiosities` table scoping**: left entirely out of this resolution — not part of the 15-object vocabulary, not addressed by your directive. Confirm this is correct scoping, not an oversight.
8. **Evidence Ledger implementation shape**: a dedicated `evidence_ledger` table versus ledger fields folded directly onto `evidence`/`findings`. Needs a decision before Stage 3.

No repository changes have been made. Implementation begins only after this specification and the plan in §4 are explicitly approved.
