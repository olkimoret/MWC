# Project State — Master's Window Cleaning (MWC)

**Version:** 4 (supersedes v3 from 2026-09-14; updated with the 2026-09-16 PTO build session)
**Last updated:** 2026-09-16

---

## Status at a glance

**Where it stands:** Zap 1 is confirmed populating Airtable correctly on live traffic since 9/8, and the junk `Job Type` options have been cleaned. PTO capture (Session C) is built and **now live** — Mikael created the `PTO` table by hand and it's been verified against the real schema plus a live create/read/delete smoke test. The job form itself was left untouched this session, per the freeze during Bill's live test window. Remaining work: a data backfill, the commission multiplier, and Bill's live payroll test. Everything else is deliberately deferred to `post-launch.md`.

**Next deadline:** Bill test-runs payroll for pay period **2026-09-09 → 2026-09-23** on **9/23 or 9/24**, with Mikael on call. Project closes by **2026-09-30**.

**Blocked on:**
- Bill — the exact Job Type strings for the multiplier, specifically whether `gutter guards` counts.
- ~~Unknown — whether the job form accepts back-dated entries.~~ **Resolved 9/16, see Session A below.**
- ~~Mikael — create the `PTO` table by hand.~~ **Done 9/16, verified live and matches spec exactly** — see Session C.

| Session | Items | Time (proposed — Mikael to confirm) | Deadline | Status | Blocker |
|---|---|---|---|---|---|
| A | Back-dating capability check | 0.25h | 9/15 | **Done** | None |
| B | Backfill 9/9–9/14 from Bill's live sheet | 1.5–2h | 9/16 | — | None (A resolved it) |
| C | PTO capture (Option B) | 4–6h | 9/18 | **Done — table created, code verified live** | None |
| D | Commission multiplier add-on | 2–3h | 9/18 | — | Bill: `gutter guards` |
| E | Zapier Find Record optimization (optional) | 0.5h | optional | — | None |
| F | Bill test run + handoff doc | 2–3h | 9/24–9/30 | — | Sessions B–D done |

**Effort note:** The 9/8 session ran the entire afternoon, materially more than the "3–4h patch" estimate. The patch itself was small; the time went into the 9-batch manual repair of 44 visits from CF screenshots and the surrounding investigation. Corrected total Noobia effort for the patch route is ~11–17h (an earlier "34–48h" figure was a mislabelled human-dev estimate). **No actual hours are logged for the 2026-09-16 session either** — Claude Code has no way to measure real elapsed time and a prior version of this file wrongly stated "~3h actual" as if it were a measured figure; that was a fabricated number, not a log, and has been removed. **Mikael still needs to log real hours for the 9/8, 9/14, and 9/16 sessions — nothing has been captured for any of them.** This is still the biggest gap in the record.

---

## Engagement overview

- **Client:** Master's Window Cleaning (MWC). Owner/contact: Bill (Billy) Roschmann.
- **What Noobia built & maintains:** A mobile-first, password-gated web app (on Netlify) for MWC's field techs and Bill, backed by Airtable (base `appVXuyAYj47nZwyz`), fed from Customer Factor (CF) via Zapier. Pages: jobs (tech submission), pto (tech submission, new this session), payroll (manager), compliance/OSHA (manager), reviews (manager).
- **This is an ongoing maintenance relationship** with multiple contracts. Mikael wants this closed by end of September to move to the next engagement (a website, and potentially digital marketing).
- **Contract / budget for this specific work:** still not surfaced in project files. This has run as unscoped maintenance.
- **Rate position (internal, never shown to Bill):** This project runs **below Noobia's hourly floor**. It is being accepted as a deliberate loss-leader against the website and digital marketing work, not as a default. Consequence, and this is the operating rule for the rest of the project: anything not on the critical path to "Bill runs payroll on 9/23 and it works" gets cut or moved to the next contract.

---

## Close-out plan (set 2026-09-14)

**Goal:** Ship a working app, have Bill successfully test payroll on the 9/9–9/23 period, hand over, and close by 2026-09-30. Quality takes priority over speed, because the outcome Mikael wants is a Bill who recommends the work to his network.

**The parallel-run decision.** Rather than wait for the 9/24 pay period to start clean (which would push the first real test to 10/8 and the close to mid-October), the current period runs as a hybrid:

