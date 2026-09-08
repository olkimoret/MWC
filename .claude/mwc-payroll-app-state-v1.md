# Project State — Master's Window Cleaning (MWC)

**Version:** 1 (first creation — no prior project-state.md existed; reconstructed from project files and prior chat history)
**Last updated:** 2026-09-08

---

## Status at a glance

**Where it stands:** The MWC ops app (jobs, payroll, compliance, reviews) is built and live; current work is two payroll-calculation fixes on top of it — an overtime bug and a new commission-multiplier feature — both currently blocked on answers from Bill.

**Next deadline:** None set. No contract, phase deadline, or hour budget for this work has surfaced in project files or chat history — flag this to Mikael before booking time against it.

**Blocked on:** Bill's replies on (1) whether "Slimguard Gutter Protection" has ever actually been booked/synced to Airtable, and (2) how to handle a visit's discount when it includes a multiplier job type.

| Items | Time | Deadline | Status | Blocker |
|---|---|---|---|---|
| OT multiplier fix (payroll.js STEP 9) | TBD — confirm with Mikael | — | Ready to implement | None — just needs a CC prompt generated |
| Job type commission multiplier ("multiplier add-on") | TBD — confirm with Mikael | — | Blocked | Waiting on Bill: Slimguard sync status + discount-proration decision |
| CF job-type dropdown lock (data hygiene) | TBD — confirm with Mikael | — | Parked / informational | No blocking dependency; optional cleanup Bill can action independently |

*(No hour estimates exist anywhere in the history I could find — these engagement sessions have run ad hoc in chat rather than through tracked, chunked sessions so far. Mikael should set real estimates before this table is treated as a schedule.)*

---

## Engagement overview

- **Client:** Master's Window Cleaning (MWC) — a window/gutter/pressure-washing service business. Owner/contact referred to as Bill or Billy.
- **What Noobia built:** A password-gated, mobile-first static web app for MWC's field techs and Bill (manager), backed by Airtable (Base ID `appVXuyAYj47nZwyz`).
- **Contract / proposal:** Not found in project knowledge or chat history searched so far. If one exists outside this project, it should be added so scope and budget are traceable. Until then, treat all current work as unscoped in dollar/hour terms.

## What's built (current state)

Pages (all under one static site, gated with a shared manager password):

- **`/jobs/`** — Field tech job-submission flow: pick employee + date + client job, job-type-specific checklists (window cleaning, gutter cleaning, roof cleaning, Slimguard, pool cleaning, seam repair, etc.), OSHA hazard assessment (for gutter/roof/skylight job types), commission/hourly time entry, safety checklist, photo capture. Also supports logging non-commission (maintenance/admin) hours.
- **`/payroll/`** (manager-only) — Bill selects an employee, sees their last 4 calculated pay periods, and can run payroll for any completed pay period with no existing record. All calculation happens client-side in `payroll.js` against Airtable data (Jobs, Employees, Pay Periods, Payroll tables), per the original spec in `.claude/PAYROLL_SPEC.md`.
- **`/compliance/`** (manager-only) — OSHA assessment completion and checklist-completion issues, for the last 2 pay periods, printable.
- **`/reviews/`** (manager-only) — Links unlinked customer reviews.
- **`/index.html`** (manager-only) — Dashboard linking to the above.

Payroll calculation logic (`payroll.js`), summarized:

1. Group jobs by date; compute daily OT (CA law: hours over 8/day) and weekly OT (over 40/week); take the max.
2. Regular commission = sum of (job revenue ÷ number of techs on the job) × commission rate, across all jobs except `Job Type = "Non-Commission"`.
3. OT-on-commission = a multiplier × (regComm ÷ commission hours) × OT hours — **this multiplier is the current open bug, see below.**
4. Safety net: if average hourly commission < $17/hr, pay is recalculated on an hourly basis instead (with the OT hours in that path correctly paid at a separate, full 1.5x — not part of the current bug).

## Open thread 1 — OT-on-commission multiplier bug

**The bug:** The original spec (`.claude/PAYROLL_SPEC.md`) says the OT-on-commission multiplier should be **0.5** (a straight 50% premium, landing OT hours at 1.5x total pay — correct under CA law, since regular commission already covers the base 1x). At some point the shipped code (`payroll.js` STEP 9) was changed to **1.5**, which — because regComm already includes 1x for every hour including OT — makes OT hours effectively pay out at **2.5x total**. The in-code comment even flags this as pending review.

**Status:** Bill has now confirmed directly (this chat, current session) that he wants OT paid at 1.5x total, per CA law — i.e., the fix is to put the multiplier back to match the original spec.

**The fix (worked out, not yet sent to Claude Code):**
```js
// STEP 9: OT on commission
// Bill confirmed (per CA OT law): OT hours paid at 1.5x TOTAL, not 2.5x.
// regComm already includes 1x for OT hours, so we only add the 0.5x premium here.
const otComm = totalCommHours > 0 && totalOTHours > 0 ? (regComm / totalCommHours) * 0.5 * totalOTHours : 0;
const totalComm = regComm + otComm;
```
STEP 13 (the safety-net/hourly path) already correctly uses 1.5x with no double-count and should **not** be touched.

**Next action:** Generate the Claude Code prompt for this fix and have Mikael run it. Low risk, well-understood, fully unblocked.

## Open thread 2 — Job-type commission multiplier ("multiplier add-on")

