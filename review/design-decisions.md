# Optimo hybrid: preserve the capability, clarify the decisions

The reference is the uploaded **prototypev56.html, including its V53 workflows** for events and resources, and **optimo-operations-r7.html** for facilities. The user explicitly requires the advanced functionality to remain. User friendliness means better orientation, scope, comparison, and continuity; it does not mean reducing the product to basic scheduling and assignment.

The previous reduced concept is superseded. None of the capabilities below is deferred merely to make the interface look simpler.

## What the hybrid retains

| Area | Capability retained | How the workspace helps the user |
| --- | --- | --- |
| Operating picture | Day/period and timeline/list/calendar views; public/private/preliminary distinctions; business-area, venue and facility filters | Clear entry points preserve the detailed views |
| Selection | Individual and multiple date-specific occurrences; recurring-instance scope | Current selection counts stay visible; native scope rules remain authoritative |
| Assignment | Multiple resources, quantities, partial coverage, diaries, advanced search, skill overrides and source-work takeover | A task entry opens the full requirement, candidate evidence and review flow |
| Later slots | Optional compatible remaining-slot reuse and Select all | Original availability checks and explicit selection remain |
| Capacity | Individual linked staff/equipment/facility overrides, timeslot/rest-of-day scope, allocation-release impact and edit markers | A dedicated capacity task opens the complete workflow |
| Public rescheduling | Customer/referrer, unallocated-only, multi-day targets, package/data/price decisions and unresolved bookings | Keep booking decisions and final review together |
| Creation and bulk moves | Copied supply, multiple sessions, conflict replacements, shared rules and per-occurrence exceptions | Dedicated task entries preserve full editors |
| Private bookings | Whole-booking assignment, duration-aware calendar, linked supply, parts and customer context | Preserve private-booking semantics |
| Resource changes | Absence versus reassignment versus temporary venue transfer; public-place and whole-private replacement | Distinct intent-specific tasks |
| Workload planning | Handover, sharing, equipment/boat/pool outages, source/destination work and travel | Full r7 planner remains accessible through Find a task |
| Facilities | Day/week occupancy, multiple spaces/dates, close versus clear, linked parts and seasonal scope | Full r7 board and impact model remain intact |
| Facility decisions | Calendar/place comparison, size/amenity/distance constraints, guest moves, shortening, Not used, Decide later, holds and expiry | Scope and stage guidance surrounds original decision surfaces |
| Consequences | Prices, credits, data collection, messages, financial follow-up, pending plans and outstanding decisions | Applied work and work to finish remain distinct |
| Recovery | History, guarded undo, return-to-job links and saved scope | Frames remain alive and native recovery rules remain |
| Planning tools | Roster import, notification setup and the original additive facility diary | All remain in the task catalog with their source behavior |

## One workspace, detail where the decision needs it

- **Today** starts with the job to be done and explains the decision sequence.
- **Events** opens the complete V53/V56 event workflows.
- **Resources** opens that same live context for staff and equipment.
- **Facilities** opens the complete r7 facility engine.
- **Find a task** groups actions by intent, asks for the affected object, and opens the full workflow. It also exposes r7's event/resource multi-change planners, histories and follow-ups.
- **Plans & unfinished work** separates current selection, facility cases and staged operational plans rather than flattening them into one misleading total.

Additive context strips identify the task, scope and next decision. Original controls, warnings, exception paths, calendars and review screens remain available. Detailed decisions are not hidden simply because they are advanced.

## Implementation and integration boundary

The copies under `references/` preserve the uploads byte for byte. The workspace loads them in persistent frames and adds navigation/orientation adapters. It does not replace their business logic with the earlier reduced domain model.

This is a feature-preserving **interaction workspace**, not a claim of completed cross-module data integration. The sources use different fictional dates, organisations, IDs, allocation models and commit contracts. Even r7 separates Facilities (`E/ST`, council venues) from Operations (`O/OS`, resort events/resources). They share a clock, not booking allocations.

A shared data layer still needs stable IDs, venue/facility mapping, resource and occurrence models, and a shared plan/validation/commit contract. A closure should then open affected event/resource work and return to the same plan without re-entering context. Until that adapter exists, reference-data guidance makes those source boundaries explicit.

Some source endpoints are simulated: notification delivery, workbook import, several bulk commits and Booking Manager stand-ins do not represent live external updates. Those are source behavior limits, not features removed by the hybrid.

See [V53/V56 inventory](v53-full-inventory.md) and [r7 inventory](r7-full-inventory.md) for the full function/state map and runtime observations.
