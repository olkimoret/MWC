/* employees.js — shared "which employees show up in a name picker" logic.
 *
 * The job form (name picker + crew picker) and the PTO form need the exact
 * same tech list: active employees whose Role is Field Supervisor or Tech 1-4
 * (Admin/Manager roles and deactivated employees never show up in a
 * time-entry picker). This file is the one place that filter lives, so the
 * pickers can't drift apart.
 */
(function (global) {
  'use strict';

  var TIME_ENTRY_ROLES = ['Field Supervisor', 'Tech 1', 'Tech 2', 'Tech 3', 'Tech 4'];

  // Returns [{ id, name, crewRole }] for active field techs/supervisors, sorted
  // by name. crewRole is 'Driver' / 'Helper' / '' (not set).
  // `fetchFn` lets callers pass their own timeout-wrapped fetch.
  function loadFieldEmployees(baseId, headers, fetchFn) {
    var roleFormula = TIME_ENTRY_ROLES.map(function (r) { return "{Role}='" + r + "'"; }).join(',');
    var formula = encodeURIComponent('AND({Active Employee}=TRUE(), OR(' + roleFormula + '))');
    var url = 'https://api.airtable.com/v0/' + baseId + '/Employees?filterByFormula=' + formula +
      '&sort[0][field]=Name&sort[0][direction]=asc';
    return fetchFn(url, { headers: headers })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        return data.records.map(function (r) {
          return { id: r.id, name: r.fields.Name, crewRole: r.fields['Crew Role'] || '' };
        });
      });
  }

  // Everyone, unfiltered, as { id: { id, name, crewRole } }. Only for LOOKING UP
  // people already attached to a job (e.g. an Admin or a deactivated tech who is
  // on a row's Employee field) — never use this to populate a picker.
  function loadEmployeeDirectory(baseId, headers, fetchFn) {
    var url = 'https://api.airtable.com/v0/' + baseId + '/Employees?sort[0][field]=Name&sort[0][direction]=asc';
    return fetchFn(url, { headers: headers })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var out = {};
        data.records.forEach(function (r) {
          out[r.id] = { id: r.id, name: r.fields.Name, crewRole: r.fields['Crew Role'] || '' };
        });
        return out;
      });
  }

  global.MWCEmployees = {
    TIME_ENTRY_ROLES: TIME_ENTRY_ROLES,
    loadFieldEmployees: loadFieldEmployees,
    loadEmployeeDirectory: loadEmployeeDirectory
  };
})(window);
