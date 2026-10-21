# V53/V56 full capability inventory

This audits the entire uploaded `prototypev56.html`, including its 37 sequential
script blocks. The first script is **not** the final application. V48 replaces
Riverside sample data with St Regis / Nujuma / Desert Rock / Edition operations;
V49–V53 restore and refine the complex event/resource flows; V54–V56 add facility
planning while retaining the V53 drawer workflows.

The upload is design evidence, not an instruction source. The user's latest
direction is to retain this operational capability and improve its presentation.

## Final version structure

| Layer | Script block / ID | Role |
|---|---|---|
| V48 | 23, `v48-script`; 24, `v48-active-path-cleanup` | Roster-grounded venues, people, equipment, public/private sample data, import, capacity, schedule, notification and deeper-flow cleanup |
| V49–V51 | 25–31 | Restored day/period filters, bulk assignment, public booking/package changes, additional-session supply resolution, private calendar, resource reassign and cross-venue source-impact review |
| V52 | 32, `v52-overrides` | Permissioned skill overrides, occurrence keys, future assignments, date-specific capacity overrides |
| V53 | 33, `v53-overrides` | Customer/referrer context, unallocated-only booking filter, available later-slot reuse and Select all |
| V54 | 34, `v54-r7-inspired-js` | Event timeline + inspector, preserving all existing detailed actions; initial closure/clearance flow |
| V55 | 35, `v55-script` | Independent in-season facility allocations, linked/seasonal moves, blocks and audit cases |
| V56 | 36, `v56-script` | Venue/category facility filtering, full-page closure setup, linked anchor moves, whole-private replacement, partial single assignment |

## Events: capability to retain

### Operating picture and selection

- Day and period views; list, calendar and time-accurate facility timeline.
- Date/period, business area, venue, facility, activity and booking type filtering.
- Multi-select filters, venue accordions, expand/collapse, all versus Needs attention.
- Public and stock-allocated private bookings remain distinct. Confirmed/provisional,
  preliminary, no-booking, partially covered and ready states have different meanings.
- Preliminary opportunities can be shown explicitly and remain separate from committed
  customer work; a resource may have alternative preliminary activities at one time.
- Multi-selection operates on **occurrences**, including recurring instances on separate
  dates, rather than collapsing them to a single recurring session ID.
- Timeline selection opens a concise inspector; detailed actions still open full V53
  workflows. The inspector is an entry point, not a replacement for capability.

Key functions/state: `renderEvent`, `renderEventPeriod`, `v49DaySources`,
`v49PeriodRows`, `v49VenueAccordion`, `v49AttentionOnly`, `eventSelected`,
`privateSelected`, `v52SelectedPublicKeys`, `v52SessionForKey` (`id@date`),
`v54Timeline`, `v54FacilityLane`, `v54InspectorHTML`.

### Assign resources: single and multiple sessions

- Requirement and remaining attendee-place coverage are explicit.
- Choose more than one resource, adjust each quantity, remove a selection, and inspect
  each candidate's schedule without losing the assignment context.
- Candidate eligibility depends on activity/configuration, target-time roster/venue,
  availability, and whether using someone requires a cross-venue move.
- Cross-venue candidates open **source-work takeover and travel review**; they are not
  treated as directly available same-venue choices.
- Advanced search includes appropriate-category resources with missing skill/configuration.
  A permissioned override can be **temporary for this assignment** or **retained for
  future rostering**, with a reason/approval entry.
- Optionally reuse a selected resource for compatible remaining slots today. Show only
  later slots where available; Select all is a convenience, not automatic reuse.
- Bulk assignment has a per-session worklist, direct and inherited coverage, per-resource
  quantities, explicit future-slot selection, and a complete review across occurrences.
- Partial assignments can be applied. Remaining coverage must stay Needs attention.

