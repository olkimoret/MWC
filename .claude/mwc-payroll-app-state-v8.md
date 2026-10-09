# Project State — Master's Window Cleaning (MWC)

**Version:** 8 — standalone. Merges everything still relevant from v6, v7 and the earlier v4 (whose engagement overview, decisions and multiplier design v6/v7 only referenced), plus the 2026-10-08 diagnostics and the crew-picker / time-picker session. v6 and v7 can be deleted.
**Last updated:** 2026-10-08

---

## Status at a glance

**Where it stands.** Payroll logic is done and matches Bill's spreadsheet for 9/9–9/23 within explained differences (Driver/Helper split, commission multipliers with discount netting, per-tech commission rate, whole-day commission-hours span). On 2026-10-08 the job form was changed so one tech (usually the driver) can enter a job for the whole crew without anyone being silently removed, and so commission times can only be picked from 6:00 AM to 8:00 PM. **That form change is built and tested but NOT committed or deployed** — it sits in the working tree for review (see "What's needed next").

**Next deadline.** The 9/24–10/8 pay period closes 2026-10-08. It is the first with the full crew on the app and the first with the hours fix. Project closes by **2026-09-30 per the original plan — already past**; the open items below are what remains.

**Blocked on.** Nothing technical. The 9/24–10/8 data has gaps and time errors that Mikael has to fix in Airtable before comparing with Bill's sheet (see "9/24–10/8 data check").

| Session | Items | Status |
|---|---|---|
| A | Back-dating capability check | Done (9/16) |
| B | Backfill 9/9–9/14 | Obsolete — replaced by Session R's manual corrections and times import |
| C | PTO capture | Done (9/16), table created by hand, verified live |
| D | Driver/Helper split + commission multiplier (merged) | Done (9/28), verified live |
| R | Reconcile 9/9–9/23 Airtable vs Bill's sheet | Done (10/8) |
| Hours fix | `payroll.js` one commission span per tech per day | Done and deployed (10/8) |
| Crew + time pickers | `jobs/index.html`, `timepicker.js`, `employees.js` | **Built and tested 10/8, not committed/deployed** |
| E | Zapier Find Record optimization | Optional, not started |
| F | Client handoff document | To write; Bill comparison done for 9/9–9/23 |

**Effort.** Claude Code cannot measure elapsed time. **No actual hours are logged for any session** (9/8, 9/14, 9/16, 9/24, 9/28, Session R, the hours fix, or this one). Mikael must log them from his own clock. This session's estimate was 4–6h; actual: **not logged**.

---

## Engagement overview

- **Client:** Master's Window Cleaning (MWC). Owner/contact: Bill (Billy) Roschmann.
- **What Noobia built and maintains:** a mobile-first, password-gated web app on Netlify for MWC's field techs and Bill, backed by Airtable (base `appVXuyAYj47nZwyz`), fed from Customer Factor (CF) via Zapier. Netlify auto-deploys on push to `main`; there is no deploy config in the repo. Pages: jobs (tech submission), pto (tech submission), payroll (manager), compliance/OSHA (manager), reviews (manager), manager.
- **Ongoing maintenance relationship** with multiple contracts. Mikael wants this closed to move to the next engagement (a website, possibly digital marketing). The contract/budget for this work has never been surfaced in project files; it ran as unscoped maintenance.
- **Rate position (internal, never shown to Bill):** this project runs **below Noobia's hourly floor**, accepted as a deliberate loss-leader against the website and marketing work. Operating rule: anything not on the critical path to "Bill runs payroll and it works" gets cut or moved to the next contract.
- **Goal:** a working app, Bill successfully running payroll from it, hand over, close. Quality over speed — the outcome Mikael wants is a Bill who recommends the work to his network.
- **Parallel-run approach (set 9/14):** for 9/9–9/23 Bill kept filling his own spreadsheet while the app was used; the payroll page was then compared with his sheet. Honest framing: the days Mikael backfilled from Bill's sheet match because they were copied from it; days techs entered themselves are the real proof.

---

## Decisions log

**2026-10-08 (this session)**
- **One crew, entered once.** Whoever enters a job picks everyone who was present; the same crew is written to `Employee` on every row of the visit. Nobody is removed without an explicit confirm. No "only drivers may submit" rule — who enters is a crew policy Bill will set, not an app rule.
- **Crew and date are written at submit, not at the crew step**, so abandoning the form never leaves a half-applied crew change in Airtable.
- **Commission times: bounded list picker, 6:00 AM–8:00 PM, 5-minute steps, AM/PM labelled.** End must be after Start (blocks). Start before 7:00 AM or End after 6:00 PM only asks "is the time correct?" (does not block). Times are stored on the visit's Job Date, not the day of entry.
- Hourly time entry, per-person times and per-job role overrides remain out of scope.

