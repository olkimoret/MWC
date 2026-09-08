# MWC — action plan (patch route)

**Date:** 2026-09-08
**Route chosen:** patch the existing Zapier sync + normalize job types in the app.
The Netlify receiver rebuild is shelved, not cancelled — see `mwc-sync-rebuild-plan.md`.

---

## PM summary (relay this)

**What broke.** Multi-service visits from Customer Factor were arriving in Airtable as a single
row instead of one row per service. `Job Type` became a comma-joined string
(`"Roof Blow Off,Residential Gutter Cleaning,House Wash…"`) and `Job Revenue` kept only the
first line's amount. Discount lines were dropped entirely. 160 rows affected, covering
159 customer visits and 418 real service lines.

**Impact.** Everything downstream matches `Job Type` exactly, so affected visits silently got:
no job checklist for the tech, no OSHA hazard assessment, and wrong revenue for commission.
Separately, Customer Factor has no input validation on job type, so the same service arrives
under many spellings — 87 distinct strings exist, only ~17 of which the app recognised.

**Not yet costly.** No payroll has been run over any affected row, and only 3 of the 160 have a
tech submission. The client has not started using the app. Nothing needs to be paid back.

**Fix.** Two independent changes:
1. Restore the line-item loop in the Zapier "New Job" sync so each service gets its own row.
2. Add a shared normalization layer in the app so CF's spelling variants resolve correctly, and
   surface anything it can't recognise instead of failing silently.

**Status.** Change 2 is built and tested (checklist coverage 498 → 581 rows; OSHA coverage
99 → 204 rows). Change 1 is ~30 minutes of Zapier configuration.

**Remaining effort: ~3–4 hours across 2–3 short sessions.** Go-live for the tech app should
follow session B.

**Carry-over:** the 160 existing rows keep incorrect revenue. The per-line amounts were never
stored anywhere and Customer Factor has no API, so they cannot be recovered programmatically.
Handling is a worklist for Bill to correct from CF at completion time (session B).

---

## SESSION A — now (~2h)

Goal: correct sync live, normalization deployed.

### A1 · Duplicate Zap 1 first  · 5 min
In Zapier, open **Zap 1 ("New Job")** and hit the **copy/duplicate icon**. Edit the *duplicate*.
Zapier's version history is paywalled, so this duplicate **is** your rollback — if anything
misbehaves, turn the original back on in one click.

### A2 · Pause Zap 2 ("Job Completed")  · 2 min
Just switch it off. It has never successfully written a row (zero rows in the base carry its
signature), and it contains two live bugs: it searches Jobs by `Job Number` — which is actually
the **customer** id — with "return first result", so it overwrites an arbitrary historical row;
and it writes the raw loop object into both `Job Revenue` and `Job Type`. Nothing is lost by
disabling it.

### A3 · Add the loop to the duplicated Zap 1  · 20 min
Leave **step 2 Find Record (Pay Periods)** where it is — *before* the loop, so it runs once per
visit rather than once per line.

**Insert new step 3: `Looping by Zapier` → `Create Loop From Line Items`.**
Under *Values to Loop*, map the line-item fields **individually**:

| Name | Value |
|---|---|
| `job_type` | `1. Jobs Job Type` |
| `amount` | `1. Jobs Amount` |
| `assigned_to` | `1. Jobs Assigned To` |

> ⚠️ Do **not** map the whole `1. Jobs` object as one value. That is precisely the mistake in
> Zap 2 that writes `amount: 179.00…t_price: 179.00` into Job Type.

**Then in Create Record (now step 4), repoint four fields at the loop:**

| Field | From | To |
|---|---|---|
| Job Revenue | `1. Jobs Amount` | **`3. Amount`** |
| Job Type | `1. Jobs Job Type` | **`3. Job Type`** |
| Employee | `1. Jobs Assigned To` | **`3. Assigned To`** |
| Job Key | … \| `1. Jobs Job Type` | … \| **`3. Job Type`** |

Job Date, Customer Name, Job Number and Pay Period are unchanged.

### A4 · Test without needing a real CF booking  · 20 min
Use Zapier's **Test step** on the Create Record action — it replays the stored trigger sample.
Pick a sample with several line items (the C19115 / Leo Abucayan visit has a service, a
disclaimer and a discount — ideal).

**Expected:** one Airtable row per line item. The discount row has **negative** `Job Revenue`.
The disclaimer row has `0`. No comma appears in any `Job Type`.

Then **delete the test rows** from Airtable — Test step writes real records.

### A5 · Turn on the duplicate, turn off the original  · 2 min

### A6 · Deploy the normalization layer  · 20 min
Claude commits `job-types.js` plus the wiring in `jobs/` and `compliance/`, pushes to `main`,
Netlify auto-deploys. Then smoke-test the live pages: open the job form on a visit whose type is
`BRONZE Window Cleaning:` and confirm the Window Cleaning checklist now appears.

### A7 · Buffer  · ~30 min
For the first thing that doesn't behave as written.

---

## SESSION B — later today (~1–1.5h)

Goal: unknown-type visibility, and a plan for the 160 rows.

### B1 · Confirm the new Zap on real traffic · 15 min
Check any visit that synced since session A: one row per service, sane revenue, no commas.

### B2 · Unknown-job-type flagging (Claude builds, ~30–40 min)
Right now an unrecognised type silently yields no checklist — the same failure mode we are
fixing. Add:
- **Job form:** a visible line to the tech — *"No checklist on file for 'Xmas Light Stakes' —
  Arrival/Departure only."*
- **Compliance report:** a new *"Unrecognised Job Types this period"* section with counts, so the
  normalization map can be maintained from real data.

Read-only; no Airtable writes, so the PAT's inability to create select options is irrelevant.

### B3 · The 160-row worklist · 20 min
Claude generates the list (customer, date, services, current revenue). Decision to confirm:
**leave the rows in place** — the app now handles their checklists and OSHA correctly — and have
Bill correct `Job Revenue` from CF's own invoice as each job is completed. Deleting them is
worse: the tech would have no job to select.

### B4 · Airtable tidy · 15 min
Delete the ~160 comma-joined junk options from the `Job Type` singleSelect. **Keep the field
open** to new values — that was a deliberate choice and it is correct: if the field rejected
unknown input, the Zap would error and the job row would never be created at all. Better a
mistyped job type than a missing job.

---

## SESSION C — later this week (~30 min)

- Re-run the coverage check; confirm zero new comma-joined rows since cutover.
- Update `.claude/whereWeAre.md` with the debrief.
- Green-light Bill to start using the app.

---

## Deliberately NOT doing

- **Zapier MCP / `zapier install` to have Claude build the Zap.** The Zapier CLI builds
  *integrations*, not Zaps; Zapier MCP exposes app *actions*, not Zap authoring. No public API
  exists for editing a Zap definition. Setup would cost more than the 30 minutes of clicking.
- **Normalizing job types inside Zapier.** On-write normalization destroys the original CF
  string, costs a task per line, and can't be tested or version-controlled. On-read keeps
  Airtable a faithful record and makes a bad fold a one-line fix.
- **Locking down the Airtable `Job Type` field.** See B4.
- **The Netlify receiver rebuild.** Shelved with its design intact should MWC ever fund it.