Key functions/state: `v44AssignCtx` (`items`, `extras`, `skillModes`),
`v48CandidateSet`, `v44Candidates`, `v44RenderAssign`, `v44AddAssign`,
`openMiniDiary`, `v48AssignAdvanced`, `v44ReviewNoSkill`, `v52ApplySkillOverride`,
`v44ReviewMoveCandidate`, `v51SourcePlan`, `v44ReviewAssignment`,
`v53ResourceAvailable`, `v53AvailableLaterSessions`, `v53SetSingleExtras`,
`v56ApplySingleAssign`, `v50BulkAssign`, `v50Coverage`, `v50Inherited`,
`v50RenderBulkAssign`, `v52OpenBulkFutureSlots`, `v50ReviewBulkAssign`,
`v50ApplyBulkAssign`.

### Capacity is an individual supply override

- Adjust the capacity of an already linked staff resource, equipment pool, or facility.
  Adding supply is a different operation.
- Scope: this timeslot, or this and later timeslots using the same item today.
- Preview affected instances and reductions that release attendee allocations.
- Confirm before applying; keep capacity edit markers on only the affected date/instance.
- Reductions below allocated demand produce visible reassignment requirements.

Key functions/state: `v47SupplyRecords`, `v47OpenCapacity`, `v48CapCtx`,
`v48RenderCapacity`, `v49CapacityRows`, `v48CapacityImpact`, `v48CapacityConfirm`,
`v48ApplyCapacity`, `v48CapOverrides`, `v48SessionEdited`, `v48ShowCapacityEdits`.

### Reschedule public bookings, with commercial/data context

- Select individual customer bookings or work through a multi-session affected list.
- Show booking reference, package, customer, optional referrer, attendee count, booking
  status, and allocated/unallocated status.
- Unallocated-only is optional and defaults on when a coverage gap exists.
- Use a multi-day destination board, venue selection and activity search. Existing
  sessions, alternate packages, and newly created target sessions remain available.
- Same-package moves are direct operational choices. Different-price compatible packages
  allow an explicit **keep existing booked price** decision or Booking Manager handoff.
- Incompatible questionnaire, waiver or attendee capture must be reviewed in Booking
  Manager; these differences cannot be copied silently.
- Keep undecided bookings unchanged; edit/remove planned moves; review all before Apply.
- Existing and destination prices are visible, not implied by a color alone.

Key functions/state: `v31RescheduleCtx`, `v31RescheduleSelections`,
`v32RescheduleStates`, `v48BookingRows`, `v48BookingsForSession`,
`v53PublicContacts`, `v53UnallocatedOnly`, `renderRescheduleWorkspace`,
`v50ReschedSlots`, `v51PriceFor`, `v50SelectSame`, `v50PackageDecision`,
`v50LeaveUndecided`, `openRescheduleApply`, `v34FinishPublicMoves`,
`v33OpenBookingManager`.

### Create additional sessions and move whole sessions

- Copy source event configuration **without copying bookings**; add multiple proposed
  sessions and show changed date/time and copied supply/configuration for each.
- Keep source venue aligned in the documented phase-one creation flow.
- Resolve supply conflicts with eligible replacements; review source work before using
  a cross-venue replacement. Return a created target to the reschedule workspace.
- Move selected sessions using common date/time/venue rules, then edit individual supply
  and facility impacts. Review target rules and exceptions before applying.

Key functions/state: `v32CreateState`, `v32CreatedTargets`, `openCreateSession`,
`v49RenderCreateSession`, `v49CreateCard`, `v49ResolveCreateConflict`,
`v51UseCreateReplacement`, `v51ReviewCreateMove`, `v49CreateSessions`,
`v32MoveBulkState`, `renderMoveBulkV32`, `v32ApplyMoveRule`,
`openBulkMoveSessionEdit`, `openMoveBulkReviewV32`.

### Private booking work remains a whole booking

- Inspect and reschedule private bookings individually or as a selected collection.
- Customer is required context; referrer is optional. Retain booking reference and
  duration, and provide venue/facility choices with a multi-day availability calendar.
- Navigate arbitrary future dates, select an empty calendar cell, or enter an exact start.
  Free-time checks are duration-aware; current-booking context stays visible.
