const AIRTABLE_BASE_ID = 'appVXuyAYj47nZwyz';
const AIRTABLE_PAT = 'pat51Bpz1DmsTICb1.4cc6011c585d7167d45c6214905f55c09fe042e18742b3fdd53f09646cfb00a0';

const headers = {
  'Authorization': `Bearer ${AIRTABLE_PAT}`,
  'Content-Type': 'application/json'
};

let employees = [];
let employeeHourlyRates = {};
let payPeriods = [];
let payrollRecords = [];
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

    document.getElementById('loading-screen').style.display = 'none';
    renderTeamView();

  } catch (e) {
    document.getElementById('loading-screen').style.display = 'none';
    showError('Could not load payroll data. Check your connection.');
  }
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

    totalWages += grossWages;

    const tr = document.createElement('tr');
    tr.onclick = () => selectEmployee(emp.id, emp.name);
    tr.innerHTML = `
      <td class="col-name">${esc(emp.name)}</td>
      <td class="col-amount">${payroll ? fmt(grossWages) : '—'}</td>
      <td class="col-hours">${payroll ? fmtH(regHours) : '—'}</td>
      <td class="col-hours">${payroll ? fmtH(otHours) : '—'}</td>
      <td>${safetyNet ? '<span class="badge-safety">Safety Net</span>' : ''}</td>
      <td class="col-status">${payroll ? '<span class="status-ok">✓</span>' : '<span class="status-missing">Not calculated</span>'}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('total-wages').textContent = fmt(totalWages);
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

async function showCalculate() {
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

  // For each candidate period, check if employee has jobs in that period
  for (const pp of completedWithoutPayroll) {
    try {
      const jobsInPeriod = await fetchJobsForPeriod(pp.startDate, pp.endDate);
      const hasJobForEmp = jobsInPeriod.some(j => {
        const empIds = j.fields.Employee || [];
        const ppIds = j.fields['Pay Period'] || [];
        const commStart = j.fields['Comm Start'];
        const jobType = j.fields['Job Type'];
        return empIds.includes(selectedEmpId) && ppIds.includes(pp.id) && commStart && jobType !== 'Non-Commission';
      });

      if (hasJobForEmp) {
        const option = document.createElement('option');
        option.value = pp.id;
        option.textContent = pp.name;
        select.appendChild(option);
      }
    } catch (e) {
      // If fetch fails, include the period anyway (fail open)
      const option = document.createElement('option');
      option.value = pp.id;
      option.textContent = pp.name;
      select.appendChild(option);
    }
  }

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
    'Employee','Pay%20Period','Number%20of%20Techs','Lunch'
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
    const payrollFields = computePayroll(jobs, employeeHourlyRate);
    console.log('Payroll fields to write:', payrollFields);

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

function computePayroll(jobs, employeeHourlyRate) {
  // Helper: parse ISO datetime string to decimal hours
  function timeFromISO(isoStr) {
    if (!isoStr) return 0;
    const date = new Date(isoStr);
    return date.getHours() + date.getMinutes() / 60;
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

    // Use ONLY the first job with Comm Start filled - one time block per day
    const firstCommJob = dayJobs
      .filter(j => j.fields['Comm Start'] && j.fields['Comm End'])
      .sort((a, b) => {
  const normalize = s => s.endsWith('Z') || s.includes('+') ? s : s + 'Z';
  return new Date(normalize(a.fields['Comm Start'])) - new Date(normalize(b.fields['Comm Start']));
})[0];
    let grossHours = 0;
    if (firstCommJob) {
      const commStart = timeFromISO(firstCommJob.fields['Comm Start']);
      const commEnd = timeFromISO(firstCommJob.fields['Comm End']);
      grossHours = Math.max(0, commEnd - commStart);
      console.log(`DEBUG daily hours: date=${date}, commStartRaw=${firstCommJob.fields['Comm Start']}, commStart=${commStart}, commEnd=${commEnd}, grossHours=${grossHours}`);
    }

    // Lunch comes from the job record, not auto-calculated
    const lunchRaw = firstCommJob?.fields['Lunch'];
    let lunch = 0;
    if (typeof lunchRaw === 'number' && lunchRaw > 0) {
      lunch = lunchRaw;
    } else {
      lunch = grossHours >= 9 ? 0.5 : 0;
    }
    const netHours = grossHours - lunch;

    // Calculate effective revenue for the day (including discounts, excluding Non-Commission)
    let dayRevenue = 0;
    dayJobs.forEach(j => {
      const jobType = j.fields['Job Type'];
      if (jobType !== 'Non-Commission') {
        const numTechs = (j.fields['Employee'] || []).length || 1;
        const revenue = j.fields['Job Revenue'] || 0;
        dayRevenue += revenue / numTechs;
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

  // STEP 3: Calculate daily OT (using net hours, which already has lunch deducted)
  let dailyOT = 0;
  Object.entries(dailyMetrics).forEach(([date, dm]) => {
    const dayOT = dm.netHours > 8 ? dm.netHours - 8 : 0;
    console.log(`DEBUG OT: date=${date}, grossHours=${dm.grossHours}, lunch=${dm.lunch}, netHours=${dm.netHours}, dayOT=${dayOT}`);
    dailyOT += dayOT;
  });

  // STEP 4: Calculate weekly OT (using net hours per day, Monday start)
  const weekMap = {};
  Object.keys(dailyMetrics).forEach(dateStr => {
    const date = new Date(dateStr + 'T00:00:00');
    const monday = getMonday(date);
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    if (!weekMap[weekKey]) weekMap[weekKey] = 0;
    weekMap[weekKey] += dailyMetrics[dateStr].netHours;
  });

  let weeklyOT = 0;
  Object.values(weekMap).forEach(weekNetHours => {
    if (weekNetHours > 40) weeklyOT += weekNetHours - 40;
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
  let regComm = 0;
  Object.values(dailyMetrics).forEach(dm => {
    dm.dayJobs.forEach(j => {
      if (j.fields['Job Type'] !== 'Non-Commission') {
        const numTechs = (j.fields['Employee'] || []).length || 1;
        const revenue = j.fields['Job Revenue'] || 0;
        const rateRaw = j.fields['Commission Rate'];

        // Extract commission rate
        let rate = 0;
        if (typeof rateRaw === 'number') {
          rate = rateRaw;
        } else if (Array.isArray(rateRaw)) {
          for (const r of rateRaw) {
            if (typeof r === 'number' && r > 0) {
              rate = r;
              break;
            }
          }
        }

        const effectiveRevenue = revenue / numTechs;
        regComm += effectiveRevenue * rate;
      }
    });
  });

  // STEP 9: OT on commission
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

function editPayroll(ppId) {
  selectedPpId = ppId;
  const pp = payPeriods.find(p => p.id === ppId);
  const msg = `Recalculate payroll for ${esc(selectedEmpName)} — ${esc(pp ? pp.name : 'Unknown')}? This will overwrite the existing record.`;
  showConfirm(msg, doCalculate);
}

init();
