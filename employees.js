/* employees.js — shared "which employees show up in a name picker" logic.
 *
 * Both the job form and the PTO form need the exact same tech list: active
 * employees whose Role is Field Supervisor or Tech 1-4 (Admin/Manager roles
 * and deactivated employees never show up in a time-entry picker). This file
 * is the one place that filter lives, so the two pickers can't drift apart.
 *
 * jobs/index.html currently has its own inline copy of this same filter
 * (added before this file existed). It was intentionally left as-is rather
 * than pointed at this module, because the job form is frozen during Bill's
 * live payroll test (see project-state.md) — a next-session cleanup should
 * switch it over once that window closes.
 */
(function (global) {
  'use strict';

  var TIME_ENTRY_ROLES = ['Field Supervisor', 'Tech 1', 'Tech 2', 'Tech 3', 'Tech 4'];

  // Returns [{ id, name }] for active field techs/supervisors, sorted by name.
  // `fetchFn` lets callers pass their own timeout-wrapped fetch.
  function loadFieldEmployees(baseId, headers, fetchFn) {
    var roleFormula = TIME_ENTRY_ROLES.map(function (r) { return "{Role}='" + r + "'"; }).join(',');
    var formula = encodeURIComponent('AND({Active Employee}=TRUE(), OR(' + roleFormula + '))');
    var url = 'https://api.airtable.com/v0/' + baseId + '/Employees?filterByFormula=' + formula +
      '&sort[0][field]=Name&sort[0][direction]=asc';
    return fetchFn(url, { headers: headers })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        return data.records.map(function (r) { return { id: r.id, name: r.fields.Name }; });
      });
  }

  global.MWCEmployees = {
    TIME_ENTRY_ROLES: TIME_ENTRY_ROLES,
    loadFieldEmployees: loadFieldEmployees
  };
})(window);
