/**
 * Bottom-sheet drum time picker
 * Usage: window.initTimePickers(rootEl?)
 * Attaches to every .fp-time input.
 * Stores 24h value in input.dataset.h24 ("HH:MM")
 * Displays 12h string in input.value ("7:30 AM")
 */
(function () {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  /* ── Commission-time bounds: defined ONCE, here ──
   * Inputs marked data-tp-list="true" use the list picker below, which offers
   * only times from MIN_HOUR:00 to MAX_HOUR:00 in STEP_MIN steps, each labelled
   * with AM/PM. SOFT_* are the "is this correct?" thresholds (not blocks).
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

  /* ── List picker (bounded, AM/PM-labelled options only) ── */
  var listOverlay, listBody, listCurrent = null;

  function buildList() {
    var style = document.createElement('style');
    style.textContent = `
      #tpl-overlay { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,0.45);
        display: flex; align-items: flex-end; justify-content: center; opacity: 0; pointer-events: none; transition: opacity .2s; }
      #tpl-overlay.tp-visible { opacity: 1; pointer-events: all; }
      #tpl-sheet { width: 100%; max-width: 500px; max-height: 70vh; background: #fff; border-radius: 24px 24px 0 0;
        display: flex; flex-direction: column; font-family: 'Plus Jakarta Sans', sans-serif; }
      #tpl-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px 12px; border-bottom: 1px solid #F3F4F6; }
      #tpl-title { font-size: 16px; font-weight: 700; color: #111827; }
      #tpl-cancel { font-size: 16px; font-weight: 500; color: #6B7280; background: none; border: none; cursor: pointer; font-family: inherit; }
      #tpl-body { overflow-y: auto; padding: 6px 16px calc(env(safe-area-inset-bottom, 0px) + 12px); }
      .tpl-opt { display: block; width: 100%; text-align: center; padding: 13px 0; font-size: 18px; font-weight: 600; color: #111827;
        background: none; border: none; border-radius: 12px; cursor: pointer; font-family: inherit; }
      .tpl-opt:hover { background: #F3F4F6; }
      .tpl-opt.tpl-sel { background: #111827; color: #fff; }
    `;
    document.head.appendChild(style);
    listOverlay = document.createElement('div');
    listOverlay.id = 'tpl-overlay';
    listOverlay.innerHTML = '<div id="tpl-sheet"><div id="tpl-header"><button id="tpl-cancel">Cancel</button>' +
      '<span id="tpl-title">Set Time</span><span style="width:48px"></span></div><div id="tpl-body"></div></div>';
    document.body.appendChild(listOverlay);
    listBody = document.getElementById('tpl-body');
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
      if (!opt || !listCurrent) return;
      listCurrent.dataset.h24 = opt.dataset.h24;
      listCurrent.value = opt.textContent;
      listCurrent.dispatchEvent(new Event('change', { bubbles: true }));
      closeList();
    });
    document.getElementById('tpl-cancel').addEventListener('click', closeList);
    listOverlay.addEventListener('click', function (e) { if (e.target === listOverlay) closeList(); });
  }

  function openList(input) {
    if (!listOverlay) buildList();
    listCurrent = input;
    document.getElementById('tpl-title').textContent = input.dataset.tpTitle || 'Set Time';
    var cur = input.dataset.h24 || '';
    var target = null;
    listBody.querySelectorAll('.tpl-opt').forEach(function (o) {
      var sel = o.dataset.h24 === cur;
      o.classList.toggle('tpl-sel', sel);
      if (sel) target = o;
    });
    listOverlay.classList.add('tp-visible');
    document.body.style.overflow = 'hidden';
    // Scroll the current value (or 8:00 AM, a sensible starting area) into view.
    var focus = target || listBody.querySelector('[data-h24="08:00"]');
    if (focus) listBody.scrollTop = Math.max(0, focus.offsetTop - listBody.clientHeight / 2 + focus.offsetHeight / 2);
  }

  function closeList() {
    listOverlay.classList.remove('tp-visible');
    document.body.style.overflow = '';
    listCurrent = null;
  }

  let overlay, sheet, hourDrum, minDrum, ampmBtns;
  let currentInput = null;
  let isModified = false;

  /* ── Build the sheet once ── */
  function build() {
    const style = document.createElement('style');
    style.textContent = `
      #tp-overlay {
        position: fixed; inset: 0; z-index: 10001;
        background: rgba(0,0,0,0.45);
        display: flex; align-items: flex-end; justify-content: center;
        opacity: 0; pointer-events: none;
        transition: opacity 0.25s;
      }
      #tp-overlay.tp-visible { opacity: 1; pointer-events: all; }
      #tp-sheet {
        width: 100%; max-width: 500px;
        background: #fff;
        border-radius: 24px 24px 0 0;
        padding-bottom: env(safe-area-inset-bottom, 16px);
        transform: translateY(100%);
        transition: transform 0.32s cubic-bezier(.32,.72,0,1);
        font-family: 'Plus Jakarta Sans', sans-serif;
        overflow: hidden;
      }
      #tp-overlay.tp-visible #tp-sheet { transform: translateY(0); }
      #tp-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 24px 16px;
        border-bottom: 1px solid #F3F4F6;
      }
      #tp-cancel-btn {
        font-size: 16px; font-weight: 500; color: #6B7280;
        background: none; border: none; cursor: pointer; padding: 4px 0;
        font-family: inherit;
      }
      #tp-title { font-size: 16px; font-weight: 700; color: #111827; }
      #tp-set-btn {
        font-size: 16px; font-weight: 700; color: #D97706;
        background: none; border: none; cursor: pointer; padding: 4px 0;
        font-family: inherit;
      }
      #tp-drums {
        display: flex; align-items: center; justify-content: center;
        gap: 0; padding: 8px 24px 16px; position: relative;
      }
      #tp-highlight {
        position: absolute; left: 50%; transform: translateX(-50%);
        width: 230px; height: 56px;
        background: #F3F4F6; border-radius: 14px;
        pointer-events: none;
      }
      .tp-drum {
        width: 76px; height: 168px;
        overflow-y: scroll; scroll-snap-type: y mandatory;
        -webkit-overflow-scrolling: touch; scrollbar-width: none;
        position: relative; z-index: 1;
      }
      .tp-drum::-webkit-scrollbar { display: none; }
      .tp-drum-pad { height: 56px; }
      .tp-drum-item {
        height: 56px; display: flex; align-items: center; justify-content: center;
        font-size: 30px; font-weight: 700; color: #111827;
        scroll-snap-align: center; cursor: pointer;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      #tp-colon {
        font-size: 30px; font-weight: 700; color: #111827;
        position: relative; z-index: 1; margin: 0 2px; line-height: 56px;
        align-self: center;
      }
      #tp-ampm {
        display: flex; flex-direction: column; gap: 6px;
        margin-left: 14px; position: relative; z-index: 1;
      }
      .tp-ampm-btn {
        padding: 10px 14px; border-radius: 10px;
        font-size: 13px; font-weight: 700; border: none; cursor: pointer;
        font-family: inherit; transition: background 0.15s, color 0.15s;
      }
      .tp-ampm-btn.active { background: #111827; color: #fff; }
      .tp-ampm-btn:not(.active) { background: #F3F4F6; color: #6B7280; }
      #tp-fade-top, #tp-fade-bot {
        position: absolute; left: 0; right: 0; height: 56px; pointer-events: none; z-index: 2;
      }
      #tp-fade-top { top: 8px; background: linear-gradient(to bottom, #fff 30%, transparent); border-radius: 0; }
      #tp-fade-bot { bottom: 16px; background: linear-gradient(to top, #fff 30%, transparent); }
    `;
    document.head.appendChild(style);

    overlay = document.createElement('div');
    overlay.id = 'tp-overlay';
    overlay.innerHTML = `
      <div id="tp-sheet">
        <div id="tp-header">
          <button id="tp-cancel-btn">Cancel</button>
          <span id="tp-title">Set Time</span>
          <button id="tp-set-btn">Set</button>
        </div>
        <div id="tp-drums">
          <div id="tp-highlight"></div>
          <div id="tp-fade-top"></div>
          <div class="tp-drum" id="tp-hour-drum"></div>
          <span id="tp-colon">:</span>
          <div class="tp-drum" id="tp-min-drum"></div>
          <div id="tp-ampm">
            <button class="tp-ampm-btn active" data-val="AM">AM</button>
            <button class="tp-ampm-btn" data-val="PM">PM</button>
          </div>
          <div id="tp-fade-bot"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    hourDrum = document.getElementById('tp-hour-drum');
    minDrum  = document.getElementById('tp-min-drum');
    ampmBtns = overlay.querySelectorAll('.tp-ampm-btn');

    // Build hour drum 1–12
    buildDrum(hourDrum, Array.from({ length: 12 }, (_, i) => pad(i + 1)));
    // Build minute drum 00–55 in 5-min steps
    buildDrum(minDrum, Array.from({ length: 12 }, (_, i) => pad(i * 5)));

    // Mouse wheel support for desktop
    [hourDrum, minDrum].forEach(drum => {
      drum.addEventListener('wheel', function (e) {
        e.preventDefault();
        drum.scrollBy({ top: e.deltaY > 0 ? 56 : -56, behavior: 'smooth' });
      }, { passive: false });
    });

    document.getElementById('tp-cancel-btn').addEventListener('click', handleCancel);
    document.getElementById('tp-set-btn').addEventListener('click', applyTime);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    ampmBtns.forEach(btn => {
      btn.addEventListener('click', function () {
        ampmBtns.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        markModified();
      });
    });

    // Track changes on drums
    [hourDrum, minDrum].forEach(drum => {
      drum.addEventListener('scroll', markModified);
    });
  }

  function buildDrum(drum, values) {
    drum.appendChild(makePad());
    values.forEach((v, i) => {
      const el = document.createElement('div');
      el.className = 'tp-drum-item';
      el.textContent = v;
      el.dataset.val = v;
      el.addEventListener('click', function () {
        drum.scrollTo({ top: i * 56, behavior: 'smooth' });
      });
      drum.appendChild(el);
    });
    drum.appendChild(makePad());
  }

  function makePad() {
    const d = document.createElement('div');
    d.className = 'tp-drum-pad';
    return d;
  }

  function scrollTo(drum, val) {
    const items = drum.querySelectorAll('.tp-drum-item');
    const idx = [...items].findIndex(el => el.dataset.val === val);
    if (idx >= 0) drum.scrollTop = idx * 56;
  }

  function getVal(drum) {
    const idx = Math.round(drum.scrollTop / 56);
    const items = drum.querySelectorAll('.tp-drum-item');
    return (items[idx] || items[0]).dataset.val;
  }

  function markModified() {
    isModified = true;
    updateCancelButton();
  }

  function updateCancelButton() {
    const btn = document.getElementById('tp-cancel-btn');
    const isHourlyField = currentInput && (currentInput.id === 'hrly-start' || currentInput.id === 'hrly-end');

    if (isHourlyField && !isModified) {
      btn.textContent = 'Clear';
      btn.style.fontSize = '16px';
    } else {
      btn.textContent = 'Cancel';
      btn.style.fontSize = '16px';
    }
  }

  function handleCancel() {
    const isHourlyField = currentInput && (currentInput.id === 'hrly-start' || currentInput.id === 'hrly-end');

    if (isHourlyField && !isModified) {
      // Clear both hourly start and end
      const hrlyStart = document.getElementById('hrly-start');
      const hrlyEnd = document.getElementById('hrly-end');

      hrlyStart.value = '';
      hrlyStart.dataset.h24 = '';
      hrlyEnd.value = '';
      hrlyEnd.dataset.h24 = '';

      hrlyStart.dispatchEvent(new Event('change', { bubbles: true }));
      hrlyEnd.dispatchEvent(new Event('change', { bubbles: true }));
    }

    close();
  }

  function open(input) {
    if (!overlay) build();
    currentInput = input;
    isModified = false;

    // Parse existing value
    const h24 = input.dataset.h24 || '';
    let h = 12, m = 0, ampm = 'AM';
    if (h24) {
      const parts = h24.split(':');
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      ampm = hh < 12 ? 'AM' : 'PM';
      h = hh % 12 || 12;
      m = Math.round(mm / 5) * 5; // round to nearest 5
      if (m >= 60) m = 55;
    }

    scrollTo(hourDrum, pad(h));
    scrollTo(minDrum, pad(m));
    ampmBtns.forEach(b => b.classList.toggle('active', b.dataset.val === ampm));

    updateCancelButton();
    overlay.classList.add('tp-visible');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.remove('tp-visible');
    document.body.style.overflow = '';
    currentInput = null;
  }

  function applyTime() {
    const hStr = getVal(hourDrum);
    const mStr = getVal(minDrum);
    const ampm = overlay.querySelector('.tp-ampm-btn.active').dataset.val;

    let h = parseInt(hStr, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    const h24 = `${pad(h)}:${mStr}`;
    const display = `${parseInt(hStr, 10)}:${mStr} ${ampm}`;

    currentInput.dataset.h24 = h24;
    currentInput.value = display;
    currentInput.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  }

  // Display string for an "HH:MM" 24h value, same format the pickers show.
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
      input.addEventListener('click', function () {
        if (input.dataset.tpList === 'true') openList(input); else open(input);
      });
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
