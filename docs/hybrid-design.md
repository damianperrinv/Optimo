# Optimo hybrid: one operating model, detailed decisions

The event/resource reference is the uploaded **prototypev56.html, including its V53 workflows**. The facility reference is **optimo-operations-r7.html**. Both retain their original engines and advanced workflows. The revised interface uses the facilities theme and a common vocabulary throughout.

## The changes from this review

| Question | Revised behaviour |
| --- | --- |
| Does anything need attention? | Dashboard shows current schedule issues, draft changes and applied follow-ups separately, with a clear readiness banner and direct next actions. It updates when workspace state changes. |
| Timeline or calendar? | Events uses Calendar or List. Space/time grouping remains inside Calendar, preserving the useful timeline layout without a competing display mode. Date scope is independent. |
| Which work should be reassigned? | Start by choosing the work period and occurrences. Keep that scope and individual work dates through replacement and review. Work without a known date is explicitly identified. |
| Why do the modules look different? | The parent workspace and both adapters share facility-led colours, typography, borders, controls, status patterns and booking semantics. |
| What does unfinished work mean? | The Action centre separates operating issues, unapplied draft changes and follow-ups after Apply. Each item has an entity, reason, state and next action. Row selection alone is not a draft. |
| Is List another date scope? | Facilities has independent Day/Week scope and Calendar/List display. List works for either period. |
| What do colours mean? | Colour identifies Public event, Private booking or Block. Confirmation, private recurrence, publication and readiness remain separate, labelled concepts. |

## A consistent booking vocabulary

| Dimension | Values | Meaning and presentation |
| --- | --- | --- |
| Booking family | Public event | Blue. People book places in a scheduled event. |
| Booking family | Private booking | Purple. A customer hires the activity or space. |
| Booking family | Block | Slate with a stated maintenance, holiday, closure or other reason. |
| Public confirmation | Confirmed / Provisional | A public event can be confirmed immediately or conditional on its first booking. A conditional event becomes confirmed when at least one booking exists. Zero bookings alone does not make an already confirmed event provisional. |
| Private recurrence | Casual / Regular / Seasonal | A secondary label within Private booking; recurrence does not change its colour family. |
| Publication | Published / Draft slot | A preliminary, unpublished slot is planning work. It is not automatically the same thing as a provisional public event. |
| Readiness | Ready / Needs cover / Conflict / Needs a decision | Explicit status labels. Amber and red identify problems alongside the booking colour. |
| Change state | Proposed / Applied / Follow-up | A proposed move is distinct from the current booking. Apply and subsequent follow-up remain explicit. |

Holds, internal work and unavailable resources retain their own labels. They do not silently become another booking family. Detailed operational warnings are not recoloured as booking types.

## Every screen has a purpose

- **Dashboard:** assess operating readiness in the selected date scope and open the next action.
- **Events:** inspect and manage public events and private bookings; use Calendar for time/space relationships and List for detailed review and selection.
- **Resources:** inspect people/equipment, availability and allocated work; define absence, reassignment, sharing or venue moves with explicit scope.
- **Facilities:** inspect occupancy, select spaces/periods, close a space or move work out while leaving it open.
- **Action centre — Needs attention:** resolve current event, cover, space and booking issues.
- **Action centre — Draft changes:** continue decisions or review changes that have not taken effect.
- **Action centre — Follow-up actions:** finish money, details and customer-response work left after Apply.
- **Find a task:** direct entry to the full set of routine and advanced workflows.
- **Decision screens:** keep requirements, eligibility, calendars, comparison and consequences beside the choice being made.
- **Review:** show proposed changes, blockers, unresolved work, prices, messages and remaining actions before Apply.
- **History:** explain applied changes and make guarded Undo available only when the native engine allows it.

Date filtering never hides undated follow-up work. The reference schedules use different sample dates, so the default dashboard covers all scheduled dates rather than claiming that an old sample represents today's operations. A missing source cannot produce an “all clear” result.

## Operational depth retained

| Area | Retained capabilities |
| --- | --- |
| Selection | Single and bulk date-specific occurrences, recurring-instance scope and linked parts. |
| Assignment | People/equipment quantities, partial cover, diaries, advanced search, skills, manager overrides, takeovers and later compatible slots. |
| Capacity | Linked staff/equipment/facility overrides, timeslot/rest-of-day scope, release impacts and edit markers. |
| Public changes | Customer/referrer, unallocated-only, multi-day targets, packages, pricing, data requirements, undecided bookings, copying and bulk moves. |
| Private bookings | Whole-booking assignment, duration-aware targets, linked supply/parts, customer context and financial consequences. |
| Resource changes | Absence, dated reassignment, temporary venue transfer, handovers, sharing, travel, pool quantities, boats and unresolved source work. |
| Facilities | Multiple spaces/dates, close versus clear, linked/seasonal scope, drag validation, place comparison, size/amenity/distance constraints and guest moves. |
| Exceptions | Shorten, Not used, Decide later, holds/expiry, price/credit decisions, messages and booking follow-ups. |
| Recovery | Persistent editing context, review, history, guarded undo and return to the original job. |
| Other tools | Roster import, notification configuration and the upload's original additional facility diary. |

## Implementation and integration boundary

`references/` preserves both uploads byte for byte. Additive adapters retain their source rules and decision screens. A shared presentation model defines booking families, confirmation, recurrence and colours; the workspace derives its attention queues from current source state.

This is an interaction prototype. The examples have different fictional organisations, dates, identifiers and allocation models. R7 itself separates council facilities (`E/ST`) from resort event/resource planning (`O/OS`). The dashboard can present their work together, but separate native plans are not one cross-module transaction.

Production integration still needs shared booking/occurrence IDs, venue/facility/resource mapping and a common validation/commit contract. Source roster parsing, notification delivery, several event/resource commits and Booking Manager endpoints remain demonstrations. The prototype does not claim external delivery or production updates.

See the [V53/V56 inventory](v53-full-inventory.md), [r7 inventory](r7-full-inventory.md) and [scenario review](scenario-review.md) for capability and verification detail.
