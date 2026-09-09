# MWC — session report, 2026-09-08

**Purpose:** input for the PM to write an updated project-state doc. Everything done this
session is captured here. Detail lives in the reference docs listed at the end.

---

## 1. Executive summary

**What was wrong:** multi-service Customer Factor visits were syncing into Airtable as a
**single** Jobs row — `Job Type` a comma-joined string of every service, `Job Revenue` only the
first line item's amount, discount lines dropped entirely. 161 rows affected (~July → the
present). This broke, silently: payroll commission, the commission-multiplier feature (not yet
shipped), the OSHA compliance report, and the tech app's job checklist + OSHA-step gating.

**Root cause:** the Zapier "New Job" sync (Zap 1) had lost its line-item **loop** step at some
point (removed to save task credits, on a mistaken belief that CF fires one webhook per line
item — it fires one per visit with all line items in an array). A second Zap, "Job Completed"
(Zap 2), had two separate latent bugs and had in fact never successfully written a row.

**Decision taken:** patch the existing pipeline (restore the Zapier loop + normalize job-type
strings on read in the app), rather than the larger long-planned rebuild (move sync to a
Netlify Function and cancel Zapier). The rebuild is fully designed and shelved for if/when MWC
funds retiring Zapier.

**Where it stands now:**
- New Zap 1 (with the loop) is **live**; old Zap 1 and Zap 2 are **off**.
- The app has a shared job-type normalizer deployed; job form and compliance report use it.
- **All 44 combo rows dated 2026-09-09 or later** have been repaired into proper per-service
  rows from CF-invoice screenshots.
- Mikael has **purged all Jobs rows dated before 2026-09-09** (584 rows, CSV backup taken),
  which removed the remaining 117 pre-cutoff combo rows.
- Jobs table is now ~159 rows, all dated ≥ 9/9, **zero combo rows**.

**Next:** crew enters hours from 2026-09-09 forward; Bill test-runs payroll for pay period
**2026-09-09 → 2026-09-23** at period end. A short list of manual follow-ups remains (section 5).

---

## 2. What was done today

1. **Started** on the commission-multiplier feature; paused it when the combo-row bug surfaced.
   Design was completed (discount handled at full value — "model A") and an implementation
   prompt written for later. Code is **stashed** (`git stash`), not shipped.
2. **Investigated** the combo-row bug end to end — read the codebase, ran read-only Airtable
   queries, inspected both Zaps from screenshots. Produced a findings doc, a rebuild-design
   doc, and an action plan.
3. **Corrected an estimate error:** an early draft plan said "34–48h"; that was a
   human-developer figure mislabelled as tool time. Real Noobia effort for the patch route is
   ~11–17h; the calendar constraint (2–3 weeks) is approvals and real CF events, not work
   volume. See `mwc-sync-rebuild-plan.md`.
4. **Zapier rebuild** (Mikael, in the Zapier UI):
   - Duplicated Zap 1 as a rollback, then rebuilt it from a July backup that still had the
     loop. Added `Looping by Zapier → Create Loop From Line Items` over the trigger's `Jobs[]`.
     Create Record now maps `2. Amount` / `2. Job Type` / `2. Assigned To` from the loop, and
     `Job Key` from `2. Job Type`. Find Record (Pay Periods) stays *before* the loop.
   - Fixed two field-mapping slips introduced during the rebuild (a Find Record date pill that
     was pulling CF's formatted `Service Dates` instead of ISO `Service Date`; the `Job Key`
     date format).
   - Turned **Zap 2 ("Job Completed") off.** It had never successfully written and carried two
     bugs: it searched Jobs by `Job Number` (which is actually the *customer* id) with "return
     first result", so it would overwrite an arbitrary historical row; and it wrote the raw
     serialized loop object into both `Job Revenue` and `Job Type`.
   - New Zap 1 live; old Zap 1 off.
5. **App code** — 4 commits, all pushed to `main` (Netlify auto-deployed):
   - `04d543c` new `job-types.js` normalizer + wired into `jobs/index.html` and
     `compliance/index.html`.
   - `68ec904` the three investigation/plan docs.
   - `1698188` unrecognised-job-type flagging (job form note + compliance section) + two
     manual-follow-up docs.
   - `9f6c973` the 2026-09-08 debrief entry in `whereWeAre.md`.