**2026-09-29 → 10-08**
- **Hours must match Bill's spreadsheet:** one span per tech per day, first start to last end, gaps (drive time) included. Hourly is only used for the minimum-wage check and CA overtime; hourly entry stays out of scope.
- **Partial Roof: 90% on the whole amount from now on** (Bill). His past carve-outs of gutter work inside the roof line ($257, $135, $243, $335 in 9/9–9/23) are the old method; he won't book them as separate lines.
- **Splits follow the Driver/Helper rule.** Bill's 9/9 Matthew 60% was his error, fixed. His equal splits and the Barbara Knox / Erin Zuccaro figures are his errors — to be pointed out, not copied.
- **Susan Ishimaru $60** is a membership discount in TCF that never synced to Airtable.
- **Lunch:** techs often skip it and Bill doesn't mind. The form's Lunch toggle default stays; low priority. (Bill to be asked, framed as a question, whether skipped lunches are OK under CA rules with his payroll provider.)
- **Airtable doesn't need to mirror TCF exactly** (reschedules, $0 visits don't matter), but anyone who worked must have the exact who, when and how long.
- Hrly Start/End issue dropped.
- **Session R rules:** never change Job Revenue from Bill's sheet (TCF is the source); app-entered times are evidence and were not overwritten (one exception, Emily Randall 1712); other techs were out of scope.

**2026-09-24 (Bill, via Mikael)**
- **Driver/Helper revenue split, "Option A":** a job's revenue is divided among its techs by weight — Driver 1.5, Helper 1.0 — and each tech's own commission rate is applied to their share (the rate is never split). No Driver on the job → equal split falls out of the weights. An employee with no Crew Role is treated as Helper and named in a warning banner on the payroll page.
- **Multiplier job types confirmed:** Partial Roof Cleaning 0.90; Gutter Sticks 0.50; Slimguard Gutter Protection 0.50; `gutter guards` (lowercase, as CF stores it) 0.50. "Ask Bill about gutter guards" is resolved.

**2026-09-16**
- Pay Period for PTO is resolved client-side (no new Zap — the Zapier task budget is already tight).
- `employees.js` extracted as a shared module (the job form now uses it too, as of 10/8).
- PTO's `Employee` and `Pay Period` are link fields, so a name or period can't drift by typo.
- The PAT can't create tables (schema read-only), so Mikael created the `PTO` table by hand.
- The v3 plan to constrain the PTO date picker to one pay period was superseded: Pay Period is derived from the date, and the picker accepts past and future dates.

