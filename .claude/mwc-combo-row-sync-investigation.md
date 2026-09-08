# Investigation — CF→Airtable "combo row" collapse + sync-receiver design

**Date:** 2026-09-08 (v2 — §2 resolved, Airtable inventoried, recommendation firmed)
**Scope:** investigation + design. **No production changes. No writes to Airtable. No PR.**
All Airtable access below was read-only (GET), using the PAT already hardcoded in the repo.

---

## TL;DR

- **Root cause confirmed.** CF sends **one webhook per visit** with all line items in a
  `Jobs[]` array. Zap 1 ("New Job") lost its loop, so a single "Create Record" collapses the
  visit: `Job Type` becomes a comma-joined string, and **`Job Revenue` takes only the FIRST
  line item's amount** (or nothing at all).
- **It's worse than "wrong Job Type".** Revenue is wrong on all 160 collapsed rows, and
  **110 of them contain a `Discount` segment whose money vanished entirely.**
  Example C19115: true net 242 + 0 − 22 = **220**, stored as **242**. Example C14559: true
  total **1211**, stored as **empty**.
- **Nobody has been paid off this data.** 0 of the 160 collapsed rows fall in a pay period
  that has a calculated Payroll record. Only 3 have a tech submission. The damage is entirely
  *prospective* — which, with the client not live yet, means we can fix this properly.
- **Recommendation: skip the Zapier stopgap, go straight to the Netlify receiver.** The
  stopgap makes the cost problem worse, and 100% of its work is thrown away.
- **Zapier probably can't be cancelled** (CF has no API — it's Zapier-only), but it can be
  demoted to a **1-task relay**, which should end the $50/mo overage. See §3.

---

## §1 — Does a receiver already exist? (CONFIRMED: no)

Nothing. The repo is 18 files of static HTML/CSS/JS. No `package.json`, no `netlify.toml`, no
`_redirects`, no `functions/` or `api/` dir, no server-side code. `git log --all` has zero
commits mentioning netlify/webhook/zapier/serverless. Every page calls Airtable directly from
the browser with the same hardcoded PAT.

The entire CF→Airtable pipeline lives in Zapier, invisible to this repo. Building the receiver
means adding the **first** server-side code and the **first** build config to this project.

---

## §2 — RESOLVED: one webhook per visit, all line items in an array

Two Zap runs settle it.

### Run A — visit C14559 (Shemsa Morkoch, service 2026-09-16, created 2026-09-04)

Trigger `Jobs[]` = 5 line items:

| # | Job Type (raw from CF) | Amount |
|---|---|---|
| 1 | `Roof Blow Off` | 150.00 |
| 2 | `Residential Gutter Cleaning` | 265.00 |
| 3 | `Skylight Cleaning: Exterior` | 15.00 |
| 4 | `House Wash` | 340.00 |
| 5 | `BRONZE Window Cleaning:` | 441.00 |
| | **true total** | **1211.00** |

Airtable row `recXi6uzwf7vEl2bb`: `Job Type` = all five comma-joined, **`Job Revenue` = empty**.

### Run B — visit C19115 (Leo Abucayan, service 2026-09-10) — the one with a discount

Trigger `Jobs[]` = 3 line items:

| # | Job Type (raw from CF) | Amount |
|---|---|---|
| 1 | `Residential Gutter Cleaning` | 242.00 |
| 2 | `Disclaimer (Gutter Cleaning)` | 0.00 |
| 3 | `Discount` | **−22.00** |
| | **true net** | **220.00** |

Airtable row `recYRySv5a2JpHVGI`: `Job Type` =
`"Residential Gutter Cleaning,Disclaimer (Gutter Cleaning),Discount"`, **`Job Revenue` = 242**.

**→ The discount is not netted, not stored as its own row, and not summed. It is simply gone.**

### What Zapier is actually doing

Text field (`Job Type`) receives the array → **comma-joined**. Currency field (`Job Revenue`)
receives the array → **first element only**, or blank when the join is unparseable. So the
collapse silently discards every line item after the first, money included.

### Discount / disclaimer shape — ANSWERED

They are ordinary elements of the same `Jobs[]` array:
- **Discount** → `Job Type` = `"Discount"` (or `"Membership Discount"`), `Amount` **negative**.
- **Disclaimer** → `Job Type` = `"Disclaimer (Gutter Cleaning)"` etc., `Amount` `0.00`.

Both split out as their own rows exactly like a service line. No special handling needed
beyond "one row per array element".

