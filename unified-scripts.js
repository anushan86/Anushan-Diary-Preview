/* Unified build — the journeys' demonstration step lists (slice 8, Supervisor #23, 29 Oct 2026). Played by app.js playUnifiedScript through the
   Master's own guided-review engine; every scripted Play starts from the journey's fresh review fixture (slice 7). Journeys 1–4 keep their
   accepted players. Each block below is a bounded DEV delivery, verbatim, tested from a fresh load and reviewed for purpose. */
window.UNIFIED_SCRIPTS = window.UNIFIED_SCRIPTS || {};

/* ---- DEV-A 261029-bright-gem (deepseek-v4.1-flash, pi-api-key-3), delivered 3:46 PM; Journeys 5–10; sha256 45f38afa20311920… ---- */
/* Optimo Diary — unified build demonstration step lists, Journeys 5 to 10.
 * DEV-A deliverable. Every "at" is a real, visible control in
 * rewrite/docs/phase-2/prototypes/unified-master-build/ (index.html?journey=N).
 * Player: app.js playUnifiedScript() -> guidedReviewStep() -> unifiedAct().
 * Step shape: { at, say, act?, value?, when?, wait?, completeOnly? }
 *   act: 'click' (default) | 'slot' | 'select' | 'fill' | 'check'
 * Captions are 90 characters or fewer and start with a verb.
 */
