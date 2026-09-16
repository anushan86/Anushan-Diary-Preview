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
      }
      const label = document.createElement('span');
      label.className = 'timeslot-legend-label';
      label.textContent = resolveTimeslotLegendLabel(key, entry);
      li.append(swatch, label);
      list.appendChild(li);
    });
    host.appendChild(list);
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
    return 1;
  }

  function applyJourneyBoot() {
    const journey = parseJourneyBoot(window.location.search);
    document.body.dataset.journey = String(journey);
    if (journey === 1) document.body.dataset.contextualWorkspace = 'true';
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
    const isJ1 = journey === 1;
    const isJ2 = journey === 2;
    const isJ3 = journey === 3;
    const isJ4 = journey === 4;
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
    const j4Only = ['#j4-overview', '#j4-selection-summary', '#j4-review-controls'];
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
      document.querySelectorAll(sel).forEach((el) => j2SetSurfaceExcluded(el, !isJ4));
    });
    if (isJ4) {
      const reviewToggle = $('#review-rail-toggle');
      const reviewPanel = $('#review-rail-panel');
      j2SetSurfaceExcluded(reviewToggle, false);
      j2SetSurfaceExcluded(reviewPanel, false);
      if (reviewPanel) reviewPanel.hidden = true;
      if (reviewToggle) reviewToggle.setAttribute('aria-expanded', 'false');
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
      } else if (isJ4) {
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
  const J4_REVIEW_STATES = new Set(['ready', 'loading', 'empty', 'error', 'access-denied', 'varies']);
  let j4ViewState = 'ready';
  let j4ActiveFixtureId = 'selected';
  let j4EnabledFilters = new Set(J4_FILTER_ORDER);
  let j4ContextFixture = null;
  let j4ContextTrigger = null;
  let j4DetailsReturnTarget = null;
  let j4PointerSelection = null;

  function isJ4Journey() {
    return document.body.dataset.journey === '4';
  }

  function j4FindFixture(id) {
    return J4_FIXTURES.find((fixture) => fixture.id === id) || null;
  }

  function j4FixtureDate(fixture) {
    return addDays(weekStart, fixture.dayOffset);
  }

  function j4FixtureTime(fixture) {
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
    J4_FILTER_ORDER.forEach((kind) => {
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
    $$('.j4-timeslot[data-j4-kind]').forEach((card) => {
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
    if (fixture.kind === 'available') {
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

    let fixture = j4FindFixture(j4ActiveFixtureId) || j4FindFixture('selected');
    if (j4ViewState === 'empty') fixture = j4FindFixture('available');
    if (!fixture) return;
    const handedOff = fixture.kind === 'available' && !!stagedSelection;
    title.textContent = handedOff ? 'Available interval selected' : fixture.reference;
    copy.textContent = handedOff
      ? 'One staged selection was handed to the existing J1 New Selection state and handlers; no second Cart was created.'
      : `${fixture.label} · ${fixture.status}`;
    state.textContent = handedOff ? 'Selected' : fixture.label;
    time.textContent = j4FixtureDateTime(fixture);
    resource.textContent = fixture.resource;
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
    $$('.j4-timeslot[data-j4-fixture]').forEach((card) => {
      const selected = card.dataset.j4Fixture === fixture.id;
      card.classList.toggle('is-current', selected);
      card.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
    j4RenderSummary();
    announceLive(`${fixture.label} selected for read-only review.`);
    if (trigger && typeof trigger.focus === 'function' && document.body.contains(trigger)) trigger.focus();
  }

  const J4_CART_HANDOFF_SURFACES = [
    '#booking-cart', '#cart-sheet', '#mismatch-dialog', '#large-data-picker',
    '#large-data-picker-backdrop', '#configure-form', '#amount-region', '#cart-current-selection'
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
    count.textContent = j4ViewState === 'loading' ? 'Loading' : 'Six supported fixture classes';
    countCell.appendChild(count);
    boardHead.append(titleCell, countCell);
    grid.appendChild(boardHead);

    let fixtures = J4_FIXTURES;
    if (j4ViewState === 'loading' || j4ViewState === 'error') fixtures = [];
    else if (j4ViewState === 'empty') fixtures = J4_FIXTURES.filter((fixture) => fixture.kind === 'available');

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

  const J2_TODAY = new Date(2026, 8, 4);
  const J2_HOUR_START = 7;
  const J2_HOUR_END = 21;
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
    { id: 'BK-10501', asset: 'hall1', date: '2026-09-01', start: 10, end: 16, type: 'quotation', title: 'BK-10501', status: 'Quotation · Occupied' },
    { id: 'BK-10482', asset: 'studio2', date: '2026-09-02', start: 9, end: 13, type: 'confirmed', title: 'BK-10482', status: 'Confirmed · Occupied' },
    { id: 'BLK-220', asset: 'hall2', date: '2026-09-04', allDay: true, type: 'block', title: 'BLK-220', status: 'Block' },
    { id: 'FNI-301', asset: 'studio2', date: '2026-09-05', start: 15, end: 17, type: 'facility-not-in-use', title: 'FNI-301', status: 'Facility not in use · Unavailable' }
  ];

  const J2_FREE_SLOTS = [
    { asset: 'hall1', date: '2026-09-04', start: 14, end: 17 },
    { asset: 'studio2', date: '2026-09-03', start: 10, end: 12 },
    { asset: 'hall2', date: '2026-09-03', start: 9, end: 11 }
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
      const { h, m } = j2SlotToTime(slot);
      slotEl.setAttribute('aria-label', `${asset.name} ${dk} ${j2FormatTime(h, m)}${selectable ? ' — Available' : ''}`);
      col.appendChild(slotEl);
    }
    j2EventOnDate(asset.id, dk).forEach((ev) => {
      const evEl = j2CreateEventElement(ev);
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
  }

  function j2SyncBodyDataset() {
    document.body.dataset.mode = j2State.mode;
    document.body.dataset.view = j2State.view;
    document.body.dataset.layout = j2State.layout;
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
    { asset: 'hall1', date: '2026-08-29', start: 14, end: 17 },
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
    return document.body.dataset.contextualWorkspace === 'true' && document.body.dataset.journey === '1';
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
    const host = $(FIELD_HOSTS[field]);
    if (host) host.value = id;
    syncFieldDisplay(field);
    if (notify && host) {
      host.dispatchEvent(new Event('change', { bubbles: true }));
      if (field === 'item' || field === 'package') updateConfigureForm();
    }
  }

  function getCatalog(type) {
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
    if (pickerOpen && pickerType !== type) closePicker({ restore: false, refocus: false });
    pickerType = type;
    pickerOpen = true;
    pickerQuery = '';
    pickerActive = 0;
    pickerHost = (opts && opts.host) || null;
    pickerContext = (opts && opts.context) || null;
    inlinePickerLineId = pickerHost && !pickerContext ? pickerHost.id : null;
    inlinePickerField = (opts && opts.field) || null;
    const inp = getPickerInputEl(type);
    pickerPrev = inp ? inp.value : '';
    $('#large-data-filter').value = '';
    filteredPicker = filterCatalog(type, '');
    const picker = $('#large-data-picker');
    picker.classList.add('open');
    if (!isNarrowViewport()) {
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
    $('#large-data-picker').classList.remove('open');
    $('#large-data-picker-backdrop').classList.remove('open');
    const cart = $('#booking-cart');
    if (cart && $('#large-data-picker').parentElement !== cart) cart.appendChild($('#large-data-picker'));
    if (context === 'package-editor' && restore && packageEditor) {
      renderPackageEditor();
      reopenCartItemEditor('package');
      $('#package-picker-btn').focus();
    } else if (refocus && type) pickerFocusReturn(type);
  }

  function commitPicker(idx) {
    const rec = filteredPicker[idx];
    if (!rec || !pickerType) return;
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
      if (pickerOpen && pickerType && !isNarrowViewport()) positionPicker(pickerType);
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
      selectedAssets.delete(btn.dataset.unpin);
      renderAssetTree();
      renderCalendar();
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
      if (line.asset !== assetId || line.date !== dk) continue;
      const range = slotRangeForSelection(line);
      if (slot >= range.startSlot && slot < range.endSlot) return true;
    }
    if (stagedSelection && !editingLineId) {
      const s = stagedSelection;
      if (s.asset === assetId && s.date === dk) {
        const range = slotRangeForSelection(s);
        if (slot >= range.startSlot && slot < range.endSlot) return true;
      }
    }
    if (draft.created) {
      const c = draft.created;
      if (c.asset === assetId && c.date === dk) {
        const range = slotRangeForSelection(c);
        if (slot >= range.startSlot && slot < range.endSlot) return true;
      }
    }
    return false;
  }

  function isFreeSlot(assetId, dk, slot) {
    if (!isCheckpointWeek()) return false;
    const { h } = slotToTime(slot);
    for (const fs of FREE_SLOTS) {
      if (fs.asset !== assetId || fs.date !== dk) continue;
      if (h >= fs.start && h < fs.end) {
        if (!isSlotOccupied(assetId, dk, slot)) return true;
      }
    }
    return false;
  }

  function getFixtureFreeRange(assetId, dk, slot) {
    for (const fs of FREE_SLOTS) {
      if (fs.asset !== assetId || fs.date !== dk) continue;
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
      if (line.asset !== assetId || line.date !== dk) continue;
      const range = slotRangeForSelection(line);
      if (slot >= range.startSlot && slot < range.endSlot) return true;
    }
    return false;
  }

  function isCreatedSlot(assetId, dk, slot) {
    if (!draft.created) return false;
    const c = draft.created;
    if (c.asset !== assetId || c.date !== dk) return false;
    const range = slotRangeForSelection(c);
    return slot >= range.startSlot && slot < range.endSlot;
  }

  function showToast(msg, duration) {
    const region = $('#toast-region');
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    region.appendChild(el);
    setTimeout(() => el.remove(), duration || 3500);
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
        btn.disabled = !isCompatible(item, pkg) || !isJourneyItem(item) || !isJourneyPackage(pkg) || !getStagedPackageState(false).valid;
        break;
      }
      case 'edit': {
        btn.textContent = 'Update item';
        const item = getCommitted('item');
        const pkg = getCommitted('package');
        btn.disabled = !isCompatible(item, pkg) || !isJourneyItem(item) || !isJourneyPackage(pkg) || !getStagedPackageState(false).valid;
        break;
      }
      case 'another':
        btn.textContent = 'Add another';
        break;
      case 'unavailable':
        btn.textContent = 'Choose an available time';
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
    host.innerHTML = `
      <div class="field package-value-field">
        <label for="${inputId}">${fieldLabel}</label>
        <input type="number" id="${inputId}" min="${meta.min}" max="${meta.max}" placeholder="${meta.min}–${meta.max}" required>
        <p class="field-caption quiet">${fieldLabel} ${meta.min}–${meta.max} for this review Package fixture; no universal default.</p>
      </div>
      <fieldset class="included-items compact-included-items">
        <legend>Included Package Items</legend>
        ${(meta.includedItems || []).map((id) => `<label><input type="checkbox" data-staged-included="${id}" checked> ${escapeHtml(getItemRecord(id).label)}</label>`).join('')}
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
    const formattedTotal = `AU$ ${total.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    $('#cart-success').hidden = phase !== 'success';
    $('#cart-unavailable').hidden = phase !== 'unavailable';

    const confirmBtn = $('#confirm-booking-btn');
    const helper = $('#confirm-helper');
    const bookReady = cartLines.length >= 1 && !stagedSelection && !editingLineId &&
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

    $('#cart-count').textContent = projection.itemLabel;
    $('#sheet-count').textContent = String(count);
    $('#clear-cart-btn').hidden = count === 0 && !hasSelection;
    const cartToolbar = $('#cart-toolbar');
    if (cartToolbar) cartToolbar.hidden = count === 0 && !hasSelection;
    const confirmBookBtn = $('#confirm-booking-btn');
    if (confirmBookBtn) confirmBookBtn.textContent = projection.bookLabel;
    const selectedCount = selectedLineIds.size;
    $('#selected-lines-count').textContent = `${selectedCount} selected`;
    $('#selected-lines-count').hidden = selectedCount === 0;
    $('#cart-bulk-actions').hidden = selectedCount < 2;
    $('#bulk-time-btn').disabled = selectedCount < 2;
    $('#bulk-config-btn').disabled = selectedCount < 2;

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
    const dateStr = formatShortDate(new Date(line.date + 'T12:00:00'));
    const endDate = line.endDate || line.date;
    const endDateSuffix = endDate !== line.date ? ` ${formatShortDate(new Date(endDate + 'T12:00:00'))}` : '';
    const timeStr = `${formatSelectionTime(line.startH, line.startM)}–${endDateSuffix}${formatSelectionTime(line.endH, line.endM)}`;
    const durationStr = formatLineDuration(line);
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
      li.setAttribute('aria-label', `Booking selection ${lineNum}: ${asset.name}, ${formatShortDate(new Date(line.date + 'T12:00:00'))}, ${formatSelectionTime(line.startH, line.startM)} to ${formatSelectionTime(line.endH, line.endM)}`);

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
    const hours = selectionDurationHours(s);
    const endDate = s.endDate || s.date;
    const endDateSuffix = endDate !== s.date ? ` ${formatShortDate(new Date(endDate + 'T12:00:00'))}` : '';
    const when = `${formatShortDate(new Date(s.date + 'T12:00:00'))} · ${formatSelectionTime(s.startH, s.startM)}–${endDateSuffix}${formatSelectionTime(s.endH, s.endM)} · ${hours} hour${hours !== 1 ? 's' : ''}`;
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
    $('#amount-region').hidden = !compatible;
    const amountEl = $('#amount-region .amount-value');
    if (amountEl) {
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
  }

  function openMismatchDialog(trigger) {
    lastDialogTrigger = trigger || document.activeElement;
    $('#mismatch-dialog').showModal();
    $('#mismatch-fix').focus();
    announceAlert('This asset does not have an Item with matching Sales Categories with the selected Package.');
  }

  function createSelection(assetId, dk, startSlot, endSlotExclusive) {
    stagedSelection = selectionFromSlots(assetId, dk, startSlot, endSlotExclusive);
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
    if (!stagedSelection) return;
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
      amountPending: cartLines.length >= 1 && !editingLineId,
      amount: 2750,
      priceStatus: 'Calculated · review fixture',
      pricingOption: 'standard',
      priceMode: 'default',
      priceType: 'standard-rate',
      pricingUnit: 'hour'
    };
    if (editingLineId) {
      const idx = cartLines.findIndex((l) => l.id === editingLineId);
      if (idx >= 0) cartLines[idx] = { ...line, id: editingLineId, amountPending: cartLines[idx].amountPending };
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
    if (id === STAGED_SELECTION_EDITOR_ID && cartItemEditorTargetsStagedSelection()) return stagedSelection;
    return cartLines.find((entry) => entry.id === id);
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
      tablist.setAttribute('role', draftTarget ? 'toolbar' : 'tablist');
      tablist.setAttribute('aria-label', draftTarget ? 'New selection editor sections' : 'Cart item editor sections');
    }
    const controls = {
      time: 'cie-panel-time',
      config: 'cie-panel-config',
      package: 'cie-panel-package',
      pricing: 'cie-panel-pricing',
      more: 'cie-panel-more'
    };
    const draftLabels = {
      time: 'Edit draft time',
      config: 'Open existing configuration controls',
      package: 'Open existing package controls',
      pricing: 'Open existing pricing controls'
    };
    $$('.cart-item-editor-tab').forEach((tab) => {
      const name = tab.dataset.editorTab;
      if (draftTarget) {
        tab.setAttribute('role', 'button');
        tab.removeAttribute('aria-controls');
        tab.removeAttribute('aria-selected');
        tab.setAttribute('aria-label', draftLabels[name] || tab.textContent.trim());
        tab.tabIndex = 0;
      } else {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-controls', controls[name]);
        tab.removeAttribute('aria-label');
        tab.removeAttribute('aria-pressed');
      }
    });
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
    const draftTarget = cartItemEditorTargetsStagedSelection();
    tabs.forEach((btn) => {
      const active = btn.dataset.editorTab === tab;
      if (draftTarget) {
        btn.removeAttribute('aria-selected');
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.tabIndex = 0;
      } else {
        btn.removeAttribute('aria-pressed');
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
        btn.tabIndex = active ? 0 : -1;
      }
    });
    panels.forEach((panel) => {
      panel.hidden = panel.id !== `cie-panel-${tab}`;
    });
    if (cartItemEditor) cartItemEditor.tab = tab;
  }

  function focusEditorTab(tab) {
    if (tab === 'time') $('#time-start-date').focus();
    else if (tab === 'config') $('#configuration-choice').focus();
    else if (tab === 'package') $('#package-picker-btn').focus();
    else if (tab === 'pricing') $('#pricing-configuration').focus();
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
    const uniqueIds = Array.from(new Set(ids)).filter((id) => !!getEditorTargetRecord(id));
    if (!uniqueIds.length) return false;
    const drafts = {};
    uniqueIds.forEach((id) => {
      const line = getEditorTargetRecord(id);
      drafts[id] = { candidate: { ...line }, checked: true };
    });
    timeEditor = { ids: uniqueIds, mode: 'common', drafts, candidates: {}, target: cartItemEditorTargetsStagedSelection() ? 'staged-selection' : 'cart-line' };
    const first = getEditorTargetRecord(uniqueIds[0]);
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
    const uniqueIds = Array.from(new Set(ids)).filter((id) => cartLines.some((line) => line.id === id));
    if (!uniqueIds.length) return false;
    const first = cartLines.find((line) => line.id === uniqueIds[0]);
    configurationEditor = { ids: uniqueIds, selected: new Set(uniqueIds), configuration: first.configuration || (CONFIGURATIONS[first.asset] || [])[0] };
    renderConfigurationEditor();
    return true;
  }

  function initPackageEditor(id) {
    const line = cartLines.find((entry) => entry.id === id);
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
    const line = cartLines.find((entry) => entry.id === id);
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
    $('#pricing-amount').textContent = `AU$ ${amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
    return true;
  }

  function ensureEditorTabInitialized(tab) {
    if (!cartItemEditor) return false;
    if (cartItemEditorTargetsStagedSelection() && tab !== 'time') return false;
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
    if (cartItemEditorTargetsStagedSelection() && tab !== 'time') {
      openStagedConfigurePath(tab);
      return;
    }
    if (!ensureEditorTabInitialized(tab)) return;
    setEditorTab(tab);
    focusEditorTab(tab);
    updateCartUI();
  }

  function openCartItemEditor(tab, idsOrId, trigger) {
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
    const draftTarget = cartItemEditorTargetsStagedSelection();
    const currentIndex = draftTarget ? Math.max(0, tabs.indexOf(document.activeElement)) : tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    if (draftTarget) {
      tabs[nextIndex].focus();
      return;
    }
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
    const first = getEditorTargetRecord(timeEditor.ids[0]);
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
    const original = getEditorTargetRecord(id);
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
        const line = getEditorTargetRecord(id);
        if (!line) return;
        result[id] = candidateFromParts(line, $('#time-start-date').value, $('#time-start-time').value, $('#time-end-date').value, $('#time-end-time').value);
      });
    } else {
      timeEditor.ids.forEach((id) => {
        const row = $(`[data-time-row="${id}"]`);
        const checked = !!row.querySelector(`[data-time-check="${id}"]`).checked;
        timeEditor.drafts[id].checked = checked;
        if (!checked) return;
        const line = getEditorTargetRecord(id);
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
      closeCartItemEditor();
      showToast('Current selection time updated · Add to cart is still required');
      updateCartUI();
      renderCalendar();
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
      const line = cartLines.find((entry) => entry.id === id);
      return line ? (CONFIGURATIONS[line.asset] || []) : [];
    })));
  }

  function renderConfigurationEditor() {
    if (!configurationEditor) return;
    const choices = availableConfigurationsFor(configurationEditor.ids);
    const select = $('#configuration-choice');
    select.innerHTML = choices.map((id) => `<option value="${id}">${escapeHtml(configurationLabel(id))}</option>`).join('');
    if (!choices.includes(configurationEditor.configuration)) configurationEditor.configuration = choices[0];
    select.value = configurationEditor.configuration;
    const isBulk = configurationEditor.ids.length > 1;
    $('#configuration-title').textContent = isBulk ? 'Bulk configuration' : 'Configuration';
    $('#configuration-select-all-row').hidden = !isBulk;
    let compatibleCount = 0;
    $('#configuration-targets').innerHTML = configurationEditor.ids.map((id) => {
      const line = cartLines.find((entry) => entry.id === id);
      const asset = ASSETS.find((entry) => entry.id === line.asset);
      const compatible = (CONFIGURATIONS[line.asset] || []).includes(configurationEditor.configuration);
      if (compatible) compatibleCount += 1; else configurationEditor.selected.delete(id);
      return `<label class="target-row ${compatible ? '' : 'is-disabled'}" title="${compatible ? '' : 'Selected configuration is not available for this facility'}">
        <input type="checkbox" data-config-target="${id}" ${configurationEditor.selected.has(id) ? 'checked' : ''} ${compatible ? '' : 'disabled'}>
        <span><strong>${escapeHtml(asset.name)}</strong><small>${compatible ? configurationLabel(configurationEditor.configuration) : 'Unavailable for this configuration'}</small></span>
      </label>`;
    }).join('');
    const compatibleIds = configurationEditor.ids.filter((id) => {
      const line = cartLines.find((entry) => entry.id === id);
      return (CONFIGURATIONS[line.asset] || []).includes(configurationEditor.configuration);
    });
    $('#configuration-select-all').checked = compatibleIds.length > 0 && compatibleIds.every((id) => configurationEditor.selected.has(id));
    $('#configuration-status').className = 'availability-result is-available';
    $('#configuration-status').textContent = `${compatibleCount} of ${configurationEditor.ids.length} selected facilities support this review Configuration.`;
    $('#configuration-apply').disabled = configurationEditor.selected.size === 0;
  }

  function applyConfigurationUpdate() {
    if (!configurationEditor || !configurationEditor.selected.size) return;
    configurationEditor.selected.forEach((id) => {
      const line = cartLines.find((entry) => entry.id === id);
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
    const line = cartLines.find((entry) => entry.id === packageEditor.lineId);
    if (!line) return;
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

  function openPricingEditor(id, trigger) {
    openCartItemEditor('pricing', id, trigger);
  }

  function applyPricingUpdate() {
    if (!pricingEditor) return;
    const line = cartLines.find((entry) => entry.id === pricingEditor.lineId);
    if (!line) return;
    const mode = $('input[name="price-mode"]:checked').value;
    line.configuration = $('#pricing-configuration').value;
    line.pricingOption = $('#pricing-option').value;
    line.concession = $('#pricing-concession').value;
    line.priceMode = mode;
    line.priceType = mode === 'change' ? $('#pricing-type').value : 'default';
    line.pricingUnit = mode === 'change' ? $('#pricing-unit').value : null;
    line.amountPending = false;
    line.priceStatus = 'Pricing choices applied · local review fixture; formula open';
    closeCartItemEditor();
    showToast('Pricing choices applied · booking is not saved');
    updateCartUI();
  }

  function handlePrimaryAction() {
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
    if (stagedSelection) {
      const s = stagedSelection;
      if (s.asset === assetId && s.date === dk) {
        const range = slotRangeForSelection(s);
        if (slot >= range.startSlot && slot < range.endSlot) classes.push('selected-range');
      }
    }
    if (dragState && dragState.asset === assetId && dragState.date === dk) {
      const minS = Math.min(dragState.startSlot, dragState.endSlot);
      const maxS = Math.max(dragState.startSlot, dragState.endSlot);
      if (slot >= minS && slot <= maxS) classes.push('selected-range');
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
      if (line.asset !== assetId || line.date !== dk) return;
      if (editingLineId === line.id && stagedSelection) return;
      const range = slotRangeForSelection(line);
      items.push({ id: `cart-${line.id}`, kind: 'cart', source: line, startSlot: range.startSlot, endSlot: Math.min(slots, range.endSlot), order: index });
    });

    if (stagedSelection && stagedSelection.asset === assetId && stagedSelection.date === dk) {
      const range = slotRangeForSelection(stagedSelection);
      items.push({ id: 'staged-selection', kind: 'staged', source: stagedSelection, startSlot: range.startSlot, endSlot: Math.min(slots, range.endSlot) });
    }

    if (draft.created && draft.created.asset === assetId && draft.created.date === dk) {
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
    if (document.body.dataset.journey === '2') { j2RenderCalendar(); return; }
    if (document.body.dataset.journey === '4') { j4RenderCalendar(); return; }
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
      hdr.setAttribute('role', 'columnheader');
      if (dateKey(day) === dateKey(TODAY) && isCheckpointWeek()) {
        hdr.classList.add('is-today');
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

        if (slotLayout === 'stack') {
          renderStackDay(col, lane, dk);
          body.appendChild(col);
          return;
        }

        for (let slot = 0; slot < (HOUR_END - HOUR_START) * SLOTS_PER_HOUR; slot++) {
          const slotEl = document.createElement('div');
          slotEl.className = buildSlotClasses(lane.id, dk, slot);
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
          slotEl.addEventListener('mouseenter', () => onSlotMouseEnter(lane.id, dk, slot));
          slotEl.addEventListener('keydown', (e) => onSlotKeydown(e, lane.id, dk, slot));
          col.appendChild(slotEl);
        }

        EVENTS.forEach((ev) => {
          if (ev.asset !== lane.id || ev.date !== dk) return;
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
          evEl.innerHTML = `<strong>${ev.title}</strong> <span class="event-status">${ev.status}</span>`;
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

        body.appendChild(col);
      });

      laneEl.appendChild(body);
      grid.appendChild(laneEl);
    });

    updateNowLine();
    $('#date-range-label').textContent = formatRangeLabel(weekStart);
    document.body.dataset.week = isCheckpointWeek() ? 'checkpoint' : 'other';
    renderTimeslotLegend();
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
      if (isFreeSlot(assetId, dk, slot)) {
        const range = getFixtureFreeRange(assetId, dk, slot);
        createSelection(assetId, dk, range.startSlot, range.endSlot);
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
    if (!isCheckpointWeek() || slotLayout === 'stack') {
      line.hidden = true;
      return;
    }
    const slotH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slot-h') || '10');
    const header = document.querySelector('.cal-header');
    const caption = document.querySelector('.calendar-caption');
    const headerH = (header ? header.offsetHeight : 0) + (caption ? caption.offsetHeight : 0);
    const nowSlot = timeToSlot(8, 5);
    line.style.top = `${headerH + nowSlot * slotH + 36}px`;
    line.hidden = false;
  }

  function onSlotMouseDown(e, assetId, dk, slot) {
    const ev = getEventAtSlot(assetId, dk, slot);
    if (isOccupiedEvent(ev)) {
      selectUnavailable(assetId, dk, ev);
      return;
    }
    if (!isFreeSlot(assetId, dk, slot)) return;
    e.preventDefault();
    const anchor = getFixtureFreeRange(assetId, dk, slot);
    dragState = { asset: assetId, date: dk, startSlot: anchor.startSlot, endSlot: anchor.endSlot - 1 };
    const onUp = () => {
      document.removeEventListener('mouseup', onUp);
      if (!dragState) return;
      const minS = Math.min(dragState.startSlot, dragState.endSlot);
      const maxS = Math.max(dragState.startSlot, dragState.endSlot);
      dragState = null;
      createSelection(assetId, dk, minS, maxS + 1);
      renderCalendar();
    };
    document.addEventListener('mouseup', onUp);
  }

  function onSlotMouseEnter(assetId, dk, slot) {
    if (!dragState || dragState.asset !== assetId || dragState.date !== dk) return;
    if (!isFreeSlot(assetId, dk, slot)) return;
    dragState.endSlot = slot;
    renderCalendar();
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
        if (dialog.id === 'cart-item-editor-dialog') closeCartItemEditor();
        else if (dialog.id === 'j4-details-dialog') {
          e.preventDefault();
          j4CloseDetails(true);
        } else {
          dialog.close();
          restoreFocus();
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

  function init() {
    const isJ2 = document.body.dataset.journey === '2';
    const isJ3 = document.body.dataset.journey === '3';
    const isJ4 = document.body.dataset.journey === '4';
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
        showToast(isJ4 ? 'Maintenance is outside the Journey 4 review fixture.' : 'Maintenance is not Journey 1');
      });
    });

    $('#cfg-item').addEventListener('change', updateConfigureForm);
    $('#cfg-package').addEventListener('change', updateConfigureForm);
    $('#cfg-configuration').addEventListener('change', renderCurrentSelectionSummary);
    $('#cfg-concession').addEventListener('change', renderCurrentSelectionSummary);

    $('#current-selection-details-toggle').addEventListener('click', (event) => {
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
        const line = cartLines.find((entry) => entry.id === id);
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
      if (dialog && dialog.open) dialog.close();
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
      else playJourney();
    });
    $('#btn-play-complete').addEventListener('click', () => {
      if (document.body.dataset.journey === '2') j2PlayComplete();
      else if (document.body.dataset.journey === '3') j3PlayComplete();
      else if (document.body.dataset.journey === '4') j4PlayComplete();
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

    ['#mismatch-dialog', '#remove-dialog', '#clear-dialog', '#date-picker-dialog', '#cart-item-editor-dialog', '#j4-details-dialog'].forEach((sel) => {
      trapDialogFocus($(sel));
    });

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
    if (isJ4) j4SetupEvents();
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
    } else {
      loadTimeslotVisualOptions().then(() => resetJourney());
    }
  }

  function boot() {
    const journey = applyJourneyBoot();
    applyJourneySurfaces(journey);
    closeAllJourneyOverlays();
    if (journey === 2) {
      document.title = 'Optimo Diary — Journey 2 Master-Ancestry Candidate';
      const pickerInput = $('#picker-input');
      if (pickerInput) pickerInput.value = '2026-09-04';
    } else if (journey === 3) {
      document.title = 'Optimo Diary — Journey 3 Asset Search, Hierarchy and Selection';
    } else if (journey === 4) {
      document.title = 'Optimo Diary — Journey 4 Timeslot Rendering and Calendar Interaction';
    }
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
