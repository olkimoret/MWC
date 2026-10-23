/**
 * Bottom-sheet time picker: the one time picker used across the app.
 * Usage: window.initTimePickers(rootEl?)
 * Attaches to every .fp-time input.
 * Stores 24h value in input.dataset.h24 ("HH:MM")
 * Displays 12h string in input.value ("7:30 AM")
 *
 * Optional per-input attributes:
 *   data-default="HH:MM"            value pre-filled on init
 *   data-tp-title="Hourly Start"    sheet title
 *   data-tp-anchor="HH:MM"          where the list opens when no value is set (default 08:00)
 *   data-tp-clear="id1 id2"         shows a Clear button that empties those inputs
 */
(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ── Time bounds: defined ONCE, here ──
   * The picker offers only times from MIN_HOUR:00 to MAX_HOUR:00 in STEP_MIN
   * steps, each labelled with AM/PM. SOFT_* are the "is this correct?" thresholds
   * the job form applies to commission times (not blocks).
   *
   * Relation to payroll/payroll.js (commSpanForDay): the payroll page EXCLUDES a
   * commission row whose start is before 5:00 or whose end is after 21:00 (likely
   * AM/PM typos). The picker range must sit inside that, so nothing the form
   * accepts can be dropped by payroll. payroll.js hardcodes 5 and 21 and is not
   * changed here; the mirror constants + check below make a future edit to either
   * side fail loudly in the console instead of silently dropping hours. */
  var BOUNDS = {
    MIN_HOUR: 6, MAX_HOUR: 20, STEP_MIN: 5,
    SOFT_START_HOUR: 7, SOFT_END_HOUR: 18,
    PAYROLL_EXCLUDE_BEFORE_HOUR: 5, PAYROLL_EXCLUDE_AFTER_HOUR: 21   // mirror of payroll.js
  };
  if (BOUNDS.MIN_HOUR < BOUNDS.PAYROLL_EXCLUDE_BEFORE_HOUR || BOUNDS.MAX_HOUR > BOUNDS.PAYROLL_EXCLUDE_AFTER_HOUR) {
    console.error('timepicker bounds fall outside payroll.js exclusion limits — payroll would drop these rows');
  }
  window.MWC_TIME_BOUNDS = BOUNDS;

  function label12(h24, m) {
    var ap = h24 < 12 ? 'AM' : 'PM';
    return (h24 % 12 || 12) + ':' + pad(m) + ' ' + ap;
  }

  var overlay, listBody, clearBtn, current = null;

  function build() {
    var style = document.createElement('style');
    style.textContent = `
      #tpl-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,0.45);
        display: flex; align-items: flex-end; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s; }
      #tpl-overlay.tp-visible { opacity: 1; pointer-events: all; }
      #tpl-sheet { width: 100%; max-width: 500px; max-height: 70vh; background: #fff; border-radius: 24px 24px 0 0;
        display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', sans-serif; }
      #tpl-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px 12px; border-bottom: 1px solid #F3F4F6; }
      #tpl-title { font-size: 16px; font-weight: 700; color: #111827; }
      #tpl-cancel, #tpl-clear { font-size: 16px; font-weight: 500; color: #6B7280; background: none; border: none; cursor: pointer; font-family: inherit; min-width: 48px; }
      #tpl-cancel { text-align: left; }
      #tpl-clear { text-align: right; }
      #tpl-body { overflow-y: auto; padding: 6px 16px calc(env(safe-area-inset-bottom, 0px) + 12px); }
      .tpl-opt { display: block; width: 100%; text-align: center; padding: 13px 0; font-size: 18px; font-weight: 600; color: #111827;
        background: none; border: none; border-radius: 12px; cursor: pointer; font-family: inherit; }
      .tpl-opt:hover { background: #F3F4F6; }
      .tpl-opt.tpl-sel { background: #111827; color: #fff; }
    `;
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.id = 'tpl-overlay';
    overlay.innerHTML = '<div id="tpl-sheet"><div id="tpl-header"><button type="button" id="tpl-cancel">Cancel</button>' +
      '<span id="tpl-title">Set Time</span><button type="button" id="tpl-clear">Clear</button></div><div id="tpl-body"></div></div>';
    document.body.appendChild(overlay);
    listBody = document.getElementById('tpl-body');
    clearBtn = document.getElementById('tpl-clear');
    for (var h = BOUNDS.MIN_HOUR; h <= BOUNDS.MAX_HOUR; h++) {
      for (var m = 0; m < 60; m += BOUNDS.STEP_MIN) {
        if (h === BOUNDS.MAX_HOUR && m > 0) break;       // last option is MAX_HOUR:00 exactly
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'tpl-opt';
        b.dataset.h24 = pad(h) + ':' + pad(m);
        b.textContent = label12(h, m);
        listBody.appendChild(b);
      }
    }
    listBody.addEventListener('click', function (e) {
      var opt = e.target.closest('.tpl-opt');
      if (!opt || !current) return;
      current.dataset.h24 = opt.dataset.h24;
      current.value = opt.textContent;
      current.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    });
    clearBtn.addEventListener('click', function () {
      if (!current) return;
      (current.dataset.tpClear || '').split(/\s+/).filter(Boolean).forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.value = '';
        el.dataset.h24 = '';
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      close();
    });
    document.getElementById('tpl-cancel').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
  }

  function open(input) {
    if (!overlay) build();
    current = input;
    document.getElementById('tpl-title').textContent = input.dataset.tpTitle || 'Set Time';
    clearBtn.style.visibility = input.dataset.tpClear ? 'visible' : 'hidden';
    var cur = input.dataset.h24 || '';
    var target = null;
    listBody.querySelectorAll('.tpl-opt').forEach(function (o) {
      var sel = o.dataset.h24 === cur;
      o.classList.toggle('tpl-sel', sel);
      if (sel) target = o;
    });
    overlay.classList.add('tp-visible');
    document.body.style.overflow = 'hidden';
    // Scroll the current value (or the input's anchor, default 8:00 AM) into view.
    var focus = target || listBody.querySelector('[data-h24="' + (input.dataset.tpAnchor || '08:00') + '"]');
    if (focus) listBody.scrollTop = Math.max(0, focus.offsetTop - listBody.clientHeight / 2 + focus.offsetHeight / 2);
  }

  function close() {
    overlay.classList.remove('tp-visible');
    document.body.style.overflow = '';
    current = null;
  }

  // Display string for an "HH:MM" 24h value, same format the picker shows.
  window.mwcTimeLabel = function (h24) {
    var p = String(h24 || '').split(':');
    var h = parseInt(p[0], 10), m = parseInt(p[1], 10);
    return isNaN(h) || isNaN(m) ? '' : label12(h, m);
  };

  window.initTimePickers = function (root) {
    if (!overlay) build();
    const scope = root || document;
    scope.querySelectorAll('.fp-time').forEach(function (input) {
      if (input.dataset.tpInit) return;
      input.dataset.tpInit = 'true';
      input.addEventListener('click', function () { open(input); });
      // Restore display if default value present
      const def = input.dataset.default;
      if (def) {
        const parts = def.split(':');
        const hh = parseInt(parts[0], 10);
        const mm = parseInt(parts[1], 10);
        if (!isNaN(hh)) {
          const ap = hh < 12 ? 'AM' : 'PM';
          const h12 = hh % 12 || 12;
          input.value = `${h12}:${pad(mm)} ${ap}`;
          input.dataset.h24 = def;
        }
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.initTimePickers(); });
  } else {
    window.initTimePickers();
  }
})();
