# Optimo hybrid prototype review

The updated prototype preserves the full event/resource and facility workflows and brings their themes and concepts together.

## Open the prototype

1. Download `Optimo-hybrid-review.zip` from this branch.
2. Extract the ZIP.
3. Open `Optimo-hybrid/optimo-full-hybrid.html` in Chrome or Edge.

The HTML contains both complete prototypes and the revised workspace. No server, installation, internet connection or original-file selection is required. GitHub shows HTML as source; download and open it locally to interact.

## Revised flow

- Dashboard shows readiness, schedule issues, draft changes and follow-up actions.
- Events uses Calendar/List with independent date scope and consistent occurrence records.
- Resource reassignment starts with a work period and keeps individual dates through review.
- Facilities supports Day/Week independently of Calendar/List.
- Public event, Private booking and Block colours stay consistent; recurrence, confirmation, publication and operational readiness remain separate.
- Action centre identifies the next action for each issue, plan or follow-up.

## Included

- `review/optimo-full-hybrid.html`: standalone interactive prototype.
- `review/design-decisions.md`: rationale and integration boundary.
- `review/scenario-review.md`: 30 browser scenarios, 43 unit/source checks and verification limits.
- `review/v53-v56-feature-inventory.md`: event/resource capability inventory.
- `review/r7-feature-inventory.md`: facility/planning capability inventory.

Project source, development commands and reusable setup instructions are in the repository. The reference datasets remain separate, and some source endpoints are simulations; this is an interaction prototype rather than a live booking system.