### The two-Zap picture — RESOLVED

| | Trigger | Loop? | Behaviour |
|---|---|---|---|
| **Zap 1** | CF **"New Job"** (booking; fires days–weeks before service) | **removed** | single Create Record → **the collapse** |
| **Zap 2** | CF **"Job Completed"** (screenshot) | **present** — `Looping by Zapier: Create Loop From Line Items` → Find Record → Paths → Update / Find+Create | per-line upsert, **correct** |

So the "one webhook per line item" belief came from looking at Zap 2, which loops. Zap 1 is the
broken one. Zap 2 is also the expensive one — a 3-line visit costs roughly loop + 3×(find +
path + create/update) ≈ **7 tasks**, versus 1 for Zap 1.

### Other facts nailed down

- **`Commission Rate` and `Hourly Rate` are Airtable `multipleLookupValues`** (computed from the
  linked Employee records) — the Zap does **not** write them. C14559 `[0.29, 0.27]`,
  C19115 `[0.29, 0.23]`. **Per-tech, not per-service.** The receiver doesn't need to supply them.
- `Number of Techs`, `Gross Hours`, `Net Hours`, `Rev Per Hour`, `Calculated Commission` are all
  **formula fields** — also not the receiver's job.
- **`Job Number` is one-per-visit** (`C14559`), no letter suffix. The old `…A/B/C` suffixes were
  synthesised by an older loop, not by CF.
- **`Assigned To` is per line item** (same across lines in both samples, but structurally per-line).
- Times are **visit-level** (`Start Time` / `End Time`); `Duration` is 0 per line.
- The trigger payload **does** carry a full `customer` object (id, name, address, email, phone,
  category) — `Customer Name` is derived from `Customer Fullname`, not a lookup step.

---

## §2b — What is actually in Airtable right now (measured, read-only)

`Jobs` table, 651 rows:

| Metric | Value |
|---|---|
| Rows total | **651** |
| Collapsed combo rows (comma in `Job Type`) | **160** |
| Correct single-service rows | 491 |
| Combo-row `Job Date` range | 2026-07-10 → **2027-05-17** |
| Visits where the combo row is the **only** row (**real data loss**) | **157** |
| Visits where a combo row coexists with correct split rows (duplicate) | 2 |
| Combo rows with **empty** `Job Revenue` | 14 |
| Combo rows with **first-line-item-only** `Job Revenue` | 146 |
| Combo rows containing a **`Discount`** segment (money lost) | **110** |
| Combo rows with `Comm Start` filled (tech already submitted) | **3** |
| Combo rows linked to a Pay Period | 160 / 160 |
| **Combo rows inside an already-calculated pay period** | **0** |
| Pay Periods total / with a calculated Payroll record | 72 / **2** |

**The single most important number is the 0.** No payroll has been run over any collapsed row.
Nobody has been underpaid yet. This is a clean-up-before-go-live problem, not a
money-already-out-the-door problem.

### `Job Type` is a `singleSelect` — and it's been polluted

Airtable schema confirms `Job Type :: singleSelect`. Zapier writes with typecast, so **every one
of the 160 comma-joined strings was auto-created as a new dropdown option.** The field's option
list is now ~160 junk entries deep.

⚠️ **Consequence for any repair script:** the PAT **cannot create new singleSelect options**
(known limitation). A repair can only assign values that already exist as options. Every
individual service name we'd need does already exist, so a repair is feasible — but the junk
options themselves need an Airtable admin to delete by hand.

### Naming chaos is much worse than the multiplier work assumed

87 distinct service strings once combo values are split on commas. Only ~17 match the app's
`JOB_TYPE_MAP`. Highlights:

| String | Rows | Matches app? |
|---|---|---|
| `GOLD Window Cleaning` | 227 | ✅ |
| `Residential Gutter Cleaning` | 145 | ✅ (+OSHA) |
| `Discount` | 137 | n/a (excluded by design) |
| **`BRONZE Window Cleaning:`** (trailing colon) | **66** | ❌ **no checklist, no match** |
| `BRONZE Window Cleaning` (clean) | 19 | ✅ |
| `Disclaimer (Gutter Cleaning)` / `(Window Cleaning)` | 24 / 16 | ❌ |
| `Xmas 1st Floor Roof Line` etc. (Christmas lights, ~10 variants) | 17+ | ❌ |
| `Membership Discount` | 15 | ❌ |
| `Concrete Cleaning` (+3 `Concrete Cleaning: …` variants) | 14 | ❌ |
| `Roof Blow Off` / `blow off roof` | 13 / 4 | ❌ (same service, two spellings) |
| `Commercial WC: Interior & Exterior` / `- Int & Ext` / `- Interior & Exterior` | 8 / 2 / 1 | ❌ (three spellings) |
| `cobwebbing` / `Cobwebbing` / `cobbwebbing` | 1 / 2 / 2 | ❌ (three spellings, one typo) |

