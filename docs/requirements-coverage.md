# Revised module requirements

This revision follows the re-uploaded **prototypev53.html** and **optimo-operations-r7.html**, with the supplied expectation document as the acceptance reference. The r7 upload is identical to the earlier r7. V53 is now the active event/resource source; V56 is retained only as an earlier reference.

The scope is operational management. Event definition, item/package setup and sales checkout remain upstream. Their capacity and allocation rules are represented here where they affect readiness, copying or relocation.

| ID | Expected behaviour | Approach |
| --- | --- | --- |
| E01 | Day, week, month and custom period | Separate date scope from Calendar/List display, retaining detailed selection. |
| E02 | Public session with many customer bookings versus one private booking | Distinct booking families; private package/day/recurrence details stay within the parent booking. |
| E03 | Sell an active session before human rostering is complete | Keep its unrostered state distinct from cancellation; known facility/equipment limits still constrain saleable places. |
| E04 | Find operational shortfalls after rostering or deallocation | Show required versus assigned cover, per linked supply; retain actual affected occurrences. |
| E05 | Temporary capacity change per supply, occurrence or remaining day | Retain V53 linked-capacity override and impact review, permission checks and audit evidence. |
| E06 | Suitable resources, quantities, category/skill ranking, diaries, travel and takeovers | Retain V53's detailed assignment/review flow; commit prototype allocation changes. |
| E07 | Move customer bookings across sessions/activities | Retain customer/package/price/data review; keep-price rights and Booking Manager follow-ups remain explicit. |
| E08 | Copy multiple sessions using date/time patterns | Add pattern generation, conflict review and resource replacement/exclusion per proposed session. |
| E09 | Move a whole public session and its bookings | Add calendar placement/dragging plus explicit date/time/facility and replacement review. |
| E10 | Booking lists, attendee notification entry and bulk assignment workflow | Retain the existing V53 workflows; identify notification delivery as a prototype handoff. |
| P01 | Private details: selected day's allocations and whole booking | Add package/day structure, regular/seasonal context and a complete allocation overview. |
| P02 | Move combined packages or individual allocations | Explicit allocation, linked group, day, date range and whole-series scope; relative timing preserved. |
| P03 | Replace private facilities/resources | Validate and apply replacements to the chosen scope; keep package/booking identity. |
| R01 | Unavailable today, period or indefinitely | Bind remove-slot, block-new-work and permanent-inactivation options; inactivation only for indefinite absence. |
| R02 | Automatic full/partial replacement and unresolved work | Use affected occurrences and real replacement coverage; deallocated gaps stay actionable. |
| R03 | Private recurring replacement | Check every selected date and reject an invalid all-dates replacement. |
| R04 | Persistent disruption cases | Keep period, decisions, affected items and outstanding status after navigation/reload. |
| R05 | Reassign a chosen period of work | Preserve existing date/occurrence selection and replacement suggestions/search. |
| R06 | Temporary move to another venue | Restrict to movable resources; review source cover, travel and selected destination work. |
| F01 | Facility calendar drag/drop, including another day | Retain r7 inspection/comparison and add explicit cross-day/series move scope. |
| F02 | Move a public session to another facility | Review target facility slot and matching package operation at the same price. Prototype records the required transaction; production creation must be atomic. |
| F03 | Close or clear one/many spaces for a period | Preserve r7 close versus move-out distinction and affected-booking case review. |
| F04 | Mark a seasonal slot unused while retaining selected linked work | Make linked allocation utilisation explicit; never restore work into the blocked space/window. |
| F05 | Price, seasonal fixed price and monthly invoicing | Keep or change price with a user right; distinguish fixed-season pricing from next-invoice adjustments. |
| F06 | Questionnaire/waiver differences | Create actionable Booking Manager work rather than silently treating missing data as complete. |
| F07 | Inform the customer or apply silently | Remove customer-acceptance/expiry tracking. Deferred decisions are internal operational work. |
| A01 | Audit all operational changes | Shared, persistent log with action, entity, scope, time, actor, before/after and explicit applied/draft/simulated outcome. Export includes the complete log. |
| U01 | Preserve the preferred workflows and unify the design | V53 Events/Resources and r7 Facilities, using the facilities visual theme. No competing r7 event/resource planner in the main navigation. |

## Integration boundaries

The HTML is a local interaction prototype. It does not send notifications, collect payments, enforce a production identity provider or create real backend packages. Prototype user rights are adjustable to exercise permission checks. All production price/skill/capacity rights require server-side enforcement.

Moving a public session between facilities requires a single production transaction that creates/updates target facility timeslots, creates/maps package items at the preserved price, transfers booking allocations, releases old allocations and writes the audit record. The prototype previews and records that operation; a failed step must roll back the whole transaction in production.

A native action that only displays a simulated result is labelled as simulated in the audit log. It must not be represented as an applied production change.
