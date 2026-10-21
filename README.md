# Optimo operations workspace

The active hybrid uses the re-uploaded **prototypev53.html** for Events and Resources and **optimo-operations-r7.html** for Facilities. The V53 reference retains its 35 source script tags. Original source files remain unchanged; focused extensions add the missing operational features and share the r7 visual style.

Events supports Calendar/List with Day, Week, Month and Custom date scopes. Existing assignment, capacity and package/price decision screens remain available. The extensions add patterned session copying, reviewed calendar moves, package/day/series-aware private allocations, persistent resource availability cases and actual local assignment/rescheduling commits.

Facilities retains r7 planning, comparison, closure and review flows, with cross-date moves and linked allocation scope. Deferred work becomes an internal operations task. Active workflows do not require customer acceptance or create temporary holds with expiry; staff can prepare a notification or apply silently.

The dashboard and Action centre use current allocations, saved cases and follow-ups. A shared, persistent audit log records applied changes with scope and before/after values and supports JSON export.

## Develop and verify

Requires Node.js 22 or later and npm.

```sh
cd /workspace/Optimo
npm ci --cache /workspace/.npm-cache
npm run dev
```

The server listens on port 5173; set `PORT` to change it. In another terminal:

```sh
npm test
npm run build
npm run test:requirements
npm run test:browser
```

Browser checks require the development server and Chromium. The default executable is `/usr/bin/chromium`; set `CHROMIUM_PATH` or `OPTIMO_URL` for another installation or server. Cloud work uses the existing isolated checkout.

## Review artifacts

- `dist/optimo-full-hybrid.html` bundles both active sources, extensions and workspace for local review without a server.
- `dist/optimo-workspace-loader.html` loads the two original HTML files through local file pickers without uploading them.
- `dist/requirements-results.json` contains the latest expectation-scenario results.

## Structure

- `references/v53.html`, `references/r7.html`: unchanged active sources.
- `references/v53-v56.html`: historical V56 reference; not the active Event/Resource engine.
- `workspace.html`, `index.html`, `src/full-workspace.*`: workspace, dashboard, Action centre, task routing and audit interface.
- `src/v53-guidance.*`, `src/v53-extensions.*`, `src/v53-resource-extensions.*`: V53 bridge and targeted operational additions.
- `src/r7-guidance.*`, `src/r7-extensions.*`: facility presentation, moves, closure policies and internal follow-up work.
- `src/booking-model.js`, `src/workspace-model.js`: shared booking vocabulary and work queues.
- `src/audit-store.js`, `src/audit-bridge.js`: shared persistent audit and prototype permission bridge.
- `scripts/build-full.mjs`, `scripts/requirements-smoke.mjs`, `scripts/full-smoke.mjs`: packaging and browser verification.
- [Design and integration boundary](docs/hybrid-design.md), [requirements coverage](docs/requirements-coverage.md), [scenario review](docs/scenario-review.md).

## Prototype boundary

Operational extensions persist changes in browser storage. The two source examples still have separate booking identifiers and engines; they are not a shared production backend. Roster workbook parsing, notification delivery and Booking Manager integrations remain external boundaries or explicitly simulated actions.

A public session moved between facilities updates local allocations and records a simulated target timeslot/package transaction in the operation ledger. Production must create or map those records and transfer booking allocations atomically while preserving prices. The prototype does not create backend packages, send messages or collect payments. No credentials are required.

The earlier reduced demo remains at `simple.html` for historical regression reference. Its `build:simple` and `test:browser:simple` commands do not validate the active hybrid.