Plus a long tail of CF free-text: `Residential Gutter Cleaning; Main house`,
`Residential Gutter Cleaning: Dettached Garage` (sic), `GOLD Window Cleaning - Specific windows only`,
`Skylights : Exterior Only`, `Clean ceiling fan`, `exterior sign`, `Travel Fee`…

### 🔴 This changes the multiplier feature's premise

The three job types Bill scoped barely exist in the data, and the real-world names differ:

| Bill's target | Rows in Airtable | Nearby real strings |
|---|---|---|
| `Partial Roof Cleaning` | **13** | — |
| `Gutter Sticks` | **1** | `gutter guards` (4), `Gutter Guard Removal` (1) |
| `Slimguard Gutter Protection` | **2** | `Repair/Replace Slimguards` (1) |

As specced, the multiplier would apply to ~16 rows out of 651 and would miss `gutter guards`
entirely. **Bill needs to confirm which real strings count as each category** before that
feature is worth shipping.

---

## §3 — Recommendation

### Go straight to the Netlify receiver. Skip the Zapier stopgap.

The earlier plan was "re-add the Zapier loop now, migrate later." The measurements kill it:

1. **No urgency.** 0 collapsed rows in a calculated pay period; client not live; go-live
   deferred to next pay period. Nothing is bleeding.
2. **The stopgap makes the cost problem worse.** You're already ~$50/mo over plan. Re-adding a
   loop to Zap 1 multiplies its task count by N-per-visit, on top of Zap 2's ~7-per-visit.
3. **100% throwaway.** The stopgap's real work — line splitting, Job Type normalization, upsert
   keys — is exactly what the receiver does, rebuilt in a worse language (Zapier Formatter steps).
4. **The 160 bad rows need a repair pass either way**, and the repair is easier once the
   receiver has defined the canonical row shape.

### Architecture — Zapier becomes a dumb relay

CF has no API and is reachable only through Zapier, so the receiver can't be fed by CF directly
unless CF supports a generic webhook URL (**open question 2**). The safe design that works
either way:

```
CF "New Job"       ─┐
CF "Job Completed" ─┴─►  Zapier: 1 × "Webhooks by Zapier → POST"  ──►  Netlify Function
                                    (raw payload, no logic)              (all logic + Airtable writes)
```

- **Task cost: 1 per visit per Zap** (2 total), down from 1 + ~7. That's roughly a **4–5×
  reduction** and should drop MWC back under the plan limit — the $50 overage likely disappears.
  Zapier can be downgraded rather than cancelled.
- If CF *does* support native webhooks, drop Zapier entirely and point CF at the function.
- **Netlify free tier is fine**: `netlify.toml` is not a paid feature, and Functions include
  125k invocations + 100h runtime/month. MWC's volume is a rounding error. No upgrade needed.