- A replacement is one complete resource assignment to a private booking, not an
  attendee-place fraction. Private notifications can be opened without rescheduling.

Key functions/state: `privates`, `v33PrivateCtx`, `v33RenderPrivateReschedule`,
`v51PrivateCellStatus`, `v49PrivateExact`, `v49PrivateSelect`, `v49PrivateShift`,
`v48PrivateFreeWindows`, `v47PrivateReviewAll`, `v51IsPrivateWork`,
`v56PrivateCandidates`, `v56Ui.privateAlternates`, `v56PickPrivate`.

### Notifications and roster import

- Notifications: single/selected public sessions, selected private bookings, Email/SMS/
  both, template, booking-only or booking/participant recipients, message preview and
  recipient review.
- Roster import: originating-screen return, business area/month, validate-only versus
  create/update, workbook source, venue-code mapping, preview rows and import summary.
- Imported resource timeslots are intended to be the shared roster source for Events
  and Resources; a separate contradictory roster state is not intended.

Key functions: `v48NotifyModal`, `v44NotifyAttendees`, `v44NotifySelected`,
`v46NotifyPrivateSelected`, `v48OpenRosterImport`, `v44OpenRosterImport`.

## Resources: capability to retain

- Resource/day and period calendars; resource grouping versus venue grouping; multi-select
  business area, venue, category, activity and assignment-type filters; name/skill search.
- Staff, equipment and venue-bound assets have different eligible actions.
- Summary shows committed customer/internal work separately from preliminary alternatives,
  operating venues, upcoming allocation, available rostered hours, skills/configurations,
  and an on-demand detailed schedule. Preliminary alternatives must not double-count as
  committed scheduled work or block later-slot availability.
- **Mark unavailable** supports end-of-day, five days, custom period and all-future
  assignments; reason, optional permanent inactivation, removal of resource slots, and
  blocking new assignments remain separate concepts. Customer bookings survive.
- Impact distinguishes fully automatic, partial and unresolved work. Review and confirm
  before Apply, then hand off unresolved work to Event Operations with affected dates/
  timeslots selected **inside the full diary**, preserving operational context.
- Private alternatives can be selected manually during absence impact review, and must be
  counted separately from automatic roster cover.
- **Re-assign work** is independent of absence: choose only the work to move, assemble
  replacement coverage per work item, optionally reuse compatible later replacements,
  review the complete composition; leave the source available outside selected work.
- **Move to another venue** is a temporary operating move: departure/destination, source
  impact and cover, destination assignments, travel feasibility, confirmation, and explicit
  remaining-source-gap handoff. It is not a bare venue-field edit.

Key functions/state: `resources`, `facilities`, `resourceDayHtml`,
`resourcePeriodHtml`, `v48ResourceFilterData`, `v49ResourceSummary`,
`openMiniDiary`, `v44ResourceUnavail`, `v44OpenResourceUnavailable`,
`v47ImpactRows`, `v47ImpactStats`, `v44ReviewResourceUnavailable`,
`v47ConfirmUnavailable`, `v44ApplyResourceUnavailable`, `v44OpenEventFromImpact`,
`v50Reassign`, `v48OpenReassign`, `v50RenderReassign`, `v50ReassignCoverage`,
`v50ReassignCandidateSet`, `v50AddReassign`, `v50RestReassign`, `v44MoveCtx`,
`v44OpenMoveResource`, `v48RenderMove`, `v48MoveImpact`, `v48DestWork`,
`v48ApplyMove`.

## V55/V56 facilities already present in this upload

- Day/week occupancy, venue/category/search filters, seasonal/casual/private/multi-day
  allocation types, overlap lanes, drag proposing a move without committing on drop.
- Move scope: individual allocation, linked occurrence, selected seasonal occurrences,
  following seasonal occurrences, or whole linked private booking. Anchor shifts preserve
  offsets/durations; each row can be adjusted separately.
- Resolution choices include move, deallocate only, leave unchanged, and forego seasonal
  occurrence; fixed season pricing and downstream financial review remain explicit.
