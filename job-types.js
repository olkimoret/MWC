/* job-types.js — shared Job Type normalization for the MWC app.
 *
 * WHY THIS EXISTS
 * Customer Factor lets staff type job types free-hand, so the same service
 * reaches Airtable under many spellings. Real examples from the live base:
 *   "BRONZE Window Cleaning:"  (trailing colon)      — 66 rows
 *   "blow off roof" vs "Roof Blow Off"               — same service, 2 spellings
 *   "Commercial WC: Interior & Exterior" / "- Int & Ext" / "- Interior & Exterior"
 *   "cobwebbing" / "Cobwebbing" / "cobbwebbing"      — case + typo
 *   "GOLD Window Cleaning: Main House"               — CF scope note appended
 * Every consumer in this app matches Job Type with exact string or Set lookups,
 * so an unrecognised spelling silently means NO checklist and NO OSHA step.
 * 87 distinct strings exist in the base; only ~17 matched before this file.
 *
 * Some rows also arrived from a broken Zapier sync as a single comma-joined
 * string of every service in the visit, e.g.
 *   "Roof Blow Off,Residential Gutter Cleaning,Skylight Cleaning: Exterior,House Wash"
 * parseJobTypes() splits those, so the app behaves correctly on those rows even
 * before they are repaired in Airtable.
 *
 * GUIDING RULE: when in doubt, fold toward MORE coverage. A spurious row on the
 * OSHA compliance report is harmless; a missing one is a real safety gap.
 * Anything unrecognised is returned cleaned but otherwise unchanged, which is
 * exactly the old behaviour — this file can only add matches, never remove them.
 */
