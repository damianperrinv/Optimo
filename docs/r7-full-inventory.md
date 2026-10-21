# r7 capability inventory: preserve the rules, improve the interaction

Source: the complete uploaded `optimo-operations-r7.html`, including all 17
script blocks. This is an inventory of the final registered UI and engine APIs,
not a proposal to replace advanced workflows with a smaller demonstration.

## Implementation baseline

The upload already contains two substantial rule engines and their screens:

- `E` / `ST`: Facilities round 6c, with 132 exported functions.
- `O` / `OS`: Events and Resources round 7, with 189 exported functions. Its
  resource screens explicitly follow V53's resource day/week/person calendars.
- 26 registered views and 321 registered UI actions are present in the final page.
- `UI`, `VIEWS`, `ACT`, `TITLES`, `MODALS`, `AREAS`, `NAV_*`, `CORE_HOOKS`, and
  `UI_DEFAULTS` are the extension contracts. UI actions invoke the engines; screen
  builders read the engines' model and wording rather than inventing decisions.

Important boundary: Facilities uses Ridgeway Shire Council (`rsc`); Events and
Resources use RSG Resorts (`rsg`). They have separate datasets, state, plans,
history and localStorage keys (`optimo-fac6` / `optimo-ops7`). They share a clock.
Moving between these areas switches the organisation. A new common navigation
shell does not make their allocations one integrated operational model.

## Facilities: all capabilities to retain

| Capability | Existing UI / engine entry points | Decision detail that must survive |
| --- | --- | --- |
| Venue/space occupancy board | `VIEWS.board`, `E.boardDay`, `E.boardWeek` | Day and week views, venue filter, space/hirer search, spaces grouped by venue, booking type colors, applied closures, held and pending work, needs-action flags |
| Drag a booking part | `DRAG.kinds.blk`, `E.dragCheck`, `E.dropAsk`, `E.boardDrop` | Snap/fit checking, clear refusal reason, same-day related parts, linked staff/equipment, changed price, seasonal scope, explicit pending result rather than immediate commit |
| Multi-part booking scope | `E.dropAsk`, `E.partInfo`, `E.partLines`, `E.tick`, `E.putBack` | Move a selected part or other parts too; shared times/locations, relative offsets, parts already in the plan, parts staying at another venue, consequences for linked resources |
| Recurring/seasonal booking scope | `E.dropAsk`/`seriesInfo`, `E.boardDrop` | One date versus other seasonal dates, conflicts on individual dates, follow-up for the rest of a season beyond loaded data |
| Close a space or clear bookings out | `VIEWS.close`, `CLOSURE.draft`, `E.draftInfo`, `E.createClosure` | Close and clear are distinct: clear keeps spaces open. Multiple spaces, all-day/part-day/multi-day windows, reasons, notes, impact preview, existing overlapping plans, pending board drops included in impact |
| Closure case management | `VIEWS.closures`, `VIEWS.closure`, `CLOSURE.hbar` | List of cases, progress, planning/applied/reopened states, reopen a waiting booking after apply, list/calendar/week/guests modes |
| Recommended relocations | `E.bestOptions`, `E.allocationOrder`, `E.judge` | Allocate candidates across the whole case to avoid recommending the same space twice; availability, activity suitability, size, amenities, price, distance, linked resources, other plans/holds |
| One booking's day fit calendar | `CAL.view`, `E.calDay`, `E.fitBands`, `E.placeCheck`, `E.place`, `E.placeAt` | Original/target placements, permitted time bands, warnings versus hard refusals, drag target ghost, hidden spaces, ticked parts, other pending placements |
| Compare candidate places | `COMPARE.html`, `E.compare` | Same venue / within 10 km / any, size and amenity requirements, availability strips, changed price, alternate start time, pick-anyway warnings, and explainable hidden options |
| Week relocation / alternate date | `WEEK.view`, `E.calWeek` | Week range, selection rail, date-specific suitability, open day, target-space chips, linked parts and cross-venue dependencies |
| Staff/equipment dependency repair | `WEEK.swapHtml`, `E.swapBox`, `E.swapsFor`, `E.resFree` | Staff swaps, full versus partial availability, equipment going with a booking, unavailable/tied-to-base resources, explicit uncovered interval warnings |
| Shorten the affected part | `E.stretch`, `E.setPick({outcome:'shorten'})`, `CARD.html` | Only permitted when closure affects the start/end; keep an appropriate time range, resize handle, linked resource implications, revised fee |
| Not used | `E.markNotUsed`, `E.guestNotUsed`, `E.setPick({outcome:'notused'})` | Whole affected booking/parts or individual guest bookings, explicit credit-to-give amount, later financial follow-up |
| Move out and decide later | `E.setPick({outcome:'later'})`, `E.laterLines` | Offer another date/space or no offer, send decision request, optional hold, answer-by deadline, hold expiry, waiting/unconfirmed states and decide-now re-entry |
| Activity/session decisions | `E.sessionStrip`, `GUESTS.view`, `E.guestList`, `E.sessionGrid` | Move the session with all guests, move selected guest bookings to other sessions, or mark guest bookings not used. Day/week target sessions, available places, whole booking guest counts |
| Guest-specific implications | `E.guestCard`, `E.pickGuest`, `E.setGuest`, `E.addGuest` | Price differences, keep/current versus charge/new, required guest details, individual credit and waiting outcomes |
| Price choice | `E.card`, `priceBox` | Original/new fee, keep current price versus charge new price, explicit fee-update flag; this must not disappear under a generic 'same guests and time' review |
| Pending plan management | `E.boardPending`, `E.addToPlan`, `E.takeOut`, `E.boardTakeOut`, `E.review` | Multiple changes, next undecided item, update a previous decision, remove a change, distinguish tentative plans from live state |
| Review / communication preview | `VIEWS.review`, `VIEWS.boardReview`, `E.review`, `E.message` | Grouped before/after details, guest subrows, remaining Booking Manager work, message per booking, who is told, change links and fresh validation |
| Apply and recovery | `E.applyCheck`, `E.apply`, `E.canUndo`, `E.undo` | Apply as a coherent change, snapshot recovery, conflicts with later changes, reused freed slots, finished flags, and the time-limited undo rule |
| Aftercare | `VIEWS.after`, `E.after`, `E.flags`, `E.needs`, `E.navCount` | Separate Done from Still needs work; fee, credit, details, seasonal update, waiting, unconfirmed/expired holds; no false 'all resolved' state |
| History and Booking Manager handoff | `VIEWS.history`, `VIEWS.bm`, `E.history`, `E.bmView`, `E.finishFlag`, `E.hirerAgreed`, `E.reopen`, `E.expire` | Apply, agreement, completed follow-ups and expiry recorded; link back to origin; actual Booking Manager is explicitly a stand-in in this prototype |