6. **Legacy data repair** — over 9 batches, split every combo row dated ≥ 2026-09-09
   (44 visits) into per-service rows via the Airtable API, working from screenshots of the CF
   invoices Mikael supplied. Per-line revenue from CF; discounts and disclaimers as their own
   rows; per-line techs where CF differed by service (e.g. Doug & Cheryl Jensen). Shared
   fields (Customer Name, Job Date, Employee, Pay Period, Job Number) copied from the original
   combo row. Rates / hours / tech-count are Airtable lookups & formulas and were **not**
   written. Combo rows deleted after each batch. One combo (Doug & Cheryl Jensen) also had a
   stray duplicate plain row, which was removed. One visit (Alan Wackman C13941) had been
   edited in CF *after* it synced (extra service, extra tech, date shifted a day) — it was
   rebuilt entirely from the current CF invoice and the stale Airtable data discarded.
   As Mikael added missing `Job Type` select options, previously-blocked visits were completed.
7. **Purge** (Mikael, Airtable UI): pre-purge safety check confirmed nothing links the doomed
   rows to Issues / Monthly Scores / Payroll / Reviews. Mikael filtered to `Job Date` before
   `2026-09-09` (584 rows), downloaded a CSV backup, and bulk-deleted. This removed the 117
   remaining (all pre-cutoff) combo rows.

---

## 3. Current system state

### Sync (Zapier)
- **Zap 1 "New Job"** — live, with the line-item loop. Creates one Jobs row per CF line item
  (services, discounts, disclaimers). Task cost ≈ `1 find + 1 loop + N creates` per visit.
- **Old Zap 1** — off (rollback copy, keep for now).
- **Zap 2 "Job Completed"** — off. Not currently replaced; booking-time data from Zap 1 plus
  the tech app is the source of truth. If a CF job is edited between booking and completion,
  Airtable will not auto-update (known gap — the same gap that recurring jobs have).
- CF has **no API**; it is reachable only through Zapier. Any future move off Zapier keeps
  Zapier as a thin relay unless CF adds native webhooks.

### App (deployed)
- `job-types.js` — shared normalizer. Folds CF spelling variants to canonical `Job Type`
  values (`BRONZE Window Cleaning:` → `BRONZE Window Cleaning`, `blow off roof` → `Roof Blow
  Off`, three `Commercial WC` spellings → one, etc.), splits comma-joined legacy rows, and
  flags roof/gutter/skylight work for OSHA by keyword (not just an exact list). Loaded by
  `jobs/index.html` and `compliance/index.html`, which now call it instead of their own
  exact-match Sets. Measured against all 87 distinct strings then in the base: checklist
  coverage 498 → 581 rows, OSHA coverage 99 → 204 rows. Unknown values pass through unchanged
  — it can only add matches, never remove them.
- **Job form** — when a service has no checklist in `JOB_TYPE_MAP`, the tech now sees an amber
  "No checklist on file — do your standard process" note instead of silently getting only
  Arrival/Departure.
- **Compliance report** — new "Unrecognised Job Types" section (value, count, first-seen) so
  the normalizer map can be maintained from real data. ~20 values currently surface, mostly
  seasonal Christmas-light-install services with no checklist authored yet.

### Data (Airtable, base `appVXuyAYj47nZwyz`)
- Jobs table: ~159 rows, **all dated ≥ 2026-09-09, zero combo rows.**
- `Job Type` is a single-select **left open to new values** (deliberate — a closed field would
  make the sync error and the job row would never be created). It still contains ~97
  comma-joined junk options auto-created by the old sync; these are now unused (list in
  `airtable-junk-jobtype-options.md`) and an Airtable admin should delete them.
- Payroll table: 2 records, both April/May 2026 test runs. Nothing for 9/9–9/23 yet.
- Pre-9/9 history (584 rows) deleted; CSV backup held by Mikael.

---

## 4. Changes shipped

**Commits (all on `main`, pushed, Netlify-deployed):**

| Commit | Contents |
|---|---|
| `04d543c` | `job-types.js` (new); `jobs/index.html`, `compliance/index.html` wired to it |
| `68ec904` | `.claude/mwc-combo-row-sync-investigation.md`, `mwc-sync-rebuild-plan.md`, `mwc-action-plan.md`, `mwc-payroll-app-state-v1.md` |
| `1698188` | Unrecognised-job-type flagging; `.claude/bill-revenue-worklist.md`, `airtable-junk-jobtype-options.md` |
| `9f6c973` | `whereWeAre.md` — 2026-09-08 debrief entry |

