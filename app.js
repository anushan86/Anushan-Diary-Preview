// K1: recovery is allowed only for the actual last keyboard activation, never load/pointer paths.
const k1Focus = (() => {
  let keyboard = false, origin = null;
  document.addEventListener('keydown', (event) => {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return;
    keyboard = true; origin = event.target;
  }, true);
  document.addEventListener('pointerdown', () => { keyboard = false; origin = null; }, true);
  const visible = (el) => !!el && el.isConnected && !el.matches(':disabled') && !el.closest('[hidden], [inert]') && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  return Object.freeze({
    move(target, source) {
      if (!keyboard || !(origin instanceof Element) || !(typeof source === 'string' ? origin.closest(source) : source?.contains(origin)) || !visible(target)) return false;
      if (!target.matches('button, input, select, textarea, a[href], [tabindex]')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const bounds = target.getBoundingClientRect();
      if (bounds.top < 8 || bounds.left < 8 || bounds.bottom > innerHeight - 8 || bounds.right > innerWidth - 8) target.scrollIntoView({ block: 'center', inline: 'center' });
      return document.activeElement === target;
    }
  });
})();

(function () {
  'use strict';

  const CHECKPOINT_WEEK_START = new Date(2026, 7, 24);
  const TODAY = new Date(2026, 7, 29);
  const HOUR_START = 8;
  const HOUR_END = 20;
  const SLOTS_PER_HOUR = 2;

  const ASSETS = [
    { id: 'hall1', name: 'Hall 1', category: 'Halls', venue: 'Northside Leisure Centre', lane: true, tint: 'cobalt' },
    { id: 'hall2', name: 'Hall 2', category: 'Halls', venue: 'Northside Leisure Centre', lane: true, tint: 'cobalt' },
    { id: 'studio2', name: 'Studio 2', category: 'Studios', venue: 'Northside Leisure Centre', lane: true, tint: 'teal' },
    { id: 'studio1', name: 'Studio 1', category: 'Studios', venue: 'Northside Leisure Centre', lane: true, tint: 'teal' }
  ];

  const EVENTS = [
    { id: 'BK-10482', asset: 'studio2', date: '2026-08-28', start: 9, end: 13, type: 'confirmed', title: 'BK-10482', status: 'Confirmed · Occupied' },
    { id: 'BK-10501', asset: 'hall1', date: '2026-08-27', start: 10, end: 16, type: 'quotation', title: 'BK-10501', status: 'Quotation · Occupied' },
    { id: 'BLK-220', asset: 'hall2', date: '2026-08-29', allDay: true, type: 'block', title: 'BLK-220', status: 'Block' },
    { id: 'FNI-301', asset: 'studio2', date: '2026-08-30', start: 15, end: 17, type: 'facility-not-in-use', title: 'Studio 2', status: 'Facility not in use · Unavailable' }
  ];

  const TIMESLOT_CLASSIFICATION_KEYS = ['confirmed', 'quotation', 'blocked', 'facility-not-in-use'];
  const TIMESLOT_COLOUR_UNAVAILABLE_LABEL = 'System option colour unavailable';
  const TIMESLOT_SEMANTIC_FALLBACK_LABELS = {
    confirmed: 'Private confirmed',
    quotation: 'Private quotation',
    blocked: 'Blocked timeslot',
    'facility-not-in-use': 'Facility not in use'
  };

  let timeslotVisualOptions = null;

  if (!window.DiaryTimeslotOptionsProvider) {
    window.DiaryTimeslotOptionsProvider = {
      getTimeslotVisualOptions: async () => null
    };
  }

  function validateTimeslotColor(value) {
    if (!value || typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    try {
      return CSS.supports('color', trimmed);
    } catch {
      return false;
    }
  }

  function normalizeTimeslotVisualOptions(raw) {
    const normalized = {};
    TIMESLOT_CLASSIFICATION_KEYS.forEach((key) => {
      const entry = raw && typeof raw === 'object' ? raw[key] : null;
      const label = entry && typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : null;
      const color = entry && validateTimeslotColor(entry.color) ? entry.color.trim() : null;
      normalized[key] = { label, color };
    });
    return normalized;
  }

  function mapEventTypeToClassification(type) {
    if (type === 'block') return 'blocked';
    return type;
  }

  function getTimeslotClassificationEntry(type) {
    const key = mapEventTypeToClassification(type);
    if (!timeslotVisualOptions || !key) {
      return { label: null, color: null };
    }
    return timeslotVisualOptions[key] || { label: null, color: null };
  }

  function applyTimeslotVisual(el, type) {
    const entry = getTimeslotClassificationEntry(type);
    el.classList.add('timeslot-classified');
    if (entry.color) {
      el.classList.add('timeslot-coloured');
      el.classList.remove('timeslot-colour-unavailable');
      el.style.setProperty('--timeslot-color', entry.color);
    } else {
      el.classList.remove('timeslot-coloured');
      el.classList.add('timeslot-colour-unavailable');
      el.style.removeProperty('--timeslot-color');
    }
    return entry;
  }

  function resolveTimeslotLegendLabel(key, entry) {
    if (entry.label) return entry.label;
    const semantic = TIMESLOT_SEMANTIC_FALLBACK_LABELS[key] || key;
    if (entry.color) return semantic;
    return `${semantic} — ${TIMESLOT_COLOUR_UNAVAILABLE_LABEL}`;
  }

  function eventAccessibleLabel(ev) {
    const entry = getTimeslotClassificationEntry(ev.type);
    const colourCue = entry.color ? entry.label || ev.status : TIMESLOT_COLOUR_UNAVAILABLE_LABEL;
    return `${ev.title} — ${ev.status} — ${colourCue}`;
  }

  async function loadTimeslotVisualOptions() {
    const provider = window.DiaryTimeslotOptionsProvider;
    if (!provider || typeof provider.getTimeslotVisualOptions !== 'function') {
      timeslotVisualOptions = normalizeTimeslotVisualOptions(null);
      return;
    }
    try {
      const raw = await provider.getTimeslotVisualOptions();
      timeslotVisualOptions = normalizeTimeslotVisualOptions(raw);
    } catch {
      timeslotVisualOptions = normalizeTimeslotVisualOptions(null);
    }
  }

  function renderTimeslotLegend() {
    const host = $('#timeslot-colours-legend');
    if (!host) return;
    host.innerHTML = '';
    const title = document.createElement('span');
    title.className = 'timeslot-legend-title';
    title.textContent = 'Timeslot colours';
    host.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'timeslot-legend-list';
    const j1Legend = document.body.dataset.journey === '1';
    let missingColour = false;
    [
      { key: 'confirmed', cue: 'solid' },
      { key: 'quotation', cue: 'quotation' },
      { key: 'blocked', cue: 'hatch' },
      { key: 'facility-not-in-use', cue: 'muted' }
    ].forEach(({ key, cue }) => {
      const entry = (timeslotVisualOptions && timeslotVisualOptions[key]) || { label: null, color: null };
      const li = document.createElement('li');
      li.className = `timeslot-legend-item cue-${cue}`;
      const swatch = document.createElement('span');
      swatch.className = 'timeslot-legend-swatch';
      swatch.setAttribute('aria-hidden', 'true');
      if (entry.color) {
        swatch.classList.add('timeslot-coloured');
        swatch.style.setProperty('--timeslot-color', entry.color);
      } else {
        swatch.classList.add('timeslot-colour-unavailable');
        missingColour = true;
      }
      const label = document.createElement('span');
      label.className = 'timeslot-legend-label';
      label.textContent = j1Legend ? (entry.label || TIMESLOT_SEMANTIC_FALLBACK_LABELS[key] || key) : resolveTimeslotLegendLabel(key, entry);
      li.append(swatch, label);
      list.appendChild(li);
    });
    host.appendChild(list);
    if (j1Legend && missingColour) {
      const note = document.createElement('span');
      note.className = 'j1-legend-fallback';
      note.textContent = 'Dashed swatches: system option colour unavailable';
      host.appendChild(note);
    }
  }

  /* ===== Journey 2 Master integration — CR-J2-001–010 ===== */

  function parseJourneyBoot(search) {
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const values = params.getAll('journey');
    if (values.length !== 1) return 1;
    const v = values[0];
    if (v === '2') return 2;
    if (v === '3') return 3;
    if (v === '4') return 4;
    if (v === '5') return 5;
    if (v === '6') return 6;
    if (v === '7') return 7;
    if (v === '8') return 8;
    if (v === '9') return 9;
    if (v === '10') return 10;
    if (v === '11') return 11;
    if (v === '12') return 12;
    if (v === '13') return 13;
    if (v === '14') return 14;
    if (v === '15') return 15;
    if (v === '16') return 16;
    return 1;
  }

  function applyJourneyBoot() {
    const requested = parseJourneyBoot(window.location.search);
    const journey = requested === 14 || requested === 15 || requested === 16 ? 12 : requested;
    document.body.dataset.journey = String(journey);
    if (requested === 14) document.body.dataset.j14Entry = 'open';
    else delete document.body.dataset.j14Entry;
    if (journey === 1 || journey === 7 || journey === 9) document.body.dataset.contextualWorkspace = 'true';
    else delete document.body.dataset.contextualWorkspace;
    return journey;
  }

  function j2SetSurfaceExcluded(el, excluded) {
    if (!el) return;
    if (excluded) {
      el.hidden = true;
      el.inert = true;
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.hidden = false;
      el.inert = false;
      el.removeAttribute('aria-hidden');
    }
  }

  function applyJourneySurfaces(journey) {
    const isJ1 = journey === 1 || journey === 7 || journey === 9;
    const isJ2 = journey === 2;
    const isJ3 = journey === 3;
    const isJ4 = journey === 4;
    const isJ5 = journey === 5;
    const isJ6 = journey === 6;
    const isJ8 = journey === 8;
    const j1ProductOnly = [
      '.skip-cart', '#review-rail-toggle', '#review-rail-panel', '.stage-nav',
      '.stress-controls', '.review-scale-controls', '.review-scale-caption',
      '#booking-cart', '#cart-sheet', '#cart-item-editor-dialog',
      '#mismatch-dialog', '#remove-dialog', '#clear-dialog',
      '#large-data-picker', '#large-data-picker-backdrop', '#configure-form', '#amount-region',
      '#cart-current-selection'
    ];
    const j1J3Shared = [
      '.mode-nav', '.view-switch', 'button#date-range-label', '#assets-panel', '#now-line', '.selected-band'
    ];
    const j2Only = [
      '#review-demo-toggle', '#review-demo-panel', '#mode-group', '#mode-indicator',
      '#mode-booking-reason', '#mode-maintenance-reason', '#view-group',
      '#layout-day-reason', '#j2-date-range-label', '#j2-selected-assets',
      '#claim-boundary', '#picker-error', '#range-live'
    ];
    const contextualAssetChrome = [
      '#j3-asset-launcher', '#j3-launcher-btn', '#j3-explorer-scrim', '#j3-explorer-close'
    ];
    const contextualJ1Only = [
      '#contextual-cart-launcher', '#contextual-cart-open', '#contextual-cart-close'
    ];
    const j3Only = [
      '#j3-filters-toolbar', '#j3-filters-toggle', '#j3-fixture-caption', '#j3-capacity-fieldset',
      '.capacity-heading-row', '.capacity-inputs-row', '.cap-col',
      '#j3-capacity-from', '#j3-capacity-to', '#j3-reset-filters', '#j3-filter-status', '#j3-filter-error',
      '#j3-selected-heading', '#j3-available-heading', '#j3-explorer-footer', '#j3-explorer-selected-count',
      '#j3-explorer-done', '#j3-visibility-card'
    ];
    const j4Only = ['#j4-overview', '#j4-selection-summary'];
    const j5Only = ['#j5-review-controls', '#j5-lifecycle-review-controls'];
    const j6Only = ['#j6-review-controls'];
    j1ProductOnly.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ1));
    });
    j1J3Shared.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, isJ2));
    });
    j2Only.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ2));
    });
    contextualAssetChrome.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !(isJ1 || isJ3)));
    });
    contextualJ1Only.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ1));
    });
    j3Only.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ3));
    });
    j4Only.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !(isJ4 || isJ5 || isJ6 || isJ8)));
    });
    if (isJ8) j2SetSurfaceExcluded($('#j4-selection-summary'), true);   // OC-3-C: the unrelated Selected summary is not part of Journey 8
    j2SetSurfaceExcluded($('#mismatch-dialog'), !(isJ1 || isJ8));
    j2SetSurfaceExcluded($('#j4-review-controls'), !isJ4);
    j5Only.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ5));
    });
    j6Only.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ6));
    });
    if (isJ6) j2SetSurfaceExcluded($('#j4-context-menu'), true);
    if (journey === 7) {
      ['#review-rail-toggle', '#review-rail-panel', '#btn-play-journey', '#btn-play-complete', '.stage-nav', '.stress-controls', '.review-scale-controls', '.review-scale-caption'].forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, true));
      });
    }
    if (isJ4 || isJ5 || isJ6 || isJ8) {
      const reviewToggle = $('#review-rail-toggle');
      const reviewPanel = $('#review-rail-panel');
      j2SetSurfaceExcluded(reviewToggle, false);
      j2SetSurfaceExcluded(reviewPanel, false);
      if (reviewPanel) reviewPanel.hidden = true;
      if (reviewToggle) reviewToggle.setAttribute('aria-expanded', 'false');
    }
    if (journey === 9) {
      [
        '#review-rail-toggle', '#review-rail-panel', '#btn-play-journey', '#btn-play-complete', '.stage-nav',
        '#cart-primary-action', '#confirm-booking-btn', '#clear-cart-btn', '#cart-book-footer',
        '#cart-toolbar', '#cart-view-controls', '#cart-amount-context', '#cart-totals', '#cart-added-items',
        '#cart-bulk-actions', '#cart-column-head', '#cart-high-volume-summaries', '#cart-item-editor-dialog',
        '#mismatch-dialog', '#remove-dialog', '#clear-dialog', '#large-data-picker', '#large-data-picker-backdrop',
        '#current-selection-details-toggle', '#configure-form', '#cart-success', '#cart-unavailable',
        '#j4-details-dialog', '#j4-context-menu', '#j5-workflow-dialog'
      ].forEach((sel) => document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, true)));
      const cart = $('#booking-cart');
      if (cart) { cart.hidden = false; cart.inert = false; cart.removeAttribute('aria-hidden'); }
    }
    const surfaceToggle = $('#surface-toggle');
    if (surfaceToggle) {
      surfaceToggle.setAttribute('aria-controls', isJ2 ? 'j2-selected-assets' : 'assets-panel');
    }
    const pickerDesc = $('#picker-desc');
    if (pickerDesc) {
      if (isJ2) {
        pickerDesc.classList.remove('visually-hidden');
        pickerDesc.classList.add('j2-picker-desc');
        pickerDesc.textContent = 'Choose a date for the current calendar view. Apply updates the visible range. Empty or invalid dates cannot apply.';
      } else {
        pickerDesc.classList.add('visually-hidden');
        pickerDesc.classList.remove('j2-picker-desc');
        pickerDesc.textContent = 'Select a date to display the week containing that date.';
      }
    }
    const pickerInput = $('#picker-input');
    if (pickerInput) pickerInput.required = isJ2;
    const assetsPanel = $('#assets-panel');
    const assetsPanelTitle = assetsPanel?.querySelector('.panel-header h2');
    if (assetsPanel) {
      if (isJ3 || isJ1) {
        assetsPanel.setAttribute('aria-label', 'Asset Explorer');
        if (assetsPanelTitle) assetsPanelTitle.textContent = 'Asset Explorer';
      } else if (isJ4 || isJ5) {
        assetsPanel.setAttribute('aria-label', 'Diary assets');
        if (assetsPanelTitle) assetsPanelTitle.textContent = 'Diary assets';
        assetsPanel.removeAttribute('role');
        assetsPanel.removeAttribute('aria-modal');
      }
    }
    if (isJ3) j3SyncExplorerChrome();
  }

  /* ===== Journey 4 MASTER-ancestry candidate — CR-J4-001 / CR-J4-002 / CR-J4-003 ===== */

  const J4_FIXTURES = [
    {
      id: 'available', kind: 'available', label: 'Available', reference: 'Available interval',
      status: 'Available · Selectable', asset: 'hall1', resource: 'Hall 1', dayOffset: 5,
      startSlot: 12, endSlot: 18, access: 'Booking-create permitted review fixture', details: false, more: false
    },
    {
      id: 'selected', kind: 'selected', label: 'Selected', reference: 'SEL-LOCAL-001',
      status: 'Selected · Not saved', asset: 'hall1', resource: 'Hall 1', dayOffset: 4,
      startSlot: 8, endSlot: 11, access: 'Read-only review fixture', details: true, more: false
    },
    {
      id: 'private', kind: 'private', label: 'Private Booking', reference: 'BK-10482',
      status: 'Private Booking · Confirmed', asset: 'studio2', resource: 'Studio 2', dayOffset: 4,
      startSlot: 2, endSlot: 10, visualType: 'confirmed', access: 'Details and context permitted review fixture', details: true, more: true
    },
    {
      id: 'public-review', kind: 'public-review', journey6: true, label: 'Public timeslot · review fixture', reference: 'PUB-REVIEW-001',
      status: 'Maintenance / Public Events · review-only', asset: 'hall1', resource: 'Hall 1', dayOffset: 4,
      startSlot: 4, endSlot: 26, access: 'Review-only control; public identification unverified', details: true, more: false
    },
    {
      id: 'blocked', kind: 'blocked', label: 'Blocked', reference: 'BLK-220',
      status: 'Blocked · Unavailable', asset: 'hall2', resource: 'Hall 2', dayOffset: 5,
      startSlot: 0, endSlot: 24, visualType: 'block', access: 'Block context first handoff only', details: true, more: true
    },
    {
      id: 'facility-not-in-use', kind: 'facility-not-in-use', label: 'Facility Not In Use', reference: 'FNI-301',
      status: 'Facility Not In Use · Unavailable', asset: 'studio2', resource: 'Studio 2', dayOffset: 6,
      startSlot: 14, endSlot: 18, visualType: 'facility-not-in-use', access: 'Read-only review fixture', details: true, more: false
    },
    {
      id: 'conflict', kind: 'conflict', label: 'Conflict', reference: 'CNF-LOCAL-001',
      status: 'Conflict · No override', asset: 'hall1', resource: 'Hall 1', dayOffset: 3,
      startSlot: 12, endSlot: 16, access: 'Read-only; override unavailable', details: true, more: false
    }
  ];

  const J4_FILTER_ORDER = ['available', 'selected', 'private', 'blocked', 'facility-not-in-use', 'conflict'];
  const J6_FILTER_ORDER = ['public-review'];
  const J4_REVIEW_STATES = new Set(['ready', 'loading', 'empty', 'error', 'access-denied', 'varies']);
  let j4ViewState = 'ready';
  let j4ActiveFixtureId = 'selected';
  let j4EnabledFilters = new Set(J4_FILTER_ORDER);
  let j4ContextFixture = null;
  let j4ContextTrigger = null;
  let j4DetailsReturnTarget = null;
  let j4PointerSelection = null;
  let j6PublicInterval = { start: '08:00', end: '19:00' };

  function isJ4Journey() {
    return document.body.dataset.journey === '4' || document.body.dataset.journey === '5' || document.body.dataset.journey === '6';
  }

  function isJ5Journey() {
    return document.body.dataset.journey === '5';
  }

  function isJ6Journey() {
    return document.body.dataset.journey === '6';
  }

  function j6PublicRescheduleWorkflowActive() {
    return isJ6Journey() || (document.body.dataset.journey === '12' && j5Operation?.action === 'PublicReschedule');
  }

  function j4FindFixture(id) {
    return J4_FIXTURES.find((fixture) => fixture.id === id) || null;
  }

  function j4FixtureDate(fixture) {
    return addDays(weekStart, fixture.dayOffset);
  }

  function j4FixtureTime(fixture) {
    if (fixture?.journey6) return `${j6PublicInterval.start}–${j6PublicInterval.end}`;
    const start = slotToTime(fixture.startSlot);
    const end = slotToTime(fixture.endSlot);
    return `${formatTime(start.h, start.m)}–${formatTime(end.h, end.m)}`;
  }

  function j4FixtureDateTime(fixture) {
    return `${formatShortDate(j4FixtureDate(fixture))} · ${j4FixtureTime(fixture)}`;
  }

  function j4ProviderEntry(fixture) {
    if (!fixture.visualType) return { label: null, color: null };
    return getTimeslotClassificationEntry(fixture.visualType);
  }

  function j4StateColor(fixture) {
    const entry = j4ProviderEntry(fixture);
    if (entry.color) return entry.color;
    if (fixture.kind === 'available') return 'var(--diary-success)';
    if (fixture.kind === 'selected') return 'var(--diary-blue-500)';
    if (fixture.kind === 'private') return 'var(--diary-blue-600)';
    if (fixture.kind === 'blocked') return 'var(--diary-warning)';
    if (fixture.kind === 'facility-not-in-use') return 'var(--diary-text-secondary)';
    return 'var(--diary-danger)';
  }

  function j4ActionsBlocked() {
    return ['loading', 'error', 'access-denied', 'varies'].includes(j4ViewState);
  }

  function j4SyncReviewControls() {
    $$('.j4-review-state[data-j4-review-state]').forEach((button) => {
      const active = button.dataset.j4ReviewState === j4ViewState;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function j4RenderStatePanel() {
    const panel = $('#j4-state-panel');
    if (!panel) return;
    panel.innerHTML = '';
    panel.className = `j4-state-panel is-${j4ViewState}`;
    if (j4ViewState === 'ready') {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    const title = document.createElement('strong');
    const copy = document.createElement('span');
    if (j4ViewState === 'loading') {
      title.textContent = 'Loading calendar fixtures';
      copy.textContent = ' Current content is unsettled and timeslot actions are unavailable.';
      panel.setAttribute('aria-busy', 'true');
    } else if (j4ViewState === 'empty') {
      title.textContent = 'No occupied timeslots';
      copy.textContent = ' The valid empty state remains usable and the available interval stays selectable.';
      panel.removeAttribute('aria-busy');
    } else if (j4ViewState === 'error') {
      title.textContent = 'Calendar could not load';
      copy.textContent = ' No selection or success was fabricated.';
      panel.removeAttribute('aria-busy');
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn-secondary btn-sm';
      retry.id = 'j4-retry';
      retry.textContent = 'Retry';
      retry.addEventListener('click', () => j4SetViewState('ready'));
      panel.append(title, copy, retry);
      return;
    } else if (j4ViewState === 'access-denied') {
      title.textContent = 'Access denied review fixture';
      copy.textContent = ' Restricted details, context and create-selection actions are disabled. No complete tenant rights matrix is claimed.';
      panel.removeAttribute('aria-busy');
    } else {
      title.textContent = 'Varies';
      copy.textContent = ' Selected intervals have heterogeneous values. All timeslot action and mutation execution is disabled until resolved.';
      panel.removeAttribute('aria-busy');
    }
    panel.append(title, copy);
  }

  function j4RenderLegend() {
    const host = $('#timeslot-colours-legend');
    if (!host) return;
    host.innerHTML = '';
    host.setAttribute('aria-label', 'Journey 4 timeslot visual filters');
    const title = document.createElement('span');
    title.className = 'timeslot-legend-title';
    title.textContent = 'Show timeslots';
    host.appendChild(title);
    const list = document.createElement('ul');
    list.className = 'timeslot-legend-list j4-filter-list';
    const filterOrder = isJ6Journey() ? J6_FILTER_ORDER : J4_FILTER_ORDER;
    filterOrder.forEach((kind) => {
      const fixture = J4_FIXTURES.find((entry) => entry.kind === kind);
      if (!fixture) return;
      const item = document.createElement('li');
      item.className = 'timeslot-legend-item j4-filter-item';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'j4-filter-button';
      button.dataset.j4Filter = kind;
      button.setAttribute('aria-pressed', j4EnabledFilters.has(kind) ? 'true' : 'false');
      button.setAttribute('aria-label', `${j4EnabledFilters.has(kind) ? 'Hide' : 'Show'} ${fixture.label} timeslots`);
      button.disabled = j4ActionsBlocked();
      const swatch = document.createElement('span');
      swatch.className = `timeslot-legend-swatch j4-swatch is-${kind}`;
      swatch.setAttribute('aria-hidden', 'true');
      swatch.style.setProperty('--j4-state-color', j4StateColor(fixture));
      const label = document.createElement('span');
      label.className = 'timeslot-legend-label';
      const providerEntry = j4ProviderEntry(fixture);
      label.textContent = providerEntry.label || fixture.label;
      button.append(swatch, label);
      button.addEventListener('click', () => j4ToggleFilter(kind));
      item.appendChild(button);
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  function j4ApplyFilters(announce) {
    let visibleCount = 0;
    $$('.j4-timeslot[data-j4-kind], .j4-cal-block[data-j4-kind]').forEach((card) => {
      const visible = j4EnabledFilters.has(card.dataset.j4Kind);
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    const empty = $('#j4-filter-empty');
    if (empty) empty.hidden = visibleCount !== 0;
    if (announce) {
      announceLive(`${visibleCount} Journey 4 timeslot ${visibleCount === 1 ? 'fixture' : 'fixtures'} shown. Filter state is session-only.`);
    }
  }

  function j4ToggleFilter(kind) {
    if (j4ActionsBlocked() || !J4_FILTER_ORDER.includes(kind)) return;
    if (j4EnabledFilters.has(kind)) j4EnabledFilters.delete(kind);
    else j4EnabledFilters.add(kind);
    const button = $(`[data-j4-filter="${kind}"]`);
    if (button) {
      const shown = j4EnabledFilters.has(kind);
      button.setAttribute('aria-pressed', shown ? 'true' : 'false');
      const fixture = J4_FIXTURES.find((entry) => entry.kind === kind);
      button.setAttribute('aria-label', `${shown ? 'Hide' : 'Show'} ${fixture ? fixture.label : kind} timeslots`);
    }
    j4ApplyFilters(true);
  }

  function j4MoveCardFocus(card, key) {
    const cards = Array.from($$('.j4-timeslot[data-j4-kind]:not([hidden])'));
    const index = cards.indexOf(card);
    if (index < 0 || !cards.length) return;
    let next = index;
    if (key === 'ArrowRight' || key === 'ArrowDown') next = Math.min(cards.length - 1, index + 1);
    else if (key === 'ArrowLeft' || key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = cards.length - 1;
    else return;
    cards[next].focus();
  }

  function j4RenderTimeslotCard(fixture) {
    const card = document.createElement('article');
    card.className = `j4-timeslot is-${fixture.kind}`;
    card.dataset.j4Kind = fixture.kind;
    card.dataset.j4Fixture = fixture.id;
    card.setAttribute('role', 'gridcell');
    card.setAttribute('aria-selected', fixture.id === j4ActiveFixtureId ? 'true' : 'false');
    card.tabIndex = 0;
    card.style.setProperty('--j4-state-color', j4StateColor(fixture));
    if (fixture.id === j4ActiveFixtureId) card.classList.add('is-current');

    const tooltipId = `j4-tooltip-${fixture.id}`;
    card.setAttribute('aria-describedby', tooltipId);
    card.setAttribute('aria-label', `${fixture.label}. ${fixture.reference}. ${j4FixtureDateTime(fixture)}. ${fixture.resource}. ${fixture.status}.`);

    const heading = document.createElement('div');
    heading.className = 'j4-timeslot-head';
    const state = document.createElement('span');
    state.className = 'j4-state-label';
    state.textContent = fixture.label;
    const reference = document.createElement('strong');
    reference.textContent = fixture.reference;
    heading.append(state, reference);

    const time = document.createElement('span');
    time.className = 'j4-timeslot-time';
    time.textContent = j4FixtureDateTime(fixture);
    const resource = document.createElement('span');
    resource.className = 'j4-timeslot-resource';
    resource.textContent = fixture.resource;
    const status = document.createElement('span');
    status.className = 'j4-timeslot-status';
    status.textContent = fixture.status;

    const tooltip = document.createElement('span');
    tooltip.className = 'j4-tooltip';
    tooltip.id = tooltipId;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.textContent = `${fixture.reference} · ${j4FixtureDateTime(fixture)} · ${fixture.resource} · ${fixture.status}`;

    const actions = document.createElement('div');
    actions.className = 'j4-timeslot-actions';
    const blocked = j4ActionsBlocked();
    if (isJ6Journey() && fixture.journey6) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn-primary btn-sm j6-timeslot-entry';
      open.id = 'j6-open-public-review';
      open.textContent = 'Open review flow';
      open.disabled = blocked;
      open.setAttribute('aria-label', 'REVIEW FIXTURE — public-event identification and the public context menu are UNVERIFIED (runtime validation 2026-08-04). This entry is a review-only control, not a reproduced menu path.');
      open.addEventListener('click', (event) => { event.stopPropagation(); j6StartOperation('PublicReschedule', event.currentTarget); });
      actions.appendChild(open);
    } else if (fixture.kind === 'available') {
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'btn-primary btn-sm';
      select.id = 'j4-select-available';
      select.textContent = stagedSelection && j4ActiveFixtureId === 'available' ? 'Selected' : 'Select interval';
      select.disabled = blocked;
      select.addEventListener('click', (event) => {
        event.stopPropagation();
        j4SelectAvailable(event.currentTarget);
      });
      actions.appendChild(select);
    } else if (fixture.details) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'btn-primary btn-sm';
      open.id = `j4-open-${fixture.id}`;
      open.textContent = 'Open details';
      open.disabled = blocked;
      open.addEventListener('click', (event) => {
        event.stopPropagation();
        j4OpenDetails(fixture, event.currentTarget);
      });
      actions.appendChild(open);
    }
    if (fixture.more) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'btn-secondary btn-sm';
      more.id = `j4-more-${fixture.id}`;
      more.textContent = 'More actions';
      more.disabled = blocked;
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-expanded', j4ContextFixture && j4ContextFixture.id === fixture.id ? 'true' : 'false');
      more.setAttribute('aria-controls', 'j4-context-items');
      more.addEventListener('click', (event) => {
        event.stopPropagation();
        j4OpenContext(fixture, event.currentTarget);
      });
      actions.appendChild(more);
    }
    if (!actions.children.length) {
      const guidance = document.createElement('span');
      guidance.className = 'j4-safe-guidance';
      guidance.textContent = fixture.kind === 'facility-not-in-use' ? 'Choose another interval' : 'Read-only state';
      actions.appendChild(guidance);
    }

    card.append(heading, time, resource, status, actions, tooltip);
    card.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      if (fixture.kind === 'available') return;
      j4SelectFixture(fixture.id, card);
    });
    card.addEventListener('pointerdown', (event) => {
      if (fixture.kind !== 'available' || event.target.closest('button') || blocked) return;
      j4PointerSelection = { fixtureId: fixture.id, card };
    });
    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        j4MoveCardFocus(card, event.key);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (fixture.kind === 'available') j4SelectAvailable(card);
        else j4SelectFixture(fixture.id, card);
      }
    });
    return card;
  }

  function j4RenderSummary() {
    const title = $('#j4-selection-title');
    const copy = $('#j4-selection-copy');
    const state = $('#j4-selection-state');
    const time = $('#j4-selection-time');
    const resource = $('#j4-selection-resource');
    const access = $('#j4-selection-access');
    const guidance = $('#j4-selection-guidance');
    const open = $('#j4-summary-open');
    const more = $('#j4-summary-more');
    if (!title || !copy || !state || !time || !resource || !access || !guidance || !open || !more) return;

    if (j4ViewState === 'varies') {
      title.textContent = 'Varies';
      copy.textContent = 'The selected intervals do not share common values.';
      state.textContent = 'Varies';
      time.textContent = 'Varies · zero-duration review state';
      resource.textContent = 'Varies';
      access.textContent = 'Actions blocked until resolved';
      guidance.textContent = 'No normalization or mutation is inferred.';
      open.disabled = true;
      more.disabled = true;
      open.dataset.j4Fixture = '';
      more.dataset.j4Fixture = '';
      return;
    }

    if (isJ6Journey()) {
      const fixture = j4FindFixture('public-review');
      if (!fixture) return;
      title.textContent = 'Public timeslot · REVIEW FIXTURE';
      copy.textContent = 'Maintenance / Public Events context is presented as one local review fixture; no public context menu is reproduced.';
      state.textContent = 'REVIEW FIXTURE';
      time.textContent = j6PublicInterval.start + '–' + j6PublicInterval.end;
      resource.textContent = fixture.resource;
      access.textContent = fixture.access;
      guidance.textContent = 'Dedicated review control only. Public identification, menu options and gating are UNVERIFIED.';
      open.dataset.j4Fixture = fixture.id;
      open.textContent = 'Open review flow';
      open.disabled = j4ActionsBlocked();
      more.hidden = true;
      return;
    }

    let fixture = j4FindFixture(j4ActiveFixtureId) || j4FindFixture('selected');
    if (j4ViewState === 'empty') fixture = j4FindFixture('available');
    if (!fixture) return;
    const handedOff = fixture.kind === 'available' && !!stagedSelection;
    title.textContent = handedOff ? 'Available interval selected' : fixture.reference;
    copy.textContent = handedOff
      ? 'One staged selection was handed to the existing J1 New Selection state and handlers; no second Cart was created.'
      : `${fixture.label} · ${fixture.status}`;
    state.textContent = handedOff ? 'Selected' : fixture.label;
    time.textContent = handedOff ? j4StagedDateTime() : j4FixtureDateTime(fixture);
    resource.textContent = handedOff ? j4StagedResource() : fixture.resource;
    access.textContent = handedOff ? 'Existing J1 New Selection state' : fixture.access;
    guidance.textContent = j4ViewState === 'access-denied'
      ? 'Access-denied fixture: all timeslot actions are disabled.'
      : (fixture.more ? 'Direct details and the separate non-mutating context handoff are available.' : 'No mutation or lifecycle action is available.');
    open.dataset.j4Fixture = fixture.id;
    more.dataset.j4Fixture = fixture.id;
    open.disabled = j4ActionsBlocked() || !fixture.details;
    more.disabled = j4ActionsBlocked() || !fixture.more;
    more.hidden = !fixture.more;
  }

  function j4SelectFixture(fixtureId, trigger) {
    if (!isJ4Journey()) return;
    const fixture = j4FindFixture(fixtureId);
    if (!fixture) return;
    j4ActiveFixtureId = fixture.id;
    $$('.j4-timeslot[data-j4-fixture], .j4-cal-block[data-j4-fixture]').forEach((card) => {
      const selected = card.dataset.j4Fixture === fixture.id;
      card.classList.toggle('is-current', selected);
      if (card.classList.contains('j4-cal-block')) { const main = card.querySelector('.j4-cal-main'); if (main) { if (selected) main.setAttribute('aria-current', 'true'); else main.removeAttribute('aria-current'); } }
      else card.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    j4RenderSummary();
    announceLive(`${fixture.label} selected for read-only review.`);
    if (trigger && typeof trigger.focus === 'function' && document.body.contains(trigger)) trigger.focus();
  }

  const J4_CART_HANDOFF_SURFACES = [
    '#booking-cart', '#cart-sheet', '#mismatch-dialog', '#large-data-picker',
    '#large-data-picker-backdrop', '#configure-form', '#amount-region', '#cart-current-selection',
    // One Calendar candidate: the Cart's own dialogs too, so the bin, the line menu and Clear cart open visible dialogs
    // (they opened hidden, inert modals that froze the page until Escape).
    '#cart-item-editor-dialog', '#remove-dialog', '#clear-dialog'
  ];

  function j4SetCartHandoffVisible(visible) {
    J4_CART_HANDOFF_SURFACES.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => j2SetSurfaceExcluded(element, !visible));
    });
    if (!visible) setSheetExpanded(false);
  }

  function j4ClearCartHandoff() {
    stagedSelection = null;
    editingLineId = null;
    draft.unavailableSelection = null;
    cartLines = [];
    selectedLineIds.clear();
    setPhase('select');
    updateCartUI();
    j4SetCartHandoffVisible(false);
  }

  function j4SelectAvailable(trigger) {
    if (!isJ4Journey() || j4ActionsBlocked()) return;
    const fixture = j4FindFixture('available');
    if (!fixture) return;
    j4ActiveFixtureId = fixture.id;
    j4SetCartHandoffVisible(true);
    createSelection(fixture.asset, dateKey(j4FixtureDate(fixture)), fixture.startSlot, fixture.endSlot);
    if (isNarrowViewport()) setSheetExpanded(true);
    announceLive('Available interval selected. The existing Journey 1 Booking Cart is the sole staged-selection surface. Nothing was saved.');
    window.setTimeout(() => {
      const next = $('#j4-select-available') || $('.j4-timeslot[data-j4-fixture="available"]');
      if (next && typeof next.focus === 'function') next.focus();
    }, 0);
  }

  function j4HandlePointerUp(event) {
    if (!j4PointerSelection || !isJ4Journey()) return;
    const pending = j4PointerSelection;
    j4PointerSelection = null;
    const card = event.target && event.target.closest ? event.target.closest('.j4-timeslot[data-j4-fixture="available"]') : null;
    if (card && card === pending.card) j4SelectAvailable(card);
  }

  function j4OpenDetails(fixture, trigger) {
    if (!isJ4Journey() || !fixture || !fixture.details || j4ActionsBlocked()) return;
    if (isJ6Journey() && fixture.journey6) {
      j6StartOperation('PublicReschedule', trigger);
      return;
    }
    j4SelectFixture(fixture.id);
    j4DetailsReturnTarget = trigger || document.activeElement;
    $('#j4-details-title').textContent = fixture.reference;
    $('#j4-details-reference').textContent = fixture.reference;
    $('#j4-details-status').textContent = fixture.status;
    $('#j4-details-time').textContent = j4FixtureDateTime(fixture);
    $('#j4-details-resource').textContent = fixture.resource;
    $('#j4-details-access').textContent = fixture.access;
    const dialog = $('#j4-details-dialog');
    dialog.hidden = false;
    dialog.inert = false;
    dialog.removeAttribute('aria-hidden');
    dialog.dataset.j4Fixture = fixture.id;
    dialog.showModal();
    $('#j4-details-close').focus();
    announceLive(`${fixture.reference} read-only details opened.`);
  }

  function j4CloseDetails(restore) {
    const dialog = $('#j4-details-dialog');
    if (dialog && dialog.open) dialog.close();
    if (dialog) {
      dialog.hidden = true;
      dialog.inert = true;
      dialog.setAttribute('aria-hidden', 'true');
    }
    const target = j4DetailsReturnTarget;
    j4DetailsReturnTarget = null;
    if (restore !== false && target && document.body.contains(target) && typeof target.focus === 'function') target.focus();
  }

  function j4PositionContext(trigger) {
    const menu = $('#j4-context-menu');
    if (!menu || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = menu.offsetWidth || 260;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    const top = Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - (menu.offsetHeight || 180) - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  }

  function j4ContextMenuItems() {
    return Array.from($$('#j4-context-items [role="menuitem"]'));
  }

  function j4SetContextMenuFocus(index, focus) {
    const items = j4ContextMenuItems();
    if (!items.length) return;
    const next = ((index % items.length) + items.length) % items.length;
    items.forEach((item, itemIndex) => { item.tabIndex = itemIndex === next ? 0 : -1; });
    if (focus !== false) items[next].focus();
  }

  function j4HandleContextKeydown(event) {
    const items = j4ContextMenuItems();
    const index = items.indexOf(event.target);
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowDown') next = index + 1;
    else if (event.key === 'ArrowUp') next = index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else return;
    event.preventDefault();
    j4SetContextMenuFocus(next, true);
  }

  function j4OpenContext(fixture, trigger) {
    if (!isJ4Journey() || !fixture || !fixture.more || j4ActionsBlocked()) return;
    if (j4ContextFixture) j4CloseContext(false);
    j4SelectFixture(fixture.id);
    j4ContextFixture = fixture;
    j4ContextTrigger = trigger;
    const menu = $('#j4-context-menu');
    $('#j4-context-title').textContent = `${fixture.label} actions`;
    $('#j4-context-copy').textContent = fixture.kind === 'blocked'
      ? 'Block context first handoff only. Block create, edit and delete are unavailable.'
      : 'Private Booking context first handoff only. No lifecycle action is available.';
    const open = $('#j4-context-open-details');
    open.dataset.j4Fixture = fixture.id;
    menu.hidden = false;
    menu.inert = false;
    menu.removeAttribute('aria-hidden');
    trigger.setAttribute('aria-expanded', 'true');
    j4PositionContext(trigger);
    j4SetContextMenuFocus(0, true);
    announceLive(`${fixture.label} More actions opened. No data changed.`);
  }

  function j4CloseContext(restore) {
    const menu = $('#j4-context-menu');
    if (menu) {
      menu.hidden = true;
      menu.inert = true;
      menu.setAttribute('aria-hidden', 'true');
      menu.style.left = '';
      menu.style.top = '';
    }
    const trigger = j4ContextTrigger;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    j4SetContextMenuFocus(0, false);
    j4ContextFixture = null;
    j4ContextTrigger = null;
    if (restore !== false && trigger && document.body.contains(trigger) && typeof trigger.focus === 'function') trigger.focus();
  }

  function j4SetViewState(nextState) {
    if (!isJ4Journey() || !J4_REVIEW_STATES.has(nextState)) return;
    j4CloseDetails(false);
    j4CloseContext(false);
    j4ClearCartHandoff();
    j4ViewState = nextState;
    document.body.dataset.j4State = nextState;
    j4SyncReviewControls();
    renderCalendar();
    announceLive(`Journey 4 ${nextState.replace('-', ' ')} review fixture shown.`);
  }

  function j4RenderCalendar() {
    const grid = $('#calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.classList.add('j4-calendar-grid');
    grid.setAttribute('aria-label', 'Journey 4 labelled timeslot review fixtures');
    syncSlotLayoutControl();
    j4RenderStatePanel();
    j4RenderLegend();

    const boardHead = document.createElement('div');
    boardHead.className = 'j4-board-head';
    boardHead.setAttribute('role', 'row');
    const titleCell = document.createElement('div');
    titleCell.setAttribute('role', 'columnheader');
    const title = document.createElement('h2');
    title.textContent = 'Calendar timeslots';
    titleCell.appendChild(title);
    const countCell = document.createElement('div');
    countCell.setAttribute('role', 'columnheader');
    const count = document.createElement('span');
    count.textContent = j4ViewState === 'loading' ? 'Loading' : (isJ6Journey() ? 'One public review fixture' : 'Six supported fixture classes');
    countCell.appendChild(count);
    boardHead.append(titleCell, countCell);
    grid.appendChild(boardHead);

    let fixtures = isJ6Journey() ? J4_FIXTURES.filter((fixture) => fixture.journey6) : J4_FIXTURES.filter((fixture) => !fixture.journey6);
    if (j4ViewState === 'loading' || j4ViewState === 'error') fixtures = [];
    else if (j4ViewState === 'empty') fixtures = isJ6Journey() ? [] : J4_FIXTURES.filter((fixture) => !fixture.journey6 && fixture.kind === 'available');

    if (fixtures.length) {
      const board = document.createElement('div');
      board.className = 'j4-timeslot-board';
      board.setAttribute('role', 'row');
      fixtures.forEach((fixture) => board.appendChild(j4RenderTimeslotCard(fixture)));
      grid.appendChild(board);
    } else {
      const noContent = document.createElement('div');
      noContent.className = 'j4-no-content';
      noContent.setAttribute('role', 'row');
      const noContentCell = document.createElement('div');
      noContentCell.setAttribute('role', 'gridcell');
      noContentCell.textContent = j4ViewState === 'loading'
        ? 'Loading labelled calendar fixtures…'
        : 'The calendar is unavailable. Use Retry or another review state; no selection was created.';
      noContent.appendChild(noContentCell);
      grid.appendChild(noContent);
    }
    const filterEmpty = document.createElement('div');
    filterEmpty.className = 'j4-filter-empty';
    filterEmpty.id = 'j4-filter-empty';
    filterEmpty.setAttribute('role', 'row');
    filterEmpty.hidden = true;
    const filterEmptyCell = document.createElement('div');
    filterEmptyCell.setAttribute('role', 'gridcell');
    filterEmptyCell.textContent = 'No timeslots match the current session-only visual filters.';
    filterEmpty.appendChild(filterEmptyCell);
    grid.appendChild(filterEmpty);

    $('#date-range-label').textContent = formatRangeLabel(weekStart);
    document.body.dataset.week = isCheckpointWeek() ? 'checkpoint' : 'other';
    const nowLine = $('#now-line');
    if (nowLine) nowLine.hidden = true;
    j4RenderSummary();
    j4ApplyFilters(false);
  }

  /* ===== One Calendar candidate (Supervisor #19, 2026-10-11): Journeys 4–6 timeslots drawn in the Journey 12 calendar =====
     Card-to-calendar mapping — every card action stays reachable with the same number of clicks:
       Select interval -> 'Select interval' button on the Available block (or drag/click free time, Journey 12 style)
       Open details / Open review flow -> click or Enter on the timeslot block
       More actions -> the block's ⋯ button, right-click, Shift+F10 or the Context Menu key
       card click / focus -> Selected summary (focus updates it; the summary's Open details / More actions are unchanged)
       arrow keys, Home, End -> move between timeslot blocks; filters, review states and dialogs are unchanged. */
  function j4VisibleFixtures() {
    if (j4ViewState === 'loading' || j4ViewState === 'error') return [];
    let list = isJ6Journey() ? J4_FIXTURES.filter((f) => f.journey6) : J4_FIXTURES.filter((f) => !f.journey6);
    if (j4ViewState === 'empty') list = isJ6Journey() ? [] : list.filter((f) => f.kind === 'available');
    return list;
  }
  function j4FixtureSlots(fixture) {
    if (fixture.journey6) {
      const [sh, sm] = j6PublicInterval.start.split(':').map(Number);
      const [eh, em] = j6PublicInterval.end.split(':').map(Number);
      return { startSlot: timeToSlot(sh, sm), endSlot: timeToSlot(eh, em) };
    }
    return { startSlot: fixture.startSlot, endSlot: fixture.endSlot };
  }
  function j4StagedDateTime() {
    const s = stagedSelection;
    if (!s) return '';
    return `${formatShortDate(new Date(`${s.date}T12:00:00`))} · ${formatTime(s.startH, s.startM)}–${formatTime(s.endH, s.endM)}`;
  }
  function j4StagedResource() {
    const s = stagedSelection;
    return s ? ((ASSETS.find((a) => a.id === s.asset) || {}).name || s.asset) : '';
  }
  function j4PrimaryAction(fixture, trigger) {
    if (j4ActionsBlocked()) { announceLive('Timeslot actions are unavailable in this review state.'); return; }
    if (fixture.kind === 'available') { j4SelectAvailable(trigger); return; }
    if (isJ6Journey() && fixture.journey6) { j6StartOperation('PublicReschedule', trigger); return; }
    j4OpenDetails(fixture, trigger);
  }
  function j4FocusFixture(id) {
    if (j4ActiveFixtureId === id || j4ActionsBlocked()) return;
    j4ActiveFixtureId = id;
    $$('.j4-cal-block[data-j4-fixture]').forEach((block) => {
      const on = block.dataset.j4Fixture === id;
      block.classList.toggle('is-current', on);
      const main = block.querySelector('.j4-cal-main');
      if (main) { if (on) main.setAttribute('aria-current', 'true'); else main.removeAttribute('aria-current'); }
    });
    j4RenderSummary();
  }
  function j4MoveBlockFocus(from, key) {
    const order = j4VisibleFixtures().map((f) => f.id);
    const targets = Array.from($$('.j4-cal-block[data-j4-fixture]:not([hidden])'))
      .sort((a, b) => order.indexOf(a.dataset.j4Fixture) - order.indexOf(b.dataset.j4Fixture))
      .map((block) => block.querySelector('.j4-cal-main, .j4-cal-select'))
      .filter((t) => t && !t.disabled);
    const index = targets.indexOf(from);
    if (index < 0 || !targets.length) return;
    let next = index;
    if (key === 'ArrowRight' || key === 'ArrowDown') next = Math.min(targets.length - 1, index + 1);
    else if (key === 'ArrowLeft' || key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = targets.length - 1;
    targets[next].focus();
  }
  function j4BlockKeydown(event, fixture, el) {
    if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      j4MoveBlockFocus(el, event.key);
      return;
    }
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      if (!fixture.more || j4ActionsBlocked()) return;
      event.preventDefault();
      j4OpenContext(fixture, document.getElementById(`j4-more-${fixture.id}`) || el);
    }
  }
  function j4BuildBlock(fixture) {
    const blocked = j4ActionsBlocked();
    const block = document.createElement('div');
    block.className = `cal-event j4-cal-block is-${fixture.kind}`;
    if (fixture.visualType) { block.classList.add(fixture.visualType); applyTimeslotVisual(block, fixture.visualType); }
    block.dataset.j4Kind = fixture.kind;
    block.dataset.j4Fixture = fixture.id;
    block.style.setProperty('--j4-state-color', j4StateColor(fixture));
    block.title = `${fixture.reference} · ${j4FixtureDateTime(fixture)} · ${fixture.resource} · ${fixture.status}`;
    block.setAttribute('role', 'group');
    block.setAttribute('aria-label', `${fixture.label}. ${fixture.reference}. ${j4FixtureDateTime(fixture)}. ${fixture.resource}. ${fixture.status}.`);
    if (fixture.id === j4ActiveFixtureId) block.classList.add('is-current');
    const text = `<strong>${escapeHtml(fixture.kind === 'available' ? 'Available interval' : fixture.reference)}</strong> <span class="event-status">${escapeHtml(fixture.status)}</span>`;
    if (fixture.kind === 'available') {
      const label = document.createElement('span');
      label.className = 'j4-cal-text';
      label.innerHTML = text;
      const select = document.createElement('button');
      select.type = 'button';
      select.className = 'j4-cal-select';
      select.id = 'j4-select-available';
      select.textContent = stagedSelection && j4ActiveFixtureId === 'available' ? 'Selected' : 'Select interval';
      select.disabled = blocked;
      select.setAttribute('aria-label', `Select interval ${j4FixtureDateTime(fixture)}, ${fixture.resource}`);
      select.addEventListener('click', (event) => { event.stopPropagation(); j4PrimaryAction(fixture, event.currentTarget); });
      select.addEventListener('keydown', (event) => j4BlockKeydown(event, fixture, select));
      block.append(label, select);
      return block;
    }
    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'j4-cal-main';
    main.id = isJ6Journey() && fixture.journey6 ? 'j6-open-public-review' : `j4-open-${fixture.id}`;
    main.innerHTML = text;
    main.disabled = blocked;
    const action = isJ6Journey() && fixture.journey6 ? 'Open review flow' : 'Open details';
    main.setAttribute('aria-label', `${fixture.label}. ${fixture.reference}. ${j4FixtureDateTime(fixture)}. ${fixture.resource}. ${fixture.status}. ${action}${fixture.more ? '. More actions available' : ''}.`);
    if (fixture.id === j4ActiveFixtureId) main.setAttribute('aria-current', 'true');
    main.addEventListener('click', (event) => { event.stopPropagation(); j4PrimaryAction(fixture, main); });
    main.addEventListener('keydown', (event) => j4BlockKeydown(event, fixture, main));
    main.addEventListener('focus', () => j4FocusFixture(fixture.id));
    block.appendChild(main);
    if (fixture.more) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'j4-cal-more';
      more.id = `j4-more-${fixture.id}`;
      more.textContent = '⋯';
      more.disabled = blocked;
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-controls', 'j4-context-items');
      more.setAttribute('aria-expanded', j4ContextFixture && j4ContextFixture.id === fixture.id ? 'true' : 'false');
      more.setAttribute('aria-label', `More actions for ${fixture.reference}`);
      more.addEventListener('click', (event) => { event.stopPropagation(); j4OpenContext(fixture, event.currentTarget); });
      more.addEventListener('keydown', (event) => j4BlockKeydown(event, fixture, main));
      block.appendChild(more);
      block.addEventListener('contextmenu', (event) => {
        if (j4ActionsBlocked()) return;
        event.preventDefault();
        j4OpenContext(fixture, more);
      });
    }
    return block;
  }
  function j4RenderCalendarBlocks(col, assetId, dk, slotH) {
    const total = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
    j4VisibleFixtures().forEach((fixture) => {
      if (fixture.asset !== assetId || dateKey(j4FixtureDate(fixture)) !== dk) return;
      const { startSlot, endSlot } = j4FixtureSlots(fixture);
      const s = Math.max(0, Math.min(total - 1, startSlot));
      const e = Math.max(s + 1, Math.min(total, endSlot));
      const block = j4BuildBlock(fixture);
      block.style.top = `${s * slotH}px`;
      block.style.height = `${(e - s) * slotH}px`;
      col.appendChild(block);
    });
  }
  function j4RenderStackDay(col, lane, dk) {
    col.classList.add('is-stack');
    if (dk === dateKey(TODAY) && isCheckpointWeek()) col.classList.add('is-today-column');
    const list = j4VisibleFixtures()
      .filter((f) => f.asset === lane.id && dateKey(j4FixtureDate(f)) === dk)
      .sort((a, b) => j4FixtureSlots(a).startSlot - j4FixtureSlots(b).startSlot);
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'stack-empty';
      empty.textContent = '—';
      empty.setAttribute('aria-label', 'No fixture slots');
      col.appendChild(empty);
      return;
    }
    list.forEach((fixture) => {
      const block = j4BuildBlock(fixture);
      block.classList.add('stack-card', 'j4-stack-block');
      col.appendChild(block);
    });
  }
  function j4AfterCalendarRender(grid) {
    grid.setAttribute('aria-label', 'Journey 4 labelled timeslot review fixtures');
    j4RenderStatePanel();
    j4RenderLegend();
    const message = j4ViewState === 'loading'
      ? 'Loading labelled calendar fixtures…'
      : (j4ViewState === 'error' ? 'The calendar is unavailable. Use Retry or another review state; no selection was created.' : '');
    const filterEmpty = document.createElement('div');
    filterEmpty.className = 'j4-calendar-message j4-filter-empty';
    filterEmpty.id = 'j4-filter-empty';
    filterEmpty.setAttribute('role', 'status');
    filterEmpty.hidden = true;
    filterEmpty.textContent = 'No timeslots match the current session-only visual filters.';
    grid.prepend(filterEmpty);
    if (message) {
      const note = document.createElement('div');
      note.className = 'j4-calendar-message';
      note.setAttribute('role', 'status');
      note.textContent = message;
      grid.prepend(note);
    }
    j4RenderSummary();
    j4ApplyFilters(false);
  }

  function j4ResetBootState() {
    j4CloseDetails(false);
    j4CloseContext(false);
    j4ViewState = 'ready';
    j4ActiveFixtureId = 'selected';
    j4EnabledFilters = new Set(J4_FILTER_ORDER);
    j4PointerSelection = null;
    j4ClearCartHandoff();
    document.body.dataset.j4State = 'ready';
    document.body.dataset.surface = 'week';
    const caption = $('.calendar-caption');
    if (caption) caption.textContent = 'REVIEW FIXTURE — six labelled Journey 4 states on the shared calendar; not exhaustive tenant data.';
    j4SyncReviewControls();
    selectedAssets = new Set(['hall1', 'hall2', 'studio2']); // One Calendar: every timeslot fixture lane is visible by default
    setCartViewMode('detailed'); // the shared Cart opens in Detailed view here: Date, Time, Duration, Facility, Description, Price, Actions
    renderAssetTree();
    renderCalendar();
  }

  function j4SetupEvents() {
    $$('.j4-review-state[data-j4-review-state]').forEach((button) => {
      button.addEventListener('click', () => j4SetViewState(button.dataset.j4ReviewState));
    });
    $('#j4-summary-open').addEventListener('click', (event) => {
      const fixture = j4FindFixture(event.currentTarget.dataset.j4Fixture);
      j4OpenDetails(fixture, event.currentTarget);
    });
    $('#j4-summary-more').addEventListener('click', (event) => {
      event.stopPropagation();
      const fixture = j4FindFixture(event.currentTarget.dataset.j4Fixture);
      j4OpenContext(fixture, event.currentTarget);
    });
    $('#j4-details-close').addEventListener('click', () => j4CloseDetails(true));
    $('#j4-details-back').addEventListener('click', () => j4CloseDetails(true));
    $('#j4-details-dialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      j4CloseDetails(true);
    });
    $('#j4-context-open-details').addEventListener('click', (event) => {
      event.stopPropagation();
      const fixture = j4FindFixture(event.currentTarget.dataset.j4Fixture);
      j4OpenDetails(fixture, event.currentTarget);
    });
    $('#j4-context-close').addEventListener('click', (event) => {
      event.stopPropagation();
      j4CloseContext(true);
    });
    $('#j4-context-items').addEventListener('keydown', j4HandleContextKeydown);
    document.addEventListener('pointerup', j4HandlePointerUp);
    document.addEventListener('click', (event) => {
      if (!j4ContextFixture) return;
      if (event.target.closest('#j4-context-menu') || event.target.closest('#j4-details-dialog') || event.target.closest('[aria-haspopup="menu"]')) return;
      j4CloseContext(true);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && j4ContextFixture && !$('#j4-details-dialog').open) {
        event.preventDefault();
        j4CloseContext(true);
      }
    });
    window.addEventListener('resize', () => {
      if (j4ContextFixture && j4ContextTrigger) j4PositionContext(j4ContextTrigger);
    });
  }

  async function j4PlayJourney() {
    if (playJourneyActive) return;
    playJourneyActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    playBtn.disabled = true;
    completeBtn.disabled = true;
    const total = 11;
    let step = 0;
    j4ResetBootState();
    beginGuidedReview('journey', total);
    showToast('Playing Journey 4 review-only timeslot interaction…');
    try {
      await guidedReviewStep(playBtn, 'Exact-one Journey 4 review route; J1–J3 remain isolated.', ++step, total, () => {}, REVIEW_PLAY_STEP_MS);
      await guidedReviewStep('#j4-select-available', 'Select one valid available interval and hand it to the existing J1 New Selection state.', ++step, total);
      await guidedReviewStep('#j4-open-private', 'Open Private Booking read-only details directly in one click.', ++step, total);
      await guidedReviewStep('#j4-details-close', 'Close details and return focus to the exact direct action.', ++step, total);
      await guidedReviewStep('#j4-more-private', 'Retain the separate non-mutating More actions capability.', ++step, total);
      await guidedReviewStep('#j4-context-open-details', 'Open the same read-only details from the context first handoff.', ++step, total);
      await guidedReviewStep('#j4-details-back', 'Back returns focus to the invoking context action.', ++step, total);
      await guidedReviewStep('#j4-context-close', 'Close context and return to the exact More actions trigger.', ++step, total);
      await guidedReviewStep('[data-j4-filter="conflict"]', 'Hide Conflict with one local visual update and no storage.', ++step, total);
      await guidedReviewStep('#j4-selection-summary', 'Review the selected summary; no second Cart exists.', ++step, total, () => {}, REVIEW_PLAY_STEP_MS);
      await guidedReviewStep('#j4-selection-summary', 'Show Varies and block all timeslot action or mutation execution.', ++step, total, () => j4SetViewState('varies'), REVIEW_PLAY_STEP_MS);
      showToast('Journey 4 guided review finished — candidate only; Gate A remains pending.');
    } catch (error) {
      console.error(error);
      showToast('Guided Journey 4 review stopped at the last safe state — inspect console evidence.');
    } finally {
      playJourneyActive = false;
      playBtn.disabled = false;
      completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  async function j4PlayComplete() {
    if (playJourneyActive) return;
    playJourneyActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    playBtn.disabled = true;
    completeBtn.disabled = true;
    const total = 5;
    let step = 0;
    j4ResetBootState();
    beginGuidedReview('complete', total);
    try {
      await guidedReviewStep(completeBtn, 'Journey 4 short review starts with all six labelled fixture states.', ++step, total, () => {}, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#j4-select-available', 'Available interval uses the single existing J1 selection graph.', ++step, total, null, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#j4-open-private', 'Direct one-click read-only details.', ++step, total, null, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#j4-details-back', 'Back with exact focus return.', ++step, total, null, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('[data-j4-filter="blocked"]', 'Session-only visual filter; no persistence or request.', ++step, total, null, REVIEW_COMPLETE_STEP_MS);
      showToast('Journey 4 Play complete finished — FUNCTIONAL CANDIDATE only; not Gate A.');
    } catch (error) {
      console.error(error);
      showToast('Journey 4 Play complete stopped at the last safe state.');
    } finally {
      playJourneyActive = false;
      playBtn.disabled = false;
      completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  /* ===== Journey 5 private lifecycle candidate — CR-J5-002 through CR-J5-006 ===== */

  const J5_REVIEW_STATES = new Set(['loading', 'loaded', 'partial', 'error', 'denied']);
  const J5_LIFECYCLE_STATES = new Set(['loading', 'ready', 'empty', 'unavailable', 'error', 'permission-denied', 'success']);
  const J5_BASE_BOOKING = Object.freeze({
    reference: 'BK-LOCAL-10482', status: 'Confirmed', customer: 'A. Customer', contact: 'a.customer@example.test',
    resource: 'Studio 2', date: '2026-08-28', dateLabel: '28 Aug 2026', time: '09:00–13:00', covers: 18,
    version: 7, total: 2750,
    items: [
      { id: 'ITEM-LOCAL-001', name: 'Studio 2 private allocation', target: 'Studio 2', covers: 18, state: 'eligible' },
      { id: 'ITEM-LOCAL-002', name: 'Lighting package', target: 'Lighting Bay', covers: 12, state: 'eligible' }
    ]
  });
  const J5_REMOVE_FIXTURES = [
    { id: 'ITEM-LOCAL-001', name: 'Studio 2 private allocation', target: 'Studio 2 · 28 Aug · 09:00–13:00', state: 'eligible' },
    { id: 'ITEM-LOCAL-DELIVERED', name: 'Delivered/scanned fixture', target: 'Studio 2 · delivered', state: 'delivered' },
    { id: 'ITEM-LOCAL-LINKED', name: 'Linked standard-item fixture', target: 'Standard item link', state: 'linked' }
  ];
  const J5_TARGETS = [
    { value: 'Studio 2', label: 'Studio 2 · current target', state: 'same' },
    { value: 'Studio 4', label: 'Studio 4 · eligible local target', state: 'eligible', capacity: 30 },
    { value: 'Studio 7', label: 'Studio 7 · conflict fixture', state: 'conflict', capacity: 24 },
    { value: 'Studio 9', label: 'Studio 9 · insufficient-capacity fixture', state: 'capacity', capacity: 10 }
  ];
  let J5_BOOKING_FIXTURE = null;
  let j5ReviewState = 'loaded';
  let j5LifecycleState = 'ready';
  let j5Operation = null;
  let j5WorkflowTrigger = null;
  let j5WorkflowReturning = false;
  let j5CommandSerial = 0;

  function j5CloneBooking() { return { ...J5_BASE_BOOKING, items: J5_BASE_BOOKING.items.map((item) => ({ ...item })) }; }
  function j5LocalResult(text) { return `${text} Local review result — no server request sent; reload resets it.`; }

  function j5SyncReviewControls() {
    $$('.j5-review-state[data-j5-review-state]').forEach((button) => {
      const active = button.dataset.j5ReviewState === j5ReviewState;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  function j5SyncLifecycleControls() {
    $$('.j5-review-state[data-j5-lifecycle-state]').forEach((button) => {
      const active = button.dataset.j5LifecycleState === j5LifecycleState;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }
  function j5LifecycleMessage() {
    return ({
      loading: 'Lifecycle fixture is loading. No action entry or confirmation is available.',
      ready: 'Lifecycle fixture ready for local review. No production availability or permission rule is claimed.',
      empty: 'No eligible private items in this local fixture. Nothing can be confirmed.',
      unavailable: 'Lifecycle review is unavailable in this local fixture. No success is inferred.',
      error: 'The local lifecycle fixture failed to load. Retry the review fixture; the original booking is preserved.',
      'permission-denied': 'Permission denied before action entry. The booking remains unchanged.',
      success: 'A prior local result is shown for review only. It is not persisted and is not a server outcome.'
    })[j5LifecycleState];
  }
  function j5CanEnterAction() { return j5ReviewState === 'loaded' || j5ReviewState === 'partial'; }

  function j5RenderState() {
    if (!isJ5Journey()) return;
    document.body.dataset.j5State = j5ReviewState; document.body.dataset.j5LifecycleState = j5LifecycleState;
    j5SyncReviewControls(); j5SyncLifecycleControls();
    const hub = $('#j5-action-hub'); const stateMessage = $('#j5-state-message'); const content = $('#j5-loaded-content'); const total = $('#j5-total'); const itemCount = $('#j5-item-count');
    if (!hub || !stateMessage || !content || !total) return;
    if (j5ReviewState === 'loading') hub.setAttribute('aria-busy', 'true'); else hub.removeAttribute('aria-busy');
    stateMessage.className = `j5-state-message is-${j5ReviewState}`; stateMessage.replaceChildren();
    const heading = document.createElement('strong'); const copy = document.createElement('span');
    const states = {
      loading: ['Loading booking details', ' Current details are unsettled. No lifecycle action is available.'],
      loaded: ['Booking details loaded', ' Private lifecycle controls are local review flows; previews never write.'],
      partial: ['Partial details', ' Total is unavailable in this degraded local fixture. No value is inferred.'],
      error: ['Booking details could not load', ' Original booking state is preserved; no outcome is fabricated.'],
      denied: ['Permission denied', ' Details are visible for context only; lifecycle entry is unavailable.']
    };
    heading.textContent = states[j5ReviewState][0]; copy.textContent = states[j5ReviewState][1]; stateMessage.append(heading, copy);
    if (j5ReviewState === 'error') {
      const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'btn-secondary btn-sm'; retry.id = 'j5-retry'; retry.textContent = 'Retry';
      retry.addEventListener('click', () => { j5SetState('loaded', true); announceLive(j5LocalResult('Details retry returned the local fixture.')); }); stateMessage.appendChild(retry);
    }
    const detailsVisible = !['loading', 'error'].includes(j5ReviewState); content.hidden = !detailsVisible; content.inert = !detailsVisible;
    total.textContent = j5ReviewState === 'partial' ? 'Unavailable — partial fixture' : `${J5_BOOKING_FIXTURE.total.toLocaleString('en-AU', { style: 'currency', currency: 'AUD' })} fixture`;
    if (itemCount) itemCount.textContent = `${J5_BOOKING_FIXTURE.items.length} local booking item${J5_BOOKING_FIXTURE.items.length === 1 ? '' : 's'}`;
    const actionsEnabled = detailsVisible && j5CanEnterAction() && j5LifecycleState === 'ready';
    $$('.j5-action[data-j5-action]').forEach((button) => {
      button.disabled = !actionsEnabled; button.setAttribute('aria-describedby', 'j5-review-boundary j5-action-announcement'); button.title = actionsEnabled ? `${button.dataset.j5Action} opens a local review flow` : 'Unavailable in the current review fixture state';
    });
    const announcement = $('#j5-action-announcement'); if (announcement && !j5Operation) announcement.textContent = actionsEnabled ? j5LifecycleMessage() : `${j5LifecycleMessage()} ${j5LocalResult('No booking data changed.')}`;
  }
  function j5SetState(nextState, focusState) {
    if (!isJ5Journey() || !J5_REVIEW_STATES.has(nextState)) return; j5ReviewState = nextState; j5RenderState(); announceLive(`Journey 5 ${nextState.replace('-', ' ')} review fixture shown. No saved data changed.`); if (focusState) window.requestAnimationFrame(() => $('#j5-state-message')?.focus());
  }
  function j5SetLifecycleState(nextState, focusState) {
    if (!isJ5Journey() || !J5_LIFECYCLE_STATES.has(nextState)) return; j5LifecycleState = nextState; j5RenderState(); announceLive(j5LifecycleMessage()); if (focusState) window.requestAnimationFrame(() => $('#j5-action-announcement')?.focus());
  }

  function j5DockPlaybackControls() {
    const dock = $('#j5-playback-controls'); const playBtn = $('#btn-play-journey'); const completeBtn = $('#btn-play-complete'); if (!dock || !playBtn || !completeBtn) return; dock.append(playBtn, completeBtn);
  }
  function j5RestorePlaybackControls() {
    const rail = $('#review-rail'); const stageNav = rail?.querySelector('.stage-nav'); const playBtn = $('#btn-play-journey'); const completeBtn = $('#btn-play-complete'); if (!rail || !stageNav || !playBtn || !completeBtn) return; rail.insertBefore(playBtn, stageNav); rail.insertBefore(completeBtn, stageNav);
  }
  function j5OpenActionHub(trigger) {
    if (!isJ5Journey()) return; const fixture = j4FindFixture('private'); if (!fixture) return; j4OpenDetails(fixture, trigger);
    const dialog = $('#j4-details-dialog'); $('#j4-only-details').hidden = true; $('#j4-only-details').inert = true; $('#j5-action-hub').hidden = false; $('#j5-action-hub').inert = false; $('#j5-action-hub').removeAttribute('aria-hidden');
    $('#j4-details-kicker').textContent = 'Existing private booking · local review'; $('#j4-details-title').textContent = J5_BASE_BOOKING.reference; $('#j4-details-close').setAttribute('aria-label', 'Close existing booking details'); $('#j4-details-back').textContent = 'Back to calendar'; dialog.setAttribute('aria-describedby', 'j5-details-intro j5-review-boundary'); dialog.dataset.j5ActionHub = 'true'; j5DockPlaybackControls(); j5RenderState(); announceLive(`${J5_BASE_BOOKING.reference} private details and local lifecycle action hub opened.`);
  }
  function j5ReturnFromWorkflow() {
    if (j5WorkflowReturning) return; j5WorkflowReturning = true; const dialog = $('#j5-workflow-dialog'); if (dialog?.open) dialog.close(); const op = j5Operation; const trigger = j5WorkflowTrigger; const origin = op?.origin; const action = op?.action; j5WorkflowTrigger = null; j5Operation = null;
    const finishReturn = () => {
      if (isJ6Journey() || (document.body.dataset.journey === '12' && action === 'PublicReschedule')) {
        if (document.body.dataset.journey === '12') window.__j12Review?.reopenPanelAfterWorkflow?.();
        const restored = (origin?.openerSelector && $(origin.openerSelector)) || (action === 'PublicReschedule' ? ($('#j12-reschedule-event') || $('#j6-open-public-review')) : $(`[data-j6-action="${action}"]`));
        (restored || trigger)?.focus({ preventScroll: true });
      } else { j5OpenActionHub(trigger || $('#j4-open-private')); const j5Action = trigger?.dataset?.j5Action; const restored = j5Action ? $(`.j5-action[data-j5-action="${j5Action}"]`) : null; (restored || trigger || $('#j4-details-back'))?.focus(); }
      j5WorkflowReturning = false;
    };
    if (document.body.dataset.journey === '12' && action === 'PublicReschedule') window.setTimeout(finishReturn, 50);
    else window.setTimeout(finishReturn, 0);
  }
  function j5OpenWorkflow(action, trigger) {
    if (isJ6Journey()) return j6StartOperation(action, trigger);
    if (!j5CanEnterAction() || j5LifecycleState !== 'ready') { announceLive(j5LifecycleMessage()); const announcement = $('#j5-action-announcement'); if (announcement) announcement.textContent = j5LifecycleMessage(); return; }
    j5WorkflowTrigger = trigger; j5Operation = { action, stage: action === 'Copy' ? 'guard' : 'setup', commandToken: null, stale: false, permissionChanged: false, previewFailed: false, selectedItem: 'ITEM-LOCAL-001', selectedTarget: 'Studio 4', result: null };
    const details = $('#j4-details-dialog'); if (details?.open) details.close('workflow'); const dialog = $('#j5-workflow-dialog'); if (!dialog) return; j5RenderWorkflow(); dialog.showModal(); window.setTimeout(() => dialog.querySelector('input, select, button:not(.dialog-close)')?.focus(), 0);
  }
  function j5Button(command, text, cls = 'btn-secondary', disabled = false) { return `<button type="button" class="${cls}" data-j5-command="${command}"${disabled ? ' disabled' : ''}>${text}</button>`; }
  function j5ItemOptions(selected, includeBlocked = false) { const items = includeBlocked ? J5_REMOVE_FIXTURES : J5_BOOKING_FIXTURE.items; return items.map((item) => `<option value="${item.id}"${item.id === selected ? ' selected' : ''}>${item.name}</option>`).join(''); }
  function j5SelectedRemoveFixture() { return J5_REMOVE_FIXTURES.find((item) => item.id === j5Operation?.selectedItem) || J5_REMOVE_FIXTURES[0]; }

  // A11Y-INH-02 (PO decisions P-1 and P-2, 15 Oct 2026): the shared step window #j5-workflow-dialog redraws its step area and buttons,
  // so the control that had keyboard focus is removed and focus falls to the page body. Rule R2: after a redraw within the same step
  // (the same step heading), focus returns to the control that was used; after a step change it moves to the new step's heading (or the
  // window title when the step has no heading), made focusable without joining the Tab order. It acts only while the window is open
  // and focus has left it.
  function workflowStepHeading(dialog) { return dialog.querySelector('#j5-workflow-stage h3') || dialog.querySelector('#j5-workflow-title'); }
  function workflowFocusCapture() {
    const dialog = $('#j5-workflow-dialog'), active = document.activeElement;
    if (!dialog?.open || !active || !dialog.contains(active)) return null;
    return { heading: (workflowStepHeading(dialog)?.textContent || '').trim(), id: active.id || '', command: active.dataset?.j5Command || active.dataset?.j8Command || '', name: active.getAttribute('name') || '', value: active.value ?? '', label: (active.textContent || '').trim() };
  }
  function workflowFocusMatch(dialog, before) {
    const usable = (el) => !!el && !el.disabled && !el.hidden && el.getClientRects().length > 0;
    if (before.id) { const el = dialog.querySelector(`#${CSS.escape(before.id)}`); return usable(el) ? el : null; }
    if (before.command) return Array.from(dialog.querySelectorAll('[data-j5-command], [data-j8-command]')).find((el) => usable(el) && (el.dataset.j5Command || el.dataset.j8Command) === before.command && (el.textContent || '').trim() === before.label) || null;
    if (before.name) return Array.from(dialog.querySelectorAll('[name]')).find((el) => usable(el) && el.getAttribute('name') === before.name && (el.value ?? '') === before.value) || null;
    return null;
  }
  function workflowFocusRestore(before) {
    const dialog = $('#j5-workflow-dialog'), active = document.activeElement;
    if (!dialog?.open || (active && active !== document.body && dialog.contains(active))) return;
    const heading = workflowStepHeading(dialog);
    let target = before && before.heading === (heading?.textContent || '').trim() ? workflowFocusMatch(dialog, before) : null;
    if (!target && heading) { if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1'); target = heading; }
    target?.focus();
  }

  function j5RenderWorkflow() {
    if (j6PublicRescheduleWorkflowActive()) return j6RenderWorkflow();
    const op = j5Operation; const stage = $('#j5-workflow-stage'); const preview = $('#j5-workflow-preview'); const footer = $('#j5-workflow-footer'); const title = $('#j5-workflow-title'); const description = $('#j5-workflow-description'); const announcement = $('#j5-workflow-announcement');
    if (!op || !stage || !preview || !footer || !title || !description || !announcement) return;
    const focusBefore = workflowFocusCapture();   // A11Y-INH-02 (rule R2)
    const names = { Copy: 'Copy private booking', Edit: 'Update existing booking', Remove: 'Remove one booking item', Move: 'Move one private item', Batch: 'Batch move private items' }; title.textContent = names[op.action] || 'Local operation'; description.textContent = 'Review fixture only. Previews are non-writing; no server request is sent; reload resets it.'; preview.hidden = true; preview.replaceChildren(); announcement.textContent = '';
    let html = ''; let buttons = '';
    if (op.permissionChanged) {
      html = `<div class="j5-block-card"><span class="badge badge-evidence">PERMISSION CHANGED</span><h3>Confirmation is no longer available</h3><p>The local permission fixture changed before confirmation. The original booking state is preserved; no operation was applied.</p><p class="j5-result-boundary">${j5LocalResult('Refresh the local permission fixture to review the unchanged preview again.')}</p></div>`;
      buttons = j5Button('permission-confirm-blocked', 'Confirmation unavailable', 'btn-secondary', true) + j5Button('permission-refresh', 'Refresh permission', 'btn-primary') + j5Button('workflow-cancel', 'Cancel without loss');
    } else if (op.result) {
      html = `<div class="j5-result-card"><span class="badge badge-safe">LOCAL RESULT</span><h3>${op.result.title}</h3><p>${op.result.copy}</p><p class="j5-result-boundary">${j5LocalResult('This result exists only in memory.')}</p></div>`;
      if (op.action === 'Remove' && op.result.mutated) buttons += j5Button('remove-undo', 'Undo local removal'); if (op.action === 'Batch' && op.result.mutated) buttons += j5Button('batch-rollback', 'Rollback local batch'); if (op.action === 'Batch' && op.result.partial) buttons += j5Button('batch-retry', 'Retry partial fixture', 'btn-primary'); buttons += j5Button('workflow-done', 'Done', 'btn-primary');
    } else if (op.action === 'Copy' && op.stage === 'guard') {
      html = `<div class="j5-guard-card"><span class="badge badge-decision">STAGED WORK GUARD</span><h3>Local staged work is present</h3><p>Choose whether to preserve this local staged selection or explicitly clear it before copying. This is a review fixture, not persisted work.</p></div>`; buttons = j5Button('copy-preserve', 'Preserve & continue', 'btn-primary') + j5Button('copy-clear', 'Clear & continue') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Copy' && op.stage === 'setup') {
      html = `<div class="j5-form-grid"><label>New start date<input id="j5-copy-date" type="date" value="2026-09-04"></label><label class="j5-check-row"><input id="j5-copy-customer" type="checkbox" checked> Retain customer/contact</label><label class="j5-check-row"><input id="j5-copy-prices" type="checkbox"> Retain prices <span class="field-hint">off by default</span></label></div><div class="j5-inline-note">Source read-back: fresh local token v${J5_BASE_BOOKING.version}. Package/item graph has ${J5_BASE_BOOKING.items.length} fixture items.</div>`; buttons = j5Button('copy-stale', 'Show stale source') + j5Button('copy-preview', 'Preview copy', 'btn-primary') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Copy' && op.stage === 'preview') {
      html = `<div class="j5-preview-list"><div><strong>New start</strong><span>${op.date || '04 Sep 2026'}</span></div><div><strong>Customer/contact</strong><span>${op.retainCustomer === false ? 'Reset in local fixture' : 'Retained'}</span></div><div><strong>Prices</strong><span>${op.retainPrices ? 'Retained for comparison only' : 'Reset for comparison only'}</span></div><div><strong>Items</strong><span>${J5_BASE_BOOKING.items.length} copied fixture items</span></div></div><p class="j5-illustrative">Fixture comparison only — this is not a pricing rule.</p>`; buttons = j5Button('copy-confirm', 'Confirm local copy', 'btn-primary', op.stale) + j5Button('copy-refresh', 'Refresh source', 'btn-secondary', !op.stale) + j5Button('workflow-cancel', 'Cancel'); if (op.stale) announcement.textContent = 'Source is stale. Refresh before preview can be confirmed.';
    } else if (op.action === 'Edit' && op.stage === 'setup') {
      html = `<div class="j5-form-grid"><label>Scheduled date<input id="j5-edit-date" type="date" value="${J5_BASE_BOOKING.date}"></label><label>Scheduled time<input id="j5-edit-time" type="time" value="09:00" step="1800"></label><label>Attendee/cover quantity<input id="j5-edit-covers" type="number" min="1" max="80" value="${J5_BASE_BOOKING.covers}"></label><label>Existing private item<select id="j5-edit-item">${j5ItemOptions('ITEM-LOCAL-001')}</select></label></div><div class="j5-inline-note">Edit-start version token: v${J5_BASE_BOOKING.version}. The original booking remains unchanged until one local confirmation.</div>`; buttons = j5Button('update-stale', 'Show stale version') + (op.stale ? j5Button('update-refresh', 'Refresh current version', 'btn-primary') : '') + j5Button('update-failure', 'Show preview failure') + j5Button('update-preview', 'Preview update', 'btn-primary', op.stale) + j5Button('workflow-cancel', 'Cancel without loss'); if (op.stale) announcement.textContent = 'Stale version detected. Refresh current version before preview can be confirmed, or cancel without loss.';
    } else if (op.action === 'Edit' && op.stage === 'preview') {
      html = `<div class="j5-preview-list"><div><strong>Scheduled date</strong><span>${op.date || J5_BASE_BOOKING.date}</span></div><div><strong>Scheduled time</strong><span>${op.time || '09:00'}</span></div><div><strong>Covers</strong><span>${op.covers || J5_BASE_BOOKING.covers}</span></div><div><strong>Item</strong><span>${op.item || 'Existing private item'}</span></div><div><strong>Illustrative price drift</strong><span>AU$ 2,750.00 → AU$ 2,887.50 fixture comparison</span></div></div><p class="j5-illustrative">Illustrative drift evidence only — not authoritative production pricing.</p>`; buttons = j5Button('update-confirm', 'Confirm local update', 'btn-primary') + j5Button('workflow-cancel', 'Cancel without loss');
    } else if (op.action === 'Edit' && op.stage === 'error') {
      html = `<div class="j5-error-card"><span class="badge badge-evidence">RECOVERABLE ERROR</span><h3>Preview failed locally</h3><p>The original booking is preserved. Retry the fixture or cancel without loss.</p></div>`; buttons = j5Button('update-retry', 'Retry preview', 'btn-primary') + j5Button('workflow-cancel', 'Cancel without loss');
    } else if (op.action === 'Remove' && op.stage === 'setup') {
      html = `<div class="j5-form-grid"><label>Exact item to remove<select id="j5-remove-item">${j5ItemOptions(op.selectedItem, true)}</select></label><label>Type target reference<input id="j5-remove-reference" type="text" value="" placeholder="ITEM-LOCAL-001" autocomplete="off"></label></div><div class="j5-impact-card"><strong>Impact</strong><span>Selected private booking item/allocation is removed; the Booking shell remains.</span></div>`; buttons = j5Button('remove-preview', 'Review exact impact', 'btn-primary') + j5Button('remove-failure', 'Show failure') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Remove' && op.stage === 'preview') {
      const item = j5SelectedRemoveFixture(); const blocked = item.state !== 'eligible'; html = `<div class="j5-preview-list"><div><strong>Booking</strong><span>${J5_BASE_BOOKING.reference}</span></div><div><strong>Package/item</strong><span>${item.name}</span></div><div><strong>Private timeslot</strong><span>${item.target}</span></div><div><strong>Resulting impact</strong><span>Item/allocation removed; Booking shell remains</span></div></div>${blocked ? `<div class="j5-block-card"><strong>Blocked fixture: ${item.state === 'delivered' ? 'delivered/scanned' : 'linked standard item'}</strong><span>Cancel or failure preserves the item. No deletion is offered.</span></div>` : `<p class="j5-destructive-warning">Destructive local review action. Type <strong>${item.id}</strong> to confirm the exact target.</p>`}`; buttons = blocked ? j5Button('workflow-cancel', 'Cancel') : j5Button('remove-confirm', 'Confirm local removal', 'btn-danger', op.typed !== item.id) + j5Button('workflow-cancel', 'Cancel'); if (!blocked) announcement.textContent = op.typed === item.id ? 'Exact target matches. One local confirmation is available.' : `Type ${item.id} exactly to enable confirmation.`;
    } else if (op.action === 'Remove' && op.stage === 'error') {
      html = `<div class="j5-error-card"><span class="badge badge-evidence">RECOVERABLE ERROR</span><h3>Removal fixture failed</h3><p>The selected item remains present. Retry or cancel; no partial removal is claimed.</p></div>`; buttons = j5Button('remove-retry', 'Retry impact review', 'btn-primary') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Move' && op.stage === 'setup') {
      html = `<div class="j5-form-grid"><label>Private item<select id="j5-move-item">${j5ItemOptions(op.selectedItem)}</select></label><label>Eligible target<select id="j5-move-target">${J5_TARGETS.map(t => `<option value="${t.value}"${t.value === op.selectedTarget ? ' selected' : ''}${t.state === 'same' ? ' disabled' : ''}>${t.label}${t.state === 'same' ? ' · unavailable' : ''}</option>`).join('')}</select></label><label>Cover distribution<input id="j5-move-covers" type="number" min="1" max="80" value="${J5_BASE_BOOKING.covers}"></label></div><div class="j5-inline-note">Current target is excluded and unavailable. Eligible target capacity is enforced against entered covers; conflict and capacity are deterministic local fixtures.</div>`; buttons = j5Button('move-preview', 'Preview move', 'btn-primary') + j5Button('move-rollback', 'Reset fixture') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Move' && op.stage === 'preview') {
      const target = J5_TARGETS.find(t => t.value === op.selectedTarget) || J5_TARGETS[0]; const covers = Number(op.covers || J5_BASE_BOOKING.covers); const capacityOk = !target.capacity || covers <= target.capacity; const valid = target.state === 'eligible' && capacityOk; html = `<div class="j5-preview-list"><div><strong>Item</strong><span>${op.item || 'Private booking item'}</span></div><div><strong>Current → proposed</strong><span>Studio 2 → ${target.value}</span></div><div><strong>Cover distribution</strong><span>${covers} covers</span></div><div><strong>Eligibility</strong><span>${target.label}</span></div><div><strong>Capacity check</strong><span>${target.capacity ? `${covers} / ${target.capacity} covers` : 'No eligible capacity'}</span></div></div>${valid ? '<p class="j5-inline-note">Non-writing preview. Confirming changes only this in-memory candidate fixture.</p>' : `<div class="j5-block-card"><strong>Move blocked in local fixture</strong><span>${target.state === 'eligible' && !capacityOk ? `Entered covers exceed ${target.value} fixture capacity (${target.capacity}). Reduce covers or cancel.` : 'Select an eligible target or cancel. No allocation or availability claim is made.'}</span></div>`}`; buttons = j5Button('move-confirm', 'Confirm local move', 'btn-primary', !valid) + j5Button('move-refresh', 'Refresh targets') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Batch' && op.stage === 'setup') {
      html = `<fieldset class="j5-batch-fieldset"><legend>Select private booking items</legend>${J5_BOOKING_FIXTURE.items.map((item, i) => `<label class="j5-check-row"><input type="checkbox" data-j5-batch-item value="${item.id}"${i === 0 ? ' checked' : ''}> ${item.name} <span class="field-hint">${item.target}</span></label>`).join('')}</fieldset><div class="j5-form-grid"><label>Shared date<input id="j5-batch-date" type="date" value="2026-09-04"></label><label>Shared time<input id="j5-batch-time" type="time" value="09:00" step="1800"></label><label>Shared target<select id="j5-batch-target"><option value="Studio 4">Studio 4 · complete fixture</option><option value="Studio 7">Studio 7 · partial/conflict fixture</option></select></label></div><div class="j5-inline-note">Shared proposed date/time/target and per-item accounting remain visible in the preview. One local confirmation is used for the selected set.</div>`; buttons = j5Button('batch-preview', 'Preview batch', 'btn-primary') + j5Button('batch-rollback', 'Reset fixture') + j5Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'Batch' && op.stage === 'preview') {
      const partial = op.selectedTarget === 'Studio 7'; html = `<div class="j5-preview-list"><div><strong>Shared proposed date</strong><span>${op.date || '2026-09-04'}</span></div><div><strong>Shared proposed time</strong><span>${op.time || '09:00'}</span></div><div><strong>Shared proposed target</strong><span>${op.selectedTarget}</span></div></div><div class="j5-batch-table" role="table" aria-label="Batch per-item accounting"><div role="row" class="j5-batch-row j5-batch-head"><span>Item</span><span>Eligibility</span><span>Proposed target</span></div>${(op.items || J5_BOOKING_FIXTURE.items.map(i => i.id)).map(id => { const item = J5_BOOKING_FIXTURE.items.find(i => i.id === id) || J5_BOOKING_FIXTURE.items[0]; return `<div role="row" class="j5-batch-row"><span>${item.name}</span><span>${partial && id === 'ITEM-LOCAL-002' ? 'Conflict' : 'Eligible'}</span><span>${op.selectedTarget}</span></div>`; }).join('')}</div><div class="j5-inline-note">Aggregate preview only. Complete/partial labels describe this deterministic fixture, not atomicity or production allocation.</div>`; buttons = j5Button('batch-confirm', partial ? 'Confirm partial local batch' : 'Confirm complete local batch', 'btn-primary') + j5Button('batch-retry', 'Retry targets') + j5Button('workflow-cancel', 'Cancel');
    }
    if (op.stage === 'preview' && !op.result && !op.permissionChanged) buttons += j5Button('permission-change', 'Simulate permission changed');
    stage.innerHTML = html; footer.innerHTML = buttons;
    if (op.stage === 'setup' && op.action === 'Remove') {
      $('#j5-remove-item')?.addEventListener('change', (event) => { op.selectedItem = event.target.value; j5RenderWorkflow(); });
      $('#j5-remove-reference')?.addEventListener('input', (event) => { op.typed = event.target.value.trim(); const confirm = $('[data-j5-command="remove-confirm"]'); if (confirm) confirm.disabled = event.target.value.trim() !== j5SelectedRemoveFixture().id; });
    }
    workflowFocusRestore(focusBefore);   // A11Y-INH-02 (rule R2)
  }

  function j5ReadWorkflowValues() {
    const op = j5Operation; if (!op) return;
    if (op.action === 'Copy') { op.date = $('#j5-copy-date')?.value; op.retainCustomer = $('#j5-copy-customer')?.checked; op.retainPrices = $('#j5-copy-prices')?.checked; }
    if (op.action === 'Edit') { op.date = $('#j5-edit-date')?.value; op.time = $('#j5-edit-time')?.value; op.covers = $('#j5-edit-covers')?.value; op.item = $('#j5-edit-item')?.selectedOptions?.[0]?.textContent; }
    if (op.action === 'Move') { op.selectedItem = $('#j5-move-item')?.value || op.selectedItem; op.item = $('#j5-move-item')?.selectedOptions?.[0]?.textContent; op.selectedTarget = $('#j5-move-target')?.value || op.selectedTarget; op.covers = $('#j5-move-covers')?.value; }
    if (op.action === 'Batch') { op.items = Array.from($$('[data-j5-batch-item]:checked')).map(input => input.value); op.selectedTarget = $('#j5-batch-target')?.value || 'Studio 4'; op.date = $('#j5-batch-date')?.value; op.time = $('#j5-batch-time')?.value; }
  }
  function j5CommitResult(action) {
    const op = j5Operation; if (!op || op.commandToken) return; op.commandToken = `J5-LOCAL-${++j5CommandSerial}`;
    if (action === 'Remove') { const item = j5SelectedRemoveFixture(); J5_BOOKING_FIXTURE.items = J5_BOOKING_FIXTURE.items.filter(i => i.id !== item.id); op.result = { title: 'Private booking item removed locally', copy: `${item.name} was removed from the in-memory candidate. The Booking shell remains.`, mutated: true }; }
    else if (action === 'Move') { const item = J5_BOOKING_FIXTURE.items.find(i => i.id === op.selectedItem); if (item) item.target = op.selectedTarget; op.result = { title: 'Private item moved locally', copy: `${op.item || 'Selected item'} now previews at ${op.selectedTarget}.`, mutated: true }; }
    else if (action === 'Batch') { const partial = op.selectedTarget === 'Studio 7'; op.result = { title: partial ? 'Partial batch result shown locally' : 'Complete batch result shown locally', copy: `${(op.items || []).length} selected private item(s) are accounted for at ${op.selectedTarget} on ${op.date || '2026-09-04'} at ${op.time || '09:00'}; ${partial ? 'one conflict remains retryable.' : 'all selected items are eligible in this fixture.'}`, mutated: true, partial }; }
    else if (action === 'Copy') op.result = { title: 'Copy preview confirmed locally', copy: `A transient copy result ${op.retainCustomer ? 'retaining customer/contact' : 'resetting customer/contact'} was created for ${op.date || 'the selected start date'}; the source booking is unchanged.`, mutated: false };
    else op.result = { title: 'Update preview confirmed locally', copy: `The requested scheduled date ${op.date || J5_BASE_BOOKING.date} at ${op.time || '09:00'}, cover quantity and existing item selection were accepted as a transient local result; the original booking is unchanged.`, mutated: false };
    j5RenderWorkflow(); j5RenderState(); announceLive(j5LocalResult(op.result.title));
  }
  function j5HandleWorkflowCommand(event) {
    if (j6PublicRescheduleWorkflowActive()) return j6HandleWorkflowCommand(event);
    const command = event.target.closest('[data-j5-command]')?.dataset.j5Command; if (!command || !j5Operation) return; const op = j5Operation; if (op.stage === 'setup') j5ReadWorkflowValues();
    if (command === 'permission-change' && op.stage === 'preview' && !op.result) { op.permissionChanged = true; return j5RenderWorkflow(); }
    if (command === 'permission-refresh' && op.permissionChanged) { op.permissionChanged = false; return j5RenderWorkflow(); }
    if (command === 'workflow-cancel' || command === 'workflow-done') return j5ReturnFromWorkflow();
    if (command === 'copy-preserve' || command === 'copy-clear') { op.stage = 'setup'; op.guard = command === 'copy-preserve' ? 'preserved' : 'cleared'; return j5RenderWorkflow(); }
    if (command === 'copy-stale') { op.stage = 'preview'; op.stale = true; return j5RenderWorkflow(); }
    if (command === 'copy-preview') { op.stage = 'preview'; op.stale = false; return j5RenderWorkflow(); }
    if (command === 'copy-refresh') { op.stale = false; op.stage = 'setup'; return j5RenderWorkflow(); }
    if (command === 'copy-confirm') { if (!op.stale) return j5CommitResult('Copy'); }
    if (command === 'update-stale') { op.stale = true; return j5RenderWorkflow(); }
    if (command === 'update-refresh') { op.stale = false; op.stage = 'setup'; return j5RenderWorkflow(); }
    if (command === 'update-failure') { op.stage = 'error'; return j5RenderWorkflow(); }
    if (command === 'update-retry') { op.stage = 'setup'; op.stale = false; return j5RenderWorkflow(); }
    if (command === 'update-preview') { if (!op.stale) { op.stage = 'preview'; j5RenderWorkflow(); } return; }
    if (command === 'update-confirm') return j5CommitResult('Edit');
    if (command === 'remove-preview') { op.stage = 'preview'; return j5RenderWorkflow(); }
    if (command === 'remove-failure') { op.stage = 'error'; return j5RenderWorkflow(); }
    if (command === 'remove-retry') { op.stage = 'setup'; return j5RenderWorkflow(); }
    if (command === 'remove-confirm') { if (op.typed === j5SelectedRemoveFixture().id && j5SelectedRemoveFixture().state === 'eligible') return j5CommitResult('Remove'); }
    if (command === 'remove-undo') { const item = J5_REMOVE_FIXTURES.find(i => i.id === op.selectedItem); if (item && !J5_BOOKING_FIXTURE.items.some(i => i.id === item.id)) J5_BOOKING_FIXTURE.items.push({ id: item.id, name: item.name, target: 'Studio 2', covers: 18, state: 'eligible' }); op.result = { title: 'Removal rolled back locally', copy: 'The selected booking item is present again in the in-memory candidate.', mutated: false }; j5RenderWorkflow(); j5RenderState(); return; }
    if (command === 'move-preview') { op.stage = 'preview'; return j5RenderWorkflow(); }
    if (command === 'move-refresh' || command === 'move-rollback') { op.stage = 'setup'; op.selectedTarget = 'Studio 4'; return j5RenderWorkflow(); }
    if (command === 'move-confirm') { const target = J5_TARGETS.find(t => t.value === op.selectedTarget); const covers = Number(op.covers || J5_BASE_BOOKING.covers); if (target?.state === 'eligible' && covers <= target.capacity) return j5CommitResult('Move'); }
    if (command === 'batch-preview') { j5ReadWorkflowValues(); op.stage = 'preview'; return j5RenderWorkflow(); }
    if (command === 'batch-retry') { op.result = null; op.commandToken = null; op.stage = 'setup'; return j5RenderWorkflow(); }
    if (command === 'batch-rollback') { op.result = null; op.commandToken = null; op.stage = 'setup'; op.selectedTarget = 'Studio 4'; return j5RenderWorkflow(); }
    if (command === 'batch-confirm') { if ((op.items || []).length) return j5CommitResult('Batch'); }
  }
  function j5SetupEvents() {
    if (isJ5Journey()) $$('.j5-review-state[data-j5-review-state]').forEach((button) => button.addEventListener('click', () => { j5SetState(button.dataset.j5ReviewState, false); if (!$('#j4-details-dialog').open) j5OpenActionHub(button); }));
    if (isJ5Journey()) $$('.j5-review-state[data-j5-lifecycle-state]').forEach((button) => button.addEventListener('click', () => j5SetLifecycleState(button.dataset.j5LifecycleState, false)));
    if (isJ5Journey()) $$('.j5-action[data-j5-action]').forEach((button) => button.addEventListener('click', (event) => j5OpenWorkflow(event.currentTarget.dataset.j5Action, event.currentTarget)));
    if (isJ6Journey()) $$('[data-j6-action]').forEach((button) => button.addEventListener('click', (event) => j5OpenWorkflow(event.currentTarget.dataset.j6Action, event.currentTarget)));
    if (isJ6Journey()) $$('[data-j6-permission]').forEach((button) => button.addEventListener('click', (event) => { j5ReviewState = event.currentTarget.dataset.j6Permission === 'denied' ? 'denied' : 'loaded'; announceLive(j5ReviewState === 'denied' ? 'Permission denied before action entry.' : 'Permission fixture restored to ready.'); }));
    document.addEventListener('click', (event) => { if (event.target.closest('#j5-workflow-footer [data-j5-command]')) j5HandleWorkflowCommand(event); }); $('#j5-workflow-close')?.addEventListener('click', j5ReturnFromWorkflow); $('#j5-workflow-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); j5ReturnFromWorkflow(); }); $('#j5-workflow-dialog')?.addEventListener('close', () => { if (j5WorkflowTrigger && !j5WorkflowReturning) j5ReturnFromWorkflow(); }); $('#j4-details-dialog').addEventListener('close', (event) => { if (event?.returnValue !== 'workflow') j5RestorePlaybackControls(); });
  }
  function j5ResetBootState() {
    j4ResetBootState(); j4ActiveFixtureId = 'private'; J5_BOOKING_FIXTURE = j5CloneBooking(); const overviewTitle = $('#j4-overview-title'); const overviewCopy = $('#j4-overview p'); const caption = $('.calendar-caption');
    if (overviewTitle) overviewTitle.textContent = 'Review private Existing Booking lifecycle flows'; if (overviewCopy) overviewCopy.textContent = 'CR-J5-002 through CR-J5-006 are deterministic local review fixtures. Copy, update, item removal, Move and Batch never call a server or persist data.'; if (caption) caption.textContent = 'REVIEW FIXTURE — private lifecycle candidate; previews are non-writing and reload resets local results.';
    j5ReviewState = 'loaded'; j5LifecycleState = 'ready'; j5Operation = null; renderCalendar(); j5RenderState(); window.setTimeout(() => j5OpenActionHub($('#j4-open-private')), 0);
  }
  function j5PreparePlayback() { const panel = $('#review-rail-panel'); panel.hidden = false; $('#review-rail-toggle').setAttribute('aria-expanded', 'true'); if (!$('#j4-details-dialog').open) j5OpenActionHub($('#j4-open-private')); else j5RenderState(); }
  function j5PlaybackCaption(message) { const announcement = $('#j5-action-announcement'); if (announcement) announcement.textContent = message; announceLive(message); }
  async function j5RunPlayback(mode) {
    if (playJourneyActive) return; playJourneyActive = true; const playBtn = $('#btn-play-journey'); const completeBtn = $('#btn-play-complete'); playBtn.disabled = true; completeBtn.disabled = true; document.body.dataset.j5Playback = mode; j5PreparePlayback();
    const fullSequence = [{ state: 'loading', caption: 'Loading — lifecycle actions are unavailable.' }, { state: 'loaded', caption: 'Loaded — private local action hub is visible.' }, { lifecycle: 'permission-denied', caption: 'Permission denied before entry.' }, { lifecycle: 'ready', action: 'Copy', caption: 'Copy opens a local staged-work guard.' }, { action: 'Edit', caption: 'Update opens a non-writing preview flow.' }, { action: 'Remove', caption: 'Remove shows exact target and private Booking-item impact.' }, { action: 'Move', caption: 'Move shows eligible, conflict and capacity target fixtures.' }, { action: 'Batch', caption: 'Batch shows per-item accounting and partial recovery.' }, { state: 'partial', caption: 'Partial details truthfully withhold total.' }, { state: 'error', caption: 'Error + Retry preserves the original fixture.' }, { retry: true, caption: 'Retry returns only to the local loaded presentation.' }];
    const sequence = mode === 'complete' ? fullSequence.slice(0, 2).concat(fullSequence.slice(8)) : fullSequence;
    try { for (let index = 0; index < sequence.length; index += 1) { const step = sequence[index]; if (step.state) j5SetState(step.state, false); if (step.lifecycle) j5SetLifecycleState(step.lifecycle, false); if (step.action) { j5LifecycleState = 'ready'; j5RenderState(); const action = $(`.j5-action[data-j5-action="${step.action}"]`); if (action && !action.disabled) { action.click(); if ($('#j5-workflow-dialog')?.open) j5ReturnFromWorkflow(); } } if (step.retry) $('#j5-retry')?.click(); j5PlaybackCaption(`Step ${index + 1} of ${sequence.length}: ${step.caption}`); await waitForPlay(mode === 'complete' ? REVIEW_COMPLETE_STEP_MS : REVIEW_PLAY_STEP_MS); } j5SetState('loaded', false); j5SetLifecycleState('ready', false); j5PlaybackCaption(`${mode === 'complete' ? 'Play complete' : 'Play journey'} finished. Candidate remains local and non-persistent.`); } catch (error) { console.error(error); j5PlaybackCaption('Playback stopped at the last safe local review state.'); } finally { delete document.body.dataset.j5Playback; playJourneyActive = false; playBtn.disabled = false; completeBtn.disabled = false; }
  }
  function j5PlayJourney() { return j5RunPlayback('journey'); }
  function j5PlayComplete() { return j5RunPlayback('complete'); }

  /* ===== Journey 6 isolated candidate — CR-J6-001 through CR-J6-006 ===== */

  const J6_PUBLIC_BANNER = 'REVIEW FIXTURE — this local playback represents one runtime-confirmed public-event timeslot change and restore. It is not Public lifecycle support. Canonical FN-RES-008 remains NOT FOUND in the code trace and OUT OF SCOPE for the current Diary approval boundary. Journey 6 claims no ownership of Public behavior.';
  const J6_ENTRY_COPY = 'REVIEW FIXTURE — public-event identification and the public context menu are UNVERIFIED (runtime validation 2026-08-04). This entry is a review-only control, not a reproduced menu path.';
  const J6_DEFECT_COPY = 'DEFECT — duplicate/cancelled availability preparation was observed in the current system. It is described here and deliberately not reproduced.';
  const J6_RESULT_SUFFIX = 'Local review result — no server request sent; reload resets it.';

  function j6PermissionAllowed() { return j5ReviewState !== 'denied' && j5LifecycleState === 'ready'; }
  function j6ActionTitle(action) {
    return ({ PublicReschedule: 'Public timeslot reschedule · review fixture', BookingReschedule: 'Booking reschedule · blocked review', MultiReschedule: 'Multiple reschedule · heterogeneous review', AssetDescription: 'Asset Description → Resources → Resource Booking → Reschedule Booking', Reallocate: 'Resource reallocation · proposed review' })[action] || 'Journey 6 local review';
  }
  function j6Duration(start, end) {
    const mins = (v) => { const [h, m] = String(v || '00:00').split(':').map(Number); return h * 60 + m; };
    return `${(Math.max(0, mins(end) - mins(start)) / 60).toFixed(2)} HRS`;
  }
  function j6Button(command, text, cls = 'btn-secondary', disabled = false) { return j5Button(command, text, cls, disabled); }
  function j6ReadValues() {
    const op = j5Operation; if (!op) return;
    const date = $('#j6-date')?.value;
    if (date) op.date = date;
    if (op.timeMode === 'different') {
      const rows = ['a', 'b'].map((id) => ({ id, start: $(`#j6-start-${id}`)?.value || op.itemTimes?.find((x) => x.id === id)?.start || op.start, end: $(`#j6-end-${id}`)?.value || op.itemTimes?.find((x) => x.id === id)?.end || op.end }));
      op.itemTimes = rows;
      op.start = rows[0].start; op.end = rows[0].end;
      op.duration = rows.map((row) => `${row.id.toUpperCase()}: ${j6Duration(row.start, row.end)}`).join(' · ');
      op.changed = op.date !== op.baseline.date || rows.some((row, index) => row.start !== op.baselineTimes[index].start || row.end !== op.baselineTimes[index].end);
      return;
    }
    const start = $('#j6-start')?.value, end = $('#j6-end')?.value;
    if (start) op.start = start; if (end) op.end = end;
    op.duration = op.selection === 'heterogeneous' ? '0.00 HRS' : j6Duration(op.start, op.end);
    op.changed = op.date !== op.baseline.date || op.start !== op.baseline.start || op.end !== op.baseline.end;
  }
  function j6StartOperation(action, trigger) {
    const routeOk = isJ6Journey() || (document.body.dataset.journey === '12' && action === 'PublicReschedule');
    if (!routeOk) return;
    if (!j6PermissionAllowed()) { announceLive('Permission denied before action entry. The local fixture remains unchanged.'); return; }
    const publicAction = action === 'PublicReschedule';
    j5WorkflowTrigger = trigger || document.activeElement;
    const opener = j5WorkflowTrigger;
    j5Operation = {
      action,
      evidenceClass: publicAction ? 'REVIEW FIXTURE' : action === 'BookingReschedule' ? 'PARTIAL' : 'UNVERIFIED',
      origin: { openerSelector: opener?.id ? `#${opener.id}` : null, restore: () => opener?.focus?.() },
      stage: action === 'Reallocate' ? 'preview' : 'setup',
      substage: action === 'AssetDescription' ? 'summary' : null,
      timeMode: action === 'MultiReschedule' ? 'different' : 'common', date: '2026-08-28',
      start: publicAction ? '08:00' : '09:00', end: publicAction ? '19:00' : '13:00',
      duration: publicAction ? '11.00 HRS' : '4.00 HRS',
      baseline: { date: '2026-08-28', start: publicAction ? '08:00' : '09:00', end: publicAction ? '19:00' : '13:00' },
      baselineTimes: [{ id: 'a', start: publicAction ? '08:00' : '09:00', end: publicAction ? '19:00' : '13:00' }, { id: 'b', start: publicAction ? '09:00' : '10:00', end: publicAction ? '18:00' : '14:00' }],
      itemTimes: [{ id: 'a', start: publicAction ? '08:00' : '09:00', end: publicAction ? '19:00' : '13:00' }, { id: 'b', start: publicAction ? '09:00' : '10:00', end: publicAction ? '18:00' : '14:00' }],
      changed: false, availability: 'idle', selection: action === 'MultiReschedule' ? 'heterogeneous' : 'homogeneous',
      resource: { query: '', page: 1, selectedId: null, listState: action === 'AssetDescription' ? 'loaded' : 'loading' },
      stale: false, permissionChanged: false, commandToken: null, result: null, restored: false, localResultCount: 0
    };
    const details = $('#j4-details-dialog'); if (details?.open) details.close('workflow');
    const dialog = $('#j5-workflow-dialog'); if (!dialog) return;
    j6RenderWorkflow(); dialog.hidden = false; dialog.inert = false; dialog.removeAttribute('aria-hidden'); dialog.showModal();
    window.setTimeout(() => dialog.querySelector('input, select, button:not(.dialog-close)')?.focus(), 0);
    announceLive(`${j6ActionTitle(action)} opened. No server request sent.`);
  }
  function j6ResultCard(title, copy, cls = 'j6-open') {
    const label = cls === 'j6-unverified' ? 'UNVERIFIED' : cls === 'j6-blocked' ? 'BLOCKED/DEFECT-AFFECTED' : 'RUNTIME-CONFIRMED';
    return `<div class="j6-stage-card ${cls}"><span class="j6-workflow-label">${label}</span><h3>${title}</h3><p>${copy}</p></div>`;
  }
  function j6RenderTimeForm(op, heading, extra = '') {
    const stageModifier = op.stage === 'blocked' ? 'j6-blocked' : op.stage === 'error' ? 'j6-safety' : op.substage === 'reschedule' ? 'j6-unverified' : 'j6-open';
    const timeFields = op.timeMode === 'different'
      ? `<div class="j6-different-time-rows" role="group" aria-label="Different time per-item rows"><div class="j6-different-time-row"><strong>Item A · ${op.resource?.selectedId || 'Hall 1'}</strong><label>Start<input id="j6-start-a" type="time" value="${op.itemTimes[0].start}"></label><label>End<input id="j6-end-a" type="time" value="${op.itemTimes[0].end}"></label><label class="j6-field-readonly">Duration (derived)<input id="j6-duration-a" type="text" value="${j6Duration(op.itemTimes[0].start, op.itemTimes[0].end)}" readonly aria-readonly="true"></label></div><div class="j6-different-time-row"><strong>Item B · ${op.resource?.selectedId || 'Studio 2'}</strong><label>Start<input id="j6-start-b" type="time" value="${op.itemTimes[1].start}"></label><label>End<input id="j6-end-b" type="time" value="${op.itemTimes[1].end}"></label><label class="j6-field-readonly">Duration (derived)<input id="j6-duration-b" type="text" value="${j6Duration(op.itemTimes[1].start, op.itemTimes[1].end)}" readonly aria-readonly="true"></label></div></div>`
      : `<div class="j5-form-grid"><label>Start<input id="j6-start" type="time" value="${op.start}"></label><label>End<input id="j6-end" type="time" value="${op.end}"></label><label class="j6-field-readonly">Duration (derived)<input id="j6-duration" type="text" value="${op.duration}" readonly aria-readonly="true"></label></div>`;
    return `<div class="j6-stage-card ${stageModifier}"><span class="j6-workflow-label">${op.evidenceClass}</span><h3>${heading}</h3><div class="j5-form-grid"><label>Date<input id="j6-date" type="date" value="${op.date}"></label><label>Time mode<select id="j6-time-mode"><option value="common"${op.timeMode === 'common' ? ' selected' : ''}>Common time</option><option value="different"${op.timeMode === 'different' ? ' selected' : ''}>Different times</option></select></label></div>${timeFields}<p class="j5-inline-note">Before / after preview only. Duration is derived and not independently editable. No pricing, persistence, transaction or concurrency outcome is claimed.</p>${extra}${op.changed ? '' : '<p class="j6-resource-state">Unchanged interval: submit is an exact no-op. The dialog remains open and no result or token is created.</p>'}</div>`;
  }
  function j6RenderWorkflow() {
    const op = j5Operation, stage = $('#j5-workflow-stage'), footer = $('#j5-workflow-footer'), title = $('#j5-workflow-title'), description = $('#j5-workflow-description'), announcement = $('#j5-workflow-announcement');
    if (!op || !stage || !footer || !title || !description || !announcement) return;
    const focusBefore = workflowFocusCapture();   // A11Y-INH-02 (rule R2)
    $('#j5-workflow-kicker').textContent = 'Journey 6 · UJ-07 · local review'; title.textContent = j6ActionTitle(op.action); description.textContent = 'Review fixture only. Every preview is non-writing; no server request is sent; reload resets it.'; announcement.textContent = '';
    let html = '', buttons = '';
    if (op.permissionChanged) {
      html = j6ResultCard('Permission changed during preview', 'Confirmation and restore are unavailable until the local permission fixture is refreshed. The original in-memory state is preserved.', 'j6-blocked'); buttons = j6Button('permission-refresh', 'Refresh permission', 'btn-primary') + j6Button('workflow-cancel', 'Cancel without loss');
    } else if (op.result) {
      html = j6ResultCard(op.result.title, op.result.copy, op.result.kind === 'unverified' ? 'j6-unverified' : 'j6-open');
      if (op.action === 'PublicReschedule' && op.result.kind === 'change' && !op.restored && op.localResultCount < 2) buttons = j6Button('j6-restore', 'Guarded restore to 08:00–19:00', 'btn-primary') + j6Button('j6-permission-change', 'Permission changed');
      buttons += j6Button('workflow-done', 'Done', 'btn-primary');
    } else if (op.action === 'Reallocate') {
      html = `<div class="j6-stage-card j6-unverified"><span class="j6-workflow-label">UNVERIFIED</span><h3>Proposed before / after preview</h3><p>Resource reallocation is presented as a local proposal only. No save, change-assets persistence or success is shown.</p><div class="j6-indivisible"><strong>DFC + DFCD + Allocation</strong><span>one indivisible displayed row</span></div><p>OWN-ALLOC-01 — OPEN. No backend ownership, atomicity, capacity, rights or rollback decision is implied.</p></div>`;
      buttons = j6Button('workflow-cancel', 'Cancel without loss');
    } else if (op.action === 'AssetDescription') {
      const sub = op.substage || 'summary';
      const crumbs = `<div class="j6-breadcrumb"><span aria-current="${sub === 'summary' ? 'step' : 'false'}">Asset Description</span><span aria-current="${sub === 'resources' ? 'step' : 'false'}">Resources</span><span aria-current="${sub === 'resource-booking' ? 'step' : 'false'}">Resource Booking</span><span aria-current="${sub === 'reschedule' ? 'step' : 'false'}">Reschedule Booking</span></div>`;
      if (sub === 'summary') { html = `<div class="j6-stage-card j6-unverified">${crumbs}<span class="j6-workflow-label">UNVERIFIED</span><h3>Asset Description</h3><p>Summary and tabs are available for review. Resource and booking actions remain local and non-persistent.</p><p>Tabs: Summary · Resources · Booking context. No pricing amount or save control is shown.</p></div>`; buttons = j6Button('j6-next-resources', 'Resources', 'btn-primary') + j6Button('workflow-cancel', 'Cancel'); }
      else if (sub === 'resources') { const state = op.resource.listState; html = `<div class="j6-stage-card j6-unverified">${crumbs}<span class="j6-workflow-label">UNVERIFIED</span><h3>Resources</h3><label>Search resources<input id="j6-resource-query" type="search" value="${op.resource.query}" placeholder="Search local fixtures"></label><p class="j6-resource-state">${state === 'loading' ? 'Resource list loading — no request is sent.' : state === 'empty' ? 'No local resource matches. Empty state only.' : state === 'error' ? 'Resource list error. Retry the local fixture.' : state === 'denied' ? 'Permission denied for resource list. No rights matrix is claimed.' : `Loaded local resources page ${op.resource.page}: Studio 4 · Studio 7 · Hall 1. Selection remains a local fixture.`}</p></div>`; buttons = j6Button('j6-resource-loading', 'Loading') + j6Button('j6-resource-empty', 'Empty') + j6Button('j6-resource-error', 'Error + retry') + j6Button('j6-resource-denied', 'Denied') + j6Button('j6-resource-loaded', 'Loaded') + j6Button('j6-resource-page', 'Next page') + j6Button('j6-resource-select', 'Select Studio 4') + j6Button('j6-next-resource-booking', 'Resource Booking', 'btn-primary', state !== 'loaded') + j6Button('j6-back', 'Back') + j6Button('workflow-cancel', 'Cancel'); }
      else if (sub === 'resource-booking') { html = `<div class="j6-stage-card j6-unverified">${crumbs}<span class="j6-workflow-label">UNVERIFIED</span><h3>Resource Booking</h3><p>Selected resource: ${op.resource.selectedId || 'Studio 4 local fixture'}.</p><p>Apply / Cancel are local navigation only. No resource save, availability write or booking persistence is available.</p></div>`; buttons = j6Button('j6-apply-preview', 'Apply to proposed preview', 'btn-primary') + j6Button('j6-back', 'Back') + j6Button('workflow-cancel', 'Cancel'); }
      else { html = j6RenderTimeForm(op, 'Reschedule Booking', '<p class="j6-resource-state">UNVERIFIED proposed before/after preview. A confirmation success is deliberately unavailable.</p>'); buttons = j6Button('j6-proposed-preview', 'Show proposed preview', 'btn-primary') + j6Button('j6-back', 'Back') + j6Button('workflow-cancel', 'Cancel'); }
    } else if (op.action === 'MultiReschedule') {
      html = j6RenderTimeForm(op, 'Multiple reschedule', '<p class="j6-resource-state"><strong>Varies</strong> — heterogeneous selection. Duration: 0.00 HRS. Multi-item commit is permanently disabled.</p>'); buttons = j6Button('j6-check', 'Review availability', 'btn-primary', true) + j6Button('workflow-cancel', 'Cancel');
    } else if (op.action === 'BookingReschedule') {
      if (op.stage === 'setup') { html = j6RenderTimeForm(op, 'Booking reschedule', `<p class="j6-defect-note">${J6_DEFECT_COPY}</p>`); buttons = j6Button('j6-loading', 'Show availability loading') + j6Button('j6-check', 'Check availability', 'btn-primary') + j6Button('j6-noop-submit', 'Submit unchanged time') + j6Button('workflow-cancel', 'Cancel'); }
      else if (op.stage === 'availability') { html = j6ResultCard('Availability available for review', 'Availability completed in the local fixture. The next Booking preview is deliberately blocked at the observed HTTP 400 defect boundary.', 'j6-safety') + `<p class="j6-defect-note">${J6_DEFECT_COPY}</p>`; buttons = j6Button('j6-check', 'Continue to preview blocker', 'btn-primary') + j6Button('j6-conflict', 'Show conflict') + j6Button('j6-error', 'Show error') + j6Button('j6-back', 'Back') + j6Button('workflow-cancel', 'Cancel'); }
      else { html = j6ResultCard('Preview blocked — HTTP 400 evidence', 'Availability completed in the local fixture, but Booking preview is BLOCKED/DEFECT-AFFECTED. Commit is never enabled and no Booking PATCH success is simulated.', 'j6-blocked') + `<p class="j6-defect-note">${J6_DEFECT_COPY}</p>`; buttons = j6Button('workflow-cancel', 'Cancel without loss'); }
    } else if (op.action === 'PublicReschedule') {
      if (op.stage === 'setup') { html = `<div class="j6-public-banner">${J6_PUBLIC_BANNER}</div>` + j6RenderTimeForm(op, 'Public timeslot change', `<p class="j6-entry-note">${J6_ENTRY_COPY}</p><p class="j6-defect-note">${J6_DEFECT_COPY}</p>`); buttons = j6Button('j6-loading', 'Show availability loading') + j6Button('j6-check', 'Check availability', 'btn-primary') + j6Button('j6-noop-submit', 'Submit unchanged time') + j6Button('workflow-cancel', 'Cancel'); }
      else if (op.stage === 'availability') { html = `<div class="j6-public-banner">${J6_PUBLIC_BANNER}</div><div class="j6-stage-card ${op.availability === 'error' ? 'j6-blocked' : 'j6-safety'}"><span class="j6-workflow-label">${op.availability.toUpperCase()}</span><h3>Availability review</h3><p>${op.availability === 'loading' ? 'Availability is loading. No duplicate request is reproduced.' : op.availability === 'error' ? 'The local availability fixture returned an error. Retry without reproducing duplicate work.' : op.availability === 'conflict' ? 'Conflict / unavailable fixture. No override or capacity claim is made.' : 'Availability is ready for a non-writing before/after preview.'}</p><p class="j6-defect-note">${J6_DEFECT_COPY}</p></div>`; buttons = j6Button('j6-check', 'Retry availability', 'btn-primary') + j6Button('j6-conflict', 'Show conflict') + j6Button('j6-error', 'Show error') + j6Button('j6-stale', 'Show stale target') + j6Button('j6-permission-change', 'Permission changed') + j6Button('j6-back', 'Back') + j6Button('workflow-cancel', 'Cancel'); }
      else { html = `<div class="j6-public-banner">${J6_PUBLIC_BANNER}</div><div class="j6-stage-card j6-safety"><span class="j6-workflow-label">RUNTIME-CONFIRMED · LOCAL ONLY</span><h3>Before / after preview</h3><div class="j6-indivisible"><strong>${op.baseline.date} · ${op.baseline.start}–${op.baseline.end}</strong><span>before</span></div><div class="j6-indivisible"><strong>${op.date} · ${op.start}–${op.end}</strong><span>proposed · ${op.duration}</span></div><p>No server request is sent. Confirmation is guarded by stale and permission checks.</p></div>`; buttons = j6Button('j6-confirm', 'Confirm one local change', 'btn-primary', op.stale || !op.changed) + j6Button('j6-stale', 'Show stale target') + j6Button('j6-permission-change', 'Permission changed') + j6Button('j6-refresh', 'Refresh target', 'btn-secondary', !op.stale) + j6Button('j6-back', 'Back') + j6Button('workflow-cancel', 'Cancel'); }
    }
    stage.innerHTML = html; footer.innerHTML = buttons;
    if ($('#j6-duration')) $('#j6-duration').value = op.duration;
    $('#j6-time-mode')?.addEventListener('change', (event) => { op.timeMode = event.target.value; j6ReadValues(); return j6RenderWorkflow(); });
    ['#j6-date', '#j6-start', '#j6-end', '#j6-start-a', '#j6-end-a', '#j6-start-b', '#j6-end-b'].forEach((selector) => $(selector)?.addEventListener('input', () => { j6ReadValues(); if ($('#j6-duration')) $('#j6-duration').value = op.duration; if ($('#j6-duration-a')) $('#j6-duration-a').value = j6Duration(op.itemTimes[0].start, op.itemTimes[0].end); if ($('#j6-duration-b')) $('#j6-duration-b').value = j6Duration(op.itemTimes[1].start, op.itemTimes[1].end); }));
    $('#j6-resource-query')?.addEventListener('input', (event) => { op.resource.query = event.target.value; });
    workflowFocusRestore(focusBefore);   // A11Y-INH-02 (rule R2)
  }
  function j6CommitResult(kind) {
    const op = j5Operation; if (!op || op.commandToken || op.localResultCount >= 2) return;
    if (!j6PermissionAllowed()) { op.permissionChanged = true; return j6RenderWorkflow(); }
    op.commandToken = `J6-LOCAL-${++j5CommandSerial}`; op.localResultCount += 1;
    if (kind === 'change') { j6PublicInterval = { start: op.start, end: op.end }; op.result = { kind: 'change', title: 'Public timeslot changed locally', copy: `One local review update changed ${op.baseline.start}–${op.baseline.end} to ${op.start}–${op.end}. ${J6_RESULT_SUFFIX}` }; renderCalendar(); }
    else { j6PublicInterval = { start: op.baseline.start, end: op.baseline.end }; op.restored = true; op.result = { kind: 'restore', title: 'Public timeslot restored locally', copy: `The local review fixture returned to ${op.baseline.start}–${op.baseline.end}. ${J6_RESULT_SUFFIX}` }; renderCalendar(); }
    j6RenderWorkflow(); announceLive(op.result.copy);
  }
  function j6HandleWorkflowCommand(event) {
    const command = event.target.closest('[data-j5-command]')?.dataset.j5Command, op = j5Operation;
    if (!command || !op) return;
    if (command === 'workflow-cancel' || command === 'workflow-done') return j5ReturnFromWorkflow();
    if (command === 'permission-change' || command === 'j6-permission-change') { op.permissionChanged = true; return j6RenderWorkflow(); }
    if (command === 'permission-refresh') { op.permissionChanged = false; return j6RenderWorkflow(); }
    if (command === 'j6-noop-submit') { j6ReadValues(); if (!op.changed) { const a = $('#j5-workflow-announcement'); if (a) a.textContent = `Unchanged time submitted — no transition or result. ${J6_RESULT_SUFFIX}`; announceLive('Unchanged time submitted; no local result was created and the dialog remains open.'); } return; }
    if (command === 'j6-loading') { op.availability = 'loading'; op.stage = 'availability'; return j6RenderWorkflow(); }
    if (command === 'j6-check') { j6ReadValues(); if (!op.changed && op.availability !== 'loading') { const a = $('#j5-workflow-announcement'); if (a) a.textContent = `Unchanged time submitted — no transition or result. ${J6_RESULT_SUFFIX}`; announceLive('Unchanged time submitted; no local result was created.'); return; } if (op.availability === 'loading') { op.availability = 'available'; op.stage = 'availability'; return j6RenderWorkflow(); } if (op.action === 'BookingReschedule' && op.stage === 'availability') { op.availability = 'available'; op.stage = 'blocked'; return j6RenderWorkflow(); } op.availability = 'available'; op.stage = op.action === 'BookingReschedule' ? 'availability' : 'preview'; return j6RenderWorkflow(); }
    if (command === 'j6-conflict') { op.availability = 'conflict'; op.stage = 'availability'; return j6RenderWorkflow(); }
    if (command === 'j6-error') { op.availability = 'error'; op.stage = 'availability'; return j6RenderWorkflow(); }
    if (command === 'j6-stale') { op.stale = true; op.stage = op.action === 'PublicReschedule' ? 'preview' : op.stage; return j6RenderWorkflow(); }
    if (command === 'j6-refresh') { op.stale = false; op.permissionChanged = false; op.stage = 'setup'; op.timeMode = 'common'; op.date = op.baseline.date; op.start = op.baseline.start; op.end = op.baseline.end; op.itemTimes = op.baselineTimes.map((row) => ({ ...row })); op.duration = op.selection === 'heterogeneous' ? '0.00 HRS' : j6Duration(op.start, op.end); op.changed = false; return j6RenderWorkflow(); }
    if (command === 'j6-confirm') { j6ReadValues(); if (op.stale || !op.changed || op.permissionChanged) return j6RenderWorkflow(); return j6CommitResult('change'); }
    if (command === 'j6-restore') { if (op.restored || op.permissionChanged || !j6PermissionAllowed()) { op.permissionChanged = true; return j6RenderWorkflow(); } op.commandToken = null; return j6CommitResult('restore'); }
    if (command === 'j6-back') { if (op.action === 'AssetDescription') op.substage = op.substage === 'reschedule' ? 'resource-booking' : op.substage === 'resource-booking' ? 'resources' : 'summary'; else { op.stage = 'setup'; op.availability = 'idle'; } return j6RenderWorkflow(); }
    if (command === 'j6-next-resources') { op.substage = 'resources'; return j6RenderWorkflow(); }
    if (command === 'j6-resource-loading') { op.resource.listState = 'loading'; return j6RenderWorkflow(); }
    if (command === 'j6-resource-empty') { op.resource.listState = 'empty'; return j6RenderWorkflow(); }
    if (command === 'j6-resource-error') { op.resource.listState = 'error'; return j6RenderWorkflow(); }
    if (command === 'j6-resource-denied') { op.resource.listState = 'denied'; return j6RenderWorkflow(); }
    if (command === 'j6-resource-loaded') { op.resource.listState = 'loaded'; return j6RenderWorkflow(); }
    if (command === 'j6-resource-page') { op.resource.page += 1; return j6RenderWorkflow(); }
    if (command === 'j6-resource-select') { op.resource.selectedId = 'Studio 4'; return j6RenderWorkflow(); }
    if (command === 'j6-next-resource-booking') { if (op.resource.listState === 'loaded') { op.resource.selectedId = 'Studio 4'; op.substage = 'resource-booking'; return j6RenderWorkflow(); } return; }
    if (command === 'j6-next-reschedule' || command === 'j6-apply-preview') { op.substage = 'reschedule'; op.evidenceClass = 'UNVERIFIED'; return j6RenderWorkflow(); }
    if (command === 'j6-proposed-preview') { op.stage = 'preview'; op.evidenceClass = 'UNVERIFIED'; return j6RenderWorkflow(); }
  }
  function j6ResetBootState() {
    j4ResetBootState();
    const j6Controls = $('#j6-review-controls');
    if (j6Controls) { j6Controls.hidden = false; j6Controls.inert = false; j6Controls.removeAttribute('aria-hidden'); }
    const j6RailPanel = $('#review-rail-panel');
    const j6RailToggle = $('#review-rail-toggle');
    if (j6RailPanel) { j6RailPanel.hidden = false; j6RailPanel.inert = false; j6RailPanel.removeAttribute('aria-hidden'); }
    if (j6RailToggle) j6RailToggle.setAttribute('aria-expanded', 'true');
    j4ActiveFixtureId = 'public-review'; j4EnabledFilters = new Set(J6_FILTER_ORDER); j6PublicInterval = { start: '08:00', end: '19:00' }; j5ReviewState = 'loaded'; j5LifecycleState = 'ready'; j5Operation = null;
    const overview = $('#j4-overview');
    if (overview) { overview.hidden = false; overview.inert = false; overview.removeAttribute('aria-hidden'); overview.innerHTML = `<div><span class="j4-kicker">Journey 6 · UJ-07 · Maintenance / Public Events</span><h1 id="j4-overview-title">Reschedule timeslots and reallocate resources</h1></div><div><p class="j6-public-banner">${J6_PUBLIC_BANNER}</p><p class="j6-defect-note">${J6_DEFECT_COPY}</p><p class="j6-entry-note">${J6_ENTRY_COPY}</p><p class="j6-entry-note"><strong>Evidence labels:</strong> RUNTIME-CONFIRMED · PARTIAL · BLOCKED/DEFECT-AFFECTED · UNVERIFIED · REVIEW FIXTURE.</p></div>`; }
    const caption = $('.calendar-caption'); if (caption) caption.textContent = 'REVIEW FIXTURE — Journey 6 local reschedule/reallocation candidate; no server request sent and reload resets it.'; renderCalendar();
  }
  async function j6RunPlayback(mode) { if (!isJ6Journey() || playJourneyActive) return; playJourneyActive = true; const playBtn = $('#btn-play-journey'), completeBtn = $('#btn-play-complete'); playBtn.disabled = true; completeBtn.disabled = true; try { const trigger = $('#j6-open-public-review') || $('#j6-open-booking'); if (trigger) { j6StartOperation('PublicReschedule', trigger); announceLive(`${mode === 'complete' ? 'Play complete' : 'Play journey'} opened the bounded local review fixture.`); } } finally { playJourneyActive = false; playBtn.disabled = false; completeBtn.disabled = false; } }
  function j6PlayJourney() { return j6RunPlayback('journey'); }
  function j6PlayComplete() { return j6RunPlayback('complete'); }

  /* ===== Journey 3 candidate — CR-J3-003 / CR-J3-004 / CR-J3-005 ===== */

  const J3_FIXTURE_CATALOG = (function buildJ3FixtureCatalog() {
    const fixtures = [];
    const venues = [
      { key: 'j3v-north', name: 'J3 Review Venue North' },
      { key: 'j3v-south', name: 'J3 Review Venue South' }
    ];
    const hallNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
    const studioNames = ['One', 'Two', 'Three', 'Four', 'Five'];
    let seq = 0;
    venues.forEach((venue, vi) => {
      ['Halls', 'Studios'].forEach((category) => {
        const names = category === 'Halls' ? hallNames : studioNames;
        names.forEach((label, ni) => {
          seq += 1;
          const id = 'j3-rf-' + pad(seq, 3);
          const name = (category === 'Halls' ? 'J3 Hall ' : 'J3 Studio ') + label;
          const capacity = 40 + seq * 8;
          fixtures.push({
            id,
            name,
            category,
            venue: venue.name,
            venueKey: venue.key,
            catKey: venue.key + '-' + (category === 'Halls' ? 'halls' : 'studios'),
            venueIdx: vi + 1,
            capacity,
            lane: true,
            journey: false,
            color: category === 'Halls' ? 'cobalt' : 'teal',
            haystack: (name + ' ' + category + ' ' + venue.name + ' ' + id + ' capacity ' + capacity).toLowerCase()
          });
        });
      });
    });
    return fixtures;
  })();

  let j3ExpandedNodes = new Set(['j3v-north', 'j3v-north-halls', 'j3v-north-studios']);
  const J3_TREE_H = 48;
  let j3FiltersExpanded = false;
  let j3LastOpener = null;
  let j3VisibilityHoverTimer = null;
  let j3VisibilityAnchor = null;
  let j3ExplorerKeydownBound = false;
  let j3FilterStatusLoading = false;

  function j3SyncFilterStatus(visibleCount) {
    if (!isJ3Journey() || j3FilterStatusLoading) return;
    const statusEl = $('#j3-filter-status');
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = 'Showing ' + visibleCount + ' of ' + J3_FIXTURE_CATALOG.length + ' resources';
  }

  function j3GetTreeRowHeight() {
    return isJ3Journey() ? J3_TREE_H : TREE_H;
  }

  function j3IsDesktopVisibilityViewport() {
    return window.innerWidth >= 721;
  }

  function j3IsExplorerOpen() {
    return isJ3Journey() && document.body.dataset.surface === 'assets';
  }

  function j3SyncFiltersPanel() {
    const fieldset = $('#j3-capacity-fieldset');
    const toggle = $('#j3-filters-toggle');
    if (fieldset) fieldset.hidden = !j3FiltersExpanded;
    if (toggle) toggle.setAttribute('aria-expanded', j3FiltersExpanded ? 'true' : 'false');
  }

  function j3ExpandFilters() {
    j3FiltersExpanded = true;
    j3SyncFiltersPanel();
  }

  function j3ToggleFilters(fromInnerControl) {
    j3FiltersExpanded = !j3FiltersExpanded;
    j3SyncFiltersPanel();
    if (!j3FiltersExpanded && fromInnerControl) {
      $('#j3-filters-toggle')?.focus();
    }
  }

  function j3RenderLauncherSummary() {
    const countEl = $('#j3-launcher-count');
    const namesEl = $('#j3-launcher-names');
    const footerCount = $('#j3-explorer-selected-count');
    const n = selectedAssets.size;
    const countLabel = n === 1 ? '1 selected' : n + ' selected';
    if (countEl) countEl.textContent = countLabel;
    if (footerCount) footerCount.textContent = countLabel;
    const names = [];
    selectedAssets.forEach((id) => {
      const a = findJ3Asset(id);
      if (a) names.push(a.name);
    });
    const summary = names.length ? names.slice(0, 3).join(', ') + (names.length > 3 ? '…' : '') : 'No resources selected';
    if (namesEl) namesEl.textContent = summary;
  }

  function j3HideVisibilityCard() {
    const card = $('#j3-visibility-card');
    if (j3VisibilityHoverTimer != null) {
      window.clearTimeout(j3VisibilityHoverTimer);
      j3VisibilityHoverTimer = null;
    }
    j3VisibilityAnchor = null;
    if (card) {
      card.hidden = true;
      card.inert = true;
      card.setAttribute('aria-hidden', 'true');
      card.classList.remove('is-visible');
    }
  }

  function j3PositionVisibilityCard(row) {
    const card = $('#j3-visibility-card');
    if (!card || !row) return;
    const rowRect = row.getBoundingClientRect();
    const panel = $('#assets-panel');
    const panelRect = panel ? panel.getBoundingClientRect() : rowRect;
    const gap = 12;
    let left = panelRect.right + gap;
    let top = rowRect.top;
    const cardW = card.offsetWidth || 280;
    const cardH = card.offsetHeight || 160;
    if (left + cardW > window.innerWidth - 8) left = panelRect.left - gap - cardW;
    if (top + cardH > window.innerHeight - 8) top = Math.max(8, window.innerHeight - cardH - 8);
    card.style.left = Math.max(8, left) + 'px';
    card.style.top = Math.max(8, top) + 'px';
  }

  function j3ShowVisibilityCard(row) {
    if (!j3IsExplorerOpen() || !j3IsDesktopVisibilityViewport() || !row) {
      j3HideVisibilityCard();
      return;
    }
    const resId = row.dataset.res;
    if (!resId) {
      j3HideVisibilityCard();
      return;
    }
    const asset = findJ3Asset(resId);
    if (!asset) {
      j3HideVisibilityCard();
      return;
    }
    const card = $('#j3-visibility-card');
    const nameEl = $('#j3-vis-card-name');
    const subEl = $('#j3-vis-card-sub');
    const capEl = $('#j3-vis-card-capacity');
    const idEl = $('#j3-vis-card-id');
    const selEl = $('#j3-vis-card-sel');
    if (nameEl) nameEl.textContent = asset.name;
    if (subEl) subEl.textContent = asset.venue + ' · ' + asset.category;
    if (capEl) capEl.textContent = String(asset.capacity);
    if (idEl) idEl.textContent = asset.id;
    if (selEl) selEl.textContent = selectedAssets.has(asset.id) ? 'Selected' : 'Not selected';
    j3VisibilityAnchor = row;
    if (card) {
      card.hidden = false;
      card.inert = false;
      card.removeAttribute('aria-hidden');
      card.classList.add('is-visible');
    }
    j3PositionVisibilityCard(row);
  }

  function j3ScheduleVisibilityCard(row) {
    if (!j3IsExplorerOpen() || !j3IsDesktopVisibilityViewport()) return;
    if (j3VisibilityHoverTimer != null) window.clearTimeout(j3VisibilityHoverTimer);
    j3VisibilityHoverTimer = window.setTimeout(() => {
      j3VisibilityHoverTimer = null;
      j3ShowVisibilityCard(row);
    }, 120);
  }

  function j3SyncExplorerChrome() {
    if (!isJ3Journey()) return;
    const open = j3IsExplorerOpen();
    const scrim = $('#j3-explorer-scrim');
    const panel = $('#assets-panel');
    const launcherBtn = $('#j3-launcher-btn');
    const surfaceToggle = $('#surface-toggle');
    if (scrim) {
      if (open) {
        scrim.hidden = false;
        scrim.inert = false;
        scrim.removeAttribute('aria-hidden');
      } else {
        scrim.hidden = true;
        scrim.inert = true;
        scrim.setAttribute('aria-hidden', 'true');
      }
    }
    if (panel) {
      if (open) {
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Asset Explorer');
        panel.setAttribute('aria-modal', 'true');
        panel.removeAttribute('inert');
        panel.removeAttribute('aria-hidden');
      } else {
        panel.removeAttribute('role');
        panel.removeAttribute('aria-modal');
        panel.inert = true;
        panel.setAttribute('aria-hidden', 'true');
      }
    }
    if (launcherBtn) launcherBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (surfaceToggle) {
      surfaceToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      surfaceToggle.textContent = open ? 'Week' : 'Assets';
    }
    j3SyncFiltersPanel();
    j3RenderLauncherSummary();
    if (!open) j3HideVisibilityCard();
  }

  function j3BindExplorerKeydown() {
    if (j3ExplorerKeydownBound) return;
    j3ExplorerKeydownBound = true;
    document.addEventListener('keydown', j3HandleExplorerKeydown);
  }

  function j3ExplorerFocusables() {
    const panel = $('#assets-panel');
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((node) => !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length));
  }

  function j3HandleExplorerKeydown(e) {
    if (!j3IsExplorerOpen()) return;
    if (e.key === 'Escape') {
      const searchEl = $('#asset-search');
      if (searchEl && searchEl.value.trim()) {
        e.preventDefault();
        assetQuery = '';
        searchEl.value = '';
        assetActive = 0;
        renderAssetTree();
        searchEl.focus();
        return;
      }
      e.preventDefault();
      j3CloseExplorer();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = j3ExplorerFocusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function j3OpenExplorer(opener) {
    if (!isJ3Journey()) return;
    j3LastOpener = opener || $('#j3-launcher-btn') || $('#surface-toggle');
    document.body.dataset.surface = 'assets';
    j3SyncExplorerChrome();
    j3BindExplorerKeydown();
    const searchEl = $('#asset-search');
    if (searchEl) {
      searchEl.focus();
      window.requestAnimationFrame(() => {
        if (j3IsExplorerOpen() && document.activeElement !== searchEl) searchEl.focus();
      });
    }
  }

  function j3CloseExplorer() {
    if (!isJ3Journey() || !j3IsExplorerOpen()) return;
    document.body.dataset.surface = 'week';
    j3HideVisibilityCard();
    j3SyncExplorerChrome();
    const returnTarget = j3LastOpener;
    if (returnTarget && document.body.contains(returnTarget)) returnTarget.focus();
  }

  function isJ3Journey() {
    return document.body.dataset.journey === '3';
  }

  function findJ3Asset(id) {
    return J3_FIXTURE_CATALOG.find((x) => x.id === id);
  }

  function j3DefaultExpandedNodes() {
    return new Set(['j3v-north', 'j3v-north-halls', 'j3v-north-studios']);
  }

  function j3ReadCapacityInputs() {
    const fromEl = $('#j3-capacity-from');
    const toEl = $('#j3-capacity-to');
    return {
      fromRaw: fromEl ? fromEl.value.trim() : '',
      toRaw: toEl ? toEl.value.trim() : '',
      from: fromEl && fromEl.value !== '' ? Number(fromEl.value) : null,
      to: toEl && toEl.value !== '' ? Number(toEl.value) : null
    };
  }

  function j3ValidateCapacityBounds() {
    const errEl = $('#j3-filter-error');
    const caps = j3ReadCapacityInputs();
    if (caps.fromRaw !== '' && caps.toRaw !== '' && caps.from !== null && caps.to !== null && caps.from > caps.to) {
      if (errEl) {
        errEl.textContent = 'Capacity From must not exceed To (local prototype validation — not server HTTP 400).';
        errEl.hidden = false;
      }
      announceLive('Capacity From must not exceed To.');
      return false;
    }
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }
    return true;
  }

  function j3GetEligibleAssets() {
    if (!j3ValidateCapacityBounds()) return [];
    const caps = j3ReadCapacityInputs();
    return J3_FIXTURE_CATALOG.filter((a) => {
      if (caps.from !== null && caps.fromRaw !== '' && a.capacity < caps.from) return false;
      if (caps.to !== null && caps.toRaw !== '' && a.capacity > caps.to) return false;
      return true;
    });
  }

  function getJ3BrowseRows() {
    const eligibleIds = new Set(j3GetEligibleAssets().map((a) => a.id));
    const rows = [];
    const venues = [
      { key: 'j3v-north', name: 'J3 Review Venue North' },
      { key: 'j3v-south', name: 'J3 Review Venue South' }
    ];
    venues.forEach((venue) => {
      const venueExpanded = j3ExpandedNodes.has(venue.key);
      rows.push({
        kind: 'venue', key: venue.key, name: venue.name, level: 1,
        expanded: venueExpanded, journey: false, meta: 'Venue · REVIEW FIXTURE'
      });
      if (!venueExpanded) return;
      ['halls', 'studios'].forEach((kind) => {
        const catName = kind === 'halls' ? 'Halls' : 'Studios';
        const catKey = venue.key + '-' + kind;
        const catExpanded = j3ExpandedNodes.has(catKey);
        rows.push({
          kind: 'category', key: catKey, name: catName, level: 2,
          expanded: catExpanded, meta: 'Category'
        });
        if (!catExpanded) return;
        J3_FIXTURE_CATALOG.filter((a) => a.venueKey === venue.key && a.category === catName && eligibleIds.has(a.id))
          .sort((a, b) => a.id.localeCompare(b.id))
          .forEach((asset) => {
            rows.push({
              kind: 'resource', key: asset.id, asset, level: 3,
              meta: 'Resource · capacity ' + asset.capacity + ' · REVIEW FIXTURE'
            });
          });
      });
    });
    return rows;
  }

  function getJ3SearchRows(q) {
    const lq = q.toLowerCase().trim();
    return j3GetEligibleAssets()
      .filter((a) => a.haystack.indexOf(lq) !== -1)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((a) => ({
        kind: 'resource', key: a.id, asset: a, level: 1,
        meta: a.venue + ' · capacity ' + a.capacity + ' · REVIEW FIXTURE', search: true
      }));
  }

  function j3ResetFilters() {
    assetQuery = '';
    const searchEl = $('#asset-search');
    if (searchEl) searchEl.value = '';
    const fromEl = $('#j3-capacity-from');
    const toEl = $('#j3-capacity-to');
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    j3ExpandedNodes = j3DefaultExpandedNodes();
    assetActive = 0;
    assetScroll = 0;
    j3ValidateCapacityBounds();
    j3FilterStatusLoading = false;
    announceLive('Filters reset. Default eligible fixture list restored.');
    renderAssetTree();
    renderCalendar();
  }

  function j3ApplyCapacityFilters(showLoading) {
    if (!isJ3Journey()) return;
    if (!j3ValidateCapacityBounds()) {
      renderAssetTree();
      return;
    }
    const statusEl = $('#j3-filter-status');
    if (showLoading && statusEl) {
      j3FilterStatusLoading = true;
      statusEl.hidden = false;
      statusEl.textContent = 'Applying local filters (prototype loading — not network).';
    }
    debounce('j3filter', () => {
      j3FilterStatusLoading = false;
      renderAssetTree();
      renderCalendar();
    }, 120);
  }

  function j3ResetBootState() {
    weekStart = new Date(CHECKPOINT_WEEK_START);
    selectedAssets = new Set();
    assetQuery = '';
    assetActive = 0;
    assetScroll = 0;
    j3ExpandedNodes = j3DefaultExpandedNodes();
    const searchEl = $('#asset-search');
    if (searchEl) searchEl.value = '';
    const fromEl = $('#j3-capacity-from');
    const toEl = $('#j3-capacity-to');
    if (fromEl) fromEl.value = '';
    if (toEl) toEl.value = '';
    j3ValidateCapacityBounds();
    document.body.dataset.surface = 'week';
    j3FiltersExpanded = false;
    j3SyncExplorerChrome();
    renderAssetTree();
    renderCalendar();
  }

  function setupJ3ExplorerEvents() {
    const fromEl = $('#j3-capacity-from');
    const toEl = $('#j3-capacity-to');
    const resetBtn = $('#j3-reset-filters');
    const filtersToggle = $('#j3-filters-toggle');
    const closeBtn = $('#j3-explorer-close');
    const doneBtn = $('#j3-explorer-done');
    const scrim = $('#j3-explorer-scrim');
    const launcherBtn = $('#j3-launcher-btn');
    if (fromEl) {
      fromEl.addEventListener('input', () => j3ApplyCapacityFilters(true));
      fromEl.addEventListener('change', () => j3ApplyCapacityFilters(false));
      fromEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && j3FiltersExpanded) {
          e.stopPropagation();
          j3ToggleFilters(true);
        }
      });
    }
    if (toEl) {
      toEl.addEventListener('input', () => j3ApplyCapacityFilters(true));
      toEl.addEventListener('change', () => j3ApplyCapacityFilters(false));
      toEl.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && j3FiltersExpanded) {
          e.stopPropagation();
          j3ToggleFilters(true);
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', j3ResetFilters);
      resetBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && j3FiltersExpanded) {
          e.stopPropagation();
          j3ToggleFilters(true);
        }
      });
    }
    if (filtersToggle) filtersToggle.addEventListener('click', () => j3ToggleFilters(false));
    if (closeBtn) closeBtn.addEventListener('click', () => j3CloseExplorer());
    if (doneBtn) doneBtn.addEventListener('click', () => j3CloseExplorer());
    if (scrim) scrim.addEventListener('click', () => j3CloseExplorer());
    if (launcherBtn) launcherBtn.addEventListener('click', () => j3OpenExplorer(launcherBtn));
    const treeEl = $('#asset-tree');
    if (treeEl) {
      treeEl.addEventListener('mouseover', (e) => {
        const row = e.target.closest('.tree-row[data-res]');
        if (row) j3ScheduleVisibilityCard(row);
      });
      treeEl.addEventListener('mouseout', (e) => {
        const row = e.target.closest('.tree-row[data-res]');
        if (!row) return;
        if (j3VisibilityHoverTimer != null) {
          window.clearTimeout(j3VisibilityHoverTimer);
          j3VisibilityHoverTimer = null;
        }
        window.setTimeout(() => {
          if (row.matches(':hover') && j3IsExplorerOpen() && j3IsDesktopVisibilityViewport()) return;
          j3HideVisibilityCard();
        }, 80);
      });
      treeEl.addEventListener('focusin', (e) => {
        const row = e.target.closest('.tree-row[data-res]');
        if (row) j3ShowVisibilityCard(row);
      });
      treeEl.addEventListener('scroll', () => {
        if ($('#j3-visibility-card')?.hidden || !j3VisibilityAnchor) return;
        if (!document.body.contains(j3VisibilityAnchor)) {
          j3HideVisibilityCard();
          return;
        }
        j3PositionVisibilityCard(j3VisibilityAnchor);
      });
    }
    window.addEventListener('resize', () => {
      if (!isJ3Journey()) return;
      if (!j3IsDesktopVisibilityViewport()) j3HideVisibilityCard();
      else if (!$('#j3-visibility-card')?.hidden && j3VisibilityAnchor && document.body.contains(j3VisibilityAnchor)) {
        j3PositionVisibilityCard(j3VisibilityAnchor);
      }
    });
    j3BindExplorerKeydown();
  }

  function j3SelectFixtures(ids) {
    selectedAssets = new Set(ids.filter((id) => findJ3Asset(id)));
    renderAssetTree();
    renderCalendar();
  }

  async function j3PlayJourney() {
    if (playJourneyActive) return;
    playJourneyActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    playBtn.disabled = true;
    completeBtn.disabled = true;
    const total = 16;
    let step = 0;
    j3ResetBootState();
    beginGuidedReview('journey', total);
    showToast('Playing Journey 3 review-only asset search and selection…');
    try {
      await guidedReviewStep(playBtn, 'Open the Journey 3 asset explorer — review rail only, not Product navigation.', ++step, total, () => j3OpenExplorer(playBtn), REVIEW_PLAY_STEP_MS);
      await guidedReviewStep('#assets-panel', 'One explorer: keyword search, hierarchy and capacity filters inside #assets-panel.', ++step, total);
      await guidedReviewStep('#asset-search', 'Filter locally by keyword — no network search.', ++step, total, (el) => {
        el.value = 'J3 Hall Alpha';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await guidedReviewStep('#asset-search', 'Clear keyword with Escape recovery path.', ++step, total, (el) => {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      await guidedReviewStep(() => $('#asset-tree [data-toggle="j3v-north-halls"]'), 'Expand venue and category in the hierarchy.', ++step, total);
      j3ExpandFilters();
      await guidedReviewStep('#j3-capacity-from', 'Invalid bounds: From greater than To is blocked locally.', ++step, total, (el) => {
        el.value = '200';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await guidedReviewStep('#j3-capacity-to', 'Complete invalid bounds to show labelled local error.', ++step, total, (el) => {
        el.value = '50';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await guidedReviewStep('#j3-capacity-from', 'Apply valid local capacity bounds.', ++step, total, (el) => {
        el.value = '40';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await guidedReviewStep('#j3-capacity-to', 'Valid To keeps filtering local-only.', ++step, total, (el) => {
        el.value = '120';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await guidedReviewStep('#j3-reset-filters', 'Reset restores the deterministic default eligible list once.', ++step, total);
      await guidedReviewStep(() => $('#asset-tree .tree-check[data-res="j3-rf-001"]'), 'Select one REVIEW FIXTURE — calendar shows exactly one lane.', ++step, total, (el) => {
        j3SelectFixtures(['j3-rf-001']);
        if (!el.checked) activateGuidedClickable(el);
      });
      await guidedReviewStep('#j3-reset-filters', 'Reset selection context before 5-lane boundary.', ++step, total, () => j3ResetFilters());
      await guidedReviewStep('#asset-search', 'No-match keyword — labelled empty prototype state.', ++step, total, (el) => {
        el.value = 'zzzz-no-match-j3';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await guidedReviewStep('#j3-reset-filters', 'Recover from no-match via Reset.', ++step, total);
      await guidedReviewStep(() => $('#asset-tree .tree-check[data-res="j3-rf-001"]'), 'Select five fixtures for the five-lane calendar boundary.', ++step, total, () => {
        j3SelectFixtures(['j3-rf-001', 'j3-rf-002', 'j3-rf-003', 'j3-rf-004', 'j3-rf-005']);
      });
      await guidedReviewStep('#asset-search', 'Select all twenty REVIEW FIXTURE lanes deterministically.', ++step, total, () => {
        j3SelectFixtures(J3_FIXTURE_CATALOG.map((a) => a.id));
      });
      showToast('Journey 3 guided review finished — Booking/Cart/Book and J2 Demo settings were not exposed.');
    } catch (error) {
      console.error(error);
      showToast('Guided Journey 3 review recovered — inspect console evidence');
    } finally {
      playJourneyActive = false;
      playBtn.disabled = false;
      completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  async function j3PlayComplete() {
    if (playJourneyActive) return;
    playJourneyActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    playBtn.disabled = true;
    completeBtn.disabled = true;
    const total = 5;
    let step = 0;
    j3ResetBootState();
    beginGuidedReview('complete', total);
    try {
      await guidedReviewStep(completeBtn, 'Short Journey 3 path: search, hierarchy, capacity and selection.', ++step, total, () => j3OpenExplorer(completeBtn), REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep(() => $('#asset-tree [data-toggle="j3v-south"]'), 'Venue/category hierarchy expand.', ++step, total, null, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#asset-search', 'Keyword filter on the shared explorer.', ++step, total, (el) => {
        el.value = 'J3 Studio';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, REVIEW_COMPLETE_STEP_MS);
      j3ExpandFilters();
      await guidedReviewStep('#j3-capacity-from', 'Valid capacity bounds remain local.', ++step, total, (el) => {
        el.value = '80';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#j3-reset-filters', 'Reset and select one lane — review only, no Book.', ++step, total, () => {
        j3ResetFilters();
        j3SelectFixtures(['j3-rf-010']);
      }, REVIEW_COMPLETE_STEP_MS);
      showToast('Journey 3 Play complete finished — REVIEW FIXTURE only; not Gate A approval.');
    } catch (error) {
      console.error(error);
      showToast('Guided Journey 3 complete recovered — inspect console evidence');
    } finally {
      playJourneyActive = false;
      playBtn.disabled = false;
      completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  function closeAllJourneyOverlays() {
    ['#date-picker-dialog', '#mismatch-dialog', '#remove-dialog', '#clear-dialog',
      '#cart-item-editor-dialog', '#j4-details-dialog'].forEach((sel) => {
      const d = $(sel);
      if (d && d.open) d.close();
    });
    const j4Context = $('#j4-context-menu');
    if (j4Context) {
      j4Context.hidden = true;
      j4Context.inert = true;
      j4Context.setAttribute('aria-hidden', 'true');
    }
    const reviewPanel = $('#review-rail-panel');
    if (reviewPanel) reviewPanel.hidden = true;
    const reviewToggle = $('#review-rail-toggle');
    if (reviewToggle) reviewToggle.setAttribute('aria-expanded', 'false');
    const demo = $('#review-demo-panel');
    if (demo) demo.hidden = true;
    const demoToggle = $('#review-demo-toggle');
    if (demoToggle) demoToggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('sheet-expanded');
    const sheetPanel = $('#cart-sheet-panel');
    if (sheetPanel) sheetPanel.hidden = true;
    endGuidedReview();
    if (typeof playJourneyActive !== 'undefined') playJourneyActive = false;
    if (typeof j2PlayActive !== 'undefined') j2PlayActive = false;
  }

  // One Calendar candidate: Journey 2 starts on the same demo fixture as the Journey 12 calendar (dates stay navigable).
  const J2_TODAY = new Date(TODAY);
  const J2_HOUR_START = HOUR_START;
  const J2_HOUR_END = HOUR_END;
  const J2_SLOTS_PER_HOUR = 2;
  const J2_MONTH_NAMES_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const J2_MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const J2_DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const J2_ASSETS = [
    { id: 'hall1', name: 'Hall 1', venue: 'Northside Leisure Centre' },
    { id: 'hall2', name: 'Hall 2', venue: 'Northside Leisure Centre' },
    { id: 'studio2', name: 'Studio 2', venue: 'Northside Leisure Centre' }
  ];

  const J2_EVENTS = [
    { id: 'BK-10501', asset: 'hall1', date: '2026-08-27', start: 10, end: 16, type: 'quotation', title: 'BK-10501', status: 'Quotation · Occupied' },
    { id: 'BK-10482', asset: 'studio2', date: '2026-08-28', start: 9, end: 13, type: 'confirmed', title: 'BK-10482', status: 'Confirmed · Occupied' },
    { id: 'BLK-220', asset: 'hall2', date: '2026-08-29', allDay: true, type: 'block', title: 'BLK-220', status: 'Block' },
    { id: 'FNI-301', asset: 'studio2', date: '2026-08-30', start: 15, end: 17, type: 'facility-not-in-use', title: 'FNI-301', status: 'Facility not in use · Unavailable' }
  ];

  const J2_FREE_SLOTS = [
    { asset: 'hall1', date: '2026-08-28', start: 14, end: 17 },
    { asset: 'hall1', date: '2026-08-29', start: 14, end: 17 },
    { asset: 'hall1', date: '2026-08-30', start: 14, end: 17 },
    { asset: 'studio2', date: '2026-08-29', start: 10, end: 12 }
  ];

  const J2_VIEW_LABELS = {
    day: 'Day',
    week: 'Week',
    'work-week': 'Work Week',
    month: 'Month',
    'advanced-week': 'Advanced Week'
  };

  const j2State = {
    mode: 'booking',
    view: 'week',
    layout: 'column',
    selectedDate: new Date(J2_TODAY),
    advancedEnabled: true,
    rightsMode: 'both',
    assetsDrawerOpen: false,
    demoOpen: false
  };

  const J2_REVIEW_PLAY_STEP_MS = 2500;
  const J2_REVIEW_COMPLETE_STEP_MS = 1400;
  const J2_REVIEW_PLAY_DIALOG_MS = 3000;
  const J2_GUIDED_REVIEW_MOVE_MS = 650;
  const J2_GUIDED_REVIEW_CLICK_MS = 300;
  const J2_COMPLETION_HOLD_MS = 2000;

  let j2PlayActive = false;

  function j2PrefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function j2GetReviewTiming() {
    if (j2PrefersReducedMotion()) {
      return { moveMs: 0, clickMs: 0, dwellPlay: 500, dwellComplete: 500, dwellDialog: 500, completionHold: 800 };
    }
    return {
      moveMs: J2_GUIDED_REVIEW_MOVE_MS,
      clickMs: J2_GUIDED_REVIEW_CLICK_MS,
      dwellPlay: J2_REVIEW_PLAY_STEP_MS,
      dwellComplete: J2_REVIEW_COMPLETE_STEP_MS,
      dwellDialog: J2_REVIEW_PLAY_DIALOG_MS,
      completionHold: J2_COMPLETION_HOLD_MS
    };
  }

  function j2WaitWhilePlaying(ms) {
    return new Promise((resolve) => {
      if (!j2PlayActive) { resolve(); return; }
      setTimeout(resolve, ms);
    });
  }

  function j2ParseISO(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dt;
  }

  function j2AddCalendarMonth(d, n) {
    const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
    const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const day = Math.min(d.getDate(), last);
    return new Date(target.getFullYear(), target.getMonth(), day);
  }

  function j2StartOfWeekMonday(d) {
    const r = new Date(d);
    const dow = r.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    r.setDate(r.getDate() + diff);
    return r;
  }

  function j2EndOfWeekSunday(d) { return addDays(j2StartOfWeekMonday(d), 6); }
  function j2WorkWeekEnd(d) { return addDays(j2StartOfWeekMonday(d), 4); }
  function j2FirstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function j2LastOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  function j2IsToday(d) { return dateKey(d) === dateKey(J2_TODAY); }

  function j2VisibleRange(view, d) {
    switch (view) {
      case 'day': return [d, d];
      case 'week':
      case 'advanced-week': return [j2StartOfWeekMonday(d), j2EndOfWeekSunday(d)];
      case 'work-week': return [j2StartOfWeekMonday(d), j2WorkWeekEnd(d)];
      case 'month': return [j2FirstOfMonth(d), j2LastOfMonth(d)];
      default: return [d, d];
    }
  }

  function j2FormatDayHeading(d) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[d.getDay()]} ${d.getDate()} ${J2_MONTH_NAMES_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }

  function j2FormatRangeHeading(start, end) {
    if (start.getTime() === end.getTime()) return j2FormatDayHeading(start);
    const sm = J2_MONTH_NAMES_SHORT;
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()}–${end.getDate()} ${sm[start.getMonth()]} ${start.getFullYear()}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} ${sm[start.getMonth()]}–${end.getDate()} ${sm[end.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${sm[start.getMonth()]} ${start.getFullYear()}–${end.getDate()} ${sm[end.getMonth()]} ${end.getFullYear()}`;
  }

  function j2FormatMonthHeading(d) { return `${J2_MONTH_NAMES_LONG[d.getMonth()]} ${d.getFullYear()}`; }
  function j2FormatLongDate(d) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[d.getDay()]} ${d.getDate()} ${J2_MONTH_NAMES_LONG[d.getMonth()]} ${d.getFullYear()}`;
  }

  function j2RangeHeading() {
    const [start, end] = j2VisibleRange(j2State.view, j2State.selectedDate);
    if (j2State.view === 'day') return j2FormatDayHeading(j2State.selectedDate);
    if (j2State.view === 'month') return j2FormatMonthHeading(j2State.selectedDate);
    return j2FormatRangeHeading(start, end);
  }

  function j2LiveRangeText() { return `${J2_VIEW_LABELS[j2State.view]}, ${j2RangeHeading()}`; }

  function j2NavUnitLabels() {
    switch (j2State.view) {
      case 'day': return { prev: 'Previous day', next: 'Next day' };
      case 'week':
      case 'advanced-week': return { prev: 'Previous week', next: 'Next week' };
      case 'work-week': return { prev: 'Previous work week', next: 'Next work week' };
      case 'month': return { prev: 'Previous month', next: 'Next month' };
      default: return { prev: 'Previous', next: 'Next' };
    }
  }

  function j2TimeToSlot(hour, minute) {
    return (hour - J2_HOUR_START) * J2_SLOTS_PER_HOUR + Math.floor((minute || 0) / 30);
  }

  function j2SlotToTime(slot) {
    const totalMinutes = J2_HOUR_START * 60 + slot * 30;
    return { h: Math.floor(totalMinutes / 60), m: totalMinutes % 60 };
  }

  function j2FormatTime(h, m) { return `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`; }
  function j2TotalSlots() { return (J2_HOUR_END - J2_HOUR_START) * J2_SLOTS_PER_HOUR; }

  function j2EventOnDate(assetId, dk) {
    return J2_EVENTS.filter((ev) => ev.asset === assetId && ev.date === dk);
  }

  function j2GetEventAtSlot(assetId, dk, slot) {
    for (const ev of J2_EVENTS) {
      if (ev.asset !== assetId || ev.date !== dk) continue;
      if (ev.allDay) return ev;
      const startSlot = j2TimeToSlot(ev.start, 0);
      const endSlot = j2TimeToSlot(ev.end, 0);
      if (slot >= startSlot && slot < endSlot) return ev;
    }
    return null;
  }

  function j2IsFreeSlot(assetId, dk, slot) {
    if (j2State.mode !== 'booking') return false;
    const { h } = j2SlotToTime(slot);
    for (const fs of J2_FREE_SLOTS) {
      if (fs.asset !== assetId || fs.date !== dk) continue;
      if (h >= fs.start && h < fs.end && !j2GetEventAtSlot(assetId, dk, slot)) return true;
    }
    return false;
  }

  function j2CreateEventElement(ev, extraClass) {
    const el = document.createElement('div');
    el.className = `cal-event ${ev.type}${extraClass ? ` ${extraClass}` : ''}`;
    applyTimeslotVisual(el, ev.type);
    el.innerHTML = `<strong>${ev.title}</strong> <span class="event-status">${ev.status}</span>`;
    el.setAttribute('aria-label', eventAccessibleLabel(ev));
    el.setAttribute('title', eventAccessibleLabel(ev));
    return el;
  }

  function j2StackTimeLabel(ev) {
    if (ev.allDay) return 'All day';
    return `${j2FormatTime(ev.start, 0)}–${j2FormatTime(ev.end, 0)}`;
  }

  function j2CollectDayItems(assetId, dk) {
    const items = [];
    j2EventOnDate(assetId, dk).forEach((ev) => {
      const startSlot = ev.allDay ? 0 : j2TimeToSlot(ev.start, 0);
      const endSlot = ev.allDay ? j2TotalSlots() : j2TimeToSlot(ev.end, 0);
      items.push({ kind: 'event', source: ev, startSlot, endSlot });
    });
    let freeStart = null;
    for (let slot = 0; slot <= j2TotalSlots(); slot++) {
      const free = slot < j2TotalSlots() && j2IsFreeSlot(assetId, dk, slot);
      if (free && freeStart === null) freeStart = slot;
      if (!free && freeStart !== null) {
        items.push({ kind: 'available', startSlot: freeStart, endSlot: slot });
        freeStart = null;
      }
    }
    return items.sort((a, b) => a.startSlot - b.startSlot);
  }

  function j2RenderStackDay(col, asset, dk) {
    col.classList.add('is-stack');
    if (j2IsToday(j2ParseISO(dk))) col.classList.add('is-today-column');
    const items = j2CollectDayItems(asset.id, dk);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'stack-empty';
      empty.textContent = '—';
      col.appendChild(empty);
      return;
    }
    items.forEach((item) => {
      if (item.kind === 'available') {
        const card = document.createElement('div');
        card.className = 'stack-card stack-available';
        const t0 = j2SlotToTime(item.startSlot);
        const t1 = j2SlotToTime(item.endSlot);
        card.innerHTML = `<span class="stack-card-time">${j2FormatTime(t0.h, t0.m)}–${j2FormatTime(t1.h, t1.m)}</span><span class="stack-card-title">Available</span><span class="stack-card-state">Selectable</span>`;
        card.setAttribute('aria-label', `${asset.name} ${dk} available ${j2FormatTime(t0.h, t0.m)}–${j2FormatTime(t1.h, t1.m)}`);
        col.appendChild(card);
        return;
      }
      const ev = item.source;
      const card = j2CreateEventElement(ev, 'stack-card');
      const timeEl = document.createElement('span');
      timeEl.className = 'stack-card-time';
      timeEl.textContent = j2StackTimeLabel(ev);
      card.prepend(timeEl);
      col.appendChild(card);
    });
  }

  function j2BuildTimeGutter(stack) {
    const gutter = document.createElement('div');
    gutter.className = 'cal-time-gutter';
    if (stack) {
      const label = document.createElement('span');
      label.className = 'stack-gutter-label';
      label.textContent = 'Slots';
      gutter.appendChild(label);
    } else {
      for (let h = J2_HOUR_START; h < J2_HOUR_END; h++) {
        for (let half = 0; half < J2_SLOTS_PER_HOUR; half++) {
          const lbl = document.createElement('div');
          lbl.className = 'time-label';
          lbl.dataset.slot = String((h - J2_HOUR_START) * J2_SLOTS_PER_HOUR + half);
          lbl.textContent = half === 0 ? `${String(h).padStart(2, '0')}:00` : '';
          gutter.appendChild(lbl);
        }
      }
    }
    return gutter;
  }

  function j2RenderColumnDay(col, asset, dk) {
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');
    for (let slot = 0; slot < j2TotalSlots(); slot++) {
      const slotEl = document.createElement('div');
      const selectable = j2State.mode === 'booking' && j2IsFreeSlot(asset.id, dk, slot);
      slotEl.className = `cal-slot${selectable ? ' selectable' : ''}`;
      if (selectable) slotEl.dataset.selectable = 'true';
      slotEl.dataset.slot = String(slot);
      slotEl.setAttribute('role', 'gridcell');
      slotEl.tabIndex = selectable ? 0 : -1;
      slotEl.setAttribute('aria-selected', 'false');
      slotEl.addEventListener('pointerdown', (e) => j2OnSlotPointerDown(e, asset.id, dk, slot));
      slotEl.addEventListener('mouseenter', () => j2OnSlotEnter(asset.id, dk, slot));
      slotEl.addEventListener('keydown', (e) => j2OnSlotKeydown(e, asset.id, dk, slot));
      const { h, m } = j2SlotToTime(slot);
      slotEl.setAttribute('aria-label', `${asset.name} ${dk} ${j2FormatTime(h, m)}${selectable ? ' — Available' : ''}`);
      col.appendChild(slotEl);
    }
    j2EventOnDate(asset.id, dk).forEach((ev) => {
      const evEl = j2CreateEventElement(ev);
      j2MakeEventInteractive(evEl, ev);
      if (ev.allDay) {
        evEl.style.top = '0';
        evEl.style.height = '100%';
      } else {
        evEl.style.top = `${j2TimeToSlot(ev.start, 0) * slotH}px`;
        evEl.style.height = `${(j2TimeToSlot(ev.end, 0) - j2TimeToSlot(ev.start, 0)) * slotH}px`;
      }
      col.appendChild(evEl);
    });
  }

  /* ===== One Calendar candidate (Supervisor #19, 2026-10-11): Journey 12 calendar interactions on the Journey 2 grid =====
     Hover time line and time label, active day column, time row, click/drag selection with the Journey 12 selection card,
     and booking selection. Journey 2 still has no Cart or Book (its accepted scope); views, dates and modes are unchanged. */
  let j2Selection = null;
  let j2SelectedEventId = null;
  let j2Drag = null;
  function j2InteractiveGrid() { return j2State.layout === 'column' && ['day', 'week', 'work-week'].includes(j2State.view); }
  function j2PaintSelection() {
    const grid = $('#calendar-grid');
    if (!grid) return;
    grid.querySelectorAll('.cal-slot.selected-range').forEach((el) => { el.classList.remove('selected-range', 'range-start', 'range-end'); el.setAttribute('aria-selected', 'false'); });
    grid.querySelectorAll('.timeslot-context-label').forEach((el) => el.remove());
    if (j2State.mode !== 'booking') { j2Selection = null; j2Drag = null; return; }
    const s = j2Drag || j2Selection;
    if (!s) return;
    const col = grid.querySelector(`.cal-day-col[data-asset="${s.asset}"][data-date="${s.date}"]`);
    if (!col) return;
    const lo = Math.min(s.startSlot, s.endSlot);
    const hi = Math.max(s.startSlot, s.endSlot) + 1;
    col.querySelectorAll('.cal-slot').forEach((el) => {
      const n = Number(el.dataset.slot);
      const on = n >= lo && n < hi;
      el.classList.toggle('selected-range', on);
      el.classList.toggle('range-start', on && n === lo);
      el.classList.toggle('range-end', on && n === hi - 1);
      el.setAttribute('aria-selected', String(on));
    });
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');
    const a = j2SlotToTime(lo);
    const b = j2SlotToTime(hi);
    const label = document.createElement('div');
    label.className = 'timeslot-context-label';
    label.setAttribute('aria-hidden', 'true');
    const time = document.createElement('span');
    time.className = 'timeslot-context-label-time';
    time.textContent = `${j2FormatTime(a.h, a.m)} – ${j2FormatTime(b.h, b.m)}`;
    const duration = document.createElement('span');
    duration.className = 'timeslot-context-label-duration';
    duration.textContent = `Duration · ${formatSlotDuration(lo, hi)}`;
    label.append(time, duration);
    col.appendChild(label);
    const top = Math.max(2, lo * slotH + 2);
    label.style.top = `${Math.min(top, Math.max(2, col.clientHeight - label.offsetHeight - 2))}px`;
  }
  function j2PaintEventSelection() {
    $$('#calendar-grid .cal-event[data-j2-event]').forEach((el) => {
      const on = el.dataset.j2Event === j2SelectedEventId;
      el.classList.toggle('j2-event-selected', on);
      if (el.getAttribute('role') === 'button') el.setAttribute('aria-pressed', String(on));
    });
  }
  function j2SelectRange(asset, date, startSlot, endSlot) {
    j2Selection = { asset, date, startSlot, endSlot };
    j2SelectedEventId = null;
    j2PaintSelection();
    j2PaintEventSelection();
    const a = j2SlotToTime(startSlot);
    const b = j2SlotToTime(endSlot + 1);
    const name = (J2_ASSETS.find((x) => x.id === asset) || {}).name || asset;
    announceLive(`${name}, ${j2FormatTime(a.h, a.m)} to ${j2FormatTime(b.h, b.m)} selected. Journey 2 shows the selection only; Cart and Book stay absent.`);
  }
  function j2SelectEvent(ev) {
    j2SelectedEventId = ev.id;
    j2Selection = null;
    j2Drag = null;
    clearColumnCrosshair();
    j2PaintSelection();
    j2PaintEventSelection();
    announceAlert(`${ev.title} — ${ev.status}. That interval is unavailable. Choose an available time.`);
  }
  function j2MakeEventInteractive(evEl, ev) {
    evEl.dataset.j2Event = ev.id;
    if (!isOccupiedEvent(ev)) return;
    evEl.setAttribute('role', 'button');
    evEl.tabIndex = 0;
    evEl.setAttribute('aria-pressed', String(j2SelectedEventId === ev.id));
    evEl.addEventListener('click', () => j2SelectEvent(ev));
    evEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); j2SelectEvent(ev); } });
  }
  function j2OnSlotEnter(asset, date, slot) {
    if (j2Drag) return;
    if (j2IsFreeSlot(asset, date, slot)) applyColumnCrosshair(asset, date, slot);
    else clearColumnCrosshair();
  }
  function j2OnSlotPointerDown(event, asset, date, slot) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!j2InteractiveGrid() || !j2IsFreeSlot(asset, date, slot)) return;
    event.preventDefault();
    j2SelectedEventId = null;
    j2PaintEventSelection();
    j2Drag = { asset, date, startSlot: slot, endSlot: slot };
    applyColumnCrosshair(asset, date, slot);
    j2PaintSelection();
    const scroll = $('#calendar-scroll');
    try { scroll.setPointerCapture(event.pointerId); } catch { /* document listeners still own the gesture */ }
    const move = (e) => {
      if (e.pointerId !== event.pointerId || !j2Drag) return;
      const cell = document.elementsFromPoint(e.clientX, e.clientY).map((n) => n.closest?.('.cal-slot')).find(Boolean);
      const col = cell ? cell.closest('.cal-day-col') : null;
      if (!cell || !col || col.dataset.asset !== asset || col.dataset.date !== date) return;
      const n = Number(cell.dataset.slot);
      const lo = Math.min(j2Drag.startSlot, n);
      const hi = Math.max(j2Drag.startSlot, n);
      for (let k = lo; k <= hi; k++) if (!j2IsFreeSlot(asset, date, k)) return;
      if (j2Drag.endSlot === n) return;
      j2Drag.endSlot = n;
      applyColumnCrosshair(asset, date, n);
      j2PaintSelection();
    };
    const stop = () => {
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', cancel, true);
      try { if (scroll.hasPointerCapture(event.pointerId)) scroll.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    };
    const finish = (e) => {
      if (e.pointerId !== event.pointerId) return;
      stop();
      const d = j2Drag;
      j2Drag = null;
      clearColumnCrosshair();
      if (d) j2SelectRange(asset, date, Math.min(d.startSlot, d.endSlot), Math.max(d.startSlot, d.endSlot));
    };
    const cancel = (e) => {
      if (e.pointerId !== event.pointerId) return;
      stop();
      j2Drag = null;
      clearColumnCrosshair();
      j2PaintSelection();
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', cancel, true);
  }
  function j2OnSlotKeydown(event, asset, date, slot) {
    const total = j2TotalSlots();
    const col = event.target.closest('.cal-day-col');
    const body = event.target.closest('.cal-lane-body');
    const cols = body ? Array.from(body.querySelectorAll('.cal-day-col')) : [];
    const ci = cols.indexOf(col);
    let target = col;
    let next = slot;
    if (event.key === 'ArrowDown') next = Math.min(slot + 1, total - 1);
    else if (event.key === 'ArrowUp') next = Math.max(slot - 1, 0);
    else if (event.key === 'ArrowRight' && ci < cols.length - 1) target = cols[ci + 1];
    else if (event.key === 'ArrowLeft' && ci > 0) target = cols[ci - 1];
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = total - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (j2IsFreeSlot(asset, date, slot)) j2SelectRange(asset, date, slot, slot);
      return;
    } else return;
    event.preventDefault();
    const cell = target ? target.querySelector(`.cal-slot[data-slot="${next}"]`) : null;
    if (!cell) return;
    cell.focus();
    const c = cell.closest('.cal-day-col');
    j2OnSlotEnter(c.dataset.asset, c.dataset.date, next);
  }

  function j2RenderMultiDayGrid(grid, days, colCount) {
    const isStack = j2State.layout === 'stack';
    const header = document.createElement('div');
    header.className = `cal-header cols-${colCount}`;
    header.setAttribute('role', 'row');
    header.innerHTML = '<div class="cal-corner" role="columnheader"></div>';
    days.forEach((day) => {
      const hdr = document.createElement('div');
      hdr.className = 'cal-day-header';
      hdr.setAttribute('role', 'columnheader');
      const dk = dateKey(day);
      hdr.dataset.date = dk;
      if (j2IsToday(day)) hdr.classList.add('is-today');
      if (dk === dateKey(j2State.selectedDate)) {
        hdr.classList.add('is-selected');
        hdr.setAttribute('aria-current', 'date');
      }
      const di = (day.getDay() + 6) % 7;
      const text = `${J2_DAY_NAMES_SHORT[di]} ${day.getDate()}`;
      if (j2IsToday(day)) hdr.innerHTML = `${text}<span class="today-tag">Today</span>`;
      else hdr.textContent = text;
      header.appendChild(hdr);
    });
    grid.appendChild(header);

    J2_ASSETS.forEach((asset) => {
      const laneEl = document.createElement('section');
      laneEl.className = 'cal-lane';
      laneEl.setAttribute('aria-label', asset.name);
      laneEl.addEventListener('mouseleave', () => { if (!j2Drag) clearColumnCrosshair(); });
      const title = document.createElement('div');
      title.className = 'cal-lane-title';
      title.textContent = `${asset.name} · ${asset.venue}`;
      laneEl.appendChild(title);
      const body = document.createElement('div');
      body.className = `cal-lane-body cols-${colCount}${isStack ? ' is-stack' : ''}`;
      body.appendChild(j2BuildTimeGutter(isStack));
      days.forEach((day) => {
        const dk = dateKey(day);
        const col = document.createElement('div');
        col.className = 'cal-day-col';
        col.dataset.date = dk;
        col.dataset.asset = asset.id;
        if (isStack) j2RenderStackDay(col, asset, dk);
        else j2RenderColumnDay(col, asset, dk);
        body.appendChild(col);
      });
      laneEl.appendChild(body);
      grid.appendChild(laneEl);
    });
  }

  function j2RenderDayView(grid) { j2RenderMultiDayGrid(grid, [j2State.selectedDate], 1); }

  function j2RenderWeekView(grid) {
    const days = [];
    const start = j2StartOfWeekMonday(j2State.selectedDate);
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
    j2RenderMultiDayGrid(grid, days, 7);
  }

  function j2RenderWorkWeekView(grid) {
    const days = [];
    const start = j2StartOfWeekMonday(j2State.selectedDate);
    for (let i = 0; i < 5; i++) days.push(addDays(start, i));
    j2RenderMultiDayGrid(grid, days, 5);
  }

  function j2RenderMonthView(grid) {
    const monthStart = j2FirstOfMonth(j2State.selectedDate);
    const gridStart = j2StartOfWeekMonday(monthStart);
    const monthEnd = j2LastOfMonth(j2State.selectedDate);
    const gridEnd = j2EndOfWeekSunday(monthEnd);
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const wrap = document.createElement('div');
    wrap.className = 'month-grid';
    weekdays.forEach((wd) => {
      const el = document.createElement('div');
      el.className = 'month-weekday';
      el.textContent = wd;
      wrap.appendChild(el);
    });
    let cur = new Date(gridStart);
    while (cur <= gridEnd) {
      const cellDate = new Date(cur);
      const dk = dateKey(cellDate);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'month-cell';
      cell.dataset.date = dk;
      if (cellDate.getMonth() !== j2State.selectedDate.getMonth()) cell.classList.add('is-other-month');
      if (j2IsToday(cellDate)) cell.classList.add('is-today');
      if (dk === dateKey(j2State.selectedDate)) {
        cell.classList.add('is-selected');
        cell.setAttribute('aria-current', 'date');
      }
      const dateNum = document.createElement('div');
      dateNum.className = 'month-cell-date';
      dateNum.textContent = String(cellDate.getDate());
      cell.appendChild(dateNum);
      const evWrap = document.createElement('div');
      evWrap.className = 'month-cell-events';
      const dayEvents = J2_EVENTS.filter((ev) => ev.date === dk);
      if (j2State.layout === 'stack') {
        dayEvents.sort((a, b) => (a.start || 0) - (b.start || 0)).forEach((ev) => {
          const row = document.createElement('div');
          row.className = `month-stack-row cal-event ${ev.type}`;
          applyTimeslotVisual(row, ev.type);
          const time = ev.allDay ? 'All day' : `${j2FormatTime(ev.start, 0)}–${j2FormatTime(ev.end, 0)}`;
          row.textContent = `${time} ${ev.title}`;
          row.setAttribute('aria-label', eventAccessibleLabel(ev));
          evWrap.appendChild(row);
        });
      } else {
        dayEvents.forEach((ev) => {
          const chip = document.createElement('div');
          chip.className = `month-chip cal-event ${ev.type}`;
          applyTimeslotVisual(chip, ev.type);
          const time = ev.allDay ? '' : `${j2FormatTime(ev.start, 0)} `;
          chip.textContent = `${time}${ev.title}`;
          chip.setAttribute('aria-label', eventAccessibleLabel(ev));
          evWrap.appendChild(chip);
        });
      }
      cell.appendChild(evWrap);
      cell.addEventListener('click', () => {
        j2State.selectedDate = new Date(cellDate);
        j2Render();
      });
      wrap.appendChild(cell);
      cur = addDays(cur, 1);
    }
    grid.appendChild(wrap);
  }

  function j2RenderAdvancedWeekView(grid) {
    const caption = document.createElement('p');
    caption.className = 'advanced-week-caption';
    caption.textContent = 'Advanced Week — hosted-QA evidence; deployment variance retained — review fixture';
    grid.appendChild(caption);
    const days = [];
    const start = j2StartOfWeekMonday(j2State.selectedDate);
    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
    const advGrid = document.createElement('div');
    advGrid.className = 'adv-week-grid';
    const isStack = j2State.layout === 'stack';
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');
    days.forEach((day) => {
      const dk = dateKey(day);
      const dayCol = document.createElement('div');
      dayCol.className = 'adv-day-col';
      const hdr = document.createElement('div');
      hdr.className = 'adv-day-header';
      if (j2IsToday(day)) hdr.classList.add('is-today');
      const di = (day.getDay() + 6) % 7;
      hdr.textContent = `${J2_DAY_NAMES_SHORT[di]} ${day.getDate()}`;
      if (dk === dateKey(j2State.selectedDate)) hdr.setAttribute('aria-current', 'date');
      dayCol.appendChild(hdr);
      J2_ASSETS.forEach((asset) => {
        const band = document.createElement('div');
        band.className = 'adv-asset-band';
        const label = document.createElement('div');
        label.className = 'adv-asset-band-label';
        label.textContent = asset.name;
        band.appendChild(label);
        const body = document.createElement('div');
        body.className = `adv-band-body${isStack ? ' is-stack' : ' is-column'}`;
        if (isStack) {
          j2CollectDayItems(asset.id, dk).forEach((item) => {
            if (item.kind === 'available') {
              const card = document.createElement('div');
              card.className = 'stack-card stack-available';
              const t0 = j2SlotToTime(item.startSlot);
              const t1 = j2SlotToTime(item.endSlot);
              card.textContent = `${j2FormatTime(t0.h, t0.m)}–${j2FormatTime(t1.h, t1.m)} Available`;
              body.appendChild(card);
            } else {
              const ev = item.source;
              const card = j2CreateEventElement(ev, 'stack-card');
              const timeEl = document.createElement('span');
              timeEl.className = 'stack-card-time';
              timeEl.textContent = j2StackTimeLabel(ev);
              card.prepend(timeEl);
              body.appendChild(card);
            }
          });
        } else {
          body.style.minHeight = `${j2TotalSlots() * slotH}px`;
          j2EventOnDate(asset.id, dk).forEach((ev) => {
            const evEl = j2CreateEventElement(ev);
            if (ev.allDay) {
              evEl.style.position = 'relative';
              evEl.style.marginBottom = '2px';
            } else {
              evEl.style.top = `${j2TimeToSlot(ev.start, 0) * slotH}px`;
              evEl.style.height = `${(j2TimeToSlot(ev.end, 0) - j2TimeToSlot(ev.start, 0)) * slotH}px`;
            }
            body.appendChild(evEl);
          });
        }
        band.appendChild(body);
        dayCol.appendChild(band);
      });
      advGrid.appendChild(dayCol);
    });
    grid.appendChild(advGrid);
  }

  function j2RenderCalendar() {
    const grid = $('#calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    grid.dataset.view = j2State.view;
    grid.dataset.layout = j2State.layout;
    grid.dataset.mode = j2State.mode;
    switch (j2State.view) {
      case 'day': j2RenderDayView(grid); break;
      case 'week': j2RenderWeekView(grid); break;
      case 'work-week': j2RenderWorkWeekView(grid); break;
      case 'month': j2RenderMonthView(grid); break;
      case 'advanced-week': j2RenderAdvancedWeekView(grid); break;
      default: j2RenderWeekView(grid);
    }
    if (j2InteractiveGrid()) { j2PaintSelection(); j2PaintEventSelection(); }
    updateNowLine(); // One Calendar: the Journey 12 now line on the Journey 2 grid too
  }

  function j2SyncBodyDataset() {
    document.body.dataset.mode = j2State.mode;
    document.body.dataset.view = j2State.view;
    document.body.dataset.layout = j2State.layout;
    document.body.dataset.slotLayout = j2State.layout; // One Calendar: shared calendar styles key on data-slot-layout
    document.body.dataset.date = dateKey(j2State.selectedDate);
    document.body.dataset.advanced = j2State.advancedEnabled ? 'true' : 'false';
    document.body.dataset.rights = j2State.rightsMode;
    document.body.dataset.assetsDrawer = j2State.assetsDrawerOpen ? 'open' : 'closed';
  }

  function j2SyncModeButtons() {
    const booking = $('#mode-booking');
    const maintenance = $('#mode-maintenance');
    const indicator = $('#mode-indicator');
    if (!booking || !maintenance) return;
    const bookingOnly = j2State.rightsMode === 'booking-only';
    const maintenanceOnly = j2State.rightsMode === 'maintenance-only';
    booking.disabled = maintenanceOnly;
    maintenance.disabled = bookingOnly;
    booking.setAttribute('aria-pressed', j2State.mode === 'booking' ? 'true' : 'false');
    maintenance.setAttribute('aria-pressed', j2State.mode === 'maintenance' ? 'true' : 'false');
    if (bookingOnly) {
      maintenance.setAttribute('aria-describedby', 'mode-maintenance-reason');
      booking.removeAttribute('aria-describedby');
    } else if (maintenanceOnly) {
      booking.setAttribute('aria-describedby', 'mode-booking-reason');
      maintenance.removeAttribute('aria-describedby');
    } else {
      booking.removeAttribute('aria-describedby');
      maintenance.removeAttribute('aria-describedby');
    }
    if (indicator) indicator.textContent = j2State.mode === 'booking' ? 'Booking' : 'Maintenance';
  }

  function j2SyncViewButtons() {
    ['day', 'week', 'work-week', 'month', 'advanced-week'].forEach((v) => {
      const btn = $(`#view-${v}`);
      if (!btn) return;
      if (v === 'advanced-week' && !j2State.advancedEnabled) {
        btn.hidden = true;
        return;
      }
      btn.hidden = false;
      const active = j2State.view === v;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  }

  function j2SyncLayoutButtons() {
    const stack = $('#slot-layout-stack');
    const column = $('#slot-layout-column');
    const control = $('#slot-layout-control');
    if (control) control.hidden = j2State.view === 'day';
    if (stack) stack.setAttribute('aria-pressed', j2State.layout === 'stack' ? 'true' : 'false');
    if (column) column.setAttribute('aria-pressed', j2State.layout === 'column' ? 'true' : 'false');
  }

  function j2SyncDateChrome() {
    const rangeLabel = $('#j2-date-range-label');
    const live = $('#range-live');
    const prev = $('#date-prev');
    const next = $('#date-next');
    const cal = $('#calendar');
    const labels = j2NavUnitLabels();
    if (rangeLabel) rangeLabel.textContent = j2RangeHeading();
    if (live) live.textContent = j2LiveRangeText();
    if (prev) prev.setAttribute('aria-label', labels.prev);
    if (next) next.setAttribute('aria-label', labels.next);
    if (cal) {
      const [start] = j2VisibleRange(j2State.view, j2State.selectedDate);
      const name = j2State.view === 'day'
        ? `Day calendar, ${j2FormatLongDate(j2State.selectedDate)}`
        : `${J2_VIEW_LABELS[j2State.view]} calendar, ${j2FormatLongDate(start)}`;
      cal.setAttribute('aria-label', name);
    }
  }

  function j2SyncAssetsDrawer() {
    const toggle = $('#surface-toggle');
    if (!toggle) return;
    const open = j2State.assetsDrawerOpen;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.textContent = open ? 'Close assets' : 'Assets';
    toggle.setAttribute('aria-label', open ? 'Close assets' : 'Assets');
  }

  function j2SyncDemoPanel() {
    const panel = $('#review-demo-panel');
    const toggle = $('#review-demo-toggle');
    if (panel) panel.hidden = !j2State.demoOpen;
    if (toggle) toggle.setAttribute('aria-expanded', j2State.demoOpen ? 'true' : 'false');
  }

  function j2SyncFixtureControls() {
    const rightsId = j2State.rightsMode === 'booking-only'
      ? 'fixture-rights-booking'
      : j2State.rightsMode === 'maintenance-only'
        ? 'fixture-rights-maintenance'
        : 'fixture-rights-both';
    const rightsInput = $(`#${rightsId}`);
    if (rightsInput) rightsInput.checked = true;
    const advanced = $('#fixture-advanced');
    if (advanced) advanced.checked = j2State.advancedEnabled;
  }

  function j2SyncRovingTabindex(groupId, selector) {
    const group = $(groupId);
    if (!group) return;
    const buttons = Array.from(group.querySelectorAll(selector));
    buttons.forEach((b) => { b.tabIndex = -1; });
    const candidates = buttons.filter((b) => !b.disabled && !b.hidden);
    if (!candidates.length) return;
    let target = candidates.find((b) => b.getAttribute('aria-pressed') === 'true');
    if (!target) target = candidates.find((b) => b.getAttribute('aria-current') === 'true');
    if (!target) target = candidates[0];
    target.tabIndex = 0;
  }

  function j2RenderAssets() {
    const list = $('#asset-list');
    if (!list) return;
    list.innerHTML = '';
    J2_ASSETS.forEach((asset) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="asset-name">${asset.name}</span><span class="asset-venue">${asset.venue} · Review fixture</span>`;
      list.appendChild(li);
    });
  }

  function j2Render() {
    j2SyncBodyDataset();
    j2SyncModeButtons();
    j2SyncViewButtons();
    j2SyncLayoutButtons();
    j2SyncDateChrome();
    j2SyncAssetsDrawer();
    j2SyncDemoPanel();
    j2SyncFixtureControls();
    j2SyncRovingTabindex('#mode-group', '.mode-btn');
    j2SyncRovingTabindex('#view-group', '.view-btn');
    j2SyncRovingTabindex('#slot-layout-control', '.slot-layout-btn');
    j2RenderAssets();
    j2RenderCalendar();
    renderTimeslotLegend();
  }

  function j2StepDate(delta) {
    if (j2State.view === 'day') j2State.selectedDate = addDays(j2State.selectedDate, delta);
    else if (j2State.view === 'month') j2State.selectedDate = j2AddCalendarMonth(j2State.selectedDate, delta);
    else j2State.selectedDate = addDays(j2State.selectedDate, delta * 7);
    j2Render();
  }

  function j2SetMode(mode) {
    if (j2State.rightsMode === 'booking-only' && mode === 'maintenance') return;
    if (j2State.rightsMode === 'maintenance-only' && mode === 'booking') return;
    j2State.mode = mode;
    j2Render();
  }

  function j2SetView(view) {
    if (view === 'advanced-week' && !j2State.advancedEnabled) return;
    j2State.view = view;
    j2Render();
  }

  function j2SetLayout(layout) {
    if (j2State.view === 'day') return;
    j2State.layout = layout;
    j2Render();
  }

  function j2SetRights(mode) {
    j2State.rightsMode = mode;
    if (mode === 'booking-only') j2State.mode = 'booking';
    if (mode === 'maintenance-only') j2State.mode = 'maintenance';
    j2Render();
  }

  function j2SetAdvanced(enabled) {
    j2State.advancedEnabled = enabled;
    if (!enabled && j2State.view === 'advanced-week') j2State.view = 'week';
    j2Render();
  }

  function j2SetDate(d) {
    j2State.selectedDate = new Date(d);
    j2Render();
  }

  function j2OpenPicker() {
    const dialog = $('#date-picker-dialog');
    const input = $('#picker-input');
    const err = $('#picker-error');
    if (!dialog || !input) return;
    input.value = dateKey(j2State.selectedDate);
    if (err) err.hidden = true;
    dialog.showModal();
    input.focus();
  }

  function j2ClosePicker(restoreFocus) {
    const dialog = $('#date-picker-dialog');
    if (!dialog || !dialog.open) return;
    dialog.close();
    if (restoreFocus) $('#date-picker-btn')?.focus();
  }

  function j2ApplyPicker() {
    const input = $('#picker-input');
    const err = $('#picker-error');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      if (err) err.hidden = false;
      input.focus();
      return;
    }
    const d = j2ParseISO(val);
    if (!d) {
      if (err) err.hidden = false;
      input.focus();
      return;
    }
    if (err) err.hidden = true;
    j2SetDate(d);
    j2ClosePicker(true);
  }

  function j2ResetReviewState() {
    j2State.mode = 'booking';
    j2State.view = 'week';
    j2State.layout = 'column';
    j2State.selectedDate = new Date(J2_TODAY);
    j2State.advancedEnabled = true;
    j2State.rightsMode = 'both';
    j2State.assetsDrawerOpen = false;
    j2State.demoOpen = false;
    j2ClosePicker(false);
    j2SyncFixtureControls();
    j2Render();
  }

  async function j2GuidedReviewStep(target, caption, step, total, action, dwellMs) {
    const timing = j2GetReviewTiming();
    const el = typeof target === 'function' ? target() : (typeof target === 'string' ? $(target) : target);
    if (!el) throw new Error(`Guided review target missing at step ${step}`);
    if (guidedReviewTarget && guidedReviewTarget !== el) {
      guidedReviewTarget.classList.remove('guided-review-target', 'guided-review-clicked');
    }
    if (!el.getClientRects().length) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await j2WaitWhilePlaying(100);
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) throw new Error(`Guided review target hidden at step ${step}`);
    guidedReviewTarget = el;
    el.classList.add('guided-review-target');
    const overlay = ensureGuidedReviewOverlay();
    const targetDialog = el.closest('dialog[open]');
    if (targetDialog && overlay.parentElement !== targetDialog) targetDialog.appendChild(overlay);
    else if (!targetDialog && overlay.parentElement !== document.body) document.body.appendChild(overlay);
    $('#guided-review-count').textContent = `Step ${step} of ${total}`;
    $('#guided-review-caption').textContent = caption;
    const cursor = $('#guided-review-cursor');
    if (cursor) {
      cursor.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
      cursor.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
      cursor.classList.add('is-visible');
    }
    await j2WaitWhilePlaying(timing.moveMs);
    if (cursor) cursor.classList.add('is-clicking');
    el.classList.add('guided-review-clicked');
    await j2WaitWhilePlaying(timing.clickMs);
    if (typeof action === 'function') await Promise.resolve(action(el));
    else activateGuidedClickable(el);
    await j2WaitWhilePlaying(dwellMs == null ? timing.dwellPlay : dwellMs);
    if (cursor) cursor.classList.remove('is-clicking');
    el.classList.remove('guided-review-clicked');
  }

  async function j2ShowCompletionHold(caption, holdMs) {
    const overlay = ensureGuidedReviewOverlay();
    overlay.hidden = false;
    overlay.setAttribute('aria-hidden', 'false');
    const count = $('#guided-review-count');
    if (count) count.textContent = 'Complete';
    const cap = $('#guided-review-caption');
    if (cap) cap.textContent = caption;
    const cursor = $('#guided-review-cursor');
    if (cursor) cursor.classList.remove('is-visible', 'is-clicking');
    if (guidedReviewTarget) {
      guidedReviewTarget.classList.remove('guided-review-target', 'guided-review-clicked');
      guidedReviewTarget = null;
    }
    await j2WaitWhilePlaying(holdMs);
  }

  async function j2PlayJourney() {
    if (j2PlayActive) return;
    j2PlayActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    if (playBtn) playBtn.disabled = true;
    if (completeBtn) completeBtn.disabled = true;
    const timing = j2GetReviewTiming();
    const total = 20;
    let step = 0;
    j2ResetReviewState();
    beginGuidedReview('journey', total);
    try {
      await j2GuidedReviewStep(playBtn, 'Start a guided review of Diary mode, view, layout and date. This rail is not Product navigation.', ++step, total, () => {}, timing.dwellPlay);
      await j2GuidedReviewStep('#mode-maintenance', 'Switch to Maintenance. Blocks are inspect-only — Add Block is not part of Journey 2.', ++step, total);
      await j2GuidedReviewStep('#mode-booking', 'Return to Booking. Free intervals look selectable; Cart and Book stay absent.', ++step, total);
      await j2GuidedReviewStep('#date-prev', 'Previous week. Heading and grid move together to 24–30 Aug 2026.', ++step, total);
      await j2GuidedReviewStep('#date-next', 'Next week returns to the Today week, 31 Aug–6 Sep 2026.', ++step, total);
      await j2GuidedReviewStep('#date-today', 'Today is always Friday 4 September 2026. The view stays Week.', ++step, total);
      await j2GuidedReviewStep('#view-day', 'Standard Day: one selected day, time axis, layout control hidden.', ++step, total);
      await j2GuidedReviewStep('#date-prev', 'Previous day in Day view — Thursday 3 Sep 2026.', ++step, total);
      await j2GuidedReviewStep('#date-next', 'Next day — Friday 4 Sep 2026.', ++step, total);
      await j2GuidedReviewStep('#view-work-week', 'Work Week shows Monday–Friday only.', ++step, total);
      await j2GuidedReviewStep('#view-month', 'Month shows September 2026 with leading and trailing days.', ++step, total);
      await j2GuidedReviewStep('#view-week', 'Standard Week: seven Monday–Sunday columns.', ++step, total);
      await j2GuidedReviewStep('#slot-layout-stack', 'Stack: events become chronological rows with written start–end times.', ++step, total);
      await j2GuidedReviewStep('#slot-layout-column', 'Column: events sit on the shared time axis again.', ++step, total);
      await j2GuidedReviewStep('#view-advanced-week', 'Advanced Week stacks per-asset bands inside each day — not a renamed Week.', ++step, total);
      await j2GuidedReviewStep('#view-week', 'Return to Standard Week before picking a date.', ++step, total);
      await j2GuidedReviewStep('#date-picker-btn', 'Open Pick date. Focus moves into the accessible dialog.', ++step, total, null, timing.dwellDialog);
      await j2GuidedReviewStep('#picker-input', 'Current date is filled. This is a real date field, not a screenshot.', ++step, total, (el) => {
        el.value = '2026-09-11';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, timing.dwellDialog);
      await j2GuidedReviewStep('#picker-apply', 'Apply. Week heading becomes 7–13 Sep 2026; focus returns to Pick date.', ++step, total, null, timing.dwellDialog);
      await j2GuidedReviewStep('#date-today', 'Today restores Friday 4 Sep 2026. Guided review of Journey 2 is complete.', ++step, total);
      await j2ShowCompletionHold(
        'Play journey finished — Booking, Week, Column, Friday 4 Sep 2026. REVIEW FIXTURE only; FN-SHELL-004/005/006 remain PARTIAL.',
        timing.completionHold
      );
    } catch {
      await j2ShowCompletionHold('Guided review stopped — target unavailable', timing.completionHold);
    } finally {
      j2PlayActive = false;
      if (playBtn) playBtn.disabled = false;
      if (completeBtn) completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  async function j2PlayComplete() {
    if (j2PlayActive) return;
    j2PlayActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    if (playBtn) playBtn.disabled = true;
    if (completeBtn) completeBtn.disabled = true;
    const timing = j2GetReviewTiming();
    const total = 5;
    let step = 0;
    j2ResetReviewState();
    beginGuidedReview('complete', total);
    try {
      await j2GuidedReviewStep(completeBtn, 'Short happy path: choose mode, view, layout and date.', ++step, total, () => {}, timing.dwellComplete);
      await j2GuidedReviewStep('#mode-maintenance', 'Mode: Maintenance.', ++step, total, null, timing.dwellComplete);
      await j2GuidedReviewStep('#view-work-week', 'View: Work Week.', ++step, total, null, timing.dwellComplete);
      await j2GuidedReviewStep('#slot-layout-stack', 'Layout: Stack.', ++step, total, null, timing.dwellComplete);
      await j2GuidedReviewStep('#date-next', 'Date: next work week — 7–11 Sep 2026.', ++step, total, null, timing.dwellComplete);
      await j2ShowCompletionHold(
        'Play complete finished — Maintenance, Work Week, Stack, 7–11 Sep 2026. Four UJ-02 dimensions set. REVIEW FIXTURE only; not UI/UX approval.',
        timing.completionHold
      );
    } catch {
      await j2ShowCompletionHold('Guided review stopped — target unavailable', timing.completionHold);
    } finally {
      j2PlayActive = false;
      if (playBtn) playBtn.disabled = false;
      if (completeBtn) completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  function j2SetupRovingGroup(groupId, selector) {
    const group = $(groupId);
    if (!group) return;
    const getButtons = () => Array.from(group.querySelectorAll(selector)).filter((b) => !b.disabled && !b.hidden);
    group.addEventListener('keydown', (e) => {
      const buttons = getButtons();
      const idx = buttons.indexOf(document.activeElement);
      if (idx < 0) return;
      let next = idx;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % buttons.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + buttons.length) % buttons.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = buttons.length - 1;
      else return;
      e.preventDefault();
      buttons[next].focus();
    });
    getButtons().forEach((btn) => {
      btn.addEventListener('focus', () => {
        getButtons().forEach((b) => { b.tabIndex = b === btn ? 0 : -1; });
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          btn.click();
        }
      });
    });
  }

  function j2BindEvents() {
    $('#mode-booking')?.addEventListener('click', () => j2SetMode('booking'));
    $('#mode-maintenance')?.addEventListener('click', () => j2SetMode('maintenance'));
    $('#view-day')?.addEventListener('click', () => j2SetView('day'));
    $('#view-week')?.addEventListener('click', () => j2SetView('week'));
    $('#view-work-week')?.addEventListener('click', () => j2SetView('work-week'));
    $('#view-month')?.addEventListener('click', () => j2SetView('month'));
    $('#view-advanced-week')?.addEventListener('click', () => j2SetView('advanced-week'));
    document.querySelectorAll('input[name="fixture-rights"]').forEach((input) => {
      input.addEventListener('change', () => { if (input.checked) j2SetRights(input.value); });
    });
    $('#fixture-advanced')?.addEventListener('change', (e) => j2SetAdvanced(e.target.checked));
    $('#review-demo-toggle')?.addEventListener('click', () => {
      j2State.demoOpen = !j2State.demoOpen;
      if (j2State.demoOpen) j2State.assetsDrawerOpen = false;
      j2Render();
      if (j2State.demoOpen) ($('#review-demo-title') || $('#fixture-rights-both'))?.focus();
    });
    $('#calendar')?.addEventListener('keydown', (e) => {
      if (document.body.dataset.journey !== '2') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); j2StepDate(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); j2StepDate(1); }
    });
    $('#skip-calendar')?.addEventListener('click', (e) => {
      if (document.body.dataset.journey !== '2') return;
      e.preventDefault();
      $('#calendar')?.focus();
    });
    document.addEventListener('keydown', (e) => {
      if (document.body.dataset.journey !== '2' || e.key !== 'Escape') return;
      const dialog = $('#date-picker-dialog');
      if (dialog?.open) return;
      if (j2State.demoOpen) {
        j2State.demoOpen = false;
        j2Render();
        $('#review-demo-toggle')?.focus();
        return;
      }
      if (j2State.assetsDrawerOpen) {
        j2State.assetsDrawerOpen = false;
        j2Render();
        $('#surface-toggle')?.focus();
      }
    });
    j2SetupRovingGroup('#mode-group', '.mode-btn');
    j2SetupRovingGroup('#view-group', '.view-btn');
    j2SetupRovingGroup('#slot-layout-control', '.slot-layout-btn');
  }

  const FREE_SLOTS = [
    // Journey 1 multi-day design REVIEW FIXTURE only; no production availability policy is implied.
    { asset: 'hall1', date: '2026-08-28', start: 14, end: 17, j1Only: true },
    { asset: 'hall1', date: '2026-08-29', start: 14, end: 17 },
    { asset: 'hall1', date: '2026-08-30', start: 14, end: 17, j1Only: true },
    { asset: 'studio2', date: '2026-08-29', start: 10, end: 12 }
  ];

  const ITEMS = {
    'community-hall': { label: 'Community Hall Hire', category: 'Community', compatible: true },
    'studio-lighting': { label: 'Studio Lighting Hire', category: 'Technical', compatible: false }
  };

  const PACKAGES = {
    'private-day': {
      label: 'Private Day Hire', type: 'attendees', min: 5, max: 500,
      includedItems: ['community-hall', 'studio-lighting']
    },
    'covers-hire': {
      label: 'Covers Hire — review fixture', type: 'quantity', min: 1, max: 20,
      includedItems: ['community-hall']
    },
    'none': { label: 'None — item only', type: 'none', includedItems: [] }
  };

  const CONFIGURATIONS = {
    hall1: ['theatre', 'banquet'],
    hall2: ['banquet'],
    studio1: ['studio'],
    studio2: ['studio', 'theatre']
  };

  const CONFIGURATION_LABELS = {
    theatre: 'Theatre — review fixture',
    banquet: 'Banquet — review fixture',
    studio: 'Studio — review fixture'
  };

  const ROW_H = 36;
  const TREE_H = 38;
  const OVERSCAN = 8;
  const MAX_DOM = 80;
  const DEBOUNCE_MS = 80;

  let reviewScale = 1000;
  let reviewAssets = [];
  let reviewItems = [];
  let reviewPackages = [];
  let reviewConcessions = [];
  let genVenueExpanded = {};
  let scalabilityFixturesExpanded = false;
  let assetQuery = '';
  let assetScroll = 0;
  let assetActive = 0;
  let flatAssetRows = [];

  let pickerType = null;
  let pickerOpen = false;
  let pickerSuppressFocusOpen = false;
  let pickerQuery = '';
  let pickerActive = 0;
  let pickerPrev = '';
  let filteredPicker = [];
  let pickerHost = null;
  let pickerParentBeforeOpen = null;
  let pickerStyleBeforeOpen = null;
  let inlinePickerLineId = null;
  let inlinePickerField = null;
  const debounceTimers = {};

  const GROUP_DEFS = [
    ['A', 'Sat 29 Aug'],
    ['B', 'Sun 30 Aug'],
    ['C', 'Mon 31 Aug']
  ];

  let weekStart = new Date(CHECKPOINT_WEEK_START);
  let slotLayout = 'column';
  let selectedAssets = new Set(['hall1', 'studio2']);
  let expandedNodes = new Set(['venue', 'halls', 'studios']);
  let cartLines = [];
  let stagedSelection = null;
  let currentSelectionDetailsExpanded = false;
  let editingLineId = null;
  let removeTargetId = null;
  let dragState = null;
  let hoverCrosshair = null;
  let lastDialogTrigger = null;
  let playJourneyStep = 0;
  let playJourneyActive = false;
  let cartHomeParent = null;
  let expandedLineId = null;
  let expandedMode = null;
  let listScrollPos = 0;
  let selectedLineIds = new Set();
  let expandedGroups = new Set([0, 1, 2]);
  let timeEditor = null;
  let configurationEditor = null;
  let packageEditor = null;
  let pricingEditor = null;
  let pickerContext = null;
  let cartItemEditor = null;
  let cartViewMode = 'compact';
  let openLineActionsId = null;

  const draft = {
    created: null,
    unavailableSelection: null,
    phase: 'select',
    stressCount: null
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* Contextual Diary workspace candidate — CR-CW-001 / CR-CW-002.
     Presentation orchestration only: the existing Asset Explorer and Booking Cart remain single-source. */
  let contextualAssetOpener = null;
  let contextualCartOpener = null;
  let contextualLastSurface = null;
  let contextualCartDismissed = false;

  function isContextualWorkspace() {
    return document.body.dataset.contextualWorkspace === 'true' && ['1', '7', '9'].includes(document.body.dataset.journey);
  }

  function contextualIsMobile() {
    return window.matchMedia('(width <= 600px)').matches;
  }

  function contextualUsesModalPrecedence() {
    return window.matchMedia('(width < 1100px)').matches;
  }

  function contextualAllowsBothPanels() {
    return window.matchMedia('(width >= 1100px)').matches;
  }

  function contextualAssetIsOpen() {
    return document.body.dataset.cwAssets === 'open';
  }

  function contextualCartIsOpen() {
    return document.body.dataset.cwCart === 'open';
  }

  function contextualSetExcluded(element, excluded) {
    if (!element) return;
    element.inert = excluded;
    if (excluded) element.setAttribute('aria-hidden', 'true');
    else element.removeAttribute('aria-hidden');
  }

  function contextualPanelFocusables(panel) {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter((node) => !node.hidden && !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length));
  }

  function contextualSyncAssetSummary() {
    const countEl = $('#j3-launcher-count');
    const namesEl = $('#j3-launcher-names');
    const selected = Array.from(selectedAssets).map((id) =>
      ASSETS.find((asset) => asset.id === id) || reviewAssets.find((asset) => asset.id === id)
    ).filter(Boolean);
    if (countEl) countEl.textContent = `${selected.length} selected`;
    if (namesEl) namesEl.textContent = selected.length
      ? selected.slice(0, 3).map((asset) => asset.name).join(' · ') + (selected.length > 3 ? ` · +${selected.length - 3}` : '')
      : 'No resources selected';
  }

  function contextualSyncCartSummary() {
    if (!isContextualWorkspace()) return;
    const projection = projectCartRuntime();
    const count = projection.itemLabel;
    const status = projection.count > 0
      ? projection.statusLabel
      : (stagedSelection ? 'New selection in progress' : 'No items to review');
    const total = projection.count > 0
      ? projection.formattedTotal
      : (stagedSelection ? 'Total shown in Cart' : 'No priced items');
    if ($('#contextual-cart-count')) $('#contextual-cart-count').textContent = count;
    if ($('#contextual-cart-status')) $('#contextual-cart-status').textContent = status;
    if ($('#contextual-cart-total')) $('#contextual-cart-total').textContent = total;
    const opener = $('#contextual-cart-open');
    if (opener) opener.setAttribute('aria-label', `Open Booking Cart — ${count}; ${status}; ${total}`);
  }

  function contextualSyncSurfaces() {
    if (!isContextualWorkspace()) return;
    const assetPanel = $('#assets-panel');
    const cart = $('#booking-cart');
    const assetLauncher = $('#j3-asset-launcher');
    const cartLauncher = $('#contextual-cart-launcher');
    const assetButton = $('#j3-launcher-btn');
    const cartButton = $('#contextual-cart-open');
    const assetClose = $('#j3-explorer-close');
    const cartClose = $('#contextual-cart-close');
    const scrim = $('#j3-explorer-scrim');

    if (contextualIsMobile()) {
      document.body.dataset.cwAssets = 'closed';
      document.body.dataset.cwCart = 'closed';
      if (assetLauncher) assetLauncher.hidden = true;
      if (cartLauncher) cartLauncher.hidden = true;
      contextualSetExcluded(assetPanel, false);
      contextualSetExcluded(cart, false);
      [assetClose, cartClose].forEach((button) => {
        if (!button) return;
        button.hidden = true;
        button.inert = true;
        button.setAttribute('aria-hidden', 'true');
      });
      if (scrim) {
        scrim.hidden = true;
        scrim.inert = true;
        scrim.setAttribute('aria-hidden', 'true');
      }
      if (assetButton) assetButton.setAttribute('aria-expanded', 'false');
      if (cartButton) cartButton.setAttribute('aria-expanded', 'false');
      assetPanel?.removeAttribute('role');
      assetPanel?.removeAttribute('aria-modal');
      cart?.removeAttribute('role');
      cart?.removeAttribute('aria-modal');
      return;
    }

    const assetOpen = contextualAssetIsOpen();
    const cartOpen = contextualCartIsOpen();
    const modal = contextualUsesModalPrecedence() && (assetOpen || cartOpen);

    if (assetLauncher) assetLauncher.hidden = assetOpen;
    if (cartLauncher) cartLauncher.hidden = cartOpen;
    contextualSetExcluded(assetPanel, !assetOpen);
    contextualSetExcluded(cart, !cartOpen);
    if (assetButton) assetButton.setAttribute('aria-expanded', String(assetOpen));
    if (cartButton) cartButton.setAttribute('aria-expanded', String(cartOpen));

    if (assetClose) {
      assetClose.hidden = !assetOpen;
      contextualSetExcluded(assetClose, !assetOpen);
    }
    if (cartClose) {
      cartClose.hidden = !cartOpen;
      contextualSetExcluded(cartClose, !cartOpen);
    }

    if (assetOpen) {
      assetPanel.setAttribute('role', modal ? 'dialog' : 'complementary');
      if (modal) assetPanel.setAttribute('aria-modal', 'true');
      else assetPanel.removeAttribute('aria-modal');
    } else {
      assetPanel.removeAttribute('role');
      assetPanel.removeAttribute('aria-modal');
    }
    if (cartOpen) {
      cart.setAttribute('role', modal ? 'dialog' : 'complementary');
      if (modal) cart.setAttribute('aria-modal', 'true');
      else cart.removeAttribute('aria-modal');
    } else {
      cart.removeAttribute('role');
      cart.removeAttribute('aria-modal');
    }

    if (scrim) {
      scrim.hidden = !modal;
      scrim.inert = !modal;
      if (modal) scrim.removeAttribute('aria-hidden');
      else scrim.setAttribute('aria-hidden', 'true');
    }
    contextualSyncAssetSummary();
    contextualSyncCartSummary();
  }

  function contextualCloseAssets(options) {
    if (!isContextualWorkspace() || !contextualAssetIsOpen()) return;
    const opts = options || {};
    document.body.dataset.cwAssets = 'closed';
    contextualSyncSurfaces();
    if (opts.restore !== false && contextualAssetOpener && document.body.contains(contextualAssetOpener)) contextualAssetOpener.focus();
    if (opts.announce !== false) announceLive('Asset Explorer closed. Diary width restored.');
  }

  function contextualCloseCart(options) {
    if (!isContextualWorkspace() || !contextualCartIsOpen()) return;
    const opts = options || {};
    document.body.dataset.cwCart = 'closed';
    if (opts.dismiss !== false) contextualCartDismissed = true;
    contextualSyncSurfaces();
    if (opts.restore !== false && contextualCartOpener && document.body.contains(contextualCartOpener)) contextualCartOpener.focus();
    if (opts.announce !== false) announceLive('Booking Cart closed. Diary width restored.');
  }

  function contextualOpenAssets(opener, moveFocus) {
    if (!isContextualWorkspace() || contextualIsMobile()) return;
    contextualAssetOpener = opener || $('#j3-launcher-btn');
    contextualLastSurface = 'assets';
    if (!contextualAllowsBothPanels() && contextualCartIsOpen()) {
      contextualCloseCart({ restore: false, dismiss: true, announce: false });
    }
    document.body.dataset.cwAssets = 'open';
    contextualSyncSurfaces();
    if (moveFocus !== false) {
      const search = $('#asset-search');
      search?.focus({ preventScroll: true });
    }
    announceLive('Asset Explorer opened.');
  }

  function contextualOpenCart(opener, moveFocus) {
    if (!isContextualWorkspace() || contextualIsMobile()) return;
    contextualCartOpener = opener || $('#contextual-cart-open');
    contextualLastSurface = 'cart';
    contextualCartDismissed = false;
    if (!contextualAllowsBothPanels() && contextualAssetIsOpen()) {
      contextualCloseAssets({ restore: false, announce: false });
    }
    document.body.dataset.cwCart = 'open';
    contextualSyncSurfaces();
    if (moveFocus !== false) $('#contextual-cart-close')?.focus({ preventScroll: true });
    announceLive('Booking Cart opened.');
  }

  function contextualHandleKeydown(event) {
    if (!isContextualWorkspace() || contextualIsMobile() || event.defaultPrevented) return;
    const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const originatedInOwnedOverlay = eventPath.some((node) => node instanceof Element && node.matches('dialog, #large-data-picker'));
    if (originatedInOwnedOverlay || $('dialog[open]') || pickerOpen) return;
    const assetOpen = contextualAssetIsOpen();
    const cartOpen = contextualCartIsOpen();
    if (!assetOpen && !cartOpen) return;
    const activePanel = contextualLastSurface === 'assets' && assetOpen ? $('#assets-panel')
      : (contextualLastSurface === 'cart' && cartOpen ? $('#booking-cart') : (cartOpen ? $('#booking-cart') : $('#assets-panel')));
    if (event.key === 'Escape') {
      event.preventDefault();
      if (activePanel?.id === 'booking-cart') contextualCloseCart();
      else contextualCloseAssets();
      return;
    }
    if (event.key !== 'Tab' || !contextualUsesModalPrecedence()) return;
    const nodes = contextualPanelFocusables(activePanel);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function contextualRefreshFromCart() {
    if (!isContextualWorkspace()) return;
    contextualSyncCartSummary();
    const hasCartContext = !!stagedSelection || cartLines.length > 0;
    if (!hasCartContext) contextualCartDismissed = false;
    if (hasCartContext && !contextualCartDismissed && !contextualCartIsOpen() && !contextualIsMobile()) {
      contextualOpenCart($('#contextual-cart-open'), false);
    }
  }

  function setupContextualWorkspace() {
    if (!isContextualWorkspace()) return;
    document.body.dataset.cwAssets = 'closed';
    document.body.dataset.cwCart = 'closed';
    contextualAssetOpener = $('#j3-launcher-btn');
    contextualCartOpener = $('#contextual-cart-open');
    $('#j3-launcher-btn')?.addEventListener('click', (event) => contextualOpenAssets(event.currentTarget));
    $('#j3-explorer-close')?.addEventListener('click', () => contextualCloseAssets());
    $('#j3-explorer-done')?.addEventListener('click', () => contextualCloseAssets());
    $('#contextual-cart-open')?.addEventListener('click', (event) => contextualOpenCart(event.currentTarget));
    $('#contextual-cart-close')?.addEventListener('click', () => contextualCloseCart());
    $('#j3-explorer-scrim')?.addEventListener('click', () => {
      if (contextualLastSurface === 'assets' && contextualAssetIsOpen()) contextualCloseAssets();
      else if (contextualCartIsOpen()) contextualCloseCart();
    });
    document.addEventListener('keydown', contextualHandleKeydown);
    contextualSyncSurfaces();
    contextualSyncAssetSummary();
    contextualSyncCartSummary();
  }

  function pad(n, w) {
    let s = String(n);
    while (s.length < w) s = '0' + s;
    return s;
  }

  function fmt(n) {
    return n.toLocaleString('en-AU');
  }

  function debounce(key, fn) {
    clearTimeout(debounceTimers[key]);
    debounceTimers[key] = setTimeout(fn, DEBOUNCE_MS);
  }

  function announceLive(msg) {
    const el = $('#ldp-live');
    if (el) el.textContent = msg;
  }

  function computeWindow(scrollTop, h, rowH, total) {
    const visible = Math.ceil(h / rowH) || 1;
    const windowSize = Math.min(MAX_DOM, visible + OVERSCAN * 2);
    const maxStart = Math.max(0, total - windowSize);
    const start = Math.max(0, Math.min(Math.floor(scrollTop / rowH) - OVERSCAN, maxStart));
    const end = Math.min(total, start + windowSize);
    return { start, end, totalHeight: total * rowH };
  }

  function generateReviewAssets(n) {
    const arr = ASSETS.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      venue: a.venue,
      journey: true,
      lane: true,
      color: a.tint,
      haystack: (a.name + ' ' + a.category + ' ' + a.venue + ' ' + a.id).toLowerCase()
    }));
    for (let i = 4; i < n; i++) {
      const venueIdx = Math.floor((i - 4) / 24) + 2;
      const venue = 'Review venue ' + pad(venueIdx, 3) + ' — review fixture';
      const odd = i % 2 === 1;
      const cat = odd ? 'Halls' : 'Studios';
      const name = (odd ? 'Review Hall ' : 'Review Studio ') + pad(i + 1, 4);
      const id = 'rf-asset-' + pad(i + 1, 5);
      arr.push({
        id, name, category: cat, venue, journey: false, lane: false,
        color: odd ? 'cobalt' : 'teal', venueIdx,
        haystack: (name + ' ' + cat + ' ' + venue + ' ' + id).toLowerCase()
      });
    }
    return arr;
  }

  function generateReviewItems(n) {
    const arr = [
      { id: 'community-hall', name: 'Community Hall Hire', category: 'Community', journey: true, haystack: 'community hall hire community community-hall' },
      { id: 'studio-lighting', name: 'Studio Lighting Hire', category: 'Technical', journey: true, haystack: 'studio lighting hire technical studio-lighting' }
    ];
    for (let i = 2; i < n; i++) {
      const id = 'rf-itm-' + pad(i + 1, 5);
      const name = 'Review item ' + pad(i + 1, 5) + ' — review fixture';
      const cat = 'Review category ' + ((i % 8) + 1);
      arr.push({ id, name, category: cat, journey: false, haystack: (name + ' ' + cat + ' ' + id).toLowerCase() });
    }
    return arr;
  }

  function generateReviewPackages() {
    const arr = [
      { id: 'private-day', name: 'Private Day Hire', journey: true, haystack: 'private day hire attendees private-day' },
      { id: 'covers-hire', name: 'Covers Hire — review fixture', journey: true, haystack: 'covers hire quantity covers-hire' },
      { id: 'none', name: 'None — item only', journey: true, haystack: 'none item only none' }
    ];
    for (let k = 4; k <= 64; k++) {
      arr.push({
        id: 'rf-pkg-' + pad(k, 5),
        name: 'Review package ' + pad(k, 5) + ' — review fixture',
        journey: false,
        haystack: ('review package ' + pad(k, 5)).toLowerCase()
      });
    }
    return arr;
  }

  function generateReviewConcessions() {
    const arr = [{ id: 'review-fixture', name: 'Review fixture', journey: true, haystack: 'review fixture review-fixture' }];
    for (let k = 2; k <= 32; k++) {
      arr.push({
        id: 'rf-cnc-' + pad(k, 5),
        name: 'Review concession ' + pad(k, 4) + ' — review fixture',
        journey: false,
        haystack: ('review concession ' + pad(k, 4)).toLowerCase()
      });
    }
    return arr;
  }

  function regenReviewScale(scale) {
    reviewScale = scale;
    reviewAssets = generateReviewAssets(scale);
    reviewItems = generateReviewItems(scale);
    scalabilityFixturesExpanded = false;
    assetScroll = 0;
    assetActive = 0;
    $$('.review-scale-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.scale) === scale));
    renderAssetTree();
    if (pickerOpen && pickerType) {
      const q = $('#large-data-filter') ? $('#large-data-filter').value : pickerQuery;
      pickerQuery = q;
      filteredPicker = filterCatalog(pickerType, q);
      pickerActive = 0;
      const listEl = $('#large-data-picker-list');
      if (listEl) listEl.scrollTop = 0;
      renderPicker();
    }
    const rows = getAssetDisplayRows();
    const k = Math.min(48, rows.length);
    announceLive(fmt(scale) + ' review fixture resources ready. Showing 1–' + k + '.');
  }

  function getItemRecord(id) {
    if (ITEMS[id]) return { id, label: ITEMS[id].label, category: ITEMS[id].category, journey: true };
    const r = reviewItems.find((x) => x.id === id);
    return r ? { id: r.id, label: r.name, category: r.category, journey: false } : { id, label: id, category: '', journey: false };
  }

  function getPackageRecord(id) {
    if (PACKAGES[id]) return { id, label: PACKAGES[id].label, journey: true };
    const r = reviewPackages.find((x) => x.id === id);
    return r ? { id: r.id, label: r.name, journey: false } : { id, label: id, journey: false };
  }

  function getConcessionRecord(id) {
    const r = reviewConcessions.find((x) => x.id === id);
    return r ? { id: r.id, label: r.name, journey: !!r.journey } : { id, label: id, journey: false };
  }

  function compactOptionLabel(value) {
    return String(value || '')
      .replace(/\s+—\s+(?:local\s+)?review fixture.*$/i, '')
      .replace(/\s+·\s+(?:local\s+)?review fixture.*$/i, '')
      .trim();
  }

  function isJourneyItem(id) {
    return id === 'community-hall' || id === 'studio-lighting';
  }

  function isJourneyPackage(id) {
    return id === 'private-day' || id === 'covers-hire' || id === 'none';
  }

  const FIELD_HOSTS = {
    item: '#cfg-item',
    package: '#cfg-package',
    concession: '#cfg-concession'
  };

  const FIELD_INPUTS = {
    item: '#cfg-item-input',
    package: '#cfg-package-input',
    concession: '#cfg-concession-input'
  };

  function getCommitted(field) {
    const host = $(FIELD_HOSTS[field]);
    return host ? host.value : '';
  }

  function getCommittedLabel(field) {
    const id = getCommitted(field);
    if (!id) return '';
    if (field === 'item') return compactOptionLabel(getItemRecord(id).label);
    if (field === 'package') return compactOptionLabel(getPackageRecord(id).label);
    if (field === 'concession') return compactOptionLabel(getConcessionRecord(id).label);
    return '';
  }

  function syncFieldDisplay(field) {
    const input = $(FIELD_INPUTS[field]);
    if (!input) return;
    input.value = getCommittedLabel(field);
  }

  function setCommitted(field, id, opts) {
    const notify = !opts || opts.notify !== false;
    if (isJourney7Route() && notify && !j7AllowedCatalogValue(field, id)) {
      j7BlockReview(`Journey 7 keeps the ${field} choice inside the accepted local fixture.`);
      return;
    }
    const host = $(FIELD_HOSTS[field]);
    if (host) host.value = id;
    syncFieldDisplay(field);
    if (notify && host) {
      host.dispatchEvent(new Event('change', { bubbles: true }));
      if (field === 'item' || field === 'package') updateConfigureForm();
    }
  }

  function getCatalog(type) {
    if (isJourney7Route()) {
      if (type === 'item') return reviewItems.filter((record) => record.id === 'community-hall' || record.id === 'studio-lighting');
      if (type === 'package') return reviewPackages.filter((record) => record.id === 'private-day');
      if (type === 'concession') return reviewConcessions.filter((record) => record.id === 'review-fixture');
    }
    if (type === 'item') return reviewItems;
    if (type === 'package') return reviewPackages;
    if (type === 'concession') return reviewConcessions;
    return [];
  }

  function filterCatalog(type, q) {
    const cat = getCatalog(type);
    const lq = q.toLowerCase().trim();
    if (!lq) return cat.slice();
    return cat.filter((r) => r.haystack.indexOf(lq) !== -1 || r.name.toLowerCase().indexOf(lq) !== -1);
  }

  function getPickerInputEl(type) {
    return $(FIELD_INPUTS[type]);
  }

  function isNarrowViewport() {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  function positionPicker(type) {
    const picker = $('#large-data-picker');
    const input = getPickerInputEl(type);
    if (!picker || !input) return;
    const field = input.closest('.field, .combobox') || input;
    const rect = field.getBoundingClientRect();
    const cart = $('#booking-cart');
    const cartRect = cart.getBoundingClientRect();
    const pickerWidth = Math.min(520, cart.clientWidth - 16);
    let relLeft = rect.left - cartRect.left - 8;
    relLeft = Math.max(0, Math.min(relLeft, cart.clientWidth - pickerWidth - 16));
    picker.style.position = 'absolute';
    picker.style.width = pickerWidth + 'px';
    picker.style.left = (8 + relLeft) + 'px';
    let top = rect.bottom - cartRect.top + 6;
    if (top + 360 > cart.clientHeight) top = rect.top - cartRect.top - 360 - 6;
    picker.style.top = Math.max(0, top) + 'px';
    picker.style.right = 'auto';
    picker.style.bottom = 'auto';
  }

  function positionStagedPackagePicker() {
    const picker = $('#large-data-picker');
    const dialog = getCartItemEditorDialog();
    const trigger = $('#package-picker-btn');
    if (!picker || !dialog || !trigger) return;
    const dialogRect = dialog.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const padding = 16;
    const width = Math.max(0, Math.min(520, dialogRect.width - padding * 2, window.innerWidth - padding * 2));
    const height = Math.max(120, Math.min(360, window.innerHeight - padding * 2, dialogRect.height - padding * 2));
    const minTop = dialogRect.top + padding;
    const maxTop = Math.max(minTop, dialogRect.bottom - padding - height);
    const requestedTop = triggerRect.bottom + 8;
    const top = Math.max(minTop, Math.min(requestedTop, maxTop));
    const left = Math.max(padding, Math.min(triggerRect.left, window.innerWidth - width - padding));
    const setImportant = (property, value) => picker.style.setProperty(property, value, 'important');
    setImportant('position', 'fixed');
    setImportant('width', `${width}px`);
    setImportant('left', `${left}px`);
    setImportant('top', `${top}px`);
    setImportant('right', 'auto');
    setImportant('bottom', 'auto');
    setImportant('max-height', `${height}px`);
  }

  function setPickerAria(open, type) {
    const filterEl = $('#large-data-filter');
    const inp = type ? getPickerInputEl(type) : null;
    if (open) {
      filterEl.setAttribute('role', 'combobox');
      filterEl.setAttribute('aria-expanded', 'true');
      filterEl.setAttribute('aria-controls', 'large-data-listbox');
      filterEl.setAttribute('aria-autocomplete', 'list');
      if (inp) inp.setAttribute('aria-expanded', 'true');
    } else {
      filterEl.removeAttribute('role');
      filterEl.removeAttribute('aria-expanded');
      filterEl.removeAttribute('aria-controls');
      filterEl.removeAttribute('aria-autocomplete');
      filterEl.removeAttribute('aria-activedescendant');
      ['item', 'package', 'concession'].forEach((t) => {
        const el = getPickerInputEl(t);
        if (el) {
          el.setAttribute('aria-expanded', 'false');
          el.removeAttribute('aria-activedescendant');
        }
      });
    }
  }

  function openPicker(type, opts) {
    const nextHost = (opts && opts.host) || null;
    const nextContext = (opts && opts.context) || null;
    const nextField = (opts && opts.field) || null;
    const equivalentRequest = pickerOpen
      && pickerType === type
      && pickerContext === nextContext
      && pickerHost === nextHost
      && inlinePickerField === nextField;
    if (equivalentRequest) {
      const dialog = getCartItemEditorDialog();
      const stagedPackageEditor = pickerContext === 'package-editor'
        && cartItemEditorTargetsStagedSelection()
        && !!dialog?.open;
      if (stagedPackageEditor) positionStagedPackagePicker();
      $('#large-data-filter')?.focus();
      return;
    }
    if (pickerOpen) closePicker({ restore: false, refocus: false });
    pickerType = type;
    pickerOpen = true;
    pickerQuery = '';
    pickerActive = 0;
    pickerHost = nextHost;
    pickerContext = nextContext;
    inlinePickerLineId = pickerHost && !pickerContext ? pickerHost.id : null;
    inlinePickerField = nextField;
    const inp = getPickerInputEl(type);
    pickerPrev = inp ? inp.value : '';
    $('#large-data-filter').value = '';
    filteredPicker = filterCatalog(type, '');
    const picker = $('#large-data-picker');
    const dialog = getCartItemEditorDialog();
    const stagedPackageEditor = pickerContext === 'package-editor'
      && cartItemEditorTargetsStagedSelection()
      && !!dialog?.open;
    pickerParentBeforeOpen = picker.parentElement;
    pickerStyleBeforeOpen = picker.getAttribute('style');
    picker.classList.add('open');
    if (stagedPackageEditor) {
      dialog.appendChild(picker);
      $('#large-data-picker-backdrop').classList.remove('open');
      positionStagedPackagePicker();
    } else if (!isNarrowViewport()) {
      $('#booking-cart').appendChild(picker);
      positionPicker(type);
      $('#large-data-picker-backdrop').classList.remove('open');
    } else {
      picker.style.position = 'fixed';
      picker.style.left = '0';
      picker.style.right = '0';
      picker.style.bottom = '0';
      picker.style.top = 'auto';
      picker.style.width = '100%';
      document.body.appendChild(picker);
      $('#large-data-picker-backdrop').classList.add('open');
    }
    setPickerAria(true, type);
    $('#large-data-filter').focus();
    renderPicker();
  }

  function pickerFocusReturn(type) {
    pickerSuppressFocusOpen = true;
    if (isNarrowViewport() && !document.body.classList.contains('sheet-expanded')) {
      $('#sheet-handle').focus();
    } else {
      const inp = getPickerInputEl(type);
      if (inp) inp.focus();
    }
    pickerSuppressFocusOpen = false;
  }

  function closePicker(opts) {
    if (!pickerOpen) return;
    const restore = !opts || opts.restore !== false;
    const refocus = !opts || opts.refocus !== false;
    const type = pickerType;
    const context = pickerContext;
    const inp = getPickerInputEl(type);
    if (restore && inp) inp.value = pickerPrev;
    setPickerAria(false);
    pickerOpen = false;
    pickerType = null;
    pickerHost = null;
    pickerContext = null;
    inlinePickerLineId = null;
    inlinePickerField = null;
    const picker = $('#large-data-picker');
    picker.classList.remove('open');
    $('#large-data-picker-backdrop').classList.remove('open');
    if (pickerParentBeforeOpen) pickerParentBeforeOpen.appendChild(picker);
    if (pickerStyleBeforeOpen == null) picker.removeAttribute('style');
    else picker.setAttribute('style', pickerStyleBeforeOpen);
    pickerParentBeforeOpen = null;
    pickerStyleBeforeOpen = null;
    if (context === 'package-editor' && restore && packageEditor) {
      renderPackageEditor();
      if (opts?.reopenParent !== false) {
        reopenCartItemEditor('package');
        $('#package-picker-btn').focus();
      }
    } else if (refocus && type) pickerFocusReturn(type);
  }

  function commitPicker(idx) {
    const rec = filteredPicker[idx];
    if (!rec || !pickerType) return;
    if (isJourney7Route() && !j7AllowedCatalogValue(pickerType, rec.id)) {
      closePicker({ restore: true, refocus: true });
      j7BlockReview(`Journey 7 cannot apply this ${pickerType} review choice.`);
      return;
    }
    const context = pickerContext;
    if (context === 'package-editor' && packageEditor) {
      packageEditor.package = rec.id;
      const meta = PACKAGES[rec.id] || { type: 'none', includedItems: [] };
      packageEditor.quantity = '';
      packageEditor.attendees = '';
      packageEditor.includedItems = new Set(meta.includedItems || []);
      announceLive(rec.name + ' selected.');
      closePicker({ restore: false, refocus: false });
      renderPackageEditor();
      reopenCartItemEditor('package');
      $('#package-picker-btn').focus();
      return;
    }
    if (inlinePickerLineId && inlinePickerField) {
      const line = cartLines.find((l) => l.id === inlinePickerLineId);
      if (line) {
        line[inlinePickerField] = rec.id;
        showToast('Cart item updated — booking is not saved');
        expandedLineId = null;
        updateCartUI();
      }
    } else {
      setCommitted(pickerType, rec.id);
    }
    announceLive(rec.name + ' selected.');
    closePicker({ restore: false, refocus: true });
  }

  function renderPicker() {
    const type = pickerType;
    if (!type) return;
    const list = filteredPicker;
    const total = list.length;
    const scrollEl = $('#large-data-picker-list');
    const vp = $('#large-data-listbox');
    const win = computeWindow(scrollEl.scrollTop, scrollEl.clientHeight || 240, ROW_H, total);
    vp.style.height = win.totalHeight + 'px';
    let html = '';
    const committedId = pickerContext === 'package-editor' && packageEditor
      ? packageEditor.package
      : (inlinePickerLineId && inlinePickerField
        ? (cartLines.find((l) => l.id === inlinePickerLineId) || {})[inlinePickerField]
        : getCommitted(type));
    for (let i = win.start; i < win.end; i++) {
      const r = list[i];
      const top = i * ROW_H;
      const active = i === pickerActive ? ' active' : '';
      const sel = committedId === r.id ? ' selected' : '';
      const optId = 'ldp-' + type + '-opt-' + r.id;
      html += '<div class="picker-row' + active + sel + '" id="' + optId + '" role="option" aria-selected="' + (committedId === r.id ? 'true' : 'false') + '" data-idx="' + i + '" style="top:' + top + 'px"><span class="picker-name">' + escapeHtml(compactOptionLabel(r.name)) + '</span></div>';
    }
    if (!total) {
      vp.innerHTML = '<div class="picker-row" style="position:relative;top:0;height:36px;color:var(--text-quiet)">No matching results.</div>';
      vp.style.height = '36px';
    } else {
      vp.innerHTML = html;
    }
    const descId = list[pickerActive] ? 'ldp-' + type + '-opt-' + list[pickerActive].id : '';
    const filterEl = $('#large-data-filter');
    const inp = getPickerInputEl(type);
    if (descId && pickerOpen) {
      if (document.activeElement === filterEl) {
        filterEl.setAttribute('aria-activedescendant', descId);
        if (inp) inp.removeAttribute('aria-activedescendant');
      } else if (inp) {
        inp.setAttribute('aria-activedescendant', descId);
        filterEl.removeAttribute('aria-activedescendant');
      }
    }
    const s = total ? win.start + 1 : 0;
    const e = total ? win.end : 0;
    const resultCopy = total === 1 ? '1 result' : fmt(total) + ' results';
    $('#large-data-picker-meta').textContent = resultCopy + ' · showing ' + s + '–' + e;
  }

  function scrollPickerActive() {
    const scrollEl = $('#large-data-picker-list');
    const top = pickerActive * ROW_H;
    const bottom = top + ROW_H;
    if (top < scrollEl.scrollTop) scrollEl.scrollTop = top;
    else if (bottom > scrollEl.scrollTop + scrollEl.clientHeight) scrollEl.scrollTop = bottom - scrollEl.clientHeight;
  }

  function handlePickerKeys(e, fromFilter) {
    if (!pickerOpen || !pickerType) return;
    const type = pickerType;
    const n = filteredPicker.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); pickerActive = Math.min(n - 1, pickerActive + 1); renderPicker(); scrollPickerActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); pickerActive = Math.max(0, pickerActive - 1); renderPicker(); scrollPickerActive(); }
    else if (e.key === 'Home') { e.preventDefault(); pickerActive = 0; renderPicker(); scrollPickerActive(); }
    else if (e.key === 'End') { e.preventDefault(); pickerActive = Math.max(0, n - 1); renderPicker(); scrollPickerActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (n) commitPicker(pickerActive); }
    else if (e.key === 'Escape') { e.preventDefault(); closePicker({ restore: true, refocus: true }); }
    else if (e.key === 'Tab') { closePicker({ restore: false, refocus: false }); }
    else if (!fromFilter && (e.key.length === 1 || e.key === 'Backspace')) {
      const inp = getPickerInputEl(type);
      if (!inp) return;
      debounce('picker', () => {
        filteredPicker = filterCatalog(type, inp.value);
        $('#large-data-filter').value = inp.value;
        pickerActive = 0;
        $('#large-data-picker-list').scrollTop = 0;
        renderPicker();
      });
    }
  }

  function getScalabilityFixtureCount() {
    return reviewAssets.reduce((count, asset) => count + (asset.journey ? 0 : 1), 0);
  }

  function getBrowseRows() {
    if (isJ3Journey()) return getJ3BrowseRows();
    const rows = [];
    rows.push({ kind: 'venue', key: 'venue', name: 'Northside Leisure Centre', level: 1, expanded: expandedNodes.has('venue'), journey: true, meta: 'Venue · Journey fixtures' });
    if (expandedNodes.has('venue')) {
      rows.push({ kind: 'category', key: 'halls', name: 'Halls', level: 2, expanded: expandedNodes.has('halls'), meta: 'Category' });
      if (expandedNodes.has('halls')) {
        ['hall1', 'hall2'].forEach((id) => {
          const a = ASSETS.find((x) => x.id === id);
          rows.push({ kind: 'resource', key: id, asset: a, level: 3, meta: 'Resource · Journey' });
        });
      }
      rows.push({ kind: 'category', key: 'studios', name: 'Studios', level: 2, expanded: expandedNodes.has('studios'), meta: 'Category' });
      if (expandedNodes.has('studios')) {
        ['studio1', 'studio2'].forEach((id) => {
          const a = ASSETS.find((x) => x.id === id);
          rows.push({ kind: 'resource', key: id, asset: a, level: 3, meta: 'Resource · Journey' });
        });
      }
    }
    const fixtureCount = getScalabilityFixtureCount();
    rows.push({
      kind: 'fixture-group', key: 'scalability-review-fixtures',
      name: `Scalability review fixtures (${fmt(fixtureCount)})`, level: 1,
      expanded: scalabilityFixturesExpanded, journey: false,
      meta: scalabilityFixturesExpanded ? 'Generated fixture hierarchy expanded' : 'Generated fixture hierarchy collapsed',
      fixtureCount
    });
    if (!scalabilityFixturesExpanded) return rows;

    const genVenues = {};
    reviewAssets.forEach((a) => {
      if (a.journey) return;
      if (!genVenues[a.venueIdx]) genVenues[a.venueIdx] = { venue: a.venue, resources: [] };
      genVenues[a.venueIdx].resources.push(a);
    });
    Object.keys(genVenues).sort((a, b) => Number(a) - Number(b)).forEach((vk) => {
      const g = genVenues[vk];
      const key = 'gv-' + vk;
      const exp = !!genVenueExpanded[key];
      rows.push({ kind: 'venue', key, name: g.venue, level: 2, expanded: exp, journey: false, meta: 'Venue · generated' });
      if (exp) {
        rows.push({ kind: 'category', key: key + '-halls', name: 'Halls', level: 3, expanded: true, meta: 'Category' });
        g.resources.filter((r) => r.category === 'Halls').forEach((a) => {
          rows.push({ kind: 'resource', key: a.id, asset: a, level: 4, meta: 'Resource · generated' });
        });
        rows.push({ kind: 'category', key: key + '-studios', name: 'Studios', level: 3, expanded: true, meta: 'Category' });
        g.resources.filter((r) => r.category === 'Studios').forEach((a) => {
          rows.push({ kind: 'resource', key: a.id, asset: a, level: 4, meta: 'Resource · generated' });
        });
      }
    });
    return rows;
  }

  function getSearchAssetRows(q) {
    if (isJ3Journey()) return getJ3SearchRows(q);
    const lq = q.toLowerCase().trim();
    return reviewAssets.filter((a) => a.haystack.indexOf(lq) !== -1).map((a) => ({
      kind: 'resource', key: a.id, asset: a, level: 1,
      meta: (a.journey ? a.venue : a.venue + ' · ' + a.category), search: true
    }));
  }

  function getAssetDisplayRows() {
    const q = assetQuery.trim();
    return q ? getSearchAssetRows(q) : getBrowseRows();
  }

  function treeRowId(r) {
    return 'asset-tree-row-' + String(r.key).replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  function syncTreeAria(rows) {
    const rowId = rows[assetActive] ? treeRowId(rows[assetActive]) : '';
    const searchEl = $('#asset-search');
    const treeEl = $('#asset-tree');
    if (assetQuery.trim()) {
      if (rowId) searchEl.setAttribute('aria-activedescendant', rowId);
      else searchEl.removeAttribute('aria-activedescendant');
      treeEl.removeAttribute('aria-activedescendant');
    } else {
      if (rowId) treeEl.setAttribute('aria-activedescendant', rowId);
      else treeEl.removeAttribute('aria-activedescendant');
      searchEl.removeAttribute('aria-activedescendant');
    }
  }

  function renderSelectedStrip() {
    const strip = $('#asset-selected-strip');
    if (!strip) return;
    strip.innerHTML = '';
    selectedAssets.forEach((id) => {
      const a = findJ3Asset(id) || reviewAssets.find((x) => x.id === id) || ASSETS.find((x) => x.id === id);
      if (!a) return;
      const cls = a.color || a.tint || 'violet';
      const label = a.name + (isJ3Journey() || a.journey || a.lane ? '' : ' RF');
      const chip = document.createElement('span');
      chip.className = 'chip ' + cls;
      chip.innerHTML = label + '<button type="button" class="chip-remove" data-unpin="' + id + '" aria-label="Remove ' + a.name + '">×</button>';
      strip.appendChild(chip);
    });
    if (isJ3Journey()) j3RenderLauncherSummary();
    if (isContextualWorkspace()) contextualSyncAssetSummary();
  }

  function scrollTreeActive() {
    const scrollEl = $('#asset-tree');
    const rowH = j3GetTreeRowHeight();
    const top = assetActive * rowH;
    const bottom = top + rowH;
    if (top < scrollEl.scrollTop) scrollEl.scrollTop = top;
    else if (bottom > scrollEl.scrollTop + scrollEl.clientHeight) scrollEl.scrollTop = bottom - scrollEl.clientHeight;
  }

  function toggleResourcePin(id, checked) {
    if (isJ3Journey() && !findJ3Asset(id)) return;
    if (checked) selectedAssets.add(id);
    else selectedAssets.delete(id);
    const a = findJ3Asset(id) || reviewAssets.find((x) => x.id === id) || ASSETS.find((x) => x.id === id);
    if (a) announceLive(a.name + (checked ? ' selected.' : ' removed.'));
    renderAssetTree();
    renderCalendar();
    if (!isJ3Journey() && !stagedSelection && cartLines.length === 0) updateCartUI();
  }

  function openPickerFromFocusedSource(type) {
    if (pickerSuppressFocusOpen) return;
    const inp = getPickerInputEl(type);
    if (!inp || document.activeElement !== inp || pickerOpen) return;
    openPicker(type);
  }

  function setupPickerEvents() {
    ['item', 'package', 'concession'].forEach((type) => {
      const inp = getPickerInputEl(type);
      if (!inp) return;
      inp.addEventListener('focus', () => {
        if (pickerSuppressFocusOpen) return;
        if (!pickerOpen || pickerType !== type) openPicker(type);
      });
      inp.addEventListener('click', () => openPickerFromFocusedSource(type));
      inp.addEventListener('keydown', (e) => handlePickerKeys(e, false));
      const chev = inp.closest('.combobox')?.querySelector('.combo-chev');
      if (chev) chev.addEventListener('click', () => openPicker(type));
    });
    $('#large-data-filter').addEventListener('input', (e) => {
      debounce('pfilter', () => {
        if (!pickerType) return;
        const inp = getPickerInputEl(pickerType);
        if (inp) inp.value = e.target.value;
        pickerQuery = e.target.value;
        filteredPicker = filterCatalog(pickerType, e.target.value);
        pickerActive = 0;
        $('#large-data-picker-list').scrollTop = 0;
        renderPicker();
      });
    });
    $('#large-data-filter').addEventListener('keydown', (e) => handlePickerKeys(e, true));
    $('#large-data-picker-list').addEventListener('scroll', () => renderPicker());
    $('#large-data-listbox').addEventListener('click', (e) => {
      const row = e.target.closest('.picker-row');
      if (!row || row.dataset.idx == null) return;
      commitPicker(Number(row.dataset.idx));
    });
    $('#large-data-picker-backdrop').addEventListener('click', () => closePicker({ restore: true, refocus: true }));
    $('#large-data-picker-cancel').addEventListener('click', () => closePicker({ restore: true, refocus: true }));
    window.addEventListener('resize', () => {
      if (!pickerOpen || !pickerType) return;
      const dialog = getCartItemEditorDialog();
      const stagedPackageEditor = pickerContext === 'package-editor'
        && cartItemEditorTargetsStagedSelection()
        && !!dialog?.open;
      if (stagedPackageEditor) positionStagedPackagePicker();
      else if (!isNarrowViewport()) positionPicker(pickerType);
    });
  }

  function setupAssetExplorerEvents() {
    $('#asset-search').addEventListener('input', (e) => {
      debounce('asset', () => {
        assetQuery = e.target.value;
        assetScroll = 0;
        assetActive = 0;
        renderAssetTree();
      });
    });
    $('#asset-search').addEventListener('keydown', handleAssetSearchKeys);
    $('#asset-tree').addEventListener('scroll', (e) => {
      assetScroll = e.target.scrollTop;
      renderAssetTree();
    });
    $('#asset-tree-viewport').addEventListener('click', handleAssetTreeClick);
    $('#asset-tree').addEventListener('keydown', handleAssetTreeKeys);
    $('#asset-selected-strip').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-unpin]');
      if (!btn) return;
      const chips = Array.from($('#asset-selected-strip').querySelectorAll('[data-unpin]'));
      const successor = chips[chips.indexOf(btn) + 1]?.dataset.unpin || chips[chips.indexOf(btn) - 1]?.dataset.unpin;
      selectedAssets.delete(btn.dataset.unpin);
      renderAssetTree();
      renderCalendar();
      const nextChip = successor ? Array.from($('#asset-selected-strip').querySelectorAll('[data-unpin]')).find((chip) => chip.dataset.unpin === successor) : null;
      if (document.body.dataset.journey === '4') k1Focus.move(nextChip || $('#asset-search'), btn);
    });
    if (isJ3Journey()) setupJ3ExplorerEvents();
  }

  function handleAssetSearchKeys(e) {
    if (e.key === 'Escape') {
      const searchEl = $('#asset-search');
      const hasValue = !!(searchEl && searchEl.value.trim()) || !!assetQuery.trim();
      if (isJ3Journey() && j3IsExplorerOpen()) {
        e.preventDefault();
        e.stopPropagation();
        if (hasValue) {
          assetQuery = '';
          if (searchEl) searchEl.value = '';
          assetActive = 0;
          renderAssetTree();
          searchEl?.focus();
          return;
        }
        j3CloseExplorer();
        return;
      }
      if (hasValue) {
        e.preventDefault();
        assetQuery = '';
        if (searchEl) searchEl.value = '';
        assetActive = 0;
        renderAssetTree();
      }
      return;
    }
    if (!assetQuery.trim()) return;
    const rows = flatAssetRows;
    const n = rows.length;
    if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); assetActive = Math.min(n - 1, assetActive + 1); renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); assetActive = Math.max(0, assetActive - 1); renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'Home') { e.preventDefault(); assetActive = 0; renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'End') { e.preventDefault(); assetActive = n - 1; renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'Enter' || e.key === ' ') {
      const r = rows[assetActive];
      if (r && r.kind === 'resource') { e.preventDefault(); selectedAssets.add(r.asset.id); toggleResourcePin(r.asset.id, true); }
    }
  }

  function handleAssetTreeKeys(e) {
    if (assetQuery.trim()) return;
    const rows = flatAssetRows;
    const n = rows.length;
    if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); assetActive = Math.min(n - 1, assetActive + 1); renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); assetActive = Math.max(0, assetActive - 1); renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'Home') { e.preventDefault(); assetActive = 0; renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'End') { e.preventDefault(); assetActive = n - 1; renderAssetTree(); scrollTreeActive(); }
    else if (e.key === 'ArrowRight') {
      const r = rows[assetActive];
      if (r && r.kind !== 'resource' && !r.expanded) {
        e.preventDefault();
        expandAssetNode(r.key);
        renderAssetTree();
      }
    } else if (e.key === 'ArrowLeft') {
      const r = rows[assetActive];
      if (r && r.kind !== 'resource' && r.expanded) {
        e.preventDefault();
        collapseAssetNode(r.key);
        renderAssetTree();
      }
    } else if (e.key === ' ' || e.key === 'Spacebar') {
      const r = rows[assetActive];
      if (r && r.kind === 'resource') {
        e.preventDefault();
        const id = r.asset.id;
        const t = !selectedAssets.has(id);
        toggleResourcePin(id, t);
      }
    } else if (e.key === 'Enter') {
      const r = rows[assetActive];
      if (!r) return;
      e.preventDefault();
      if (r.kind === 'resource') {
        selectedAssets.add(r.asset.id);
        toggleResourcePin(r.asset.id, true);
      } else {
        toggleAssetExpand(r.key);
        renderAssetTree();
      }
    } else if (e.key === 'Escape' && assetQuery) {
      e.preventDefault();
      assetQuery = '';
      $('#asset-search').value = '';
      renderAssetTree();
    }
  }

  function expandAssetNode(key) {
    if (isJ3Journey()) {
      j3ExpandedNodes.add(key);
      return;
    }
    if (key === 'venue') expandedNodes.add('venue');
    else if (key === 'halls') expandedNodes.add('halls');
    else if (key === 'studios') expandedNodes.add('studios');
    else if (key === 'scalability-review-fixtures') scalabilityFixturesExpanded = true;
    else genVenueExpanded[key] = true;
  }

  function collapseAssetNode(key) {
    if (isJ3Journey()) {
      j3ExpandedNodes.delete(key);
      return;
    }
    if (key === 'venue') expandedNodes.delete('venue');
    else if (key === 'halls') expandedNodes.delete('halls');
    else if (key === 'studios') expandedNodes.delete('studios');
    else if (key === 'scalability-review-fixtures') scalabilityFixturesExpanded = false;
    else genVenueExpanded[key] = false;
  }

  function toggleAssetExpand(key) {
    if (isJ3Journey()) {
      if (j3ExpandedNodes.has(key)) j3ExpandedNodes.delete(key);
      else j3ExpandedNodes.add(key);
      return;
    }
    if (key === 'scalability-review-fixtures') scalabilityFixturesExpanded = !scalabilityFixturesExpanded;
    else if (expandedNodes.has(key)) expandedNodes.delete(key);
    else if (key === 'venue' || key === 'halls' || key === 'studios') expandedNodes.add(key);
    else genVenueExpanded[key] = !genVenueExpanded[key];
  }

  function handleAssetTreeClick(e) {
    const row = e.target.closest('[data-toggle]');
    if (row) {
      toggleAssetExpand(row.dataset.toggle);
      renderAssetTree();
      return;
    }
    const cb = e.target.closest('.tree-check');
    if (cb) {
      toggleResourcePin(cb.dataset.res, cb.checked);
      return;
    }
    const srow = e.target.closest('[data-res]');
    if (srow && !e.target.closest('.tree-check')) {
      const sid = srow.dataset.res;
      selectedAssets.add(sid);
      toggleResourcePin(sid, true);
    }
  }

  function setPhase(phase) {
    draft.phase = phase;
    document.body.dataset.phase = phase;
    updateJourneyUI();
    updatePrimaryAction();
  }

  function minutesFromSlot(slot) {
    return HOUR_START * 60 + slot * 30;
  }

  function minutesToDisplay(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { h, m };
  }

  function selectionFromSlots(assetId, dk, startSlot, endSlotExclusive) {
    const startMinutes = minutesFromSlot(startSlot);
    const endMinutes = minutesFromSlot(endSlotExclusive);
    const durationMinutes = Math.max(30, endMinutes - startMinutes);
    const end = minutesToDisplay(startMinutes + durationMinutes);
    const start = minutesToDisplay(startMinutes);
    return {
      asset: assetId,
      date: dk,
      startH: start.h,
      startM: start.m,
      endDate: dk,
      endH: end.h,
      endM: end.m,
      item: 'community-hall',
      package: 'none',
      concession: 'review-fixture',
      configuration: (CONFIGURATIONS[assetId] || [])[0] || null
    };
  }

  function selectionDurationHours(s) {
    return lineDurationMinutes(s) / 60;
  }

  function formatSelectionTime(h, m) {
    return formatTime(h, m || 0);
  }

  function formatShortDate(d) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  }

  function formatRangeLabel(start) {
    const end = addDays(start, 6);
    const sm = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()}–${end.getDate()} ${sm[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${sm[start.getMonth()]} – ${end.getDate()} ${sm[end.getMonth()]} ${start.getFullYear()}`;
  }

  function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isCheckpointWeek() {
    return dateKey(weekStart) === dateKey(CHECKPOINT_WEEK_START);
  }

  function getWeekDays() {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }

  function timeToSlot(hour, minute) {
    return (hour - HOUR_START) * SLOTS_PER_HOUR + Math.floor(minute / 30);
  }

  function slotToTime(slot) {
    const totalMinutes = HOUR_START * 60 + slot * 30;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return { h, m };
  }

  function formatTime(h, m) {
    return `${String(h).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
  }

  function slotRangeForSelection(sel) {
    const startSlot = timeToSlot(sel.startH, sel.startM || 0);
    const endSlot = timeToSlot(sel.endH, sel.endM || 0);
    return { startSlot, endSlot: Math.max(startSlot + 1, endSlot) };
  }

  function formatSlotDuration(startSlot, endSlotExclusive) {
    const minutes = Math.max(30, (endSlotExclusive - startSlot) * 30);
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours} h ${remainder} min`;
    if (hours) return `${hours} h`;
    return `${minutes} min`;
  }

  function j1DayCount(selection) {
    const start = selection.date.split('-').map(Number);
    const end = (selection.endDate || selection.date).split('-').map(Number);
    return Math.round((Date.UTC(end[0], end[1] - 1, end[2]) - Date.UTC(start[0], start[1] - 1, start[2])) / 86400000) + 1;
  }

  function j1MultiDay(selection) {
    return ['1', '12'].includes(document.body.dataset.journey) && !!selection?.j1DailyRectangle && j1DayCount(selection) > 1;
  }

  function j1SelectionIncludesDate(selection, dk) {
    return selection.date === dk || (j1MultiDay(selection) && dk >= selection.date && dk <= selection.endDate);
  }

  function j1DailyDateSpan(selection) {
    const start = new Date(`${selection.date}T12:00:00`);
    const end = new Date(`${selection.endDate || selection.date}T12:00:00`);
    const first = formatShortDate(start);
    const last = formatShortDate(end);
    return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
      ? `${first.split(' ').slice(0, 2).join(' ')}–${last}` : `${first}–${last}`;
  }

  function j1DailyDescription(selection) {
    const hours = (slotRangeForSelection(selection).endSlot - slotRangeForSelection(selection).startSlot) * j1DayCount(selection) / 2;
    return `${j1DailyDateSpan(selection)} · ${formatSelectionTime(selection.startH, selection.startM)}–${formatSelectionTime(selection.endH, selection.endM)} daily · ${j1DayCount(selection)} days · ${hours} hour${hours === 1 ? '' : 's'} · local review fixture`;
  }

  function j1VisualSelection(assetId) {
    if (dragState?.j1Rectangle && dragState.asset === assetId) {
      const start = slotToTime(dragState.startSlot);
      const end = slotToTime(dragState.endSlot + 1);
      return { asset: assetId, date: dragState.startDate, endDate: dragState.endDate, startH: start.h, startM: start.m, endH: end.h, endM: end.m, j1DailyRectangle: true };
    }
    return stagedSelection?.asset === assetId ? stagedSelection : null;
  }

  function activeColumnRange(assetId, dk) {
    if (dragState && dragState.asset === assetId && dragState.j1Rectangle) {
      return dk >= dragState.startDate && dk <= dragState.endDate
        ? { startSlot: dragState.startSlot, endSlot: dragState.endSlot + 1 }
        : null;
    }
    if (dragState && dragState.asset === assetId && dragState.date === dk) {
      const startSlot = Math.min(dragState.startSlot, dragState.endSlot);
      return { startSlot, endSlot: Math.max(startSlot + 1, Math.max(dragState.startSlot, dragState.endSlot) + 1) };
    }
    if (stagedSelection && stagedSelection.asset === assetId && j1SelectionIncludesDate(stagedSelection, dk)) {
      return slotRangeForSelection(stagedSelection);
    }
    return null;
  }

  function isGenericColumnCrosshairRoute() {
    // One Calendar candidate: the Journey 12 hover time line, time label, day column and time row on every calendar journey.
    const journey = document.body.dataset.journey;
    if (journey === '2') return j2InteractiveGrid() && j2State.mode === 'booking';
    if (journey === '13' || journey === '15') return false;
    if (isJ4Journey() && j4ActionsBlocked()) return false;
    return slotLayout === 'column';
  }

  // One Calendar candidate: Journey 12 pointer selection (incl. touch) wherever the journey already selects free time.
  // Journey 10 keeps its own one-cell Block selection, Journey 11 its notes behaviour, Journey 6 has no free-time selection.
  function isOneCalendarPointerRoute() {
    return ['1', '3', '4', '5', '7', '8', '9', '12'].includes(document.body.dataset.journey);
  }

  function oneCalendarSelectionBlocked() {
    return document.body.dataset.journey === '6' || (isJ4Journey() && j4ActionsBlocked());
  }

  function clearColumnCrosshair() {
    const grid = $('#calendar-grid');
    if (grid) {
      grid.querySelectorAll('.crosshair-row, .crosshair-column, .crosshair-intersection, .crosshair-lane, .crosshair-gutter').forEach((node) => {
        node.classList.remove('crosshair-row', 'crosshair-column', 'crosshair-intersection', 'crosshair-lane', 'crosshair-gutter');
        if (node.dataset.crosshairOriginal !== undefined) {
          node.textContent = node.dataset.crosshairOriginal;
          delete node.dataset.crosshairOriginal;
        }
      });
    }
    hoverCrosshair = null;
  }

  function applyColumnCrosshair(assetId, dk, slot) {
    if (!isGenericColumnCrosshairRoute()) {
      clearColumnCrosshair();
      return;
    }
    const grid = $('#calendar-grid');
    if (!grid) return;
    clearColumnCrosshair();
    const laneColumns = grid.querySelectorAll(`.cal-day-col[data-asset="${assetId}"]`);
    laneColumns.forEach((col) => {
      col.classList.add('crosshair-lane');
      const rowSlot = col.querySelector(`.cal-slot[data-slot="${slot}"]`);
      if (rowSlot) rowSlot.classList.add('crosshair-row');
    });
    grid.querySelectorAll(`.cal-day-col[data-date="${dk}"]`).forEach((col) => col.classList.add('crosshair-column'));
    grid.querySelectorAll(`.cal-day-header[data-date="${dk}"]`).forEach((header) => header.classList.add('crosshair-column'));
    const currentCol = grid.querySelector(`.cal-day-col[data-asset="${assetId}"][data-date="${dk}"]`);
    const currentBody = currentCol ? currentCol.closest('.cal-lane-body') : null;
    if (currentBody) {
      currentBody.classList.add('crosshair-lane');
      const gutter = currentBody.querySelector(`.cal-time-gutter .time-label[data-slot="${slot}"]`);
      if (gutter) {
        gutter.dataset.crosshairOriginal = gutter.textContent;
        gutter.textContent = formatTime(slotToTime(slot).h, slotToTime(slot).m);
        gutter.classList.add('crosshair-gutter');
      }
    }
    const intersection = currentCol ? currentCol.querySelector(`.cal-slot[data-slot="${slot}"]`) : null;
    if (intersection) intersection.classList.add('crosshair-intersection');
    hoverCrosshair = { assetId, date: dk, slot };
  }

  function refreshColumnSelectionDom(assetId, dk) {
    if (slotLayout !== 'column') return;
    const col = document.querySelector(`.cal-day-col[data-asset="${assetId}"][data-date="${dk}"]`);
    if (!col) return;
    const range = activeColumnRange(assetId, dk);
    col.querySelectorAll('.cal-slot').forEach((slotEl) => {
      const slot = Number(slotEl.dataset.slot);
      const selected = !!range && slot >= range.startSlot && slot < range.endSlot;
      slotEl.classList.toggle('selected-range', selected);
      slotEl.classList.toggle('range-start', selected && slot === range.startSlot);
      slotEl.classList.toggle('range-end', selected && slot === range.endSlot - 1);
      slotEl.setAttribute('aria-selected', String(selected));
    });
    refreshColumnRangeLabel(assetId, dk);
  }

  function renderColumnRangeLabel(col, assetId, dk, slotH) {
    if (slotLayout !== 'column') return;
    const range = activeColumnRange(assetId, dk);
    if (!range) return;
    if (document.body.dataset.journey === '1') {
      const selection = j1VisualSelection(assetId);
      const primary = dk === (selection?.endDate || selection?.date);
      const multi = selection && j1DayCount(selection) > 1;
      const start = slotToTime(range.startSlot);
      const end = slotToTime(range.endSlot);
      const band = document.createElement('div');
      band.className = `j1-selection-band ${primary ? 'is-primary' : 'is-secondary'}`;
      band.classList.toggle('is-short', range.endSlot - range.startSlot < 5);
      band.classList.toggle('is-multiday', multi);
      if (!primary) band.setAttribute('aria-hidden', 'true');
      band.style.top = `${range.startSlot * slotH}px`;
      band.style.height = `${(range.endSlot - range.startSlot) * slotH}px`;
      if (primary) {
        const label = document.createElement('span');
        label.className = 'timeslot-context-label';
        label.setAttribute('aria-hidden', 'true');
        label.dataset.rangeStart = String(range.startSlot);
        label.dataset.rangeEnd = String(range.endSlot);
        if (multi) {
          const dates = document.createElement('span');
          dates.className = 'j1-selection-dates';
          dates.textContent = j1DailyDateSpan(selection);
          label.appendChild(dates);
        }
        const time = document.createElement('span');
        time.className = 'timeslot-context-label-time';
        time.textContent = `${formatTime(start.h, start.m)}–${formatTime(end.h, end.m)}${multi ? ' daily' : ` · ${formatSlotDuration(range.startSlot, range.endSlot)}`}`;
        label.appendChild(time);
        if (multi) {
          const total = document.createElement('span');
          total.className = 'j1-selection-total';
          const hours = (range.endSlot - range.startSlot) * j1DayCount(selection) / 2;
          total.textContent = `${j1DayCount(selection)} days · ${hours} h`;
          label.appendChild(total);
        }
        const booking = document.createElement('strong');
        booking.className = 'j1-selection-title';
        booking.textContent = 'New booking';
        const resource = document.createElement('span');
        resource.className = 'j1-selection-resource';
        resource.textContent = ASSETS.find((asset) => asset.id === assetId)?.name || assetId;
        label.append(booking, resource);
        band.appendChild(label);
        for (const corner of ['tl', 'tr', 'bl']) {
          const marker = document.createElement('span');
          marker.className = `j1-selection-handle is-${corner}`;
          marker.setAttribute('aria-hidden', 'true');
          band.appendChild(marker);
        }
        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'j1-selection-handle is-br';
        handle.setAttribute('aria-label', `Resize ${resource.textContent} daily selection, ending ${formatShortDate(new Date(`${dk}T12:00:00`))} ${formatTime(end.h, end.m)}. Drag or use arrow keys to change end date and time.`);
        handle.addEventListener('pointerdown', (event) => j1StartPointerDrag(event, assetId, dk, range.startSlot, true));
        handle.addEventListener('keydown', j1HandleKeydown);
        handle.addEventListener('click', (event) => event.stopPropagation());
        band.appendChild(handle);
      } else {
        const day = document.createElement('span');
        day.className = 'j1-band-day';
        day.textContent = formatShortDate(new Date(`${dk}T12:00:00`));
        day.setAttribute('aria-hidden', 'true');
        band.appendChild(day);
      }
      col.appendChild(band);
      return;
    }
    const start = slotToTime(range.startSlot);
    const end = slotToTime(range.endSlot);
    const label = document.createElement('div');
    label.className = 'timeslot-context-label';
    label.setAttribute('aria-hidden', 'true');
    label.dataset.rangeStart = String(range.startSlot);
    label.dataset.rangeEnd = String(range.endSlot);
    label.style.top = `${Math.max(2, range.startSlot * slotH + 2)}px`;
    const time = document.createElement('span');
    time.className = 'timeslot-context-label-time';
    time.textContent = `${formatTime(start.h, start.m)} – ${formatTime(end.h, end.m)}`;
    const duration = document.createElement('span');
    duration.className = 'timeslot-context-label-duration';
    duration.textContent = `Duration · ${formatSlotDuration(range.startSlot, range.endSlot)}`;
    label.append(time, duration);
    col.appendChild(label);
    const lowerBound = 2;
    const requestedTop = Math.max(lowerBound, range.startSlot * slotH + lowerBound);
    // One Calendar candidate: keep the card inside its column only once the column is laid out (it has no height while the
    // calendar is still being built off screen, which used to force the card to the top of the lane).
    const placeInside = () => {
      const maxTop = Math.max(lowerBound, col.clientHeight - label.offsetHeight - lowerBound);
      label.style.top = `${Math.min(requestedTop, maxTop)}px`;
    };
    if (col.isConnected && col.clientHeight) placeInside();
    else {
      label.style.top = `${requestedTop}px`;
      requestAnimationFrame(() => { if (label.isConnected && col.clientHeight) placeInside(); });
    }
  }

  function refreshColumnRangeLabel(assetId, dk) {
    if (slotLayout !== 'column') return;
    const col = document.querySelector(`.cal-day-col[data-asset="${assetId}"][data-date="${dk}"]`);
    if (!col) return;
    col.querySelectorAll('.j1-selection-band, .timeslot-context-label').forEach((label) => label.remove());
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');
    renderColumnRangeLabel(col, assetId, dk, slotH);
  }

  function getEventAtSlot(assetId, dk, slot) {
    for (const ev of EVENTS) {
      if (ev.asset !== assetId || ev.date !== dk) continue;
      if (ev.allDay) return ev;
      const startSlot = timeToSlot(ev.start, 0);
      const endSlot = timeToSlot(ev.end, 0);
      if (slot >= startSlot && slot < endSlot) return ev;
    }
    return null;
  }

  function isOccupiedEvent(ev) {
    return ev && (ev.type === 'confirmed' || ev.type === 'quotation' || ev.type === 'block');
  }

  function isSlotOccupied(assetId, dk, slot) {
    const ev = getEventAtSlot(assetId, dk, slot);
    if (ev) return true;
    for (const line of cartLines) {
      if (line.id === editingLineId) continue;
      if (line.asset !== assetId || !j1SelectionIncludesDate(line, dk)) continue;
      const range = slotRangeForSelection(line);
      if (slot >= range.startSlot && slot < range.endSlot) return true;
    }
    if (stagedSelection && !editingLineId) {
      const s = stagedSelection;
      if (s.asset === assetId && j1SelectionIncludesDate(s, dk)) {
        const range = slotRangeForSelection(s);
        if (slot >= range.startSlot && slot < range.endSlot) return true;
      }
    }
    if (draft.created) {
      const c = draft.created;
      if (c.asset === assetId && j1SelectionIncludesDate(c, dk)) {
        const range = slotRangeForSelection(c);
        if (slot >= range.startSlot && slot < range.endSlot) return true;
      }
    }
    return false;
  }

  // An all-free daily rectangle is a local fixture preview, not a server availability policy.
  function j1RectangleIsFree(assetId, startDate, endDate, startSlot, endSlotExclusive) {
    const days = getWeekDays().map(dateKey);
    const from = days.indexOf(startDate);
    const to = days.indexOf(endDate);
    if (!isCheckpointWeek() || from < 0 || to < from || endSlotExclusive <= startSlot || startSlot < 0 || endSlotExclusive > 24) return false;
    for (let index = from; index <= to; index++) {
      const dk = days[index];
      for (let slot = startSlot; slot < endSlotExclusive; slot++) {
        const hour = slotToTime(slot).h;
        if (!FREE_SLOTS.some((entry) => entry.asset === assetId && entry.date === dk && hour >= entry.start && hour < entry.end)) return false;
        if (getEventAtSlot(assetId, dk, slot)) return false;
        if (cartLines.some((line) => line.id !== editingLineId && line.asset === assetId && j1SelectionIncludesDate(line, dk) && slot >= slotRangeForSelection(line).startSlot && slot < slotRangeForSelection(line).endSlot)) return false;
        if (draft.created && draft.created.asset === assetId && j1SelectionIncludesDate(draft.created, dk) && slot >= slotRangeForSelection(draft.created).startSlot && slot < slotRangeForSelection(draft.created).endSlot) return false;
      }
    }
    return true;
  }

  function isFreeSlot(assetId, dk, slot) {
    if (!isCheckpointWeek()) return false;
    const { h } = slotToTime(slot);
    for (const fs of FREE_SLOTS) {
      if (fs.asset !== assetId || fs.date !== dk) continue; // One Calendar: the same free intervals as Journey 12 on every journey
      if (h >= fs.start && h < fs.end) {
        if (!isSlotOccupied(assetId, dk, slot)) return true;
      }
    }
    return false;
  }

  function getFixtureFreeRange(assetId, dk, slot) {
    for (const fs of FREE_SLOTS) {
      if (fs.asset !== assetId || fs.date !== dk) continue; // One Calendar: the same free intervals as Journey 12 on every journey
      const startSlot = timeToSlot(fs.start, 0);
      const endSlot = timeToSlot(fs.end, 0);
      if (slot >= startSlot && slot < endSlot) {
        return { startSlot, endSlot };
      }
    }
    return { startSlot: slot, endSlot: slot + 1 };
  }

  function isInCart(assetId, dk, slot) {
    for (const line of cartLines) {
      if (line.asset !== assetId || !j1SelectionIncludesDate(line, dk)) continue;
      const range = slotRangeForSelection(line);
      if (slot >= range.startSlot && slot < range.endSlot) return true;
    }
    return false;
  }

  function isCreatedSlot(assetId, dk, slot) {
    if (!draft.created) return false;
    const c = draft.created;
    if (c.asset !== assetId || !j1SelectionIncludesDate(c, dk)) return false;
    const range = slotRangeForSelection(c);
    return slot >= range.startSlot && slot < range.endSlot;
  }

  function showToast(msg, duration) {
    const region = $('#toast-region');
    placeToastRegion(region);
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    region.appendChild(el);
    setTimeout(() => {
      el.remove();
      if (!region.querySelector('.toast')) placeToastRegion(region, true);
    }, duration || 3500);
  }

  // One Calendar candidate (conditional Gate A item 2): on phone and tablet the notification sits just above the Cart's
  // sticky Add another / Book buttons (or the collapsed Cart bar at the bottom of a phone), never on top of them.
  function placeToastRegion(region, reset) {
    ['bottom', 'left', 'max-width'].forEach((p) => region.style.removeProperty(p));
    if (reset || window.innerWidth > 1100) return;
    const bars = [...document.querySelectorAll('.booking-cart .cart-sticky-actions, #sheet-handle')]
      .filter((el) => !el.closest('[hidden]'))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0)
      .filter((r, i, all) => all.length === 1 || r.bottom >= window.innerHeight - 40);
    if (!bars.length) return;
    const bar = bars.reduce((a, b) => (b.top < a.top ? b : a));
    region.style.bottom = `${Math.round(window.innerHeight - bar.top + 8)}px`;
    region.style.left = `${Math.round(bar.left + bar.width / 2)}px`;
    region.style.maxWidth = `${Math.max(200, Math.round(bar.width - 16))}px`;
  }

  function announceAlert(msg) {
    const region = $('#alert-region');
    region.textContent = '';
    setTimeout(() => { region.textContent = msg; }, 50);
  }

  function setStage(stage) {
    document.body.dataset.stage = stage;
    $$('.stage-chip').forEach((btn) => {
      btn.setAttribute('aria-current', btn.dataset.stageTarget === stage ? 'true' : 'false');
    });
  }

  function getPrimaryContext() {
    if (draft.phase === 'unavailable') return 'unavailable';
    if (draft.phase === 'success') return 'journey';
    if (stagedSelection && editingLineId) return 'edit';
    if (stagedSelection) return 'add';
    if (cartLines.length > 0) return 'another';
    return 'empty';
  }

  function updatePrimaryAction() {
    const btn = $('#cart-primary-action');
    if (isJourney9Route()) {
      btn.hidden = true;
      btn.disabled = true;
      btn.inert = true;
      btn.setAttribute('aria-hidden', 'true');
      return;
    }
    const ctx = getPrimaryContext();
    btn.className = 'btn-primary';
    btn.disabled = false;
    btn.hidden = draft.phase === 'success';

    switch (ctx) {
      case 'empty':
        btn.textContent = 'Select a time';
        break;
      case 'add': {
        btn.textContent = 'Add to cart';
        const item = getCommitted('item');
        const pkg = getCommitted('package');
        btn.disabled = isJourney7Route()
          ? !j7IsAcceptedGraph(stagedSelection).ok
          : !isCompatible(item, pkg) || !isJourneyItem(item) || !isJourneyPackage(pkg) || !getStagedPackageState(false).valid;
        break;
      }
      case 'edit': {
        btn.textContent = 'Update item';
        const item = getCommitted('item');
        const pkg = getCommitted('package');
        btn.disabled = isJourney7Route()
          ? !j7IsAcceptedGraph(stagedSelection).ok
          : !isCompatible(item, pkg) || !isJourneyItem(item) || !isJourneyPackage(pkg) || !getStagedPackageState(false).valid;
        break;
      }
      case 'another':
        btn.textContent = 'Add another';
        if (isJourney7Route()) btn.disabled = true;
        break;
      case 'unavailable':
        btn.textContent = 'Choose an available time';
        if (isJourney7Route()) btn.disabled = true;
        break;
      case 'journey':
        btn.hidden = true;
        break;
      default:
        break;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function configurationLabel(id) {
    return compactOptionLabel(CONFIGURATION_LABELS[id] || id || 'Not set');
  }

  function lineDurationMinutes(line) {
    if (j1MultiDay(line)) {
      const range = slotRangeForSelection(line);
      return (range.endSlot - range.startSlot) * 30 * j1DayCount(line);
    }
    const start = new Date(`${line.date}T${pad(line.startH, 2)}:${pad(line.startM, 2)}:00`);
    const endDate = line.endDate || line.date;
    const end = new Date(`${endDate}T${pad(line.endH, 2)}:${pad(line.endM, 2)}:00`);
    return Math.max(0, Math.round((end - start) / 60000));
  }

  function dateTimeValue(date, hour, minute) {
    return new Date(`${date}T${pad(hour, 2)}:${pad(minute, 2)}:00`);
  }

  function splitTime(value) {
    const parts = String(value || '00:00').split(':').map(Number);
    return { h: parts[0] || 0, m: parts[1] || 0 };
  }

  function toDateAndTime(date) {
    return {
      date: dateKey(date),
      time: `${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}`
    };
  }

  function lineInterval(line) {
    return {
      start: dateTimeValue(line.date, line.startH, line.startM),
      end: dateTimeValue(line.endDate || line.date, line.endH, line.endM)
    };
  }

  function candidateFromParts(line, startDate, startTime, endDate, endTime) {
    const st = splitTime(startTime);
    const et = splitTime(endTime);
    return {
      ...line,
      date: startDate,
      startH: st.h,
      startM: st.m,
      endDate: endDate,
      endH: et.h,
      endM: et.m
    };
  }

  function checkCandidateAvailability(candidate, ignoredIds) {
    const interval = lineInterval(candidate);
    if (!(interval.end > interval.start)) {
      return { ok: false, kind: 'validation', message: 'End Date and Time must be later than Start Date and Time.' };
    }
    const asset = ASSETS.find((a) => a.id === candidate.asset);
    const event = EVENTS.find((ev) => {
      if (ev.asset !== candidate.asset) return false;
      const evStart = ev.allDay ? new Date(`${ev.date}T00:00:00`) : dateTimeValue(ev.date, ev.start, 0);
      const evEnd = ev.allDay ? new Date(`${ev.date}T23:59:59`) : dateTimeValue(ev.date, ev.end, 0);
      return interval.start < evEnd && interval.end > evStart;
    });
    if (event) return { ok: false, kind: 'availability', message: `Unavailable — ${event.title} occupies ${asset.name}. No create override is assumed.` };
    const cartConflict = cartLines.find((line) => {
      if (ignoredIds.has(line.id) || line.asset !== candidate.asset) return false;
      const other = lineInterval(line);
      return interval.start < other.end && interval.end > other.start;
    });
    if (cartConflict) return { ok: false, kind: 'availability', message: `Unavailable — overlaps another staged ${asset.name} Cart line.` };
    return { ok: true, kind: 'available', message: `Available — ${asset.name} review fixture. Pricing will be recalculated before confirmation.` };
  }

  function renderCallerContext() {
    const params = new URLSearchParams(window.location.search);
    const entries = [
      ['Event', params.get('event')],
      ['Reference', params.get('reference')],
      ['Customer', params.get('customer')],
      ['Contact', params.get('contact')]
    ].filter((entry) => entry[1]);
    const section = $('#caller-context');
    section.hidden = entries.length === 0;
    if (!entries.length) return;
    $('#caller-context-summary').textContent = entries.map((entry) => entry[1]).join(' · ');
    $('#caller-context-details').innerHTML = entries.map((entry) => `<div><dt>${entry[0]}</dt><dd>${escapeHtml(entry[1])}</dd></div>`).join('');
  }

  function packageMeta(id) {
    return PACKAGES[id] || { label: getPackageRecord(id).label, type: 'none', includedItems: [] };
  }

  function renderStagedPackageFields() {
    const host = $('#package-conditional');
    if (!host) return;
    const meta = packageMeta(getCommitted('package'));
    host.hidden = meta.type === 'none';
    if (meta.type === 'none') {
      host.innerHTML = '';
      return;
    }
    const fieldLabel = meta.type === 'quantity' ? 'Quantity' : 'Attendees';
    const inputId = meta.type === 'quantity' ? 'cfg-package-quantity' : 'cfg-package-attendees';
    const selectedIncluded = new Set(stagedSelection?.includedItems || meta.includedItems || []);
    host.innerHTML = `
      <div class="field package-value-field">
        <label for="${inputId}">${fieldLabel}</label>
        <input type="number" id="${inputId}" min="${meta.min}" max="${meta.max}" placeholder="${meta.min}–${meta.max}" required>
        <p class="field-caption quiet">${fieldLabel} ${meta.min}–${meta.max} for this review Package fixture; no universal default.</p>
      </div>
      <fieldset class="included-items compact-included-items">
        <legend>Included Package Items</legend>
        ${(meta.includedItems || []).map((id) => `<label><input type="checkbox" data-staged-included="${id}" ${selectedIncluded.has(id) ? 'checked' : ''}> ${escapeHtml(getItemRecord(id).label)}</label>`).join('')}
      </fieldset>`;
    const valueInput = host.querySelector('input[type="number"]');
    if (valueInput) {
      const stagedValue = meta.type === 'quantity' ? stagedSelection?.packageQuantity : stagedSelection?.packageAttendees;
      if (stagedValue != null) valueInput.value = String(stagedValue);
      valueInput.addEventListener('input', () => {
        valueInput.removeAttribute('aria-invalid');
        updatePrimaryAction();
        renderCurrentSelectionSummary();
      });
    }
  }

  function getStagedPackageState(showErrors) {
    const meta = packageMeta(getCommitted('package'));
    const includedItems = new Set(Array.from($$('[data-staged-included]:checked')).map((el) => el.dataset.stagedIncluded));
    let quantity = null;
    let attendees = null;
    let valid = true;
    let input = null;
    if (meta.type === 'quantity') {
      input = $('#cfg-package-quantity');
      quantity = input && input.value !== '' ? Number(input.value) : null;
      valid = Number.isFinite(quantity) && quantity >= meta.min && quantity <= meta.max;
    } else if (meta.type === 'attendees') {
      input = $('#cfg-package-attendees');
      attendees = input && input.value !== '' ? Number(input.value) : null;
      valid = Number.isFinite(attendees) && attendees >= meta.min && attendees <= meta.max;
    }
    if (showErrors && !valid && input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      announceAlert(`${meta.type === 'quantity' ? 'Quantity' : 'Attendees'} must be between ${meta.min} and ${meta.max} for the selected review Package.`);
    }
    return { valid, quantity, attendees, includedItems };
  }

  function getDisplayLines() {
    return cartLines;
  }

  function projectCartRuntime(lines = cartLines) {
    const actualLines = Array.isArray(lines) ? lines : [];
    const count = actualLines.length;
    const pendingLines = actualLines.filter((line) => line.amountPending === true);
    const pricedLines = actualLines.filter((line) => line.amountPending !== true && Number.isFinite(line.amount));
    const pendingCount = pendingLines.length;
    const readyCount = count - pendingCount;
    const attentionCount = pendingCount;
    const total = pricedLines.reduce((sum, line) => sum + line.amount, 0);
    const formattedTotal = document.body.dataset.journey === '1' && count > 0 && pendingCount === count && actualLines.some(j1MultiDay)
      ? 'Quote pending' : `AU$ ${total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const itemLabel = count === 1 ? '1 item' : `${count} items`;
    return {
      lines: actualLines,
      count,
      itemLabel,
      summaryItemLabel: count === 1 ? '1 Item' : `${count} Items`,
      cartItemLabel: `${count} Cart ${count === 1 ? 'item' : 'items'}`,
      bookLabel: count === 1 ? 'Book 1 item ›' : `Book ${count} items ›`,
      pendingLines,
      pendingCount,
      pricedLines,
      readyCount,
      attentionCount,
      statusLabel: `${readyCount} Ready / ${attentionCount} Attention`,
      total,
      formattedTotal,
      totalKindLabel: pendingCount > 0 ? 'Priced subtotal' : 'Priced total',
      footerTotalLabel: pendingCount === 0
        ? 'Cart price total'
        : `Priced subtotal · ${pendingCount} ${pendingCount === 1 ? 'price' : 'prices'} pending`
    };
  }

  function setCartViewMode(mode) {
    if (mode !== 'compact' && mode !== 'detailed') return;
    const scroll = $('#items-scroll');
    const prevScroll = scroll ? scroll.scrollTop : 0;
    cartViewMode = mode;
    const cartBody = $('#cart-body');
    if (cartBody) cartBody.dataset.cartView = mode;
    const compactBtn = $('#cart-view-compact');
    const detailedBtn = $('#cart-view-detailed');
    if (compactBtn) compactBtn.setAttribute('aria-pressed', mode === 'compact' ? 'true' : 'false');
    if (detailedBtn) detailedBtn.setAttribute('aria-pressed', mode === 'detailed' ? 'true' : 'false');
    if (scroll) scroll.scrollTop = prevScroll;
  }

  function buildStressCartLines(count) {
    const resources = ['hall1', 'studio2', 'hall2', 'studio1'];
    const lines = [];
    for (let i = 0; i < count; i++) {
      const n = i + 1;
      const g = Math.min(2, Math.floor(i / 10));
      const hour = 8 + (i % 10);
      const assetId = resources[i % resources.length];
      lines.push({
        id: 'line-stress-' + n,
        asset: assetId,
        date: '2026-08-29',
        startH: hour,
        startM: 0,
        endH: Math.min(20, hour + 2),
        endM: 0,
        item: 'community-hall',
        package: i % 2 ? 'private-day' : 'none',
        packageQuantity: null,
        packageAttendees: i % 2 ? 25 : null,
        includedItems: i % 2 ? ['community-hall'] : [],
        concession: 'review-fixture',
        configuration: CONFIGURATIONS[assetId][0],
        allocationMode: i % 3 === 0 ? 'all' : (i % 3 === 1 ? 'multiple' : 'single'),
        isUnallocated: n === 3,
        allocationSelected: false,
        amountPending: n > 1,
        amount: 2750,
        priceStatus: n > 1 ? 'Pending · review fixture' : 'Calculated · review fixture',
        pricingOption: 'standard',
        priceMode: 'default',
        priceType: 'standard-rate',
        pricingUnit: 'hour',
        groupIndex: g,
        lineNumber: n,
        hasMoreTimeslots: n % 10 === 0
      });
    }
    return lines;
  }

  function updateJourneyUI() {
    const phase = draft.phase;
    if (isJourney9Route()) {
      const success = $('#cart-success');
      const confirm = $('#confirm-booking-btn');
      const helper = $('#confirm-helper');
      if (success) { success.hidden = true; success.inert = true; success.setAttribute('aria-hidden', 'true'); }
      if (confirm) { confirm.hidden = true; confirm.disabled = true; confirm.inert = true; confirm.setAttribute('aria-hidden', 'true'); }
      if (helper) { helper.hidden = true; helper.inert = true; helper.setAttribute('aria-hidden', 'true'); }
      draft.created = null;
      document.body.dataset.created = 'false';
      return;
    }
    $('#cart-success').hidden = phase !== 'success';
    $('#cart-unavailable').hidden = phase !== 'unavailable';

    const confirmBtn = $('#confirm-booking-btn');
    const helper = $('#confirm-helper');
    const j7BookReady = !isJourney7Route() || (cartLines.length === 1 && j7LineMatchesAcceptedGraph(cartLines[0]));
    const bookReady = j7BookReady && !cartLines.some(j1MultiDay) && cartLines.length >= 1 && !stagedSelection && !editingLineId &&
      ['select', 'configure', 'cart'].includes(phase);
    confirmBtn.hidden = !bookReady;
    confirmBtn.disabled = !bookReady;
    helper.hidden = !bookReady;

    const saveStatus = $('#cart-save-status');
    const sheetStatus = $('#sheet-status');
    if (draft.created) {
      saveStatus.textContent = 'Created — local fixture';
      saveStatus.classList.add('is-created');
      sheetStatus.textContent = 'Created';
      document.body.dataset.created = 'true';
    } else {
      saveStatus.textContent = 'Not saved';
      saveStatus.classList.remove('is-created');
      sheetStatus.textContent = 'Not saved';
      document.body.dataset.created = 'false';
    }
  }

  function updateCartUI() {
    const projection = projectCartRuntime();
    const count = projection.count;
    selectedLineIds = new Set(Array.from(selectedLineIds).filter((id) => projection.lines.some((line) => line.id === id)));
    if (draft.stressCount !== null && draft.stressCount !== count) {
      draft.stressCount = null;
      $$('.stress-btn').forEach((button) => button.classList.remove('active'));
    }
    const hasSelection = !!stagedSelection;
    const isEditing = !!editingLineId;
    const phase = draft.phase;

    document.body.dataset.lines = String(count);
    document.body.dataset.hasSelection = hasSelection ? 'true' : 'false';
    document.body.dataset.editing = isEditing ? 'true' : 'false';
    document.body.dataset.stress = draft.stressCount === count ? String(count) : '';

    $('#cart-count').textContent = isJourney9Route() ? (hasSelection ? '1 staged selection' : 'No staged selection') : projection.itemLabel;
    $('#sheet-count').textContent = isJourney9Route() ? (hasSelection ? '1' : '0') : String(count);
    const cartToolbar = $('#cart-toolbar');
    const confirmBookBtn = $('#confirm-booking-btn');
    const selectedCount = selectedLineIds.size;
    if (isJourney9Route()) {
      const clear = $('#clear-cart-btn');
      if (clear) { clear.hidden = true; clear.disabled = true; clear.inert = true; clear.setAttribute('aria-hidden', 'true'); }
      if (cartToolbar) { cartToolbar.hidden = true; cartToolbar.inert = true; cartToolbar.setAttribute('aria-hidden', 'true'); }
      if (confirmBookBtn) { confirmBookBtn.hidden = true; confirmBookBtn.disabled = true; confirmBookBtn.inert = true; confirmBookBtn.setAttribute('aria-hidden', 'true'); }
      $('#cart-amount-context').hidden = true;
      $('#cart-added-items').hidden = true;
      $('#cart-bulk-actions').hidden = true;
      $('#selected-lines-count').hidden = true;
    } else {
      $('#clear-cart-btn').hidden = count === 0 && !hasSelection;
      if (cartToolbar) cartToolbar.hidden = count === 0 && !hasSelection;
      if (confirmBookBtn) confirmBookBtn.textContent = projection.bookLabel;
      $('#selected-lines-count').textContent = `${selectedCount} selected`;
      $('#selected-lines-count').hidden = selectedCount === 0;
      $('#cart-bulk-actions').hidden = selectedCount < 2;
      $('#bulk-time-btn').disabled = selectedCount < 2;
      $('#bulk-config-btn').disabled = selectedCount < 2;
    }

    $('#cart-empty-guidance').hidden = hasSelection || count > 0 || phase !== 'select';
    $('#cart-current-selection').hidden = !hasSelection || phase === 'unavailable';
    $('#cart-added-items').hidden = count === 0;
    $('#cart-hint').hidden = hasSelection || count === 0;
    $('#cart-amount-context').hidden = count === 0 && !hasSelection;

    if (!hasSelection && count === 0) {
      const primary = ASSETS.find((a) => selectedAssets.has(a.id)) || ASSETS[0];
      $('#cart-empty-sub').textContent = `${primary.name} · ${primary.venue}`;
    }

    if (hasSelection) {
      $('#current-selection-title').textContent = isEditing ? 'Editing item' : 'New selection';
    }
    syncCurrentSelectionDisclosure();

    if (phase === 'unavailable' && draft.unavailableSelection) {
      const u = draft.unavailableSelection;
      const asset = ASSETS.find((a) => a.id === u.asset);
      $('#unavailable-detail').textContent =
        `${asset.name} · ${formatShortDate(new Date(u.date + 'T12:00:00'))} · ${u.label || 'Occupied interval'}`;
    }

    renderCartLines();
    renderCartTotals();
    updateConfigureForm();
    updatePrimaryAction();
    updateJourneyUI();
    positionCartForViewport();
    contextualRefreshFromCart();
    j7SyncRouteState();
  }

  function renderCartTotals() {
    const projection = projectCartRuntime(getDisplayLines());
    const lines = projection.lines;
    const displayCount = projection.count;
    const summaryCopy = $('#summary-copy');
    const summaryValue = $('#summary-value');
    const el = $('#cart-totals');
    const amountSection = $('#cart-amount-context');

    const summaryControls = $('#cart-view-controls');
    const cartToolbar = $('#cart-toolbar');
    const summaryBlocks = $('#cart-high-volume-summaries');
    const columnHead = $('#cart-column-head');
    const itemCountEl = $('#cart-summary-item-count');
    const totalLabelEl = $('#cart-summary-total-label');
    const totalValueEl = $('#cart-summary-total-value');
    const statusCountEl = $('#cart-summary-status-count');

    if (itemCountEl) itemCountEl.textContent = projection.summaryItemLabel;
    if (totalLabelEl) totalLabelEl.textContent = projection.totalKindLabel;
    if (totalValueEl) totalValueEl.textContent = projection.formattedTotal;
    if (statusCountEl) statusCountEl.textContent = projection.statusLabel;
    if (summaryCopy) summaryCopy.innerHTML = `<b>${projection.cartItemLabel}</b>`;
    if (summaryValue) summaryValue.innerHTML = `<span>${projection.footerTotalLabel}</span><b>${projection.formattedTotal}</b>`;

    if (displayCount === 0 && !stagedSelection) {
      if (el) el.innerHTML = '';
      amountSection.hidden = true;
      if (summaryControls) summaryControls.hidden = true;
      if (cartToolbar) cartToolbar.hidden = true;
      if (summaryBlocks) summaryBlocks.hidden = true;
      if (columnHead) columnHead.hidden = true;
      return;
    }

    amountSection.hidden = displayCount === 0;
    if (displayCount === 0) {
      if (summaryControls) summaryControls.hidden = true;
      if (cartToolbar) cartToolbar.hidden = !stagedSelection;
      if (summaryBlocks) summaryBlocks.hidden = true;
      if (columnHead) columnHead.hidden = true;
      return;
    }

    if (summaryControls) summaryControls.hidden = false;
    if (cartToolbar) cartToolbar.hidden = false;
    if (summaryBlocks) summaryBlocks.hidden = false;
    if (columnHead) columnHead.hidden = false;

    el.innerHTML = '<p>Fixture values · total policy open (DEC-PRC-005).</p>';
  }

  function compactCardLabel(value) {
    return compactOptionLabel(value);
  }

  function formatLineDuration(line) {
    const minutes = lineDurationMinutes(line);
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour${hours !== 1 ? 's' : ''}`;
  }

  function renderCompactLineSummary(line, lineNum, asset, item, pkg, isEditingLine, isExpanded) {
    const daily = j1MultiDay(line);
    const dateStr = daily ? j1DailyDateSpan(line) : formatShortDate(new Date(line.date + 'T12:00:00'));
    const endDate = line.endDate || line.date;
    const endDateSuffix = endDate !== line.date ? ` ${formatShortDate(new Date(endDate + 'T12:00:00'))}` : '';
    const timeStr = daily ? `${formatSelectionTime(line.startH, line.startM)}–${formatSelectionTime(line.endH, line.endM)} daily`
      : `${formatSelectionTime(line.startH, line.startM)}–${endDateSuffix}${formatSelectionTime(line.endH, line.endM)}`;
    const durationStr = daily ? `${j1DayCount(line)} days · ${formatLineDuration(line)} total · local review fixture` : formatLineDuration(line);
    const amountPending = line.amountPending;
    const amount = Number.isFinite(line.amount) ? line.amount : 2750;
    const readyState = /recalculated/i.test(line.priceStatus || '')
      ? 'Recalculated'
      : (/pricing choices applied/i.test(line.priceStatus || '') ? 'Updated' : 'Ready');
    const stateMarkup = amountPending
      ? '<span class="cart-line-status is-pending" title="Price pending — review required">Attention</span>'
      : `<span class="cart-line-status is-ready" title="${escapeHtml(line.priceStatus || 'Calculated · review fixture')}">${readyState}</span>`;
    const priceMarkup = amountPending
      ? '<span class="cart-line-price-pending" role="status" aria-label="Price pending" title="Price pending"><span aria-hidden="true">＄◷</span></span>'
      : `<b>AU$ ${amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</b>`;
    const editingBadge = isEditingLine ? '<span class="cart-line-badge">Editing</span>' : '';
    const selected = selectedLineIds.has(line.id);
    const hasPackage = line.package !== 'none';
    const conditional = line.packageQuantity != null ? `Qty ${line.packageQuantity}` : (line.packageAttendees != null ? `${line.packageAttendees} attendees` : '');
    const packageRow = hasPackage
      ? `<div class="cart-line-package-row"><span class="cart-line-package" title="${escapeHtml(compactCardLabel(pkg.label))}">${escapeHtml(compactCardLabel(pkg.label))}</span>${conditional ? `<span class="cart-line-package-value">${escapeHtml(conditional)}</span>` : ''}</div>`
      : '';
    const timeslotSummary = line.hasMoreTimeslots
      ? `<button type="button" class="inline-disclosure cart-line-timeslots" data-show-timeslots="${line.id}" aria-expanded="${!!line.timeslotsRevealed}">${line.timeslotsRevealed ? 'Fewer times' : 'More times'}</button>`
      : '';
    const detailContextParts = [
      `<span class="cart-line-context-part" title="${escapeHtml(compactCardLabel(item.label))}">${escapeHtml(compactCardLabel(item.label))}</span>`,
      `<span class="cart-line-context-part" title="${escapeHtml(compactCardLabel(configurationLabel(line.configuration)))}">${escapeHtml(compactCardLabel(configurationLabel(line.configuration)))}</span>`,
      ...(hasPackage ? [`<span class="cart-line-context-part" title="${escapeHtml(compactCardLabel(pkg.label))}">${escapeHtml(compactCardLabel(pkg.label))}</span>`] : []),
      ...(conditional ? [`<span class="cart-line-context-part" title="${escapeHtml(conditional)}">${escapeHtml(conditional)}</span>`] : [])
    ];
    const detailContextMarkup = `<div class="cart-line-context">${detailContextParts.join('<span class="cart-line-context-separator" aria-hidden="true">·</span>')}${timeslotSummary}</div>`;
    const summaryClass = `cart-line-summary${hasPackage ? ' has-package' : ''}${isExpanded ? ' detail-summary' : ''}`;
    return `
      <div class="${summaryClass}">
        <label class="line-select" title="Select Booking selection ${lineNum}"><input type="checkbox" data-select-line="${line.id}" ${selected ? 'checked' : ''}><span class="visually-hidden">Select ${escapeHtml(asset.name)}</span></label>
        <span class="row-no" aria-hidden="true">${String(lineNum).padStart(2, '0')}</span>
        <div class="cart-line-item-block">
          <div class="cart-line-main">
            <button type="button" class="cart-line-title line-select-button" data-highlight-line="${line.id}" aria-pressed="${selected}"><span class="cart-line-resource">${escapeHtml(asset.name)}</span>${editingBadge}</button>
          </div>
          <span class="cart-line-compact-item" title="${escapeHtml(compactCardLabel(item.label))}">${escapeHtml(compactCardLabel(item.label))}</span>
          <div class="cart-line-venue" title="${escapeHtml(asset.venue)}">${escapeHtml(asset.venue)}</div>
        </div>
        <div class="cart-line-datetime-block">
          <div class="cart-line-schedule"><span class="cart-line-schedule-date">${dateStr}</span><span class="cart-line-schedule-time">${timeStr}</span><span class="cart-line-schedule-duration">${durationStr}</span></div>
        </div>
        <div class="cart-line-amount-col">${stateMarkup}</div>
        <div class="cart-line-price">${priceMarkup}</div>
        <div class="cart-line-offering"><span class="cart-line-item" title="${escapeHtml(compactCardLabel(item.label))}">${escapeHtml(compactCardLabel(item.label))}</span><span class="cart-line-configuration" title="${escapeHtml(compactCardLabel(configurationLabel(line.configuration)))}">${escapeHtml(compactCardLabel(configurationLabel(line.configuration)))}</span></div>
        ${packageRow}
        ${detailContextMarkup}
        <div class="cart-line-actions" aria-label="Actions for ${escapeHtml(asset.name)}">
          <button type="button" class="btn-ghost btn-sm cart-line-delete" data-line-delete="${line.id}" aria-label="Remove ${escapeHtml(asset.name)} from Cart" title="Remove ${escapeHtml(asset.name)} from Cart"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4h11M6 4V2.5h4V4m2 0-.6 9H4.6L4 4m2.2 2.2v4.9m3.6-4.9v4.9"/></svg></button>
          <button type="button" class="btn-ghost btn-sm cart-line-actions-toggle" data-line-actions-toggle="${line.id}" aria-expanded="${openLineActionsId === line.id}" aria-controls="cart-line-action-menu-${line.id}" aria-haspopup="menu" aria-label="${openLineActionsId === line.id ? 'Close' : 'Open'} actions for ${escapeHtml(asset.name)}"><span aria-hidden="true">⋮</span></button>
          <div class="cart-line-action-menu" id="cart-line-action-menu-${line.id}" role="menu" aria-label="Actions for ${escapeHtml(asset.name)}" ${openLineActionsId === line.id ? '' : 'hidden'}>
            <button type="button" class="btn-ghost btn-sm" role="menuitem" tabindex="-1" data-time="${line.id}" aria-label="Change date and time for ${escapeHtml(asset.name)}">Change time</button>
            <button type="button" class="btn-ghost btn-sm" role="menuitem" tabindex="-1" data-config="${line.id}" aria-label="Change configuration for ${escapeHtml(asset.name)}">Change configuration</button>
            <button type="button" class="btn-ghost btn-sm" role="menuitem" tabindex="-1" data-package="${line.id}" aria-label="${hasPackage ? 'Change' : 'Add'} package for ${escapeHtml(asset.name)}">${hasPackage ? 'Change package' : 'Add package'}</button>
            <button type="button" class="btn-ghost btn-sm" role="menuitem" tabindex="-1" data-pricing="${line.id}" aria-label="Change pricing for ${escapeHtml(asset.name)}">Pricing</button>
            <button type="button" class="btn-ghost btn-sm cart-line-more-btn" role="menuitem" tabindex="-1" data-details="${line.id}" aria-label="Show more details for ${escapeHtml(asset.name)}">More details</button>
            <button type="button" class="btn-ghost btn-sm danger-link" role="menuitem" tabindex="-1" data-remove="${line.id}" aria-label="Remove ${escapeHtml(asset.name)} from Cart">Remove</button>
          </div>
        </div>
      </div>`;
  }

  function positionLineActionMenu(id) {
    const line = Array.from(document.querySelectorAll('[data-booking-line]')).find((entry) => entry.dataset.bookingLine === id);
    const menu = line?.querySelector('.cart-line-action-menu:not([hidden])');
    const toggle = line?.querySelector('[data-line-actions-toggle]');
    const scroll = $('#items-scroll');
    if (!line || !menu || !toggle || !scroll) return;
    line.classList.remove('is-actions-flipped');
    menu.style.position = 'fixed';
    menu.style.inset = 'auto';
    menu.style.left = '0px';
    menu.style.top = '0px';
    const menuRect = menu.getBoundingClientRect();
    const toggleRect = toggle.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const below = toggleRect.bottom + 4;
    const above = toggleRect.top - menuRect.height - 4;
    const top = below + menuRect.height <= scrollRect.bottom - 4
      ? below
      : (above >= scrollRect.top + 4 ? above : Math.max(scrollRect.top + 4, scrollRect.bottom - menuRect.height - 4));
    const left = Math.max(scrollRect.left + 4, Math.min(toggleRect.right - menuRect.width, scrollRect.right - menuRect.width - 4));
    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
    line.classList.toggle('is-actions-flipped', top < toggleRect.top);
  }

  function renderCartLines() {
    const list = $('#cart-line-list');
    const scroll = $('#items-scroll');
    listScrollPos = scroll ? scroll.scrollTop : 0;
    list.innerHTML = '';

    const lines = getDisplayLines();
    let currentGroup = -1;

    lines.forEach((line, idx) => {
      if (lines.length >= 10 && line.groupIndex !== undefined && line.groupIndex !== currentGroup) {
        currentGroup = line.groupIndex;
        const gh = document.createElement('li');
        const groupOpen = expandedGroups.has(currentGroup);
        gh.className = 'group-head';
        gh.innerHTML = `<button type="button" data-group-toggle="${currentGroup}" aria-expanded="${groupOpen}" aria-label="${groupOpen ? 'Collapse' : 'Expand'} related selection cards in Review group ${GROUP_DEFS[currentGroup][0]}">${groupOpen ? '▾' : '▸'} Related selections · Review group ${GROUP_DEFS[currentGroup][0]} · ${GROUP_DEFS[currentGroup][1]}</button><span>review fixture</span>`;
        list.appendChild(gh);
      }

      const li = document.createElement('li');
      const isEditingLine = line.id === editingLineId;
      const isEditorOpenForLine = cartItemEditor && getCartItemEditorDialog()?.open && cartItemEditor.ids.includes(line.id);
      const isExpanded = isEditorOpenForLine && cartItemEditor.tab === 'more';
      const asset = ASSETS.find((a) => a.id === line.asset);
      const item = getItemRecord(line.item);
      const pkg = getPackageRecord(line.package);
      const lineNum = line.lineNumber || idx + 1;
      if (lines.length >= 10 && line.groupIndex !== undefined && !expandedGroups.has(line.groupIndex)) return;
      li.dataset.bookingLine = line.id;
      li.setAttribute('aria-label', j1MultiDay(line)
        ? `Booking selection ${lineNum}: ${asset.name}, ${j1DailyDescription(line)}`
        : `Booking selection ${lineNum}: ${asset.name}, ${formatShortDate(new Date(line.date + 'T12:00:00'))}, ${formatSelectionTime(line.startH, line.startM)} to ${formatSelectionTime(line.endH, line.endM)}`);

      if (isEditorOpenForLine) {
        li.className = 'cart-line is-expanded' + (expandedMode === 'edit' ? ' is-editing' : '') + (selectedLineIds.has(line.id) ? ' is-selected' : '');
        li.innerHTML = renderCompactLineSummary(line, lineNum, asset, item, pkg, isEditingLine, isExpanded);
      } else {
        li.className = 'cart-line' + (isEditingLine ? ' is-editing' : '') + (selectedLineIds.has(line.id) ? ' is-selected' : '');
        li.innerHTML = renderCompactLineSummary(line, lineNum, asset, item, pkg, isEditingLine, false);
      }
      if (openLineActionsId === line.id) li.classList.add('has-open-actions');
      list.appendChild(li);
    });

    requestAnimationFrame(() => {
      if (scroll) scroll.scrollTop = listScrollPos;
      if (openLineActionsId) positionLineActionMenu(openLineActionsId);
    });

    list.querySelectorAll('[data-group-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = Number(btn.dataset.groupToggle);
        openLineActionsId = null;
        if (expandedGroups.has(group)) expandedGroups.delete(group); else expandedGroups.add(group);
        renderCartLines();
      });
    });
    list.querySelectorAll('[data-select-line]').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.checked) selectedLineIds.add(input.dataset.selectLine); else selectedLineIds.delete(input.dataset.selectLine);
        updateCartUI();
      });
    });
    list.querySelectorAll('[data-highlight-line]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.highlightLine;
        if (selectedLineIds.has(id)) selectedLineIds.delete(id); else selectedLineIds.add(id);
        updateCartUI();
      });
    });
    list.querySelectorAll('[data-line-actions-toggle]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = btn.dataset.lineActionsToggle;
        const opening = openLineActionsId !== id;
        openLineActionsId = opening ? id : null;
        renderCartLines();
        requestAnimationFrame(() => {
          const line = Array.from(list.querySelectorAll('[data-booking-line]')).find((entry) => entry.dataset.bookingLine === id);
          const target = opening
            ? line?.querySelector('.cart-line-action-menu [role="menuitem"]')
            : line?.querySelector('[data-line-actions-toggle]');
          if (target) target.focus();
        });
      });
      btn.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const id = btn.dataset.lineActionsToggle;
        openLineActionsId = id;
        renderCartLines();
        requestAnimationFrame(() => {
          const line = Array.from(list.querySelectorAll('[data-booking-line]')).find((entry) => entry.dataset.bookingLine === id);
          const items = Array.from(line?.querySelectorAll('.cart-line-action-menu [role="menuitem"]') || []);
          const target = event.key === 'ArrowUp' ? items[items.length - 1] : items[0];
          if (target) target.focus();
        });
      });
    });
    list.querySelectorAll('.cart-line-action-menu').forEach((menu) => {
      menu.addEventListener('click', (event) => event.stopPropagation());
      menu.addEventListener('keydown', (event) => {
        const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
        const current = items.indexOf(document.activeElement);
        let next = null;
        if (event.key === 'ArrowDown') next = items[(current + 1 + items.length) % items.length];
        else if (event.key === 'ArrowUp') next = items[(current - 1 + items.length) % items.length];
        else if (event.key === 'Home') next = items[0];
        else if (event.key === 'End') next = items[items.length - 1];
        if (!next) return;
        event.preventDefault();
        next.focus();
      });
    });
    list.querySelectorAll('[data-details]').forEach((btn) => {
      btn.addEventListener('click', () => openCartItemEditor('more', btn.dataset.details, btn));
    });
    list.querySelectorAll('[data-time]').forEach((btn) => {
      btn.addEventListener('click', () => openCartItemEditor('time', [btn.dataset.time], btn));
    });
    list.querySelectorAll('[data-config]').forEach((btn) => {
      btn.addEventListener('click', () => openCartItemEditor('config', [btn.dataset.config], btn));
    });
    list.querySelectorAll('[data-package]').forEach((btn) => {
      btn.addEventListener('click', () => openCartItemEditor('package', btn.dataset.package, btn));
    });
    list.querySelectorAll('[data-pricing]').forEach((btn) => {
      btn.addEventListener('click', () => openCartItemEditor('pricing', btn.dataset.pricing, btn));
    });
    list.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => promptRemove(btn.dataset.remove, btn));
    });
    list.querySelectorAll('[data-line-delete]').forEach((btn) => {
      btn.addEventListener('click', () => promptRemove(btn.dataset.lineDelete, btn));
    });
    list.querySelectorAll('[data-inline-picker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.inlinePicker;
        const field = btn.dataset.field;
        openPicker(field, { host: cartLines.find((l) => l.id === id), field });
      });
    });
    list.querySelectorAll('[data-inline-update]').forEach((btn) => {
      btn.addEventListener('click', () => {
        expandedLineId = null;
        showToast('Cart item updated — booking is not saved');
        updateCartUI();
      });
    });
    list.querySelectorAll('[data-show-timeslots]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const line = cartLines.find((entry) => entry.id === btn.dataset.showTimeslots);
        if (line) line.timeslotsRevealed = !line.timeslotsRevealed;
        renderCartLines();
      });
    });
    list.querySelectorAll('[data-allocation-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const line = cartLines.find((entry) => entry.id === btn.dataset.allocationSelect);
        if (line) line.allocationSelected = !line.allocationSelected;
        showToast(line && line.allocationSelected ? 'Unallocated Standard Item selected for allocation' : 'Allocation card deselected');
        renderCartLines();
      });
    });
  }

  function renderDetailPanel(line, editing) {
    const item = getItemRecord(line.item);
    const pkg = getPackageRecord(line.package);
    const allocation = line.allocationMode === 'all' ? 'All assets' : (line.allocationMode === 'multiple' ? 'Multiple assets' : 'Single asset');
    const allocationIcon = line.allocationMode === 'all' ? '▦' : (line.allocationMode === 'multiple' ? '▥' : '●');
    const allocationAssets = line.allocationMode === 'all' ? '<details class="allocation-assets"><summary>Show allocated assets</summary><span>Hall 1 · Studio 2 — review fixture</span></details>' : '';
    const included = (line.includedItems || []).map((id) => getItemRecord(id).label).join(', ') || 'None';
    const packageValue = line.packageQuantity != null
      ? `Quantity ${line.packageQuantity}`
      : (line.packageAttendees != null ? `${line.packageAttendees} attendees` : 'No conditional value');
    const moreTimeslots = line.hasMoreTimeslots
      ? `<div class="detail-field detail-wide"><label>Grouped timeslots</label><button type="button" class="btn-ghost btn-sm" data-show-timeslots="${line.id}">${line.timeslotsRevealed ? 'Show fewer' : 'Show more'}</button>${line.timeslotsRevealed ? '<b>Additional review timeslot · grouping policy not inferred</b>' : ''}</div>`
      : '';
    const allocationBoundary = line.isUnallocated
      ? `<div class="detail-field detail-wide allocation-boundary"><label>Unallocated Standard Item</label><b>${line.allocationSelected ? 'Selected for allocation' : 'Not selected for allocation'}</b><button type="button" class="btn-secondary btn-sm" data-allocation-select="${line.id}" aria-pressed="${!!line.allocationSelected}">${line.allocationSelected ? 'Deselect allocation card' : 'Select for allocation'}</button><small>Proven select/deselect boundary only; resource-allocation policy is not inferred.</small></div>`
      : '';
    const fields = `
      ${j1MultiDay(line) ? `<div class="detail-field detail-wide j1-daily-detail"><label>Daily selection · local review only</label><b>${escapeHtml(j1DailyDescription(line))}</b><small>Not a continuous overnight booking; no production price or creation policy is claimed.</small></div>` : ''}
      <div class="detail-field"><label>Item</label><b>${escapeHtml(item.label)}</b><button type="button" class="inline-picker-btn" data-inline-picker="${line.id}" data-field="item">Change Item</button></div>
      <div class="detail-field"><label>Package</label><b>${escapeHtml(pkg.label)} · ${escapeHtml(packageValue)}</b><button type="button" class="btn-ghost btn-sm" data-package="${line.id}">Contents &amp; change</button></div>
      <div class="detail-field"><label>Included Package Items</label><b>${escapeHtml(included)}</b></div>
      <div class="detail-field"><label>Configuration</label><b>${escapeHtml(configurationLabel(line.configuration))}</b></div>
      <div class="detail-field"><label>Item allocation</label><b class="allocation-mode-badge"><span aria-hidden="true">${allocationIcon}</span>${allocation}</b>${allocationAssets}</div>
      <div class="detail-field"><label>Concession</label><b>${escapeHtml(getConcessionRecord(line.concession).label)}</b></div>
      <div class="detail-field"><label>Pricing status</label><b>${escapeHtml(line.priceStatus || (line.amountPending ? 'Pending · review required' : 'Calculated · review fixture'))}</b></div>
      <div class="detail-field"><label>Availability</label><b>Available at staged time · review fixture</b></div>
      <div class="detail-field"><label>Grouping context</label><b>Review group ${GROUP_DEFS[line.groupIndex || 0][0]} · presentation only</b></div>
      ${moreTimeslots}${allocationBoundary}`;
    if (editing && !String(line.id).startsWith('line-stress-')) {
      return fields + `<div class="edit-panel"><button type="button" class="btn-primary btn-sm" data-inline-update="${line.id}">Finish Item update</button></div>`;
    }
    return fields;
  }

  function toggleExpand(id, mode, trigger) {
    if (expandedLineId === id && expandedMode === mode) {
      expandedLineId = null;
      expandedMode = null;
    } else {
      expandedLineId = id;
      expandedMode = mode;
      if (mode === 'edit' && !String(id).startsWith('line-stress-')) {
        editLine(id, trigger);
        return;
      }
    }
    updateCartUI();
  }

  function isCompatible(itemKey, pkgKey) {
    if (pkgKey === 'none') return itemKey === 'community-hall';
    if (itemKey === 'studio-lighting' && pkgKey === 'private-day') return false;
    return itemKey === 'community-hall';
  }

  function syncCurrentSelectionEditControl() {
    const toggle = $('#current-selection-details-toggle');
    if (!toggle) return;
    const dialog = $('#cart-item-editor-dialog');
    const newSelectionTarget = !!stagedSelection && !editingLineId && !currentSelectionDetailsExpanded;
    if (newSelectionTarget) {
      toggle.setAttribute('aria-controls', 'cart-item-editor-dialog');
      toggle.setAttribute('aria-haspopup', 'dialog');
      toggle.setAttribute('aria-expanded', String(!!dialog?.open && dialog.dataset.editorTarget === 'staged-selection'));
      toggle.textContent = 'Edit details';
    } else {
      toggle.setAttribute('aria-controls', 'configure-form');
      toggle.removeAttribute('aria-haspopup');
      toggle.setAttribute('aria-expanded', String(currentSelectionDetailsExpanded));
      toggle.textContent = currentSelectionDetailsExpanded ? 'Hide details' : 'Edit details';
    }
  }

  function setCurrentSelectionDetailsExpanded(expanded, options = {}) {
    const form = $('#configure-form');
    const toggle = $('#current-selection-details-toggle');
    if (!form || !toggle) return;
    if (isJourney9Route()) {
      currentSelectionDetailsExpanded = false;
      form.hidden = true;
      form.inert = true;
      form.setAttribute('aria-hidden', 'true');
      toggle.hidden = true;
      toggle.disabled = true;
      toggle.inert = true;
      toggle.setAttribute('aria-hidden', 'true');
      return;
    }
    const open = !!expanded && !!stagedSelection;
    currentSelectionDetailsExpanded = open;
    document.body.dataset.currentSelectionDetails = open ? 'expanded' : 'collapsed';
    form.hidden = !open;
    form.toggleAttribute('inert', !open);
    form.setAttribute('aria-hidden', String(!open));
    syncCurrentSelectionEditControl();
    if (open && options.moveFocus) {
      requestAnimationFrame(() => form.focus({ preventScroll: true }));
    } else if (!open && options.restoreFocus && !toggle.closest('[hidden]')) {
      requestAnimationFrame(() => toggle.focus({ preventScroll: true }));
    }
  }

  function syncCurrentSelectionDisclosure() {
    if (!stagedSelection) currentSelectionDetailsExpanded = false;
    setCurrentSelectionDetailsExpanded(currentSelectionDetailsExpanded);
  }

  function renderCurrentSelectionSummary() {
    const host = $('#staged-summary');
    if (!host) return;
    if (!stagedSelection) {
      host.innerHTML = '';
      return;
    }
    const s = stagedSelection;
    const asset = ASSETS.find((entry) => entry.id === s.asset);
    if (!asset) return;
    if (isJourney9Route()) {
      const hours = selectionDurationHours(s);
      const endDate = s.endDate || s.date;
      const endDateSuffix = endDate !== s.date ? ` ${formatShortDate(new Date(endDate + 'T12:00:00'))}` : '';
      const when = `${formatShortDate(new Date(s.date + 'T12:00:00'))} · ${formatSelectionTime(s.startH, s.startM)}–${endDateSuffix}${formatSelectionTime(s.endH, s.endM)} · ${hours} hour${hours !== 1 ? 's' : ''}`;
      const item = getItemRecord(getCommitted('item')).label;
      const row = (label, value) => `<div class="current-selection-summary-row" data-summary-row="${label.toLowerCase()}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
      host.innerHTML = `<div class="current-selection-resource"><strong>${escapeHtml(asset.name)}</strong><span>${escapeHtml(asset.venue)}</span></div><dl>${row('When', when)}${row('Item', item)}</dl>`;
      return;
    }
    const hours = selectionDurationHours(s);
    const endDate = s.endDate || s.date;
    const endDateSuffix = endDate !== s.date ? ` ${formatShortDate(new Date(endDate + 'T12:00:00'))}` : '';
    const when = j1MultiDay(s) ? j1DailyDescription(s)
      : `${formatShortDate(new Date(s.date + 'T12:00:00'))} · ${formatSelectionTime(s.startH, s.startM)}–${endDateSuffix}${formatSelectionTime(s.endH, s.endM)} · ${hours} hour${hours !== 1 ? 's' : ''}`;
    const item = getItemRecord(getCommitted('item')).label;
    const packageId = getCommitted('package');
    const packageRecord = getPackageRecord(packageId);
    const packageMetadata = packageMeta(packageId);
    const packageState = getStagedPackageState(false);
    let packageSummary = packageRecord.label;
    if (packageMetadata.type === 'quantity') packageSummary += ` · ${packageState.quantity == null ? 'Quantity required' : `Qty ${packageState.quantity}`}`;
    else if (packageMetadata.type === 'attendees') packageSummary += ` · ${packageState.attendees == null ? 'Attendees required' : `${packageState.attendees} attendees`}`;
    const configuration = $('#cfg-configuration')?.selectedOptions?.[0]?.textContent || configurationLabel($('#cfg-configuration')?.value);
    const allocation = $('#allocation-summary')?.textContent || asset.name;
    const amountRegion = $('#amount-region');
    const amount = amountRegion && !amountRegion.hidden ? amountRegion.querySelector('.amount-value')?.textContent : 'Quote pending';
    const concession = getConcessionRecord(getCommitted('concession')).label;
    const pricing = [amount, concession].filter(Boolean).join(' · ');
    const row = (label, value) => `<div class="current-selection-summary-row" data-summary-row="${label.toLowerCase()}"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    host.innerHTML = `
      <div class="current-selection-resource"><strong title="${escapeHtml(asset.name)}">${escapeHtml(asset.name)}</strong><span title="${escapeHtml(asset.venue)}">${escapeHtml(asset.venue)}</span></div>
      <dl>${row('When', when)}${row('Item', item)}${row('Package', packageSummary)}${row('Configuration', configuration)}${row('Allocation', allocation)}${row('Pricing', pricing)}</dl>`;
  }

  function updateConfigureForm() {
    if (!stagedSelection) {
      updatePrimaryAction();
      return;
    }
    const s = stagedSelection;
    const asset = ASSETS.find((a) => a.id === s.asset);

    const allowedConfigurations = CONFIGURATIONS[s.asset] || [];
    const configuration = $('#cfg-configuration');
    const priorConfiguration = configuration.value;
    configuration.innerHTML = allowedConfigurations.map((id) => `<option value="${id}">${escapeHtml(configurationLabel(id))}</option>`).join('');
    configuration.value = allowedConfigurations.includes(priorConfiguration) ? priorConfiguration : allowedConfigurations[0];
    $('#allocation-summary').textContent = asset.name;
    renderStagedPackageFields();

    const item = getCommitted('item');
    const pkg = getCommitted('package');
    const compatible = isCompatible(item, pkg) && isJourneyItem(item) && isJourneyPackage(pkg);
    $('#amount-region').hidden = isJourney9Route() || !compatible || j1MultiDay(stagedSelection);
    const amountEl = $('#amount-region .amount-value');
    if (amountEl && !isJourney9Route()) {
      if (!isJourneyItem(item) || !isJourneyPackage(pkg)) amountEl.textContent = 'Quote pending';
      else if (compatible) amountEl.textContent = 'AU$ 2,750.00';
      else amountEl.textContent = 'AU$ 2,750.00';
    }

    renderCurrentSelectionSummary();

    if (!compatible && isJourneyItem(item) && isJourneyPackage(pkg)) {
      const dlg = $('#mismatch-dialog');
      if (!dlg.open) openMismatchDialog($('#cfg-item-input'));
    }

    updatePrimaryAction();
    j7SyncRouteState();
  }

  function openMismatchDialog(trigger) {
    lastDialogTrigger = trigger || document.activeElement;
    $('#mismatch-dialog').showModal();
    $('#mismatch-fix').focus();
    announceAlert('This asset does not have an Item with matching Sales Categories with the selected Package.');
  }

  function createSelection(assetId, dk, startSlot, endSlotExclusive, endDate = dk) {
    if (isJ4Journey()) { j4ActiveFixtureId = 'available'; j4SetCartHandoffVisible(true); if (isNarrowViewport()) setSheetExpanded(true); } // One Calendar: same Cart handoff as 'Select interval'
    stagedSelection = selectionFromSlots(assetId, dk, startSlot, endSlotExclusive);
    if (['1', '12'].includes(document.body.dataset.journey)) {
      stagedSelection.endDate = endDate;
      stagedSelection.j1DailyRectangle = true;
    }
    currentSelectionDetailsExpanded = false;
    editingLineId = null;
    draft.unavailableSelection = null;
    setCommitted('item', 'community-hall', { notify: false });
    setCommitted('package', 'none', { notify: false });
    setCommitted('concession', 'review-fixture', { notify: false });
    syncFieldDisplay('item');
    syncFieldDisplay('package');
    syncFieldDisplay('concession');
    setPhase(cartLines.length > 0 ? 'configure' : 'configure');
    setStage('e');
    updateCartUI();
    renderCalendar();
  }

  function selectUnavailable(assetId, dk, ev) {
    stagedSelection = null;
    editingLineId = null;
    draft.unavailableSelection = {
      asset: assetId,
      date: dk,
      label: `${ev.title} — ${ev.status}`
    };
    setPhase('unavailable');
    setStage('m');
    announceAlert('That interval is unavailable. Choose an available time.');
    updateCartUI();
    renderCalendar();
  }

  function addToCart() {
    if (isJourney9Route()) { j9BlockReview('Journey 9 cannot add a staged selection to the Booking Cart; only recurring review is actionable.'); return; }
    if (!stagedSelection) return;
    if (isJourney7Route() && !j7IsAcceptedGraph(stagedSelection).ok) {
      j7BlockReview('Journey 7 cannot stage an incomplete or stale accepted graph.');
      j7SyncRouteState();
      return;
    }
    const packageState = getStagedPackageState(true);
    if (!packageState.valid) return;
    const wasEdit = !!editingLineId;
    const line = {
      id: 'line-' + Date.now(),
      ...stagedSelection,
      endDate: stagedSelection.endDate || stagedSelection.date,
      item: getCommitted('item'),
      package: getCommitted('package'),
      packageQuantity: packageState.quantity,
      packageAttendees: packageState.attendees,
      includedItems: Array.from(packageState.includedItems),
      concession: getCommitted('concession'),
      configuration: $('#cfg-configuration').value,
      allocationMode: 'single',
      amountPending: j1MultiDay(stagedSelection) || (cartLines.length >= 1 && !editingLineId),
      amount: j1MultiDay(stagedSelection) ? null : 2750,
      priceStatus: j1MultiDay(stagedSelection) ? 'Multi-day local review fixture · pricing policy unconfirmed' : 'Calculated · review fixture',
      pricingOption: 'standard',
      priceMode: 'default',
      priceType: 'standard-rate',
      pricingUnit: 'hour'
    };
    if (editingLineId) {
      const idx = cartLines.findIndex((l) => l.id === editingLineId);
      if (idx >= 0) cartLines[idx] = { ...line, id: editingLineId, amountPending: j1MultiDay(line) || cartLines[idx].amountPending };
      editingLineId = null;
    } else {
      cartLines.push(line);
    }
    stagedSelection = null;
    currentSelectionDetailsExpanded = false;
    setPhase('cart');
    setStage(cartLines.length >= 2 ? 'l' : 'h');
    showToast(wasEdit ? 'Cart item updated — booking is not saved' : 'Added to cart — booking is not saved');
    updateCartUI();
    renderCalendar();
    if (isJourney7Route()) k1Focus.move($(`[data-booking-line="${line.id}"]`), '#cart-primary-action');
  }

  function editLine(id, trigger) {
    const line = cartLines.find((l) => l.id === id);
    if (!line) return;
    editingLineId = id;
    stagedSelection = { ...line };
    currentSelectionDetailsExpanded = true;
    setCommitted('item', line.item, { notify: false });
    setCommitted('package', line.package, { notify: false });
    syncFieldDisplay('item');
    syncFieldDisplay('package');
    expandedLineId = null;
    lastDialogTrigger = trigger;
    setPhase('configure');
    setStage('j');
    updateCartUI();
    renderCalendar();
  }

  function promptRemove(id, trigger) {
    removeTargetId = id;
    lastDialogTrigger = trigger;
    $('#remove-dialog').showModal();
    $('#remove-keep').focus();
  }

  function confirmRemove() {
    if (isJourney9Route()) { j9BlockReview('Journey 9 item removal is unavailable.'); return; }
    cartLines = cartLines.filter((l) => l.id !== removeTargetId);
    selectedLineIds.delete(removeTargetId);
    if (editingLineId === removeTargetId) {
      editingLineId = null;
      stagedSelection = null;
    }
    if (expandedLineId === removeTargetId) {
      expandedLineId = null;
      expandedMode = null;
    }
    closeCartItemEditor(false);
    removeTargetId = null;
    $('#remove-dialog').close();
    setPhase(cartLines.length > 0 ? 'cart' : 'select');
    setStage('k');
    updateCartUI();
    renderCalendar();
    lastDialogTrigger = null;
  }

  const STAGED_SELECTION_EDITOR_ID = 'staged-selection-draft';

  function sameIdSet(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    const sortedA = [...a].sort().join('|');
    const sortedB = [...b].sort().join('|');
    return sortedA === sortedB;
  }

  function getCartItemEditorDialog() {
    return $('#cart-item-editor-dialog');
  }

  function cartItemEditorTargetsStagedSelection() {
    return cartItemEditor?.target === 'staged-selection';
  }

  function getEditorTargetRecord(id) {
    return cartLines.find((entry) => entry.id === id);
  }

  function getTimeEditorRecord(id) {
    if (cartItemEditorTargetsStagedSelection() && id === STAGED_SELECTION_EDITOR_ID) return stagedSelection;
    return getEditorTargetRecord(id);
  }

  function setStagedPricingSurface(stagedTarget) {
    const stagedOnly = [
      $('#pricing-configuration')?.closest('.dialog-field'),
      $('#pricing-option')?.closest('.dialog-field'),
      $('.price-type-mode'),
      $('#changed-price-fields'),
      $('.price-review')
    ];
    stagedOnly.forEach((el) => {
      if (!el) return;
      el.hidden = stagedTarget;
      if (stagedTarget) el.setAttribute('aria-hidden', 'true');
      else el.removeAttribute('aria-hidden');
      el.querySelectorAll('select, input, button').forEach((control) => { control.disabled = stagedTarget; });
    });
    const description = $('#pricing-desc');
    if (description) description.textContent = stagedTarget
      ? 'Review the existing staged Concession fixture. Cart-line pricing controls are not available for a new selection.'
      : 'The control structure is Diary-proven. All option names, amounts and formulas are local review fixtures.';
    const title = $('#pricing-title');
    if (title) title.textContent = stagedTarget ? 'Concession review' : 'Change pricing';
    const apply = $('#pricing-apply');
    if (apply) apply.textContent = stagedTarget ? 'Apply concession' : 'Apply pricing';
  }

  function setCartItemEditorContext(target) {
    const draftTarget = target === 'staged-selection';
    const dialog = getCartItemEditorDialog();
    if (!dialog) return;
    dialog.dataset.editorTarget = draftTarget ? 'staged-selection' : 'cart-line';
    $('#cart-item-editor-eyebrow').textContent = draftTarget ? 'New selection draft' : 'Staged selection';
    $('#cart-item-editor-title').textContent = draftTarget ? 'Edit new selection' : 'Edit cart item';
    $('#cart-item-editor-close').setAttribute('aria-label', draftTarget ? 'Close new selection editor' : 'Close cart item editor');
    $('#time-desc').textContent = draftTarget
      ? 'Edit the current draft using existing availability rules. The Cart stays unchanged until Add to cart succeeds.'
      : 'Edit, review live availability and confirm on this one surface. The same staged Cart line is updated.';
    const tablist = dialog.querySelector('.cart-item-editor-tabs');
    if (tablist) {
      tablist.setAttribute('role', 'tablist');
      tablist.setAttribute('aria-label', draftTarget ? 'New selection editor sections' : 'Cart item editor sections');
    }
    const controls = {
      time: 'cie-panel-time',
      config: 'cie-panel-config',
      package: 'cie-panel-package',
      pricing: 'cie-panel-pricing',
      more: 'cie-panel-more'
    };
    $$('.cart-item-editor-tab').forEach((tab) => {
      const name = tab.dataset.editorTab;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', controls[name]);
      tab.removeAttribute('aria-label');
      tab.removeAttribute('aria-pressed');
    });
    setStagedPricingSurface(draftTarget);
    const selection = draftTarget ? stagedSelection : cartLines.find((line) => line.id === cartItemEditor?.ids?.[0]);
    const daily = j1MultiDay(selection);
    const form = $('#time-form');
    form.hidden = daily;
    form.inert = daily;
    let note = $('#j1-daily-time-note');
    if (daily && !note) {
      note = document.createElement('p');
      note.id = 'j1-daily-time-note';
      note.className = 'j1-daily-time-note';
      $('#cie-panel-time').appendChild(note);
    }
    if (note) {
      note.hidden = !daily;
      if (daily) note.textContent = `${j1DailyDescription(selection)}. Time editing is unavailable for this local rectangular review fixture; use the calendar handle before adding to Cart.`;
    }
    if (daily) $('#time-desc').textContent = 'Daily rectangle · local review only. Other Item, configuration, Package and pricing controls remain available.';
  }

  function updateEditorTabLabels(lineId) {
    const line = cartLines.find((entry) => entry.id === lineId);
    const packageTab = $('#cie-tab-package');
    if (line && packageTab) {
      packageTab.textContent = line.package !== 'none' ? 'Change package' : 'Add package';
    }
  }

  function setEditorTab(tab) {
    const tabs = $$('.cart-item-editor-tab');
    const panels = $$('.editor-tabpanel');
    tabs.forEach((btn) => {
      const active = btn.dataset.editorTab === tab;
      btn.removeAttribute('aria-pressed');
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
      btn.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== `cie-panel-${tab}`;
    });
    if (cartItemEditor) cartItemEditor.tab = tab;
  }

  function focusEditorTab(tab) {
    if (tab === 'time') ($('#time-form').hidden ? $('#cie-panel-time') : $('#time-start-date')).focus();
    else if (tab === 'config') $('#configuration-choice').focus();
    else if (tab === 'package') $('#package-picker-btn').focus();
    else if (tab === 'pricing') (cartItemEditorTargetsStagedSelection() ? $('#pricing-concession') : $('#pricing-configuration'))?.focus();
    else if (tab === 'more') {
      const panel = $('#cie-panel-more');
      if (panel) panel.focus();
    } else {
      const activeTab = $(`#cie-tab-${tab}`);
      if (activeTab) activeTab.focus();
    }
  }

  function updateEditorTabAvailability(ids) {
    if (cartItemEditorTargetsStagedSelection()) {
      ['time', 'config', 'package', 'pricing'].forEach((tab) => {
        const el = $(`#cie-tab-${tab}`);
        if (el) el.hidden = false;
      });
      const more = $('#cie-tab-more');
      if (more) more.hidden = true;
      return;
    }
    const bulk = ids.length > 1;
    const config = $('#cie-tab-config');
    if (config) config.hidden = false;
    ['package', 'pricing', 'more'].forEach((tab) => {
      const el = $(`#cie-tab-${tab}`);
      if (el) el.hidden = bulk;
    });
  }

  function reopenCartItemEditor(tab) {
    const dialog = getCartItemEditorDialog();
    if (!dialog) return;
    if (cartItemEditor) cartItemEditor.tab = tab;
    setEditorTab(tab);
    if (!dialog.open) dialog.showModal();
  }

  function closeCartItemEditor(restore) {
    const dialog = getCartItemEditorDialog();
    const wasDraftTarget = cartItemEditorTargetsStagedSelection();
    const focusOrigin = restore !== false && lastDialogTrigger ? captureFocusOrigin(lastDialogTrigger) : null;
    if (pickerOpen) closePicker({ restore: true, refocus: false, reopenParent: false });
    timeEditor = null;
    configurationEditor = null;
    packageEditor = null;
    pricingEditor = null;
    cartItemEditor = null;
    lastDialogTrigger = null;
    if (dialog && dialog.open) dialog.close();
    if (wasDraftTarget) setCartItemEditorContext('cart-line');
    updateCartUI();
    if (focusOrigin) queueMicrotask(() => restoreFocusToOrigin(focusOrigin));
  }

  function closeWorkflowDialog(dialog, restore) {
    closeCartItemEditor(restore);
  }

  function bindMorePanelEvents(host, lineId) {
    host.querySelectorAll('[data-package]').forEach((btn) => {
      btn.addEventListener('click', () => switchCartItemEditorTab('package'));
    });
    host.querySelectorAll('[data-inline-picker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openPicker(btn.dataset.field, { host: cartLines.find((l) => l.id === lineId), field: btn.dataset.field });
      });
    });
    host.querySelectorAll('[data-show-timeslots]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const line = cartLines.find((entry) => entry.id === btn.dataset.showTimeslots);
        if (line) line.timeslotsRevealed = !line.timeslotsRevealed;
        renderMoreEditorPanel(lineId);
      });
    });
    host.querySelectorAll('[data-allocation-select]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const line = cartLines.find((entry) => entry.id === btn.dataset.allocationSelect);
        if (line) line.allocationSelected = !line.allocationSelected;
        showToast(line && line.allocationSelected ? 'Unallocated Standard Item selected for allocation' : 'Allocation card deselected');
        renderMoreEditorPanel(lineId);
      });
    });
  }

  function renderMoreEditorPanel(lineId) {
    const line = cartLines.find((entry) => entry.id === lineId);
    const host = $('#cie-panel-more-content');
    if (!line || !host) return;
    host.innerHTML = `<div class="detail-panel">${renderDetailPanel(line, false)}</div>`;
    bindMorePanelEvents(host, lineId);
  }

  function initTimeEditor(ids) {
    const draftTarget = cartItemEditorTargetsStagedSelection();
    const uniqueIds = draftTarget
      ? (stagedSelection ? [STAGED_SELECTION_EDITOR_ID] : [])
      : Array.from(new Set(ids)).filter((id) => !!getEditorTargetRecord(id));
    if (!uniqueIds.length) return false;
    const drafts = {};
    uniqueIds.forEach((id) => {
      const line = draftTarget ? stagedSelection : getEditorTargetRecord(id);
      drafts[id] = { candidate: { ...line }, checked: true };
    });
    timeEditor = { ids: uniqueIds, mode: 'common', drafts, candidates: {}, target: draftTarget ? 'staged-selection' : 'cart-line' };
    const first = draftTarget ? stagedSelection : getEditorTargetRecord(uniqueIds[0]);
    if (j1MultiDay(first)) return true; // No continuous overnight editor for a daily rectangle.
    const start = toDateAndTime(lineInterval(first).start);
    const end = toDateAndTime(lineInterval(first).end);
    $('#time-start-date').value = start.date;
    $('#time-start-time').value = start.time;
    $('#time-end-date').value = end.date;
    $('#time-end-time').value = end.time;
    $('#time-keep-duration').checked = true;
    $('#time-mode-common').checked = true;
    $('#time-mode-different').checked = false;
    $('#time-mode-fieldset').hidden = uniqueIds.length === 1;
    $('#time-common-grid').hidden = false;
    $('#different-time-list').hidden = true;
    renderDifferentTimeRows();
    evaluateTimeEditor();
    return true;
  }

  function initConfigurationEditor(ids) {
    const draftTarget = cartItemEditorTargetsStagedSelection();
    if (draftTarget) {
      if (!stagedSelection) return false;
      configurationEditor = { ids: [STAGED_SELECTION_EDITOR_ID], selected: new Set([STAGED_SELECTION_EDITOR_ID]), configuration: $('#cfg-configuration')?.value || (CONFIGURATIONS[stagedSelection.asset] || [])[0] };
      renderConfigurationEditor();
      return true;
    }
    const uniqueIds = Array.from(new Set(ids)).filter((id) => !!getEditorTargetRecord(id));
    if (!uniqueIds.length) return false;
    const first = getEditorTargetRecord(uniqueIds[0]);
    configurationEditor = { ids: uniqueIds, selected: new Set(uniqueIds), configuration: first.configuration || (CONFIGURATIONS[first.asset] || [])[0] };
    renderConfigurationEditor();
    return true;
  }

  function initPackageEditor(id) {
    if (cartItemEditorTargetsStagedSelection()) {
      if (!stagedSelection) return false;
      const packageId = getCommitted('package');
      const packageState = getStagedPackageState(false);
      packageEditor = {
        lineId: STAGED_SELECTION_EDITOR_ID,
        target: 'staged-selection',
        package: packageId,
        quantity: packageState.quantity == null ? '' : packageState.quantity,
        attendees: packageState.attendees == null ? '' : packageState.attendees,
        includedItems: packageState.includedItems.size ? packageState.includedItems : new Set(packageMeta(packageId).includedItems || [])
      };
      renderPackageEditor();
      return true;
    }
    const line = getEditorTargetRecord(id);
    if (!line) return false;
    packageEditor = {
      lineId: id,
      package: line.package,
      quantity: line.packageQuantity == null ? '' : line.packageQuantity,
      attendees: line.packageAttendees == null ? '' : line.packageAttendees,
      includedItems: new Set(line.includedItems || packageMeta(line.package).includedItems || [])
    };
    renderPackageEditor();
    return true;
  }

  function initPricingEditor(id) {
    if (cartItemEditorTargetsStagedSelection()) {
      if (!stagedSelection) return false;
      setStagedPricingSurface(true);
      pricingEditor = { lineId: STAGED_SELECTION_EDITOR_ID, target: 'staged-selection', concession: getCommitted('concession') };
      $('#pricing-concession').value = getCommitted('concession') || 'review-fixture';
      return true;
    }
    const line = getEditorTargetRecord(id);
    if (!line) return false;
    pricingEditor = { lineId: id };
    const configs = CONFIGURATIONS[line.asset] || [];
    $('#pricing-configuration').innerHTML = configs.map((config) => `<option value="${config}">${escapeHtml(configurationLabel(config))}</option>`).join('');
    $('#pricing-configuration').value = line.configuration || configs[0];
    $('#pricing-option').value = line.pricingOption || 'standard';
    $('#pricing-concession').value = line.concession || 'review-fixture';
    const mode = line.priceMode || 'default';
    const radio = $(`input[name="price-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    $('#pricing-type').value = line.priceType || 'standard-rate';
    $('#pricing-unit').value = line.pricingUnit || 'hour';
    $('#changed-price-fields').hidden = mode !== 'change';
    const amount = Number.isFinite(line.amount) ? line.amount : 2750;
    $('#pricing-amount').textContent = j1MultiDay(line) ? 'Quote pending · multi-day review fixture'
      : `AU$ ${amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
    return true;
  }

  function ensureEditorTabInitialized(tab) {
    if (!cartItemEditor) return false;
    const ids = cartItemEditor.ids;
    switch (tab) {
      case 'time':
        if (!timeEditor || !sameIdSet(timeEditor.ids, ids)) return initTimeEditor(ids);
        return true;
      case 'config':
        if (!configurationEditor || !sameIdSet(configurationEditor.ids, ids)) return initConfigurationEditor(ids);
        return true;
      case 'package':
        if (!packageEditor || packageEditor.lineId !== ids[0]) return initPackageEditor(ids[0]);
        return true;
      case 'pricing':
        if (!pricingEditor || pricingEditor.lineId !== ids[0]) return initPricingEditor(ids[0]);
        return true;
      case 'more':
        renderMoreEditorPanel(ids[0]);
        return true;
      default:
        return false;
    }
  }

  function openStagedConfigurePath(tab) {
    if (!cartItemEditorTargetsStagedSelection() || !stagedSelection) return;
    const focusTargets = {
      config: '#cfg-configuration',
      package: '#cfg-package-input',
      pricing: '#cfg-concession-input'
    };
    const labels = {
      config: 'Configuration',
      package: 'Package',
      pricing: 'Pricing'
    };
    const selector = focusTargets[tab];
    if (!selector) return;
    closeCartItemEditor(false);
    setCurrentSelectionDetailsExpanded(true);
    requestAnimationFrame(() => $(selector)?.focus({ preventScroll: true }));
    announceLive(`${labels[tab]} controls opened in the existing Current selection form.`);
  }

  function switchCartItemEditorTab(tab) {
    if (!cartItemEditor) return;
    if (pickerOpen) closePicker({ restore: true, refocus: false });
    if (!ensureEditorTabInitialized(tab)) return;
    setEditorTab(tab);
    focusEditorTab(tab);
    updateCartUI();
  }

  function openCartItemEditor(tab, idsOrId, trigger) {
    if (isJourney9Route()) { j9BlockReview('Journey 9 item and pricing editors are unavailable.'); return; }
    const ids = (Array.isArray(idsOrId) ? idsOrId : [idsOrId]).filter((id) => cartLines.some((line) => line.id === id));
    if (!ids.length) return;
    const dialog = getCartItemEditorDialog();
    const sameSession = cartItemEditor && !cartItemEditorTargetsStagedSelection() && dialog && dialog.open && sameIdSet(cartItemEditor.ids, ids);
    if (!sameSession) {
      lastDialogTrigger = trigger || document.activeElement;
      cartItemEditor = { ids, tab, target: 'cart-line' };
      timeEditor = null;
      configurationEditor = null;
      packageEditor = null;
      pricingEditor = null;
    } else {
      cartItemEditor.tab = tab;
    }
    setCartItemEditorContext('cart-line');
    if (ids.length === 1) updateEditorTabLabels(ids[0]);
    updateEditorTabAvailability(ids);
    if (!ensureEditorTabInitialized(tab)) return;
    setEditorTab(tab);
    if (!dialog.open) dialog.showModal();
    focusEditorTab(tab);
    updateCartUI();
  }

  function openStagedSelectionEditor(trigger) {
    if (!stagedSelection || editingLineId) return;
    const dialog = getCartItemEditorDialog();
    if (!dialog) return;
    lastDialogTrigger = trigger || document.activeElement;
    cartItemEditor = { ids: [STAGED_SELECTION_EDITOR_ID], tab: 'time', target: 'staged-selection' };
    timeEditor = null;
    configurationEditor = null;
    packageEditor = null;
    pricingEditor = null;
    setCartItemEditorContext('staged-selection');
    updateEditorTabAvailability(cartItemEditor.ids);
    if (!ensureEditorTabInitialized('time')) return;
    setEditorTab('time');
    if (!dialog.open) dialog.showModal();
    updateCartUI();
    syncCurrentSelectionEditControl();
    focusEditorTab('time');
    announceLive('Edit new selection opened on Time. Cart items and total are unchanged.');
  }

  function handleEditorTabKeydown(event) {
    const tabs = Array.from($$('.cart-item-editor-tab')).filter((tab) => !tab.hidden);
    if (!tabs.length) return;
    const currentIndex = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[nextIndex].dataset.editorTab;
    switchCartItemEditorTab(nextTab);
    tabs[nextIndex].focus();
  }

  function openTimeEditor(ids, trigger) {
    openCartItemEditor('time', ids, trigger);
  }

  function renderDifferentTimeRows() {
    const host = $('#different-time-list');
    if (!timeEditor) return;
    const allChecked = timeEditor.ids.every((id) => timeEditor.drafts[id].checked);
    host.innerHTML = `<header class="different-time-head"><div><strong id="different-time-heading">Update Multiple Assets</strong><span>Select staged Booking rows. Dismiss checked here or apply the valid checked changes with the final action below.</span></div><span>${timeEditor.ids.length} eligible rows</span><label><input type="checkbox" id="time-select-all-rows" ${allChecked ? 'checked' : ''}> Select All</label><div class="checked-time-actions"><button type="button" class="btn-ghost btn-sm" id="time-dismiss-checked">Dismiss checked</button></div></header>` + timeEditor.ids.map((id) => {
      const line = timeEditor.drafts[id].candidate;
      const asset = ASSETS.find((entry) => entry.id === line.asset);
      const start = toDateAndTime(lineInterval(line).start);
      const end = toDateAndTime(lineInterval(line).end);
      return `<div class="different-time-row" data-time-row="${id}">
        <label class="different-target"><input type="checkbox" data-time-check="${id}" ${timeEditor.drafts[id].checked ? 'checked' : ''}> ${escapeHtml(asset.name)}</label>
        <label>Start date<input type="date" data-time-field="startDate" data-time-id="${id}" value="${start.date}"></label>
        <label>Start time<input type="time" step="1800" data-time-field="startTime" data-time-id="${id}" value="${start.time}"></label>
        <label>End date<input type="date" data-time-field="endDate" data-time-id="${id}" value="${end.date}"></label>
        <label>End time<input type="time" step="1800" data-time-field="endTime" data-time-id="${id}" value="${end.time}"></label>
      </div>`;
    }).join('');
  }

  function syncCommonDuration() {
    if (!timeEditor || !$('#time-keep-duration').checked) return;
    const first = getTimeEditorRecord(timeEditor.ids[0]);
    if (!first) return;
    const duration = lineDurationMinutes(first);
    const start = new Date(`${$('#time-start-date').value}T${$('#time-start-time').value}:00`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + duration * 60000);
    const parts = toDateAndTime(end);
    $('#time-end-date').value = parts.date;
    $('#time-end-time').value = parts.time;
  }

  function syncDifferentDuration(id) {
    if (!timeEditor || !$('#time-keep-duration').checked) return;
    const row = $(`[data-time-row="${id}"]`);
    const original = getTimeEditorRecord(id);
    if (!row || !original) return;
    const start = new Date(`${row.querySelector('[data-time-field="startDate"]').value}T${row.querySelector('[data-time-field="startTime"]').value}:00`);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + lineDurationMinutes(original) * 60000);
    const parts = toDateAndTime(end);
    row.querySelector('[data-time-field="endDate"]').value = parts.date;
    row.querySelector('[data-time-field="endTime"]').value = parts.time;
  }

  function collectTimeCandidates() {
    const result = {};
    if (!timeEditor) return result;
    if (timeEditor.mode === 'common') {
      timeEditor.ids.forEach((id) => {
        const line = getTimeEditorRecord(id);
        if (!line) return;
        result[id] = candidateFromParts(line, $('#time-start-date').value, $('#time-start-time').value, $('#time-end-date').value, $('#time-end-time').value);
      });
    } else {
      timeEditor.ids.forEach((id) => {
        const row = $(`[data-time-row="${id}"]`);
        const checked = !!row.querySelector(`[data-time-check="${id}"]`).checked;
        timeEditor.drafts[id].checked = checked;
        if (!checked) return;
        const line = getTimeEditorRecord(id);
        if (!line) return;
        result[id] = candidateFromParts(
          line,
          row.querySelector('[data-time-field="startDate"]').value,
          row.querySelector('[data-time-field="startTime"]').value,
          row.querySelector('[data-time-field="endDate"]').value,
          row.querySelector('[data-time-field="endTime"]').value
        );
      });
    }
    return result;
  }

  function evaluateTimeEditor() {
    if (!timeEditor) return false;
    const candidates = collectTimeCandidates();
    const selectAll = $('#time-select-all-rows');
    if (selectAll && timeEditor.mode === 'different') selectAll.checked = timeEditor.ids.every((id) => timeEditor.drafts[id].checked);
    const ids = Object.keys(candidates);
    const draftTarget = timeEditor.target === 'staged-selection';
    let verdict = { ok: false, kind: 'validation', message: draftTarget ? 'Current selection time is required.' : 'Select at least one staged Cart line.' };
    if (ids.length) {
      verdict = { ok: true, kind: 'available', message: draftTarget ? 'Current selection draft is available in this review fixture.' : `${ids.length} staged ${ids.length === 1 ? 'line is' : 'lines are'} available in this review fixture.` };
      for (const id of ids) {
        const candidateVerdict = checkCandidateAvailability(candidates[id], new Set(timeEditor.ids));
        if (!candidateVerdict.ok) { verdict = candidateVerdict; break; }
      }
    }
    timeEditor.candidates = candidates;
    timeEditor.verdict = verdict;
    const status = $('#time-availability');
    status.className = `availability-result is-${verdict.kind}`;
    status.textContent = verdict.message;
    const confirmButton = $('#time-confirm');
    confirmButton.disabled = !verdict.ok;
    if (timeEditor.mode === 'different') confirmButton.textContent = ids.length === 1 ? 'Apply 1 checked time change' : `Apply ${ids.length} checked time changes`;
    else confirmButton.textContent = ids.length === 1 ? 'Confirm time change' : `Confirm ${ids.length} time changes`;
    return verdict.ok;
  }

  function confirmTimeUpdate() {
    if (!timeEditor || !evaluateTimeEditor()) return;
    const draftTarget = timeEditor.target === 'staged-selection';
    if (draftTarget) {
      const candidate = timeEditor.candidates[STAGED_SELECTION_EDITOR_ID];
      if (!candidate || !stagedSelection) return;
      stagedSelection = {
        ...stagedSelection,
        date: candidate.date,
        startH: candidate.startH,
        startM: candidate.startM,
        endDate: candidate.endDate,
        endH: candidate.endH,
        endM: candidate.endM
      };
      timeEditor = null;
      ensureEditorTabInitialized('time');
      setEditorTab('time');
      showToast('Current selection time updated · Add to cart is still required');
      updateCartUI();
      renderCalendar();
      focusEditorTab('time');
      return;
    }
    Object.entries(timeEditor.candidates).forEach(([id, candidate]) => {
      const idx = cartLines.findIndex((line) => line.id === id);
      if (idx < 0) return;
      cartLines[idx] = {
        ...cartLines[idx],
        date: candidate.date,
        startH: candidate.startH,
        startM: candidate.startM,
        endDate: candidate.endDate,
        endH: candidate.endH,
        endM: candidate.endM,
        amountPending: false,
        priceStatus: 'Recalculated · local review fixture; formula open'
      };
    });
    const count = Object.keys(timeEditor.candidates).length;
    closeCartItemEditor();
    showToast(`${count} staged ${count === 1 ? 'time' : 'times'} updated · pricing recalculated as review fixtures`);
    updateCartUI();
    renderCalendar();
  }

  function openConfigurationEditor(ids, trigger) {
    openCartItemEditor('config', ids, trigger);
  }

  function availableConfigurationsFor(ids) {
    return Array.from(new Set(ids.flatMap((id) => {
      const line = getEditorTargetRecord(id);
      return line ? (CONFIGURATIONS[line.asset] || []) : [];
    })));
  }

  function renderConfigurationEditor() {
    if (!configurationEditor) return;
    const stagedTarget = cartItemEditorTargetsStagedSelection();
    const choices = stagedTarget && stagedSelection
      ? (CONFIGURATIONS[stagedSelection.asset] || [])
      : availableConfigurationsFor(configurationEditor.ids);
    const select = $('#configuration-choice');
    select.innerHTML = choices.map((id) => `<option value="${id}">${escapeHtml(configurationLabel(id))}</option>`).join('');
    if (!choices.includes(configurationEditor.configuration)) configurationEditor.configuration = choices[0];
    select.value = configurationEditor.configuration;
    const isBulk = configurationEditor.ids.length > 1;
    $('#configuration-title').textContent = isBulk ? 'Bulk configuration' : 'Configuration';
    $('#configuration-select-all-row').hidden = !isBulk;
    let compatibleCount = 0;
    $('#configuration-targets').innerHTML = configurationEditor.ids.map((id) => {
      const line = stagedTarget ? stagedSelection : getEditorTargetRecord(id);
      const asset = ASSETS.find((entry) => entry.id === line.asset);
      const compatible = (CONFIGURATIONS[line.asset] || []).includes(configurationEditor.configuration);
      if (compatible) compatibleCount += 1; else configurationEditor.selected.delete(id);
      return `<label class="target-row ${compatible ? '' : 'is-disabled'}" title="${compatible ? '' : 'Selected configuration is not available for this facility'}">
        <input type="checkbox" data-config-target="${id}" ${configurationEditor.selected.has(id) ? 'checked' : ''} ${compatible ? '' : 'disabled'}>
        <span><strong>${escapeHtml(asset.name)}</strong><small>${compatible ? configurationLabel(configurationEditor.configuration) : 'Unavailable for this configuration'}</small></span>
      </label>`;
    }).join('');
    const compatibleIds = configurationEditor.ids.filter((id) => {
      const line = stagedTarget ? stagedSelection : getEditorTargetRecord(id);
      return (CONFIGURATIONS[line.asset] || []).includes(configurationEditor.configuration);
    });
    $('#configuration-select-all').checked = compatibleIds.length > 0 && compatibleIds.every((id) => configurationEditor.selected.has(id));
    $('#configuration-status').className = 'availability-result is-available';
    $('#configuration-status').textContent = `${compatibleCount} of ${configurationEditor.ids.length} selected facilities support this review Configuration.`;
    $('#configuration-apply').disabled = configurationEditor.selected.size === 0;
  }

  function applyConfigurationUpdate() {
    if (!configurationEditor || !configurationEditor.selected.size) return;
    if (isJourney7Route() && configurationEditor.configuration !== 'theatre') {
      j7BlockReview('Journey 7 can apply only the accepted Theatre configuration.');
      return;
    }
    if (cartItemEditorTargetsStagedSelection()) {
      const configuration = configurationEditor.configuration;
      if (!(CONFIGURATIONS[stagedSelection?.asset] || []).includes(configuration)) return;
      const control = $('#cfg-configuration');
      if (control) {
        control.value = configuration;
        control.dispatchEvent(new Event('change', { bubbles: true }));
      }
      configurationEditor.configuration = configuration;
      renderConfigurationEditor();
      setEditorTab('config');
      showToast('Configuration updated for the current selection draft · Add to cart is still required');
      updateCartUI();
      return;
    }
    configurationEditor.selected.forEach((id) => {
      const line = getEditorTargetRecord(id);
      if (line && (CONFIGURATIONS[line.asset] || []).includes(configurationEditor.configuration)) line.configuration = configurationEditor.configuration;
    });
    const count = configurationEditor.selected.size;
    closeCartItemEditor();
    showToast(`${count} ${count === 1 ? 'facility' : 'facilities'} updated · review Configuration`);
    updateCartUI();
  }

  function openPackageEditor(id, trigger) {
    openCartItemEditor('package', id, trigger);
  }

  function renderPackageEditor() {
    if (!packageEditor) return;
    const rec = getPackageRecord(packageEditor.package);
    const meta = packageMeta(packageEditor.package);
    $('#package-picker-btn').textContent = compactOptionLabel(rec.label);
    let conditional = '';
    if (meta.type === 'quantity') {
      conditional = `<label class="dialog-field">Quantity<input type="number" id="package-value" min="${meta.min}" max="${meta.max}" value="${escapeHtml(packageEditor.quantity)}" placeholder="${meta.min}–${meta.max}"><small>Quantity ${meta.min}–${meta.max} for this review Package fixture.</small></label>`;
    } else if (meta.type === 'attendees') {
      conditional = `<label class="dialog-field">Attendees<input type="number" id="package-value" min="${meta.min}" max="${meta.max}" value="${escapeHtml(packageEditor.attendees)}" placeholder="${meta.min}–${meta.max}"><small>Attendees ${meta.min}–${meta.max} for this review Package fixture.</small></label>`;
    }
    const included = (meta.includedItems || []).map((itemId) => `<label><input type="checkbox" data-package-included="${itemId}" ${packageEditor.includedItems.has(itemId) ? 'checked' : ''}> ${escapeHtml(getItemRecord(itemId).label)}</label>`).join('');
    $('#package-editor-fields').innerHTML = `${conditional}${included ? `<fieldset class="included-items"><legend>Included Package Items</legend><label class="select-all-included"><input type="checkbox" id="package-select-all"> Select all</label>${included}</fieldset>` : '<p class="empty-package">Item-only booking — no Package contents.</p>'}`;
    const all = Array.from($$('[data-package-included]'));
    const selectAll = $('#package-select-all');
    if (selectAll) selectAll.checked = all.length > 0 && all.every((input) => input.checked);
    $('#package-status').textContent = meta.type === 'none' ? 'No conditional Package field.' : `${meta.type === 'quantity' ? 'Quantity' : 'Attendees'} is shown only for this Package type.`;
    $('#package-status').className = 'availability-result is-available';
  }

  function validatePackageEditor() {
    if (!packageEditor) return false;
    const meta = packageMeta(packageEditor.package);
    if (meta.type === 'none') return true;
    const input = $('#package-value');
    const value = input && input.value !== '' ? Number(input.value) : NaN;
    const valid = Number.isFinite(value) && value >= meta.min && value <= meta.max;
    if (!valid) {
      input.setAttribute('aria-invalid', 'true');
      $('#package-status').className = 'availability-result is-validation';
      $('#package-status').textContent = `${meta.type === 'quantity' ? 'Quantity' : 'Attendees'} must be between ${meta.min} and ${meta.max}.`;
      input.focus();
      return false;
    }
    if (meta.type === 'quantity') packageEditor.quantity = value; else packageEditor.attendees = value;
    return true;
  }

  function applyPackageUpdate() {
    if (!validatePackageEditor()) return;
    if (cartItemEditorTargetsStagedSelection()) {
      if (isJourney7Route() && packageEditor.package !== 'private-day') {
        j7BlockReview('Journey 7 can apply only the accepted Private Day Hire package.');
        return;
      }
      const meta = packageMeta(packageEditor.package);
      const quantity = meta.type === 'quantity' ? packageEditor.quantity : null;
      const attendees = meta.type === 'attendees' ? packageEditor.attendees : null;
      const includedItems = Array.from($$('[data-package-included]:checked')).map((input) => input.dataset.packageIncluded);
      setCommitted('package', packageEditor.package, { notify: false });
      stagedSelection.packageQuantity = quantity;
      stagedSelection.packageAttendees = attendees;
      stagedSelection.includedItems = includedItems;
      updateConfigureForm();
      const valueInput = $('#cfg-package-quantity') || $('#cfg-package-attendees');
      if (valueInput) valueInput.value = meta.type === 'quantity' ? String(quantity ?? '') : meta.type === 'attendees' ? String(attendees ?? '') : '';
      $$('[data-staged-included]').forEach((input) => { input.checked = includedItems.includes(input.dataset.stagedIncluded); });
      packageEditor.quantity = quantity == null ? '' : quantity;
      packageEditor.attendees = attendees == null ? '' : attendees;
      packageEditor.includedItems = new Set(includedItems);
      renderCurrentSelectionSummary();
      updatePrimaryAction();
      renderPackageEditor();
      setEditorTab('package');
      showToast('Package and included Items updated for the current selection draft · Add to cart is still required');
      updateCartUI();
      return;
    }
    const line = getEditorTargetRecord(packageEditor.lineId);
    if (!line) return;
    if (isJourney7Route() && packageEditor.package !== 'private-day') {
      j7BlockReview('Journey 7 can apply only the accepted Private Day Hire package.');
      return;
    }
    const meta = packageMeta(packageEditor.package);
    line.package = packageEditor.package;
    line.packageQuantity = meta.type === 'quantity' ? packageEditor.quantity : null;
    line.packageAttendees = meta.type === 'attendees' ? packageEditor.attendees : null;
    line.includedItems = Array.from($$('[data-package-included]:checked')).map((input) => input.dataset.packageIncluded);
    line.priceStatus = 'Recalculated after Package change · review fixture';
    closeCartItemEditor();
    showToast('Package and included Items updated · booking is not saved');
    updateCartUI();
  }

  function j7ReviewSnapshot() {
    if (!isJourney7Route()) return null;
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const editorSnapshot = (editor) => editor ? {
      ...editor,
      includedItems: editor.includedItems instanceof Set ? Array.from(editor.includedItems) : editor.includedItems
    } : null;
    return {
      cartLines: clone(cartLines),
      phase: draft.phase,
      stagedSelection: clone(stagedSelection),
      draft: clone(draft),
      editors: {
        time: clone(timeEditor),
        configuration: clone(configurationEditor),
        package: editorSnapshot(packageEditor),
        pricing: clone(pricingEditor),
        cartItem: clone(cartItemEditor)
      },
      created: clone(draft.created)
    };
  }

  function j7ReviewInvokeForbiddenPackageGuard() {
    if (!isJourney7Route()) return { invoked: false, blocked: false, reason: 'not-journey-7' };
    const original = packageEditor;
    const lineId = original?.lineId || cartLines[0]?.id;
    if (!lineId) return { invoked: false, blocked: false, reason: 'no-stored-line' };
    const before = j7ReviewSnapshot();
    packageEditor = {
      lineId,
      package: 'forbidden-review-package',
      quantity: null,
      attendees: 25,
      includedItems: new Set()
    };
    let message = '';
    try {
      applyPackageUpdate();
      message = $('#toast-region')?.textContent || '';
    } finally {
      packageEditor = original;
    }
    const after = j7ReviewSnapshot();
    return {
      invoked: true,
      blocked: before && after && JSON.stringify(before) === JSON.stringify(after),
      message,
      before,
      after
    };
  }

  function openPricingEditor(id, trigger) {
    if (isJourney9Route()) { j9BlockReview('Journey 9 pricing and item editors are outside the local recurrence review.'); return; }
    if (isJourney7Route()) {
      j7BlockReview('Journey 7 alternate pricing/editor choices are unavailable; the accepted local pricing fixture is read-only.');
      return;
    }
    openCartItemEditor('pricing', id, trigger);
  }

  function applyPricingUpdate() {
    if (isJourney9Route()) { j9BlockReview('Journey 9 pricing updates are unavailable.'); return; }
    if (!pricingEditor) return;
    if (cartItemEditorTargetsStagedSelection()) {
      const concession = $('#pricing-concession').value;
      pricingEditor.concession = concession;
      setCommitted('concession', concession);
      setEditorTab('pricing');
      showToast('Concession applied to the current selection draft · Add to cart is still required');
      updateCartUI();
      return;
    }
    const line = getEditorTargetRecord(pricingEditor.lineId);
    if (!line) return;
    const mode = $('input[name="price-mode"]:checked').value;
    const pricingOption = $('#pricing-option').value;
    const concession = $('#pricing-concession').value;
    const priceType = mode === 'change' ? $('#pricing-type').value : 'default';
    const pricingUnit = mode === 'change' ? $('#pricing-unit').value : null;
    if (isJourney7Route() && (mode !== 'default' || pricingOption !== 'standard' || concession !== 'review-fixture' || priceType !== 'default' || pricingUnit !== null)) {
      j7BlockReview('Journey 7 cannot apply alternate pricing type, unit, Item option or concession choices.');
      return;
    }
    line.configuration = $('#pricing-configuration').value;
    line.pricingOption = pricingOption;
    line.concession = concession;
    line.priceMode = mode;
    line.priceType = priceType;
    line.pricingUnit = pricingUnit;
    line.amountPending = j1MultiDay(line);
    line.priceStatus = j1MultiDay(line)
      ? 'Pricing choices recorded · multi-day local review; total policy unconfirmed'
      : 'Pricing choices applied · local review fixture; formula open';
    closeCartItemEditor();
    showToast('Pricing choices applied · booking is not saved');
    updateCartUI();
  }

  function handlePrimaryAction() {
    if (isJourney9Route()) { j9BlockReview(); return; }
    const ctx = getPrimaryContext();
    switch (ctx) {
      case 'empty':
        document.body.dataset.surface = 'week';
        setSheetExpanded(false);
        $('#calendar').focus();
        showToast('Select an available interval on the calendar');
        break;
      case 'add':
      case 'edit':
        addToCart();
        break;
      case 'another':
        stagedSelection = null;
        editingLineId = null;
        setPhase('select');
        updateCartUI();
        setStage('l');
        document.body.dataset.surface = 'week';
        setSheetExpanded(false);
        $('#calendar').focus();
        showToast('Select another available interval on the calendar');
        break;
      case 'unavailable':
        draft.unavailableSelection = null;
        setPhase(cartLines.length > 0 ? 'cart' : 'select');
        updateCartUI();
        document.body.dataset.surface = 'week';
        setSheetExpanded(false);
        $('#calendar').focus();
        showToast('Select an available interval on the calendar');
        break;
      default:
        break;
    }
  }

  function confirmBooking() {
    if (document.body.dataset.journey === '1' && cartLines.some(j1MultiDay)) {
      announceAlert('Multi-day selection is a local review fixture only. Booking creation is unavailable.');
      return;
    }
    if (isJourney9Route()) { j9BlockReview('Journey 9 cannot create a Booking or show a Booking-created success state.'); return; }
    if (isJourney7Route()) {
      j7BlockReview('Journey 7 cannot create a Booking or open an external handoff.');
      j7SyncRouteState();
      return;
    }
    if (!cartLines.length || stagedSelection || editingLineId) return;
    const line = cartLines[0];
    draft.created = {
      id: 'BK-LOCAL-001',
      ...line
    };
    cartLines = [];
    selectedLineIds.clear();
    stagedSelection = null;
    editingLineId = null;
    expandedLineId = null;
    expandedMode = null;
    closeCartItemEditor(false);
    draft.stressCount = null;
    setPhase('success');
    setStage('o');
    showToast('Booking is created.');
    announceLive('Booking is created. Production Diary continues to the external Booking App.');
    updateCartUI();
    renderCalendar();
    if (document.body.dataset.journey === '1') k1Focus.move($('#cart-success .success-message'), '#confirm-booking-btn');
  }


  function renderAssetTree() {
    const rows = getAssetDisplayRows();
    flatAssetRows = rows;
    const scrollEl = $('#asset-tree');
    const vp = $('#asset-tree-viewport');
    const total = rows.length;
    const rowH = j3GetTreeRowHeight();
    const win = computeWindow(assetScroll, scrollEl.clientHeight || 300, rowH, total);
    vp.style.height = win.totalHeight + 'px';
    let html = '';
    for (let i = win.start; i < win.end; i++) {
      const r = rows[i];
      const top = i * rowH;
      const ind = (r.level - 1) * 14;
      const active = i === assetActive ? ' active' : '';
      const rowId = treeRowId(r);
      if (r.kind === 'resource') {
        const a = r.asset;
        const checked = selectedAssets.has(a.id) ? ' checked' : '';
        const te = (a.color || a.tint) === 'teal' ? ' teal' : '';
        const generated = !isJ3Journey() && (r.meta === 'Resource · generated' || (r.search && a.journey === false));
        const rowClass = generated ? ' generated-fixture-resource' : '';
        const rowLabel = generated
          ? ' aria-label="' + escapeHtml(a.name) + ', generated review fixture resource, ' + escapeHtml(a.venue) + ', ' + escapeHtml(a.category) + '"'
          : (!isJ3Journey()
            ? ' aria-label="' + escapeHtml(a.name) + ', Journey resource, ' + escapeHtml(a.venue) + ', ' + escapeHtml(a.category) + '"'
            : '');
        const metaHtml = isJ3Journey()
          ? '<span class="j3-capacity-badge">' + a.capacity + '</span>'
          : (generated ? '' : '<span class="tree-meta">' + r.meta + '</span>');
        html += '<div class="tree-row' + rowClass + active + '" id="' + rowId + '" role="treeitem" aria-level="' + r.level + '"' + rowLabel + ' data-idx="' + i + '" data-res="' + a.id + '" style="top:' + top + 'px;padding-left:' + (8 + ind) + 'px"><input type="checkbox" class="tree-check' + te + '" data-res="' + a.id + '" aria-label="Select ' + a.name + '"' + checked + '><span class="tree-name">' + a.name + '</span>' + metaHtml + '</div>';
      } else {
        const exp = r.expanded ? '▾' : '▸';
        const fixtureClass = r.kind === 'fixture-group' ? ' scalability-fixture-group' : '';
        const fixtureAttrs = r.kind === 'fixture-group'
          ? ' data-scalability-fixtures="true" data-fixture-count="' + r.fixtureCount + '" aria-label="Scalability review fixtures, ' + r.fixtureCount + ' resources, ' + (r.expanded ? 'expanded' : 'collapsed') + '"'
          : '';
        const generatedNode = !isJ3Journey() && (r.meta.includes('generated') || String(r.key).startsWith('gv-'));
        const nodeType = generatedNode
          ? 'generated review fixture ' + (r.kind === 'venue' ? 'venue' : 'category')
          : (r.kind === 'venue' ? 'Journey fixture venue' : 'Journey resource category');
        const nodeLabel = !isJ3Journey() && r.kind !== 'fixture-group'
          ? ' aria-label="' + escapeHtml(r.name) + ', ' + nodeType + ', ' + (r.expanded ? 'expanded' : 'collapsed') + '"'
          : '';
        html += '<div class="tree-row' + fixtureClass + active + '" id="' + rowId + '" role="treeitem" aria-expanded="' + (r.expanded ? 'true' : 'false') + '" aria-level="' + r.level + '"' + nodeLabel + ' data-idx="' + i + '" data-toggle="' + r.key + '"' + fixtureAttrs + ' style="top:' + top + 'px;padding-left:' + (8 + ind) + 'px"><button type="button" class="tree-toggle" tabindex="-1" aria-hidden="true">' + exp + '</button><span class="tree-name">' + r.name + '</span><span class="tree-meta">' + r.meta + '</span></div>';
      }
    }
    vp.innerHTML = html;
    syncTreeAria(rows);
    const selCount = selectedAssets.size;
    if (isJ3Journey()) {
      const eligible = j3GetEligibleAssets().length;
      $('#asset-count-chip').textContent = J3_FIXTURE_CATALOG.length + ' REVIEW FIXTURE resources';
      const showStart = total ? win.start + 1 : 0;
      const showEnd = total ? win.end : 0;
      const copyEl = $('#asset-window-copy');
      if (total === 0) {
        if (copyEl) {
          copyEl.innerHTML = 'No matches for current filters (prototype behaviour — exact live wording <span class="badge badge-scope">UNCONFIRMED</span>). Use <b>Reset filters</b> to restore the default eligible list.';
          copyEl.classList.remove('visually-hidden');
        }
      } else {
        if (copyEl) {
          copyEl.innerHTML = fmt(J3_FIXTURE_CATALOG.length) + ' REVIEW FIXTURE resources · ' + fmt(eligible) + ' eligible · showing <b>' + showStart + '–' + showEnd + '</b> of ' + fmt(total) + ' visible rows · not a tenant catalogue';
          copyEl.classList.add('visually-hidden');
        }
      }
      j3SyncFilterStatus(rows.filter((row) => row.kind === 'resource').length);
    } else {
      $('#asset-count-chip').textContent = fmt(reviewScale) + ' resources · ' + selCount + ' selected';
      const showStart = total ? win.start + 1 : 0;
      const showEnd = total ? win.end : 0;
      const copyEl = $('#asset-window-copy');
      if (copyEl) {
        copyEl.classList.remove('visually-hidden');
        copyEl.innerHTML = fmt(reviewScale) + ' resources · showing <b>' + showStart + '–' + showEnd + '</b> of ' + fmt(total) + ' · Review fixture data';
      }
    }
    renderSelectedStrip();
  }

  function buildSlotClasses(assetId, dk, slot) {
    const classes = ['cal-slot'];
    const free = isFreeSlot(assetId, dk, slot);
    if (free) classes.push('free');
    if (isInCart(assetId, dk, slot)) classes.push('in-cart');
    if (isCreatedSlot(assetId, dk, slot)) classes.push('created');
    if (['1', '12'].includes(document.body.dataset.journey) && slotLayout === 'column') {
      const range = activeColumnRange(assetId, dk);
      if (range && slot >= range.startSlot && slot < range.endSlot) {
        classes.push('selected-range');
        if (slot === range.startSlot) classes.push('range-start');
        if (slot === range.endSlot - 1) classes.push('range-end');
      }
      return classes.join(' ');
    }
    if (stagedSelection) {
      const s = stagedSelection;
      if (s.asset === assetId && s.date === dk) {
        const range = slotRangeForSelection(s);
        if (slot >= range.startSlot && slot < range.endSlot) {
          classes.push('selected-range');
          if (slot === range.startSlot) classes.push('range-start');
          if (slot === range.endSlot - 1) classes.push('range-end');
        }
      }
    }
    if (dragState && dragState.asset === assetId && dragState.date === dk) {
      const minS = Math.min(dragState.startSlot, dragState.endSlot);
      const maxS = Math.max(dragState.startSlot, dragState.endSlot);
      if (slot >= minS && slot <= maxS) {
        classes.push('selected-range');
        if (slot === minS) classes.push('range-start');
        if (slot === maxS) classes.push('range-end');
      }
    }
    return classes.join(' ');
  }

  function syncSlotLayoutControl() {
    document.body.dataset.slotLayout = slotLayout;
    const calendar = $('#calendar');
    if (calendar) calendar.dataset.slotLayout = slotLayout;
    $$('.slot-layout-btn[data-slot-layout]').forEach((button) => {
      const active = button.dataset.slotLayout === slotLayout;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setSlotLayout(nextLayout, announce) {
    if (nextLayout !== 'stack' && nextLayout !== 'column') return;
    if (slotLayout === nextLayout) {
      syncSlotLayoutControl();
      return;
    }
    slotLayout = nextLayout;
    syncSlotLayoutControl();
    renderCalendar();
    if (announce !== false) {
      announceLive(nextLayout === 'stack'
        ? 'Stack view. Slots are shown in chronological stacked rows with explicit times.'
        : 'Column view. Slots are positioned against the time grid.');
    }
  }

  function stackTimeLabel(item) {
    if (item.allDay) return 'All day';
    const start = slotToTime(item.startSlot);
    const end = slotToTime(item.endSlot);
    return `${formatTime(start.h, start.m)}–${formatTime(end.h, end.m)}`;
  }

  function collectStackItems(assetId, dk) {
    const slots = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
    const items = [];

    EVENTS.forEach((event) => {
      if (event.asset !== assetId || event.date !== dk) return;
      items.push({
        id: `event-${event.id}`,
        kind: 'event',
        source: event,
        allDay: !!event.allDay,
        startSlot: event.allDay ? 0 : Math.max(0, timeToSlot(event.start, 0)),
        endSlot: event.allDay ? slots : Math.min(slots, timeToSlot(event.end, 0))
      });
    });

    cartLines.forEach((line, index) => {
      if (line.asset !== assetId || !j1SelectionIncludesDate(line, dk)) return;
      if (editingLineId === line.id && stagedSelection) return;
      const range = slotRangeForSelection(line);
      items.push({ id: `cart-${line.id}`, kind: 'cart', source: line, startSlot: range.startSlot, endSlot: Math.min(slots, range.endSlot), order: index });
    });

    if (stagedSelection && stagedSelection.asset === assetId && j1SelectionIncludesDate(stagedSelection, dk)) {
      const range = slotRangeForSelection(stagedSelection);
      items.push({ id: 'staged-selection', kind: 'staged', source: stagedSelection, startSlot: range.startSlot, endSlot: Math.min(slots, range.endSlot) });
    }

    if (draft.created && draft.created.asset === assetId && j1SelectionIncludesDate(draft.created, dk)) {
      const range = slotRangeForSelection(draft.created);
      items.push({ id: 'created-booking', kind: 'created', source: draft.created, startSlot: range.startSlot, endSlot: Math.min(slots, range.endSlot) });
    }

    let freeStart = null;
    for (let slot = 0; slot <= slots; slot++) {
      const free = slot < slots && isFreeSlot(assetId, dk, slot);
      if (free && freeStart === null) freeStart = slot;
      if (!free && freeStart !== null) {
        items.push({ id: `available-${freeStart}-${slot}`, kind: 'available', startSlot: freeStart, endSlot: slot });
        freeStart = null;
      }
    }

    const priority = { event: 0, created: 1, staged: 2, cart: 3, available: 4 };
    return items.sort((a, b) =>
      a.startSlot - b.startSlot ||
      (priority[a.kind] || 9) - (priority[b.kind] || 9) ||
      a.endSlot - b.endSlot ||
      String(a.id).localeCompare(String(b.id))
    );
  }

  function addStackCardCopy(card, time, title, state) {
    const head = document.createElement('span');
    head.className = 'stack-card-head';
    const timeEl = document.createElement('span');
    timeEl.className = 'stack-card-time';
    timeEl.textContent = time;
    const stateEl = document.createElement('span');
    stateEl.className = 'stack-card-state';
    stateEl.textContent = state;
    head.append(timeEl, stateEl);
    const titleEl = document.createElement('strong');
    titleEl.className = 'stack-card-title';
    titleEl.textContent = title;
    card.append(head, titleEl);
  }

  function renderStackDay(col, lane, dk) {
    const items = collectStackItems(lane.id, dk);
    col.classList.add('is-stack');
    if (dk === dateKey(TODAY) && isCheckpointWeek()) col.classList.add('is-today-column');

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'stack-empty';
      empty.textContent = '—';
      empty.setAttribute('aria-label', 'No fixture slots');
      col.appendChild(empty);
      return;
    }

    items.forEach((item, itemIndex) => {
      const time = stackTimeLabel(item);
      if (item.kind === 'available') {
        const card = document.createElement('div');
        card.className = 'stack-card stack-available';
        card.dataset.stackIndex = String(itemIndex);
        card.dataset.stackStart = String(item.startSlot);
        card.dataset.stackEnd = String(item.endSlot);
        card.dataset.stackKind = item.kind;
        card.setAttribute('role', 'group');
        card.setAttribute('aria-label', `${lane.name} ${dk} ${time} — Available`);
        addStackCardCopy(card, time, 'Available interval', 'Select');
        const segments = document.createElement('div');
        segments.className = 'stack-range-slots';
        segments.style.gridTemplateColumns = `repeat(${Math.max(1, item.endSlot - item.startSlot)}, minmax(5px, 1fr))`;
        for (let slot = item.startSlot; slot < item.endSlot; slot++) {
          const slotEl = document.createElement('div');
          slotEl.className = `${buildSlotClasses(lane.id, dk, slot)} stack-slot`;
          slotEl.dataset.slot = String(slot);
          slotEl.tabIndex = 0;
          slotEl.setAttribute('role', 'gridcell');
          const value = slotToTime(slot);
          slotEl.setAttribute('aria-label', `${lane.name} ${dk} ${formatTime(value.h, value.m)} — Available`);
          slotEl.addEventListener('mousedown', (event) => onSlotMouseDown(event, lane.id, dk, slot));
          slotEl.addEventListener('mouseenter', () => onSlotMouseEnter(lane.id, dk, slot));
          slotEl.addEventListener('keydown', (event) => onSlotKeydown(event, lane.id, dk, slot));
          segments.appendChild(slotEl);
        }
        card.appendChild(segments);
        col.appendChild(card);
        return;
      }

      if (item.kind === 'event') {
        const event = item.source;
        const interactive = isOccupiedEvent(event);
        const card = document.createElement(interactive ? 'button' : 'div');
        if (interactive) card.type = 'button';
        card.className = `cal-event ${event.type} stack-card stack-event`;
        card.dataset.stackIndex = String(itemIndex);
        card.dataset.stackStart = String(item.startSlot);
        card.dataset.stackEnd = String(item.endSlot);
        card.dataset.stackKind = item.kind;
        applyTimeslotVisual(card, event.type);
        addStackCardCopy(card, time, event.title, event.status);
        card.setAttribute('aria-label', `${lane.name} ${dk} ${time} — ${eventAccessibleLabel(event)}`);
        if (interactive) {
          card.addEventListener('click', () => selectUnavailable(lane.id, dk, event));
          card.addEventListener('keydown', (keyEvent) => {
            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
              keyEvent.preventDefault();
              selectUnavailable(lane.id, dk, event);
            }
          });
        }
        col.appendChild(card);
        return;
      }

      const line = item.source;
      const card = document.createElement('div');
      const state = item.kind === 'created' ? 'Created · Confirmed' : (item.kind === 'staged' ? 'Staged selection' : 'In Cart');
      const title = item.kind === 'created' ? 'BK-LOCAL-001' : getItemRecord(line.item || 'community-hall').label;
      card.className = `stack-card stack-booking ${item.kind === 'created' ? 'created-event' : item.kind === 'staged' ? 'staged' : 'in-cart'}`;
      if (item.kind === 'created') card.id = 'created-event';
      card.dataset.stackIndex = String(itemIndex);
      card.dataset.stackStart = String(item.startSlot);
      card.dataset.stackEnd = String(item.endSlot);
      card.dataset.stackKind = item.kind;
      card.setAttribute('aria-label', `${lane.name} ${dk} ${time} — ${title}, ${state}`);
      addStackCardCopy(card, time, title, state);
      col.appendChild(card);
    });
  }

  function renderCalendar() {
    clearColumnCrosshair();
    if (document.body.dataset.journey === '2') { j2RenderCalendar(); return; }
    // One Calendar candidate: Journeys 4–6 draw their timeslots in the Journey 12 calendar (j4RenderCalendar card board retired).
    const grid = $('#calendar-grid');
    grid.innerHTML = '';
    grid.classList.remove('j4-calendar-grid');
    syncSlotLayoutControl();

    const days = getWeekDays();
    let lanes;
    if (document.body.dataset.journey === '3') {
      lanes = J3_FIXTURE_CATALOG.filter((a) => selectedAssets.has(a.id))
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((a) => ({ id: a.id, name: a.name, venue: a.venue, tint: a.color }));
    } else {
      lanes = ASSETS.filter((a) => selectedAssets.has(a.id) && a.lane)
        .sort((a, b) => ({ hall1: 0, studio2: 1, hall2: 2, studio1: 3 }[a.id] ?? 9) - ({ hall1: 0, studio2: 1, hall2: 2, studio1: 3 }[b.id] ?? 9));
    }
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    let offWeekBanner = document.querySelector('.off-week-banner');
    if (!isCheckpointWeek()) {
      if (!offWeekBanner) {
        offWeekBanner = document.createElement('p');
        offWeekBanner.className = 'off-week-banner';
        offWeekBanner.textContent = 'Checkpoint fixtures are in 24–30 Aug 2026. Today returns to that week.';
        $('#calendar').insertBefore(offWeekBanner, $('#calendar-scroll'));
      }
      offWeekBanner.hidden = false;
    } else if (offWeekBanner) {
      offWeekBanner.hidden = true;
    }

    const header = document.createElement('div');
    header.className = 'cal-header';
    header.setAttribute('role', 'row');
    header.innerHTML = '<div class="cal-corner" role="columnheader"></div>';
    days.forEach((day, di) => {
      const hdr = document.createElement('div');
      hdr.className = 'cal-day-header';
      hdr.dataset.date = dateKey(day);
      hdr.setAttribute('role', 'columnheader');
      const today = dateKey(day) === dateKey(TODAY) && isCheckpointWeek();
      if (today) hdr.classList.add('is-today');
      if (document.body.dataset.journey === '1') {
        const main = document.createElement('span');
        main.className = 'j1-day-main';
        main.textContent = `${dayNames[di]} ${day.getDate()}`;
        const month = document.createElement('span');
        month.className = 'j1-day-month';
        month.textContent = day.toLocaleString('en', { month: 'short' });
        hdr.append(main, month);
        if (today) hdr.setAttribute('aria-label', `Today, ${dayNames[di]} ${day.getDate()} ${month.textContent} ${day.getFullYear()}`);
      } else if (today) {
        hdr.innerHTML = `${dayNames[di]} ${day.getDate()}<span class="today-tag">Today</span>`;
      } else {
        hdr.textContent = `${dayNames[di]} ${day.getDate()}`;
      }
      header.appendChild(hdr);
    });
    grid.appendChild(header);

    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');

    lanes.forEach((lane) => {
      const laneEl = document.createElement('section');
      laneEl.className = 'cal-lane';
      laneEl.setAttribute('aria-label', lane.name);
      laneEl.addEventListener('mouseleave', () => {
        if (!hoverCrosshair || hoverCrosshair.assetId === lane.id) clearColumnCrosshair();
      });

      const title = document.createElement('div');
      title.className = 'cal-lane-title';
      title.textContent = `${lane.name} · ${lane.venue}`;
      laneEl.appendChild(title);

      const body = document.createElement('div');
      body.className = `cal-lane-body${slotLayout === 'stack' ? ' is-stack' : ''}`;

      const gutter = document.createElement('div');
      gutter.className = 'cal-time-gutter';
      if (slotLayout === 'stack') {
        const label = document.createElement('span');
        label.className = 'stack-gutter-label';
        label.textContent = 'Slots';
        gutter.appendChild(label);
      } else {
        for (let h = HOUR_START; h < HOUR_END; h++) {
          for (let half = 0; half < SLOTS_PER_HOUR; half++) {
            const lbl = document.createElement('div');
            lbl.className = 'time-label';
            lbl.dataset.slot = String((h - HOUR_START) * SLOTS_PER_HOUR + half);
            lbl.textContent = half === 0 ? `${String(h).padStart(2, '0')}:00` : '';
            gutter.appendChild(lbl);
          }
        }
      }
      body.appendChild(gutter);

      days.forEach((day) => {
        const dk = dateKey(day);
        const col = document.createElement('div');
        col.className = 'cal-day-col';
        col.dataset.asset = lane.id;
        col.dataset.date = dk;
        if (document.body.dataset.journey === '1' && dk === dateKey(TODAY) && isCheckpointWeek()) col.classList.add('j1-today-column');

        if (slotLayout === 'stack') {
          if (isJ4Journey()) j4RenderStackDay(col, lane, dk); else renderStackDay(col, lane, dk);
          body.appendChild(col);
          return;
        }

        for (let slot = 0; slot < (HOUR_END - HOUR_START) * SLOTS_PER_HOUR; slot++) {
          const slotEl = document.createElement('div');
          slotEl.className = buildSlotClasses(lane.id, dk, slot);
          if (slot % SLOTS_PER_HOUR === 0) slotEl.classList.add('hour-boundary');
          slotEl.dataset.slot = String(slot);
          const ev = getEventAtSlot(lane.id, dk, slot);
          const canSelect = isFreeSlot(lane.id, dk, slot) || isOccupiedEvent(ev);
          slotEl.tabIndex = canSelect ? 0 : -1;
          slotEl.setAttribute('role', 'gridcell');
          const { h, m } = slotToTime(slot);
          let label = `${lane.name} ${dk} ${formatTime(h, m)}`;
          if (isFreeSlot(lane.id, dk, slot)) label += ' — Available';
          else if (isOccupiedEvent(ev)) label += ` — ${ev.status}`;
          slotEl.setAttribute('aria-label', label);

          slotEl.addEventListener('mousedown', (e) => onSlotMouseDown(e, lane.id, dk, slot));
          if (isOneCalendarPointerRoute()) slotEl.addEventListener('pointerdown', (e) => j1StartPointerDrag(e, lane.id, dk, slot));
          slotEl.setAttribute('aria-selected', String(slotEl.classList.contains('selected-range')));
          slotEl.addEventListener('mouseenter', () => onSlotMouseEnter(lane.id, dk, slot));
          slotEl.addEventListener('keydown', (e) => onSlotKeydown(e, lane.id, dk, slot));
          col.appendChild(slotEl);
        }

        EVENTS.forEach((ev) => {
          if (isJ4Journey() || ev.asset !== lane.id || ev.date !== dk) return; // Journeys 4–6 draw their own timeslot fixtures
          const evEl = document.createElement('div');
          evEl.className = `cal-event ${ev.type}`;
          applyTimeslotVisual(evEl, ev.type);
          evEl.setAttribute('role', isOccupiedEvent(ev) ? 'button' : 'presentation');
          evEl.tabIndex = isOccupiedEvent(ev) ? 0 : -1;
          if (ev.allDay) {
            evEl.style.top = '0';
            evEl.style.height = '100%';
          } else {
            const top = timeToSlot(ev.start, 0) * slotH;
            const height = (timeToSlot(ev.end, 0) - timeToSlot(ev.start, 0)) * slotH;
            evEl.style.top = `${top}px`;
            evEl.style.height = `${height}px`;
          }
          if (document.body.dataset.journey === '1') {
            const eventTime = ev.allDay ? 'All day' : `${formatTime(ev.start, 0)}–${formatTime(ev.end, 0)}`;
            evEl.innerHTML = `<strong>${escapeHtml(ev.title)}</strong><span class="j1-event-time">${eventTime}</span><span class="event-status">${escapeHtml(ev.status)}</span>${isOccupiedEvent(ev) ? '<span class="j1-event-menu" aria-hidden="true">⋯</span>' : ''}`;
          } else {
            evEl.innerHTML = `<strong>${ev.title}</strong> <span class="event-status">${ev.status}</span>`;
          }
          evEl.setAttribute('aria-label', eventAccessibleLabel(ev));
          evEl.setAttribute('title', eventAccessibleLabel(ev));
          if (isOccupiedEvent(ev)) {
            evEl.addEventListener('click', () => selectUnavailable(lane.id, dk, ev));
            evEl.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectUnavailable(lane.id, dk, ev);
              }
            });
          }
          col.appendChild(evEl);
        });

        if (isJ4Journey()) j4RenderCalendarBlocks(col, lane.id, dk, slotH);

        if (draft.created && draft.created.asset === lane.id && draft.created.date === dk) {
          const c = draft.created;
          const evEl = document.createElement('div');
          evEl.className = 'cal-event created-event';
          evEl.id = 'created-event';
          const top = timeToSlot(c.startH, c.startM || 0) * slotH;
          const height = (timeToSlot(c.endH, c.endM || 0) - timeToSlot(c.startH, c.startM || 0)) * slotH;
          evEl.style.top = `${top}px`;
          evEl.style.height = `${height}px`;
          evEl.innerHTML = '<strong>BK-LOCAL-001</strong> <span class="event-status">Created — local fixture · Confirmed ✓</span>';
          evEl.setAttribute('aria-label', 'Created booking BK-LOCAL-001 — local fixture.');
          col.appendChild(evEl);
        }

        renderColumnRangeLabel(col, lane.id, dk, slotH);
        body.appendChild(col);
      });

      laneEl.appendChild(body);
      grid.appendChild(laneEl);
    });

    updateNowLine();
    $('#date-range-label').textContent = formatRangeLabel(weekStart);
    document.body.dataset.week = isCheckpointWeek() ? 'checkpoint' : 'other';
    if (isJ4Journey()) j4AfterCalendarRender(grid); else renderTimeslotLegend();
    if (document.body.dataset.journey === '12') document.dispatchEvent(new Event('j12:calendar-rendered'));
  }

  function onSlotKeydown(e, assetId, dk, slot) {
    const slots = (HOUR_END - HOUR_START) * SLOTS_PER_HOUR;
    const col = e.target.closest('.cal-day-col');
    const laneBody = e.target.closest('.cal-lane-body');
    const columns = laneBody ? Array.from(laneBody.querySelectorAll('.cal-day-col')) : [];
    const colIndex = columns.indexOf(col);
    let targetCol = col;
    let next = slot;

    if (e.key === 'ArrowDown') next = Math.min(slot + 1, slots - 1);
    else if (e.key === 'ArrowUp') next = Math.max(slot - 1, 0);
    else if (e.key === 'ArrowRight' && colIndex < columns.length - 1) targetCol = columns[colIndex + 1];
    else if (e.key === 'ArrowLeft' && colIndex > 0) targetCol = columns[colIndex - 1];
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = slots - 1;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const ev = getEventAtSlot(assetId, dk, slot);
      if (isOccupiedEvent(ev)) {
        selectUnavailable(assetId, dk, ev);
        return;
      }
      if (isFreeSlot(assetId, dk, slot) && !oneCalendarSelectionBlocked()) {
        createSelection(assetId, dk, slot, slot + 1);
        if (document.body.dataset.journey === '1') k1Focus.move($('.j1-selection-band.is-primary .j1-selection-handle.is-br'), e.target);
      }
      return;
    } else return;

    e.preventDefault();
    if (!targetCol) return;
    let target = targetCol.querySelector(`.cal-slot[data-slot="${next}"]`);
    if (!target && slotLayout === 'stack') {
      const candidates = Array.from(targetCol.querySelectorAll('.cal-slot'));
      candidates.sort((a, b) => Math.abs(Number(a.dataset.slot) - next) - Math.abs(Number(b.dataset.slot) - next));
      target = candidates[0] || null;
    }
    if (target) target.focus();
  }

  function updateNowLine() {
    const line = $('#now-line');
    // One Calendar candidate (conditional Gate A item 4): drawn inside every lane at the checkpoint's 'now' (08:05) so it
    // scrolls with the calendar and never crosses the lane title, legend or day headers. Journey 1 and Journeys 4-6 keep
    // no now line (accepted behaviour); the August checkpoint has no truthful live-now position.
    if (line) line.hidden = true;
    document.querySelectorAll('#calendar-grid .cal-now-line').forEach((n) => n.remove());
    const journey = document.body.dataset.journey;
    if (journey === '1' || isJ4Journey()) return;
    if (journey === '2' ? !j2InteractiveGrid() : slotLayout === 'stack') return;
    if (!document.querySelector('#calendar-grid .cal-day-header.is-today')) return;
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');
    const top = (5 / 30) * slotH; // 08:05 is five minutes into the first 30-minute row; every grid starts at 08:00
    document.querySelectorAll('#calendar-grid .cal-lane-body').forEach((body) => {
      if (!body.querySelector('.cal-day-col .cal-slot')) return;
      const n = document.createElement('div');
      n.className = 'now-line cal-now-line';
      n.setAttribute('aria-hidden', 'true');
      n.style.top = `${top}px`;
      body.appendChild(n);
    });
  }

  function j1RefreshDragPreview(assetId) {
    if (slotLayout !== 'column') return;
    $$('#calendar-grid .cal-day-col').forEach((col) => {
      if (col.dataset.asset === assetId) refreshColumnSelectionDom(assetId, col.dataset.date);
    });
  }

  function j1DragToPoint(x, y) {
    const state = dragState;
    if (!state?.j1Rectangle) return;
    const col = document.elementsFromPoint(x, y).map((node) => node.closest?.('.cal-day-col')).find((node) => node?.dataset.asset === state.asset);
    if (!col) return;
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h'));
    const slot = Math.max(0, Math.min(23, Math.floor((y - col.getBoundingClientRect().top) / slotH)));
    const date = col.dataset.date;
    if (!['1', '12'].includes(document.body.dataset.journey) && date !== state.anchorDate) return; // multi-day rectangles stay a Journey 1/12 function
    if (state.kind === 'resize' && (date < state.anchorDate || slot < state.anchorSlot)) return;
    const startDate = state.kind === 'resize' ? state.anchorDate : (date < state.anchorDate ? date : state.anchorDate);
    const endDate = state.kind === 'resize' ? date : (date > state.anchorDate ? date : state.anchorDate);
    const startSlot = state.kind === 'resize' ? state.anchorSlot : Math.min(slot, state.anchorSlot);
    const endSlot = state.kind === 'resize' ? slot : Math.max(slot, state.anchorSlot);
    if (!j1RectangleIsFree(state.asset, startDate, endDate, startSlot, endSlot + 1)) return;
    if (state.startDate === startDate && state.endDate === endDate && state.startSlot === startSlot && state.endSlot === endSlot) return;
    Object.assign(state, { startDate, endDate, startSlot, endSlot });
    applyColumnCrosshair(state.asset, date, slot);
    j1RefreshDragPreview(state.asset);
  }

  function j1StartPointerDrag(event, assetId, dk, slot, resize = false) {
    if (!isOneCalendarPointerRoute() || slotLayout !== 'column') return;
    if (oneCalendarSelectionBlocked()) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (resize && (!stagedSelection || stagedSelection.asset !== assetId)) return;
    if (!resize && !isFreeSlot(assetId, dk, slot)) {
      const occupied = getEventAtSlot(assetId, dk, slot);
      if (isOccupiedEvent(occupied)) selectUnavailable(assetId, dk, occupied);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const previous = resize ? stagedSelection : null;
    const range = previous ? slotRangeForSelection(previous) : null;
    dragState = {
      j1Rectangle: true, kind: resize ? 'resize' : 'create', asset: assetId,
      anchorDate: previous ? previous.date : dk, anchorSlot: previous ? range.startSlot : slot,
      startDate: previous ? previous.date : dk, endDate: previous ? previous.endDate || previous.date : dk,
      startSlot: previous ? range.startSlot : slot, endSlot: previous ? range.endSlot - 1 : slot
    };
    applyColumnCrosshair(assetId, dk, slot);
    j1RefreshDragPreview(assetId);
    const scroll = $('#calendar-scroll');
    try { scroll.setPointerCapture(event.pointerId); } catch { /* document listeners still own the gesture */ }
    let pointerX = event.clientX;
    let pointerY = event.clientY;
    let moved = false;
    const move = (e) => {
      if (e.pointerId !== event.pointerId || !dragState?.j1Rectangle) return;
      pointerX = e.clientX;
      pointerY = e.clientY;
      moved = true;
      j1DragToPoint(pointerX, pointerY);
    };
    const edge = setInterval(() => {
      if (!dragState?.j1Rectangle || !moved) return;
      const rect = scroll.getBoundingClientRect();
      if (pointerY < rect.top || pointerY > rect.bottom) return;
      if (pointerX >= rect.right - 24) scroll.scrollLeft += 18;
      else if (pointerX <= rect.left + 24) scroll.scrollLeft -= 18;
      j1DragToPoint(pointerX, pointerY);
    }, 60);
    const finish = (e) => {
      if (e.pointerId !== event.pointerId) return;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', cancel, true);
      clearInterval(edge);
      try { if (scroll.hasPointerCapture(event.pointerId)) scroll.releasePointerCapture(event.pointerId); } catch { /* already released */ }
      if (!dragState?.j1Rectangle) return;
      const final = { ...dragState };
      dragState = null;
      clearColumnCrosshair();
      if (final.kind === 'resize') {
        const start = slotToTime(final.startSlot);
        const end = slotToTime(final.endSlot + 1);
        Object.assign(stagedSelection, { date: final.startDate, endDate: final.endDate, startH: start.h, startM: start.m, endH: end.h, endM: end.m, j1DailyRectangle: true });
        updateCartUI();
        renderCalendar();
      } else {
        createSelection(assetId, final.startDate, final.startSlot, final.endSlot + 1, final.endDate);
      }
    };
    const cancel = (e) => {
      if (e.pointerId !== event.pointerId) return;
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', finish, true);
      document.removeEventListener('pointercancel', cancel, true);
      clearInterval(edge);
      dragState = null;
      clearColumnCrosshair();
      j1RefreshDragPreview(assetId);
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', cancel, true);
  }

  function j1HandleKeydown(event) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) || !stagedSelection) return;
    event.preventDefault();
    event.stopPropagation();
    const dates = getWeekDays().map(dateKey);
    const range = slotRangeForSelection(stagedSelection);
    const endIndex = dates.indexOf(stagedSelection.endDate || stagedSelection.date);
    const nextIndex = endIndex + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0);
    const nextSlot = range.endSlot - 1 + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0);
    if (nextIndex < dates.indexOf(stagedSelection.date) || nextIndex >= dates.length || nextSlot < range.startSlot || !j1RectangleIsFree(stagedSelection.asset, stagedSelection.date, dates[nextIndex], range.startSlot, nextSlot + 1)) {
      announceLive('That daily rectangle includes an unavailable review-fixture cell; selection unchanged.');
      return;
    }
    const end = slotToTime(nextSlot + 1);
    Object.assign(stagedSelection, { endDate: dates[nextIndex], endH: end.h, endM: end.m, j1DailyRectangle: true });
    updateCartUI();
    renderCalendar();
    requestAnimationFrame(() => $('.j1-selection-band.is-primary .j1-selection-handle.is-br')?.focus({ preventScroll: true }));
  }

  function onSlotMouseDown(e, assetId, dk, slot) {
    if (isOneCalendarPointerRoute() && slotLayout === 'column') return; // Journey 12 pointer events (incl. touch) own the gesture.
    if (oneCalendarSelectionBlocked()) return;
    const ev = getEventAtSlot(assetId, dk, slot);
    if (isOccupiedEvent(ev)) {
      selectUnavailable(assetId, dk, ev);
      return;
    }
    if (!isFreeSlot(assetId, dk, slot)) return;
    e.preventDefault();
    dragState = { asset: assetId, date: dk, startSlot: slot, endSlot: slot };
    applyColumnCrosshair(assetId, dk, slot);
    refreshColumnSelectionDom(assetId, dk);
    const onUp = () => {
      document.removeEventListener('mouseup', onUp);
      if (!dragState) return;
      const minS = Math.min(dragState.startSlot, dragState.endSlot);
      const maxS = Math.max(dragState.startSlot, dragState.endSlot);
      dragState = null;
      clearColumnCrosshair();
      createSelection(assetId, dk, minS, maxS + 1);
    };
    document.addEventListener('mouseup', onUp);
  }

  function onSlotMouseEnter(assetId, dk, slot) {
    if (isOneCalendarPointerRoute() && dragState?.j1Rectangle) return;
    if (isJ4Journey() && j4ActionsBlocked()) { clearColumnCrosshair(); return; }
    if (isFreeSlot(assetId, dk, slot)) applyColumnCrosshair(assetId, dk, slot);
    else clearColumnCrosshair();
    if (!dragState || dragState.asset !== assetId || dragState.date !== dk) return;
    if (!isFreeSlot(assetId, dk, slot)) return;
    dragState.endSlot = slot;
    refreshColumnSelectionDom(assetId, dk);
  }

  function captureFocusOrigin(trigger) {
    if (!trigger || typeof trigger.focus !== 'function') return null;
    if (trigger.dataset) {
      if (trigger.dataset.time) return { cartAction: 'time', lineId: trigger.dataset.time };
      if (trigger.dataset.config) return { cartAction: 'config', lineId: trigger.dataset.config };
      if (trigger.dataset.pricing) return { cartAction: 'pricing', lineId: trigger.dataset.pricing };
      if (trigger.dataset.details) return { cartAction: 'more', lineId: trigger.dataset.details };
      if (trigger.dataset.package) {
        return {
          cartAction: 'package',
          lineId: trigger.dataset.package,
          packageCard: !!trigger.closest('.package-card-disclosure')
        };
      }
      if (trigger.dataset.remove) return { cartAction: 'remove', lineId: trigger.dataset.remove };
      if (trigger.dataset.lineDelete) return { cartAction: 'line-delete', lineId: trigger.dataset.lineDelete };
    }
    if (trigger.id) return { elementId: trigger.id };
    return { element: trigger };
  }

  function resolveFocusTarget(origin) {
    if (!origin) return null;
    if (origin.cartAction) {
      const dataAttr = origin.cartAction === 'more' ? 'details' : origin.cartAction === 'line-delete' ? 'line-delete' : origin.cartAction;
      const selector = `[data-${dataAttr}="${origin.lineId}"]`;
      if (origin.cartAction === 'package' && origin.packageCard) {
        const cardBtn = document.querySelector(`.package-card-disclosure ${selector}`);
        if (cardBtn) return cardBtn;
      }
      const line = document.querySelector(`[data-booking-line="${origin.lineId}"]`);
      if (line) {
        const btn = line.querySelector(selector);
        if (btn) return btn;
      }
      return document.querySelector(selector);
    }
    if (origin.elementId) return document.getElementById(origin.elementId);
    if (origin.element) return origin.element.isConnected ? origin.element : null;
    return null;
  }

  function restoreFocusToOrigin(origin) {
    const target = resolveFocusTarget(origin);
    if (target && typeof target.focus === 'function') {
      pickerSuppressFocusOpen = true;
      target.focus();
      pickerSuppressFocusOpen = false;
    }
  }

  function restoreFocus() {
    if (!lastDialogTrigger) return;
    const origin = captureFocusOrigin(lastDialogTrigger);
    lastDialogTrigger = null;
    restoreFocusToOrigin(origin);
  }

  function setSheetExpanded(expanded) {
    document.body.classList.toggle('sheet-expanded', expanded);
    $('#sheet-handle').setAttribute('aria-expanded', expanded ? 'true' : 'false');
    $('#cart-sheet-panel').hidden = !expanded;
    if (expanded) positionCartForViewport();
  }

  function positionCartForViewport() {
    const cart = $('#booking-cart');
    const panel = $('#cart-sheet-panel');
    const workspace = $('.workspace');
    if (!cart || !panel || !workspace) return;
    if (!cartHomeParent) cartHomeParent = workspace;
    const narrow = window.matchMedia('(max-width: 600px)').matches;
    const sheet = $('#cart-sheet');
    if (sheet) sheet.hidden = !narrow;
    if (narrow) {
      if (cart.parentElement !== panel) panel.appendChild(cart);
    } else {
      if (cart.parentElement !== cartHomeParent) cartHomeParent.appendChild(cart);
      setSheetExpanded(false);
    }
  }

  function ensureCompatibleCartLine() {
    if (!stagedSelection) {
      createSelection('hall1', '2026-08-29', timeToSlot(14, 0), timeToSlot(17, 0));
    }
    setCommitted('item', 'community-hall', { notify: true });
    setCommitted('package', 'none', { notify: true });
    if (stagedSelection && isCompatible(getCommitted('item'), getCommitted('package'))) {
      addToCart();
    }
  }

  function applyStageTarget(target) {
    if (isJourney9Route()) { j9BlockReview('Journey 9 stage playback is unavailable; use the recurring review entry.'); return; }
    if (isJourney7Route()) {
      j7BlockReview('Journey 7 stage controls are review-only and unavailable on this route.');
      return;
    }
    if (target === 'a') {
      resetJourney();
      return;
    }
    resetJourney();
    switch (target) {
      case 'b':
        weekStart = addDays(CHECKPOINT_WEEK_START, 7);
        renderCalendar();
        break;
      case 'c':
        selectedAssets = new Set(['hall1']);
        renderAssetTree();
        renderCalendar();
        break;
      case 'd':
        selectedAssets = new Set(['hall1', 'hall2', 'studio2']);
        renderAssetTree();
        renderCalendar();
        break;
      case 'e':
        createSelection('hall1', '2026-08-29', timeToSlot(14, 0), timeToSlot(17, 0));
        break;
      case 'f':
        createSelection('hall1', '2026-08-29', timeToSlot(14, 0), timeToSlot(17, 0));
        setCommitted('item', 'community-hall', { notify: true });
        setCommitted('package', 'private-day', { notify: true });
        break;
      case 'g':
        createSelection('hall1', '2026-08-29', timeToSlot(14, 0), timeToSlot(17, 0));
        setCommitted('item', 'studio-lighting', { notify: true });
        setCommitted('package', 'private-day', { notify: true });
        break;
      case 'h':
        ensureCompatibleCartLine();
        break;
      case 'i':
        ensureCompatibleCartLine();
        if (cartLines[0]) openCartItemEditor('more', cartLines[0].id, null);
        break;
      case 'j':
        ensureCompatibleCartLine();
        if (cartLines[0]) editLine(cartLines[0].id, null);
        break;
      case 'k':
        ensureCompatibleCartLine();
        createSelection('studio2', '2026-08-29', timeToSlot(10, 0), timeToSlot(12, 0));
        addToCart();
        if (cartLines[1]) promptRemove(cartLines[1].id, null);
        break;
      case 'l':
        ensureCompatibleCartLine();
        createSelection('studio2', '2026-08-29', timeToSlot(10, 0), timeToSlot(12, 0));
        setCommitted('item', 'community-hall', { notify: true });
        setCommitted('package', 'private-day', { notify: true });
        break;
      case 'm':
        selectUnavailable('hall1', '2026-08-27', EVENTS.find((e) => e.id === 'BK-10501'));
        break;
      case 'n':
        ensureCompatibleCartLine();
        setPhase('cart');
        updateCartUI();
        break;
      case 'o':
        ensureCompatibleCartLine();
        confirmBooking();
        break;
      default:
        break;
    }
    setStage(target);
  }

  function resetJourney() {
    weekStart = new Date(CHECKPOINT_WEEK_START);
    selectedAssets = new Set(['hall1', 'studio2']);
    cartLines = [];
    stagedSelection = null;
    editingLineId = null;
    expandedLineId = null;
    expandedMode = null;
    closeCartItemEditor(false);
    draft.created = null;
    draft.unavailableSelection = null;
    draft.stressCount = null;
    selectedLineIds.clear();
    expandedGroups = new Set([0, 1, 2]);
    setCommitted('item', 'community-hall', { notify: false });
    setCommitted('package', 'none', { notify: false });
    setCommitted('concession', 'review-fixture', { notify: false });
    syncFieldDisplay('item');
    syncFieldDisplay('package');
    syncFieldDisplay('concession');
    $$('.stress-btn').forEach((b) => b.classList.remove('active'));
    document.body.dataset.stress = '';
    cartViewMode = 'compact';
    setCartViewMode('compact');
    setPhase('select');
    setStage('a');
    updateCartUI();
    renderAssetTree();
    renderCalendar();
  }

  const REVIEW_PLAY_STEP_MS = 2500;
  const REVIEW_COMPLETE_STEP_MS = 1400;
  const REVIEW_PLAY_DIALOG_MS = 3000;
  const GUIDED_REVIEW_MOVE_MS = 650;
  const GUIDED_REVIEW_CLICK_MS = 300;
  let guidedReviewTarget = null;

  function waitForPlay(ms) {
    return new Promise((resolve) => {
      if (!playJourneyActive) { resolve(); return; }
      setTimeout(resolve, ms);
    });
  }

  function ensureGuidedReviewOverlay() {
    let overlay = $('#guided-review-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'guided-review-overlay';
    overlay.className = 'guided-review-overlay';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="guided-review-card">
        <span class="guided-review-count" id="guided-review-count"></span>
        <strong class="guided-review-caption" id="guided-review-caption"></strong>
      </div>
      <div class="guided-review-cursor" id="guided-review-cursor">
        <svg viewBox="0 0 32 40" aria-hidden="true" focusable="false"><path d="M2 2v29l8-7 6 14 6-3-6-14h11z"></path></svg>
        <span class="guided-review-ripple" aria-hidden="true"></span>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function beginGuidedReview(mode, total) {
    const overlay = ensureGuidedReviewOverlay();
    overlay.hidden = false;
    overlay.dataset.mode = mode;
    overlay.dataset.total = String(total);
    overlay.dataset.step = '0';
    overlay.dataset.target = '';
    $('#guided-review-count').textContent = `Step 0 of ${total}`;
    $('#guided-review-caption').textContent = 'Preparing guided review…';
    const cursor = $('#guided-review-cursor');
    cursor.style.left = '28px';
    cursor.style.top = `${Math.max(88, window.innerHeight - 80)}px`;
    cursor.classList.add('is-visible');
    document.body.classList.add('guided-review-running');
  }

  function endGuidedReview() {
    if (guidedReviewTarget) {
      guidedReviewTarget.classList.remove('guided-review-target', 'guided-review-clicked');
      guidedReviewTarget = null;
    }
    const overlay = $('#guided-review-overlay');
    if (overlay) {
      overlay.hidden = true;
      overlay.dataset.step = '';
      overlay.dataset.target = '';
      if (overlay.parentElement !== document.body) document.body.appendChild(overlay);
    }
    const cursor = $('#guided-review-cursor');
    if (cursor) cursor.classList.remove('is-visible', 'is-clicking');
    document.body.classList.remove('guided-review-running');
  }

  function resolveGuidedReviewTarget(target) {
    if (typeof target === 'function') return target();
    if (typeof target === 'string') return $(target);
    return target;
  }

  function activateGuidedCalendarSlot(el) {
    if (document.body.dataset.journey === '1' && slotLayout === 'column') {
      const col = el.closest('.cal-day-col');
      const slot = Number(el.dataset.slot);
      if (col && Number.isInteger(slot) && isFreeSlot(col.dataset.asset, col.dataset.date, slot)) {
        createSelection(col.dataset.asset, col.dataset.date, slot, slot + 1);
      }
      return;
    }
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
  }

  function activateGuidedClickable(el) {
    if (!el.disabled && typeof el.focus === 'function') el.focus({ preventScroll: true });
    el.click();
  }

  function contextualPrepareGuidedTarget(el) {
    if (!isContextualWorkspace() || !el) return;
    if (el.closest('dialog, #large-data-picker')) return;
    if (el.closest('#assets-panel')) {
      if (!contextualAssetIsOpen()) contextualOpenAssets($('#j3-launcher-btn'), false);
      return;
    }
    if (el.closest('#booking-cart')) {
      if (!contextualCartIsOpen()) contextualOpenCart($('#contextual-cart-open'), false);
      if (el.closest('#configure-form') && !currentSelectionDetailsExpanded) {
        setCurrentSelectionDetailsExpanded(true);
      }
      return;
    }
    if (contextualAssetIsOpen()) contextualCloseAssets({ restore: false, announce: false });
    if (contextualCartIsOpen()) contextualCloseCart({ restore: false, announce: false, dismiss: false });
  }

  async function guidedReviewStep(target, caption, step, total, action, dwellMs) {
    const el = resolveGuidedReviewTarget(target);
    if (!el) throw new Error(`Guided review target missing at step ${step}: ${caption}`);
    contextualPrepareGuidedTarget(el);
    if (guidedReviewTarget && guidedReviewTarget !== el) {
      guidedReviewTarget.classList.remove('guided-review-target', 'guided-review-clicked');
    }
    if (!el.getClientRects().length) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await waitForPlay(100);
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) throw new Error(`Guided review target hidden at step ${step}: ${caption}`);

    guidedReviewTarget = el;
    el.classList.add('guided-review-target');
    const overlay = ensureGuidedReviewOverlay();
    const targetDialog = el.closest('dialog[open]');
    if (targetDialog && overlay.parentElement !== targetDialog) targetDialog.appendChild(overlay);
    else if (!targetDialog && overlay.parentElement !== document.body) document.body.appendChild(overlay);
    const targetKey = el.id || el.getAttribute('data-edit') || el.getAttribute('data-remove') || el.getAttribute('data-res') || el.getAttribute('data-slot') || el.tagName.toLowerCase();
    overlay.dataset.step = String(step);
    overlay.dataset.total = String(total);
    overlay.dataset.target = targetKey;
    overlay.dataset.targetTag = el.tagName.toLowerCase();
    overlay.dataset.targetRole = el.getAttribute('role') || '';
    $('#guided-review-count').textContent = `Step ${step} of ${total}`;
    $('#guided-review-caption').textContent = caption;

    const cursor = $('#guided-review-cursor');
    cursor.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
    cursor.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    await waitForPlay(GUIDED_REVIEW_MOVE_MS);
    cursor.classList.add('is-clicking');
    el.classList.add('guided-review-clicked');
    await waitForPlay(GUIDED_REVIEW_CLICK_MS);
    if (typeof action === 'function') await Promise.resolve(action(el));
    else activateGuidedClickable(el);
    await waitForPlay(dwellMs == null ? REVIEW_PLAY_STEP_MS : dwellMs);
    cursor.classList.remove('is-clicking');
    el.classList.remove('guided-review-clicked');
  }

  function revealGuidedLineAction(lineSelector, actionSelector) {
    let line = document.querySelector(lineSelector);
    if (!line) return null;
    const id = line.dataset.bookingLine;
    if (id && openLineActionsId !== id) {
      openLineActionsId = id;
      renderCartLines();
      line = Array.from(document.querySelectorAll('[data-booking-line]')).find((entry) => entry.dataset.bookingLine === id);
    }
    return line?.querySelector(actionSelector) || null;
  }

  async function playJourney() {
    if (isJourney9Route()) { j9BlockReview('Journey 9 playback is unavailable; use the recurring review entry.'); return; }
    if (isJourney7Route()) {
      j7BlockReview('Journey 7 playback is bounded to the existing selector and Cart review; no Journey 1 playback fallthrough is available.');
      return;
    }
    if (playJourneyActive) return;
    playJourneyActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    playBtn.disabled = true;
    completeBtn.disabled = true;
    const total = 29;
    playJourneyStep = 0;
    resetJourney();
    beginGuidedReview('journey', total);
    showToast('Playing source-complete Journey 1 review…');

    try {
      await guidedReviewStep(playBtn, 'Start from an empty Diary and one Booking Cart', ++playJourneyStep, total, () => {}, REVIEW_PLAY_STEP_MS);
      await guidedReviewStep('#date-next', 'Check the next working week', ++playJourneyStep, total);
      await guidedReviewStep('#date-today', 'Return to the Journey fixture week', ++playJourneyStep, total);
      await guidedReviewStep(() => $('#asset-tree .tree-check[data-res="hall2"]'), 'Select another resource in the hierarchy', ++playJourneyStep, total, (el) => { if (!el.checked) activateGuidedClickable(el); });
      await guidedReviewStep('.cal-day-col[data-asset="hall1"][data-date="2026-08-29"] .cal-slot[data-slot="12"]', 'Stage Hall 1 · 14:00–17:00', ++playJourneyStep, total, activateGuidedCalendarSlot);
      await guidedReviewStep('#cfg-item-input', 'Open the scalable Item picker', ++playJourneyStep, total);
      await guidedReviewStep('#ldp-item-opt-studio-lighting', 'Choose a mismatched Item', ++playJourneyStep, total, activateGuidedClickable, REVIEW_PLAY_DIALOG_MS);
      await guidedReviewStep('#mismatch-fix', 'Recover with the matching Item', ++playJourneyStep, total);
      await guidedReviewStep('#cart-primary-action', 'Add the Item-only selection to Cart', ++playJourneyStep, total);
      await guidedReviewStep(() => $('.cart-line [data-select-line]'), 'Select the staged Cart line', ++playJourneyStep, total);
      setCartViewMode('detailed');
      await guidedReviewStep(() => $('.cart-line [data-time]'), 'Open Change date & time from the staged line', ++playJourneyStep, total);
      await guidedReviewStep('#time-start-time', 'Change Start Time; live availability and the same-line summary update immediately', ++playJourneyStep, total, (el) => { el.value = '15:00'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await guidedReviewStep('#time-confirm', 'Confirm the valid time change and fixture repricing in one step', ++playJourneyStep, total);
      await guidedReviewStep(() => $('.cart-line [data-config]'), 'Open per-line facility Configuration', ++playJourneyStep, total);
      await guidedReviewStep('#configuration-choice', 'Choose Banquet Configuration', ++playJourneyStep, total, (el) => { el.value = 'banquet'; el.dispatchEvent(new Event('change', { bubbles: true })); });
      await guidedReviewStep('#configuration-apply', 'Apply Configuration to the staged facility', ++playJourneyStep, total);
      await guidedReviewStep(() => $('.cart-line [data-package]'), 'Open the private Package editor', ++playJourneyStep, total);
      await guidedReviewStep('#package-picker-btn', 'Use the same scalable Package picker', ++playJourneyStep, total);
      await guidedReviewStep('#ldp-package-opt-private-day', 'Choose the Attendees-type Package', ++playJourneyStep, total);
      await guidedReviewStep('#package-value', 'Enter Package Attendees within fixture limits', ++playJourneyStep, total, (el) => { el.value = '25'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await guidedReviewStep('#package-apply', 'Apply Package contents and Attendees', ++playJourneyStep, total);
      await guidedReviewStep(() => $('.cart-line [data-pricing]'), 'Open Change Pricing', ++playJourneyStep, total);
      await guidedReviewStep('input[name="price-mode"][value="change"]', 'Choose another Price Type', ++playJourneyStep, total);
      await guidedReviewStep('#pricing-apply', 'Apply Pricing Option, Type, Unit and Concession', ++playJourneyStep, total);
      await guidedReviewStep(() => revealGuidedLineAction('.cart-line', '[data-details]'), 'Open progressive Item, Package, allocation and availability details', ++playJourneyStep, total);
      await guidedReviewStep('#cart-primary-action', 'Return to Diary to add another interval', ++playJourneyStep, total);
      await guidedReviewStep('.cal-day-col[data-asset="studio2"][data-date="2026-08-29"] .cal-slot[data-slot="4"]', 'Stage Studio 2 · 10:00–12:00', ++playJourneyStep, total, activateGuidedCalendarSlot);
      await guidedReviewStep('#cart-primary-action', 'Add the second selection', ++playJourneyStep, total);
      await guidedReviewStep(() => revealGuidedLineAction('.cart-line:last-child', '[data-remove]'), 'Remove the second staged selection', ++playJourneyStep, total);
      showToast('Source-complete guided review finished — remove confirmation remains open for explicit review');
    } catch (error) {
      console.error(error);
      showToast('Guided journey recovered to the last valid control — inspect console evidence');
    } finally {
      playJourneyActive = false;
      playBtn.disabled = false;
      completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  async function playCompleteJourney() {
    if (isJourney9Route()) { j9BlockReview('Journey 9 complete playback is unavailable; use the recurring review entry.'); return; }
    if (isJourney7Route()) {
      j7BlockReview('Journey 7 Play complete is unavailable; Booking creation remains outside this candidate.');
      return;
    }
    if (playJourneyActive) return;
    playJourneyActive = true;
    const playBtn = $('#btn-play-journey');
    const completeBtn = $('#btn-play-complete');
    playBtn.disabled = true;
    completeBtn.disabled = true;
    const total = 4;
    let step = 0;
    resetJourney();
    beginGuidedReview('complete', total);
    showToast('Playing guided Diary-only create journey…');

    try {
      await guidedReviewStep(completeBtn, 'Start the Diary-only Create Booking journey', ++step, total, () => {}, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('.cal-day-col[data-asset="hall1"][data-date="2026-08-29"] .cal-slot[data-slot="12"]', 'Select Hall 1 · Sat 29 Aug · 14:00–17:00', ++step, total, activateGuidedCalendarSlot, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#cart-primary-action', 'Add the configured selection to the Diary Cart', ++step, total, null, REVIEW_COMPLETE_STEP_MS);
      await guidedReviewStep('#confirm-booking-btn', 'Book, show the created Diary event, then reach the external Booking App handoff boundary', ++step, total, activateGuidedClickable, REVIEW_COMPLETE_STEP_MS);
      showToast('Guided Diary-only create journey finished — Booking created, external handoff boundary shown');
    } catch (error) {
      console.error(error);
      showToast('Guided complete journey stopped — review target unavailable');
    } finally {
      playJourneyActive = false;
      playBtn.disabled = false;
      completeBtn.disabled = false;
      endGuidedReview();
    }
  }

  function applyStressCount(count) {
    if (isJourney9Route()) { j9BlockReview('Journey 9 stress fixtures are unavailable.'); return; }
    if (isJourney7Route()) {
      j7BlockReview('Journey 7 generated Cart stress fixtures are unavailable; only the accepted local graph is reviewable.');
      return;
    }
    const prevPhase = draft.phase;
    draft.stressCount = count;
    $$('.stress-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.stress) === count));
    cartLines = buildStressCartLines(count);
    selectedLineIds.clear();
    stagedSelection = null;
    editingLineId = null;
    expandedLineId = null;
    if (prevPhase === 'success') draft.created = null;
    setPhase('cart');
    updateCartUI();
    renderCalendar();
  }

  function trapDialogFocus(dialog) {
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        if (dialog.id === 'cart-item-editor-dialog') closeCartItemEditor();
        else if (dialog.id === 'j4-details-dialog') {
          e.preventDefault();
          j4CloseDetails(true);
        } else {
          e.preventDefault();   // A11Y-INH-04 (Option 2): only the top window reacts to this Escape; the window's own cancel handler acts first
          if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) { dialog.close(); restoreFocus(); }
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      const list = Array.from(focusable).filter((el) => !el.disabled && (!cartItemEditorTargetsStagedSelection() || el.offsetParent !== null));
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  const J7_SALES_CHANNEL_CONTEXT = 'accepted-local';
  const J7_ALLOWED_CATALOG = Object.freeze({
    item: new Set(['community-hall', 'studio-lighting']),
    package: new Set(['private-day']),
    concession: new Set(['review-fixture'])
  });

  function isJourney7Route() {
    return document.body.dataset.journey === '7';
  }

  function isJourney9Route() {
    return document.body.dataset.journey === '9';
  }

  function j9BlockReview(message = 'Journey 9 is limited to the local recurring-availability review; this action is unavailable.') {
    if (!isJourney9Route()) return;
    announceAlert(message);
    showToast(message);
  }

  function j7AllowedCatalogValue(field, id) {
    return !isJourney7Route() || !!J7_ALLOWED_CATALOG[field]?.has(id);
  }

  function j7BlockReview(message) {
    if (!isJourney7Route()) return;
    announceAlert(message);
    showToast(message);
  }

  function j7GraphState(selection, lineMode = false) {
    const failures = [];
    const s = selection || {};
    const item = lineMode ? s.item : getCommitted('item');
    const pkg = lineMode ? s.package : getCommitted('package');
    const concession = lineMode ? s.concession : getCommitted('concession');
    const configuration = lineMode ? s.configuration : $('#cfg-configuration')?.value;
    const attendees = lineMode ? Number(s.packageAttendees) : getStagedPackageState(false).attendees;
    if (!isJourney7Route()) failures.push('Journey 7 route');
    if (s.asset !== 'hall1') failures.push('asset Hall 1');
    if (s.date !== '2026-08-29') failures.push('date 2026-08-29');
    if (s.endDate && s.endDate !== s.date) failures.push('same-day interval');
    if (Number(s.startH) !== 10 || Number(s.startM) !== 0 || Number(s.endH) !== 12 || Number(s.endM) !== 0) failures.push('interval 10:00–12:00');
    if (configuration !== 'theatre') failures.push('Theatre configuration');
    if (item !== 'community-hall') failures.push('Community Hall Hire Item');
    if (pkg !== 'private-day') failures.push('Private Day Hire package');
    if (concession !== 'review-fixture') failures.push('Review fixture concession');
    if (attendees !== 25) failures.push('25 attendees');
    const packageValid = lineMode
      ? pkg === 'private-day' && Number.isFinite(attendees) && attendees >= 5 && attendees <= 500
      : getStagedPackageState(false).valid;
    if (!packageValid) failures.push('valid Package state');
    if (J7_SALES_CHANNEL_CONTEXT !== 'accepted-local' || $('#j7-sales-channel')?.dataset.j7SalesChannel !== J7_SALES_CHANNEL_CONTEXT) failures.push('accepted local sales-channel context');
    return { ok: failures.length === 0, failures, item, pkg, concession, configuration, attendees };
  }

  function j7IsAcceptedGraph(selection) {
    return j7GraphState(selection, false);
  }

  function j7LineMatchesAcceptedGraph(line) {
    return !!line && j7GraphState(line, true).ok && line.amountPending !== true && Number(line.amount) === 2750 && line.pricingOption === 'standard' && line.priceMode === 'default' && line.priceType === 'standard-rate' && line.pricingUnit === 'hour';
  }

  function j7CurrentControlsMatchAcceptedGraph() {
    if (!isJourney7Route()) return false;
    const packageState = getStagedPackageState(false);
    return getCommitted('item') === 'community-hall' &&
      getCommitted('package') === 'private-day' &&
      getCommitted('concession') === 'review-fixture' &&
      $('#cfg-configuration')?.value === 'theatre' &&
      packageState.attendees === 25 &&
      packageState.valid &&
      J7_SALES_CHANNEL_CONTEXT === 'accepted-local' &&
      $('#j7-sales-channel')?.dataset.j7SalesChannel === J7_SALES_CHANNEL_CONTEXT;
  }

  function j7HandoffReady() {
    return isJourney7Route() && !stagedSelection && !editingLineId && cartLines.length === 1 &&
      j7LineMatchesAcceptedGraph(cartLines[0]) && j7CurrentControlsMatchAcceptedGraph();
  }

  function j7WriteStatus(selector, text) {
    const node = $(selector);
    if (node && node.textContent !== text) node.textContent = text;
  }

  function j7SyncRouteState() {
    if (!isJourney7Route()) return;
    const staged = j7IsAcceptedGraph(stagedSelection);
    const controlsReady = j7CurrentControlsMatchAcceptedGraph();
    const handoff = j7HandoffReady();
    const amount = $('#amount-region');
    if (amount) amount.hidden = !staged.ok;
    const graphReady = staged.ok || (handoff && controlsReady);
    const itemStatus = graphReady ? 'Complete · accepted Item graph' : `Blocked · ${staged.failures.find((x) => /Item|asset|date|interval|configuration/.test(x)) || 'accepted graph dependency'}`;
    const packageStatus = graphReady ? 'Complete · accepted Package graph' : `Blocked · ${staged.failures.find((x) => /Package|attendees|concession/.test(x)) || 'accepted graph dependency'}`;
    j7WriteStatus('#j7-item-status', itemStatus);
    j7WriteStatus('#j7-package-status', packageStatus);
    const note = handoff
      ? 'Valid accepted graph is staged in the existing Booking Cart. Ready for Journey 1 Booking-creation handoff; Journey 7 does not create a Booking.'
      : staged.ok
        ? 'Accepted graph is ready to stage through the existing Cart action. Journey 7 stops before Booking creation.'
        : `Journey 7 blocked: ${staged.failures.join('; ')}. No Total, Cart staging or Booking handoff is actionable.`;
    j7WriteStatus('#j7-route-note', note);
    const book = $('#confirm-booking-btn');
    if (book) { book.hidden = true; book.disabled = true; book.inert = true; book.setAttribute('aria-hidden', 'true'); }
    const helper = $('#confirm-helper');
    if (helper) { helper.hidden = false; helper.textContent = 'Journey 7 stops at the accepted Journey 1 Booking-creation handoff; no Booking is created here.'; }
    const primary = $('#cart-primary-action');
    if (primary && !staged.ok) primary.disabled = true;
  }

  function j7RenderRouteStatus() {
    const section = $('#j7-route-status');
    if (!section || !isJourney7Route()) return;
    section.hidden = false;
    section.inert = false;
    section.removeAttribute('aria-hidden');
    j7SyncRouteState();
  }

  function j7ResetBootState() {
    resetJourney();
    createSelection('hall1', '2026-08-29', timeToSlot(10, 0), timeToSlot(12, 0));
    setCommitted('item', 'community-hall', { notify: false });
    setCommitted('package', 'private-day', { notify: false });
    setCommitted('concession', 'review-fixture', { notify: false });
    syncFieldDisplay('item');
    syncFieldDisplay('package');
    syncFieldDisplay('concession');
    updateConfigureForm();
    setSheetExpanded(isNarrowViewport());
    const attendees = $('#cfg-package-attendees');
    if (attendees) { attendees.value = '25'; attendees.dispatchEvent(new Event('input', { bubbles: true })); }
    setCurrentSelectionDetailsExpanded(true, { moveFocus: false });
    ['#cfg-item', '#cfg-package', '#cfg-concession', '#cfg-configuration', '#cfg-package-attendees'].forEach((selector) => {
      const field = $(selector);
      field?.addEventListener('change', () => window.setTimeout(j7SyncRouteState, 0));
      field?.addEventListener('input', j7SyncRouteState);
    });
    $('#cart-primary-action')?.addEventListener('click', () => window.setTimeout(j7SyncRouteState, 0));
    window.addEventListener('resize', j7SyncRouteState);
    document.addEventListener('input', (event) => {
      if (event.target.matches('#cfg-package-attendees, #cfg-package-quantity')) j7SyncRouteState();
    });
    document.addEventListener('change', (event) => {
      if (event.target.matches('#cfg-item, #cfg-package, #cfg-concession, #cfg-configuration, #cfg-package-attendees, #cfg-package-quantity')) window.setTimeout(j7SyncRouteState, 0);
    });
    j7RenderRouteStatus();
  }

  function initJ9() {
    const dialog = $('#j9-dialog');
    const form = $('#j9-form');
    const openButton = $('#j9-open-review');
    const closeButton = $('#j9-close');
    const cancelButton = $('#j9-cancel');
    const checkButton = $('#j9-check');
    const errors = $('#j9-errors');
    const dialogResult = $('#j9-dialog-result');
    const panelTitle = $('#j9-panel-title');
    const panelCopy = $('#j9-panel-copy');
    const panelResult = $('#j9-result');
    const statusPill = $('#j9-status-pill');
    const state = { outcome: 'available', timer: null, hasResult: false, operation: 0 };
    const patternInputs = Array.from(document.querySelectorAll('input[name="j9-pattern"]'));
    const rangeInputs = Array.from(document.querySelectorAll('input[name="j9-range"]'));
    const pattern = () => document.querySelector('input[name="j9-pattern"]:checked')?.value || 'daily';
    const range = () => document.querySelector('input[name="j9-range"]:checked')?.value || 'after';
    const readyText = 'Ready to check local availability.';
    const changedText = 'Configuration changed — check local availability again.';
    const setReadySurfaces = () => {
      errors.textContent = '';
      dialogResult.className = 'j9-dialog-result';
      dialogResult.textContent = readyText;
      panelTitle.textContent = readyText;
      panelCopy.textContent = 'Configure the recurrence, then check the deterministic local availability fixture.';
      panelResult.textContent = 'No availability result has been checked.';
      statusPill.textContent = 'Ready to check';
    };
    const invalidateReview = () => {
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = null;
      state.hasResult = false;
      checkButton.disabled = false;
      errors.textContent = '';
      dialogResult.className = 'j9-dialog-result';
      dialogResult.textContent = changedText;
      panelTitle.textContent = 'Configuration changed';
      panelCopy.textContent = changedText;
      panelResult.textContent = changedText;
      statusPill.textContent = 'Needs recheck';
    };
    const syncConditionalFields = ({ invalidate = true } = {}) => {
      const value = pattern();
      $('#j9-weekly-fields').hidden = value !== 'weekly';
      $('#j9-monthly-fields').hidden = value !== 'monthly';
      $('#j9-yearly-fields').hidden = value !== 'yearly';
      $('#j9-after-field').hidden = range() !== 'after';
      $('#j9-by-field').hidden = range() !== 'by';
      if (invalidate) invalidateReview();
      else if (!state.hasResult) setReadySurfaces();
    };
    const validate = () => {
      const issues = [];
      const interval = Number($('#j9-interval').value);
      const start = $('#j9-start-date').value;
      if (!Number.isInteger(interval) || interval < 1) issues.push('Interval must be a positive whole number.');
      if (!start) issues.push('Start date is required.');
      if (pattern() === 'weekly' && !document.querySelector('input[name="j9-weekday"]:checked')) issues.push('Choose at least one weekday for a weekly pattern.');
      if (pattern() === 'monthly') {
        const day = Number($('#j9-month-day').value);
        if (!Number.isInteger(day) || day < 1 || day > 31) issues.push('Monthly day must be between 1 and 31.');
      }
      if (pattern() === 'yearly') {
        const month = Number($('#j9-year-month').value);
        const day = Number($('#j9-year-day').value);
        if (!Number.isInteger(day) || day < 1 || day > 31) issues.push('Yearly day must be between 1 and 31.');
        else if (Number.isInteger(month) && day > new Date(2000, month, 0).getDate()) issues.push('Yearly day is not valid for the selected month.');
      }
      if (range() === 'after') {
        const occurrences = Number($('#j9-occurrences').value);
        if (!Number.isInteger(occurrences) || occurrences < 1) issues.push('End-after occurrences must be a positive whole number.');
      } else if (!$('#j9-end-date').value || ($('#j9-start-date').value && $('#j9-end-date').value < $('#j9-start-date').value)) {
        issues.push('End-by date must be on or after the start date.');
      }
      return issues;
    };
    const setOutcome = (outcome) => {
      state.outcome = outcome;
      invalidateReview();
      document.querySelectorAll('[data-j9-outcome]').forEach((button) => {
        const active = button.dataset.j9Outcome === outcome;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
    };
    const cancelPending = () => {
      state.operation += 1;
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = null;
      checkButton.disabled = false;
    };
    const close = () => {
      cancelPending();
      if (dialog.open) dialog.close('cancel');
    };
    const resetDialogForOpen = () => {
      cancelPending();
      errors.textContent = '';
      dialogResult.className = 'j9-dialog-result';
      dialogResult.textContent = readyText;
    };
    const open = () => {
      lastDialogTrigger = openButton;
      syncConditionalFields({ invalidate: false });
      resetDialogForOpen();
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      window.setTimeout(() => $('#j9-interval').focus(), 0);
    };
    patternInputs.forEach((input) => input.addEventListener('change', syncConditionalFields));
    rangeInputs.forEach((input) => input.addEventListener('change', syncConditionalFields));
    form.addEventListener('input', invalidateReview);
    form.addEventListener('change', (event) => {
      if (event.target.matches('input, select')) invalidateReview();
    });
    document.querySelectorAll('[data-j9-outcome]').forEach((button) => button.addEventListener('click', () => setOutcome(button.dataset.j9Outcome)));
    openButton.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    cancelButton.addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => { cancelPending(); restoreFocus(); });
    checkButton.addEventListener('click', () => {
      const issues = validate();
      if (issues.length) {
        errors.textContent = issues.join(' ');
        dialogResult.className = 'j9-dialog-result is-error';
        dialogResult.textContent = 'Local review blocked until the configuration is valid.';
        return;
      }
      errors.textContent = '';
      checkButton.disabled = true;
      state.hasResult = false;
      const operation = ++state.operation;
      dialogResult.className = 'j9-dialog-result';
      dialogResult.textContent = 'Checking local availability…';
      if (document.body.dataset.journey === '9') k1Focus.move(dialogResult, '#j9-check');
      state.timer = window.setTimeout(() => {
        if (operation !== state.operation || !dialog.open) {
          if (operation === state.operation) {
            state.timer = null;
            checkButton.disabled = false;
          }
          return;
        }
        checkButton.disabled = false;
        const messages = {
          available: ['Available in local review fixture.', 'Available · local review fixture', 'The configured recurrence has a deterministic available fixture. No series was created.'],
          conflict: ['Conflict / unavailable in local review fixture.', 'Conflict · local review fixture', 'The configured recurrence meets validation but overlaps the deterministic unavailable fixture.'],
          error: ['Local review error fixture.', 'Error · local review fixture', 'The deterministic error fixture represents an unavailable review response; no request was sent.']
        };
        const [dialogText, statusText, panelText] = messages[state.outcome];
        state.hasResult = true;
        dialogResult.className = `j9-dialog-result ${state.outcome === 'available' ? 'is-available' : state.outcome === 'conflict' ? 'is-conflict' : 'is-error'}`;
        dialogResult.textContent = dialogText;
        panelTitle.textContent = statusText;
        statusPill.textContent = statusText;
        panelResult.textContent = panelText;
        panelCopy.textContent = 'Configuration remains staged locally. Close or cancel returns here without loss.';
        if (operation === state.operation) state.timer = null;
      }, 450);
    });
    createSelection('hall1', '2026-08-29', 2, 4);
    setReadySurfaces();
    $('#j9-review-launch').hidden = false;
    window.__j9Review = Object.freeze({ validate, getOutcome: () => state.outcome, reset: () => window.location.reload(), cancelDuringLoading: () => { close(); return !checkButton.disabled; } });
  }

  function init() {
    const isJ9 = document.body.dataset.journey === '9';
    const isJ2 = document.body.dataset.journey === '2';
    const isJ3 = document.body.dataset.journey === '3';
    const isJ4 = document.body.dataset.journey === '4';
    const isJ5 = document.body.dataset.journey === '5';
    const isJ6 = document.body.dataset.journey === '6';
    const isJ7 = document.body.dataset.journey === '7';
    const isJ8 = document.body.dataset.journey === '8';
    const calendarGrid = $('#calendar-grid');
    if (document.body.dataset.journey === '12') {
      const clearFreeSelectionForPublicEvent = (event) => {
        if (!event.target.closest?.('#j12-public-event')) return;
        if (event.type === 'keydown' && !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
        clearColumnCrosshair();
        if (!stagedSelection && !dragState) return;
        stagedSelection = null;
        dragState = null;
        editingLineId = null;
        $$('#calendar-grid .cal-day-col').forEach((col) => refreshColumnSelectionDom(col.dataset.asset, col.dataset.date));
        updateCartUI();
      };
      document.addEventListener('click', clearFreeSelectionForPublicEvent, true);
      document.addEventListener('keydown', clearFreeSelectionForPublicEvent, true);
    }
    if (calendarGrid) {
      calendarGrid.addEventListener('mouseleave', clearColumnCrosshair);
      calendarGrid.addEventListener('mouseover', (event) => {
        if (!isGenericColumnCrosshairRoute() || dragState) return;
        const target = event.target instanceof Element ? event.target : null;
        const freeSlot = target ? target.closest('.cal-slot.free') : null;
        if (!freeSlot || !calendarGrid.contains(freeSlot)) clearColumnCrosshair();
      });
    }
    if (!isJ2) document.body.dataset.surface = 'week';

    $('#date-prev').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') { j2StepDate(-1); return; }
      weekStart = addDays(weekStart, -7);
      setStage('b');
      renderCalendar();
      if (!isCheckpointWeek()) showToast('Checkpoint fixtures are in 24–30 Aug 2026. Today returns to that week.');
    });

    $('#date-next').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') { j2StepDate(1); return; }
      weekStart = addDays(weekStart, 7);
      setStage('b');
      renderCalendar();
      if (!isCheckpointWeek()) showToast('Checkpoint fixtures are in 24–30 Aug 2026. Today returns to that week.');
    });

    $('#date-today').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') { j2SetDate(J2_TODAY); return; }
      weekStart = new Date(CHECKPOINT_WEEK_START);
      setStage('b');
      renderCalendar();
    });

    function openDatePicker(trigger) {
      lastDialogTrigger = trigger;
      $('#date-picker-dialog').showModal();
      $('#picker-input').focus();
    }

    $('#date-picker-btn').addEventListener('click', (e) => {
      if (document.body.dataset.journey === '2') { j2OpenPicker(); return; }
      openDatePicker(e.currentTarget);
    });
    $('#date-range-label').addEventListener('click', (e) => openDatePicker(e.currentTarget));

    $('#picker-cancel').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') { j2ClosePicker(true); return; }
      $('#date-picker-dialog').close(); restoreFocus();
    });
    $('#picker-apply').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') { j2ApplyPicker(); return; }
      const val = $('#picker-input').value;
      if (!val) return;
      const d = new Date(val + 'T12:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      weekStart = addDays(d, diff);
      $('#date-picker-dialog').close();
      setStage('b');
      renderCalendar();
      restoreFocus();
      if (!isCheckpointWeek()) showToast('Checkpoint fixtures are in 24–30 Aug 2026. Today returns to that week.');
    });

    $$('.slot-layout-btn[data-slot-layout]').forEach((button) => {
      button.addEventListener('click', () => {
        if (document.body.dataset.journey === '2') j2SetLayout(button.dataset.slotLayout);
        else setSlotLayout(button.dataset.slotLayout);
      });
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        if (document.body.dataset.journey === '2') j2SetLayout(button.dataset.slotLayout);
        else setSlotLayout(button.dataset.slotLayout);
      });
    });

    $$('.view-switch .view-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.view === 'week') return;
        showToast('Checkpoint proves Week — other views are not removed from Product scope.');
      });
    });

    $$('.mode-nav .mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.mode === 'booking') return;
        showToast(isJ4 || isJ5 || isJ6 ? `Maintenance is outside the Journey ${isJ6 ? '6' : isJ5 ? '5' : '4'} review fixture.` : 'Maintenance is not Journey 1');
      });
    });

    $('#cfg-item').addEventListener('change', updateConfigureForm);
    $('#cfg-package').addEventListener('change', updateConfigureForm);
    $('#cfg-configuration').addEventListener('change', renderCurrentSelectionSummary);
    $('#cfg-concession').addEventListener('change', renderCurrentSelectionSummary);

    $('#current-selection-details-toggle').addEventListener('click', (event) => {
      if (isJourney9Route()) { event.preventDefault(); event.stopImmediatePropagation(); j9BlockReview('Journey 9 item editing is unavailable; use the recurring review entry.'); return; }
      if (stagedSelection && !editingLineId && !currentSelectionDetailsExpanded) {
        openStagedSelectionEditor(event.currentTarget);
        return;
      }
      setCurrentSelectionDetailsExpanded(!currentSelectionDetailsExpanded, {
        moveFocus: !currentSelectionDetailsExpanded,
        restoreFocus: currentSelectionDetailsExpanded
      });
    });
    document.addEventListener('keydown', (event) => {
      const picker = $('#large-data-picker');
      const pickerOpen = picker && !picker.hidden && !!picker.getClientRects().length;
      if (event.key !== 'Escape' || !currentSelectionDetailsExpanded || document.querySelector('dialog[open]') || pickerOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setCurrentSelectionDetailsExpanded(false, { restoreFocus: true });
    }, true);

    const j9ExcludedActionSelector = '#cart-primary-action, #confirm-booking-btn, #clear-cart-btn, #clear-confirm, #current-selection-details-toggle, #btn-play-journey, #btn-play-complete, #review-rail-toggle, #review-rail-panel, .stage-chip, .cart-item-editor-tab, [data-line-actions-toggle], #bulk-time-btn, #bulk-config-btn, #cart-view-compact, #cart-view-detailed, #j4-details-dialog, #j4-context-menu, #j5-workflow-dialog';
    document.addEventListener('click', (event) => {
      if (!isJourney9Route()) return;
      const target = event.target instanceof Element ? event.target.closest(j9ExcludedActionSelector) : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      j9BlockReview();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (!isJourney9Route() || !['Enter', ' ', 'Spacebar'].includes(event.key)) return;
      const target = event.target instanceof Element ? event.target.closest(j9ExcludedActionSelector) : null;
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      j9BlockReview();
    }, true);
    $('#cart-primary-action').addEventListener('click', handlePrimaryAction);
    $('#confirm-booking-btn').addEventListener('click', confirmBooking);

    document.addEventListener('click', (event) => {
      const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const ownedOverlayOrigin = eventPath.some((node) => node && typeof node.matches === 'function' && node.matches('dialog, #large-data-picker'));
      if (!openLineActionsId || event.target.closest('.cart-line-actions') || ownedOverlayOrigin) return;
      openLineActionsId = null;
      renderCartLines();
    });
    document.addEventListener('keydown', (event) => {
      const largePicker = $('#large-data-picker');
      const largePickerOpen = largePicker && !largePicker.hidden && !!largePicker.getClientRects().length;
      if (event.key !== 'Escape' || !openLineActionsId || document.querySelector('dialog[open]') || largePickerOpen) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const id = openLineActionsId;
      openLineActionsId = null;
      renderCartLines();
      requestAnimationFrame(() => {
        const line = Array.from(document.querySelectorAll('[data-booking-line]')).find((entry) => entry.dataset.bookingLine === id);
        const toggle = line?.querySelector('[data-line-actions-toggle]');
        if (toggle) toggle.focus();
      });
    }, true);

    const cartViewCompact = $('#cart-view-compact');
    const cartViewDetailed = $('#cart-view-detailed');
    if (cartViewCompact) cartViewCompact.addEventListener('click', () => setCartViewMode('compact'));
    if (cartViewDetailed) cartViewDetailed.addEventListener('click', () => setCartViewMode('detailed'));
    setCartViewMode('compact');

    $('#clear-cart-btn').addEventListener('click', () => {
      lastDialogTrigger = $('#clear-cart-btn');
      $('#clear-dialog').showModal();
      $('#clear-cancel').focus();
    });

    $('#clear-cancel').addEventListener('click', () => { $('#clear-dialog').close(); restoreFocus(); });
    $('#clear-confirm').addEventListener('click', () => {
      cartLines = [];
      selectedLineIds.clear();
      stagedSelection = null;
      editingLineId = null;
      expandedLineId = null;
      closeCartItemEditor(false);
      $('#clear-dialog').close();
      setPhase('select');
      updateCartUI();
      renderCalendar();
      lastDialogTrigger = null;
    });

    $('#mismatch-close').addEventListener('click', () => { $('#mismatch-dialog').close(); restoreFocus(); });
    $('#mismatch-fix').addEventListener('click', () => {
      setCommitted('item', 'community-hall', { notify: true });
      $('#mismatch-dialog').close();
      restoreFocus();
    });

    $('#remove-keep').addEventListener('click', () => { $('#remove-dialog').close(); restoreFocus(); });
    $('#remove-confirm').addEventListener('click', confirmRemove);

    $('#caller-context-toggle').addEventListener('click', () => {
      const details = $('#caller-context-details');
      const open = details.hidden;
      details.hidden = !open;
      $('#caller-context-toggle').setAttribute('aria-expanded', String(open));
      $('#caller-context-toggle').textContent = open ? 'Hide details' : 'Show details';
    });

    $('#bulk-time-btn').addEventListener('click', (event) => openCartItemEditor('time', Array.from(selectedLineIds), event.currentTarget));
    $('#bulk-config-btn').addEventListener('click', (event) => openCartItemEditor('config', Array.from(selectedLineIds), event.currentTarget));

    $$('.cart-item-editor-tab').forEach((tab) => {
      tab.addEventListener('click', () => switchCartItemEditorTab(tab.dataset.editorTab));
      tab.addEventListener('keydown', handleEditorTabKeydown);
    });
    $('#cart-item-editor-close').addEventListener('click', () => closeCartItemEditor());
    $('#cart-item-editor-dialog').addEventListener('cancel', (event) => {
      event.preventDefault();
      closeCartItemEditor();
    });

    $('#time-cancel').addEventListener('click', () => closeCartItemEditor());
    $('#time-confirm').addEventListener('click', confirmTimeUpdate);
    $$('input[name="time-mode"]').forEach((radio) => radio.addEventListener('change', () => {
      if (!timeEditor) return;
      timeEditor.mode = radio.value;
      $('#time-common-grid').hidden = radio.value !== 'common';
      $('#different-time-list').hidden = radio.value !== 'different';
      evaluateTimeEditor();
    }));
    $('#time-keep-duration').addEventListener('change', evaluateTimeEditor);
    $('#time-form').addEventListener('input', (event) => {
      if (!timeEditor || event.target.id === 'time-select-all-rows') return;
      if (timeEditor.mode === 'common' && ['time-start-date', 'time-start-time'].includes(event.target.id)) syncCommonDuration();
      if (timeEditor.mode === 'different' && event.target.dataset.timeId && ['startDate', 'startTime'].includes(event.target.dataset.timeField)) syncDifferentDuration(event.target.dataset.timeId);
      evaluateTimeEditor();
    });
    $('#time-form').addEventListener('change', (event) => {
      if (event.target.id === 'time-select-all-rows' && timeEditor) {
        timeEditor.ids.forEach((id) => {
          timeEditor.drafts[id].checked = event.target.checked;
          const checkbox = $(`[data-time-check="${id}"]`);
          if (checkbox) checkbox.checked = event.target.checked;
        });
      }
      evaluateTimeEditor();
    });
    $('#different-time-list').addEventListener('click', (event) => {
      if (!timeEditor) return;
      if (event.target.id === 'time-dismiss-checked') {
        timeEditor.ids.forEach((id) => { timeEditor.drafts[id].checked = false; });
        renderDifferentTimeRows();
        evaluateTimeEditor();
      }
    });

    $('#configuration-cancel').addEventListener('click', () => closeCartItemEditor());
    $('#configuration-choice').addEventListener('change', () => {
      configurationEditor.configuration = $('#configuration-choice').value;
      renderConfigurationEditor();
    });
    $('#configuration-select-all').addEventListener('change', () => {
      if (!configurationEditor) return;
      configurationEditor.ids.forEach((id) => {
        const line = cartItemEditorTargetsStagedSelection() ? stagedSelection : getEditorTargetRecord(id);
        if (!line) return;
        const compatible = (CONFIGURATIONS[line.asset] || []).includes(configurationEditor.configuration);
        if (compatible && $('#configuration-select-all').checked) configurationEditor.selected.add(id);
        else configurationEditor.selected.delete(id);
      });
      renderConfigurationEditor();
    });
    $('#configuration-targets').addEventListener('change', (event) => {
      if (!configurationEditor || !event.target.dataset.configTarget) return;
      const id = event.target.dataset.configTarget;
      if (event.target.checked) configurationEditor.selected.add(id); else configurationEditor.selected.delete(id);
      renderConfigurationEditor();
    });
    $('#configuration-apply').addEventListener('click', applyConfigurationUpdate);

    $('#package-cancel').addEventListener('click', () => closeCartItemEditor());
    $('#package-picker-btn').addEventListener('click', () => {
      if (!packageEditor) return;
      const dialog = getCartItemEditorDialog();
      if (dialog && dialog.open && !cartItemEditorTargetsStagedSelection()) dialog.close();
      openPicker('package', { host: packageEditor, field: 'package', context: 'package-editor' });
    });
    $('#package-editor-fields').addEventListener('input', (event) => {
      if (!packageEditor) return;
      event.target.removeAttribute('aria-invalid');
      const meta = packageMeta(packageEditor.package);
      if (event.target.id === 'package-value') {
        if (meta.type === 'quantity') packageEditor.quantity = event.target.value;
        if (meta.type === 'attendees') packageEditor.attendees = event.target.value;
      }
    });
    $('#package-editor-fields').addEventListener('change', (event) => {
      if (!packageEditor) return;
      if (event.target.id === 'package-select-all') {
        $$('[data-package-included]').forEach((input) => {
          input.checked = event.target.checked;
          if (input.checked) packageEditor.includedItems.add(input.dataset.packageIncluded); else packageEditor.includedItems.delete(input.dataset.packageIncluded);
        });
      } else if (event.target.dataset.packageIncluded) {
        if (event.target.checked) packageEditor.includedItems.add(event.target.dataset.packageIncluded); else packageEditor.includedItems.delete(event.target.dataset.packageIncluded);
        const all = Array.from($$('[data-package-included]'));
        if ($('#package-select-all')) $('#package-select-all').checked = all.length > 0 && all.every((input) => input.checked);
      }
    });
    $('#package-apply').addEventListener('click', applyPackageUpdate);

    $('#pricing-cancel').addEventListener('click', () => closeCartItemEditor());
    $$('input[name="price-mode"]').forEach((radio) => radio.addEventListener('change', () => {
      $('#changed-price-fields').hidden = radio.value !== 'change';
    }));
    $('#pricing-open-time').addEventListener('click', () => {
      if (!pricingEditor) return;
      switchCartItemEditorTab('time');
    });
    $('#pricing-open-package').addEventListener('click', () => {
      if (!pricingEditor) return;
      switchCartItemEditorTab('package');
    });
    $('#pricing-apply').addEventListener('click', applyPricingUpdate);

    $('#surface-toggle').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') {
        const opening = !j2State.assetsDrawerOpen;
        if (opening) j2State.demoOpen = false;
        j2State.assetsDrawerOpen = opening;
        j2Render();
        if (j2State.assetsDrawerOpen) $('#j2-selected-assets')?.focus();
        else $('#surface-toggle')?.focus();
        return;
      }
      if (document.body.dataset.journey === '3') {
        if (j3IsExplorerOpen()) j3CloseExplorer();
        else j3OpenExplorer($('#surface-toggle'));
        return;
      }
      const cur = document.body.dataset.surface;
      document.body.dataset.surface = cur === 'assets' ? 'week' : 'assets';
      $('#surface-toggle').textContent = document.body.dataset.surface === 'assets' ? 'Week' : 'Assets';
    });

    $('#sheet-handle').addEventListener('click', () => {
      setSheetExpanded(!document.body.classList.contains('sheet-expanded'));
    });

    $$('.stage-chip').forEach((btn) => {
      btn.addEventListener('click', () => applyStageTarget(btn.dataset.stageTarget));
    });

    $$('.stress-btn').forEach((btn) => {
      btn.addEventListener('click', () => applyStressCount(Number(btn.dataset.stress)));
    });

    $('#btn-play-journey').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') j2PlayJourney();
      else if (document.body.dataset.journey === '3') j3PlayJourney();
      else if (document.body.dataset.journey === '4') j4PlayJourney();
      else if (document.body.dataset.journey === '5') j5PlayJourney();
      else if (document.body.dataset.journey === '6') j6PlayJourney();
      else playJourney();
    });
    $('#btn-play-complete').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') j2PlayComplete();
      else if (document.body.dataset.journey === '3') j3PlayComplete();
      else if (document.body.dataset.journey === '4') j4PlayComplete();
      else if (document.body.dataset.journey === '5') j5PlayComplete();
      else if (document.body.dataset.journey === '6') j6PlayComplete();
      else playCompleteJourney();
    });

    $('#review-rail-toggle').addEventListener('click', () => {
      const panel = $('#review-rail-panel');
      const open = panel.hidden;
      panel.hidden = !open;
      $('#review-rail-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    $$('input[name="theme"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        document.documentElement.dataset.theme = radio.value;
      });
    });

    ['#mismatch-dialog', '#remove-dialog', '#clear-dialog', '#date-picker-dialog', '#cart-item-editor-dialog', '#j4-details-dialog', '#j5-workflow-dialog'].forEach((sel) => {
      trapDialogFocus($(sel));
    });
    trapDialogFocus($('#j9-dialog'));

    window.addEventListener('resize', () => {
      if (document.body.dataset.journey !== '2') positionCartForViewport();
      if (isContextualWorkspace()) {
        if (!contextualAllowsBothPanels() && contextualAssetIsOpen() && contextualCartIsOpen()) {
          if (contextualLastSurface === 'assets') contextualCloseCart({ restore: false, dismiss: true, announce: false });
          else contextualCloseAssets({ restore: false, announce: false });
        }
        contextualSyncSurfaces();
      }
    });

    reviewPackages = generateReviewPackages();
    reviewConcessions = generateReviewConcessions();
    setupContextualWorkspace();
    setupPickerEvents();
    if (isJ8) j8BindEvents();
    if (isJ4 || isJ5 || isJ6) j4SetupEvents();
    if (isJ5 || isJ6 || document.body.dataset.journey === '12') j5SetupEvents();
    if (!isJ2) {
      setupAssetExplorerEvents();
      if (!isJ3) {
        $$('.review-scale-btn').forEach((btn) => {
          btn.addEventListener('click', () => regenReviewScale(Number(btn.dataset.scale)));
        });
        regenReviewScale(1000);
        ['item', 'package', 'concession'].forEach(syncFieldDisplay);
        renderCallerContext();
      }
    }

    if (isJ2) {
      j2BindEvents();
      loadTimeslotVisualOptions().then(() => j2Render());
    } else if (isJ3) {
      loadTimeslotVisualOptions().then(() => j3ResetBootState());
    } else if (isJ4) {
      loadTimeslotVisualOptions().then(() => j4ResetBootState());
    } else if (isJ5) {
      loadTimeslotVisualOptions().then(() => j5ResetBootState());
    } else if (isJ6) {
      loadTimeslotVisualOptions().then(() => j6ResetBootState());
    } else if (isJ7) {
      loadTimeslotVisualOptions().then(() => j7ResetBootState());
    } else if (isJ8) {
      loadTimeslotVisualOptions().then(() => j8ResetBootState());
    } else if (isJ9) {
      loadTimeslotVisualOptions().then(() => { resetJourney(); initJ9(); });
    } else {
      loadTimeslotVisualOptions().then(() => resetJourney());
    }
  }

  /* ===== Journey 8 isolated UJ-09 existing item/package/pricing change ===== */

  const J8_BOUNDARY = 'PARTIAL · REVIEW FIXTURE · NO SERVER REQUEST';
  const J8_TOTAL_UNAVAILABLE = 'Proposed total unavailable — calculation unverified for the change flow; formula open.';
  const J8_BLOCKED_COPY = 'BLOCKED/DEFECT-AFFECTED — Booking preview returned HTTP 400; no Booking PATCH follows. No successful Booking update is claimed or simulated.';
  const J8_ITEMS = [
    { id: 'current-item', label: 'Studio 2 private allocation', current: true },
    { id: 'alternate-item', label: 'Studio lighting review fixture', current: false }
  ];
  const J8_PACKAGES = [
    { id: 'current-package', label: 'Private day package · current fixture', current: true },
    { id: 'alternate-package', label: 'Private evening package · local fixture', current: false },
    { id: 'upsell-package', label: 'Private package add-on · local fixture', current: false }
  ];
  let j8State = 'hub';
  let j8Operation = null;
  let j8Subject = null;
  let j8Baseline = null;
  let j8Trigger = null;
  let j8PickerKind = null;
  let j8PickerTrigger = null;
  let j8PickerSuspendedWorkflow = false;
  let j8PickerBackgroundSnapshot = [];
  let j8PickerSemanticsSnapshot = null;
  let j8Closing = false;

  function isJ8Journey() { return document.body.dataset.journey === '8'; }
  function j8Clone(value) { return JSON.parse(JSON.stringify(value)); }
  function j8Equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function j8Announce(message) {
    const workflow = $('#j5-workflow-dialog');
    if (workflow?.open || j8PickerSuspendedWorkflow) {
      const live = $('#j5-workflow-announcement');
      if (live) live.textContent = message;
    } else {
      const hub = $('#j5-action-announcement');
      if (hub) hub.textContent = message;
    }
  }
  function j8Footer(html) {
    const footer = $('#j5-workflow-footer');
    if (footer) footer.innerHTML = html;
  }
  function j8Button(command, text, cls = 'btn-secondary', disabled = false) {
    return `<button type="button" class="${cls}" data-j8-command="${command}"${disabled ? ' disabled' : ''}>${text}</button>`;
  }
  function j8HideWorkflowClose(hidden) {
    const close = $('#j5-workflow-close');
    if (close) { close.hidden = hidden; close.inert = hidden; close.setAttribute('aria-hidden', String(hidden)); }
  }
  function j8HideHubDismissControls(hidden) {
    ['#j4-details-close', '#j4-details-back'].forEach((selector) => {
      const control = $(selector);
      if (control) { control.hidden = hidden; control.inert = hidden; control.setAttribute('aria-hidden', String(hidden)); }
    });
  }
  function j8BookingBlock() {
    const ref = J5_BASE_BOOKING.reference.replace('LOCAL-', '');
    return Array.from(document.querySelectorAll('#calendar-grid .cal-event')).find((el) => el.querySelector('strong')?.textContent.trim() === ref) || null;
  }
  function j8HubFocusables() {
    const details = $('#j4-details-dialog');
    if (!details || !isJ8Journey() || j8State !== 'hub') return [];
    return Array.from(details.querySelectorAll('#j4-details-close, .j5-action-grid [data-j8-action], #j4-details-back')).filter((el) => !el.hidden && !el.disabled && el.getClientRects().length > 0);
  }
  function j8FocusTerminalCancel() {
    const cancel = $('#j5-workflow-dialog [data-j8-command="terminal-cancel"]');
    if (cancel && !cancel.hidden && !cancel.disabled) cancel.focus();
  }
  function j8GuardWorkflowClose() {
    const workflow = $('#j5-workflow-dialog');
    if (!workflow || workflow.dataset.j8CloseGuarded) return;
    const nativeClose = workflow.close.bind(workflow);
    workflow.close = (...args) => {
      if (isJ8Journey() && j8State === 'persist_blocked' && !j8Closing && !j8PickerSuspendedWorkflow) {
        workflow.hidden = false;
        workflow.inert = false;
        workflow.removeAttribute('aria-hidden');
        if (!workflow.open) workflow.showModal();
        j8FocusTerminalCancel();
        return;
      }
      return nativeClose(...args);
    };
    workflow.dataset.j8CloseGuarded = 'true';
  }
  function j8OpenHub(trigger) {
    if (!isJ8Journey()) return;
    j8Subject = j8Clone(J5_BASE_BOOKING);
    j8Operation = null;
    j8State = 'hub';
    j8Trigger = trigger || j8Trigger || document.activeElement;
    const details = $('#j4-details-dialog');
    if (!details) return;
    if (!details.dataset.j8CloseGuarded) {
      const nativeClose = details.close.bind(details);
      details.close = (...args) => nativeClose(...args);   // OC-3: the hub can be closed
      details.dataset.j8CloseGuarded = 'true';
    }
    details.hidden = false; details.inert = false; details.removeAttribute('aria-hidden');
    $('#j4-only-details').hidden = true;
    $('#j4-only-details').inert = true;
    $('#j5-action-hub').hidden = false;
    $('#j5-action-hub').inert = false;
    $('#j5-action-hub').removeAttribute('aria-hidden');
    $('#j4-details-kicker').textContent = 'Existing Booking · review-only entry';
    $('#j4-details-title').textContent = j8Subject.reference;
    $('#j4-details-close').setAttribute('aria-label', 'Close booking details');
    j8HideHubDismissControls(false);   // OC-3: × and "Close review" are shown
    details.setAttribute('aria-describedby', 'j5-details-intro j5-review-boundary');
    $('#j4-details-back').textContent = 'Close';   // OC-3-E: the second close button reads "Close" (was "Close review")
    $('#j5-total').textContent = 'Amount not asserted · change-flow calculation unverified';
    const totalLabel = $('#j5-total')?.parentElement?.querySelector('dt');
    if (totalLabel) totalLabel.textContent = 'Pricing evidence';
    $('#j5-state-message').textContent = `${J8_BOUNDARY} · UJ-09 existing item/package/pricing change.`;
    $('#j5-state-message').className = 'j5-state-message is-partial';
    $('#j5-review-boundary').innerHTML = '<strong>Review-only entry</strong> — Product navigation into this existing Booking is not runtime-proven. Local fixture only; no server request; reload resets the review.<br><span class="j8-scope-exclusions"><strong>OUT OF SCOPE:</strong> reallocation/change-assets · recurrence/occurrences · strict/lenient concession outcome · public packages/price bands.</span>';
    $('#j5-actions-title').textContent = 'Existing Booking changes';
    $('#j5-actions-title').nextElementSibling.textContent = 'Review the bounded local change surfaces; no Booking mutation is available.';
    const grid = $('.j5-action-grid');
    if (grid) {
      grid.innerHTML = [
        '<button type="button" class="j5-action" data-j8-action="item">Change item</button>',
        '<button type="button" class="j5-action" data-j8-action="package">Change private package</button>',
        '<button type="button" class="j5-action" data-j8-action="pricing">Change pricing</button>'
      ].join('');
    }
    $('#j5-action-announcement').textContent = 'No Journey 8 change has been requested.';
    $('#j5-workflow-announcement').textContent = '';
    $('#ldp-live').textContent = '';
    if (!details.open) details.showModal();
    window.setTimeout(() => $('.j5-action-grid [data-j8-action]')?.focus(), 0);
  }
  function j8CloseHub() {
    const details = $('#j4-details-dialog');
    if (details?.open) details.close();
    if (details) { details.hidden = true; details.inert = true; details.setAttribute('aria-hidden', 'true'); }
    $('#j5-action-hub').hidden = true;
    $('#j5-action-hub').inert = true;
    $('#j5-action-hub').setAttribute('aria-hidden', 'true');
    const target = isJ8Journey() ? (j8BookingBlock() || j8Trigger) : j8Trigger;   // OC-3: back to the calendar
    j8Trigger = null;
    target?.focus?.();
  }
  function j8Start(action, trigger) {
    j8Trigger = trigger || document.activeElement;
    j8Operation = {
      action,
      itemChoice: 'current-item',
      packageChoice: 'current-package',
      configuration: 'theatre',
      concession: 'none',
      priceMode: 'default',
      priceType: 'daily',
      unit: 'day',
      attendeeCount: 12,
      packageMore: false,
      selectedIncluded: new Set(['standard-room']),
      validationError: false
    };
    j8State = action === 'pricing' ? 'pricing_setup' : action === 'item' ? 'item_change' : 'pkg_step_one';
    const details = $('#j4-details-dialog');
    $('#j5-action-announcement').textContent = '';
    $('#j5-state-message').textContent = '';
    $('#ldp-live').textContent = '';
    if (details?.open) details.close('workflow');
    if (details) { details.hidden = true; details.inert = true; details.setAttribute('aria-hidden', 'true'); }
    const dialog = $('#j5-workflow-dialog');
    if (!dialog) return;
    dialog.hidden = false; dialog.inert = false; dialog.removeAttribute('aria-hidden');
    j8Render();
    dialog.showModal();
    window.setTimeout(() => dialog.querySelector('[data-j8-autofocus], input, select, button:not(.dialog-close)')?.focus(), 0);
    j8Announce(`Journey 8 ${j8State.replaceAll('_', ' ')} opened.`);
  }
  function j8SetState(next, message) {
    j8State = next;
    j8Render();
    if (message) j8Announce(message);
  }
  function j8SnapshotPickerSemantics(picker) {
    const attrs = ['role', 'aria-modal', 'aria-label', 'aria-labelledby', 'aria-describedby'];
    j8PickerSemanticsSnapshot = Object.fromEntries(attrs.map((name) => [name, { present: picker.hasAttribute(name), value: picker.getAttribute(name) }]));
  }
  function j8RestorePickerSemantics(picker) {
    if (!picker || !j8PickerSemanticsSnapshot) return;
    Object.entries(j8PickerSemanticsSnapshot).forEach(([name, entry]) => {
      if (entry.present) picker.setAttribute(name, entry.value);
      else picker.removeAttribute(name);
    });
    j8PickerSemanticsSnapshot = null;
  }
  function j8SnapshotPickerBackground() {
    j8PickerBackgroundSnapshot = Array.from(document.body.children).filter((el) => {
      return el.id !== 'large-data-picker' && el.id !== 'large-data-picker-backdrop' && el.tagName !== 'SCRIPT';
    }).map((el) => ({
      el,
      inert: el.inert,
      ariaHiddenPresent: el.hasAttribute('aria-hidden'),
      ariaHidden: el.getAttribute('aria-hidden')
    }));
    j8PickerBackgroundSnapshot.forEach(({ el }) => {
      el.inert = true;
      el.setAttribute('aria-hidden', 'true');
    });
  }
  function j8RestorePickerBackground() {
    j8PickerBackgroundSnapshot.forEach(({ el, inert, ariaHiddenPresent, ariaHidden }) => {
      el.inert = inert;
      if (ariaHiddenPresent) el.setAttribute('aria-hidden', ariaHidden);
      else el.removeAttribute('aria-hidden');
    });
    j8PickerBackgroundSnapshot = [];
  }
  function j8PickerFocusables() {
    const picker = $('#large-data-picker');
    if (!picker) return [];
    return Array.from(picker.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hidden && el.getClientRects().length > 0);
  }
  function j8HandlePickerKeydown(event) {
    if (!j8PickerKind) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      j8ClosePicker();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = j8PickerFocusables();
    if (!focusables.length) { event.preventDefault(); return; }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || !focusables.includes(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !focusables.includes(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }
  function j8ResumeWorkflowAfterPicker(focusSelector) {
    if (!j8PickerSuspendedWorkflow) {
      $(focusSelector)?.focus();
      return;
    }
    j8PickerSuspendedWorkflow = false;
    const dialog = $('#j5-workflow-dialog');
    if (!dialog) return;
    dialog.hidden = false; dialog.inert = false; dialog.removeAttribute('aria-hidden');
    j8Render();
    dialog.showModal();
    window.setTimeout(() => $(focusSelector)?.focus(), 0);
  }
  function j8ClosePicker(refocus) {
    const picker = $('#large-data-picker');
    const backdrop = $('#large-data-picker-backdrop');
    if (picker) { picker.hidden = true; picker.inert = true; picker.setAttribute('aria-hidden', 'true'); j8RestorePickerSemantics(picker); }
    if (backdrop) { backdrop.hidden = true; backdrop.inert = true; backdrop.setAttribute('aria-hidden', 'true'); }
    j8RestorePickerBackground();
    const kind = j8PickerKind;
    const target = refocus || j8PickerTrigger;
    const focusSelector = `[data-j8-open-picker="${kind}"]`;
    const resumeWorkflow = j8PickerSuspendedWorkflow;
    j8PickerKind = null; j8PickerTrigger = null;
    if (resumeWorkflow) j8ResumeWorkflowAfterPicker(focusSelector);
    else target?.focus?.();
  }
  function j8RenderPicker() {
    const list = $('#large-data-listbox');
    const filter = ($('#large-data-filter')?.value || '').toLowerCase();
    if (!list) return;
    const source = j8PickerKind === 'item' ? J8_ITEMS : J8_PACKAGES;
    list.innerHTML = source.filter((entry) => entry.label.toLowerCase().includes(filter)).map((entry) => `<button type="button" class="j8-picker-row" data-j8-pick="${entry.id}" role="option" aria-selected="false">${entry.label}</button>`).join('') || '<p class="picker-empty">No local fixture matches.</p>';
  }
  function j8OpenPicker(kind, trigger) {
    j8PickerKind = kind;
    j8PickerTrigger = trigger || document.activeElement;
    const workflow = $('#j5-workflow-dialog');
    if (workflow?.open) {
      j8PickerSuspendedWorkflow = true;
      workflow.close('picker-suspend');
    }
    const picker = $('#large-data-picker');
    const backdrop = $('#large-data-picker-backdrop');
    if (!picker || !backdrop) return;
    j8SnapshotPickerSemantics(picker);
    j8SnapshotPickerBackground();
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-modal', 'true');
    picker.setAttribute('aria-label', `${kind === 'item' ? 'Item' : 'Private package'} picker · Journey 8 review fixture`);
    picker.hidden = false; picker.inert = false; picker.removeAttribute('aria-hidden');
    backdrop.hidden = false; backdrop.inert = false; backdrop.removeAttribute('aria-hidden');
    $('#large-data-picker-meta').textContent = `${kind === 'item' ? 'Item' : 'Private package'} · REVIEW FIXTURE · local list only`;
    $('#large-data-filter').value = '';
    j8RenderPicker();
    window.setTimeout(() => $('#large-data-filter')?.focus(), 0);
  }
  function j8DismissMismatch() {
    const dialog = $('#mismatch-dialog');
    if (dialog?.open) dialog.close();
    j8State = 'pricing_setup';
    j8Announce('Mismatch dismissed. Prior Journey 8 pricing values remain unchanged; no package swap occurred.');
    $('#j8-configuration')?.focus();
  }
  function j8RenderCommon(title, eyebrow) {
    const workflowTitle = $('#j5-workflow-title');
    const kicker = $('#j5-workflow-kicker');
    const description = $('#j5-workflow-description');
    const stage = $('#j5-workflow-stage');
    if (workflowTitle) workflowTitle.textContent = title;
    if (kicker) kicker.textContent = eyebrow;
    if (description) description.textContent = `${J8_BOUNDARY} · UJ-09. Local fixture only; reload resets this review.`;
    if (stage) { stage.setAttribute('aria-live', 'off'); stage.innerHTML = `<p class="j8-boundary"><strong>${J8_BOUNDARY}</strong> · UJ-09 existing item/package/pricing change.</p>`; }
    $('#j5-workflow-preview').hidden = true;
    $('#j5-workflow-preview').replaceChildren();
    j8HideWorkflowClose(j8State === 'persist_blocked');
  }
  function j8RenderPricing() {
    const op = j8Operation;
    const custom = op.priceMode === 'custom';
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel" aria-labelledby="j8-pricing-heading">
      <h3 id="j8-pricing-heading">Change pricing</h3>
      <p class="j8-evidence">UNVERIFIED · pricing result unverified for this change flow.</p>
      <fieldset class="j8-fieldset"><legend>Price mode</legend><label><input type="radio" name="j8-price-mode" value="default" ${!custom ? 'checked' : ''}> Default</label><label><input type="radio" name="j8-price-mode" value="custom" ${custom ? 'checked' : ''}> Custom</label></fieldset>
      <div class="j8-grid"><label>Configuration<select id="j8-configuration"><option value="theatre" ${op.configuration === 'theatre' ? 'selected' : ''}>Theatre</option><option value="mismatch">Incompatible configuration · test mismatch</option></select></label><label>Concession<select id="j8-concession"><option value="none" ${op.concession === 'none' ? 'selected' : ''}>None</option><option value="review" ${op.concession === 'review' ? 'selected' : ''}>Review fixture concession</option></select></label><label class="j8-custom-only" ${custom ? '' : 'hidden'}>Price type<select id="j8-price-type" ${custom ? '' : 'disabled'}><option value="daily" ${op.priceType === 'daily' ? 'selected' : ''}>Daily</option><option value="session">Session</option><option value="hourly">Hourly</option></select></label><label class="j8-custom-only" ${custom ? '' : 'hidden'}>Pricing unit<select id="j8-unit" ${custom ? '' : 'disabled'}><option value="day" ${op.unit === 'day' ? 'selected' : ''}>Day</option><option value="session">Session</option><option value="hour">Hour</option></select></label></div>
      <p class="j8-total-unavailable">${J8_TOTAL_UNAVAILABLE}</p><p id="j8-apply-reason" class="j8-reason" ${op.validationError ? '' : 'hidden'}>Apply disabled: an item or validation state is not available.</p>
    </section>`);
    j8Footer(`${j8Button('cancel', 'Cancel without loss')} ${j8Button('apply-pricing', 'Review proposed change', 'btn-primary', op.validationError)}`);
  }
  function j8RenderItem() {
    const current = j8Operation.itemChoice === 'current-item';
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel" aria-labelledby="j8-item-heading"><h3 id="j8-item-heading">Change item</h3><p class="j8-evidence">REVIEW FIXTURE · local item search and selection only.</p><button type="button" class="btn-secondary" data-j8-open-picker="item" data-j8-autofocus>Search local items</button><fieldset class="j8-list-fieldset"><legend>Item selection</legend>${J8_ITEMS.map((item) => `<label><input type="radio" name="j8-item" value="${item.id}" ${j8Operation.itemChoice === item.id ? 'checked' : ''}> ${item.label}${item.current ? ' · current' : ''}</label>`).join('')}</fieldset><p class="j8-selection-note">Apply is unavailable while the selected item is the current item.</p></section>`);
    j8Footer(`${j8Button('cancel', 'Cancel without loss')} ${j8Button('item-apply', 'Apply replacement', 'btn-primary', current)}`);
  }
  function j8RenderPackageOne() {
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel" aria-labelledby="j8-package-one-heading"><h3 id="j8-package-one-heading">Change private package · step one</h3><p class="j8-evidence">UNVERIFIED · package search and load-more presentation.</p><button type="button" class="btn-secondary" data-j8-open-picker="package" data-j8-autofocus>Search local packages</button><fieldset class="j8-list-fieldset"><legend>Private package selection</legend>${J8_PACKAGES.slice(0, j8Operation.packageMore ? 3 : 2).map((pkg) => `<label><input type="radio" name="j8-package" value="${pkg.id}" ${j8Operation.packageChoice === pkg.id ? 'checked' : ''}> ${pkg.label}${pkg.current ? ' · current' : ''}</label>`).join('')}</fieldset><button type="button" class="btn-ghost" data-j8-command="package-more">More…</button><p class="j8-selection-note">Load more is a local presentation only; no catalog claim is made.</p></section>`);
    j8Footer(`${j8Button('cancel', 'Cancel without loss')} ${j8Button('package-continue', 'Continue to step two', 'btn-primary')}`);
  }
  function j8RenderPackageTwo() {
    const all = j8Operation.selectedIncluded.size === 2;
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel" aria-labelledby="j8-package-two-heading"><h3 id="j8-package-two-heading">Change private package · step two</h3><p class="j8-evidence">UNVERIFIED · attendees and package items are local fixture bounds, not production rules.</p><label>Attendees <input id="j8-attendees" type="number" min="1" max="18" value="${j8Operation.attendeeCount}" aria-describedby="j8-attendee-bound"></label><p id="j8-attendee-bound" class="j8-selection-note">Local fixture bound: 1–18 attendees; no universal default is claimed.</p><fieldset class="j8-list-fieldset"><legend>Package items</legend><label><input type="checkbox" data-j8-included="standard-room" ${j8Operation.selectedIncluded.has('standard-room') ? 'checked' : ''}> Standard item · local fixture</label><label><input type="checkbox" data-j8-included="upsell-item" ${j8Operation.selectedIncluded.has('upsell-item') ? 'checked' : ''}> Upsell item · local fixture</label><label><input type="checkbox" id="j8-select-all" ${all ? 'checked' : ''}> Select all</label></fieldset></section>`);
    j8Footer(`${j8Button('cancel', 'Cancel without loss')} ${j8Button('package-back', 'Back')} ${j8Button('package-apply', 'Apply package to proposal', 'btn-primary')}`);
  }
  function j8RenderConfirm(kind) {
    const sales = kind === 'sales_category_confirm';
    j8RenderCommon(sales ? 'Confirm sales category' : 'Confirm proposed branch', sales ? 'Sales category review' : 'Branch review');
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel j8-confirm-panel"><h3>${sales ? 'Sales category confirmation' : 'Generic branch confirmation'}</h3><p>${sales ? 'Confirm or cancel only. This review performs no validation, branching rule or persistence.' : 'Confirm the proposed local branch. No branch taxonomy or Booking mutation is claimed.'}</p><span class="j8-evidence">${sales ? 'UNVERIFIED' : 'PARTIAL'}</span></section>`);
    j8Footer(`${j8Button('cancel', 'Cancel')} ${j8Button(sales ? 'sales-proceed' : 'branch-confirm', sales ? 'Proceed' : 'Confirm', 'btn-primary')}`);
  }
  function j8RenderProposed() {
    j8RenderCommon('Proposed local change', 'Proposed result');
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel j8-proposed" aria-labelledby="j8-proposed-heading"><h3 id="j8-proposed-heading">PROPOSED · LOCAL ONLY · NOT PERSISTED</h3><dl class="j8-proposal-facts"><div><dt>Original Booking</dt><dd>${j8Subject.reference} · version ${j8Subject.version}</dd></div><div><dt>Current fixture</dt><dd>${j8Subject.resource} · ${j8Subject.dateLabel} · ${j8Subject.time}</dd></div><div><dt>Proposed change</dt><dd>${j8Operation.itemChoice === 'current-item' ? 'Current item retained' : 'Alternate item selected'} · ${j8Operation.packageChoice === 'current-package' ? 'Current package retained' : 'Alternate package selected'}</dd></div></dl><p class="j8-total-unavailable">${J8_TOTAL_UNAVAILABLE}</p><p class="j8-evidence">UNVERIFIED · local comparison only; original Booking remains unchanged.</p></section>`);
    j8Footer(`${j8Button('proposed-back', 'Back')} ${j8Button('patch-preview', 'Review patch preview', 'btn-primary')}`);
  }
  function j8RenderBlocked() {
    j8RenderCommon('Preview blocked', 'Terminal blocker');
    $('#j5-workflow-stage').insertAdjacentHTML('beforeend', `<section class="j8-panel j8-blocked" aria-labelledby="j8-blocked-heading"><h3 id="j8-blocked-heading">${J8_BLOCKED_COPY}</h3><p>Original Booking remains unchanged. This terminal state has no retry, override, confirm or update-success action.</p><span class="j8-evidence">BLOCKED/DEFECT-AFFECTED</span></section>`);
    j8Footer(j8Button('terminal-cancel', 'Cancel without loss', 'btn-primary'));
  }
  function j8Render() {
    if (!j8Operation) return;
    const focusBefore = workflowFocusCapture();   // A11Y-INH-02 (rule R2): keep keyboard focus inside the step window across the redraw
    j8RenderStep();
    workflowFocusRestore(focusBefore);
  }
  function j8RenderStep() {
    if (!j8Operation) return;
    if (j8State === 'pricing_setup' || j8State === 'mismatch') { j8RenderCommon('Change pricing', 'Existing Booking pricing'); j8RenderPricing(); return; }
    if (j8State === 'item_change') { j8RenderCommon('Change item', 'Existing Booking item'); j8RenderItem(); return; }
    if (j8State === 'pkg_step_one') { j8RenderCommon('Change private package', 'Existing Booking package'); j8RenderPackageOne(); return; }
    if (j8State === 'pkg_step_two') { j8RenderCommon('Change private package', 'Existing Booking package'); j8RenderPackageTwo(); return; }
    if (j8State === 'sales_category_confirm' || j8State === 'branch_confirm') { j8RenderConfirm(j8State); return; }
    if (j8State === 'proposed') { j8RenderProposed(); return; }
    if (j8State === 'persist_blocked') { j8RenderBlocked(); return; }
  }
  function j8CancelToHub() {
    if (j8Closing) return;
    j8Closing = true;
    const workflow = $('#j5-workflow-dialog');
    if (workflow?.open) workflow.close('cancel-without-loss');
    j8Operation = null;
    j8State = 'hub';
    j8HideWorkflowClose(false);
    j8OpenHub(j8Trigger || $('#j4-open-private'));
    j8Closing = false;
    j8Announce('Cancelled without loss. Original Booking fixture remains unchanged.');
  }
  function j8HandleCommand(command) {
    if (!j8Operation) return;
    if (command === 'cancel') return j8CancelToHub();
    if (command === 'terminal-cancel') return j8CancelToHub();
    if (j8State === 'pricing_setup' && command === 'apply-pricing') return j8SetState('sales_category_confirm', 'Sales category confirmation opened. No validation or branching logic is asserted.');
    if (j8State === 'item_change' && command === 'item-apply') return j8SetState('pricing_setup', 'Alternate item selected for the local proposal.');
    if (j8State === 'pkg_step_one' && command === 'package-more') { j8Operation.packageMore = true; return j8Render(); }
    if (j8State === 'pkg_step_one' && command === 'package-continue') return j8SetState('pkg_step_two', 'Package step two opened; step-one selection is preserved.');
    if (j8State === 'pkg_step_two' && command === 'package-back') return j8SetState('pkg_step_one', 'Returned to package step one with selection preserved.');
    if (j8State === 'pkg_step_two' && command === 'package-apply') return j8SetState('pricing_setup', 'Package selection added to the local proposal.');
    if (j8State === 'sales_category_confirm' && command === 'sales-proceed') return j8SetState('branch_confirm', 'Generic branch confirmation opened.');
    if (j8State === 'branch_confirm' && command === 'branch-confirm') return j8SetState('proposed', 'Local proposed result opened; no Booking mutation occurred.');
    if (j8State === 'proposed' && command === 'proposed-back') return j8SetState('pricing_setup', 'Returned to pricing setup for revision.');
    if (j8State === 'proposed' && command === 'patch-preview') return j8SetState('persist_blocked', 'Patch preview is blocked by the observed HTTP 400; the terminal state exposes only Cancel without loss.');
  }
  function j8HandleChange(event) {
    const target = event.target;
    if (!j8Operation) return;
    if (target.name === 'j8-price-mode') { j8Operation.priceMode = target.value; return j8Render(); }
    if (target.id === 'j8-configuration') {
      if (target.value === 'mismatch') {
        target.value = j8Operation.configuration;
        j8State = 'mismatch';
        openMismatchDialog(target);
        j8Announce('Incompatible configuration detected. Existing values are preserved; no package swap occurred.');
      } else j8Operation.configuration = target.value;
      return;
    }
    if (target.id === 'j8-concession') { j8Operation.concession = target.value; return; }
    if (target.id === 'j8-price-type') { j8Operation.priceType = target.value; return; }
    if (target.id === 'j8-unit') { j8Operation.unit = target.value; return; }
    if (target.name === 'j8-item') { j8Operation.itemChoice = target.value; return j8Render(); }
    if (target.name === 'j8-package') { j8Operation.packageChoice = target.value; return; }
    if (target.id === 'j8-attendees') { j8Operation.attendeeCount = Math.max(1, Math.min(18, Number(target.value) || 1)); return; }
    if (target.dataset.j8Included) { if (target.checked) j8Operation.selectedIncluded.add(target.dataset.j8Included); else j8Operation.selectedIncluded.delete(target.dataset.j8Included); return; }
    if (target.id === 'j8-select-all') { ['standard-room', 'upsell-item'].forEach((id) => target.checked ? j8Operation.selectedIncluded.add(id) : j8Operation.selectedIncluded.delete(id)); return j8Render(); }
  }
  function j8HandleClick(event) {
    const action = event.target.closest('[data-j8-action]');
    if (action) return j8Start(action.dataset.j8Action, action);
    const command = event.target.closest('[data-j8-command]');
    if (command && (command.closest('#j5-workflow-footer') || command.closest('#j5-workflow-stage'))) return j8HandleCommand(command.dataset.j8Command);
    const pickerOpen = event.target.closest('[data-j8-open-picker]');
    if (pickerOpen) return j8OpenPicker(pickerOpen.dataset.j8OpenPicker, pickerOpen);
    const picked = event.target.closest('[data-j8-pick]');
    if (picked && j8PickerKind) {
      if (j8PickerKind === 'item') j8Operation.itemChoice = picked.dataset.j8Pick;
      else j8Operation.packageChoice = picked.dataset.j8Pick;
      j8ClosePicker();
      j8Render();
    }
  }
  function j8BindEvents() {
    document.addEventListener('click', j8HandleClick);
    // OC-3: with the change hub closed, the booking being changed (BK-10482 in the calendar) reopens it.
    const j8Reenter = (event) => {
      const block = event.target.closest?.('#calendar-grid .cal-event');
      if (!block || block !== j8BookingBlock()) return;
      if ($('#j4-details-dialog')?.open || $('#j5-workflow-dialog')?.open) return;
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      j8OpenHub(block);
    };
    document.addEventListener('click', j8Reenter, true);
    document.addEventListener('keydown', j8Reenter, true);
    $('#j5-workflow-stage').addEventListener('change', j8HandleChange);
    $('#large-data-filter').addEventListener('input', j8RenderPicker);
    $('#large-data-picker').addEventListener('keydown', j8HandlePickerKeydown);
    $('#large-data-picker-cancel').addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); j8ClosePicker(); }, true);
    $('#large-data-picker-backdrop').addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); j8ClosePicker(); }, true);
    $('#mismatch-close').addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); j8DismissMismatch(); }, true);
    $('#mismatch-fix').addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); j8DismissMismatch(); }, true);
    $('#mismatch-dialog').addEventListener('cancel', (event) => { event.preventDefault(); j8DismissMismatch(); }, true);
    const details = $('#j4-details-dialog');
    details.addEventListener('keydown', (event) => {
      if (!isJ8Journey() || j8State !== 'hub' || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      j8CloseHub();   // OC-3: Escape closes the hub
    }, true);
    details.addEventListener('cancel', (event) => {
      if (!isJ8Journey()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (j8Operation) j8CancelToHub();
      else j8CloseHub();   // OC-3
    }, true);
    details.addEventListener('close', () => {
      if (isJ8Journey() && j8State === 'hub' && !j8Operation) j8CloseHub();   // OC-3: tidy up after a close
    });
    $('#j4-details-close').addEventListener('click', () => j8CloseHub());
    $('#j4-details-back').addEventListener('click', () => j8CloseHub());
    const detailsFocusGuard = $('#j4-details-dialog');
    detailsFocusGuard.addEventListener('focusin', (event) => {
      if (!isJ8Journey() || j8State !== 'hub') return;
      const focusables = j8HubFocusables();
      if (focusables.length && !focusables.includes(event.target)) {
        event.stopImmediatePropagation();
        focusables[0].focus();
      }
    }, true);
    detailsFocusGuard.addEventListener('keydown', (event) => {
      if (!isJ8Journey() || j8State !== 'hub' || event.key !== 'Tab') return;
      const focusables = j8HubFocusables();
      if (!focusables.length) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if ((event.shiftKey && (document.activeElement === first || !focusables.includes(document.activeElement))) || (!event.shiftKey && (document.activeElement === last || !focusables.includes(document.activeElement)))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        (event.shiftKey ? last : first).focus();
      }
    }, true);
    j8GuardWorkflowClose();
    const workflow = $('#j5-workflow-dialog');
    workflow.addEventListener('keydown', (event) => {
      if (!isJ8Journey() || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (j8State === 'persist_blocked') { j8FocusTerminalCancel(); return; }
      j8CancelToHub();
    }, true);
    workflow.addEventListener('cancel', (event) => {
      if (!isJ8Journey()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (j8State === 'persist_blocked') { j8FocusTerminalCancel(); return; }
      j8CancelToHub();
    }, true);
    $('#j5-workflow-close').addEventListener('click', () => { if (!isJ8Journey() || j8State === 'persist_blocked') return; j8CancelToHub(); });
    $('#j5-workflow-dialog').addEventListener('cancel', (event) => { event.preventDefault(); if (j8State !== 'persist_blocked') j8CancelToHub(); });
    $('#j5-workflow-dialog').addEventListener('close', () => { if (j8PickerSuspendedWorkflow) return; if (!j8Closing && j8State !== 'persist_blocked' && j8Operation) j8CancelToHub(); });
  }
  function j8ResetBootState() {
    j8Baseline = j8Clone(J5_BASE_BOOKING);
    j8Subject = j8Clone(j8Baseline);
    $('#amount-region').textContent = '';
    renderCalendar();
    $('#ldp-live').textContent = '';
    window.setTimeout(() => j8OpenHub(j8BookingBlock()), 0);   // OC-3: focus returns to the calendar block
    window.__j8Review = {
      getState: () => j8State,
      getSubject: () => j8Clone(j8Subject),
      getBaseline: () => j8Clone(j8Baseline),
      sourceUnchanged: () => j8Equal(j8Subject, j8Baseline),
      boundary: J8_BOUNDARY,
      blockedCopy: J8_BLOCKED_COPY,
      setMissingItem: () => { if (j8Operation) { j8Operation.itemChoice = null; j8Operation.validationError = true; j8State = 'pricing_setup'; j8Render(); } }
    };
  }

  function boot() {
    window.__j6PublicRescheduleRoot = Object.freeze({ startOperation: j6StartOperation, renderWorkflow: j6RenderWorkflow, handleWorkflowCommand: j6HandleWorkflowCommand, rootFunction: 'j6StartOperation' });
    window.__journey10Shared = Object.freeze({ renderCalendar, trapDialogFocus, applyTimeslotVisual, isFreeSlot, getFixtureFreeRange, announceLive });
    const journey = applyJourneyBoot();
    // One Calendar candidate: Journey 10 uses the Journey 12 calendar density (was 40px rows, Correction 005).
    applyJourneySurfaces(journey);
    closeAllJourneyOverlays();
    if (journey === 2) {
      document.title = 'Optimo Diary — Journey 2 Master-Ancestry Candidate';
      const pickerInput = $('#picker-input');
      if (pickerInput) pickerInput.value = '2026-08-29';
    } else if (journey === 3) {
      document.title = 'Optimo Diary — Journey 3 Asset Search, Hierarchy and Selection';
    } else if (journey === 4) {
      document.title = 'Optimo Diary — Journey 4 Timeslot Rendering and Calendar Interaction';
    } else if (journey === 5) {
      document.title = 'Optimo Diary — Journey 5 Private Lifecycle Candidate';
    } else if (journey === 6) {
      document.title = 'Optimo Diary — Journey 6 Reschedule and Reallocation Candidate';
    } else if (journey === 7) {
      document.title = 'Optimo Diary — Journey 7 New-Booking Pricing Candidate';
      window.__j7Review = Object.freeze({
        snapshot: j7ReviewSnapshot,
        invokeForbiddenPackageGuard: j7ReviewInvokeForbiddenPackageGuard
      });
    } else if (journey === 8) {
      document.title = 'Optimo Diary — Journey 8 Existing Pricing Change Candidate';
    } else if (journey === 9) {
      document.title = 'Optimo Diary — Journey 9 / UJ-11 Recurring Booking Candidate';
    }
    init();
  }


  window.__j15DiaryData = Object.freeze({
    events: EVENTS,
    assets: ASSETS,
    hourLabel(h) {
      const hr = Math.floor(h);
      const min = Math.round((h - hr) * 60);
      return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();



/* ===== Journey 10 isolated candidate — UJ-12 / AC-29 bounded private Block CRUD ===== */
(function journey10IsolatedCandidate() {
  'use strict';
  const isJ10 = () => document.body.dataset.journey === '10';
  const $ = (id) => document.getElementById(id);
  const state = { selection: null, block: null, editorMode: 'create', trigger: null, confirmTrigger: null, busy: false, actions: { create: 0, update: 0, delete: 0 } };
  const baseDate = '2026-08-29';
  const shared = () => window.__journey10Shared || {};
  const slotToLabel = (slot) => { const h = 8 + Math.floor(slot / 2); const m = slot % 2 ? '30' : '00'; return `${String(h).padStart(2, '0')}:${m}`; };
  const durationLabel = (startSlot, endSlot) => { const minutes = Math.max(0, (endSlot - startSlot) * 30); const hours = Math.floor(minutes / 60); const remainder = minutes % 60; if (hours && remainder) return `${hours} ${hours === 1 ? 'hr' : 'hrs'} ${remainder} min`; if (hours) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`; return `${minutes} min`; };
  const announce = (text) => { shared().announceLive?.(text); const toast = $('toast-region'); if (toast) toast.textContent = text; };
  const setHidden = (el, hidden) => { if (!el) return; el.hidden = hidden; el.inert = hidden; if (hidden) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden'); };
  const selectedText = (x) => x ? `${x.assetName} · ${slotToLabel(x.startSlot)}–${slotToLabel(x.endSlot)} · ${x.date}` : 'No interval selected';
  function clearSlotSelection() { document.querySelectorAll('body[data-journey="10"] .cal-slot.j10-selected, body[data-journey="10"] .cal-slot.selected-range, body[data-journey="10"] .cal-slot.range-start, body[data-journey="10"] .cal-slot.range-end').forEach((el) => el.classList.remove('j10-selected', 'selected-range', 'range-start', 'range-end')); }
  function fixtureRange(asset, date, slot) {
    const range = shared().getFixtureFreeRange?.(asset, date, slot);
    if (!range || range.endSlot <= range.startSlot) return null;
    return range;
  }
  function eligibleCell(asset, date, slot) {
    const range = fixtureRange(asset, date, slot);
    const node = document.querySelector(`body[data-journey="10"] .cal-day-col[data-asset="${asset}"][data-date="${date}"] .cal-slot[data-slot="${slot}"]`);
    return !!range && Number.isInteger(slot) && slot >= range.startSlot && slot < range.endSlot && !!node && node.classList.contains('free') && shared().isFreeSlot?.(asset, date, slot) === true;
  }
  function rangeEligible(asset, date, startSlot, endSlot) { return endSlot === startSlot + 1 && eligibleCell(asset, date, startSlot); }
  function slotHeight(col) { return parseFloat(getComputedStyle(col).getPropertyValue('--slot-h') || '10'); }
  function paintSelection() {
    clearSlotSelection(); const x = state.selection;
    const summary = $('j10-selection-summary'); if (summary) summary.textContent = selectedText(x);
    const add = $('j10-add-block'); if (add) add.disabled = !!state.block || !x || !rangeEligible(x.asset, x.date, x.startSlot, x.endSlot);
    if (!x) return;
    document.querySelectorAll(`body[data-journey="10"] .cal-day-col[data-asset="${x.asset}"][data-date="${x.date}"] .cal-slot`).forEach((el) => { const n = Number(el.dataset.slot); if (n >= x.startSlot && n < x.endSlot) { el.classList.add('j10-selected', 'selected-range'); if (n === x.startSlot) el.classList.add('range-start'); if (n === x.endSlot - 1) el.classList.add('range-end'); } });
  }
  function selectionCardNode() {
    const x = state.selection; if (!x || !rangeEligible(x.asset, x.date, x.startSlot, x.endSlot)) return null;
    const col = document.querySelector(`body[data-journey="10"] .cal-day-col[data-asset="${x.asset}"][data-date="${x.date}"]`); if (!col) return null;
    const node = document.createElement('div'); node.className = 'cal-event j10-selection-card'; node.dataset.asset = x.asset; node.dataset.date = x.date; node.setAttribute('aria-hidden', 'true');
    const time = document.createElement('span'); time.className = 'j10-selection-card-time'; time.textContent = `${slotToLabel(x.startSlot)} - ${durationLabel(x.startSlot, x.endSlot)}`;
    const kind = document.createElement('span'); kind.className = 'j10-selection-card-kind'; kind.textContent = 'New';
    const asset = document.createElement('span'); asset.className = 'j10-selection-card-asset'; asset.textContent = x.assetName;
    node.append(time, kind, asset);
    const slotH = slotHeight(col); node.style.top = `${x.startSlot * slotH}px`; node.style.height = `${(x.endSlot - x.startSlot) * slotH}px`; col.appendChild(node); return node;
  }
  function blockNode() {
    const x = state.block; if (!x) return null;
    const col = document.querySelector(`body[data-journey="10"] .cal-day-col[data-asset="${x.asset}"][data-date="${x.date}"]`); if (!col) return null;
    const node = document.createElement('button'); node.type = 'button'; node.className = 'cal-event block j10-block-event'; node.id = 'j10-committed-block'; node.dataset.asset = x.asset; node.dataset.date = x.date; node.setAttribute('aria-label', `Block on ${x.assetName}, ${slotToLabel(x.startSlot)} to ${slotToLabel(x.endSlot)}, ${x.category}${x.marker ? `, ${x.marker}` : ''}`); node.innerHTML = '<strong>Block</strong><span></span>'; node.querySelector('span').textContent = `${x.category}${x.marker ? ` · ${x.marker}` : ''}`; shared().applyTimeslotVisual?.(node, 'block');
    const slotH = slotHeight(col); node.style.top = `${x.startSlot * slotH}px`; node.style.height = `${(x.endSlot - x.startSlot) * slotH}px`; node.addEventListener('click', (e) => openEditor('update', e.currentTarget)); node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEditor('update', e.currentTarget); } }); col.appendChild(node); return node;
  }
  function render() { if (!isJ10()) return; const grid = $('calendar-grid'); if (!grid) return; grid.querySelectorAll('.j10-selection-card, .j10-block-event').forEach((el) => el.remove()); blockNode(); paintSelection(); selectionCardNode(); }
  function closeEditor(restore = true) { const dialog = $('j10-block-dialog'); if (dialog?.open) dialog.close(); $('j10-block-error').textContent = ''; if (restore && state.trigger?.isConnected) state.trigger.focus(); else if (restore) $('j10-add-block')?.focus(); state.trigger = null; state.editorMode = 'create'; }
  function populateEditor(mode, source) { const x = mode === 'update' ? state.block : state.selection; if (!x || (mode === 'create' && (state.block || !rangeEligible(x.asset, x.date, x.startSlot, x.endSlot)))) return false; $('j10-block-title').textContent = mode === 'update' ? 'Edit Block' : 'Add Block'; $('j10-block-save').textContent = mode === 'update' ? 'Save Changes' : 'Save Block'; $('j10-block-delete').hidden = mode !== 'update'; $('j10-block-asset').value = x.assetName; $('j10-block-time').value = `${slotToLabel(x.startSlot)}–${slotToLabel(x.endSlot)}`; $('j10-block-category').value = mode === 'update' ? x.category : ''; $('j10-block-marker').value = mode === 'update' ? (x.marker || '') : ''; $('j10-block-error').textContent = ''; state.editorMode = mode; state.trigger = source || state.trigger || $('j10-add-block'); return true; }
  function openEditor(mode, source) { if (!isJ10() || state.busy || (mode === 'create' && (state.block || !state.selection))) return; if (!populateEditor(mode, source)) { announce('Choose one eligible free interval before adding a Block.'); return; } const dialog = $('j10-block-dialog'); dialog.showModal(); $('j10-block-category').focus(); }
  function openDeleteConfirm() { if (!state.block || state.busy) return; const dialog = $('j10-delete-dialog'); state.confirmTrigger = state.trigger || $('j10-committed-block'); closeEditor(false); dialog.showModal(); $('j10-delete-keep').focus(); }
  function closeDeleteConfirm() { const dialog = $('j10-delete-dialog'); if (dialog?.open) dialog.close(); if (state.confirmTrigger?.isConnected) state.confirmTrigger.focus(); else $('j10-add-block')?.focus(); state.confirmTrigger = null; }
  function chooseSelection(target) { if (state.block) return; const col = target.closest('.cal-day-col'); if (!col) return; const slot = Number(target.dataset.slot); const asset = col.dataset.asset; const date = col.dataset.date; if (!eligibleCell(asset, date, slot)) { state.selection = null; render(); announce('Choose one eligible free interval.'); return; } state.selection = { asset, assetName: col.closest('.cal-lane')?.querySelector('.cal-lane-title')?.textContent?.split(' · ')[0] || asset, date, startSlot: slot, endSlot: slot + 1 }; render(); announce(`Interval selected: ${selectedText(state.selection)}. Add Block is available.`); }
  function onGridPointer(event) { if (!isJ10()) return; const block = event.target.closest('.j10-block-event'); if (block) return; const slot = event.target.closest('.cal-slot.free'); if (!slot) return; event.preventDefault(); event.stopImmediatePropagation(); if (event.type === 'mousedown' && event.button !== 0) return; chooseSelection(slot); }
  function onGridKey(event) { if (!isJ10()) return; const slot = event.target.closest('.cal-slot.free'); if (!slot || !['Enter', ' '].includes(event.key)) return; event.preventDefault(); event.stopImmediatePropagation(); chooseSelection(slot); }
  function setMaintenance() { document.body.dataset.mode = 'maintenance'; document.querySelectorAll('.mode-nav .mode-btn').forEach((btn) => { const maintenance = btn.dataset.mode === 'maintenance'; btn.classList.toggle('is-active', maintenance); btn.setAttribute('aria-pressed', String(maintenance)); }); }
  function installRouteSurface() {
    if (!isJ10()) return;
    document.title = 'Optimo Diary — Journey 10 / UJ-12 bounded Block CRUD'; document.body.dataset.contextualWorkspace = 'true'; setMaintenance();
    setHidden($('j10-route-status'), false); setHidden($('j10-block-dialog'), false); setHidden($('j10-delete-dialog'), false);
    const grid = $('calendar-grid'); grid?.addEventListener('mousedown', onGridPointer, true); grid?.addEventListener('click', onGridPointer, true); grid?.addEventListener('keydown', onGridKey, true);
    ['j10-block-dialog', 'j10-delete-dialog'].forEach((id) => { const dialog = $(id); shared().trapDialogFocus?.(dialog); dialog.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (id === 'j10-block-dialog') closeEditor(); else closeDeleteConfirm(); } }, true); });
    document.addEventListener('click', (event) => { if (!isJ10()) return; const mode = event.target.closest('.mode-nav .mode-btn'); if (mode) { event.preventDefault(); event.stopImmediatePropagation(); setMaintenance(); announce(mode.dataset.mode === 'maintenance' ? 'Maintenance context active for Journey 10.' : 'Booking is outside the Journey 10 bounded maintenance scope.'); return; } const dateControl = event.target.closest('#date-prev, #date-next, #date-today'); if (dateControl) window.setTimeout(render, 0); }, true);
    $('j10-add-block')?.addEventListener('click', (e) => openEditor('create', e.currentTarget)); $('j10-block-close')?.addEventListener('click', () => closeEditor()); $('j10-block-cancel')?.addEventListener('click', () => closeEditor());
    $('j10-block-form')?.addEventListener('submit', (event) => { event.preventDefault(); if (state.busy) return; if (state.editorMode === 'update') { if (!state.block) return; const category = $('j10-block-category').value; if (!category) { $('j10-block-error').textContent = 'Choose a Category before saving the Block.'; $('j10-block-category').focus(); return; } state.busy = true; state.block = { ...state.block, marker: $('j10-block-marker').value.trim(), category }; state.actions.update += 1; closeEditor(false); render(); announce('Block changes saved locally.'); state.busy = false; $('j10-committed-block')?.focus(); return; } if (state.block || !state.selection || !rangeEligible(state.selection.asset, state.selection.date, state.selection.startSlot, state.selection.endSlot)) { $('j10-block-error').textContent = 'Choose one eligible interval; only one local Block is allowed.'; return; } const category = $('j10-block-category').value; if (!category) { $('j10-block-error').textContent = 'Choose a Category before saving the Block.'; $('j10-block-category').focus(); return; } state.busy = true; state.block = { ...state.selection, category, marker: $('j10-block-marker').value.trim() }; state.selection = null; state.actions.create += 1; closeEditor(false); render(); announce('Block created locally.'); state.busy = false; $('j10-committed-block')?.focus(); });
    $('j10-block-delete')?.addEventListener('click', openDeleteConfirm); $('j10-delete-keep')?.addEventListener('click', closeDeleteConfirm);
    $('j10-delete-confirm')?.addEventListener('click', () => { if (state.busy || !state.block) return; const freed = { ...state.block }; state.busy = true; state.actions.delete += 1; state.block = null; state.selection = null; closeDeleteConfirm(); render(); announce('Block deleted locally. Calendar returned to the baseline.'); state.busy = false; if (!k1Focus.move(document.querySelector(`.cal-day-col[data-asset="${freed.asset}"][data-date="${freed.date}"] .cal-slot[data-slot="${freed.startSlot}"]`), '#j10-delete-confirm')) $('j10-add-block')?.focus(); });
    $('j10-block-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); closeEditor(); }); $('j10-delete-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); closeDeleteConfirm(); });
    render();
  }
  window.__j10Review = { state, getSnapshot: () => JSON.parse(JSON.stringify(state)), reset: () => window.location.reload(), select: (asset = 'studio2', date = baseDate, startSlot = 4) => { if (eligibleCell(asset, date, startSlot)) state.selection = { asset, assetName: asset === 'studio2' ? 'Studio 2' : asset, date, startSlot, endSlot: startSlot + 1 }; else state.selection = null; render(); }, metrics: () => ({ ...state.actions }) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(installRouteSurface, 0)); else window.setTimeout(installRouteSurface, 0);
})();


/* ===== Journey 11 isolated candidate — UJ-13 / AC-30 Diary Note CRUD ===== */
(function journey11IsolatedCandidate() {
  'use strict';
  const isJ11 = () => document.body.dataset.journey === '11';
  const $ = (id) => document.getElementById(id);
  const state = { notes: [], activeDate: null, origin: null, editingId: null, deleteId: null, deleteOrigin: null };
  const NOTE_TYPES = ['General', 'Staffing', 'Facility'];
  const dateLabel = (value) => {
    if (!value) return '';
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };
  const activeDateLabel = (value) => new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
  const covers = (note, date) => note.start <= date && date <= note.end;
  const noteForDate = (date) => state.notes.filter((note) => covers(note, date));
  const setHidden = (el, hidden) => {
    if (!el) return;
    el.hidden = hidden;
    el.inert = hidden;
    if (hidden) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
  };
  const announce = (text) => {
    const live = $('ldp-live');
    if (live) live.textContent = text;
    const toast = $('toast-region');
    if (toast) toast.textContent = text;
  };
  function headerForDate(date) { return document.querySelector(`body[data-journey="11"] .cal-day-header[data-date="${date}"]`); }
  function decorateHeaders() {
    if (!isJ11()) return;
    document.querySelectorAll('body[data-journey="11"] .cal-day-header').forEach((header) => {
      const date = header.dataset.date;
      const hasNote = noteForDate(date).length > 0;
      header.tabIndex = 0;
      header.setAttribute('role', 'button');
      header.setAttribute('aria-label', `${dateLabel(date)} — ${hasNote ? 'Diary Note available' : 'Open Diary Notes'}`);
      const oldMarker = header.querySelector('.j11-note-marker');
      if (oldMarker) oldMarker.remove();
      if (hasNote) {
        const marker = document.createElement('span');
        marker.className = 'j11-note-marker';
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = '●';
        header.appendChild(marker);
      }
    });
  }
  function noteCard(note) {
    const card = document.createElement('article');
    card.className = 'j11-note-card';
    card.dataset.noteId = note.id;
    const heading = document.createElement('div');
    heading.className = 'j11-note-card-heading';
    const title = document.createElement('strong');
    title.textContent = note.type;
    heading.appendChild(title);
    if (note.unavailable) {
      const badge = document.createElement('span');
      badge.className = 'j11-unavailable-badge';
      badge.textContent = 'Unavailable for Booking (display only; non-blocking)';
      heading.appendChild(badge);
    }
    const range = document.createElement('span');
    range.className = 'j11-note-range';
    range.textContent = `${dateLabel(note.start)} – ${dateLabel(note.end)}`;
    const text = document.createElement('p');
    text.className = 'j11-note-text';
    text.textContent = note.text || 'No additional information.';
    const actions = document.createElement('div');
    actions.className = 'j11-note-actions';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'btn-secondary btn-sm'; edit.dataset.j11Edit = note.id; edit.textContent = 'Edit';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'btn-danger btn-secondary btn-sm'; remove.dataset.j11Delete = note.id; remove.textContent = 'Delete';
    actions.append(edit, remove);
    card.append(heading, range, text, actions);
    return card;
  }
  function renderList() {
    const list = $('j11-notes-list');
    if (!list) return;
    list.innerHTML = '';
    const notes = noteForDate(state.activeDate);
    if (!notes.length) {
      const empty = document.createElement('p');
      empty.className = 'j11-empty-state';
      empty.textContent = 'No note for this date';
      list.appendChild(empty);
    } else {
      notes.forEach((note) => list.appendChild(noteCard(note)));
    }
    $('j11-note-add').textContent = notes.length ? 'Add another note' : 'Add note';
    setHidden($('j11-notes-list'), false);
    setHidden($('j11-note-form'), true);
    setHidden($('j11-list-actions'), false);
  }
  function syncFormValidity() {
    const type = $('j11-note-type')?.value || '';
    const start = $('j11-note-start')?.value || '';
    const end = $('j11-note-end')?.value || '';
    const error = $('j11-note-error');
    const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
    const invalidDate = (!!start && !validDate(start)) || (!!end && !validDate(end));
    const invalidRange = !invalidDate && !!start && !!end && end < start;
    if (error) error.textContent = invalidDate ? 'Enter valid Start and End dates.' : invalidRange ? 'End date must be on or after Start date.' : '';
    const valid = !!type && validDate(start) && validDate(end) && !invalidRange;
    if ($('j11-note-save')) $('j11-note-save').disabled = !valid;
    return valid;
  }
  function openEditor(note) {
    const form = $('j11-note-form');
    if (!form) return;
    state.editingId = note?.id || null;
    $('j11-note-form-title').textContent = note ? 'Edit note' : 'Add note';
    $('j11-note-type').value = note?.type || '';
    $('j11-note-start').value = note?.start || state.activeDate;
    $('j11-note-end').value = note?.end || state.activeDate;
    $('j11-note-unavailable').checked = !!note?.unavailable;
    $('j11-note-text').value = note?.text || '';
    $('j11-note-error').textContent = '';
    setHidden($('j11-notes-list'), true);
    setHidden($('j11-list-actions'), true);
    setHidden(form, false);
    syncFormValidity();
    $('j11-note-type').focus();
  }
  function restoreOrigin() {
    const origin = state.origin;
    state.origin = null;
    if (origin?.isConnected) origin.focus();
  }
  function closeNotes(restore = true) {
    const dialog = $('j11-notes-dialog');
    if (dialog?.open) dialog.close();
    state.editingId = null;
    if (restore) restoreOrigin();
  }
  function openNotes(trigger) {
    if (!isJ11() || !trigger?.dataset.date) return;
    state.activeDate = trigger.dataset.date;
    state.origin = trigger;
    $('j11-active-date').textContent = `Selected date: ${activeDateLabel(state.activeDate)}`;
    renderList();
    const dialog = $('j11-notes-dialog');
    if (!dialog.open) dialog.showModal();
    $('j11-note-add').focus();
  }
  function openDelete(id, trigger) {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;
    $('j11-delete-description').textContent = `Delete ${note.type} note (${dateLabel(note.start)} – ${dateLabel(note.end)})? This local note will be removed.`;
    state.deleteId = id;
    state.deleteOrigin = trigger;
    const notes = $('j11-notes-dialog');
    if (notes?.open) notes.close();
    const dialog = $('j11-delete-dialog');
    dialog.showModal();
    $('j11-delete-cancel').focus();
  }
  function returnToNotes() {
    const dialog = $('j11-notes-dialog');
    renderList();
    if (!dialog.open) dialog.showModal();
    $('j11-note-add').focus();
  }
  function closeDelete(restoreMenu) {
    const dialog = $('j11-delete-dialog');
    if (dialog?.open) dialog.close();
    state.deleteId = null;
    if (restoreMenu) returnToNotes(); else restoreOrigin();
  }
  function saveNote(event) {
    event.preventDefault();
    if (!syncFormValidity()) return;
    const draft = { type: $('j11-note-type').value, start: $('j11-note-start').value, end: $('j11-note-end').value, unavailable: $('j11-note-unavailable').checked, text: $('j11-note-text').value.trim() };
    if (state.editingId) {
      const existing = state.notes.find((note) => note.id === state.editingId);
      if (existing) Object.assign(existing, draft);
      announce('Diary Note updated locally.');
    } else {
      state.notes.push({ id: `j11-note-${Date.now()}-${state.notes.length}`, ...draft });
      announce('Diary Note added locally.');
    }
    const savedNoteId = state.editingId || state.notes[state.notes.length - 1]?.id;
    decorateHeaders();
    renderList();
    k1Focus.move(Array.from($('j11-notes-list').querySelectorAll('[data-j11-edit]')).find((button) => button.dataset.j11Edit === savedNoteId) || $('j11-note-add'), '#j11-note-form');
  }
  function installRouteSurface() {
    if (!isJ11()) return;
    document.title = 'Optimo Diary — Journey 11 / UJ-13 Diary Notes';
    document.body.dataset.mode = 'maintenance';
    document.querySelectorAll('.mode-nav .mode-btn').forEach((button) => {
      const active = button.dataset.mode === 'maintenance';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    setHidden($('j11-route-status'), false);
    setHidden($('j11-notes-dialog'), false);
    setHidden($('j11-delete-dialog'), false);
    decorateHeaders();
    ['date-prev', 'date-next', 'date-today', 'picker-apply'].forEach((id) => $(id)?.addEventListener('click', () => window.setTimeout(decorateHeaders, 0), true));
    document.addEventListener('click', (event) => {
      if (!isJ11()) return;
      const header = event.target instanceof Element ? event.target.closest('.cal-day-header[data-date]') : null;
      if (header) { event.preventDefault(); event.stopImmediatePropagation(); openNotes(header); return; }
      if (event.target.closest('.mode-nav .mode-btn')) { event.preventDefault(); event.stopImmediatePropagation(); announce('Maintenance context is active for Journey 11.'); return; }
      const edit = event.target.closest('[data-j11-edit]');
      if (edit) { event.preventDefault(); openEditor(state.notes.find((note) => note.id === edit.dataset.j11Edit)); return; }
      const remove = event.target.closest('[data-j11-delete]');
      if (remove) { event.preventDefault(); openDelete(remove.dataset.j11Delete, remove); }
    }, true);
    document.addEventListener('keydown', (event) => {
      if (!isJ11()) return;
      const header = event.target instanceof Element ? event.target.closest('.cal-day-header[data-date]') : null;
      if (header && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) { event.preventDefault(); event.stopImmediatePropagation(); openNotes(header); return; }
      const notes = $('j11-notes-dialog');
      if (notes?.open && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeNotes(); }
      const remove = $('j11-delete-dialog');
      if (remove?.open && event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeDelete(true); }
    }, true);
    $('j11-notes-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); closeNotes(); });
    $('j11-delete-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); closeDelete(true); });
    $('j11-notes-close')?.addEventListener('click', () => closeNotes());
    $('j11-note-cancel')?.addEventListener('click', () => { renderList(); $('j11-note-add').focus(); });
    $('j11-note-add')?.addEventListener('click', () => openEditor());
    $('j11-note-form')?.addEventListener('input', syncFormValidity);
    $('j11-note-form')?.addEventListener('change', syncFormValidity);
    $('j11-note-form')?.addEventListener('submit', saveNote);
    $('j11-delete-cancel')?.addEventListener('click', () => closeDelete(true));
    $('j11-delete-confirm')?.addEventListener('click', () => {
      state.notes = state.notes.filter((note) => note.id !== state.deleteId);
      decorateHeaders();
      announce('Diary Note deleted locally.');
      closeDelete(true);
    });
    renderList();
    window.__j11Review = { state, reset: () => window.location.reload(), snapshot: () => JSON.parse(JSON.stringify(state.notes)), decorateHeaders };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(installRouteSurface, 0)); else window.setTimeout(installRouteSurface, 0);
})();


/* ===== Journey 12 isolated candidate — UJ-14 / Public Event Actions ===== */
(function journey12IsolatedCandidate() {
  'use strict';
  const isJ12 = () => document.body.dataset.journey === '12';
  const $ = (id) => document.getElementById(id);
  const FIXTURE = { title: 'Community Open Day', asset: 'hall1', assetName: 'Hall 1', date: '2026-08-26', startSlot: 4, endSlot: 8, time: '10:00–12:00' };
  const state = { selected: false, panelOpen: false, eventTrigger: null, boundaryKind: null };
  const setHidden = (el, hidden) => {
    if (!el) return;
    el.hidden = hidden;
    el.inert = hidden;
    if (hidden) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
  };
  const announce = (text) => {
    const live = $('ldp-live');
    if (live) live.textContent = text;
    const toast = $('toast-region');
    if (toast) toast.textContent = text;
  };
  const slotHeight = (col) => parseFloat(getComputedStyle(col).getPropertyValue('--slot-h') || '10');
  let paintingFixture = false;
  function paintFixture() {
    if (paintingFixture || !isJ12()) return;
    paintingFixture = true;
    try {
      const col = document.querySelector(`body[data-journey="12"] .cal-day-col[data-asset="${FIXTURE.asset}"][data-date="${FIXTURE.date}"]`);
      let node = document.getElementById('j12-public-event');
      if (!col) {
        node?.remove();
        return;
      }
      if (!node) {
        node = document.createElement('button');
        node.type = 'button';
        node.id = 'j12-public-event';
        node.dataset.j12Event = 'fixture';
        node.innerHTML = `<strong>${FIXTURE.title}</strong><span class="j12-event-meta">${FIXTURE.assetName} · ${FIXTURE.time}</span><span class="j12-event-tag">Public event · local fixture</span>`;
        col.appendChild(node);
      } else if (node.parentElement !== col) {
        col.appendChild(node);
      }
      node.className = 'cal-event j12-public-event' + (state.selected ? ' j12-selected' : '');
      if (state.selected && !state.eventTrigger?.isConnected) state.eventTrigger = node;
      node.setAttribute('aria-pressed', String(state.selected));
      node.setAttribute('aria-label', `${FIXTURE.title} · ${FIXTURE.assetName} · ${FIXTURE.time} · local in-memory review fixture`);
      const h = slotHeight(col);
      node.style.top = `${FIXTURE.startSlot * h}px`;
      node.style.height = `${(FIXTURE.endSlot - FIXTURE.startSlot) * h}px`;
    } finally {
      paintingFixture = false;
    }
  }
  function selectEvent(trigger) {
    state.selected = true;
    state.eventTrigger = trigger || $('j12-public-event');
    paintFixture();
    openPanel();
    announce(`${FIXTURE.title} selected. Event actions are available for local review only.`);
  }
  function openPanel() {
    if (!state.selected) return;
    const panel = $('j12-event-actions-panel');
    setHidden(panel, false);
    state.panelOpen = true;
    $('j12-panel-context').textContent = `${FIXTURE.title} · ${FIXTURE.assetName} · Wed 26 Aug 2026 · ${FIXTURE.time}`;
    $('j12-event-actions-close')?.focus();
  }
  function closePanel(restoreFocus = true) {
    const panel = $('j12-event-actions-panel');
    setHidden(panel, true);
    state.panelOpen = false;
    if (restoreFocus && state.eventTrigger?.isConnected) state.eventTrigger.focus();
  }
  const boundaryCopy = {
    config: 'Configuration and capacity components exist in the legacy trace, but rights, confirmation policy and successful mutation outcomes are UNCONFIRMED. This prototype shows the boundary only — no Save, Update, API, persistence or production destination.',
    maps: 'Venue/table and asset map handoffs exist as EXTERNAL HANDOFF boundaries only. No URL, map key, coordinates, network call, redirect or destination success is available in this review fixture.',
    external: 'Corporate Booking, Open Booking, Booking Manager, Call Center, Edit Layout and Event Setup remain DEFECT-AFFECTED external contracts. No URL, navigation, authentication or destination availability is claimed.'
  };
  function openBoundary(kind) {
    state.boundaryKind = kind;
    const titles = { config: 'Configuration & capacity', maps: 'Venue/table and asset maps', external: 'External applications' };
    $('j12-boundary-title').textContent = titles[kind] || 'Boundary review';
    $('j12-boundary-copy').textContent = boundaryCopy[kind] || '';
    const dialog = $('j12-boundary-dialog');
    dialog.showModal();
    $('j12-boundary-close').focus();
  }
  function closeBoundary() {
    const dialog = $('j12-boundary-dialog');
    if (dialog?.open) dialog.close();
    const restore = state.boundaryKind === 'config' ? $('j12-boundary-config') : state.boundaryKind === 'maps' ? $('j12-boundary-maps') : $('j12-boundary-external');
    state.boundaryKind = null;
    if (restore?.isConnected) restore.focus(); else if (state.panelOpen) $('j12-event-actions-close')?.focus(); else state.eventTrigger?.focus();
  }
  function startReschedule() {
    const root = window.__j6PublicRescheduleRoot;
    const trigger = $('j12-reschedule-event');
    if (!root?.startOperation || root.rootFunction !== 'j6StartOperation') {
      announce('Journey 6 public-reschedule root is unavailable. No duplicate flow was started.');
      return;
    }
    root.startOperation('PublicReschedule', trigger);
  }
  function hookCalendar() {
    const grid = $('calendar-grid');
    if (!grid || grid.dataset.j12Hooked === 'true') return;
    grid.dataset.j12Hooked = 'true';
    const observer = new MutationObserver(() => {
      if (!document.getElementById('j12-public-event')) window.requestAnimationFrame(paintFixture);
    });
    observer.observe(grid, { childList: true, subtree: true });
    ['date-prev', 'date-next', 'date-today', 'picker-apply'].forEach((id) => $(id)?.addEventListener('click', () => window.setTimeout(paintFixture, 0), true));
    paintFixture();
  }
  function installRouteSurface() {
    if (!isJ12()) return;
    document.title = 'Optimo Diary — Journey 12 / UJ-14 Public Event Actions';
    document.body.dataset.j12PublicEvents = 'true';
    document.querySelectorAll('.mode-nav .mode-btn').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
    setHidden($('j12-route-status'), false);
    setHidden($('j12-event-actions-panel'), true);
    setHidden($('j12-boundary-dialog'), false);
    hookCalendar();
    document.addEventListener('click', (event) => {
      if (!isJ12()) return;
      const eventBtn = event.target.closest('#j12-public-event, .j12-public-event');
      if (eventBtn) { event.preventDefault(); event.stopImmediatePropagation(); selectEvent(eventBtn); return; }
      if (event.target.closest('.mode-nav .mode-btn')) { event.preventDefault(); event.stopImmediatePropagation(); announce('Public Events review context is active for Journey 12. No API, persistence or external navigation.'); return; }
      if (event.target.closest('#j12-event-actions-close')) { event.preventDefault(); closePanel(); return; }
      if (event.target.closest('#j12-reschedule-event')) { event.preventDefault(); startReschedule(); return; }
      if (event.target.closest('#j12-boundary-config')) { event.preventDefault(); openBoundary('config'); return; }
      if (event.target.closest('#j12-boundary-maps')) { event.preventDefault(); openBoundary('maps'); return; }
      if (event.target.closest('#j12-boundary-external')) { event.preventDefault(); openBoundary('external'); return; }
      if (event.target.closest('#j12-boundary-close')) { event.preventDefault(); closeBoundary(); }
    }, true);
    document.addEventListener('keydown', (event) => {
      if (!isJ12()) return;
      const eventBtn = event.target.closest('#j12-public-event, .j12-public-event');
      if (eventBtn && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar')) { event.preventDefault(); event.stopImmediatePropagation(); selectEvent(eventBtn); return; }
      if (event.key !== 'Escape') return;
      const boundary = $('j12-boundary-dialog');
      if (boundary?.open) { event.preventDefault(); event.stopImmediatePropagation(); closeBoundary(); return; }
      if ($('j5-workflow-dialog')?.open) return;
      const panel = $('j12-event-actions-panel');
      if (panel && !panel.hidden) { event.preventDefault(); event.stopImmediatePropagation(); closePanel(); }
    }, true);
    $('j12-boundary-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); closeBoundary(); });
    const reopenPanelAfterWorkflow = () => {
      if (!state.selected) return;
      setHidden($('j12-event-actions-panel'), false);
      state.panelOpen = true;
    };
    $('#j5-workflow-dialog')?.addEventListener('close', () => {
      if (!isJ12() || !state.selected) return;
      window.setTimeout(() => {
        reopenPanelAfterWorkflow();
        $('j12-reschedule-event')?.focus({ preventScroll: true });
      }, 60);
    });
    window.__j12Review = Object.freeze({ fixture: FIXTURE, state, rescheduleRoot: () => window.__j6PublicRescheduleRoot, reopenPanelAfterWorkflow });
    // Intentional initial focus: the directly opened Event actions panel begins at its Close control.
    if (location.hash !== '#agenda') selectEvent($('j12-public-event'));
  }
  document.addEventListener('j12:calendar-rendered', paintFixture);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(installRouteSurface, 0)); else window.setTimeout(installRouteSurface, 0);
})();

/* ===== Journey 13 isolated candidate — Configuration & Capacity Preview ===== */
(function journey13IsolatedCandidate() {
  'use strict';
  const isJ13 = () => document.body.dataset.journey === '13';
  const root = () => document.getElementById('j13-standalone-surface');
  const $ = (sel) => root()?.querySelector(sel);
  const $$ = (sel) => [...(root()?.querySelectorAll(sel) || [])];
  const initial = { config: 'Theatre', facilities: ['Hall 1'], caps: { 'Hall 1': 180 } };
  const state = structuredClone(initial);
  const applied = structuredClone(initial);
  const max = { 'Hall 1': 240, 'Conference Suite': 80, 'Studio 2': 60 };
  const defaults = { 'Hall 1': 180, 'Conference Suite': 40, 'Studio 2': 60 };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  function compatible(name) { return !(name === 'Studio 2' && state.config !== 'Cabaret'); }
  function ensureCaps() { state.facilities.forEach((name) => { if (state.caps[name] == null) state.caps[name] = defaults[name]; }); }
  function changed() { return JSON.stringify(state) !== JSON.stringify(applied); }
  function rebuildCaps() {
    ensureCaps();
    const host = $('#capacities');
    if (!host) return;
    host.innerHTML = '';
    state.facilities.forEach((name) => {
      const card = document.createElement('article');
      card.className = 'capacity-card';
      card.dataset.card = name;
      card.innerHTML = `<div class="capacity-top"><strong>${name}</strong><span class="max">max. ${max[name]}</span></div><div class="counter"><button type="button" aria-label="Decrease ${name} capacity" data-delta="-10">−</button><output aria-live="polite">${state.caps[name]}</output><button type="button" aria-label="Increase ${name} capacity" data-delta="10">+</button></div>`;
      host.append(card);
    });
    if (!state.facilities.length) host.innerHTML = '<div class="help">Select at least one compatible facility to set capacity.</div>';
  }
  function render() {
    if (!isJ13()) return;
    $$('.config').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.config === state.config)));
    $$('[data-facility]').forEach((input) => {
      const name = input.dataset.facility;
      const ok = compatible(name);
      input.disabled = !ok;
      input.checked = ok && state.facilities.includes(name);
      input.closest('.facility').classList.toggle('selected', input.checked);
      input.closest('.facility').classList.toggle('unavailable', !ok);
    });
    const reason = $('#studio-reason');
    if (reason) reason.textContent = compatible('Studio 2') ? 'Supported' : 'Only Cabaret supported';
    rebuildCaps();
    const sc = $('#summary-config'); if (sc) sc.textContent = state.config;
    const sf = $('#summary-facilities'); if (sf) sf.textContent = state.facilities.join(', ') || 'None';
    const count = (state.config !== applied.config ? 1 : 0)
      + state.facilities.filter((n) => !applied.facilities.includes(n)).length
      + applied.facilities.filter((n) => !state.facilities.includes(n)).length
      + state.facilities.filter((n) => (state.caps[n] ?? 0) !== (applied.caps[n] ?? defaults[n])).length;
    const scount = $('#summary-count'); if (scount) scount.textContent = String(count);
    const review = $('#review'); if (review) review.disabled = !changed() || !state.facilities.length;
    const reset = $('#reset'); if (reset) reset.disabled = JSON.stringify(state) === JSON.stringify(initial);
  }
  const targetElement = (e) => (e.target instanceof Element ? e.target : e.target?.parentElement);
  function installRouteSurface() {
    if (!isJ13()) return;
    document.title = 'Journey 13 — Configuration & capacity preview';
    const surface = root();
    if (surface) { surface.hidden = false; surface.inert = false; surface.removeAttribute('aria-hidden'); }
    $('#configs')?.addEventListener('click', (e) => {
      const b = targetElement(e)?.closest('.config');
      if (!b) return;
      state.config = b.dataset.config;
      state.facilities = state.facilities.filter(compatible);
      render();
    });
    $$('.config').forEach((btn) => {
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); btn.click(); }
      });
    });
    $('.facility-list')?.addEventListener('change', (e) => {
      const input = targetElement(e)?.closest('[data-facility]');
      if (!input) return;
      const n = input.dataset.facility;
      if (input.checked && !state.facilities.includes(n)) state.facilities.push(n);
      if (!input.checked) state.facilities = state.facilities.filter((x) => x !== n);
      render();
    });
    $('#capacities')?.addEventListener('click', (e) => {
      const b = targetElement(e)?.closest('[data-delta]');
      if (!b) return;
      const n = b.closest('[data-card]').dataset.card;
      state.caps[n] = Math.max(0, Math.min(max[n], state.caps[n] + Number(b.dataset.delta)));
      render();
    });
    $('#reset')?.addEventListener('click', () => { Object.assign(state, clone(initial)); render(); $('#configs .config')?.focus(); });
    const modal = $('#modal');
    const cancel = $('#cancel');
    const shell = $('.shell');
    $('#review')?.addEventListener('click', () => {
      const list = $('#change-list');
      if (!list) return;
      list.innerHTML = '';
      const rows = [];
      if (state.config !== applied.config) rows.push(['Configuration', applied.config, state.config]);
      state.facilities.forEach((n) => {
        const before = applied.facilities.includes(n) ? `${applied.caps[n]} people` : 'Not selected';
        const after = `${state.caps[n]} people`;
        if (before !== after) rows.push([n, before, after]);
      });
      applied.facilities.filter((n) => !state.facilities.includes(n)).forEach((n) => rows.push([n, `${applied.caps[n]} people`, 'Not selected']));
      rows.forEach(([label, before, after]) => {
        const d = document.createElement('div');
        d.className = 'change';
        d.innerHTML = `<div><strong>${label}</strong><span>${before} → ${after}</span></div><span class="arrow">PREVIEW</span>`;
        list.append(d);
      });
      if (shell) shell.inert = true;
      modal?.classList.add('open');
      cancel?.focus();
    });
    function close() {
      modal?.classList.remove('open');
      if (shell) shell.inert = false;
      $('#review')?.focus();
    }
    if (cancel) cancel.onclick = close;
    modal?.addEventListener('click', (e) => { if (e.target === modal) close(); });
    $('#apply')?.addEventListener('click', () => {
      Object.assign(applied, clone(state));
      close();
      render();
      const t = $('#toast');
      t?.classList.add('show');
      window.setTimeout(() => t?.classList.remove('show'), 2600);
      k1Focus.move($(`.config[data-config="${state.config}"]`), '#apply');
    });
    document.addEventListener('keydown', (e) => {
      if (!isJ13() || e.key !== 'Escape' || !modal?.classList.contains('open')) return;
      close();
    });
    window.__j13Review = Object.freeze({ initial, state, applied, render, reset: () => window.location.reload() });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(installRouteSurface, 0));
  else window.setTimeout(installRouteSurface, 0);
})();

/* ===== Journey 14 in-Diary module ===== */
(function journey14InDiary() {
  'use strict';
  const isJ14 = () => document.body.dataset.journey === '14';
  const root = () => document.getElementById('j14-standalone-surface');
  const byId = (id) => root()?.querySelector('#' + id);
  let installed = false;

  function guardSideEffects() {
    var blocked = function(name) {
            return function() {
              console.warn("[J14 review] Blocked:", name);
              return null;
            };
          };
          window.open = blocked("window.open");
          if (window.fetch) window.fetch = blocked("fetch");
          try {
            var XHR = window.XMLHttpRequest;
            window.XMLHttpRequest = function() {
              throw new Error("Network disabled in Journey 14 planning preview");
            };
            window.XMLHttpRequest.UNSENT = XHR.UNSENT;
          } catch (e) { /* noop */ }
  }

  function installRouteSurface() {
    if (installed) return;
    installed = true;
    const surface = root();
    if (surface) {
      surface.hidden = false;
      surface.inert = false;
      surface.removeAttribute('aria-hidden');
    }
    guardSideEffects();
    var tabs = ["tab-seating", "tab-venue", "tab-external"];
        var panels = ["panel-seating", "panel-venue", "panel-external"];
        var live = byId("live-region");
        var lastFocus = null;

        function announce(msg) {
          live.textContent = "";
          requestAnimationFrame(function() { live.textContent = msg; });
        }

        function activateTab(index) {
          tabs.forEach(function(id, i) {
            var tab = byId(id);
            var panel = byId(panels[i]);
            var selected = i === index;
            tab.setAttribute("aria-selected", selected ? "true" : "false");
            tab.tabIndex = selected ? 0 : -1;
            if (selected) {
              panel.hidden = false;
              panel.focus();
            } else {
              panel.hidden = true;
            }
          });
          announce(byId(tabs[index]).textContent + " section active");
        }

        byId("handoff-tabs").addEventListener("click", function(e) {
          var tab = e.target.closest('[role="tab"]');
          if (!tab) return;
          var idx = tabs.indexOf(tab.id);
          if (idx >= 0) activateTab(idx);
        });

        byId("handoff-tabs").addEventListener("keydown", function(e) {
          var tab = e.target.closest('[role="tab"]');
          if (!tab) return;
          var idx = tabs.indexOf(tab.id);
          if (e.key === "ArrowRight") { e.preventDefault(); activateTab((idx + 1) % tabs.length); byId(tabs[(idx + 1) % tabs.length]).focus(); }
          if (e.key === "ArrowLeft") { e.preventDefault(); activateTab((idx + tabs.length - 1) % tabs.length); byId(tabs[(idx + tabs.length - 1) % tabs.length]).focus(); }
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateTab(idx); }
        });

        root()?.querySelectorAll(".seat-block").forEach(function(el) {
          function selectSeat() {
            root()?.querySelectorAll(".seat-block").forEach(function(s) {
              s.classList.remove("is-selected");
              s.setAttribute("aria-pressed", "false");
            });
            el.classList.add("is-selected");
            el.setAttribute("aria-pressed", "true");
            announce("Seat block " + el.getAttribute("data-seat") + " selected for review");
          }
          el.addEventListener("click", selectSeat);
          el.addEventListener("keydown", function(e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSeat(); }
          });
        });

        var mapPlaceholders = {
          available: { title: "Neutral local map placeholder", body: "Riverside Pavilion · schematic grid only · no API key", pill: "Map placeholder · Available", cls: "status-available" },
          loading: { title: "Loading map presentation", body: "Simulated loading state from asset description pattern", pill: "Map placeholder · Loading", cls: "status-loading" },
          unavailable: { title: "No location available", body: "Degraded state — venue fallback also missing in this fixture", pill: "Map placeholder · No location", cls: "status-unavailable" }
        };

        root()?.querySelectorAll('input[name="map-state"]').forEach(function(radio) {
          radio.addEventListener("change", function() {
            var state = radio.value;
            var surf = root(); if (surf) surf.setAttribute("data-map-state", state);
            var cfg = mapPlaceholders[state];
            byId("map-placeholder").setAttribute("data-state", state);
            byId("map-placeholder-title").textContent = cfg.title;
            byId("map-placeholder-body").textContent = cfg.body;
            var pill = byId("map-status-pill");
            pill.className = "status-pill " + cfg.cls;
            pill.textContent = cfg.pill;
            announce(cfg.pill);
          });
        });

        var dialog = byId("handoff-dialog");
        var dialogPanel = byId("handoff-dialog-panel");
        var paramTemplates = {
          "Review seating-map handoff": [
            ["primaryEventId", "evt-summer-2026-fixture"],
            ["sessionId", "ses-evening-1900-fixture"],
            ["packageId", "pkg-standard-seated-fixture"],
            ["route pattern", "seating-view/{eventId} with session and package query placeholders"],
            ["handoff mode", "OPEN — DEC-INT-001"]
          ],
          "Corporate Booking": [["booking token", "@BookingId@ (placeholder)"], ["expand flag", "?expand=true (label only)"], ["target", "new tab — unverified"]],
          "Call Center": [["booking reference", "@BookingRef@ (placeholder)"], ["target behaviour", "legacy _black typo noted in evidence"]],
          "Maintain Table Plan": [["entitlement", "rights/settings gated — not public seating map"], ["action", "Edit Layout external handoff"]],
          "Event Setup": [["context", "booking / event identifiers (fixture)"], ["route", "named in inventory — URL not shown"]],
          "Booking Manager": [["observed defect", "missing directory in evidence"], ["status", "Unavailable in evidence"]]
        };

        function openDialog(triggerEl, destinationKey) {
          lastFocus = triggerEl;
          byId("j14-dialog-destination").textContent = destinationKey;
          var list = byId("j14-dialog-params");
          list.innerHTML = "";
          var rows = paramTemplates[destinationKey] || [["context", "Review fixture"]];
          rows.forEach(function(pair) {
            var li = document.createElement("li");
            li.innerHTML = "<span>" + pair[0] + "</span><span>" + pair[1] + "</span>";
            list.appendChild(li);
          });
          dialog.hidden = false;
          var sh = root()?.querySelector(".shell"); if (sh) sh.inert = true;
          var rl = root()?.querySelector(".review-rail"); if (rl) rl.inert = true;
          var sk = root()?.querySelector(".skip-link"); if (sk) sk.inert = true;
          byId("j14-dialog-back").focus();
          announce("Handoff review sheet opened for " + destinationKey);
        }

        function closeDialog(returnFocus) {
          dialog.hidden = true;
          var sh2 = root()?.querySelector(".shell"); if (sh2) sh2.inert = false;
          var rl2 = root()?.querySelector(".review-rail"); if (rl2) rl2.inert = false;
          var sk2 = root()?.querySelector(".skip-link"); if (sk2) sk2.inert = false;
          if (returnFocus !== false && lastFocus) lastFocus.focus();
          announce("Handoff review sheet closed");
        }

        byId("btn-review-seating").addEventListener("click", function(e) {
          openDialog(e.currentTarget, "Review seating-map handoff");
        });
        root()?.querySelectorAll(".btn-review-handoff").forEach(function(btn) {
          btn.addEventListener("click", function(e) {
            openDialog(e.currentTarget, btn.getAttribute("data-destination"));
          });
        });
        byId("j14-dialog-close").addEventListener("click", function() { closeDialog(true); });
        byId("j14-dialog-back").addEventListener("click", function() { closeDialog(true); });
        byId("j14-dialog-ack").addEventListener("click", function() {
          announce("Preview acknowledged locally — no navigation");
          closeDialog(true);
        });
        document.addEventListener("keydown", function(e) {
          if (dialog.hidden) return;
          if (e.key === "Escape") {
            e.preventDefault();
            closeDialog(true);
            return;
          }
          if (e.key === "Tab") {
            var focusable = Array.from(dialogPanel.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'));
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        });

        var failurePanel = byId("failure-panel");
        var externalList = byId("external-list");
        byId("btn-demo-failure").addEventListener("click", function() {
          activateTab(2);
          failurePanel.hidden = false;
          var surfF = root(); if (surfF) surfF.setAttribute("data-failure-visible", "true");
          externalList.setAttribute("aria-hidden", "true");
          externalList.inert = true;
          byId("failure-title").focus();
          announce("Destination unavailable demonstration");
        });
        byId("btn-return-handoffs").addEventListener("click", function() {
          failurePanel.hidden = true;
          var surfR = root(); if (surfR) surfR.setAttribute("data-failure-visible", "false");
          externalList.removeAttribute("aria-hidden");
          externalList.inert = false;
          byId("btn-demo-failure").focus();
          announce("Returned to external handoff list");
        });
    window.__j14Review = Object.freeze({ reset: () => window.location.reload() });
  }

  window.__j14Install = installRouteSurface;
})();

/* IN-DIARY ONLY — Journey 14 inside the main Diary. Review artifact, not Product.
   Flow: public event in the calendar -> existing Event actions panel -> new "Location & handoffs" card
   -> Journey 14 opens in the same Diary side-panel slot (calendar stays in view on desktop)
   -> "Event actions" / Esc goes back one step; × returns to the calendar through the existing Journey 12 close. */
(function journey14InDiaryIntegrationInDiary() {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const isJ12 = () => document.body.dataset.journey === '12';
  const state = { ready: false, open: false, trigger: null, tries: 0 };

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = hidden;
    el.inert = hidden;
    if (hidden) el.setAttribute('aria-hidden', 'true'); else el.removeAttribute('aria-hidden');
  }
  function announce(text) {
    // Same pattern as the Journey 12 panel: screen-reader live region plus the visible Diary toast.
    const live = $('ldp-live');
    if (live) live.textContent = text;
    const toast = $('toast-region');
    if (toast) toast.textContent = text;
  }




  function contextText() {
    const event = ($('j12-panel-context') && $('j12-panel-context').textContent.trim()) || 'Community Open Day · Hall 1 · Wed 26 Aug 2026 · 10:00–12:00';
    const week = $('date-range-label') && $('date-range-label').textContent.trim();
    return week ? event + ' · Diary week ' + week : event;
  }

  function openJ14(trigger) {
    if (!state.ready) return;
    state.trigger = trigger || $('j14-open-location-handoffs');
    if (typeof window.__j14Install === 'function') window.__j14Install();
    $('j14-diary-context').textContent = contextText();
    setHidden($('j12-event-actions-panel'), true);
    setHidden($('j14-diary-panel'), false);
    if ($('j14-open-location-handoffs')) $('j14-open-location-handoffs').setAttribute('aria-expanded', 'true');
    state.open = true;
    document.body.dataset.j14InDiary = 'open';
    $('j14-diary-back').focus();
    announce('Location and handoffs opened inside the Diary for Community Open Day. The calendar is unchanged.');
  }
  function hideJ14Panel() {
    setHidden($('j14-diary-panel'), true);
    if ($('j14-open-location-handoffs')) $('j14-open-location-handoffs').setAttribute('aria-expanded', 'false');
    state.open = false;
    delete document.body.dataset.j14InDiary;
  }
  function backToEventActions() {
    hideJ14Panel();
    setHidden($('j12-event-actions-panel'), false);
    const target = state.trigger && state.trigger.isConnected ? state.trigger : $('j14-open-location-handoffs');
    if (target) target.focus();
    announce('Back to Event actions. Community Open Day is still selected.');
  }
  function closeToCalendar() {
    hideJ14Panel();
    setHidden($('j12-event-actions-panel'), false);
    // Existing Journey 12 close: hides Event actions and returns focus to the selected event.
    if ($('j12-event-actions-close')) $('j12-event-actions-close').click();
    announce('Closed. Back on the calendar with Community Open Day still selected.');
  }

  function watchHandoffSheet() {
    const sheet = $('handoff-dialog');
    if (!sheet) return;
    const outside = ['j14-diary-panel-head', 'app-shell', 'review-rail', 'inDiary-guide'];
    new MutationObserver(() => {
      const open = !sheet.hidden;
      outside.forEach((id) => { const el = $(id); if (el) el.inert = open; });
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  }

  window.addEventListener('click', (event) => {
    if (!isJ12() || !state.ready) return;
    const t = event.target;
    const opener = t.closest('#j14-open-location-handoffs');
    if (opener) { event.preventDefault(); openJ14(opener); return; }
    if (t.closest('#j14-diary-back')) { event.preventDefault(); backToEventActions(); return; }
    if (t.closest('#j14-diary-close')) { event.preventDefault(); closeToCalendar(); return; }
    // Selecting the event again while Journey 14 is open: step back so Journey 12 reopens Event actions as before.
    if (state.open && t.closest('#j12-public-event, .j12-public-event')) hideJ14Panel();
  }, true);

  window.addEventListener('keydown', (event) => {
    if (!state.open || event.key !== 'Escape') return;
    const sheet = $('handoff-dialog');
    if (sheet && !sheet.hidden) return; // Journey 14's own handoff sheet handles Escape first (accepted behaviour)
    event.preventDefault();
    event.stopImmediatePropagation();
    backToEventActions();
  }, true);

  function init() {
    if (!isJ12()) return;
    if (!window.__j12Review) {
      state.tries += 1;
      if (state.tries < 80) window.setTimeout(init, 50);
      return;
    }
    watchHandoffSheet();
    state.ready = true;
    document.body.dataset.j14InDiary = 'ready';
    window.__j14InDiaryInDiary = Object.freeze({ open: openJ14, back: backToEventActions, close: closeToCalendar, state });
    if (window.location.hash === '#location-handoffs') openJ14($('j14-open-location-handoffs'));
    if (document.body.dataset.j14Entry === 'open') {
      openJ14($('j14-open-location-handoffs'));
      document.title = 'Optimo Diary — Journey 14 Location & handoffs';
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(init, 60));
  else window.setTimeout(init, 60);
})();

/* MOCKUP ONLY — Journey 15 v2 (UJ-15): Agenda as a first-class Diary view, booked-only filter,
   Excel export preview and Custom view, inside the Diary. Review artifact for planning approval;
   not Product. No storage, no network, no file is created, no new business functionality. */
(function journey15Candidate() {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const state = { view: 'week', bookedOnly: false, agendaState: 'populated', custom: null, trigger: null, tries: 0, ready: false };
  const WEEK_LABEL = '24–30 Aug 2026';
  const VENUE = 'Northside Leisure Centre';
  // Review fixture: exactly the events the Diary week grid shows on this route (Hall 1 and Studio 2 selected).

  const EXPORT_COLUMNS = ['Start Date', 'End Date', 'Event Name', 'Assets', 'Number of Bookings', 'Bookings', 'Customer Name',
    'Contact Name (Organisation only)', 'Contact Number', 'Guest Count', 'Host Name', 'Host Contact Number', 'Name of the Guest(s)'];
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function j15AgendaRows() {
    const data = window.__j15DiaryData;
    const assets = data?.assets || [];
    const assetName = (id) => (assets.find((a) => a.id === id) || {}).name || id;
    const rows = [];
    const pub = window.__j12Review?.fixture;
    if (pub) {
      const [start, end] = String(pub.time || '10:00–12:00').split('–');
      const d = new Date(pub.date + 'T12:00:00');
      rows.push({
        date: pub.date, dow: DAY_NAMES[d.getDay()].slice(0, 3), day: d.getDate(), start: start.trim(), end: end.trim(),
        title: pub.title, kind: 'public', status: 'Public event', category: 'Public event',
        asset: pub.assetName || assetName(pub.asset), bookingId: null
      });
    }
    (data?.events || []).filter((e) => e.type === 'quotation' || e.type === 'confirmed').forEach((ev) => {
      const d = new Date(ev.date + 'T12:00:00');
      rows.push({
        date: ev.date, dow: DAY_NAMES[d.getDay()].slice(0, 3), day: d.getDate(), start: data.hourLabel(ev.start), end: data.hourLabel(ev.end),
        title: ev.title, kind: ev.type === 'quotation' ? 'quotation' : 'confirmed',
        status: ev.type === 'quotation' ? 'Quotation' : 'Confirmed', category: 'Private booking',
        asset: assetName(ev.asset), bookingId: ev.id
      });
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }
  function j15NonEvents() {
    const data = window.__j15DiaryData;
    return (data?.events || []).filter((e) => e.type === 'facility-not-in-use').map((e) => ({
      date: e.date, start: data.hourLabel(e.start), end: data.hourLabel(e.end),
      title: 'Facility not in use', kind: 'unavailable',
      asset: (data.assets.find((a) => a.id === e.asset) || {}).name || e.asset
    }));
  }

  function announce(text) {
    const live = $('#ldp-live');
    if (live) live.textContent = text;
    const toast = $('#toast-region');
    if (toast) toast.textContent = text;
  }
  function rangeLabel() { return ($('#date-range-label') && $('#date-range-label').textContent.trim()) || WEEK_LABEL; }
  function visibleRows() {
    if (state.agendaState !== 'populated' || rangeLabel() !== WEEK_LABEL) return [];
    const base = j15AgendaRows(); return state.bookedOnly ? base.filter((r) => r.bookingId) : base;
  }

  /* ---------- panels and view switching ---------- */
  function closePanels() {
    const j14 = $('#j14-diary-panel');
    if (j14 && !j14.hidden && $('#j14-diary-close')) $('#j14-diary-close').click();
    const j12 = $('#j12-event-actions-panel');
    if (j12 && !j12.hidden && $('#j12-event-actions-close')) $('#j12-event-actions-close').click();
  }
  function markButtons() {
    $$('.view-switch .view-btn[data-view]').forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function setView(view) {
    state.view = view;
    if (view === 'week') delete document.body.dataset.j15View;
    else {
      document.body.dataset.j15View = view;
      ensureBuilt();
      document.title = 'Optimo Diary — Journey 15 Agenda, Custom view and Excel export candidate';
    }
    markButtons();
    render();
    if (view !== 'week') {
      const t = $('#j15-title');
      if (t) t.focus();
    }
  }

  /* ---------- Agenda ---------- */
  function rowCells(r, i, group) {
    const dateCell = i === 0
      ? `<td class="j15-c-date" rowspan="${group.rows.length}"><span class="j15-dow">${r.dow}</span><span class="j15-day">${r.day}</span></td>`
      : '';
    const booking = r.kind === 'public'
      ? `<span class="j15-sub">Bookings and guests open from the row's Details.</span>`
      : `<b>${esc(r.bookingId)}</b><span class="j15-sub">Client details are not in this review fixture.</span>`;
    const details = r.kind === 'public'
      ? '<button type="button" class="j15-details-btn" data-j15-details aria-expanded="false">Details</button>' +
        '<div class="j15-details" hidden><div class="j15-mini-actions"><button type="button" class="j15-btn" disabled>Bookings</button><button type="button" class="j15-btn" disabled>Guest List</button></div>' +
        '<div class="j15-why">Bookings opens a dialog that is defect-affected today (UJ-06). Guest List is an external handoff (UJ-14).</div></div>'
      : '<button type="button" class="j15-details-btn" data-j15-details aria-expanded="false">Details</button>' +
        '<div class="j15-details" hidden><div class="j15-why">The Corporate Booking link is an external handoff and is not opened in this review (UJ-14).</div></div>';
    return `${dateCell}` +
      `<td class="j15-c-time"><b>${r.start}</b><span> – ${r.end}</span></td>` +
      `<td class="j15-c-event"><div class="j15-title-line">${esc(r.title)}</div><div class="j15-cat">${esc(r.category)}</div></td>` +
      `<td class="j15-c-status"><span class="st-${r.kind}">${esc(r.status)}</span></td>` +
      `<td class="j15-c-asset">${esc(r.asset)}<span class="j15-venue">${VENUE}</span></td>` +
      `<td class="j15-c-booking">${booking}${details}</td>`;
  }
  function agendaBody() {
    if (state.agendaState === 'loading') return '<tr class="j15-state-row"><td colspan="6"><div class="j15-state"><span class="j15-spinner" role="progressbar" aria-label="Loading"></span></div></td></tr>';
    if (state.agendaState === 'no-search') return '<tr class="j15-state-row"><td colspan="6"><div class="j15-state">Click on the \'Show Search\' option to make a venue selection</div></td></tr>';
    const rows = visibleRows();
    if (!rows.length) return '<tr class="j15-state-row"><td colspan="6"><div class="j15-state">No Records Found</div></td></tr>';
    const groups = [];
    rows.forEach((r) => {
      const g = groups.find((x) => x.date === r.date);
      if (g) g.rows.push(r); else groups.push({ date: r.date, rows: [r] });
    });
    return groups.map((g) => g.rows.map((r, i) => `<tr class="j15-kind-${r.kind}">${rowCells(r, i, g)}</tr>`).join('')).join('');
  }
  function renderAgenda(host) {
    const rows = visibleRows();
    const exportDisabled = rows.length === 0 ? 'disabled title="Nothing to export (proposed behaviour)"' : '';
    host.innerHTML =
      '<div class="j15-head"><h2 id="j15-title" tabindex="-1">Agenda</h2>' +
      `<span class="j15-context">${esc(rangeLabel())} · from Week view · ${VENUE}</span>` +
      `<span class="j15-count" id="j15-count" role="status">${rows.length} event${rows.length === 1 ? '' : 's'}</span></div>` +
      '<p class="j15-note-line">Evidence: partially confirmed · Review fixture — local data only, no API call · Export shows a preview, no file is created.</p>' +
      `<div class="j15-toolbar"><label class="j15-toggle"><input type="checkbox" id="j15-booked-only" ${state.bookedOnly ? 'checked' : ''}> Show booked events only</label>` +
      `<button type="button" class="j15-btn" id="j15-export" ${exportDisabled}><span aria-hidden="true">⤓</span> Export</button></div>` +
      '<div class="j15-list-wrap"><table class="j15-list"><thead><tr>' +
      '<th scope="col">Date</th><th scope="col">Time</th><th scope="col">Event</th><th scope="col">Status</th><th scope="col">Assets</th><th scope="col">Booking/Customers</th>' +
      `</tr></thead><tbody>${agendaBody()}</tbody></table></div>`;
  }

  /* ---------- Export preview ---------- */
  function exportRows() {
    return visibleRows().map((r) => ({
      'Start Date': `${r.date.replace(/-/g, '/')} ${r.start}`, 'End Date': `${r.date.replace(/-/g, '/')} ${r.end}`, 'Event Name': r.title,
      'Assets': `${r.start} - ${r.end}  ${r.asset} (Facility)`, 'Number of Bookings': r.kind === 'public' ? '— (not in fixture)' : 'N/A',
      'Bookings': r.bookingId || '—'
    }));
  }
  function openExport() {
    const btn = $('#j15-export');
    if (!btn || btn.disabled) return;
    state.trigger = btn;
    btn.disabled = true;
    btn.textContent = 'Preparing…';
    announce('Preparing export preview.');
    window.setTimeout(() => {
      const rows = exportRows();
      const head = EXPORT_COLUMNS.map((c) => `<th scope="col">${esc(c)}</th>`).join('');
      const body = rows.map((r) => '<tr>' + EXPORT_COLUMNS.map((c) => `<td data-col="${esc(c)}">${esc(r[c] || '—')}</td>`).join('') + '</tr>').join('');
      $('#j15-export-body').innerHTML =
        `<p class="j15-meta-line"><b>AgendaDetails_export_<i>YYYYMMDDHHmmss</i>.xlsx</b> <span class="muted">· sheet AgendaDetails · ${rows.length} row${rows.length === 1 ? '' : 's'} ${state.bookedOnly ? '(booked events only)' : '(all events shown)'} · rows currently shown in the Agenda</span></p>` +
        '<p class="j15-coltitle">Columns (13) <span class="muted">— code-defined · downloaded file not verified</span></p>' +
        `<p class="j15-cols-line">${EXPORT_COLUMNS.map((c) => esc(c)).join(' · ')}</p>` +
        `<div class="j15-preview-wrap"><table class="j15-preview-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
        '<div class="j15-proposed"><h3>Proposed export behaviour — needs your decision (DEC-J15-03)</h3><ul>' +
        '<li>Disable Export while the file is being prepared, so it cannot run twice.</li>' +
        '<li>Confirm when the file is ready (“Agenda exported: N rows”).</li>' +
        '<li>When there is nothing to export, disable Export and say so.</li>' +
        '<li>If the export fails, show an error message (the current system only writes to the browser console).</li></ul></div>' +
        '<p class="j15-fixture-note">Values marked “—” are not in the review fixture. The current system defines this file name, sheet and columns in code, but the downloaded file has not been verified (AGENDA-EXPORT-01 is open). No file is created in this review.</p>';
      openDialog('#j15-export-dialog');
      btn.disabled = false;
      btn.innerHTML = '<span aria-hidden="true">⤓</span> Export';
      announce(`Export preview opened: ${rows.length} rows. No file is created in this review.`);
    }, 450);
  }

  /* ---------- Custom view ---------- */
  function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function fmt(d) { return `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
  function readCustom() {
    const f = $('#j15-custom-form');
    const pattern = f.querySelector('input[name="j15-pattern"]:checked').value;
    return {
      from: $('#j15-from').value, to: $('#j15-to').value, pattern,
      repeat: Number($('#j15-repeat').value), days: $$('input[name="j15-day"]', f).filter((x) => x.checked).map((x) => Number(x.value)),
      monthMode: f.querySelector('input[name="j15-month-mode"]:checked').value, monthDay: Number($('#j15-month-day').value),
      monthEvery: Number($('#j15-month-every').value), ordinal: $('#j15-ordinal').value, weekday: Number($('#j15-weekday').value),
      monthEvery2: Number($('#j15-month-every2').value)
    };
  }
  function customDates(c) {
    const out = [];
    const from = parse(c.from); const to = parse(c.to);
    if (c.pattern === 'weekly') {
      const startWeek = new Date(from); startWeek.setDate(from.getDate() - from.getDay());
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const weekIndex = Math.floor((d - startWeek) / (7 * 86400000));
        if (weekIndex % c.repeat === 0 && c.days.includes(d.getDay())) out.push(new Date(d));
      }
    } else {
      const every = c.monthMode === 'day' ? c.monthEvery : c.monthEvery2;
      for (let m = new Date(from.getFullYear(), from.getMonth(), 1); m <= to; m = new Date(m.getFullYear(), m.getMonth() + every, 1)) {
        let d = null;
        if (c.monthMode === 'day') {
          const last = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
          d = new Date(m.getFullYear(), m.getMonth(), Math.min(c.monthDay, last)); /* DEC-J15-07 RESOLVED — A APPROVED (2026-10-08): months without the selected day show the last valid calendar day; the selected day is preserved for subsequent months; no rollover, no skipped months */
        } else {
          const matches = [];
          for (let x = new Date(m); x.getMonth() === m.getMonth(); x.setDate(x.getDate() + 1)) if (x.getDay() === c.weekday) matches.push(new Date(x));
          d = c.ordinal === 'last' ? matches[matches.length - 1] : matches[['first', 'second', 'third', 'fourth'].indexOf(c.ordinal)];
        }
        if (d && d >= from && d <= to) out.push(d);
      }
    }
    return out;
  }
  function validateCustom() {
    const c = readCustom();
    const errs = [];
    const warn = [];
    const missing = !c.from || !c.to;
    if (!missing && parse(c.to) < parse(c.from)) errs.push('To Date can\'t be lower than the From Date');
    if (c.pattern === 'weekly' && c.days.length === 0) errs.push('You have to select at-least one day');
    if (c.pattern === 'monthly' && c.monthMode === 'day' && c.monthDay >= 29) warn.push(`Some months have fewer than ${c.monthDay} days. For these months, the last day of the month will be shown`);
    $('#j15-custom-errors').innerHTML = errs.map((e) => `<div class="j15-error">${esc(e)}</div>`).join('') + warn.map((w) => `<div class="j15-warn">${esc(w)}</div>`).join('');
    $('#j15-custom-apply').disabled = missing || errs.length > 0;
    $$('.j15-weekly-only').forEach((el) => { el.hidden = c.pattern !== 'weekly'; });
    $$('.j15-monthly-only').forEach((el) => { el.hidden = c.pattern !== 'monthly'; });
    $('#j15-custom-title').textContent = `Custom view with ${c.pattern === 'weekly' ? 'Weekly' : 'Monthly'} pattern`;
    return missing || errs.length ? null : c;
  }
  function openCustom(trigger) {
    ensureBuilt();
    state.trigger = trigger || $('.view-switch .view-btn[data-view="custom"]');
    openDialog('#j15-custom-dialog');
    validateCustom();
  }
  function applyCustom() {
    const c = validateCustom();
    if (!c) return;
    const dates = customDates(c);
    const days = c.days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', ');
    const desc = c.pattern === 'weekly'
      ? `Weekly · every ${c.repeat} week${c.repeat > 1 ? 's' : ''} · ${days}`
      : (c.monthMode === 'day' ? `Monthly · day ${c.monthDay} of every ${c.monthEvery} month(s)` : `Monthly · the ${c.ordinal} ${DAY_NAMES[c.weekday]} of every ${c.monthEvery2} month(s)`);
    state.custom = { ...c, dates, desc };
    closeDialog('#j15-custom-dialog', false);
    setView('custom');
    announce(`Custom view applied: ${dates.length} date${dates.length === 1 ? '' : 's'}.`);
  }
  function renderCustom(host) {
    const c = state.custom;
    const items = j15AgendaRows().map((r) => ({ ...r })).concat(j15NonEvents());
    const head = c.dates.map((d) => `<th scope="col">${fmt(d)}</th>`).join('');
    const row = (asset) => `<tr><th scope="row">${asset} · ${VENUE}</th>` + c.dates.map((d) => {
      const chips = items.filter((x) => x.asset === asset && x.date === iso(d)).map((x) => `<span class="j15-chip ${x.kind}">${esc(x.title)}<span class="j15-muted">${x.start}–${x.end}</span></span>`).join('');
      return `<td>${chips}</td>`;
    }).join('') + '</tr>';
    host.innerHTML =
      '<div class="j15-head"><h2 id="j15-title" tabindex="-1">Custom view</h2>' +
      `<span class="j15-context">${esc(c.desc)} · ${fmt(parse(c.from))} – ${fmt(parse(c.to))} ${parse(c.to).getFullYear()} · ${c.dates.length} date${c.dates.length === 1 ? '' : 's'}</span></div>` +
      '<p class="j15-note-line">Review preview — this simplified grid stands in for the Diary\'s timeslot grid. Date navigation and the Stack/Column switch are hidden, as today. The view is not saved.</p>' +
      '<div class="j15-toolbar"><button type="button" class="j15-btn" id="j15-custom-edit">Edit custom view</button></div>' +
      (c.dates.length
        ? `<div class="j15-grid-wrap"><table class="j15-custom-grid"><thead><tr><th scope="col">Asset</th>${head}</tr></thead><tbody>${row('Hall 1')}${row('Studio 2')}</tbody></table></div>`
        : '<div class="j15-state" role="status">No dates match this pattern in the chosen range.</div>');
  }

  /* ---------- dialogs ---------- */
  function openDialog(sel) {
    const bd = $(sel);
    bd.hidden = false;
    const app = $('#app-shell'); if (app) app.inert = true;
    const g = $('#j15-guide'); if (g) g.inert = true;
    const first = bd.querySelector('[data-autofocus]') || bd.querySelector('button, input, select');
    if (first) first.focus();
  }
  function closeDialog(sel, restore = true) {
    const bd = $(sel);
    if (!bd || bd.hidden) return;
    bd.hidden = true;
    const app = $('#app-shell'); if (app) app.inert = false;
    const g = $('#j15-guide'); if (g) g.inert = false;
    if (restore && state.trigger && state.trigger.isConnected) state.trigger.focus();
  }
  function openDialogSel() { return ['#j15-export-dialog', '#j15-custom-dialog'].find((s) => $(s) && !$(s).hidden); }

  function render() {
    const host = $('#j15-surface');
    if (!host) return;
    if (state.view === 'agenda') renderAgenda(host);
    else if (state.view === 'custom' && state.custom) renderCustom(host);
    else host.innerHTML = '';
  }

  /* ---------- static markup ---------- */
  function build() {
    const cal = $('#calendar');
    if (!cal || $('#j15-surface')) return;
    const surface = document.createElement('section');
    surface.id = 'j15-surface';
    surface.className = 'j15-surface';
    surface.setAttribute('aria-labelledby', 'j15-title');
    cal.appendChild(surface);
    const dayBoxes = DAYS.map((d, i) => `<label><input type="checkbox" name="j15-day" value="${i}"> ${d}</label>`).join('');
    const opts = (n, from = 1) => Array.from({ length: n }, (_, i) => `<option value="${i + from}">${i + from}</option>`).join('');
    document.body.insertAdjacentHTML('beforeend',
      '<div class="j15-backdrop" id="j15-export-dialog" hidden><div class="j15-dialog" role="dialog" aria-modal="true" aria-labelledby="j15-export-title">' +
      '<header><div style="flex:1"><h2 id="j15-export-title">Export preview — Agenda to Excel</h2><p>No file is created in this review.</p></div><button type="button" class="j15-x" data-close aria-label="Close export preview">×</button></header>' +
      '<div class="j15-body" id="j15-export-body"></div><footer><button type="button" class="j15-btn j15-btn-primary" data-close data-autofocus>Close</button></footer></div></div>' +
      '<div class="j15-backdrop" id="j15-custom-dialog" hidden><div class="j15-dialog narrow" role="dialog" aria-modal="true" aria-labelledby="j15-custom-title">' +
      '<header><div style="flex:1"><h2 id="j15-custom-title">Custom view with Weekly pattern</h2><p>Choose dates and a repeat pattern. The Diary shows only the matching days.</p></div><button type="button" class="j15-x" data-close aria-label="Close custom view">×</button></header>' +
      '<div class="j15-body"><form class="j15-form" id="j15-custom-form" onsubmit="return false">' +
      '<div class="j15-block"><span class="j15-label">View type</span><div class="j15-row">' +
      '<label class="j15-muted"><input type="radio" name="j15-main" value="create" checked disabled> Create Custom View</label>' +
      '<label class="j15-muted"><input type="radio" name="j15-main" value="bookedDays" disabled> Show Booked Days Only</label></div>' +
      '<p class="j15-hint">The current system shows this choice only while a booking selection is in progress in the Diary, with a package filter when the selection spans two or more packages. There is no selection on this review page, so it is not available here.</p></div>' +
      '<div class="j15-block"><span class="j15-label">Date range</span><div class="j15-row"><label>From <input type="date" id="j15-from" value="2026-08-01" data-autofocus></label><label>To <input type="date" id="j15-to" value="2026-08-31"></label></div></div>' +
      '<div class="j15-block"><span class="j15-label">Pattern</span><div class="j15-row"><label><input type="radio" name="j15-pattern" value="weekly" checked> Weekly</label><label><input type="radio" name="j15-pattern" value="monthly"> Monthly</label></div></div>' +
      `<div class="j15-block j15-weekly-only"><span class="j15-label">Weekly</span><div class="j15-row"><label>Repeat every <select id="j15-repeat">${opts(6)}</select> week(s) on</label><button type="button" class="j15-btn" id="j15-all-days">Select all days</button></div><div class="j15-days">${dayBoxes}</div></div>` +
      `<div class="j15-block j15-monthly-only" hidden><span class="j15-label">Monthly</span><div class="j15-row"><label><input type="radio" name="j15-month-mode" value="day" checked> Day</label><select id="j15-month-day" aria-label="Day of month">${opts(31)}</select><label>of every <select id="j15-month-every">${opts(3)}</select> month(s)</label></div>` +
      '<div class="j15-row" style="margin-top:8px"><label><input type="radio" name="j15-month-mode" value="the"> The</label><select id="j15-ordinal" aria-label="Which week"><option value="first">First</option><option value="second">Second</option><option value="third">Third</option><option value="fourth">Fourth</option><option value="last">Last</option></select>' +
      `<select id="j15-weekday" aria-label="Weekday">${DAY_NAMES.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select><label>of every <select id="j15-month-every2">${opts(3)}</select> month(s)</label></div></div>` +
      '<div class="j15-block"><div class="j15-row"><label class="j15-muted"><input type="checkbox" id="j15-save-view" disabled> Save this View</label><span class="j15-muted">Not saved in this review. Saving a view is a settings behaviour (UJ-16) and is an open decision.</span></div></div>' +
      '<div id="j15-custom-errors" role="alert" aria-live="assertive"></div></form></div>' +
      '<footer><button type="button" class="j15-btn" data-close>Cancel</button><button type="button" class="j15-btn j15-btn-primary" id="j15-custom-apply" disabled>Apply</button></footer></div></div>' +
      '<aside class="j15-guide" id="j15-guide" aria-label="Mockup guide (review aid, not Product)"><div class="j15-guide-head"><strong>Journey 15 v2 · not product</strong>' +
      '<div class="j15-states" role="group" aria-label="Agenda state"><button type="button" data-state="populated" aria-pressed="true">Events</button><button type="button" data-state="no-search" aria-pressed="false">No search yet</button><button type="button" data-state="empty" aria-pressed="false">Empty</button><button type="button" data-state="loading" aria-pressed="false">Loading</button></div>' +
      '<button type="button" id="j15-guide-toggle" aria-expanded="true">Hide</button></div>' +
      '<div class="j15-guide-body"><ol><li><em>Agenda</em> in the view bar shows this week\'s events full-width.</li><li>Tick <em>Show booked events only</em>.</li><li><em>Export</em> shows the export preview (no file is created).</li><li><em>Details</em> on a row opens its secondary actions.</li><li><em>Custom</em> → pick dates and days → <em>Apply</em>.</li><li><em>Week</em> returns to the normal calendar.</li></ol>' +
      '<p class="j15-note">Proposed, not current behaviour: Export\'s “Preparing…” step and its lock when there is nothing to export (decision DEC-J15-03). Today\'s Export gives no feedback.</p>' +
      '<p class="j15-note">Phones: here the Agenda and Custom buttons are cut off at the end of the view bar; in the current system and some Master journeys the view buttons are hidden on small screens. Mobile entry is an open decision.</p></div></aside>');
    if (window.innerWidth <= 600) { // phones: start with the slim guide bar so it never covers the list
      const g = $('#j15-guide');
      if (g) g.dataset.collapsed = 'true';
      const tg = $('#j15-guide-toggle');
      if (tg) { tg.textContent = 'Journey 15 guide'; tg.setAttribute('aria-expanded', 'false'); }
    }
  }

  /* ---------- events ---------- */
  window.addEventListener('click', (event) => {
    if (!state.ready) return;
    const t = event.target;
    const vb = t.closest('.view-switch .view-btn[data-view]');
    if (vb && vb.dataset.view === 'agenda') { event.preventDefault(); event.stopImmediatePropagation(); closePanels(); setView('agenda'); announce('Agenda view. Review fixture.'); return; }
    if (vb && vb.dataset.view === 'custom') { event.preventDefault(); event.stopImmediatePropagation(); closePanels(); openCustom(vb); return; }
    if (vb && vb.dataset.view === 'week' && state.view !== 'week') { setView('week'); announce('Week view.'); return; }
    if (t.closest('#j15-export')) { event.preventDefault(); openExport(); return; }
    if (t.closest('#j15-custom-apply')) { event.preventDefault(); applyCustom(); return; }
    if (t.closest('#j15-custom-edit')) { event.preventDefault(); openCustom(t.closest('#j15-custom-edit')); return; }
    if (t.closest('#j15-all-days')) { $$('input[name="j15-day"]').forEach((x) => { x.checked = true; }); validateCustom(); return; }
    if (t.closest('[data-close]')) { const s = openDialogSel(); if (s) closeDialog(s); return; }
    if (t.closest('[data-j15-details]')) {
      const btn = t.closest('[data-j15-details]');
      const details = btn.nextElementSibling;
      const open = !details || details.hidden;
      if (details) details.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (!open) btn.focus();
      return;
    }
    const sb = t.closest('#j15-guide [data-state]');
    if (sb) {
      state.agendaState = sb.dataset.state;
      $$('#j15-guide [data-state]').forEach((b) => b.setAttribute('aria-pressed', String(b === sb)));
      if (state.view !== 'agenda') { closePanels(); setView('agenda'); } else render();
      return;
    }
    if (t.closest('#j15-guide-toggle')) {
      const g = $('#j15-guide'); const collapse = g.dataset.collapsed !== 'true';
      g.dataset.collapsed = String(collapse);
      t.closest('#j15-guide-toggle').setAttribute('aria-expanded', String(!collapse));
      t.closest('#j15-guide-toggle').textContent = collapse ? 'Journey 15 guide' : 'Hide';
      return;
    }
    if (state.view === 'agenda' && t.closest('#date-prev, #date-next, #date-today, #picker-apply')) window.setTimeout(render, 80);
  }, true);
  document.addEventListener('change', (event) => {
    if (event.target.id === 'j15-booked-only') {
      state.bookedOnly = event.target.checked;
      render();
      const cb = $('#j15-booked-only'); if (cb) cb.focus();
      announce(state.bookedOnly ? 'Showing booked events only.' : 'Showing all events.');
      return;
    }
    if (event.target.closest && event.target.closest('#j15-custom-form')) validateCustom();
  });
  document.addEventListener('input', (event) => { if (event.target.closest && event.target.closest('#j15-custom-form')) validateCustom(); });
  window.addEventListener('keydown', (event) => {
    const s = openDialogSel();
    if (!s) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeDialog(s); return; }
    if (event.key === 'Tab') {
      const f = $$('button:not([disabled]), input:not([disabled]), select:not([disabled])', $(s)).filter((x) => !x.closest('[hidden]'));
      if (!f.length) return;
      if (event.shiftKey && document.activeElement === f[0]) { event.preventDefault(); f[f.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === f[f.length - 1]) { event.preventDefault(); f[0].focus(); }
    }
  }, true);

  function ensureBuilt() { if (!$('#j15-surface')) build(); }
  function init() {
    const isJ12 = () => document.body.dataset.journey === '12';
    document.body.dataset.j15Candidate = 'ready';
    if (!isJ12()) return;
    if (!window.__j12Review) { state.tries += 1; if (state.tries < 80) window.setTimeout(init, 50); return; }
    state.ready = true;
    window.__j15V2 = Object.freeze({ state, setView, openCustom, openExport });
    if (location.hash === '#agenda') { closePanels(); setView('agenda'); }
    else if (location.hash === '#custom') { closePanels(); openCustom(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(init, 60));
  else window.setTimeout(init, 60);
})();

(function journey16Candidate() {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const state = { tries: 0, ready: false, trigger: null };

  function announce(text) {
    const live = $('#ldp-live');
    if (live) live.textContent = text;
    const toast = $('#toast-region');
    if (toast) toast.textContent = text;
  }

  function build() {
    if ($('#j16-settings-dialog')) return;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="j16-backdrop" id="j16-settings-dialog" hidden><div class="j16-dialog" role="dialog" aria-modal="true" aria-labelledby="j16-settings-title">' +
      '<header><div style="flex:1"><h2 id="j16-settings-title">Diary settings</h2><p>Proposed Journey 16 surface — review only, nothing is saved.</p></div><button type="button" class="j16-x" data-j16-close aria-label="Close settings">×</button></header>' +
      '<div class="j16-body"><form onsubmit="return false">' +
      '<div class="j16-block"><span class="j16-label">Default date behaviour</span><div class="j16-row">' +
      '<label><input type="radio" name="j16-datebehaviour" value="today" checked> Today (current system default)</label>' +
      '<label><input type="radio" name="j16-datebehaviour" value="remember"> Remember last view</label></div>' +
      '<p class="j16-hint">From the current system\'s DiarySettings defaultDateBehavior offers these two values (today is the default). Every combination is unverified (SETTINGS-01).</p></div>' +
      '<div class="j16-block"><span class="j16-label">Timeslot colours</span><div class="j16-row">' +
      '<label><input type="checkbox" id="j16-colours" checked> Show timeslot colours in the calendar</label></div>' +
      '<p class="j16-hint">The current system loads colour options at startup (selected reads confirmed). Proposed as a settings toggle.</p></div>' +
      '<div class="j16-block"><span class="j16-label">Rights displays (proposed — display only)</span>' +
      '<div class="j16-row"><span class="j16-muted">Example: Agenda requires right <b>959</b> · shown as a label, nothing is enforced · the intended UI/API right matrix is RIGHTS-01 (open).</span></div></div>' +
      '<div class="j16-block"><span class="j16-label">Outlook and SignalR</span>' +
      '<p class="j16-hint">Outlook: no verifiable runtime outcome exists — excluded. SignalR: connection and one send are confirmed in the evidence, but collaboration, reconnect and topology are unverified, so no prototype behaviour is proposed. (DEC-J16-05)</p></div>' +
      '<p class="j16-hint"><b>Not persisted:</b> the prototype stores nothing. Whether settings persist (session-only vs storage) is DEC-J16-02 — open.</p>' +
      '</form></div>' +
      '<footer><button type="button" class="j16-btn" data-j16-close>Cancel</button><button type="button" class="j16-btn j16-btn-primary" id="j16-save" data-autofocus>Save</button></footer></div></div>' +
      '<aside class="j16-guide" id="j16-guide" aria-label="Journey 16 review guide (review aid, not Product)"><div class="j16-guide-head"><strong>Journey 16 review · not product</strong>' +
      '<button type="button" id="j16-guide-toggle" aria-expanded="true">Hide</button></div>' +
      '<div class="j16-guide-body"><ol>' +
      '<li>This page opened with the Settings dialog (review entry).</li>' +
      '<li>Choose options and press <em>Save</em> — you get a message, nothing persists (DEC-J16-02).</li>' +
      '<li>Open <em>Agenda</em> — a rights strip appears under the Agenda toolbar: display proposal only (RIGHTS-01 open).</li>' +
      '<li>On a phone, the view bar now scrolls horizontally — proposed fix for DEC-J15-05 (DEC-J16-04).</li>' +
      '<li>Agenda, Custom and Week still work exactly as in Journey 15.</li></ol>' +
      '<p class="j16-note">Out of the proposal: Outlook behaviour, SignalR collaboration behaviour, the notification catalogue, settings persistence, any rights enforcement, any Journey 15-or-earlier change.</p></div></aside>');
    if (window.innerWidth <= 600) {
      const g = $('#j16-guide');
      if (g) g.dataset.collapsed = 'true';
      const tg = $('#j16-guide-toggle');
      if (tg) { tg.textContent = 'Journey 16 guide'; tg.setAttribute('aria-expanded', 'false'); }
    }
    placeGuide();
  }

  // keep the J16 review guide directly above the J15 review guide when both are shown (both are pinned to the same corner)
  function placeGuide() {
    const g = $('#j16-guide'); if (!g) return;
    const j15 = $('#j15-guide');
    const r = j15 && j15.getClientRects().length ? j15.getBoundingClientRect() : null;
    g.style.bottom = r ? Math.round(window.innerHeight - r.top + 6) + 'px' : '';
    if (j15 && window.ResizeObserver && !state.guideRO) { state.guideRO = new ResizeObserver(placeGuide); state.guideRO.observe(j15); }
  }

  function openSettings(trigger) {
    state.trigger = trigger || $('#j16-settings-entry') || $('.view-switch .view-btn[data-view="agenda"]');
    const open = $('#j16-settings-dialog') && !$('#j16-settings-dialog').hidden;
    if (!open) state.prevTitle = document.title;
    document.title = 'Optimo Diary — Journey 16 settings candidate';
    if (!$('#j16-settings-dialog')) build();
    const d = $('#j16-settings-dialog');
    d.hidden = false;
    const app = $('#app-shell'); if (app) app.inert = true;
    const g = $('#j16-guide'); if (g) g.inert = true;
    const first = d.querySelector('[data-autofocus]');
    if (first) first.focus();
  }
  function closeSettings(restore) {
    const d = $('#j16-settings-dialog');
    if (!d || d.hidden) return;
    d.hidden = true;
    const app = $('#app-shell'); if (app) app.inert = false;
    const g = $('#j16-guide'); if (g) g.inert = false;
    if (state.prevTitle) { document.title = state.prevTitle; state.prevTitle = null; }
    placeGuide();
    if (restore && state.trigger && state.trigger.isConnected) state.trigger.focus();
  }

  window.addEventListener('click', (event) => {
    if (!state.ready) return;
    const t = event.target;
    if (t.closest('#j16-settings-entry')) { event.preventDefault(); openSettings(t.closest('#j16-settings-entry')); return; }
    if (t.closest('[data-j16-close]')) { event.preventDefault(); closeSettings(true); return; }
    if (t.closest('#j16-save')) {
      event.preventDefault();
      announce('Settings review saved — nothing persists in this review (DEC-J16-02 open).');
      closeSettings(true);
      return;
    }
    if (t.closest('#j16-guide-toggle')) {
      const g = $('#j16-guide'); const collapse = g.dataset.collapsed !== 'true';
      g.dataset.collapsed = String(collapse);
      t.closest('#j16-guide-toggle').setAttribute('aria-expanded', String(!collapse));
      t.closest('#j16-guide-toggle').textContent = collapse ? 'Journey 16 guide' : 'Hide';
      return;
    }
  }, true);
  window.addEventListener('keydown', (event) => {
    const d = $('#j16-settings-dialog');
    if (!d || d.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeSettings(true); return; }
    if (event.key === 'Tab') {
      const f = $$('button:not([disabled]), input:not([disabled])', d).filter((x) => !x.closest('[hidden]'));
      if (!f.length) return;
      if (event.shiftKey && document.activeElement === f[0]) { event.preventDefault(); f[f.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === f[f.length - 1]) { event.preventDefault(); f[0].focus(); }
    }
  }, true);

  function init() {
    if (document.body.dataset.journey !== '12') return;
    if (document.body.dataset.j14Entry === 'open') return; // the Journey 14 in-Diary view must stay untouched
    document.body.dataset.j16Candidate = 'ready'; // review-readiness marker, Diary route only (Journey 15's marker is unchanged)
    const bar = $('#view-bar');
    if (bar && !$('#j16-settings-entry')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'j16-settings-entry';
      btn.className = 'j16-btn';
      btn.textContent = 'Settings';
      btn.setAttribute('title', 'Proposed Journey 16 settings entry (review only)');
      bar.appendChild(btn);
    }
    // rights strip: kept in sync with the Agenda view whatever shows it (view-bar click, deep link, re-render).
    // Display proposal only — nothing is enforced (RIGHTS-01 open). The J15 hook is left untouched.
    const syncRightsStrip = () => {
      const agenda = document.body.dataset.j15View === 'agenda';
      const tb = document.querySelector('#j15-surface .j15-toolbar');
      const strip = $('#j16-rights-strip');
      if (agenda && tb && !strip) {
        tb.insertAdjacentHTML('afterend',
          '<div class="j16-rights-strip" id="j16-rights-strip"><span class="j16-right"><b>Agenda</b> requires right 959</span>' +
          '<span class="j16-right"><b>Week/Custom</b> inherit the Diary view rights</span>' +
          '<span>proposed display only — nothing is enforced · RIGHTS-01 open</span></div>');
      } else if (!agenda && strip) strip.remove();
    };
    const cal = $('#calendar');
    if (cal && window.MutationObserver) {
      const mo = new MutationObserver(() => { syncRightsStrip(); placeGuide(); });
      mo.observe(cal, { childList: true, subtree: true });
      mo.observe(document.body, { attributes: true, attributeFilter: ['data-j15-view'] });
    }
    syncRightsStrip();
    window.addEventListener('resize', placeGuide);
    state.ready = true;
    window.__j16Review = Object.freeze({ openSettings });
    if (location.hash === '#settings') openSettings();
  }
  document.addEventListener('DOMContentLoaded', () => window.setTimeout(init, 80));
})();

