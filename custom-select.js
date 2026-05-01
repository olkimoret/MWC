/**
 * Custom Select — replaces native <select> inside .select-wrapper
 * Dropdown is portalled to <body> to escape overflow:hidden card containers.
 * Usage: call initCustomSelects(root?) after DOM is ready or after dynamic rendering.
 */
(function () {

  // One shared portal panel per page
  let activePanel = null;
  let activeWrapper = null;

  function buildPortalPanel() {
    const panel = document.createElement('div');
    panel.className = 'cs-dropdown';
    document.body.appendChild(panel);
    return panel;
  }

  // Lazily created shared portal
  function getPortal() {
    if (!activePanel) {
      activePanel = buildPortalPanel();
    }
    return activePanel;
  }

  function positionPanel(wrapper) {
    const panel = getPortal();
    // Always ensure panel lives on <body> to escape any overflow:hidden ancestor
    if (panel.parentElement !== document.body) {
      document.body.appendChild(panel);
    }
    const rect = wrapper.getBoundingClientRect();
    const VH = window.innerHeight;
    const spaceBelow = VH - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const ideal = 360;

    panel.style.position = 'fixed';
    panel.style.left = rect.left + 'px';
    panel.style.width = rect.width + 'px';
    panel.style.zIndex = '9999';

    if (spaceBelow >= spaceAbove) {
      panel.style.top = (rect.bottom + 5) + 'px';
      panel.style.bottom = '';
      panel.style.maxHeight = Math.min(ideal, spaceBelow) + 'px';
    } else {
      panel.style.bottom = (VH - rect.top + 5) + 'px';
      panel.style.top = '';
      panel.style.maxHeight = Math.min(ideal, spaceAbove) + 'px';
    }
  }

  function buildDropdown(wrapper, select) {
    // Trigger
    const trigger = document.createElement('div');
    trigger.className = 'cs-trigger';
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('tabindex', '0');
    trigger.innerHTML = `
      <span class="cs-value placeholder"></span>
      <svg class="cs-chevron" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.2" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>`;

    wrapper.classList.add('cs-wrapper');
    wrapper.appendChild(trigger);

    // Hide native select
    select.style.cssText = 'position:absolute;opacity:0;pointer-events:none;width:0;height:0;';

    function renderOptions() {
      const panel = getPortal();
      panel.innerHTML = '';
      Array.from(select.options).forEach((opt) => {
        const item = document.createElement('div');
        item.className = 'cs-option' +
          (opt.value === '' ? ' cs-placeholder' : '') +
          (opt.selected ? ' selected' : '');
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        item.addEventListener('mousedown', (e) => {
          e.preventDefault(); // prevent blur before click registers
        });
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          syncValue();
          close();
        });
        panel.appendChild(item);
      });
    }

    function syncValue() {
      const val = trigger.querySelector('.cs-value');
      const selected = select.options[select.selectedIndex];
      if (!selected || selected.value === '') {
        val.textContent = selected ? selected.textContent : '—';
        val.className = 'cs-value placeholder';
      } else {
        val.textContent = selected.textContent;
        val.className = 'cs-value';
      }
    }

    function open() {
      // Close any other open wrapper
      if (activeWrapper && activeWrapper !== wrapper) {
        activeWrapper.classList.remove('open');
      }
      renderOptions();
      positionPanel(wrapper);
      const panel = getPortal();
      panel.classList.add('cs-open');
      wrapper.classList.add('open');
      activeWrapper = wrapper;
    }

    function close() {
      const panel = getPortal();
      panel.classList.remove('cs-open');
      wrapper.classList.remove('open');
      if (activeWrapper === wrapper) activeWrapper = null;
    }

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      wrapper.classList.contains('open') ? close() : open();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        wrapper.classList.contains('open') ? close() : open();
      }
      if (e.key === 'Escape') close();
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!wrapper.contains(e.target)) {
        const panel = getPortal();
        if (!panel.contains(e.target)) close();
      }
    });

    // Reposition on scroll / resize while open
    window.addEventListener('scroll', () => {
      if (wrapper.classList.contains('open')) positionPanel(wrapper);
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (wrapper.classList.contains('open')) positionPanel(wrapper);
    }, { passive: true });

    // Watch for dynamic option changes
    const mo = new MutationObserver(() => {
      if (wrapper.classList.contains('open')) renderOptions();
      syncValue();
    });
    mo.observe(select, { childList: true, subtree: true, attributes: true });

    select._csRefresh = syncValue;
    wrapper._csRefresh = syncValue;

    syncValue();
  }

  window.initCustomSelects = function (root) {
    const scope = root || document;
    scope.querySelectorAll('.select-wrapper').forEach(wrapper => {
      if (wrapper.dataset.customized) return;
      const select = wrapper.querySelector('select');
      if (!select) return;
      wrapper.dataset.customized = 'true';
      buildDropdown(wrapper, select);
    });
  };

  window.refreshCustomSelect = function (selectEl) {
    if (selectEl && selectEl._csRefresh) selectEl._csRefresh();
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.initCustomSelects());
  } else {
    window.initCustomSelects();
  }

})();