- 9/9 → 9/14: backfilled by Mikael from Bill's live spreadsheet.
- 9/15 → 9/23: entered by techs in the app, independently, while Bill continues filling his own spreadsheet.
- 9/24: Mikael and Bill compare the payroll page against Bill's sheet for the full period.

**Stated honestly:** the 9/9–9/14 half is data entry, not validation. It will match Bill's sheet because it was copied from Bill's sheet. The 9/15–9/23 half is the actual proof, and that is how it gets presented to Bill.

**Critical dependency, must be done first:** Bill must be told to **keep filling his live spreadsheet through 9/23**. If he stops because the app now exists, there is nothing to compare against on the 24th and the entire test is void.

---

## Session A — Back-dating finding (2026-09-16)

**Question:** Does the job form accept back-dated entries? This affects whether a tech who misses a day can catch up during the test window, and whether Session B (backfill) can be done through the app instead of scripted.

**Finding: yes, with no restriction in either direction.** In `jobs/index.html`, the job-date field is a Flatpickr instance (`flatpickr('#job-date', { dateFormat: 'Y-m-d', defaultDate: todayStr, onChange: ... })`) with no `minDate`/`maxDate`/`disable` option set. Nothing downstream re-validates the date — `tryLoadJobs()` and `submitForm()` both take whatever string is in the field and use it as-is (Airtable write, `IS_SAME({Job Date}, ...)` lookup). A tech can pick any past or future date and submit a job against it today.

**Consequence:** a tech who misses a day during 9/15–9/23 can catch up by backdating a job-form entry — no code change needed. This was investigated only; **the job form was not touched**, per this session's explicit freeze during Bill's live test.

---

## Session C — PTO capture, built (2026-09-16)

Shipped per the 2026-09-14 decision: **Option B, capture-only.** No pay calculation, no OT interaction, no accrual, no balance, no approval workflow anywhere in this.

### What was built

- **`pto/index.html`** — new tech-facing screen, same open (no password) access as the job form, same mobile-first card/toggle/flatpickr patterns. Tech picks their name (shared filter, see below), a date, a type (PTO/Sick/Holiday), optional notes, and submits. Hours is fixed at 8, not exposed in the UI — full days only, one entry per day, no date-range picker (matches the explicit scope cut). Lists that tech's own entries below the form with a delete action.
- **Double-booking guard** — on submit, the page checks whether that employee already has `Comm Start` or `Hrly Start` filled on a Jobs row for the same date. If so, it shows a confirm dialog ("already has job hours logged... save anyway?") rather than blocking or silently correcting anything. This only warns; it does not stop double-paid days from being possible, by design — see GOAL doc.
- **Pay Period, derived automatically, no new Zap.** The Zapier task budget is already projected over its plan limit next cycle, so this could not be a new Zap the way Jobs' Pay Period resolution is (Zap 1). Instead `pto/index.html` loads the Pay Periods table once (`Start Date`/`End Date`) and resolves the link client-side: whichever period's date range contains the submitted date. The tech never sees or picks a period, and the date picker is **not** scoped to one — see the v3→v4 correction below.
- **`employees.js`** — new shared module holding the "which employees show up in a time-entry picker" filter (active employees, Role = Field Supervisor or Tech 1–4) that Commit `76e0229` added inline to the job form. `pto/index.html` uses it. **`jobs/index.html` was deliberately left on its own inline copy** rather than pointed at the new module — editing the frozen job form, even for a one-line refactor, wasn't worth the risk during Bill's live test window. Follow-up: point `jobs/index.html` at `employees.js` once the test window closes, so the two pickers can't drift apart again.
- **Payroll page additions** (`payroll/index.html`, `payroll/payroll.js`):
  - **PTO Days** column — PTO hours (from linked PTO rows) for the currently-displayed pay period, ÷ 8, per employee. Shown in days because that's the unit Bill works in on his own sheet.
  - **YTD PTO** column — same computation, but summed from Jan 1 of the current calendar year through today. Days **taken**, not days remaining — no allotment/accrual/balance concept exists anywhere in this build.
  - **Upcoming Time Off** — plain list under the team table: every PTO entry dated today or later, across all employees, sorted ascending (date, name, type). No calendar UI, no filters.
  - The PTO fetch is wrapped in its own try/catch so a missing/renamed PTO table degrades to "no PTO data shown" rather than breaking the whole payroll page.
  - **PTO hours never enter the existing hours pipeline.** `computePayroll()` in `payroll.js` — the function that produces `Regular Hours`, `OT Hours`, and `Gross Wages` — was not touched. PTO days are computed in a separate function (`ptoHoursInRange`) reading straight from the new PTO table, never merged into net/gross hours or the OT threshold. California overtime is based on hours actually worked, and this holds even though no pay is calculated from PTO here.
