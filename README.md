# Optimo full operations workspace

A feature-preserving hybrid using the uploaded V56 prototype, including its V53 event/resource workflows, and the R7 facility and planning prototype. The earlier reduced demo is superseded: advanced workflows remain available.

The source HTML under `references/` is unchanged. Additive adapters share the facilities theme, a consistent booking vocabulary, independent date/display controls, dated reassignment and an actionable operating dashboard. Advanced workflows remain in context.

## Revised operating flow

Dashboard shows whether any bookings, draft plans or applied follow-ups need attention. Action centre keeps those three kinds of work separate and opens the exact next action. Public events, private bookings and blocks share one colour vocabulary; private recurrence, public confirmation, unpublished slots and operational readiness stay distinct.

Events uses Calendar/List with space/time grouping inside Calendar. Facilities uses Day/Week independently of Calendar/List. Resource reassignment starts with a dated work period and retains those dates through review.

## Develop

Requires Node.js 22 or later and npm.

```sh
cd /workspace/Optimo
npm ci --cache /workspace/.npm-cache
npm run dev
```

The server listens on port 5173; set `PORT` for another port. The root page loads both complete sources. Cloud tasks are already isolated: use the existing checkout and do not create a Git worktree unless explicitly asked.

```sh
npm test
npm run build
npm run test:browser
```

Browser checks require the development server. System Chromium is at `/usr/bin/chromium`; set `CHROMIUM_PATH` or `OPTIMO_URL` for other installations.

## Review artifacts

- `dist/optimo-full-hybrid.html` includes both original prototypes, guidance and workspace. It needs no server or network.
- `dist/optimo-workspace-loader.html` includes the workspace and guidance. Open it and select the two original HTML files from your computer. Files are read locally, without uploading. This avoids redistributing the large source files through chat.

Use Find a task for capacity, bulk/partial assignment, public/private rescheduling, notifications, roster import, resource absence/reassignment/venue transfer, multi-change planning, closures, comparison and follow-up.

The earlier simple demo remains at `simple.html` for regression reference only. `npm run build:simple` and `npm run test:browser:simple` concern that superseded demo and do not validate the full workflows.

## Structure

- `references/v53-v56.html`, `references/r7.html`: intact source prototypes.
- `workspace.html`, `index.html`: common workspace shell.
- `src/full-workspace.*`: dashboard, Action centre, task discovery, persistent contexts and reference loading.
- `src/booking-model.js`, `src/workspace-model.js`: common booking semantics and current-state work queues.
- `src/v53-guidance.*`, `src/r7-guidance.*`: additive source adapters and orientation.
- `scripts/build-full.mjs`: bundled and local-file-loader exports.
- `scripts/full-smoke.mjs`: full-source browser validation.
- `docs/hybrid-design.md`: revised rationale and integration boundary.
- `docs/scenario-review.md`: verification coverage and scenario results.
- `docs/v53-full-inventory.md`, `docs/r7-full-inventory.md`: capability inventory.

## Prototype behavior

No advanced feature is deferred merely to make the UI look simpler. Original engines, actions and decision screens remain. Their sample data and state boundaries remain separate; this wrapper does not create a shared booking backend. Some original import, notification, commit and Booking Manager endpoints are simulations. See the design document for the shared-ID and commit adapter still required for integrated production behavior.

No credentials or external services are required. The app does not send notifications or upload the supplied HTML files.
