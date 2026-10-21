# Optimo hybrid design

The current Event/Resource baseline is the re-uploaded **prototypev53.html**, preserved as `references/v53.html` with its 35 source script tags. Facilities uses the unchanged **optimo-operations-r7.html** at `references/r7.html`. The earlier V56 upload remains at `references/v53-v56.html` as historical reference.

V53 owns the active Events and Resources routes; r7 owns Facilities. This keeps the preferred workflows in their original engines and adds focused capabilities where the expectation document identified gaps. Shared typography, controls and booking semantics give the modules a consistent presentation.

## Operating model

| Area | Current behaviour |
| --- | --- |
| Dashboard and Action centre | Show live allocation issues, saved operational cases and applied follow-ups, with direct routes to the relevant work. Selection alone is not a draft. |
| Events | Independent Calendar/List display and Day/Week/Month/Custom date scope. Preserve native capacity, detailed assignment, customer/referrer, advanced search, skill, source-impact and package/price decisions. |
| Copy and move | Generate multiple dates and time slots; replace or exclude conflicting copied supply per session. Move a complete session by calendar or exact date/time and review resource replacements. Bookings are not copied; whole-session moves carry existing bookings. |
| Private bookings | Inspect selected-day allocations or the whole booking, grouped by package and date. Keep Casual/Regular/Seasonal context, move selected slots, a day or matching packages across the series, and replace allocated facilities/resources. |
| Resources | Explicit dated reassignment and temporary venue transfer. Persistent unavailability controls independently remove existing slots, block new allocations and, for forever changes, make a resource inactive. Cases retain full/partial/unresolved impacts and live event links. |
| Facilities | Retain r7 planning, comparison, closure and review; add cross-date moves and selected, linked, day, date-range or series scope. Respect fixed seasonal pricing, monthly billing and Booking Manager follow-ups. |
| Deferred work | An internal allocation task remains until operations resolves it. Active flows do not request customer acceptance or create held space with an expiry deadline. Staff can prepare a notification or apply silently. |
| Audit | One persistent log across the active modules, with entity, action, scope, outcome and before/after changes. Opening a screen creates no entry. The complete log can be exported. |

Applied copy, assignment, rescheduling, resource and facility changes update the local operational state and work queues. Private allocation identities remain stable across moves so an existing resource case follows the current allocation rather than losing its follow-up link.

## Booking vocabulary

| Dimension | Presentation |
| --- | --- |
| Public event | Blue; many customer bookings can belong to one session. |
| Private booking | Purple; Casual, Regular or Seasonal is a separate recurrence label. |
| Block | Slate with its closure, maintenance or other reason. |
| Confirmation | Confirmed or Provisional. A public event configured to confirm on first booking becomes confirmed when it receives a booking. Zero bookings alone does not make it provisional. |
| Publication | A preliminary/unpublished slot is distinct from provisional confirmation. |
| Readiness | Ready, shortfall, conflict or unresolved work has an explicit label. Amber/red attention does not change the booking family. |

Capacity uses the resources actually scheduled for the occurrence. An unrostered requirement can be ignored for sales while remaining an operational issue: facility capacity 10 and two boats of 4 give saleable capacity 8; subsequently rostering two instructors of 3 gives operational capacity 6 and a shortfall of 2 for 8 attendees. Capacity is not pooled from other linked but unscheduled resources. Event definition, package setup and checkout remain upstream.

## Persistence and integration boundary

The source HTML remains unchanged. Additive V53 and r7 extensions persist targeted allocation changes, cases, internal tasks and follow-ups in browser storage. Shared audit and prototype permission controls cover price retention, skill overrides and capacity changes; production enforcement belongs on the server.

The sources have separate sample organisations, dates, identifiers and allocation models. A common workspace does not make their native plans one cross-module transaction. Production needs shared booking/occurrence identifiers, facility/resource mappings and a common validation and commit service.

Moving a public session between facilities updates the prototype's local allocations and writes an explicit simulated timeslot/package operation to the facility ledger. The production transaction must validate supply, create or reuse the target facility timeslot, create/map the replacement package at the preserved price, transfer all customer bookings and linked allocations, release the source allocations and write audit evidence. Those steps require atomic commit, rollback and idempotency; backend package creation is not performed by this HTML prototype.

Notifications are prepared locally, not delivered. Roster workbook parsing and Booking Manager financial/customer-data updates remain external integrations. A Booking Manager handoff can be tracked and marked complete in the prototype without claiming that an external system was updated. Remaining native demonstration endpoints are recorded as simulated rather than applied production changes.

## Verification

Run `npm test` and `npm run build`, then use the running development server for `npm run test:requirements` and `npm run test:browser`. The expectation suite covers the re-uploaded source, targeted persistent changes and integration boundaries; the broader browser suite checks retained workflows. See [requirements coverage](requirements-coverage.md) and [scenario review](scenario-review.md) for the current verification record.