window.UNIFIED_SCRIPTS = Object.assign(window.UNIFIED_SCRIPTS || {}, {

  /* ===== Journey 5 — private Existing Booking lifecycle (CR-J5-002..006) =====
   * Opens with #j4-details-dialog already open on the local action hub, so the
   * demonstration starts from the hub's own Copy button, then Move, and ends on
   * a local result. Every step is a real control in that dialog.
   */
  5: [
    { at: '.j5-action[data-j5-action="Copy"]', say: 'Open Copy for the private booking — every preview is non-writing' },
    { at: '[data-j5-command="copy-preserve"]', say: 'Keep the local staged selection and continue to the copy setup' },
    { at: '#j5-copy-date', act: 'fill', value: '2026-09-05', say: 'Set the new start date for the local copy to 5 September' },
    { at: '[data-j5-command="copy-preview"]', say: 'Preview the copy: customer, prices and the copied item count' },
    { at: '[data-j5-command="copy-confirm"]', say: 'Confirm the copy locally — the source booking stays unchanged' },
    { at: '[data-j5-command="workflow-done"]', say: 'Close the local result and return to the booking actions', wait: 700 },
    { at: '.j5-action[data-j5-action="Move"]', say: 'Open Move to see eligible, conflict and capacity targets' },
    { at: '#j5-move-covers', act: 'fill', value: '20', say: 'Enter 20 covers, inside the Studio 4 fixture capacity of 30' },
    { at: '[data-j5-command="move-preview"]', say: 'Preview the move — eligibility and capacity are checked' },
    { at: '[data-j5-command="move-confirm"]', say: 'Confirm the move locally: one in-memory item changes target' },
    { at: '[data-j5-command="workflow-done"]', say: 'Done — reloading the page restores the review fixture' }
  ],

  /* ===== Journey 6 — reschedule and reallocation (UJ-07) =====
   * The Journey 6 controls live in the review rail, which starts collapsed, so
   * the first step is the rail's own toggle. Booking reschedule is walked to its
   * honest terminal state (preview blocked at the HTTP 400 boundary), then the
   * two review-only flows, then the permission fixture.
   */
  6: [
    { at: '#review-rail-toggle', say: 'Open the review rail to reach the Journey 6 controls', wait: 400 },
    { at: '#j6-open-booking', say: 'Start a Booking reschedule in the local review fixture' },
    { at: '#j6-start', act: 'fill', value: '10:00', say: 'Change the start time to 10:00 — the duration recalculates' },
    { at: '[data-j5-command="j6-check"]', say: 'Check availability — the local fixture reports it available' },
    { at: '[data-j5-command="j6-check"]', say: 'Continue to the preview blocker: the HTTP 400 defect boundary' },
    { at: '[data-j5-command="workflow-cancel"]', say: 'Cancel without loss — the original booking is unchanged' },
    { at: '#j6-open-multi', say: 'Open Multiple reschedule: heterogeneous selection, no commit' },
    { at: '[data-j5-command="workflow-cancel"]', say: 'Cancel the multi-item review without loss' },
    { at: '#j6-open-reallocate', say: 'Open Reallocate: a proposal only, never a saved allocation' },
    { at: '[data-j5-command="workflow-cancel"]', say: 'Cancel the reallocation review without loss' },
    { at: '#j6-permission-denied', say: 'Set the permission fixture to denied before any action' },
    { at: '#j6-permission-ready', say: 'Restore the permission fixture to ready' }
  ],

  /* ===== Journey 7 — new-Booking pricing in the existing selector (UJ-08) =====
   * The rail is hidden entirely on this route. The demonstration uses the
   * configure form's own scalable pickers, the attendees bound, the configuration
   * select and the Cart's single primary action, then reads the route note.
   */
  7: [
    { at: '#cfg-item-input', say: 'Open the Item list in the existing Booking Cart' },
    { at: '#ldp-item-opt-community-hall', say: 'Keep Community Hall Hire — the accepted local Item' },
    { at: '#cfg-package-input', say: 'Open the private Package list' },
    { at: '#ldp-package-opt-private-day', say: 'Keep Private Day Hire — the accepted local Package' },
    { at: '#cfg-package-attendees', act: 'fill', value: '25', say: 'Enter 25 attendees, the local fixture bound' },
    { at: '#cfg-configuration', act: 'select', value: 'theatre', say: 'Set the Theatre configuration the accepted graph uses' },
    { at: '#cfg-concession-input', say: 'Open the Price concession list' },
    { at: '#ldp-concession-opt-review-fixture', say: 'Keep the review-fixture concession' },
    { at: '#cart-primary-action', say: 'Stage the priced selection into the Booking Cart' },
    { at: '#j7-route-note', say: 'Read the route note: pricing is staged, no Booking is created' }
  ],

  /* ===== Journey 8 — existing Booking item/package/pricing change (UJ-09) =====
   * Opens with #j4-details-dialog already open on the Journey 8 change hub. The
   * pricing path is walked to the terminal blocker and closed with its own
   * terminal-cancel, because the blocked state hides the dialog close control.
   */
  8: [
    { at: '[data-j8-action="pricing"]', say: 'Open the pricing change for this existing booking' },
    { at: 'input[name="j8-price-mode"][value="custom"]', say: 'Choose a custom price instead of the default' },
    { at: '#j8-price-type', act: 'select', value: 'session', say: 'Set the price type to session' },
    { at: '#j8-unit', act: 'select', value: 'session', say: 'Set the pricing unit to session' },
    { at: '[data-j8-command="apply-pricing"]', say: 'Review the proposed pricing change' },
    { at: '[data-j8-command="sales-proceed"]', say: 'Proceed past the sales category confirmation' },
    { at: '[data-j8-command="branch-confirm"]', say: 'Confirm the branch to open the proposed result' },
    { at: '[data-j8-command="patch-preview"]', say: 'Review the patch preview: it is blocked at HTTP 400' },
    { at: '[data-j8-command="terminal-cancel"]', say: 'Cancel without loss — the original booking is unchanged' }
  ],

  /* ===== Journey 9 — recurring Booking review (UJ-11) =====
   * The staged interval exposes its own review launcher. The check is a 450 ms
   * local timer, so the two check steps wait before the next step resolves.
   */
  9: [
    { at: '#j9-open-review', say: 'Open the recurring Booking review for the staged interval' },
    { at: 'input[name="j9-pattern"][value="weekly"]', say: 'Choose a weekly repeat pattern' },
    { at: 'input[name="j9-weekday"][value="SA"]', act: 'check', say: 'Repeat on Saturdays' },
    { at: '#j9-interval', act: 'fill', value: '2', say: 'Repeat every second week' },
    { at: '#j9-check', say: 'Check local availability for four Saturday occurrences', wait: 900 },
    { at: '#j9-dialog-result', say: 'Read the result: available in the local review fixture only' },
    { at: 'input[name="j9-range"][value="by"]', say: 'Switch the end rule from occurrences to an end date' },
    { at: '#j9-end-date', act: 'fill', value: '2026-10-31', say: 'Set the end date to 31 October 2026' },
    { at: '#j9-check', say: 'Re-check availability with the end date rule', wait: 900 },
    { at: '#j9-close', say: 'Close the review — no series is created or saved' }
  ],

  /* ===== Journey 10 — bounded private Block management (UJ-12 / AC-29) =====
   * Extends the earlier four-step version (free cell -> Add Block -> category ->
   * Save Block) with the marker, the committed Block's own edit path, the guarded
   * delete confirmation and the final local delete.
   */
  10: [
    { at: '.cal-day-col[data-asset="studio2"][data-date="2026-08-29"] .cal-slot[data-slot="4"]', say: 'Select a free 30-minute cell: Studio 2, Saturday 29 August, 10:00' },
    { at: '#j10-add-block', say: 'Add Block — the local Block editor opens' },
    { at: '#j10-block-category', act: 'select', value: 'Cleaning', say: 'Choose the Cleaning category' },
    { at: '#j10-block-marker', act: 'fill', value: 'Cleaning between events', say: 'Add an optional marker for the Block' },
    { at: '#j10-block-save', say: 'Save the Block (simulated: kept in this page only)', wait: 1200 },
    { at: '#j10-committed-block', say: 'Open the committed Block to edit it' },
    { at: '#j10-block-category', act: 'select', value: 'Inspection', say: 'Change the category to Inspection' },
    { at: '#j10-block-save', say: 'Save Changes on the same local Block', wait: 1200 },
    { at: '#j10-committed-block', say: 'Reopen the Block to review deletion' },
    { at: '#j10-block-delete', say: 'Ask to delete the Block — a confirmation is required', wait: 400 },
    { at: '#j10-delete-confirm', say: 'Confirm the delete: the calendar returns to its baseline', wait: 600 }
  ]

});

