# MWC — CF→Airtable sync rebuild: phased plan & estimate

**Date:** 2026-09-08
**Decision taken:** skip the Zapier stopgap, rebuild the sync as a Netlify Function.
**Companion doc:** `.claude/mwc-combo-row-sync-investigation.md` (findings & evidence)
**Estimate basis — read this before quoting a number.**
An earlier draft of this doc said 34–48h. **That was wrong.** It was a human-developer estimate
mislabelled as Claude Code time. Corrected below.

Claude writes the function, tests, normalization map and repair script in **minutes**, not
hours. What actually consumes time is (a) test-fix cycles, (b) Mikael's review and UI work, and
(c) waiting on other people and on real CF events. The table therefore splits:

- **Session time** — Mikael actively working with Claude Code. This is the number that scales
  with the difficulty of the build.
- **Mikael solo** — Zapier/Netlify/Airtable UI work, testing, coordinating with Bill. Claude
  cannot do these.
- **Calendar** — approval gates and real-world waits. Not billable effort.

---

## Two additional live bugs found in Zap 2 today

These are **separate from** the combo-row collapse and are corrupting data on every
"Job Completed" event right now. They raise the priority of the cutover.

**Bug A — "Job Completed" overwrites a random historical row.**
Zap 1 maps CF's `Customer Customer Id` into Airtable's `Job Number`. So **`Job Number` is a
customer id, not a job id** — confirmed: 524 distinct values, 20 of them appear on multiple
different `Job Date`s (worst: `C16753` on 3 separate dates).
Zap 2 step 3 then does *Find Record → table Jobs → search by `Job Number` → Exact Match →
"return first search result"*. That finds **the customer's first-ever row**, not this visit's
row. The "If record found → Update" path then overwrites it. And because the find sits *inside*
the loop, all N line items overwrite the *same* row in sequence.
**Exposure: 90 customers, 217 rows.**

**Bug B — Update Record writes the raw loop object into two fields.**
Zap 2 step 6 maps `2. Job: amount: 179.00…t_price: 179.00` — the whole serialized loop item —
into **both** `Job Revenue` **and** `Job Type`, instead of `2. Job Amount` / `2. Job Job Type`.

Both disappear in the rebuild: one receiver handles both CF events and upserts on a real key,
so no find-first-and-hope, and no Zapier field mapping at all.

---

## Design constraints locked in

| Constraint | Consequence for the build |
|---|---|
| `Job Number` = CF **customer** id, not a visit id | the upsert key must be `{Customer Id}\|{Job Date}\|{normalized Job Type}\|{line #}` |
| 5 collapsed visits repeat the same service (e.g. Doug & Cheryl Jensen = `GOLD Window Cleaning` ×3) | **line index is mandatory** in the key, or those rows collapse again on upsert |
| `Commission Rate`, `Hourly Rate`, `Number of Techs`, hours, `Calculated Commission` are Airtable lookups/formulas | receiver must **not** write them |
| `Job Type` is a `singleSelect`; PAT cannot create options | normalization must map onto **existing** options; junk-option purge is a human task |
| CF has no API (Zapier-only) | Zapier survives as a **1-task relay**; downgrade, don't cancel — unless CF supports a raw webhook |
| Per-line amounts were never stored on collapsed rows | the 160 rows **cannot** be repaired from Airtable — only by replaying CF events |

**Repair sizing:** 160 collapsed rows = **159 visits** hiding **418 service lines**. The repair
turns 160 rows into ~418 correct ones.

---

## Phases & estimate