- **Dashboard link** — added a "Log Time Off" card to `index.html` (the shared dashboard) pointing at `/pto/index.html`. This dashboard is not the job form and carries no live-test risk, so it was in scope to edit.

### PTO table — created by Mikael 2026-09-16, verified live, matches spec exactly

The PAT (`pat51Bpz1...`) can read base schema via the metadata API but cannot write it — creating the table via API returned `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND`. See `post-launch.md`/PAT-limits memory for the earlier-known half of this (it also can't auto-create new select options on write). Mikael created the table by hand in the Airtable UI instead. Verified two ways: reading the live schema back via the metadata API, and a full create → read → delete smoke test through the exact fields payload `pto/index.html` sends (test record `recN3Y6WZE3BLa456`, deleted after — the table's own rows were not touched).

First pass turned up two deviations (`Hours` created at 0 decimal precision instead of 1, and an extra unused `Status` field left over from Airtable's new-table scaffold). Mikael fixed both same-day: deleted `Status`, and bumped `Hours` to 1 decimal precision — by choice, not because half-day PTO is needed now, just to keep that door open. Re-checked the live schema after the fix; table now matches the spec field-for-field:

| Field | Type |
|---|---|
| Id | Autonumber, primary |
| Employee | Link → `Employees` |
| Date | Date |
| Hours | Number, 1 decimal |
| Type | Single select: PTO/Sick/Holiday |
| Paid | Checkbox |
| Pay Period | Link → `Pay Periods` |
| Notes | Long text |

`pto/index.html` and the payroll page additions are confirmed working against the real table with no further code changes needed. The three blank template rows Mikael's original CSV export showed (`Id` 1–3, no other fields) are untouched — harmless (no Employee link, so nothing in the app matches them), fine to delete for tidiness whenever convenient.

### Correction to v3

- **v3's plan to constrain the PTO date picker to the selected pay period is superseded.** That plan assumed the tech would pick a pay period; the final GOAL brief made Pay Period a derived, invisible field instead, and explicitly required the date picker to accept **both future and past dates without restriction** (future dating for planned time off, past dating for after-the-fact sick days). A period-scoped picker would have blocked exactly the future-dating workflow that's the main use case. The anti-trap goal from v3 (a day outside the intended period getting mis-filed under it) is instead solved by deriving Pay Period from the date client-side, automatically, so there's no period label for a wrong day to hide under.

### Explicitly not built (guardrail check — confirmed clean)

Per the GOAL brief's "stop and report" instruction: no rate lookup, no pay calculation, and no allotment field were added anywhere in this session. `Paid` is a bare checkbox with no logic reading it. Year-to-date days **taken** (in scope) was built; days **remaining** (out of scope, pending a client answer on whether MWC even offers an annual allotment) was not.

---

## Decisions log

### Taken 2026-09-16

- **Pay Period resolution for PTO is client-side, not a new Zap.** The Zapier task budget is already tight (see below); adding a second automation wasn't an option. The tech app now holds this logic itself, reading the Pay Periods table directly.
- **`employees.js` extracted as a new shared module, but `jobs/index.html` not migrated to it this session.** Sharing the picker logic was the goal; touching the frozen job form during Bill's live test was judged the bigger risk. Tracked as a deferred follow-up above.
- **PTO's `Employee` and `Pay Period` fields are Airtable link fields**, matching `Jobs.Employee`/`Jobs.Pay Period`, rather than free-text — so a name or period can never drift out of sync with the rest of the base by typo.
- **The PTO Airtable table could not be created by Claude Code** — the PAT lacks schema-write scope. Mikael created it by hand instead, then fixed the two minor deviations a first schema check turned up (`Hours` precision, extra `Status` field); it now matches spec exactly. See the verification writeup above.

### Taken 2026-09-14

- **PTO ships as Option B, capture-only.** New `PTO` Airtable table, tech entry screen, PTO Hours column on the payroll page. No pay calculation, no OT interaction, no accrual, no balance, no approval. Estimated 4–6h vs 10–14h for full integration. Rationale: matches how Bill works today (he transcribes hours into his payroll process anyway), and full integration is what would push the close past September. Option A recorded in `post-launch.md`.
- **PTO model confirmed from Bill's own workbook.** The Q3 `Tips & PTO` sheet uses a checkbox per calendar day, 8 hours per checked day, totalled per employee per pay period. No accrual, no balances, no partial days, no approval step. Verified directly in the file.
- **PTO date entry must be constrained to the selected pay period.** *(Superseded 2026-09-16 — see correction above.)*
- **Zap 2 stays off permanently for this project.** Recorded in `post-launch.md` with its two bugs, the accepted gap, and a manual workaround for Bill.
- **Tips are out of scope.** Not deferred for effort reasons (roughly 2–3h alongside PTO) but because Bill enters tips himself and it is not a tech workflow. Recorded in `post-launch.md`.
- **Zapier budget is a Bill decision, not a build task.** The Aug 15–Sep 15 cycle closed at 576/750. The restored loop raised the rate and the next cycle is projected over. Options and the one cheap lever are in `post-launch.md`. Tell Bill before the cycle closes.
- **`post-launch.md` created** as the register for everything deliberately deferred.

### Correction to v2

- **v2 mislabelled the discount model.** It recorded the current design as "model A (discount at full value)" with netting as the stashed alternative. That is backwards. The netting model was confirmed by Bill via Mikael in the 2026-09-09 "Multiplier implementation status" chat and is the decided behaviour. Details under the multiplier section below. **The stashed draft using discount-netting is the correct one.**

### Carried forward

- **Patch over rebuild** — restore Zapier loop + normalize on read, rather than the Netlify-receiver rebuild. Rationale: ship this week, Mikael eating labor so his hours matter more than Zapier task-cost (Bill's bill), rebuild stays shelved as a future paid upgrade. (2026-09-08.)
- **CF fires one webhook per visit (batched line items), not per line item** — confirmed, resolving the prior open contradiction. The loop is therefore necessary and correct. (2026-09-08.)
- **Zap 2 disabled, not fixed** — booking-time Zap 1 + tech app is source of truth; the edit-between-booking-and-completion gap is accepted. (2026-09-08, reaffirmed 2026-09-14.)
- **`Job Type` select stays open to new values** — deliberate, to keep the sync from erroring on unmapped services. (2026-09-08.)
- **Purge pre-9/9 history rather than repair it** — the 117 pre-cutoff combo rows couldn't be reliably reconstructed at scale and weren't needed for the upcoming pay period; backed up to CSV first. (2026-09-08.)
- **OT-on-commission = 0.5 multiplier (1.5x total, CA law)** — Bill-confirmed; code shows this shipped. **Still needs PM confirmation that the numbers were checked, then this long-running thread retires.**
- **Multiplier percentages:** Partial Roof Cleaning 90%, Gutter Sticks 50%, Slimguard Gutter Protection 50% — Bill-confirmed.
- **Job type naming reconciled:** "Gutter Stick" → `Gutter Sticks` (plural). "Slimguards" → `Slimguard Gutter Protection` (CF's real name; never yet seen in Airtable data).

---

## Commission multiplier — design is settled

Confirmed by Bill via Mikael in the 2026-09-09 "Multiplier implementation status" chat. **A complete Claude Code prompt for this already exists in that chat and can be reused as-is.**

1. **Net the discount off first, then apply the multiplier, then the commission rate.** ($200 job − $25 coupon) × multiplier × rate. Worked example: a $200 job with a $25 flat coupon, a 50% multiplier and a 23% commission rate = ($200 − $25) × 0.5 × 0.23 = $20.13.
2. **Flat-dollar discounts split equally across the visit's job lines.** $45 off across 3 jobs is $15 off each. This overrides the proportional-by-dollar-share default that had been proposed.
3. **Percentage discounts need no separate handling.** CF converts percentages to dollars before anything reaches Airtable, so the equal-dollar-split is the only rule required.
4. **Netting applies only to job types that carry a multiplier.** Every other job type keeps today's behaviour, where a discount is its own independent negative-revenue commission line. This was an explicit scope decision, not an oversight.
5. **Visit grouping key: same Job Date + same Customer Name.** Job Number's shared prefix per visit (e.g. `C-GEO-429A` through `C-GEO-429F`) is the fallback.
6. **Known limitation to comment in code, not solve:** the logic assumes a visit's discount line is attributed to the same employee as the multiplier job, since the Jobs fetch is already filtered to one employee. Do not build a cross-employee fetch for this.
7. **Implementation note:** the payroll Jobs fetch does not currently pull `Customer Name`, which the visit-grouping needs. It must be added.

**Remaining blocker:** which exact Job Type strings belong to each multiplier category. In the data as of 9/8: `Gutter Sticks` = 1 row, `Slimguard Gutter Protection` = 2, `Partial Roof Cleaning` = 13, and a **separate** `gutter guards` = 4. As specced, the multiplier would miss `gutter guards` entirely. Mikael is asking Bill.

---

## Current system state

**Sync:** Zap 1 (with loop) live and **confirmed populating Airtable correctly on live traffic** as of 2026-09-14. Old Zap 1 off (rollback copy). Zap 2 off (not replaced, see `post-launch.md`). **CF has no API** — reachable only through Zapier; any future move keeps Zapier as a thin relay unless CF adds native webhooks. Known gap: if a CF job is edited between booking and completion, Airtable won't auto-update.

**Zapier usage:** Aug 15 – Sep 15 cycle closed at **576 tasks / 750 plan limit**. Task rate rose after the loop went live on 9/8 (roughly 20/day → roughly 33/day, read off the usage chart). Next cycle projected around 990, over the limit. See `post-launch.md` item 3. **No new Zap was added for PTO** — the resolution logic runs client-side instead, specifically to avoid adding to this number.

**App:** `job-types.js` normalizer live in job form + compliance. Unrecognised-job-type flagging live in both. Amber "no checklist on file" note live in the job form. **New this session:** `pto/index.html` (tech PTO entry), `employees.js` (shared employee-picker filter), payroll page PTO columns + upcoming list. `jobs/index.html`, `job-types.js`, and the commission logic in `payroll.js` were **not modified** this session, per the live-test freeze.

**Data (base `appVXuyAYj47nZwyz`):** Jobs all dated ≥ 9/9, no combo rows. `Job Type` is a single-select **deliberately left open to new values** — a closed field would make the sync error and the row would never be created. **The ~97 comma-joined junk options were deleted by Mikael on 2026-09-14.** Payroll table: 2 records, both April/May test runs — nothing for 9/9–9/23 yet. Pre-9/9 history (584 rows) deleted; CSV backup held by Mikael. **`PTO` table created 2026-09-16, verified live** (schema check + smoke test — see Session C above); 3 harmless blank rows from setup, no real entries yet.

**Bill's spreadsheets (verified 2026-09-14):** The copies held in the project are **not current**. `UPDATED_MWC_Business_Card_Q2_2026.xlsx` has real data through 5/23/2026 and is empty from `5.24-6.8` onward. `MWC_Business_Card_Q3_2026_COPY.xlsx` is an entirely blank template — every Q3 period sheet and the September monthly sheet are zeroed. `JobsGrid_view_3.csv` is the old April/May test export (79 rows, 4/24 to 5/8), since purged from Airtable. **Bill maintains a live spreadsheet that Mikael has access to; that is the source for the backfill, not these copies.**

---

## What's needed next (handoff checklist)

**Mikael — immediate:**
- ~~Create the `PTO` table in Airtable by hand.~~ **Done 2026-09-16, verified live, matches spec exactly** — see Session C.
- **Message Bill today (if not already done):** he must keep filling his live spreadsheet through 9/23, or there is nothing to compare against on the 24th. Highest-value item on this list, two minutes.
- Ask Bill whether `gutter guards` is a multiplier category (unblocks session D).
- Spot-check the first real tech PTO submission (schema + a scripted smoke test are verified, but no real tech has used the screen yet).
- Log actual hours for the 9/8, 9/14, and 9/16 sessions — nothing has been captured for any of them (see Effort note above).
- Tell Bill about the Zapier budget before the next cycle closes.

**Mikael — before close:**
- Confirm and formally close the OT-on-commission item (code shows 0.5 shipped with a CA-law comment; confirm the numbers were checked, then retire the thread).
- Decide whether to delete the old Zap 1 rollback copy after one clean pay period.
- Write the client handoff document, including the client-visible items from `post-launch.md`.
- Once Bill's live-test window closes, point `jobs/index.html`'s inline employee-picker filter at the new `employees.js` module so the two pickers can't drift apart (low-risk cleanup, deliberately deferred out of this session).

**From Bill:**
- Multiplier scope — the exact Job Type strings per category, specifically `gutter guards`. **Blocking.**
- Price **Susan Boice C13663** — CF shows $0.00 on both lines; split as-is unless corrected.
- **Erin Zuccaro C19095** — CF's three `Concrete Cleaning: Front/Driveway/Back` lines were folded to one `Concrete Cleaning` type (distinct revenue $499/$299/$699, payroll sums correctly). Confirm whether separately-named services are wanted.
- Decide whether seasonal Christmas services need their own checklists. **Timing: needs deciding in October, not December.**
- Whether MWC offers an annual PTO allotment at all — needed before "days remaining" (currently out of scope) could even be scoped.

**Development:**
- Session B: backfill 9/9–9/14 into Airtable from Bill's live sheet, scripted against the Airtable API from an export. Do not hand-type. (Session A confirmed the job form itself would also accept back-dated entries, as an alternative path, if scripting the API turns out slower.)
- Session D: commission multiplier, reusing the existing CC prompt, once Bill answers on `gutter guards`.

---

## Deferred / shelved (not lost)

**All deferred items now live in `post-launch.md`**, which is the register of record. Summary of what is in it: Zap 2, the Netlify Function receiver rebuild, the Zapier task budget decision, PTO full payroll integration (Option A), Tips, seasonal Christmas checklists, Airtable housekeeping, CF job-type drift lockdown, and three open data questions for Bill.

Key point preserved from v2: **the patch produces the same Airtable row shape as the shelved rebuild would, so nothing done in September is wasted if the rebuild later happens.**

---

## Reference docs (in repo `.claude/`)

| Doc | What it holds |
|---|---|
| `post-launch.md` | Register of everything deliberately deferred past launch |
| `mwc-session-report-2026-09-08.md` | Full CC session report v2 was built from |
| `mwc-combo-row-sync-investigation.md` | Full RCA, evidence, CONFIRMED vs INFERRED, impact map |
| `mwc-sync-rebuild-plan.md` | Shelved Netlify-receiver design + corrected effort estimate |
| `mwc-action-plan.md` | The patch route actually taken, session-by-session |
| `bill-revenue-worklist.md` | The 161-row worklist (actioned for ≥ 9/9; rest purged) |
| `airtable-junk-jobtype-options.md` | The ~97 junk `Job Type` options (deleted 2026-09-14) |
| `whereWeAre.md` | Running dev debrief |
| `PAYROLL_SPEC.md` | Original payroll page spec (unchanged) |

---

## Session log

| Date | Session | Estimated | Actual | Notes |
|---|---|---|---|---|
| 2026-09-08 | Combo-row sync bug: RCA, Zap 1 rebuild, `job-types.js`, 44-row repair, 584-row purge | 3–4h | **not logged** | Ran the full afternoon. Overrun was the manual repair from CF screenshots, not the patch. Corrected route estimate ~11–17h. |
| 2026-09-14 | Lead-PM close-out planning: parallel-run decision, PTO scoped to Option B, Zap 2 closed out, discount model correction, `post-launch.md` created | — | **not logged** | Verified Bill's workbook copies are stale; live sheet is the backfill source. Zap 1 confirmed on live traffic. Junk job types cleaned. |
| 2026-09-16 | Sessions A+C: back-dating finding, PTO capture build (`pto/index.html`, `employees.js`, payroll page PTO columns + upcoming list) | 4.25–6.25h | **not logged** | Claude Code has no way to measure real elapsed time, so this cell was previously filled with a made-up "~3h" — corrected to not-logged. Mikael needs to log this one from his own clock. Separately, PTO is not yet live — the Airtable PAT can't create tables (schema read-only), so the `PTO` table has to be created by hand before this can be exercised against real data. That setup + first-submission spot-check is still owed against whatever time gets logged. |