**2026-09-14**
- **PTO ships as Option B, capture-only:** `PTO` table, tech entry screen, PTO Days and YTD PTO columns on the payroll page. No pay calculation, OT interaction, accrual, balance or approval. Model confirmed from Bill's workbook: checkbox per calendar day, 8 hours per checked day, totalled per employee per period. Option A (full integration) is deferred.
- **Zap 2 stays off permanently for this project** (two known bugs; accepted gap: a CF job edited between booking and completion doesn't update Airtable).
- **Tips are out of scope** (Bill enters them himself; not a tech workflow).
- **Zapier budget is a Bill decision, not a build task.** The Aug 15–Sep 15 cycle closed at 576/750; the restored loop raised the rate and the next cycle was projected over (~990). Tell Bill before the cycle closes.
- The discount model: **netting** (see multiplier design below) is the confirmed behaviour; an earlier note had it backwards.

**2026-09-08 (carried forward)**
- Patch over rebuild: restore the Zapier loop and normalize on read, rather than the Netlify-receiver rebuild (shelved as a future paid upgrade; the patch produces the same Airtable row shape, so nothing is wasted).
- CF fires one webhook per visit (batched line items); Zap 1 ("New Job", booking) needed its loop restored.
- `Job Type` select stays open to new values — deliberately, so the sync never errors on an unmapped service.
- Pre-9/9 history was purged rather than repaired (backed up to CSV first).
- OT on commission is paid at 1.5× total (CA law): `regComm` already includes 1× for OT hours, so only the 0.5× premium is added.
- Job type naming: "Gutter Stick" → `Gutter Sticks`; "Slimguards" → `Slimguard Gutter Protection`.

---

## How payroll is calculated (current source of truth: `payroll/payroll.js`)

**Hours (per tech, per day).** `commSpanForDay`: collect every job row with both Comm Start and Comm End; exclude a row (and `console.warn` it — employee, date, customer, times) if End is not after Start, or Start is before 05:00, or End is after 21:00 (likely AM/PM typo); hours = latest valid End − earliest valid Start. Overlaps and duplicate line items count once; gaps count. Times are read as UTC time-of-day (the Airtable fields are UTC-zoned and the form writes wall-clock time straight in). **Lunch:** the largest positive `Lunch` among the day's jobs, subtracted once; otherwise 0.5 h when gross hours ≥ 9. Lunch affects net hours (overtime), not gross hours. Hourly (Hrly Start/End) handling is unchanged.

**Overtime.** Daily OT over 8 net hours (commission + hourly lumped); weekly OT over 40 (Monday start); total OT = max of the two. OT premium on commission = (regComm ÷ commission hours) × 0.5 × OT hours. Safety net: if average hourly commission < $17, wages = $17 × regular hours + $17 × 1.5 × OT hours + hourly pay.

**Revenue split.** `CREW_ROLE_WEIGHTS = { Driver: 1.5, Helper: 1.0 }`; `revenueShare(employeeIds, employeeId, roleMap)` is the single place revenue is divided (used in commission and the dead `dayRevenue`). Examples: 1 Driver + 1 Helper → 60/40; 2 Drivers + 1 Helper → 37.5 / 37.5 / 25. Each tech's own rate comes from `rateForEmployee(job, employeeId)`, which indexes the `Commission Rate` lookup array by the employee's position in the `Employee` field. **This depends on the lookup staying aligned with `Employee` order — verified 10/8 (see below).**

**Multipliers and discount netting** (settled by Bill, 2026-09-09 / 09-24):
1. Net the discount first, then apply the multiplier, then the commission rate: ($200 − $25) × 0.5 × 0.23 = $20.13.
2. A flat-dollar discount splits equally across the visit's multiplier lines.
3. Percentage discounts need no handling (CF converts them to dollars before they reach Airtable).
4. Netting applies only to multiplier job types; for every other type a discount stays its own negative-revenue commission line.
5. Visit key = same Job Date + same Customer Name. Discounts are identified by negative `Job Revenue`, not by name. A discount already netted into a multiplier line is not counted again.
6. Job Type is compared through `job-types.js`'s `normalizeJobType`, so casing/punctuation drift still matches.
7. Interpretation call: the divisor counts multiplier-type lines only. Every real visit in 9/9–9/23 had exactly one, so no number moved; flag if a visit ever mixes multiplier and non-multiplier lines with a discount.
8. Known limitation (not solved by design): netting is computed from `jobs` already filtered to one employee, so a discount recorded against different employees than its multiplier job would be invisible. Not observed in real data.

**Rate-array bug (found and fixed in Session D).** The old code took the first positive number in `Commission Rate` regardless of whose payroll was being run, so on any shared job every tech except the first-listed was paid at the first tech's rate. Predates Session D; **not retroactively corrected for past pay periods**.

**Session D tests (6/6 pass, hand-computed):** $100 job Driver@29% + Helper@23% → $17.40 / $9.20; 2 Drivers + 1 Helper → $10.875 each driver, $5.75 helper; solo unchanged; two-tech job with a $20 non-multiplier discount splits 60/40; $200 Gutter Sticks + $25 discount (Driver@29%, Helper@23%) → $15.225 / $8.05 with the discount not double-counted; employee with no Crew Role treated as Helper with the banner. Live check: Larrell Jacobs' 9/9–9/23 run produced $664.68 (at that time) matching the offline replica; one live Payroll record was written for it. Before/after for the six employees with commission data then, and the decomposition into "rate-bug fix" vs "new policy", were reported in the 9/28 session; the rate-bug fix is the part of any gap against Bill's sheet that closes for reasons unrelated to the split rule.

---

## Session R — 9/9–9/23 reconciliation (done 2026-10-08)

Method: read-only report first, then manual corrections by Mikael checked against TCF, then a CSV import of times, each step verified against a fresh export.

**Airtable changes (all manual by Mikael, verified by export diff):**
- Crew corrected to match TCF on the 7 app visits (Anita Swanson, Susan Ishimaru, Erin Zuccaro, Barbara Relles, Lora Gallegos, Christine Fore-Pemstein, Emily Randall) and on Barbara Knox, Jane San Juan, Jennifer Nichols, Dolores Boughton, Linda Reed, Wendy Ziegler, Justin Brooks, Caitlin Evenson, Alaina Niebuhr, Jenny Hwang, Devon Brown, DFS Flooring, Bonnie Bjorgum. Doug & Cheryl Jensen: all four lines (1628–1631) set to Larrell, Kameron, Matthew.
- Rows added from TCF (missing from Airtable): Bullard Construction (2027), Veronica Cervantes (2019–2021), Michelle Akins −$25 discount (2022), The Old Spaghetti Factory (2025), Campus Commons Medical Dental (2026).
- Rows corrected from TCF: Heather Edling $420 SILVER → $504 GOLD; Shemsa Morkoch moved 9/16 → 9/23; Ken Sanchez → $249; Maryel Olson → $0; Soyeon Lee Employee cleared (rescheduled).
- Rows deleted (cancelled / not in TCF): Lauren Carleson, Roland Palvolgyi, Arthur Amezcua's three extra lines (only 1727 kept).
- Times: 64 rows for Malachi and Larrell filled from Bill's day spans (one span per tech per day, applied to every row that day) via Airtable CSV Import merged on a temporary text copy of RecordID, deleted afterwards. This replaced earlier TCF scheduled times on 16 rows. Only app-row change: Emily Randall (1712) 01:45–02:20 → 13:45–14:20, confirmed by Larrell. Mikael to confirm the full Jobs backup export taken before the import is retained.

**Result: payroll page (after the hours fix) vs Bill's TimeCard**

| | Payroll page | Bill's TimeCard | Difference | Explained by |
|---|---|---|---|---|
| Larrell commission | $2,277.80 (75.3 h × $30.24) | $2,270.72 | +$7 | 29% of +$24 revenue: Bill's splits on Jensen, Erin Zuccaro, Barbara Knox, minus the Partial Roof carve-outs |
| Malachi commission | $1,725.97 (59.6 h × $28.96) | $1,692.63 | +$33 | 29% of +$115 revenue: Bill's equal splits on DFS Flooring (+$86) and Megan Lyons (+$29) |
| Larrell commission hours | 75.3 h | 75.6 h | ~0 | — |
| Malachi hours | 59.6 h total | 46.5 h commission + 15.9 h hourly = 62.4 h | by design | Bill classes some time as hourly; hourly is out of scope |

Page totals including OT premium: Larrell $2,285.35, Malachi $1,744.07. The three app-entered days that still differ from Bill's day times (Malachi 9/15, Larrell 9/16, Larrell 9/21) are the techs' own entries and stay as findings.

**Revenue gap that closed on deploy.** Before the 10/8 deploy the page's commission implied a lower revenue base than the repo code produced on the same data (about $7,157 vs $7,854 for Larrell). After deploying it matched exactly. Most likely the deployed page was behind the repo; not confirmed. Worth checking that future deploys always come from `main`.

---

## The hours bug (found and fixed 2026-10-08)

Old code (`payroll.js` lines 639–653) counted only the earliest job's Comm Start–End per tech per day, so separate later visits were dropped (Larrell 9/16 −1.67 h, Malachi 9/15 −2.75 h) and would have undercounted almost every day once the full crew used the app. Diagnosed read-only (the real `computePayroll` run against `Jobs-Grid view (16).csv` reproduced the page's 72.67 h / 55.43 h exactly), fixed to the span rule above, committed as `6fc251c` (which also carried the previously uncommitted Session D work) and deployed. Tests 12/12: overlap 6.00 h, duplicates 8.75 h, gap 7.00 h, overlap 3.00 h, typo row excluded, reversed row excluded, real-data days and totals (75.33 h / 59.60 h), revenue unchanged. Side effects (intended): more OT on long multi-visit days, the safety net uses larger hours, average hourly commission drops slightly.