Wet weather, making room, and maintenance are three demo stories, not three
different engines. Preserve the general multi-space / multi-day closure model.

## Events already present in r7

- `evBoard`: Day, list, and week; public sessions, private slots, preliminary and
  held work; venue/business-area/type/attention filters; KPIs; quick detail panel;
  drag with fit checks, pending ghosts and a linked-private-parts question.
- `evAssign`: several sessions or one; per-person guest-place quantities; staff,
  equipment pools and boats; eligible candidate groups; at-venue/free/other-venue
  ranking; work taken over; review or replace displaced assignments; manager
  override with reason; view a candidate's day; keep an assignment for later.
- `evGuests`: uncovered-first booking selection, same/all-activity targets, guest
  capacity, per-booking target, keep/charge price, guest details, not-used credit,
  and plan staging. Started sessions and targets are constrained.
- `evCopy`: copy session with a fit calendar and selection of what is copied;
  resources and reservations are validated before it joins the plan.
- `evMove`: change a session's time/date/place, preserve or explicitly swap staff,
  use day/week fit bands, explain refusal, review consequences and stage changes.
- `evBulk`: move several sessions or private items with one rule (date/time/place),
  inspect each row, keep individual exceptions, choose a fit on the calendar, and
  stage only validated selected rows.
- `evPriv`: multi-slot private booking with ticked scope, linked slots, individual
  guest details, swaps, not-used/later/hold outcomes, reply deadline, and clear
  return to a originating resource job.
- Waitlist confirmation, held-space expiries, current/pending allocation context,
  public/private booking differences, price/detail/credit flags, and follow-ups
  are implemented in `O` and used by these views.

Useful APIs: `O.status`, `O.coverage`, `O.peopleFor`, `O.equipFor`, `O.boatFor`,
`O.assignView/Add/Places/Takeover/Override/ToPlan`, `O.guestsView`, `O.guestPlace`,
`O.guestPrice`, `O.waitConfirm`, `O.copyView/ToPlan`, `O.moveView/Place/Swap/ToPlan`,
`O.bulkOpen/View/Rule/Row/Tick/ToPlan`, `O.privView/Tick/Place/Swap/Outcome/Later/ToPlan`,
`O.fitCal/Check/Why/Week`, `O.slotFixToPlan`.

## Resources already present in r7

- `rsBoard`: day/week timelines; grouping by business area; people then equipment;
  venue/category/search filters; Working/Away cards; preliminary/internal/public/
  private/held/pending/unavailable work distinguished and correctly packed into
  lanes; individual row action menu.
- `rsPerson`: one person's week calendar, availability and existing work.
- Drag to hand over work at the same time; `O.handCheck` and `O.handToPlan`
  distinguish safe handover, refusal, and a reason-required decision. Pools,
  preliminary blocks, arriving ghosts and leaving blocks are not draggable.
- `rsJobNew`: mark unavailable or hand over work; rest-of-day, a day, period, or
  permanent departure scope; reasons; affected public/private/held items;
  preliminary and internal work effects; quantities for a partial pool outage.
- `rsJob`: list or calendar; best replacements, apply best, give all to a person,
  per-item replacement, manual decisions, leave an issue visibly open, redirect to
  Move guests or Move private booking and return to the same job/item.
