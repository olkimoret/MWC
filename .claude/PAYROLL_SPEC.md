# MWC Payroll Page Spec

## Overview
Add a payroll page at `/payroll/` on the manager site. Billy selects an employee, sees past payroll summaries, and can calculate payroll for a completed pay period. All calculation happens in the browser — no Airtable automation needed.

## Styling
Same as all other pages: `<link rel="stylesheet" href="/mwc.css">`, MWC header, same card/button/toggle patterns.

## Airtable Config
- Base ID: appVXuyAYj47nZwyz
- PAT: pat51Bpz1DmsTICb1.4cc6011c585d7167d45c6214905f55c09fe042e18742b3fdd53f09646cfb00a0
- Tables: Jobs, Employees, Pay Periods, Payroll

## Page Layout & Behavior

### Default view (no employee selected)
Show a compact team summary table for the most recent completed pay period (Pay Period End Date < today). One row per employee showing:
- Employee name
- Gross Wages
- Regular Hours + OT Hours
- Safety Net badge (yellow, "Below Minimum") if Safety Net Triggered = true
- Status: green checkmark if Payroll record exists for that period, red "Not calculated" badge if no record exists

Show total payroll cost (sum of all Gross Wages) at the bottom. Each row is clickable to select that employee.

### Employee selected view
Show the last 4 calculated Payroll records for that employee as cards. Each card shows:
- Pay Period name (large)
- Gross Wages (large, prominent)
- Regular Hours / OT Hours
- Commission vs Safety Net path (which one applied)
- Safety Net badge if triggered
- Change vs previous period (↑ or ↓ with dollar amount)

Below the cards: "Calculate Payroll" button.

### Calculate flow
When Billy clicks "Calculate Payroll":
1. Show a pay period picker — only completed pay periods (End Date < today) that have NO existing Payroll record for this employee
2. Billy selects a pay period and clicks Calculate
3. If a Payroll record already exists for this employee + pay period (edge case): show confirmation dialog "Payroll for [Employee] — [Pay Period] has already been calculated. Recalculate and overwrite?" with Confirm and Cancel
4. Run calculation (see below), write to Payroll table, refresh view

## Calculation Logic
All of this runs in the browser after fetching Jobs from Airtable.

### Data to fetch
From Jobs table, get all records where:
- Employee contains selected employee ID
- Pay Period contains selected pay period ID  
- Job Type is NOT "Discount"
- Comm Start is not empty

Fields needed: Job Date, Job Revenue, Commission Rate, Net Hours, Job Type, Comm Start

### Step by step calculation

**1. Group jobs by date**
Create a map of date → array of jobs for that date.

**2. Daily OT (California law: over 8hrs/day)**
For each date, sum Net Hours. If daily total > 8, excess is OT.
Track total daily OT hours across all dates.

**3. Weekly OT (over 40hrs/week)**
Group dates by calendar week (Monday–Sunday or Sunday–Saturday, be consistent).
If any week total > 40, excess is weekly OT.
Final OT Hours = MAX(total daily OT, total weekly OT)

**4. Hours**
- Total Net Hours = sum of all Net Hours across all jobs
- OT Hours = from step 3
- Regular Hours = Total Net Hours - OT Hours
- Commission Hours = Total Net Hours (all hours are commission-based)

**5. Commission**
- Reg Commission = sum of (Job Revenue × Commission Rate) for each job
- OT on Commission = (Reg Commission / Commission Hours) × 0.5 × OT Hours
  (skip if Commission Hours = 0 or OT Hours = 0)
- Total Commission = Reg Commission + OT on Commission

**6. Hourly rate check**
- Average Hourly Commission = Total Commission / Commission Hours
- Safety Net = $17/hr (applies to everyone regardless of role)
- Safety Net Triggered = Average Hourly Commission < 17

**7. Gross Wages**
- If Safety Net Triggered:
  Gross Wages = (17 × Regular Hours) + (17 × 1.5 × OT Hours)
- If not:
  Gross Wages = Total Commission

### Write to Payroll table
Create or update a record with:
- Employee (linked)
- Pay Period (linked)
- Reg Commission
- OT on Commission
- Total Commission
- Commission Hours
- Regular Hours
- OT Hours
- Average Hourly Commission
- Safety Net Triggered (boolean)
- Gross Wages
- Calculated At (current timestamp)

To check if record exists: query Payroll table where Employee = selected AND Pay Period = selected.
If found → update. If not → create.

## Also
Add a "💰 Run Payroll" card to the manager landing page (`/index.html`) linking to `/payroll/`. It should show a subtitle like "Calculate and review employee pay".

## Key field names (exact, case-sensitive)
Jobs: "Job Date", "Job Revenue", "Commission Rate", "Net Hours", "Job Type", "Comm Start", "Employee", "Pay Period"
Pay Periods: "Pay Period Name", "Start Date", "End Date"
Employees: "Name"
Payroll: "Employee", "Pay Period", "Reg Commission", "OT on Commission", "Total Commission", "Commission Hours", "Regular Hours", "OT Hours", "Average Hourly Commission", "Safety Net Triggered", "Gross Wages", "Calculated At"
