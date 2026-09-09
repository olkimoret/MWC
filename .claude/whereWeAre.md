// claude note and debrief post session to save time for the next session

// this is a collection of decision made in the implementation or product along the way

// notes post session should be short, direct and helpfull, not a capture of everything, just what would save the future developper to understand the context and decision made so far

// when adding notes, don't delete anything here, just add you note with a date and a title at the end of this document

## 2026-08-07 — Job list: drop tech filter + Recurring Jobs picker (jobs/index.html)

Context: techs sometimes couldn't find their job because CF→Airtable tech-assignment sync
can be stale, and recurring jobs never sync into Airtable after their first occurrence.

Status: implemented, committed (456a7bd), pushed to main. Not yet tested by user in browser.

What changed in `jobs/index.html`:
- Main job list already only filtered by `Job Date` server-side (no tech filter existed in
  the Airtable formula) — the "drop tech filter" part of the ask was effectively a no-op.
  What actually changed: list is now sorted alphabetically, with jobs assigned to the
  current tech grouped first under a "Your Jobs" label (only shown if both groups exist).
- Renamed "Don't see your job?" → "Show More Jobs" (same `openWidePicker()` behavior).
- Added "Show Recurring Jobs" button + a second modal (`recurring-picker-overlay`) that
  queries the **Recurring Jobs** table (`Active=TRUE()`), searchable by client name.
- Picking a recurring client: queries Jobs for an existing row matching
  Customer Name + Job Date + Job Type (see "dedup key" decision below). If found, reuses it.
  If not, builds an in-memory draft (`{ id: null, isDraft: true, fields: {...} }`) and only
  POSTs it to Airtable at final submit — `submitForm()` and `saveConfirmChanges()` both have
  branches checking `job.isDraft` to handle this (create vs patch).

Airtable schema facts discovered this session (base `appVXuyAYj47nZwyz`):
- Jobs table has **no Address/City/Zip fields** — only Recurring Jobs does. Address is
  shown in the recurring picker for search/display only, never written to Jobs.
- Recurring Jobs has two separate link-to-Employees fields: `Employee` (populated on
  existing records) and `Default Tech(s)` (empty on every sampled record). User chose to
  use `Default Tech(s)` going forward — meaning picked recurring jobs will almost always
  trigger the existing Confirm Changes / tech-mismatch flow until that field gets populated.
  If techs report every recurring pick asking them to reassign themselves, that's why —
  not a bug, just reflects `Default Tech(s)` being unpopulated in the data.
- Job Type on Jobs is single-select (one value per row) — a multi-service visit is modeled
  as multiple Jobs rows sharing client+date, one per service. This is why dedup for
  recurring-created jobs keys on **client + date + Job Type**, not just client + date —
  keying on client+date alone would let a second recurring service for the same
  client/day overwrite the first service's row.