- `rsShare`: share workload with a new/selected teammate across a period; selected
  work items, even sharing, per-item choices and resulting coverage are retained.
- `rsVenue`: move a person, boat, or pool/part of a pool to another venue; show
  work left behind, work picked up there, dates, travel, preliminary work removed,
  and repair each dependent assignment.
- Individual boats differ from quantity pools: seats, equipment types, service
  outages, travel and turnaround/gap constraints are modeled explicitly.
- Staff ranking accounts for qualifications, manager override, venue, travel in
  both directions, existing work, availability/leave, workload, preliminary slots,
  internal work, and taking over/replacing other assignments.

Useful APIs: `O.rsDay/Week`, `O.personWeek`, `O.jobDraft`, `O.createJob`,
`O.jobList/Best/Pick/Decide/Open/Cal/Link`, `O.useBest`, `O.giveAll`,
`O.shareView/Tick/Even/Set`, `O.venueDraft`, `O.takeOutJob`.

Internal and preliminary work are represented and affected by these operations.
I did not find a roster-import screen or a create-internal-work flow in r7; these
must be cross-checked against final v53/v56 and added if that reference requires
them. Do not claim seeded internal work equals a full internal-work editor.

## Shared operations plan and aftercare

Events and Resources share `OS.plan`, `OPS.bar`, `OPS.toFinishChip`, `opReview`,
`opAfter`, `opBm`, and `opHistory`. Keep the full lifecycle:

1. Tentative edit / selected items / dependency repair.
2. Add to plan and continue, including multi-session and multi-job work.
3. Pending summary with per-change editing/removal.
4. Review before/after, side effects, recipients and messages.
5. `O.applyCheck` / `O.apply`, with only applyable decisions committed; undecided
   job work remains visible instead of being silently discarded.
6. After-apply Done, Booking Manager follow-ups and Needs attention in Events.
7. Guarded undo/history, customer agreement, expiry and Decide now.

The plan context participates in availability checks. Deleting the plan model in
favor of immediate one-record saves removes important conflict protection.

## Safe improvements without removing functionality

- Keep the complete original engines, data, views, actions, state/persistence and
  plan semantics. Build a new presentation layer on these contracts.
- Give each area a task-focused entry screen and one contextual primary action.
  List complex options in task groups: Move, Reassign, Disruption, Financial and
  follow-up. Preserve a visible 'All actions' entry rather than hiding functions
  so deeply that people assume they are unavailable.
- Make advanced filters collapsible; retain filter counts and applied-filter
  chips. Keep date, venue, current scope and attention status visible.
- Turn the existing long-lived plan into a clear activity with three human steps:
  Choose scope → Resolve impact → Review and apply. Keep list/day/week/compare/
  guest tools inside Resolve impact, with progress and selected context retained.
- Reveal decision-specific controls only when relevant: series scope on recurring
  bookings; linked parts on multi-part bookings; price choice on price changes;
  override reason on an override; hold expiry when waiting for an answer.
- Show one recommended next action and its rationale; retain alternatives,
  compare views, manual placement, warnings and manager overrides. Recommendations
  must be optional and must not bypass review.
- Group the final review by bookings, dependencies, money, communications and
  unresolved follow-ups. Keep a change count and actual affected-item counts.
- Keep 'decided', 'in plan', 'applied', 'waiting', 'unconfirmed', and 'still needs
  attention' distinct. Plain language can explain these states without erasing
  their different operational meanings.
- Preserve `data-act` and `data-t` contracts if rebuilding screen markup. Core
  has delegated click/change/input dispatch; control labels/styles can change
  without replacing the 321 underlying actions.
- Extend `UI_DEFAULTS`, `UI_TRANSIENT`, `TITLES`, `FRAME_NO`, `NAV_*`, `VIEWS`,
  `ACT`, `MODALS`, `ESC`, `CLOCK_VIEWS` and `CORE_HOOKS` additively. Never hold a
  stale ST/OS reference: reset, restore and demo jumps replace these objects.
- `coreTop`, `coreSide`, `render`, and `go` are practical shell hooks. `render`
  already preserves main and named-container scrolling/focus; keep that behavior.
- An extension script loaded after existing package scripts can register helpers
  before `coreBoot` runs on DOMContentLoaded. Avoid rewriting engine internals or
  wholesale registry replacement for an appearance change.

## Validation evidence and limits

Loaded the full original HTML in Chromium via Playwright `setContent`, enumerated
the final registries, and ran all 47 engine demo setup sequences (Facilities 1–14;
Operations 15–47). Every setup returned its intended view; Operations reported an
empty error string for all 33 frames; there were no uncaught page errors. This
establishes a useful intact baseline, not proof of every user interaction or a
production integration. Preserve those scenarios as regression fixtures and test
natural UI journeys on the revised presentation.

The core's Today navigation is parked; a real combined task dashboard is an
additive improvement. Booking Manager and notifications remain prototype
stand-ins. No production backend or one-state Facilities/Events bridge is
established by the uploaded r7 file itself.