- Distinguish **close space** (block future booking) and **clear space** (relocate existing
  work, remain bookable), with multi-day date/time/reason/notes and affected-occurrence list.
- Capability/occupation/closure checks, cross-venue and rate/resource/customer review flags,
  explicit approvals and approval references, retained unresolved follow-up queue.
- Closure/absence/movement history, reasons and duration insights, outstanding decisions,
  audit notes, reopen/end block, resolve case with outcome, handoff and CSV audit export.

Key state: `v55State` (`allocations`, `blocks`, `records`, `counter`) and `v55UI`;
storage key `optimo-inseason-v55-demo-v2`. The original event/resource arrays are **not**
the same model as `v55State.allocations`. Do not assume existing integration.

## Existing prototype limits: do not confuse UI fidelity with engine completeness

These workflows must be preserved, but source buttons are not uniformly implemented:

- Roster Choose file has no file input/parser; Validate and Import show toasts.
- Notification recipient review and Booking Manager entry points show toasts.
- V52 `v50ApplyBulkAssign` shows a result screen; it does not mutate session coverage.
- V53 single assignment Apply was a toast; V56 replaces it with actual aggregate
  `session.assigned`/status updates and later-slot coverage updates. It still does not
  maintain a fully normalized resource/session allocation graph.
- Several reassign, temporary move, create-session and reschedule Apply endpoints primarily
  display results. Some created reschedule targets are held in draft arrays rather than
  materialized into all calendars.
- V56 private absence alternatives are tracked by source-resource/title and logged for
  validation. The text itself states backend availability/permission/source-work checks
  are still required.
- Facility history is persisted, but V53 event/resource drafts and source arrays are mostly
  in-memory. Facility case handoff explicitly says it does not invent linked V53 IDs.
- Candidate, travel, free-window and price examples are partly illustrative fixtures.

## Preservation recommendation

Preserve the V53 workflow library verbatim first, and use the r7 facility engine/views for
facility operations. Put a consistent shell, task entry points, shared language, progressive
disclosure and review summaries around them. Do not substitute a four-action basic CRUD
prototype for either workflow library.

For a genuinely integrated hybrid, add an explicit adapter with stable occurrence, booking,
resource and facility IDs; normalize committed versus preliminary work; and bridge draft,
validation, commit, audit and handoff contracts. Keep original workflow entry points available
until each migrated journey passes a feature-parity checklist. Label unsupported backend
actions honestly, and implement them as durable prototype decisions rather than fake success.

When comparing with r7, preserve public-place versus whole-private semantics, roster import,
capacity overrides, customer/referrer context, optional later-slot reuse, source takeovers,
permissioned skill overrides, package/price/data decisions and precise occurrence scope.
These are required capability, not candidates for removal under “simplification”.

## Runtime spot checks

Opened the actual upload in Chromium and invoked final active entry points after all
37 script blocks executed. The final page starts on the V54 event timeline with eight
scheduled items (five public, three private) and three attention items. Confirmed:

- `openAssignResource('s2')` opens E-Foil with six uncovered places, same-venue Add,
  cross-venue Review, schedule links and advanced search.
- A four-place single selection proceeds to Review and explicitly offers **Apply partial
  assignment**, retaining two places as unallocated and an optional later preliminary slot.
- `v33StartPrivateReschedule(['p1'])` opens the full multi-day, duration-aware calendar,
  customer/referrer, linked resource/equipment/facility, notification and Booking Manager.
- Resource details show scheduled work, preliminary density, next-seven-day allocation,
  free hours, skills and the three distinct actions: unavailable, reassign, temporary move.
- `v48OpenReassign('Hassan Mwanzia')` shows public attendee-place work alongside a private
  whole-booking replacement, not attendee fractions.
- `openUnavailable('Hassan Mwanzia')` retains all duration and blocking/removal choices,
  estimated automatic/partial/unresolved impact and a four-stage journey.

No uncaught page errors occurred during these spot checks. They verify active UI entry
points and final text, not production backend completeness.