- Job Revenue is copied from the Recurring Jobs record onto the created Jobs row (needed
  so commission calc doesn't come out to $0 for these jobs).
- No schema changes were made to the Airtable base itself.

If continuing this thread: check with the user whether they've tested the recurring-picker
flow in the browser yet, and whether `Default Tech(s)` has since been populated on
Recurring Jobs records (would reduce Confirm Changes friction for techs).

## 2026-08-07 — What would've made this session faster to ramp up on

- **No local Airtable schema doc exists.** I had to hit the Meta API
  (`GET /v0/meta/bases/{base}/tables`, PAT + base ID lifted straight out of
  `jobs/index.html`) and sample live records to learn table/field names, types, and which
  fields actually hold data vs. are empty placeholders (e.g. `Employee` vs `Default
  Tech(s)` on Recurring Jobs). That's a repeatable few-minutes-of-work every session touches
  Airtable. A checked-in schema snapshot (even just the field list per table, regenerated
  occasionally) would save that every time — happy to generate one if useful.
- **File name in the ask didn't match reality**: was told to check `payroll_specs.md`,
  actual file is `.claude/PAYROLL_SPEC.md` (different name, different casing, different
  location). Cost one extra glob round-trip. Worth remembering the spec lives there, and
  that it documents the `/payroll/` page only — not `/jobs/`.
- **`jobs/index.html` is a single 1700+ line file** with no table of contents — had to read
  it start to finish to find the existing `jobsMismatch` / Confirm Changes machinery that
  the new recurring-picker flow ended up hooking into. Worth knowing up front: any
  tech/date correction logic lives under "CONFIRM CHANGES" near the bottom third of the
  file, and the generic `.wide-picker-overlay` CSS classes (not ID-specific) are meant to
  be reused for any future modal-with-search-list, which is why the recurring picker could
  reuse them directly instead of writing new CSS.
- **Airtable PAT is hardcoded client-side** in `jobs/index.html` (and presumably every
  other page under this repo) — fine for how this app already works, but worth flagging
  explicitly rather than discovering it mid-task, since it means the Meta API is reachable
  with zero setup any time schema questions come up.

## 2026-08-07 — Job form bug fixes: phantom hourly hours, stuck Submit, CTA gating (jobs/index.html)

Fixed: hidden hrly-start/end defaults that silently submitted 8am–5pm even when untouched (cause of unrequested hours on recurring jobs); `Submit Job`/other Airtable calls hanging forever with no error on a dropped connection (all 9 `fetch()` calls now go through a 20s `fetchWithTimeout()`); "Submit Another Job" losing the job list; tech-confirm screen defaulting to the wrong tech; missing disabled-states on the step-4 and confirm-screen CTAs. Committed & pushed (612c6c1 + follow-up).

## 2026-09-08 — CF→Airtable "combo row" fix: Zapier rebuild + normalizer + legacy repair

**The bug:** multi-service CF visits were syncing as ONE Jobs row — `Job Type` a comma-joined
string, `Job Revenue` only the first line item's amount, discount lines dropped entirely.
161 rows affected. Root cause: Zap 1 ("New Job") had lost its line-item loop; Zap 2
("Job Completed") had two dormant bugs (searched Jobs by `Job Number`, which is really the
customer id, "return first"; and mapped the raw loop object into `Job Revenue`/`Job Type`).
Full write-up: `.claude/mwc-combo-row-sync-investigation.md`, `mwc-sync-rebuild-plan.md`,
`mwc-action-plan.md`.

**Zapier (user did in UI):** rebuilt Zap 1 from the July backup — added `Looping by Zapier`
over the `Jobs[]` line items, Create Record now maps `2. Amount` / `2. Job Type` /
`2. Assigned To` from the loop, `Job Key` uses `2. Job Type`. Find Record (Pay Periods) stays
before the loop. Zap 2 turned OFF (never successfully wrote — its bugs were armed but dormant).
New Zap live, old one off.

**App code (committed 04d543c, 68ec904, 1698188 — pushed):**
- New `job-types.js` — shared `Job Type` normalizer. CF has no input validation so the same
  service arrives many ways (`BRONZE Window Cleaning:` trailing colon = 66 rows, `blow off
  roof` vs `Roof Blow Off`, 3 spellings of `Commercial WC`, etc). `normalizeJobType()` folds
  them; `parseJobTypes()` splits comma-joined legacy rows; `requiresOsha()` is keyword-aware.
  Loaded by `jobs/index.html` and `compliance/index.html`, which now call it instead of their
  own exact-match Sets. Measured: checklist coverage 498→581 rows, OSHA 99→204.
- `jobs/index.html` — checklist build shows the tech an amber "No checklist on file" note for
  any billable service not in `JOB_TYPE_MAP` instead of silently doing Arrival/Departure only.
- `compliance/index.html` — new "Unrecognised Job Types" section (count + first-seen) so the
  normalizer map can be maintained from real data. ~20 values surface, mostly seasonal Xmas
  light-install services with no checklist authored.

**Legacy data repair (done via PAT/API from screenshots of CF invoices):** all 44 combo rows
dated ≥ 2026-09-09 were split into per-service rows (correct per-line revenue, discounts as
their own negative rows, per-line techs where CF differed). Combo rows deleted. Shared fields
(Employee, Pay Period, Job Number) copied from the original combo row; rates/hours/techcount
are Airtable lookups/formulas — not written. Deliverables:
`.claude/bill-revenue-worklist.md` (superseded — all done) and
`.claude/airtable-junk-jobtype-options.md` (~97 comma-joined junk options for an Airtable
admin to delete from the `Job Type` single-select — keep the field OPEN to new values, or the
sync errors and the job row never gets created).

**Still open:**
- User to run the pre-cutoff purge: delete all Jobs rows with `Job Date < 2026-09-09`
  (~590 rows, includes the 117 remaining pre-cutoff combo rows) so Bill tests payroll on a
  clean 9/9–9/23 period.
- Airtable admin to purge the ~97 junk `Job Type` options.
- Add `Xmas 1st Floor Roof Line - Front and East Side`, `Xmas 36 Inch Wreath` etc. to
  `job-types.js` properly once Bill decides whether the Xmas services need checklists.
- Bill to price **Susan Boice C13663** (CF shows $0/$0). **Erin Zuccaro C19095** has three
  `Concrete Cleaning: X` CF lines folded to one `Concrete Cleaning` Job Type (distinct
  revenue, distinct Job Keys) — flag if per-service naming is wanted.
- The commission multiplier feature is still stashed (`git stash`) — Bill hasn't confirmed
  which real `Job Type` strings count (`Gutter Sticks`=1 row, `Slimguard Gutter Protection`=2,
  `gutter guards`=4 are all candidates).