(function (global) {
  'use strict';

  // Canonical spellings. Anything here is matched case-insensitively, so this
  // alone fixes every pure-casing variant.
  var CANONICAL = [
    // — checklist-bearing types (must stay in sync with JOB_TYPE_MAP in jobs/index.html)
    'House Wash',
    'SILVER Window Cleaning',
    'GOLD Window Cleaning',
    'BRONZE Window Cleaning',
    'Residential Gutter Cleaning',
    'Commercial Gutter Cleaning',
    'Skylight Cleaning',
    'Roof Cleaning',
    'Partial Roof Cleaning',
    'Slimguard',
    'Weekly Pool Cleaning Service',
    'Seam Repair',
    'Solar Panel Cleaning',
    'Driveway Pressure Cleaning',
    'Residential Pressure Washing',
    'Hard Water Removal',
    'Commercial WC - Exterior Only',
    // — real services with no checklist yet
    'Commercial WC - Interior & Exterior',
    'Commercial Pressure Cleaning',
    'Concrete Cleaning',
    'Patio Pressure Cleaning',
    'Roof Blow Off',
    'Clear Downspouts',
    'Cobwebbing',
    'Ceiling Fan Cleaning',
    'Mirror Cleaning',
    'Shower Door',
    'Solar Screens',
    'Screen Room Screen Cleaning',
    'Gutter Sticks',
    'Slimguard Gutter Protection',
    'Gutter Guard Removal',
    'Repair/Replace Slimguards',
    'Service Call',
    'Travel Fee',
    // — non-service lines
    'Discount',
    'Membership Discount',
    'Membership Annual Fee',
    'Non-Commission'
  ];

  // Explicit folds that the generic rules below cannot infer.
  // Keys are lower-cased; values must appear in CANONICAL.
  var ALIASES = {
    'blow off roof': 'Roof Blow Off',
    'cobbwebbing': 'Cobwebbing',
    'commercial wc: interior & exterior': 'Commercial WC - Interior & Exterior',
    'commercial wc - int & ext': 'Commercial WC - Interior & Exterior',
    'commercial wc: int & ext': 'Commercial WC - Interior & Exterior',
    'commercial pressure washing': 'Commercial Pressure Cleaning',
    'skylights': 'Skylight Cleaning',
    'clean ceiling fan': 'Ceiling Fan Cleaning',
    'clean moss on roof': 'Roof Cleaning',
    'roof moss treatment': 'Roof Cleaning',
    'mirror cleaning': 'Mirror Cleaning',
    'solar screens': 'Solar Screens',
    'screen room screen cleaning': 'Screen Room Screen Cleaning'
  };

  // OSHA-required by exact canonical name. The keyword net below catches the rest.
  var OSHA_EXACT = [
    'Residential Gutter Cleaning',
    'Commercial Gutter Cleaning',
    'Roof Cleaning',
    'Partial Roof Cleaning',
    'Skylight Cleaning'
  ];

  // Any work at height on a roof / gutter / skylight needs an assessment, whatever
  // CF happens to call it — this catches "Roof Blow Off", "gutter guards",
  // "Clean moss on roof", "Xmas 1st Floor Roof Line", and anything invented later.
  var OSHA_KEYWORDS = /\b(roof|gutter|skylight)/i;

  var canonicalByLower = {};
  for (var i = 0; i < CANONICAL.length; i++) {
    canonicalByLower[CANONICAL[i].toLowerCase()] = CANONICAL[i];
  }

  function lookup(s) {
    var k = s.toLowerCase();
    if (canonicalByLower[k]) return canonicalByLower[k];
    if (ALIASES[k]) return ALIASES[k];
    return null;
  }

  // Trailing punctuation CF leaves behind: "BRONZE Window Cleaning:" etc.
  function tidy(s) {
    return s.replace(/\s+/g, ' ').trim().replace(/[\s:;,\-.]+$/, '');
  }

  /**
   * Fold one raw Job Type string to its canonical spelling.
   * Unrecognised values come back tidied but otherwise unchanged.
   */
  function normalizeJobType(raw) {
    if (raw === null || raw === undefined) return '';
    var s = tidy(String(raw));
    if (!s) return '';

    var direct = lookup(s);
    if (direct) return direct;

    // CF appends a scope note after ':' / ';' / ' - ':
    //   "GOLD Window Cleaning: Main House", "Residential Gutter Cleaning; Main house",
    //   "GOLD Window Cleaning - Specific windows only"
    // If the part before the separator is a known type, fold to it.
    var m = s.match(/^(.*?)\s*[:;]\s*\S.*$/) || s.match(/^(.*?)\s+-\s+\S.*$/);
    if (m) {
      var head = tidy(m[1]);
      var viaHead = lookup(head);
      if (viaHead) return viaHead;
    }

    // Parenthetical scope: "BRONZE Window Cleaning (First Floor Only)", "SILVER Window Cleaning (P)"
    var p = s.match(/^(.*?)\s*\([^)]*\)\s*$/);
    if (p) {
      var base = tidy(p[1]);
      // Don't strip the parenthetical off a Disclaimer — it identifies which one.
      if (base && !/^disclaimer$/i.test(base)) {
        var viaBase = lookup(base);
        if (viaBase) return viaBase;
      }
    }

    return s;
  }

  /**
   * Split a Job Type cell into its individual services and normalize each.
   * Handles the comma-joined "combo rows" produced by the broken sync.
   * Returns a de-duplicated array, order preserved. Never returns empty strings.
   */
  function parseJobTypes(raw) {
    if (raw === null || raw === undefined) return [];
    var parts = String(raw).split(',');
    var out = [];
    var seen = {};
    for (var i = 0; i < parts.length; i++) {
      var v = normalizeJobType(parts[i]);
      if (!v) continue;
      var k = v.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      out.push(v);
    }
    return out;
  }

  function isDiscountLine(type) {
    return /discount/i.test(String(type || ''));
  }

  function isDisclaimerLine(type) {
    return /^\s*disclaimer\b/i.test(String(type || ''));
  }

  function isNonCommissionLine(type) {
    return /^\s*non-?commission\s*$/i.test(String(type || ''));
  }

  /** Billable services only — drops discounts, disclaimers and non-commission lines. */
  function billableJobTypes(raw) {
    return parseJobTypes(raw).filter(function (t) {
      return !isDiscountLine(t) && !isDisclaimerLine(t) && !isNonCommissionLine(t);
    });
  }

  /** Does this Job Type cell (single or comma-joined) require an OSHA assessment? */
  function requiresOsha(raw) {
    var types = billableJobTypes(raw);
    for (var i = 0; i < types.length; i++) {
      if (OSHA_EXACT.indexOf(types[i]) !== -1) return true;
      if (OSHA_KEYWORDS.test(types[i])) return true;
    }
    return false;
  }

  /** Human-readable label for banners/lists: billable services joined with ' · '. */
  function describeJobTypes(raw) {
    return billableJobTypes(raw).join(' · ');
  }

  /**
   * True when a single job type is something the app knows: a canonical service,
   * or a discount / disclaimer / non-commission line. Anything else is a spelling
   * or service CF has invented that the normalization map hasn't caught up with.
   * Empty is treated as recognized (nothing to flag).
   */
  function isRecognized(type) {
    var t = normalizeJobType(type);
    if (!t) return true;
    if (isDiscountLine(t) || isDisclaimerLine(t) || isNonCommissionLine(t)) return true;
    return Object.prototype.hasOwnProperty.call(canonicalByLower, t.toLowerCase());
  }

  /**
   * The services in a Job Type cell that the app does NOT recognise, normalized
   * and de-duplicated. Feeds the compliance report's "Unrecognised Job Types"
   * section so the map in this file can be maintained from real data.
   */
  function unrecognizedTypes(raw) {
    return parseJobTypes(raw).filter(function (t) { return !isRecognized(t); });
  }

  global.MWCJobTypes = {
    normalizeJobType: normalizeJobType,
    parseJobTypes: parseJobTypes,
    billableJobTypes: billableJobTypes,
    requiresOsha: requiresOsha,
    describeJobTypes: describeJobTypes,
    isRecognized: isRecognized,
    unrecognizedTypes: unrecognizedTypes,
    isDiscountLine: isDiscountLine,
    isDisclaimerLine: isDisclaimerLine,
    isNonCommissionLine: isNonCommissionLine,
    CANONICAL: CANONICAL.slice(),
    OSHA_EXACT: OSHA_EXACT
  };

  // Also expose the two most-used helpers directly, for brevity at call sites.
  global.normalizeJobType = normalizeJobType;
  global.parseJobTypes = parseJobTypes;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));

// Also usable from Node (the repair/validation scripts import it) so the browser
// and the scripts can never drift to different normalization rules.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = globalThis.MWCJobTypes;
}