**Files new this session:** `job-types.js`; `.claude/`: `mwc-combo-row-sync-investigation.md`,
`mwc-sync-rebuild-plan.md`, `mwc-action-plan.md`, `bill-revenue-worklist.md`,
`airtable-junk-jobtype-options.md`, `mwc-session-report-2026-09-08.md` (this file).

**Git stash:** one entry — the commission-multiplier draft (discount-netting version,
superseded by the "model A" design). Not shipped.

**Airtable writes this session:** ~115 split Jobs rows created via API; 44 combo rows + 1
duplicate deleted via API; 584 pre-9/9 rows deleted via UI (Mikael); several `Job Type`
options added via UI (Mikael): `Xmas Inside Tree Wrap (2)`, `Xmas 2nd Story Peak`,
`Xmas 36 Inch Wreath`, `Xmas 1st Floor Roof Line - Front and East Side`,
`Xmas light color change`, and others.

---

## 5. Open items

### Mikael
- Confirm the new Zap 1 on real traffic once bookings come in (one row per service, sane
  revenue, no commas).
- Log actual hours for this session against the engagement (no time tracking was captured in
  the work itself).
- Decide whether to keep the old Zap 1 rollback copy indefinitely or delete it after a clean
  pay period.

### Airtable admin
- Delete the ~97 comma-joined junk options from the `Job Type` single-select
  (`airtable-junk-jobtype-options.md`). **Keep the field open to new values.**

### Bill
- **Price Susan Boice C13663** — CF shows `$0.00` on both service lines; split as-is ($0/$0).
- **Erin Zuccaro C19095** — CF's three `Concrete Cleaning: Front / Driveway / Back` lines were
  folded to one `Concrete Cleaning` `Job Type` (distinct revenue $499/$299/$699, distinct
  `Job Key`s). Payroll sums them correctly. Flag if separately-named services are wanted.
- Decide whether the seasonal Christmas-light services need their own checklists.
- **Commission multiplier feature** — still blocked on Bill confirming which real `Job Type`
  strings count as each multiplier category. In the current data `Gutter Sticks` = 1 row,
  `Slimguard Gutter Protection` = 2, `Partial Roof Cleaning` = 13, and a separate
  `gutter guards` = 4. As specced it would apply to ~16 of 651 rows and miss `gutter guards`.

### Development (when unblocked)
- Add proper `job-types.js` entries for the Xmas services + any other recurring unrecognised
  values once Bill decides on checklists (until then they pass through and show in the
  compliance "Unrecognised" section, which is correct behaviour).
- Ship the commission multiplier once Bill confirms scope (draft is stashed; "model A" design
  in `mwc-action-plan.md` / prior investigation).
- OT-on-commission (`payroll.js` STEP 9): the shipped code already shows the `0.5` multiplier
  with a comment citing Bill's CA-law confirmation, so this earlier open thread appears
  **already resolved** — PM to confirm it was intentionally shipped and close it.

---

## 6. Deferred / shelved (not lost)

- **Netlify Function receiver** — the long-planned move of sync logic out of Zapier. Fully
  designed in `mwc-sync-rebuild-plan.md` (endpoint auth, per-line upsert keyed on
  `Job Number|Job Date|Job Type|line#`, normalization, the `netlify.toml` + functions-dir
  scaffolding this repo has never had). Not built. Revisit if MWC wants to stop paying Zapier
  or if CF gains a webhook. The patch route done today produces the same Airtable row shape,
  so nothing done today is wasted if the rebuild happens later.
- **Zapier plan** — MWC was reported ~\$50/mo over its Zapier plan. The single-loop Zap 1 plus
  disabled Zap 2 should reduce task usage materially; Mikael to check the usage page after a
  pay period and downgrade if it fits.

---

## 7. Reference docs (in `.claude/`)

| Doc | What it holds |
|---|---|
| `mwc-combo-row-sync-investigation.md` | Full RCA, evidence, CONFIRMED vs INFERRED, impact map |
| `mwc-sync-rebuild-plan.md` | The shelved Netlify-receiver design + corrected effort estimate |
| `mwc-action-plan.md` | The patch route actually taken, session-by-session |
| `bill-revenue-worklist.md` | The 161-row worklist (now fully actioned for ≥ 9/9; rest purged) |
| `airtable-junk-jobtype-options.md` | The ~97 junk `Job Type` options to delete |
| `whereWeAre.md` | Running dev debrief; 2026-09-08 entry added |
| `mwc-payroll-app-state-v1.md` | Prior project-state snapshot (now git-tracked) |
| `PAYROLL_SPEC.md` | Original payroll page spec (unchanged) |