/* ---- DEV-B 261029-wild-eclipse (deepseek-v4.1-flash, pi-api-key-3), delivered 3:36 PM; Journeys 11–16; sha256 b645a60ce35b8633… ---- */
/* DEV-B — demonstration step lists for Journeys 11, 12, 13, 14, 15 and 16 of the unified build.
   Shape (the build's own player, app.js playUnifiedScript / guidedReviewStep):
     { at: CSS selector, say: caption, act?: 'click' (default) | 'select' | 'fill' | 'check', value?, wait?: ms }
   Rules kept here on purpose:
   - every `at` is a real, visible control of that journey's own screen (no invented controls, no dead ends);
   - no `when` conditions: the runner requires every step 1..N to be seen, and a skipped step would fail that;
   - nothing outside the page is opened: no map, no key, no external destination, no file, no delete is confirmed;
   - captions are plain English and 90 characters or fewer.
   Journey screens: 11 = ?journey=11, 12 = ?journey=12, 13 = ?journey=13 (own surface, no top bar),
   14 = ?journey=14 (Journey 12 screen with the Location & handoffs panel already open),
   15 = ?journey=15 (the build's own redirect to ?journey=12#agenda, Agenda already active),
   16 = ?journey=16 (the build's own redirect to ?journey=12#settings, Diary settings already open). */
