const AIRTABLE_BASE_ID = 'appVXuyAYj47nZwyz';
const AIRTABLE_PAT = 'pat51Bpz1DmsTICb1.4cc6011c585d7167d45c6214905f55c09fe042e18742b3fdd53f09646cfb00a0';

const headers = {
  'Authorization': `Bearer ${AIRTABLE_PAT}`,
  'Content-Type': 'application/json'
};

// Driver/Helper revenue-split weights (2026-09-24, Bill-confirmed "Option A").
// Revenue is split by these weights, then each tech's own commission rate is
// applied to their share — the rate is never split. If Bill revises the
// two-driver rule again, this is the only place that should need to change;
// see revenueShare() below.
const CREW_ROLE_WEIGHTS = { Driver: 1.5, Helper: 1.0 };

// Job types that carry a commission multiplier, keyed by normalized Job Type
// (see multiplierFor). All four confirmed by Bill 2026-09-24, including the
// lowercase "gutter guards" string as CF actually stores it.
const JOB_TYPE_MULTIPLIERS = {
  'Partial Roof Cleaning': 0.90,
  'Gutter Sticks': 0.50,
  'Slimguard Gutter Protection': 0.50,
  'gutter guards': 0.50
};

let employees = [];
let employeeHourlyRates = {};
let employeeCrewRole = {}; // id -> raw Crew Role ('Driver'/'Helper'/'' if unset)
let crewRoleWarnings = new Set(); // names seen with no Crew Role during a calculation
let payPeriods = [];
let payrollRecords = [];
let ptoRecords = [];
let currentPayPeriod = null;
let selectedEmpId = null;
let selectedEmpName = null;
let selectedPpId = null;
let pendingConfirmCallback = null;

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtH(n) {
  return n.toFixed(1) + ' h';
}

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

async function init() {
  try {
    const [empData, ppData, payrollData] = await Promise.all([
      fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Employees?sort[0][field]=Name&sort[0][direction]=asc`, { headers }).then(r => r.json()),
      fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Pay%20Periods?sort[0][field]=End%20Date&sort[0][direction]=desc`, { headers }).then(r => r.json()),
      fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Payroll`, { headers }).then(r => r.json())
    ]);

    employees = empData.records.map(r => ({ id: r.id, name: r.fields.Name }));
    empData.records.forEach(r => {
      employeeHourlyRates[r.id] = r.fields['Hourly Rate'] || 17;
      employeeCrewRole[r.id] = r.fields['Crew Role'] || '';
    });
    payPeriods = ppData.records.map(r => ({
      id: r.id,
      name: r.fields['Pay Period Name'],
      startDate: r.fields['Start Date'] || '',
      endDate: r.fields['End Date'] || ''
    }));
    payrollRecords = payrollData.records;

    const today = todayLocal();
    currentPayPeriod = payPeriods.find(p => p.endDate && p.endDate < today);

    if (!currentPayPeriod) {
      document.getElementById('loading-screen').style.display = 'none';
      showError('No completed pay periods found.');
      return;
    }

    // Separate, non-fatal fetch: PTO is capture-only and must never take the
    // payroll page down (e.g. before the PTO table exists, or on a rename).
    try {
      const ptoData = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/PTO`, { headers }).then(r => r.json());
      ptoRecords = ptoData.records || [];
    } catch (e) {
      ptoRecords = [];
    }

    document.getElementById('loading-screen').style.display = 'none';
    renderTeamView();
    renderUpcomingPto();

  } catch (e) {
    document.getElementById('loading-screen').style.display = 'none';
    showError('Could not load payroll data. Check your connection.');
  }
}

// Sum of PTO Hours for one employee whose Date falls within [startDate, endDate]
// (inclusive, 'YYYY-MM-DD' string compare — same convention as the rest of this
// file). PTO hours never enter net/gross/OT hours anywhere in this file — CA
// overtime is based on hours actually worked, so PTO stays in its own variable
// end to end.
function ptoHoursInRange(empId, startDate, endDate) {
  return ptoRecords
    .filter(r => {
      const empIds = r.fields['Employee'] || [];
      const date = r.fields['Date'] || '';
      return empIds.includes(empId) && date >= startDate && date <= endDate;
    })
    .reduce((sum, r) => sum + (typeof r.fields['Hours'] === 'number' ? r.fields['Hours'] : 0), 0);
}

function fmtDays(n) {
  return (Math.round(n * 10) / 10).toString();
}

