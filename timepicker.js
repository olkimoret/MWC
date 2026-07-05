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
