# Scenario review · 21 October 2026

The active revision uses the re-uploaded **V53** for Events and Resources and **r7** for Facilities. Checks run in Chromium against isolated browser contexts, including saved-state reloads. The original reference files are preserved byte for byte: V53 has 35 script tags and r7 has 17. The uploaded V53's unrelated external antivirus script is inert when embedded, so the standalone app makes no external requests.

**Final verification: 53 unit/source checks, 16 expectation scenarios and 30 broader browser scenarios passed.** No uncaught parent/frame errors were reported. The packed standalone opened without external resource requests.

## Expectation checks

| Scenario | Result |
| --- | --- |
| Actual V53 source, preferred module routes and no invented startup audit | Pass |
| Saleable capacity ignores unrostered requirements and later roster shortfall is two places | Pass |
| Capacity changes stay on the selected occurrence or matching later work that day | Pass |
| Pattern copy creates four empty-booking sessions, calendar rows, persistence and audit | Pass |
| Copy refuses unresolved supply conflicts without creating partial sessions | Pass |
| Calendar drop moves all session bookings and preserves occurrence usage with audit | Pass |
| Private package dates, whole-booking view and series moves preserve weekly spacing | Pass |
| Resource absence options create persistent real impacts, blocks and audit | Pass |
| Permanent unavailability is required for inactivation; blocks and slots are independent | Pass |
| Facility day-scope cross-date changes Apply and Undo atomically | Pass |
| Public facility move records target slot/package transaction at unchanged price and supports Undo | Pass |
| Deferred facility work stays internal with no customer waiting/hold workflow | Pass |
| Keep-price permission rejects unapproved moves before allocation mutation | Pass |
| Monthly pricing and linked utilisation leave only relevant Booking Manager actions | Pass |
| Replacement skills are validated before Apply and saved-work task directories open safely | Pass |
| Audit UI searches actual cross-module changes and exports complete persistent history | Pass |

## Additional regression coverage

The full browser suite covers original script preservation, quantity assignment and persistent partial cover, public/private rescheduling, linked-capacity review, bulk assignment, calendar/list parity and card geometry, dated reassignment, exact attention links, follow-up completion, guarded Undo, keyboard tabs, mobile controls, and packed/offline and file-loader startup.

All 47 native r7 demo states receive setup, render and cloned engine guard checks. These are not 47 separately executed end-to-end user journeys. The retained r7 event/resource engine is tested directly as legacy code; it is excluded from the active navigation and Dashboard queue because V53 owns those modules.

The unit/source suite covers audit persistence and before/after differences, booking family/status rules, current-state queues, exact occurrence routing, persistent cases and follow-ups, unchanged uploaded sources and native scenario setups. Eleven tests retain regression coverage for the earlier reduced model; they do not validate the active module.

Desktop Dashboard, event copying, private allocation detail and facility schedule were visually inspected. A 390 px mobile Dashboard has no horizontal overflow. Large schedule grids scroll within their workspace.

## Corrections found during verification

- Capacity overrides affect only the chosen occurrence or matching later work that day. Earlier and future dates retain their original capacity and readiness.
- Copy and move replacement choices validate activity skills and resource category before Apply; saved-work task entries open useful directories and empty states.

- Original V53 disabled partial assignment review. The additive flow now permits selected partial coverage, retains remaining cover as an actionable case, and persists the allocation after reload.
- An undated private booking could lose its attention flag when projected into the common queue. Undated work remains actionable.
- Fixed seasonal prices no longer create inappropriate immediate credits. Monthly adjustments remain next-invoice work; customer confirmation flags become internal allocation tasks.
- Notification choices in facility Review now match the choices actually applied, including mixed per-move selections. Price previews show calculated amounts.
- Stable occurrence/allocation identity keeps resource cases attached after later session or private booking moves. Reloading private details retains replacement supply.
- Opening or selecting work creates no invented audit change. Native simulated endpoints remain explicitly marked as simulated.

## Limits

This is a local interaction prototype with separate reference datasets. Public relocation updates local allocations and records an explicit simulated target-timeslot/package operation; production must commit the entire transfer atomically. External notifications, payments, production identity/permissions, roster parsing and Booking Manager updates are not connected. Marking a follow-up complete records the operator's action locally. Chromium was tested; other browser engines were not separately run.