function renderTeamView() {
  const tbody = document.getElementById('team-tbody');
  tbody.innerHTML = '';

  document.getElementById('period-name').textContent = currentPayPeriod.name;
  document.getElementById('period-dates').textContent = `${currentPayPeriod.startDate} – ${currentPayPeriod.endDate}`;

  let totalWages = 0;

  employees.forEach(emp => {
    const payroll = payrollRecords.find(pr => {
      const empIds = pr.fields.Employee || [];
      const ppIds = pr.fields['Pay Period'] || [];
      return empIds.includes(emp.id) && ppIds.includes(currentPayPeriod.id);
    });

    const grossWages = payroll ? (payroll.fields['Gross Wages'] || 0) : 0;
    const regHours = payroll ? (payroll.fields['Regular Hours'] || 0) : 0;
    const otHours = payroll ? (payroll.fields['OT Hours'] || 0) : 0;
    const safetyNet = payroll ? (payroll.fields['Safety Net Triggered'] || false) : false;

    // Days, not hours — that's the unit Bill works in on his own sheet.
    const periodPtoDays = ptoHoursInRange(emp.id, currentPayPeriod.startDate, currentPayPeriod.endDate) / 8;
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const ytdPtoDays = ptoHoursInRange(emp.id, yearStart, todayLocal()) / 8;

    totalWages += grossWages;

    const tr = document.createElement('tr');
    tr.onclick = () => selectEmployee(emp.id, emp.name);
    tr.innerHTML = `
      <td class="col-name">${esc(emp.name)}</td>
      <td class="col-amount">${payroll ? fmt(grossWages) : '—'}</td>
      <td class="col-hours">${payroll ? fmtH(regHours) : '—'}</td>
      <td class="col-hours">${payroll ? fmtH(otHours) : '—'}</td>
      <td class="col-hours">${periodPtoDays > 0 ? fmtDays(periodPtoDays) : '—'}</td>
      <td class="col-hours">${ytdPtoDays > 0 ? fmtDays(ytdPtoDays) : '—'}</td>
      <td>${safetyNet ? '<span class="badge-safety">Safety Net</span>' : ''}</td>
      <td class="col-status">${payroll ? '<span class="status-ok">✓</span>' : '<span class="status-missing">Not calculated</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('total-wages').textContent = fmt(totalWages);
}

// Plain list, sorted ascending — every PTO entry dated today or later, across
// all employees. No calendar UI, no filters; that's explicitly out of scope.
function renderUpcomingPto() {
  const today = todayLocal();
  const container = document.getElementById('upcoming-pto-list');
  if (!container) return;

  const upcoming = ptoRecords
    .filter(r => (r.fields['Date'] || '') >= today)
    .map(r => ({
      date: r.fields['Date'],
      type: r.fields['Type'] || '',
      empId: (r.fields['Employee'] || [])[0]
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (upcoming.length === 0) {
    container.innerHTML = '<div class="no-jobs">No upcoming time off.</div>';
    return;
  }

  container.innerHTML = '';
  upcoming.forEach(u => {
    const emp = employees.find(e => e.id === u.empId);
    const d = new Date(u.date + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const row = document.createElement('div');
    row.className = 'upcoming-pto-row';
    row.innerHTML = `
      <span class="upcoming-pto-date">${esc(dateLabel)}</span>
      <span class="upcoming-pto-name">${esc(emp ? emp.name : 'Unknown')}</span>
      <span class="upcoming-pto-type">${esc(u.type)}</span>
    `;
    container.appendChild(row);
  });
}

function selectEmployee(empId, empName) {
  selectedEmpId = empId;
  selectedEmpName = empName;
  renderEmployeeView();
}

function renderEmployeeView() {
  document.getElementById('emp-name-heading').textContent = selectedEmpName;

  const empPayrolls = payrollRecords
    .filter(pr => {
      const empIds = pr.fields.Employee || [];
      return empIds.includes(selectedEmpId);
    })
    .map(pr => ({
      id: pr.id,
      ppId: (pr.fields['Pay Period'] || [])[0],
      grossWages: pr.fields['Gross Wages'] || 0,
      regHours: pr.fields['Regular Hours'] || 0,
      otHours: pr.fields['OT Hours'] || 0,
      safetyNet: pr.fields['Safety Net Triggered'] || false,
      regComm: pr.fields['Reg Commission'] || 0,
      otComm: pr.fields['OT on Commission'] || 0,
      totalComm: pr.fields['Total Commission'] || 0,
      commHours: pr.fields['Commission Hours'] || 0,
      avgHourly: pr.fields['Average Hourly Commission'] || 0,
      hrlyHours: pr.fields['Hourly Hours'] || 0
    }));

  empPayrolls.sort((a, b) => {
    const ppA = payPeriods.find(pp => pp.id === a.ppId);
    const ppB = payPeriods.find(pp => pp.id === b.ppId);
    const endA = ppA ? new Date(ppA.endDate).getTime() : 0;
    const endB = ppB ? new Date(ppB.endDate).getTime() : 0;
    return endB - endA;
  });

  const last4 = empPayrolls.slice(0, 4);

  const cardsDiv = document.getElementById('payroll-cards');
  cardsDiv.innerHTML = '';

  if (last4.length === 0) {
    document.getElementById('no-payroll').style.display = 'block';
  } else {
    document.getElementById('no-payroll').style.display = 'none';

    last4.forEach((payroll, idx) => {
      const pp = payPeriods.find(p => p.id === payroll.ppId);
      const prev = last4[idx + 1];
      let deltaStr = '';

      if (prev) {
        const delta = payroll.grossWages - prev.grossWages;
        const absStr = fmt(Math.abs(delta));
        if (delta > 0) {
          deltaStr = `<div class="payroll-card-delta delta-up">↑ ${absStr} from previous</div>`;
        } else if (delta < 0) {
          deltaStr = `<div class="payroll-card-delta delta-down">↓ ${absStr} from previous</div>`;
        }
      }

      const path = payroll.safetyNet ? 'Safety Net Applied' : `Commission: ${fmtH(payroll.commHours)} @ $${payroll.avgHourly.toFixed(2)}/hr`;

      let additionalRows = '';
      if (payroll.avgHourly > 0) {
        additionalRows += `
          <div class="payroll-card-row">
            <span class="payroll-card-row-label">Avg Hourly Commission:</span>
            <span class="payroll-card-row-value">$${payroll.avgHourly.toFixed(2)}/hr</span>
          </div>
        `;
      }
      if (payroll.hrlyHours > 0) {
        additionalRows += `
          <div class="payroll-card-row">
            <span class="payroll-card-row-label">Non-Comm Hours:</span>
            <span class="payroll-card-row-value">${fmtH(payroll.hrlyHours)}</span>
          </div>
        `;
      }

      const card = document.createElement('div');
      card.className = 'payroll-card';
      card.innerHTML = `
        <div class="payroll-card-header">
          <div class="payroll-card-period">${pp ? esc(pp.name) : 'Unknown'}</div>
          <button class="payroll-card-edit-btn" title="Recalculate payroll" onclick="editPayroll('${payroll.ppId}')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="16" height="16">
              <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 20.25l1.097-4.135a4.5 4.5 0 011.13-1.897l8.659-8.659z" />
            </svg>
          </button>
        </div>
        <div class="payroll-card-amount">${fmt(payroll.grossWages)}</div>
        <div class="payroll-card-row">
          <span class="payroll-card-row-label">Regular Hours:</span>
          <span class="payroll-card-row-value">${fmtH(payroll.regHours)}</span>
        </div>
        <div class="payroll-card-row">
          <span class="payroll-card-row-label">OT Hours:</span>
          <span class="payroll-card-row-value">${fmtH(payroll.otHours)}</span>
        </div>
        ${additionalRows}
        <div class="payroll-card-path">${path}</div>
        ${deltaStr}
      `;
      cardsDiv.appendChild(card);
    });
  }

  showEmployee();
}

function showTeam() {
  document.getElementById('team-view').style.display = 'block';
  document.getElementById('employee-view').style.display = 'none';
  document.getElementById('calculate-view').style.display = 'none';
  hideError();
}

function showEmployee() {
  document.getElementById('team-view').style.display = 'none';
  document.getElementById('employee-view').style.display = 'block';
  document.getElementById('calculate-view').style.display = 'none';
  hideError();
}

function showCalculate() {
  document.getElementById('calc-emp-label').textContent = selectedEmpName;

  const today = todayLocal();
  const select = document.getElementById('calc-period-select');
  select.innerHTML = '<option value="">— Select pay period —</option>';

  // Filter completed periods with no existing payroll
  const completedWithoutPayroll = payPeriods.filter(pp => {
    if (!pp.endDate || pp.endDate >= today) return false;
    const exists = payrollRecords.some(pr => {
      const empIds = pr.fields.Employee || [];
      const ppIds = pr.fields['Pay Period'] || [];
      return empIds.includes(selectedEmpId) && ppIds.includes(pp.id);
    });
    return !exists;
  });

  // List every candidate period immediately (no network). A period with no jobs for this
  // employee is handled by doCalculate ("No jobs found"), so no per-period prefetch is needed.
  completedWithoutPayroll.forEach(pp => {
    const option = document.createElement('option');
    option.value = pp.id;
    option.textContent = pp.name;
    select.appendChild(option);
  });

  document.getElementById('team-view').style.display = 'none';
  document.getElementById('employee-view').style.display = 'none';
  document.getElementById('calculate-view').style.display = 'block';

  requestAnimationFrame(() => window.initCustomSelects(document.getElementById('calculate-view')));
}

function runCalculate() {
  const select = document.getElementById('calc-period-select');
  selectedPpId = select.value;

  if (!selectedPpId) {
    showError('Please select a pay period.');
    return;
  }

  const existing = payrollRecords.find(pr => {
    const empIds = pr.fields.Employee || [];
    const ppIds = pr.fields['Pay Period'] || [];
    return empIds.includes(selectedEmpId) && ppIds.includes(selectedPpId);
  });

  if (existing) {
    const pp = payPeriods.find(p => p.id === selectedPpId);
    const msg = `Payroll for ${esc(selectedEmpName)} — ${esc(pp.name)} has already been calculated. Recalculate and overwrite?`;
    showConfirm(msg, doCalculate);
  } else {
    doCalculate();
  }
}

function showConfirm(msg, callback) {
  document.getElementById('confirm-msg').textContent = msg;
  pendingConfirmCallback = callback;
  document.getElementById('confirm-overlay').style.display = 'flex';
}

function hideConfirm() {
  document.getElementById('confirm-overlay').style.display = 'none';
  pendingConfirmCallback = null;
}

document.getElementById('confirm-yes').addEventListener('click', () => {
  if (pendingConfirmCallback) pendingConfirmCallback();
  hideConfirm();
});

document.getElementById('confirm-no').addEventListener('click', hideConfirm);

async function fetchJobsForPeriod(startDate, endDate) {
  const formula = encodeURIComponent(
    `AND(DATESTR({Job Date})>='${startDate}',DATESTR({Job Date})<='${endDate}')`
  );
  const fields = [
    'Job%20Date','Job%20Revenue','Commission%20Rate','Job%20Type',
    'Comm%20Start','Comm%20End','Hrly%20Start','Hrly%20End',
    'Employee','Pay%20Period','Number%20of%20Techs','Lunch','Customer%20Name'
  ].join('&fields[]=');

  let allRecords = [];
  let offset = null;

  do {
    let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Jobs?filterByFormula=${formula}&fields[]=${fields}&pageSize=100`;
    if (offset) url += `&offset=${offset}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset || null;
  } while (offset);

  return allRecords;
}

function filterJobs(jobs, empId, ppId) {
  return jobs.filter(j => {
    const empIds = j.fields.Employee || [];
    const ppIds = j.fields['Pay Period'] || [];
    const commStart = j.fields['Comm Start'];
    const hrlyStart = j.fields['Hrly Start'];
    const jobType = j.fields['Job Type'];

    // If Pay Period is filled, it must match. If empty, trust the date range.
    const ppMatch = ppIds.length === 0 || ppIds.includes(ppId);

    // Include job if: employee matches AND (comm start OR hrly start is filled) AND job type is not 'Non-Commission'
    return empIds.includes(empId) && ppMatch && (commStart || hrlyStart) && jobType !== 'Non-Commission';
  });
}

async function doCalculate() {
  const btn = document.getElementById('calc-btn');
  btn.textContent = 'Calculating…';
  btn.disabled = true;
  hideError();

  try {
    const pp = payPeriods.find(p => p.id === selectedPpId);
    if (!pp) {
      showError('Pay period not found.');
      btn.textContent = 'Calculate';
      btn.disabled = false;
      return;
    }

    const allJobsInPeriod = await fetchJobsForPeriod(pp.startDate, pp.endDate);
    const jobs = filterJobs(allJobsInPeriod, selectedEmpId, selectedPpId);

    console.log(`DEBUG: All jobs fetched for period ${pp.startDate} to ${pp.endDate}:`, allJobsInPeriod.length);
    console.log(`DEBUG: Jobs filtered for ${selectedEmpName} (${selectedEmpId}):`, jobs.length);
    console.log(`DEBUG: Filtered jobs:`, jobs.map(j => ({
      date: j.fields['Job Date'],
      customer: j.fields['Customer Name'],
      employees: j.fields['Employee'],
      commStart: j.fields['Comm Start'],
      revenue: j.fields['Job Revenue'],
      numTechs: (j.fields['Employee'] || []).length
    })));

    if (jobs.length === 0) {
      showError('No jobs found for this employee and period.');
      btn.textContent = 'Calculate';
      btn.disabled = false;
      return;
    }

    const employeeHourlyRate = employeeHourlyRates[selectedEmpId] || 17;
    const payrollFields = computePayroll(jobs, employeeHourlyRate, selectedEmpId);
    console.log('Payroll fields to write:', payrollFields);
    renderCrewRoleWarning();

    // Check fresh for existing record before write
    const existingPayroll = payrollRecords.find(pr => {
      const empIds = pr.fields.Employee || [];
      const ppIds = pr.fields['Pay Period'] || [];
      return empIds.includes(selectedEmpId) && ppIds.includes(selectedPpId);
    });

    payrollFields['Calculated At'] = new Date().toISOString();

    if (existingPayroll) {
      const patchRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Payroll/${existingPayroll.id}`,
        { method: 'PATCH', headers, body: JSON.stringify({ fields: payrollFields }) }
      );
      if (!patchRes.ok) throw new Error('PATCH failed');
    } else {
      payrollFields['Employee'] = [selectedEmpId];
      payrollFields['Pay Period'] = [selectedPpId];
      const postRes = await fetch(
        `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Payroll`,
        { method: 'POST', headers, body: JSON.stringify({ fields: payrollFields }) }
      );
      if (!postRes.ok) throw new Error('POST failed');
    }

    // Refresh payroll records from Airtable
    const refreshRes = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Payroll`, { headers });
    const refreshData = await refreshRes.json();
    payrollRecords = refreshData.records || [];

    // Re-render both employee cards and team summary
    renderEmployeeView();
    renderTeamView();

  } catch (e) {
    showError('Calculation failed. Please try again.');
  } finally {
    btn.textContent = 'Calculate';
    btn.disabled = false;
  }
}

// Single source of truth for how a multi-tech job's REVENUE (not commission)
// is split among the techs who worked it. Each tech's own commission rate
// is applied to their share afterward, in computePayroll — the rate itself
// is never split. Swap CREW_ROLE_WEIGHTS above if the two-driver rule
// changes; this function's shape (and its callers) should not need to.
// roleMap is the raw id -> Crew Role map (employeeCrewRole) — an employee
// with no role set falls back to Helper here, matching Bill's fallback rule.
function revenueShare(employeeIds, employeeId, roleMap) {
  if (!employeeIds || employeeIds.length === 0) return 1; // unchanged fallback
  let totalWeight = 0;
  let myWeight = 0;
  employeeIds.forEach(id => {
    const role = roleMap[id] === 'Driver' ? 'Driver' : 'Helper';
    const weight = CREW_ROLE_WEIGHTS[role];
    totalWeight += weight;
    if (id === employeeId) myWeight = weight;
  });
  return totalWeight > 0 ? myWeight / totalWeight : 1 / employeeIds.length;
}

// Commission Rate comes back as a single number on a solo job, or an array
// aligned to the Employee link field's order on a multi-tech job. Index into
// it by this employee's own position — grabbing the first positive value in
// the array (the old behavior) silently paid every non-first tech at the
// first tech's rate on any shared job.
function rateForEmployee(job, employeeId) {
  const rateRaw = job.fields['Commission Rate'];
  if (typeof rateRaw === 'number') return rateRaw;
  if (Array.isArray(rateRaw)) {
    const empIds = job.fields['Employee'] || [];
    const idx = empIds.indexOf(employeeId);
    if (idx >= 0 && typeof rateRaw[idx] === 'number') return rateRaw[idx];
    for (const r of rateRaw) {
      if (typeof r === 'number' && r > 0) return r;
    }
  }
  return 0;
}

// Normalized Job Type -> multiplier, or null if this job type doesn't carry
// one. Routed through job-types.js's normalizer (loaded on this page) so
// casing/trailing-punctuation variants still match; falls back to the raw
// string if that script isn't present.
function multiplierFor(rawJobType) {
  const type = (typeof normalizeJobType === 'function') ? normalizeJobType(rawJobType) : (rawJobType || '');
  return Object.prototype.hasOwnProperty.call(JOB_TYPE_MULTIPLIERS, type) ? JOB_TYPE_MULTIPLIERS[type] : null;
}

// Visit grouping key for discount netting: same Job Date + same Customer Name.
function visitKey(job) {
  return (job.fields['Job Date'] || '') + '||' + (job.fields['Customer Name'] || '');
}

// Commission span for one tech's day: latest valid Comm End minus earliest
// valid Comm Start (UTC time-of-day, same reading as before). Rows are skipped
// and reported via onExclude(job, reason) if End is not after Start, or the
// times fall outside 05:00-21:00 (likely an AM/PM typo). Overlaps and
// duplicate line items collapse naturally. Returns { grossHours, used }.
function commSpanForDay(dayJobs, onExclude) {
  const tod = iso => { const d = new Date(iso); return d.getUTCHours() + d.getUTCMinutes() / 60; };
  let minStart = Infinity, maxEnd = -Infinity, used = 0;
  dayJobs.forEach(j => {
    const s = j.fields['Comm Start'], e = j.fields['Comm End'];
    if (!s || !e) return;
    const start = tod(s), end = tod(e);
    let why = null;
    if (!(end > start)) why = 'Comm End is not after Comm Start';
    else if (start < 5 || end > 21) why = 'outside 05:00-21:00, possible AM/PM typo';
    if (why) { if (onExclude) onExclude(j, why); return; }
    if (start < minStart) minStart = start;
    if (end > maxEnd) maxEnd = end;
    used++;
  });
  return { grossHours: used > 0 ? maxEnd - minStart : 0, used };
}

function computePayroll(jobs, employeeHourlyRate, employeeId) {
  // Helper: parse ISO datetime string to decimal hours (UTC to avoid timezone shift)
  function timeFromISO(isoStr) {
    if (!isoStr) return 0;
    const date = new Date(isoStr);
    return date.getUTCHours() + date.getUTCMinutes() / 60;
  }

  // STEP 1: Group jobs by date and calculate daily metrics
  const jobsByDate = {};
  jobs.forEach(j => {
    const date = j.fields['Job Date'];
    if (!jobsByDate[date]) jobsByDate[date] = { jobs: [] };
    jobsByDate[date].jobs.push(j);
  });

  // STEP 2: For each day, calculate gross hours, lunch, net hours, and revenue
  const dailyMetrics = {};
  let totalCommHours = 0;
  let totalRevenue = 0;

  Object.keys(jobsByDate).sort().forEach(date => {
    const dayJobs = jobsByDate[date].jobs;

    // One commission span per day: earliest valid Comm Start to latest valid
    // Comm End across all of the day's jobs (gaps between jobs count as paid
    // drive time). See commSpanForDay.
    const empName = (employees.find(e => e.id === employeeId) || {}).name || employeeId;
    const span = commSpanForDay(dayJobs, (j, why) => {
      console.warn(`Comm time excluded: ${empName}, ${date}, ${j.fields['Customer Name'] || '(no customer)'}, ${j.fields['Comm Start']} -> ${j.fields['Comm End']}: ${why}`);
    });
    const grossHours = span.grossHours;
    if (span.used > 0) {
      console.log(`DEBUG daily hours: date=${date}, rowsUsed=${span.used}, grossHours=${grossHours}`);
    }

    // Lunch comes from the job record, not auto-calculated: the largest
    // positive Lunch among the day's jobs, subtracted once.
    let lunch = 0;
    dayJobs.forEach(j => {
      const l = j.fields['Lunch'];
      if (typeof l === 'number' && l > lunch) lunch = l;
    });
    if (lunch === 0) {
      lunch = grossHours >= 9 ? 0.5 : 0;
    }
    const netHours = grossHours - lunch;

    // Calculate effective revenue for the day (including discounts, excluding Non-Commission)
    // Not currently fed into Gross Wages (see totalRevenue below) — kept in
    // step with revenueShare anyway since it's still "revenue divided among
    // techs," per the 2026-09-24 GOAL brief's "every place" instruction.
    let dayRevenue = 0;
    dayJobs.forEach(j => {
      const jobType = j.fields['Job Type'];
      if (jobType !== 'Non-Commission') {
        const revenue = j.fields['Job Revenue'] || 0;
        dayRevenue += revenue * revenueShare(j.fields['Employee'] || [], employeeId, employeeCrewRole);
      }
    });

    // Sum hourly hours for the day (from Hrly Start/End)
    let dayHrlyHours = 0;
    dayJobs.forEach(j => {
      if (j.fields['Hrly Start']) {
        const start = timeFromISO(j.fields['Hrly Start']);
        const end = timeFromISO(j.fields['Hrly End']);
        dayHrlyHours += Math.max(0, end - start);
      }
    });

    dailyMetrics[date] = {
      grossHours,
      lunch,
      netHours,
      dayRevenue,
      dayHrlyHours,
      dayJobs
    };

    totalCommHours += grossHours;
    totalRevenue += dayRevenue;
  });

  console.log(`DEBUG computePayroll: ${Object.keys(dailyMetrics).length} days, totalCommHours=${totalCommHours}, totalRevenue=${totalRevenue}`);

  // STEP 3: Calculate daily OT
  // Bill lumps commission hours (net) + hourly hours together for the 8h daily OT threshold
  let dailyOT = 0;
  Object.entries(dailyMetrics).forEach(([date, dm]) => {
    const totalDayHours = dm.netHours + dm.dayHrlyHours;
    const dayOT = totalDayHours > 8 ? totalDayHours - 8 : 0;
    console.log(`DEBUG OT: date=${date}, grossHours=${dm.grossHours}, lunch=${dm.lunch}, netHours=${dm.netHours}, hrlyHours=${dm.dayHrlyHours}, totalDayHours=${totalDayHours}, dayOT=${dayOT}`);
    dailyOT += dayOT;
  });

  // STEP 4: Calculate weekly OT (using net comm hours + hourly hours per day, Monday start)
  const weekMap = {};
  Object.keys(dailyMetrics).forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00');
    const monday = getMonday(date);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    if (!weekMap[weekKey]) weekMap[weekKey] = 0;
    weekMap[weekKey] += dailyMetrics[dateStr].netHours + dailyMetrics[dateStr].dayHrlyHours;
  });

  let weeklyOT = 0;
  Object.values(weekMap).forEach(weekHours => {
    if (weekHours > 40) weeklyOT += weekHours - 40;
  });

  // STEP 5: Total OT hours = max of daily and weekly
  const totalOTHours = Math.max(dailyOT, weeklyOT);

  // STEP 6: Total hourly hours
  let totalHrlyHours = 0;
  Object.values(dailyMetrics).forEach(dm => {
    totalHrlyHours += dm.dayHrlyHours;
  });

  // STEP 7: Regular hours = total comm hours - OT hours
  const regularHours = totalCommHours - totalOTHours;

  // STEP 8: Commission earnings (sum across all commission jobs)
  //
  // Visit = same Job Date + same Customer Name (2026-09-24 GOAL brief).
  // Built from `jobs`, which is already filtered to this one employee — so
  // if a visit's discount line were recorded against different employees
  // than its multiplier job, this employee wouldn't see that discount row
  // and netting would silently skip it. Known limitation, not solved here.
  //
  // Interpretation note: "count the visit's non-discount job lines" (the
  // divisor for splitting a visit's discount) is read here as counting only
  // the visit's MULTIPLIER-type lines, not every billable line — so a
  // non-multiplier line sharing a visit with a multiplier line is left
  // untouched, matching "for every other job type, a discount stays its own
  // independent line, exactly as today." In every visit seen in the real
  // 9/9–9/23 data this divisor is 1, so the distinction doesn't move any
  // number this period; flag to Bill/Mikael if a visit ever mixes multiplier
  // and non-multiplier lines with a discount.
  const visitMultiplierCount = {};
  const visitDiscountTotal = {};
  jobs.forEach(j => {
    if (j.fields['Job Type'] === 'Non-Commission') return;
    const key = visitKey(j);
    const revenue = j.fields['Job Revenue'] || 0;
    if (revenue < 0) {
      // Discounts are identified by negative revenue, not job type name.
      visitDiscountTotal[key] = (visitDiscountTotal[key] || 0) + revenue;
    } else if (multiplierFor(j.fields['Job Type']) !== null) {
      visitMultiplierCount[key] = (visitMultiplierCount[key] || 0) + 1;
    }
  });

  let regComm = 0;
  Object.values(dailyMetrics).forEach(dm => {
    dm.dayJobs.forEach(j => {
      if (j.fields['Job Type'] === 'Non-Commission') return;

      const revenue = j.fields['Job Revenue'] || 0;
      const key = visitKey(j);
      const empIds = j.fields['Employee'] || [];

      // Flag any teammate on this job with no Crew Role, whoever ends up
      // selected — the warning banner names them so Bill can fix the data.
      empIds.forEach(id => {
        if (!employeeCrewRole[id]) {
          const emp = employees.find(e => e.id === id);
          if (emp) crewRoleWarnings.add(emp.name);
        }
      });

      // A discount already netted into a multiplier job at this visit must
      // not also be counted as its own line — skip it here.
      if (revenue < 0 && (visitMultiplierCount[key] || 0) > 0) return;

      const multiplier = multiplierFor(j.fields['Job Type']);
      let effectiveRevenue = revenue;
      if (multiplier !== null) {
        const count = visitMultiplierCount[key] || 1;
        const discountShare = (visitDiscountTotal[key] || 0) / count;
        effectiveRevenue = (revenue + discountShare) * multiplier;
      }

      const myShare = revenueShare(empIds, employeeId, employeeCrewRole);
      const rate = rateForEmployee(j, employeeId);
      regComm += effectiveRevenue * myShare * rate;
    });
  });

  // STEP 9: OT on commission
  // Note: Bill used to pay OT at 2.5x total (1x already in regComm + 1.5x here).
  // Bill confirmed (per CA OT law): OT hours paid at 1.5x TOTAL, not 2.5x.
  // regComm already includes 1x for OT hours, so we only add the 0.5x premium here.
  const otComm = totalCommHours > 0 && totalOTHours > 0 ? (regComm / totalCommHours) * 0.5 * totalOTHours : 0;
  const totalComm = regComm + otComm;

  // STEP 10: Average hourly commission
  const avgHourlyCommission = totalCommHours > 0 ? regComm / totalCommHours : 0;

  // STEP 11: Hourly pay
  const hourlyPay = totalHrlyHours * employeeHourlyRate;

  // STEP 12: Safety net check (hardcoded $17)
  const SAFETY_NET_THRESHOLD = 17;
  const safetyNetTriggered = avgHourlyCommission < SAFETY_NET_THRESHOLD;

  // STEP 13: Gross wages
  const grossWages = safetyNetTriggered
    ? (SAFETY_NET_THRESHOLD * regularHours) + (SAFETY_NET_THRESHOLD * 1.5 * totalOTHours) + hourlyPay
    : totalComm + hourlyPay;

  console.log(`DEBUG: regComm=${regComm.toFixed(2)}, otComm=${otComm.toFixed(2)}, totalComm=${totalComm.toFixed(2)}`);
  console.log(`DEBUG: avgHourlyComm=${avgHourlyCommission.toFixed(2)}, safetyNetTriggered=${safetyNetTriggered}`);
  console.log(`DEBUG: grossWages=${grossWages.toFixed(2)}`);

  return {
    'Reg Commission': Math.round(regComm * 100) / 100,
    'OT on Commission': Math.round(otComm * 100) / 100,
    'Total Commission': Math.round(totalComm * 100) / 100,
    'Commission Hours': Math.round(totalCommHours * 10) / 10,
    'Regular Hours': Math.round(regularHours * 10) / 10,
    'OT Hours': Math.round(totalOTHours * 10) / 10,
    'Average Hourly Commission': Math.round(avgHourlyCommission * 100) / 100,
    'Hourly Hours': Math.round(totalHrlyHours * 10) / 10,
    'Hourly Pay': Math.round(hourlyPay * 100) / 100,
    'Safety Net Triggered': safetyNetTriggered,
    'Gross Wages': Math.round(grossWages * 100) / 100
  };
}

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.add('visible');
  window.scrollTo(0, 0);
}

function hideError() {
  document.getElementById('error-msg').classList.remove('visible');
}

// Data-quality warning, not a blocking error: names every employee seen so
// far (across calculations this session) with no Crew Role set, so Bill can
// fix the Employees table rather than silently getting a Helper-defaulted
// split. Accumulates rather than resetting per-calculation, since it's a
// standing data problem, not a per-run one.
function renderCrewRoleWarning() {
  const el = document.getElementById('crew-role-warning');
  if (!el) return;
  if (crewRoleWarnings.size === 0) {
    el.classList.remove('visible');
    el.textContent = '';
    return;
  }
  const names = Array.from(crewRoleWarnings).sort().join(', ');
  el.textContent = `No Crew Role set for: ${names}. Treated as Helper in the revenue split — fix in the Employees table.`;
  el.classList.add('visible');
}

function editPayroll(ppId) {
  selectedPpId = ppId;
  const pp = payPeriods.find(p => p.id === ppId);
  const msg = `Recalculate payroll for ${esc(selectedEmpName)} — ${esc(pp ? pp.name : 'Unknown')}? This will overwrite the existing record.`;
  showConfirm(msg, doCalculate);
}

init();