| # | Phase | Session time | Mikael solo | Gate / dependency |
|---|---|---|---|---|
| 0 | Discovery close-out & spec | **0.5** | 0.5 (brief Bill) | Bill's Job Type folds; CF webhook answer |
| 1 | Repo scaffolding + deployable skeleton | **0.5–1** | 0.25 (env vars) | — |
| 2 | Core receiver logic | **1.5–3** | — | Phase 0 map |
| 3 | Tests + dry-run vs scratch table | **1–2** | 0.25 (scratch table) | Phase 2 |
| 4 | Zapier rewire to 1-task relay | **0.5** | **1–1.5** (Zap UI) | Phase 3 green |
| 5 | Repair the 160 collapsed rows | **1–2** | 1 (purge options) | Phase 4 live |
| 6 | App-code alignment + multiplier | **1–2** | 0.5 (Bill confirms) | Phase 5 |
| 7 | Cutover watch + handover | **0.5–1** | 0.5–1 (watch a period) | one pay period elapsed |
| | **Totals** | **7–12h** | **4–5h** | |

**Total Noobia effort: ~11–17h.** With contingency (below): **quote up to 20h.**
**Minimum to go live safely (Phases 0–5): ~8–13h combined.**

### Why this is much lower than a human-dev estimate

- The function, its tests, the 87-string normalization map and the repair script are each
  **one-shot writes**, not multi-hour tasks. The investigation that produced this plan —
  reading the codebase, three Airtable probe scripts, two full findings docs — took about
  **40 minutes of session time**. That's the actual observed rate on this project.
- **Most iteration happens locally, not through deploys.** The Airtable logic (normalization,
  employee resolution, keying, upsert) can be driven with `node` against the live base exactly
  as the probe scripts already were. Only the HTTP/auth/Netlify wiring needs deploy cycles, so
  the slow loop applies to maybe 15% of the work.
- The remaining time is genuinely irreducible: Mikael reviewing decisions, clicking through
  Zapier and Netlify, and real CF events firing.

### Calendar is the real constraint, not effort
**2–3 weeks elapsed.** The work is a few sessions; the schedule is set by Bill approving the
naming map, CF support answering the webhook question, needing a **real CF booking and a real
completion** to test end-to-end, and one pay period of monitoring. Phases 1–3 can proceed
against a stubbed map while waiting on Bill.

**Tell the PM the calendar, and bill the effort.** Quoting 2–3 weeks *of effort* would be wrong
by roughly 10×.

---

## What each phase delivers

### Phase 0 — Discovery close-out & spec · 0.5h session
- Draft the **Job Type normalization map**: all 87 observed strings, grouped with proposed
  folds, as a one-page approval sheet for Bill (`BRONZE Window Cleaning:` → `BRONZE Window
  Cleaning`, `blow off roof` → `Roof Blow Off`, the 3 `Commercial WC` spellings → 1, the 3
  `cobwebbing` spellings → 1, ~10 `Xmas *` variants, etc.).
- Write the receiver contract: payload → row mapping, key scheme, edge cases, error semantics.
- **Deliverable:** approval sheet + technical spec. **Blocks:** Phase 2's normalization module.

### Phase 1 — Scaffolding · 0.5–1h session (+15min Mikael)
- `netlify.toml`, `netlify/functions/cf-sync.js`, `package.json`, `.gitignore`.
- **Shared-secret auth on the endpoint** — it's a public URL that writes to Airtable;
  unauthenticated is not an option.
- Netlify env vars (`AIRTABLE_PAT`, `CF_SYNC_SECRET`); deploy; verify the live URL.
- First build config this repo has ever had — budget for deploy fiddling.
- **Deliverable:** a live, authenticated, echo-only endpoint.

### Phase 2 — Core receiver · 1.5–3h session  ← the meat
- Parse `Jobs[]` + customer object; `"Sep 16, 2026"` → `2026-09-16`.
- Normalization module + **logging of every unmapped string** (so new CF free-text surfaces
  loudly instead of silently killing a checklist).