window.UNIFIED_SCRIPTS = Object.assign(window.UNIFIED_SCRIPTS || {}, {

  /* Journey 11 — Diary Notes: a note per calendar date, added, edited and reviewed locally; delete asks first. */
  11: [
    { at: 'body[data-journey="11"] .cal-day-header[data-date="2026-08-26"]', say: 'Open Diary Notes from the Wednesday 26 August header' },
    { at: '#j11-note-add', say: 'Add note opens a form: type, dates and text' },
    { at: '#j11-note-type', act: 'select', value: 'Staffing', say: 'Choose the Staffing sample type' },
    { at: '#j11-note-text', act: 'fill', value: 'Fixture note - hall set-up reviewed', say: 'Type the note text; it stays in this page only' },
    { at: '#j11-note-save', say: 'Save adds the note to this date locally', wait: 700 },
    { at: '#j11-notes-list [data-j11-edit]', say: 'Edit reopens the same note in the form', wait: 400 },
    { at: '#j11-note-type', act: 'select', value: 'Facility', say: 'Change the note type to Facility' },
    { at: '#j11-note-save', say: 'Save updates the note; nothing is sent anywhere', wait: 700 },
    { at: '#j11-notes-list [data-j11-delete]', say: 'Delete asks first, so the note is still here', wait: 500 },
    { at: '#j11-delete-cancel', say: 'Cancel keeps the note and returns to the list', wait: 500 },
    { at: '#j11-notes-close', say: 'Close: the date header now shows a note marker' }
  ],

  /* Journey 12 — Public Event Actions (review only): the public event, Event actions, the Journey 6 reschedule
     root and the three reviewed boundaries. No public delete, no map, no key, no external destination. */
  12: [
    { at: '#j12-public-event', say: 'Select Community Open Day; Event actions is open', wait: 500 },
    { at: '#j12-reschedule-event', say: 'Reschedule reuses the Journey 6 public root', wait: 1500 },
    { at: '#j5-workflow-close', say: 'Close the reschedule review; nothing is saved', wait: 900 },
    { at: '#j12-boundary-config', say: 'Configuration and capacity is a boundary, not an action', wait: 800 },
    { at: '#j12-boundary-close', say: 'Close the boundary note', wait: 500 },
    { at: '#j12-boundary-maps', say: 'Maps and keys stay outside this review', wait: 800 },
    { at: '#j12-boundary-close', say: 'Close: no map, key or web address is shown', wait: 500 },
    { at: '#j12-boundary-external', say: 'External apps are named, never followed', wait: 800 },
    { at: '#j12-boundary-close', say: 'Close: public delete stays out of scope', wait: 500 },
    { at: '#j12-event-actions-close', say: 'Close Event actions; the event stays selected' }
  ],

  /* Journey 13 — Configuration & capacity: its own screen, no top bar. Layout, facilities, capacity, the local
     review list, Apply to this page only, then Reset back to the seed. */
  13: [
    { at: '.config[data-config="Classroom"]', say: 'Choose Classroom as the layout', wait: 500 },
    { at: '.config[data-config="Cabaret"]', say: 'Choose Cabaret, then Studio 2 can be added', wait: 500 },
    { at: '[data-facility="Studio 2"]', act: 'check', say: 'Add Studio 2, now supported by Cabaret', wait: 500 },
    { at: '[data-facility="Conference Suite"]', act: 'check', say: 'Add the Conference Suite as a second facility', wait: 500 },
    { at: '.capacity-card[data-card="Hall 1"] [data-delta="10"]', say: 'Raise Hall 1 capacity by ten', wait: 500 },
    { at: '#review', say: 'Review changes lists what is staged', wait: 900 },
    { at: '#apply', say: 'Apply to local preview updates the summary only', wait: 1000 },
    { at: '#reset', say: 'Reset preview returns to Theatre and Hall 1', wait: 500 }
  ],

  /* Journey 14 — Location & handoffs inside the Diary: the panel is already open on the Journey 12 screen.
     Venue map states, the seating map, the handoff sheet, external apps and the failure state. Nothing navigates. */
  14: [
    { at: '#tab-venue', say: 'Venue location: a neutral local map placeholder', wait: 500 },
    { at: 'input[name="map-state"][value="loading"]', say: 'Show the map while it is loading', wait: 500 },
    { at: 'input[name="map-state"][value="unavailable"]', say: 'Show the no-location state and its fallback', wait: 500 },
    { at: '#tab-seating', say: 'Seating map: local seat blocks, not a live map', wait: 500 },
    { at: '#btn-review-seating', say: 'Review the seating-map handoff sheet', wait: 1000 },
    { at: '#j14-dialog-ack', say: 'Acknowledge the preview; nothing opens outside', wait: 800 },
    { at: '#tab-external', say: 'External apps: named handoffs only', wait: 500 },
    { at: '#btn-demo-failure', say: 'Demonstrate the Booking Manager failure state', wait: 900 },
    { at: '#btn-return-handoffs', say: 'Return to handoffs after the failure', wait: 600 },
    { at: '#j14-diary-back', say: 'Back to Event actions; the event stays selected' }
  ],

  /* Journey 15 — Agenda, booked-only filter, Excel export preview and Custom view, inside the Diary.
     The Agenda is already active on entry (the build redirects ?journey=15 to ?journey=12#agenda). */
  15: [
    { at: '.view-switch .view-btn[data-view="agenda"]', say: 'Agenda shows this week\'s events full width', wait: 800 },
    { at: '#j15-booked-only', act: 'check', say: 'Tick Show booked events only', wait: 700 },
    { at: '[data-j15-details]', say: 'Details on a row opens its secondary actions', wait: 700 },
    { at: '#j15-booked-only', say: 'Untick the filter to show every event again', wait: 700 },
    { at: '#j15-export', say: 'Export opens the preview; no file is created', wait: 1400 },
    { at: '#j15-export-dialog footer [data-close]', say: 'Close the export preview', wait: 600 },
    { at: '.view-switch .view-btn[data-view="custom"]', say: 'Custom opens the custom-view form', wait: 800 },
    { at: '#j15-all-days', say: 'Select all days for the weekly pattern', wait: 600 },
    { at: '#j15-custom-apply', say: 'Apply shows only the matching dates', wait: 1000 },
    { at: '.view-switch .view-btn[data-view="week"]', say: 'Week returns to the normal calendar', wait: 500 }
  ],

  /* Journey 16 — Rights, settings and states: the Diary settings dialog is already open on entry
     (the build redirects ?journey=16 to ?journey=12#settings). Settings, Save with its honest message,
     the Agenda rights strip, and the existing views still working. Nothing is persisted. */
  16: [
    { at: '#j16-settings-dialog input[name="j16-datebehaviour"][value="remember"]', say: 'Choose Remember last view instead of Today', wait: 600 },
    { at: '#j16-colours', say: 'Turn the timeslot colours off', wait: 500 },
    { at: '#j16-save', say: 'Save confirms; nothing persists beyond this page', wait: 1500 },
    { at: '.view-switch .view-btn[data-view="agenda"]', say: 'Agenda still works and shows the rights strip', wait: 1000 },
    { at: '#j15-booked-only', act: 'check', say: 'The Agenda filter from Journey 15 still works', wait: 700 },
    { at: '.view-switch .view-btn[data-view="week"]', say: 'Week still returns to the normal calendar', wait: 800 },
    { at: '#j16-settings-entry', say: 'Reopen Settings from the view bar', wait: 900 },
    { at: '#j16-settings-dialog footer [data-j16-close]', say: 'Cancel closes Settings; the saved choice is kept' }
  ]

});