**The feature:** Some job types cost MWC significantly in materials (e.g. gutter guard product). Commission on those job types should be calculated on a multiplied-down revenue figure — approximating company profit rather than what the client was charged — before applying the commission rate.

**Bill's numbers (confirmed this session):**
| Job type (as Bill named it) | Multiplier |
|---|---|
| Partial Roof Cleaning | 90% |
| Gutter Stick | 50% |
| Slimguards | 50% |

**Naming reconciliation done so far** (audit delivered as `Job_Type_Audit_CF_vs_Airtable.xlsx`, comparing CF's 67 official booking job types against ~144 distinct values pulled from Airtable):

| Bill said | Confirmed real name | Status |
|---|---|---|
| Partial Roof Cleaning | Partial Roof Cleaning | Exact match, both in CF and Airtable — ready to use |
| Gutter Stick | **Gutter Sticks** (plural) | Name mismatch resolved — use plural form |
| Slimguards | **Slimguard Gutter Protection** (per CF's own dropdown) | Real CF name confirmed, but this exact job type has **never appeared** in the Airtable job data pulled for this audit |

**Resolved sub-question — combo Job Type values:** Earlier concern that Airtable's Job Type field sometimes bundles multiple services into one comma-joined value turned out to be based on a list whose source is unconfirmed (pasted by Mikael, labeled "the list in Airtable," but inconsistent with the actual Jobs table structure already in the project, which is one Job Type per row — confirmed directly in `JobsGrid_view_3.csv` and in `payroll.js`'s own per-row processing). **Still open:** confirm with Mikael where that comma-joined list actually came from, so the earlier audit's "combo entry" findings can be properly scoped or discarded.

**Genuinely open design question — discounts:** Discount line items (e.g. `Job Type = "Discount"` or `"Membership Discount"`) are their own independent Airtable rows today, each with its own Job Number, own Commission Rate, and own Calculated Commission — verified directly against real rows in `JobsGrid_view_3.csv` (e.g. Mike Clohossey 4/29, Nancy Miyashiro 4/29). They are **not currently netted against any specific sibling job** before commission is calculated. Job Number has a shared-prefix pattern per customer visit (e.g. `C-GEO-429A` through `C-GEO-429F`) that could be used to link a discount to its visit.

If a multiplier job type shares a visit with a discount, does the discount net against that job type's revenue before the multiplier is applied? Straightforward when the visit has exactly 2 lines (the multiplier job + its discount); genuinely ambiguous when a visit has several different services plus one discount (real example: Nancy Miyashiro's 4/29 visit had 5 different services + 1 discount). Recommended default proposed to Mikael: allocate each visit's discount proportionally across that visit's revenue lines by dollar share, net that against each line before its multiplier and commission rate. **Not yet confirmed by Bill.**

**CF settings check (this session):** Searched The Customer Factor's documentation for a setting to lock the Job Type field to dropdown-only selection (to stop the root cause of the naming drift). No dedicated setting found — CF's own docs describe on-the-fly job-type creation during scheduling as core, always-on behavior. Closest lever: the per-employee "Edit jobs" permission (Manage Users), which one CF doc ties to changing job-type/item on an appointment — unconfirmed whether it also blocks adding brand-new job types. Recommended Mikael check directly in Bill's CF account or ask CF support for a definitive answer. Not blocking the multiplier work; a parallel, lower-priority cleanup item.

**Status:** Tabled until Bill replies on the two points above. Once he does, the ask is for a Claude Code prompt that:
1. Adds a Job Type → multiplier lookup (exact string match, using the confirmed real names above) defaulting to 1.0 for everything else.
2. Applies it to job revenue before the commission-rate multiplication in STEP 8, without touching the existing per-job tech-revenue-split logic (a separate, already-correct mechanism).
3. Handles the discount-netting logic per whatever Bill confirms.

## Decisions log

- OT-on-commission must be a 0.5 multiplier (1.5x total pay), matching CA law and the original spec — confirmed by Bill, this session.
- Multiplier percentages: Partial Roof Cleaning 90%, Gutter Sticks 50%, Slimguard Gutter Protection 50% — confirmed by Bill, this session.
- Airtable's Jobs table is one Job Type per row (not combo/multi-service strings) — confirmed against actual project files.
- "Gutter Stick" → real name is "Gutter Sticks" (plural) — confirmed against both CF's live dropdown list and Airtable's distinct values.
- "Slimguards" → real CF name is "Slimguard Gutter Protection" — confirmed against CF's live dropdown list; not yet seen in Airtable data.

## Open questions (blocking)

1. Has "Slimguard Gutter Protection" ever been booked in CF, and if so, why has it never landed in Airtable's Jobs table? (Ask Bill.)
2. How should a visit-level discount be allocated against a multiplier job type's revenue when the visit contains multiple different services? (Ask Bill; proportional-by-dollar-share proposed as default.)
3. Where did the comma-joined "list in Airtable" (used in the earlier, now-superseded combo-entry audit) actually come from? (Ask Mikael.)

## Next steps

1. Mikael relays Bill's answers on the two blocking questions above.
2. Generate CC prompt for the OT fix (unblocked, can happen anytime).
3. Generate CC prompt for the multiplier add-on once naming and discount-handling are confirmed.
4. Mikael to confirm real time estimates for the glance table above — none were invented here.