---

## 2026-10-08 diagnostic: how the old job form handled two techs on one job

(Read-only, from `jobs/index.html` as it stood before this session's change.)
- **Submit** PATCHed every Jobs row of the selected customer on that date with the same field set, whoever the row's `Employee` was. `Employee` was not in that set, so a normal submit left it alone.
- **Employee was only rewritten in the "Confirm" step**, which appeared when the submitting tech wasn't on every row or the date differed. It pre-checked **only the current user** and replaced `Employee` with the checked list. A second tech opening a job that listed only the first tech replaced the first tech unless they also ticked them. Of 32 logged Employee corrections in 9/24–10/8, 31 removed someone (examples: Alan Wackman 9/25 "Larrell Jacobs, Kameron Talbert → Elijah Hale"; Tianna Williams 10/6 Matthew Pieruccini dropped).
- **Times, lunch, checklist, incident and OSHA (when required) were last-writer-wins.** `Lunch` was always written (0 or 0.5), so a teammate leaving the toggle off turned the first tech's 0.5 into 0. No warning that a teammate had already submitted, and no time validation.
- In the 9/24–10/8 export, 110 of 206 rows list more than one person (58 shared visits, 40 with times). 104 of 105 visits had identical crew/times across lines (consistent with last-writer-wins, but the export has no history, so overwrites can't be proven).
- Some rows stored times on a different date than Job Date (Tianna Williams: Job Date 9/29, times on 10/6; Anthony Garilli: Job Date 9/30, times on 10/1) — the form used the date picked at the top of the form for the times, not the job's date.

---

## 9/24–10/8 data check (read-only, from the 10/8 16:14 export)

Anything entered after that export is not included. 206 rows.
- No rows without an Employee. No employee name missing from the Employees table. Every active employee who appears has a Crew Role.
- **Per active field employee — days with Comm Start / days with any row; rows without Comm Start:** Malachi 5/11, 38 of 58 · Dorian 4/10, 27 of 43 · Elijah 9/9, 7 of 41 · Kameron 8/8, 3 of 41 · Geo 10/11, 10 of 40 · Larrell 7/8, 7 of 36 · Martin 4/4, 0 of 7 · Matthew 10/10, 3 of 47. Malachi's and Dorian's hours are thin.
- **Rows the payroll page will exclude or warn on** (each skipped for hours unless another row for that person that day is valid): Alberto Russell 9/24 (1807, 1808; Kameron + Matthew; 00:15→13:20); Kevin Jones 9/29 (1814–1816; Malachi + Dorian; 10:15→00:45); Viviane Settje 9/29 (1850, 1851; Larrell + Elijah; 00:00→02:00); Miriam Lyons 9/28 (1511; Martin; ends 23:35); Coburn Ward 9/28 (1840, 1841; Kameron + Matthew; ends 23:40). Nicole Knell 9/25 (v7 flagged it) is already corrected to 08:00–12:00.
- **Date mismatches the page won't warn about** (hours still count; times sit on another date than Job Date): Tianna Williams row 1495, Anthony Garilli rows 1683 and 1684.
- 4 rows have Hrly Start but no Comm Start (not identified).
- Employees with no Crew Role: Brendon Fuller, Jon Glavin, Luke Brown, Vladislav Grinyuk, Mikael B — all inactive, none appear in the period. Josh Lassley is now set to Helper.
- Summary: usable once the five time-error visits are fixed and the Malachi/Dorian missing times are chased; check removed crew members against Bill's sheet (a dropped tech loses that visit's pay).

---

## Crew picker and time pickers (built and tested 2026-10-08, not committed)

**Files changed:** `jobs/index.html`, `timepicker.js`, `employees.js`. Not changed: `payroll/payroll.js`, `job-types.js`, the PTO screen, any Zap.

**Crew selection — how it works.**
- **One picker, not two.** The old "Confirm" step (`#step-confirm`, `#confirm-tech-list`) is now the crew step and is shown for every job. "Continue" always goes there (`goToStep2` → `populateCrewStep`); the old mismatch test and `saveConfirmChanges`/`jobsMismatch` are removed. The step keeps its Job Date field, so a wrong date can still be corrected.
- **Pre-selection:** everyone already in `Employee` on any row of the visit, plus the submitting tech. If the rows have different crews it pre-selects the union and says so on screen; if the submitter wasn't on the job it says "You were added".
- **Anyone on the job but outside the active-field-tech list** (an Admin, a since-deactivated tech) is still shown, ticked, named from an unfiltered one-off directory fetch (`MWCEmployees.loadEmployeeDirectory`), used only for naming. Verified with Danielle Hinrichs (Admin).
- **Removing someone:** any person can be unticked, including the submitter. An inline red warning ("[Name] will be removed from this job and will not be paid for it") appears as soon as someone who was on the job is unticked, and Continue then requires an explicit "Remove and continue" in a dialog. At least one person is required (Continue is disabled at zero).
- **Display:** each person shows their Crew Role (Driver / Helper) or "No role set". The picker list comes from the shared `employees.js` `loadFieldEmployees` (active, Role = Field Supervisor or Tech 1–4) — the same call the name picker now uses; the job form's inline copy of that filter is gone, completing the cleanup deferred since 9/16. `loadFieldEmployees` now also returns `crewRole`; the PTO page is unaffected.
- **Saving:** at submit, `Employee` is written on **every row of the visit** (same customer, same date) with the same crew, only where a row's crew differs; `Job Date` is written if corrected. Each row gets a `Correction Log` line `[timestamp] Employee: old → new` when the crew changes and `[timestamp] Entered by <name>: <times>, crew: <names>` always. Times, lunch, checklist, OSHA and photos are entered once for the whole crew, as before.
- **Already-entered guard.** If any row already has Comm Start, a dialog shows who entered it and when (read back from the `Entered by` log line — **entries made before this release have none, so it says "who entered them was not recorded"**), the stored times, lunch and checklist status, and offers "Edit this entry" (pre-fills times and lunch; the checklist is re-answered), "Replace with a new entry" (needs a second explicit "Yes, overwrite it"), or Cancel. Cancelling writes nothing. It reads the data as of when the job was opened, so two techs submitting at the same moment can still overwrite each other.

**Time pickers.**
- Commission Start/End use a new list mode in `timepicker.js` (`data-tp-list="true"`): 169 buttons from 6:00 AM to 8:00 PM in 5-minute steps, every one labelled with AM/PM; nothing outside the range exists to select. The hourly pickers keep the old drum picker, unchanged.
- **Bounds are defined once**, in `timepicker.js` as `window.MWC_TIME_BOUNDS` (`MIN_HOUR 6`, `MAX_HOUR 20`, `STEP_MIN 5`, `SOFT_START_HOUR 7`, `SOFT_END_HOUR 18`); the job form reads them. **Relation to payroll:** `payroll.js` excludes a commission row that starts before 05:00 or ends after 21:00. The picker range (06:00–20:00) sits inside that. `payroll.js` still hardcodes 5 and 21 (unchanged, as instructed), so `MWC_TIME_BOUNDS` carries mirror constants `PAYROLL_EXCLUDE_BEFORE_HOUR`/`_AFTER_HOUR` and logs a console error if the picker range ever falls outside them — if either side is edited, update both.
- **Validation (at "Safety Check", re-checked at submit):** both Commission Start and End required if either is set; times outside 6:00 AM–8:00 PM rejected (covers pre-existing values loaded by "Edit this entry"); End must be after Start or submit is blocked with "Commission End must be after Commission Start."; Start before 7:00 AM or End after 6:00 PM shows "This is outside normal hours, is the time correct?" with "Yes, the times are correct" / "Change the times" — it does not block.
- **Times are stored on the visit's Job Date** (the crew-step date), not the date at the top of the form or the day of entry. This also applies to the hourly times.

**Verified against the schema (read via the Airtable metadata API):**
- `Number of Techs` is a formula `IF({Employee}="", 1, LEN({Employee}) - LEN(SUBSTITUTE({Employee}, ",", "")) + 1)` — it counts commas in the `Employee` link field's text, so it counts Employee. It is never written. (Side effect: an employee name containing a comma would miscount; none exists.)
- `Commission Rate` is a `multipleLookupValues` through the `Employee` link. In the live test the API returned `Employee` as [Elijah, Larrell] (not the [Larrell, Elijah] order that was written) and `Commission Rate` as [0.23, 0.29] — aligned with the returned order, which is what `rateForEmployee` indexes. Alignment holds.
- `Comm Start`/`Comm End` are dateTime fields with timezone UTC, format 24-hour; `Job Date` is a date; `Correction Log` is single-line text (the code joins entries with newlines, as before).

**Zap 1 and Employee.** The Zap config isn't visible from the repo, so this is inferred from data: of 190 future-dated rows (10/9–10/31) in the 10/8 export, all carrying CF Job Numbers (i.e. created at booking), 183 already have an `Employee`. So booking does populate `Employee`; the crew picker pre-selects it. Zap was not changed.

**Test results (all against the real Airtable base and the real page in headless Edge; test rows dated 2026-06-02, a Tuesday, i.e. back-dated):** 23/23 checks passed in the main run, plus 3/3 in the follow-up "different crews" check.
- Solo job: only the submitter ticked, Number of Techs 1, saved normally.
- Driver enters for 1 driver + 1 helper (two rows): both people on `Employee` of both rows, Number of Techs 2 on both, `Commission Rate` aligned to Employee order. Real `computePayroll` on the saved rows: Larrell 60% / Elijah 40% of $150 at their own rates ($26.10 / $13.80).
- Two drivers + one helper: three on Employee, Number of Techs 3; payroll Kameron 37.5% ($9.38), Larrell 37.5% ($10.88), Matthew 25% ($5.75) of $100.
- Opening a job that lists two teammates: both pre-selected plus the submitter; unticking one shows the removal warning; "Go back" removes nothing; "Remove and continue" removes only then; zero selected disables Continue.
- Different crews on two rows plus an Admin: union (4 people) pre-selected, "different crews" and "You were added" notes shown, Admin shown with role.
- Second tech opening an entered visit: guard shown with who/when/times; Edit pre-fills 9:00 AM / 1:30 PM; Replace asks for a second confirm; Cancel wrote nothing.
- Picker: exactly 169 options, 6:00 AM first and 8:00 PM last, none before 6 AM or after 8 PM; end before start blocked; 6:30 AM / 7:00 PM shows the soft warning, "Change the times" returns, confirming submits; stored times `2026-06-02T06:30` and `T19:00`.
- No page errors in the browser console.

**Exactly what was written to Airtable and removed.** 9 `Jobs` rows created by a script (7 for the main run, 2 for the "different crews" check), all with Customer Name starting `ZZ TEST`, Job Date 2026-06-02; the form's own PATCHes then wrote crew, times, lunch, checklist and Correction Log onto those same rows. **All 9 were deleted afterwards and a follow-up query found 0 rows named `ZZ TEST` and 0 rows dated 2026-06-02.** No Employees, Payroll, PTO or other rows were written. Employees was read only.

**Not tested / limits.** The recurring-job "draft" path (creating a new Jobs row from the Recurring Jobs picker, which now carries crew, date and log on the POST) was changed but **not exercised end to end**. The Non-Commission hours screen is untouched. Edit mode doesn't pre-fill the checklist or safety toggles. The soft warning fires when leaving the hours step, not at final submit (the hard rules are re-checked at submit). The hourly pickers still accept any time.

---

## Findings for the feature list / handoff

**App**
- Crew was never captured from the field (a tech could pick only their own name) — addressed by the crew picker above, pending commit/deploy.
- Lunch is a toggle defaulting to off, so 0 can mean "didn't answer". One Lunch value per job, not per person.
- Old job form had no time validation (AM/PM typos seen: Emily Randall 01:45; Alberto Russell 00:15; Nicole Knell ending 00:00) — addressed for commission times; hourly times still unvalidated.
- One set of times per job: crew members can't have different times (Erin Zuccaro).
- The Job Form accepts back-dated entries with no restriction (Flatpickr with no min/max), so a tech who misses a day can catch up.

**Sync (TCF → Airtable, Zap 2 off).** Changes after booking never reach Airtable: crew changes, reschedules, added discounts, cancellations. Some jobs were missing entirely (including a recurring job). Check Zap 1 task history for why. **CF has no API** — reachable only through Zapier; any future move keeps Zapier as a thin relay unless CF adds native webhooks.

**Data**
- `Job Key` is not unique per line (several lines share one key; manual rows reuse keys). Never match on it. `Job Number` is one per visit (`C14559`).
- Rick Granados C18758 has identical lines on 9/18 and 9/23 (possible duplicate, unresolved).
- `Commission Rate`, `Hourly Rate` (lookups) and `Number of Techs`, `Gross Hours`, `Net Hours`, `Rev Per Hour`, `Calculated Commission` (formulas) are computed by Airtable, never written by the app or the Zap.
- Susan Boice C13663 shows $0.00 on both lines in CF; split as-is unless Bill corrects. Erin Zuccaro C19095: CF's three `Concrete Cleaning: Front/Driveway/Back` lines were folded to one `Concrete Cleaning` type (revenue $499/$299/$699 sums correctly) — confirm whether separately named services are wanted.
- The Airtable PAT can read the schema but cannot create tables or new select options on write. A copy of the PAT is embedded in the page sources (existing practice).

**Adoption (9/9–9/23):** Malachi entered 1 of 11 working days, Larrell 3 of 12. 9/24–10/8 is better for most techs; Malachi and Dorian remain low (see data check).

**Bill's workbook (tell Bill)**
- TimeCard 9.9–9.23: Malachi's "Total Commission" cell has no formula (shows $0); Larrell's "OT Pay" cell has no formula.
- TimeCard reads the monthly September tab, not the HoursComm tab, so there are two places he enters data.
- Josh Lassley is "Joshua Lassley" in his sheet.
- Bill maintains a live spreadsheet Mikael has access to; the stale copies held in the project (Q2 through 5/23, an empty Q3 template) are not the comparison source.

---

## Current system state

- **Sync:** Zap 1 (with loop) live and confirmed populating Airtable on live traffic since 9/14; old Zap 1 off (rollback copy, decide whether to delete after a clean pay period). Zap 2 off. Zapier usage was 576/750 for Aug 15–Sep 15 with the next cycle projected ~990 — a Bill decision.
- **Payroll page:** hours span rule, Driver/Helper split, multipliers with netting, per-tech rate, crew-role warning banner, PTO Days / YTD PTO columns and Upcoming Time Off list (PTO hours never enter net/gross hours or OT). Live as of the 10/8 deploy.
- **Job form (`jobs/index.html`):** the crew and time-picker changes above are in the working tree only. The last deployed version still has the old Confirm-step behaviour (replace-on-save).
- **Shared modules:** `job-types.js` (normalizer, billable types, OSHA requirement; used by job form, compliance and payroll), `employees.js` (employee filter + directory; used by job form and PTO), `timepicker.js` (drum picker + new bounded list picker; also loaded by `manager/index.html`, which is unaffected since list mode is opt-in).
- **Data (base `appVXuyAYj47nZwyz`):** Jobs dated from 9/9, no combo rows; the ~97 junk `Job Type` options were deleted 9/14; pre-9/9 history (584 rows) deleted with a CSV backup held by Mikael. `PTO` table created by hand 9/16 and verified (fields: Id autonumber, Employee link, Date, Hours (1 decimal), Type PTO/Sick/Holiday, Paid checkbox, Pay Period link, Notes); three harmless blank template rows can be deleted. Payroll table holds the live records created by Calculate runs.
- **Employees (10/8):** Crew Role Driver — Malachi Roschmann, Kameron Talbert, Geo Holliday, Larrell Jacobs, Martin Chavez; Helper — Bill Roschmann, Danielle Hinrichs, Josh Lassley, Dorian Young, Elijah Hale, Matthew Pieruccini; unset (all inactive) — Brendon Fuller, Jon Glavin, Luke Brown, Vladislav Grinyuk, Mikael B.

---

## What's needed next

**Mikael**
1. **Review the diff and commit/push the job-form change** (`jobs/index.html`, `timepicker.js`, `employees.js`). Netlify deploys on push to `main`. After deploy, do one real submit on a test or low-stakes job; the recurring-job draft path in particular is untested.
2. Fix the 9/24–10/8 time errors and date mismatches listed in the data check, chase Malachi's and Dorian's missing times, and check removed crew against Bill's sheet — then run 9/24–10/8 payroll with the fixed code and spot-check any multi-visit day and any warning.
3. Confirm deploys always come from `main` (see the revenue gap note), and that the full Jobs backup taken before the Session R import is retained.
4. Write the client handoff document, including the findings above and the post-launch register contents (the register `post-launch.md` is referenced by earlier notes but is **not in the repo's `.claude/` folder** — its location is unknown; Zap 2, the Netlify receiver rebuild, the Zapier budget, PTO Option A, Tips, seasonal Christmas checklists, Airtable housekeeping, CF job-type drift lockdown and open data questions for Bill were recorded in it).
5. Tell Bill about the Zapier budget before the cycle closes; decide on deleting the old Zap 1 rollback copy.
6. Confirm and formally close the OT-on-commission thread (code uses 0.5 premium, CA-law comment; confirm the numbers were checked).
7. Log actual hours for every session (none captured).

**Bill**
- Fix the two TimeCard formula gaps; note that his splits on the 9/9–9/23 jobs listed in Session R differ from the rule.
- Set the policy for who enters a job for the crew (the app does not enforce it).
- Raise with his payroll provider whether skipped lunches are OK under CA rules (as a question).
- Price Susan Boice C13663; confirm whether separately named concrete services are wanted; decide in October whether seasonal Christmas services need their own checklists; whether MWC offers an annual PTO allotment at all (needed before "days remaining" could be scoped).

**Development (optional)**
- Session E: Zapier Find Record optimization (0.5 h).
- Hourly time entry validation and a bounded hourly picker, if hourly entry is ever brought into scope.
- A cross-employee fetch for discount netting if it ever matters.

---

## Deferred / shelved (not lost)

The Netlify-receiver rebuild (the patch produces the same row shape, so nothing is wasted), Zap 2 rework, PTO Option A (full payroll integration), Tips, seasonal checklists, per-person times, per-job role overrides, enforcing "only drivers may submit", and the Zapier budget decision.

---

## Reference docs (in repo `.claude/`)

| Doc | What it holds |
|---|---|
| `mwc-payroll-app-state-v8.md` | This file — the current state |
| `PAYROLL_SPEC.md` | Original payroll page spec; describes the pre-multiplier baseline — `payroll/payroll.js` is the source of truth |
| `mwc-combo-row-sync-investigation.md` | Full RCA, evidence, confirmed vs inferred, impact map for the combo-row sync bug |
| `mwc-sync-rebuild-plan.md` | Shelved Netlify-receiver design and effort estimate |
| `mwc-action-plan.md` | The patch route actually taken, session by session |
| `mwc-session-report-2026-09-08.md` | Full session report for 9/8 |
| `bill-revenue-worklist.md` | The 161-row revenue worklist (actioned for ≥ 9/9; the rest purged) |
| `airtable-junk-jobtype-options.md` | The ~97 junk `Job Type` options (deleted 9/14) |
| `whereWeAre.md` | Running dev debrief |

---

## Session log

| Date | Session | Estimated | Actual | Notes |
|---|---|---|---|---|
| 2026-09-08 | Combo-row sync bug: RCA, Zap 1 rebuild, `job-types.js`, 44-row repair, 584-row purge | 3–4h | not logged | Ran the full afternoon; overrun was the manual repair from CF screenshots. Corrected route estimate ~11–17h. |
| 2026-09-14 | Lead-PM close-out planning: parallel-run decision, PTO scoped to Option B, Zap 2 closed out, discount model correction | — | not logged | Verified Bill's workbook copies were stale; live sheet is the source. Zap 1 confirmed on live traffic; junk job types cleaned. |
| 2026-09-16 | Sessions A + C: back-dating finding, PTO capture (`pto/index.html`, `employees.js`, payroll PTO columns + upcoming list) | 4.25–6.25h | not logged | A prior note wrongly stated "~3h actual"; that was fabricated and was removed. PTO table created by hand and verified live. |
| 2026-09-24 | Lead-PM: Driver/Helper rule + multiplier design confirmed by Bill | — | not logged | |
| 2026-09-28 | Session D: Driver/Helper split + commission multiplier built, 6/6 tests, verified live; rate-array bug found and fixed | 4–6h | not logged | One live Payroll record written for verification. |
| 2026-09-29 → 10-08 | Session R: Phase 1 report, TCF corrections, times import, comparison with Bill | 1–2h | not logged | Ran well over estimate. |
| 2026-10-08 | Diagnostic (read-only) + hours fix in `payroll.js`, 12/12 tests, deployed (`6fc251c`) | — | not logged | Page now matches Bill within explained differences. |
| 2026-10-08 | Read-only diagnostics: two-tech job handling in the old form; 9/24–10/8 data completeness | — | not logged | Findings recorded above. |
| 2026-10-08 | Crew picker + bounded time pickers (`jobs/index.html`, `timepicker.js`, `employees.js`); tested end to end on the real base; state file v8 | 4–6h | **not logged** | 26 checks pass (23 + 3); 9 test rows created and deleted; not committed or deployed. |