- Employee resolution: `"Malachi Roschmann, Dorian Young"` → record ids (fetch + cache).
- Pay Period resolution by date (replicating Zap 1 step 2's formula).
- Key construction **with line index**; upsert (query → PATCH/POST); batch writes (10/req);
  rate-limit backoff.
- **One handler for both CF events** — "Job Completed" simply updates what "New Job" created.
  This is what deletes Zap 2's entire loop/paths/find tree and both its bugs.
- Discounts (negative `Amount`) and disclaimers (`0.00`) become their own rows, as designed.

### Phase 3 — Tests + dry run · 1–2h session
- Fixtures from the three real payloads we captured: C14559 (5 lines), C19115 (discount +
  disclaimer), and a single-line visit.
- Unit tests: normalization, key/line-index, negative revenue, employee resolution, idempotency
  (same event twice = no duplicate rows).
- `?dryrun=1` mode logging intended writes; then a real run against a **scratch Airtable table**
  and a diff vs expected.
- **Deliverable:** green tests + a scratch-table diff Mikael can eyeball before we touch Jobs.

### Phase 4 — Zapier rewire · 0.5h session + 1–1.5h Mikael solo
- I write the exact Zap spec; Mikael rebuilds both Zaps as **trigger → single POST**.
- Joint end-to-end test: one real CF booking, one real completion.
- Old Zaps **paused, not deleted**, for instant rollback.
- **Task cost drops from ~1 + ~7 per visit to 1 + 1** — the lever on the $50/mo overage.

### Phase 5 — Repair the 160 rows · 1–2h session (+~1h admin)
- Per-line amounts were never written, so repair = **replay the CF events through the new
  receiver** (Zapier run replay), or **delete and let "Job Completed" re-create** as jobs
  complete. Both are safe *because 0 of the 160 sit in a paid pay period.*
- Hand-handle the **3** rows that already carry a tech submission.
- Before/after verification report (expect 160 → ~418 rows).
- Airtable admin purges the ~160 junk `Job Type` select options (PAT cannot).

### Phase 6 — App alignment + multiplier · 1–2h session (+~30min Bill)
- Safety net in the jobs app: flag/log an unrecognised `Job Type` instead of silently
  rendering no checklist and skipping OSHA.
- Ship the **commission multiplier** (already designed, currently stashed) once Bill confirms
  which real strings count — `Gutter Sticks` exists on **1** row, `Slimguard Gutter Protection`
  on **2**, `Partial Roof Cleaning` on 13, and there's a separate `gutter guards` on 4 that his
  spec would miss.

### Phase 7 — Cutover watch + handover · 0.5–1h session
- Monitor one pay period; run payroll against clean data and reconcile.
- Update the `.claude` docs.

---

## Risks & contingency

| Risk | Impact | Mitigation |
|---|---|---|
| CF can't POST to an arbitrary URL | none to the build — Zapier stays as the relay | already the default design |
| Zapier run-replay unavailable for old runs | Phase 5 shifts to delete-and-recreate | **cheaper**, not more expensive |
| Bill's naming map needs several rounds | Phase 0 stretches, Phase 2 partly blocked | stub the map, build against it, swap in the approved version |
| CF invents new free-text job types after go-live | silent checklist gaps return | unmapped-value logging (Phase 2) + app-side flag (Phase 6) |
| Netlify free-tier limits | none realistically | 125k invocations/mo vs ~hundreds of visits |

**Contingency: +20–25%** on the total for the usual unknowns → **quote up to 20h** if the PM
needs a not-to-exceed number.

The contingency is deliberately proportionally larger than a human estimate would carry,
because at this scale a single bad surprise (CF date-format variants, fuzzy employee-name
matching, an Airtable constraint we haven't hit) is a bigger share of an 11–17h job than of a
40h one.

---

## Recommended sequencing for the PM

1. **Now:** Phases 0–1 in one sitting (~1–1.5h), then chase Bill's approvals in parallel.
2. **Week 1:** Phases 2–3 (~2.5–5h) — the receiver, proven against a scratch table.
3. **Week 2:** Phases 4–5 (~2.5–4h incl. Mikael's Zap work) — cutover + repair. Sync is correct
   from here on.
4. **Week 3:** Phases 6–7 (~2.5–4h) — app alignment, multiplier, one pay period of monitoring.

The weeks are set by approval gates and real CF events, **not** by the amount of work in them.
If Bill turns the naming map around fast and a test booking is available on demand, Phases 0–5
could realistically compress into **2–3 working sessions**.

Go-live for the tech app should land **after Phase 5**, not before.
