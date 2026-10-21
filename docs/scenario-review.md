# Scenario review · 21 October 2026

The revised workspace passes **30 browser scenarios** with no uncaught parent/frame errors, and **43 unit/source checks**. The standalone export opens both complete prototypes without external resource requests. Desktop screens and a 390 px mobile workspace were also visually inspected; the mobile parent has no horizontal overflow.

## What the numbers mean

- All **47 native r7 demo states** pass setup, view-render and cloned engine checks for pending work, Apply guards, follow-up flags and Undo rules. These are not a claim of 47 separately executed end-to-end user journeys.
- The browser suite separately exercises real assignment/review, rescheduling, capacity, closure, financial follow-up and Undo journeys, as listed below.
- Of the 43 unit/source checks, 29 cover the shared booking model/work queues, three preserve the original sources and native scenario setups, and 11 retain regression coverage for the earlier reduced model. The earlier model is not the active workspace and its tests do not validate the full source workflows.
- Original reference scripts remain unchanged: **37 V53/V56 scripts**, **17 r7 scripts**, **26 r7 views**, **321 original actions**, **132 facility-engine functions** and **189 operations-engine functions**.

## Browser checks

| # | Scenario | Result |
| --- | --- | --- |
| 1 | Both original script stacks remain intact, with all bridge entry points available | Pass |
| 2 | Task picker opens the complete quantity assignment and partial-coverage review | Pass |
| 3 | Public rescheduling retains customer, unallocated, package, price and undecided choices | Pass |
| 4 | Private rescheduling keeps the whole booking, duration, customer and supply context | Pass |
| 5 | Linked-item capacity retains timeslot and rest-of-day scope and impact review | Pass |
| 6 | Bulk assignment preserves two dated occurrences and the original review result boundary | Pass |
| 7 | All 47 native scenario setups remain valid without mutating current live plans | Pass |
| 8 | All 47 original scenario views still render with additive guidance | Pass |
| 9 | Native closure, linked-part comparison and pending review survive workspace navigation | Pass |
| 10 | Mobile workspace and task picker fit the viewport and keep task controls available | Pass |
| 11 | Dashboard distinguishes loaded readiness, real booking issues and unapplied selections | Pass |
| 12 | Dashboard refreshes to clear from changed source readiness and retains non-cover issues | Pass |
| 13 | Dashboard date scope excludes dated work while retaining actionable undated bookings | Pass |
| 14 | Future unrostered work remains actionable and opens its exact dated assignment rather than the base day | Pass |
| 15 | Shared booking vocabulary separates family, confirmation, publication and private recurrence | Pass |
| 16 | All 47 native demo states enforce Apply guards, pending decisions, follow-up flags and Undo limits | Pass |
| 17 | Native facility Apply can be undone before follow-up work is completed | Pass |
| 18 | Finishing a real facility credit refreshes the queue and blocks unsafe Undo | Pass |
| 19 | Undoing applied operations after a fee update retains compensating credit work | Pass |
| 20 | Action centre keyboard tabs work and task context keeps its owning workspace | Pass |
| 21 | Draft plan child actions resume the exact native resource disruption without duplicating plan counts | Pass |
| 22 | Events keep Calendar/List independent of date scope and retain dated occurrence selection | Pass |
| 23 | Attention links reveal their exact native booking after unrelated event filters and dates | Pass |
| 24 | One-day event ranges retain all eight scheduled day records in Calendar and List | Pass |
| 25 | Date range calendar cards and their actions remain separate for adjacent and concurrent occurrences | Pass |
| 26 | Public confirmation policy changes independently from publication and derives confirmation from first booking | Pass |
| 27 | Resource reassignment selects an explicit dated work period and retains occurrence dates through native review | Pass |
| 28 | Facilities support Day/Week and Calendar/List independently with actionable schedule rows | Pass |
| 29 | Packed standalone opens both full prototypes without external resource requests | Pass |
| 30 | Standalone local-file loader accepts both original HTML fixtures and initializes full workflows | Pass |

## Issues resolved during the run-through

- Dashboard task shortcuts were replaced with current readiness, actionable issues, unapplied changes and post-Apply follow-ups.
- Exact attention/follow-up links now open the correct booking, date, flag or resource job, clearing unrelated filters when necessary.
- Selecting work no longer invents a draft plan. Resource sub-tasks can be resumed without counting them again as separate aggregate plans.
- One-day Calendar/List and one-day date ranges now agree on all eight scheduled base-day records. Explicit additional period and future-unrostered occurrences remain visible.
- Calendar cards use real time placement and collision lanes; adjacent and concurrent actions remain separate.
- Reassignment keeps a selected work period, dated occurrences and review dates. Rest-of-day replacement inheritance cannot cross work dates. Undated work requires an explicit choice; future unassigned work is not treated as an existing assignment.
- Public-event guest follow-ups use the public family colour. Private recurrence does not change the booking family colour.
- An invalid explicitly typed operations credit can no longer silently fall back to a stored amount and clear the follow-up.
- Follow-up completion refreshes the queue. Native Undo guards remain in force when subsequent financial work makes reversal invalid.

## Limits of this verification

The supplied examples retain separate fictional datasets and native transaction boundaries. Several original event/resource commits, notifications, roster parsing and Booking Manager endpoints are demonstrations. Checks validate their interaction and state contracts, not live delivery, payments or a production allocation backend. Automated browser checks use Chromium; other browser engines were not separately run.