- Read the Airtable PAT from a **Netlify env var**, not a literal. (The browser app keeps its
  hardcoded PAT — out of scope here, but don't reproduce it server-side.)

### What the function does

1. Accept the CF payload; read `Jobs[]` (wrap a bare object in `[]` defensively).
2. For each element, emit **one Airtable Jobs row**:

| Field | Value |
|---|---|
| `Customer Name` | from `Customer Fullname` (same on every row) |
| `Job Date` | parsed from `Service Dates` |
| `Job Type` | that line's type, **normalized** to the canonical vocabulary |
| `Job Revenue` | **that line's own `Amount`** — including `0.00` disclaimers and **negative** discounts |
| `Employee` | that line's `Assigned To` names → Employee record ids |
| `Job Number` | CF visit id (`C19115`), same on every row |
| `Job Key` | `{Job Number}\|{Job Date}\|{normalized Job Type}` — the upsert key |
| `Pay Period` | resolved by `Job Date` |
| `Commission Rate`, `Hourly Rate`, `Number of Techs`, `Gross/Net Hours`, `Calculated Commission`, `Rev Per Hour` | **do not write** — lookups/formulas, Airtable computes them |
| `Comm Start/End`, `Hrly *`, OSHA *, `Checklist *` | **leave empty** — the tech app owns these |

3. **Upsert on `Job Key`** (query → PATCH or POST). This makes the "New Job" and "Job Completed"
   events idempotent against each other and collapses both Zaps into one code path — a completed
   job simply updates the rows the booking created.
4. **Normalize `Job Type`** through an explicit map: strip trailing `:`/whitespace, fold
   `"Skylight Cleaning: Exterior"` → `Skylight Cleaning`, `"blow off roof"` → `Roof Blow Off`,
   the three `Commercial WC` spellings → one, etc. Anything unmapped → pass through **and log
   it**, so new CF free-text surfaces instead of silently breaking a checklist.

### Job Number — don't reinstate letter suffixes

Nothing in the codebase reads `Job Number` for logic (payroll groups by `Job Date`; the jobs app
dedups on `Customer Name + Job Date + Job Type` and blanks the Job Number banner; compliance,
manager and reviews never touch it). Keep `Job Number` = CF's visit id for human
cross-reference, and let **`Job Key`** be the machine key. Suffixes add nothing.

### Repairing the 160 collapsed rows

Now genuinely tractable, because **Zapier's task history holds the original payloads** and,
better, **CF still holds the truth** — but only reachable via Zapier.

- **Best option:** in Zapier, replay / re-run the "New Job" (or "Job Completed") event for the
  affected visits through the new receiver. Each replay rewrites the visit as correct split rows
  keyed by `Job Key`. Needs the visits' CF job ids — we have all 160 `Job Number`s.
- **Fallback:** delete the 160 combo rows and let the "Job Completed" event re-create them
  correctly as each job is actually completed. Viable precisely because **0 are in a calculated
  pay period** and only 3 have tech data (those 3 need hand-checking first).
- **Not viable:** reconstructing per-line amounts from the stored data. The line breakdown was
  never written — only the first amount survives.
- **Separately:** an Airtable admin should delete the ~160 junk `Job Type` select options once
  the rows are gone. A PAT-based script cannot do this.

### Cutover

1. Build the function; unit-test the split against the two saved payloads (C14559 multi-service,
   C19115 with discount + disclaimer).
2. Deploy; point a Zapier POST step at it writing to a **scratch Airtable table**; replay a
   handful of real visits and diff against the expected shape.
3. Flip to the real Jobs table; disable Zap 1's Create Record and Zap 2's loop/paths branch.
4. Repair the 160 (replay or delete-and-let-recreate).
5. Have the Airtable admin purge the junk select options.
6. Watch one pay period, then downgrade the Zapier plan.

---

## §4 — Impact map (why a collapsed row breaks everything)

A combo row = one Jobs record, `Job Type` = `"A,B,C,…"` (comma-joined, sometimes trailing `:`),
`Job Revenue` = first line item only or empty, discounts silently dropped, empty `Comm Start`.

| # | Location | What it assumes | How it breaks on a combo row | Severity |
|---|---|---|---|---|
| 1 | `payroll/payroll.js:605` STEP 8 commission | one service per row; `Job Revenue` is that service's revenue | commission is computed on the **first line item's amount** (or 0), not the visit. C14559: $0 instead of $1,211. C19115: $242 instead of $220. Discounts on 110 rows never reduce anything. | **Critical** |
| 2 | `payroll/payroll.js` multiplier lookup (once shipped) | exact `Job Type` string | combo string never matches → any visit containing a multiplier service silently gets **no multiplier**. | **High** |
| 3 | `payroll/payroll.js:376-381` `filterJobs` (needs `Comm Start`/`Hrly Start`) | tech-app submission stamps a time | CF rows arrive with empty `Comm Start`; only 3 of 160 have one. Unsubmitted visits are **excluded from payroll entirely**. | **High** |
| 4 | `payroll/payroll.js:520` STEP 2 `dayRevenue` | per-service revenue | contributes the wrong single amount as the day's revenue. | Low |
| 5 | `compliance/index.html:321-323` OSHA check — `OSHA_REQUIRED_JOB_TYPES.has(jobType)` | exact `Job Type` | a visit whose combo string *contains* Residential Gutter Cleaning / Roof Cleaning / Skylight Cleaning is **not** matched → **drops off the OSHA compliance report**. Safety/legal reporting gap. | **High** |
| 6 | `compliance/index.html:315-318` relevant-jobs filter | discount is its own row | a discount folded into the combo string isn't excluded; the row shows an unreadable Job Type. | Low |
| 7 | `jobs/index.html:786-804,1236` `JOB_TYPE_MAP[jobType]` | exact `Job Type` | `undefined` → `\|\| []` → tech sees **only Arrival + Departure**, none of the House Wash / Window / Gutter / Roof sections. Also hits the 66 clean rows typed `BRONZE Window Cleaning:`. | **High** |
| 8 | `jobs/index.html:807-818` `isOshaRequired()` | exact `Job Type` | no match → **OSHA hazard-assessment step skipped** for the tech even on gutter/roof work. | **High** |
| 9 | `jobs/index.html:1160-1172` `findExistingJobForRecurring` — `{Job Type}='<exact>'` | exact `Job Type` | never matches a collapsed row → a recurring pick can create a second row alongside it. | Low |
| 10 | `jobs/index.html` banners/pickers (`:942,:972,:1051,:1296,:1311`) | one type per row | techs see the raw comma-joined string; an embedded discount isn't filtered out. | Low |
| 11 | `manager/index.html:169` attendance | — | combo row still has an `Employee`; unaffected. | None |
| 12 | `reviews/index.html` | — | doesn't touch Jobs. | None |
| 13 | Airtable `Job Type` singleSelect option list | curated dropdown | ~160 junk options auto-created by Zapier typecast; makes the field unusable as a picker and pollutes every audit. | Medium |

**Common thread:** every failure is **silent** — no error, no empty state, just wrong money or
missing rows.

---

## Open questions

1. **Zap step configs** — screenshots of Zap 1's "Create Record" field mapping, and Zap 2's
   step 3 "Find Record" (which field does it match on?) and step 9 "Create Record". Needed so
   the receiver reproduces the mapping exactly rather than guessing.
2. **Can CF POST to an arbitrary webhook URL?** (CF settings, or ask CF support.) Decides
   whether Zapier is dropped entirely or kept as a 1-task relay.
3. **Zapier plan + current monthly task usage** (screenshot of the usage page) — to confirm the
   relay drops you back under the limit.
4. **Go-live date / which pay period** the client starts on — that's the deadline for the repair.
5. **Canonical Job Type map** — I can draft one from the 87 observed strings, but Bill has to
   approve the folds (is `Roof Blow Off` its own service or part of gutter cleaning? do the
   `Xmas *` variants collapse? is `gutter guards` = `Gutter Sticks`?).
6. **Multiplier scope** — given `Gutter Sticks` = 1 row and `gutter guards` = 4, which real
   strings does Bill actually mean? (Blocks the multiplier feature independently.)
7. **Airtable write authority** for the repair — the repo PAT can write rows but **cannot**
   create singleSelect options, and can't delete the junk ones. Who does that cleanup?

---

## CONFIRMED vs INFERRED

**CONFIRMED — from the repo:**
- No receiver/function/build config anywhere; sync is entirely external.
- All `Job Type` consumers use exact-string / Set matching (line numbers in §4).
- Nothing reads `Job Number` for logic.
- `filterJobs` requires `Comm Start`/`Hrly Start`, so unsubmitted CF rows never reach payroll.

**CONFIRMED — from the two Zap runs:**
- One webhook per visit, all line items in an indexed `Jobs[]` array.
- `Job Type` comma-joins; `Job Revenue` takes only the first element (or blanks).
- Discounts are negative-`Amount` array elements; disclaimers are `0.00` elements.
- Zap 1 ("New Job") has no loop and does the damage; Zap 2 ("Job Completed") loops and upserts.
- Rates are per-tech Airtable lookups, not written by the Zap.

**CONFIRMED — from read-only Airtable queries (2026-09-08):**
- 651 rows, 160 collapsed, 157 of them the only row for their visit.
- 110 collapsed rows contain a lost `Discount`; 14 have no revenue at all.
- **0 collapsed rows sit in a pay period that has been paid.** Only 3 have tech submissions.
- `Job Type` is a `singleSelect` polluted with ~160 auto-created junk options.
- 87 distinct service strings; `BRONZE Window Cleaning:` (66) ≠ `BRONZE Window Cleaning` (19).
- `Gutter Sticks` = 1 row, `Slimguard Gutter Protection` = 2, `Partial Roof Cleaning` = 13.

**INFERRED / reported, not verified by me:**
- CF stores line items correctly (verified in CF UI by Mikael).
- The loop was removed from Zap 1 to save task credits.
- Netlify free tier hosts the site; ~$50/mo Zapier overage.
- CF is reachable only via Zapier (no API) — needs confirming for the relay decision.
