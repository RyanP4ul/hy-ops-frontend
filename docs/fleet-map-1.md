# Fleet Map 1

URL: `/panel/fleet-map-1` on the existing HyOps host. The original remains at `/panel/fleet-map`; the Fleet Map navigation link is unchanged.

## Dispatcher experience

The operational workspace answers, in order: where the vehicle is and when GPS last reported; its next destination; and whether GPS, delivery failures, or overdue work need attention.

Desktop defaults to a compact vehicle directory, a larger map, and a docked detail drawer. Smaller screens use a collapsible directory and a bottom drawer. Map Only, List Only, fullscreen, selection, search, status filters, and warehouse filters share workspace state. Map controls disappear in List Only. Search and status filters are confined to the directory, including its Map Only overlay.

The detail drawer leads with plate, driver, operational status, and independent GPS freshness. Next stop and separate completed-stop/completed-order counts follow. Follow vehicle is explicit; GPS refreshes and row selection do not automatically move the camera. Warehouse coordinates never produce a vehicle marker without GPS. Maintenance units without GPS remain visible in the directory without contributing to active GPS alerts.

Selected routes use the existing server-side road provider. Failure retains stop pins, has one retry message, and produces neither substitute lines nor an ETA. Stops use verified backend order-group identity plus matching coordinates; matching address strings alone never merge orders. Proof metadata uses the existing authenticated proof endpoint and query keys. Existing order/proof dialogs, manual delivery review, dispatch, warehouse assignment, and warehouse-return mutations are reused.

Loading, unavailable fleet data, empty searches, GPS errors, stale/no GPS, proof-loading/error/missing states, routing failure, and mutation errors retain explicit UI feedback. GPS ages use seconds/minutes; schedules retain the existing Asia/Manila formatting. The drawer shows next stop and progress once, keeps route stats and Recenter on the map, and places warehouse assignment and trip scheduling under collapsed Vehicle details. Technical GPS fields are omitted.

## Isolation and reuse

The map offers a **3D** toggle using Google's vector map tilt and building rendering. The requested tilt is 55 degrees; the visible tilt and building coverage depend on Google's zoom and imagery support. It retains center, selected vehicle, and filters, and enters street zoom (at least 17) when enabling 3D. List Only hides controls without changing the perspective, and the compass resets to 2D. All map pages now share Google Maps. OpenFreeMap tiles and custom OSM extrusion layers have been removed. See [Google Maps migration](google-maps-migration.md) for configuration and current validation.

All application implementation is under `app/(protected)/panel/fleet-map-1`. UI and stop-grouping variants are local to this route. Transport, overview/live-position hooks, delivery enrichment, mutations, telemetry validation, shared dialogs, formatting, map primitives, and the road-route handler reuse the original implementation.

Both pages inherit the same panel layout and session/role proxy. Neither changes the backend warehouse scope. The new warehouse selector filters only warehouse data returned by the existing fleet API. The existing WebSocket provider already maps `fleet-map-1` to the `fleet-map` subscription topic; that existing workspace change was preserved.

## Verification

- Production Next.js build passed and generated both page routes and both road-route endpoints independently.
- Focused unit checks: 11 passed across `fleet-map-1.test.ts` and `fleet-stop-plan.test.ts`.
- ESLint passed for the new page and changed tests. A TypeScript check covering application code and the changed tests passed.
- Chromium: three scenarios passed against an isolated PostgreSQL/backend/Next.js fixture. They cover original/new page access, the unchanged navigation link, matching staff warehouse data, rejection of anonymous/driver access, live WebSocket GPS ingestion, stale in-transit GPS, maintenance without GPS, grouped orders, separate completion counts, proof display, route outage/retry, row/marker selection, stable camera during GPS updates, preserved selection/filters across views, fullscreen, mobile/tablet overflow, guarded delivery confirmation, concurrent-state failure/retry, and return completion.
- Browser snapshots are written to `test-results/fleet-map-1-desktop.png` and `test-results/fleet-map-1-mobile.png` (ignored test artifacts).
- The current 3D browser fixture uses a deterministic Google Maps SDK substitute. It checks requested camera tilt, return to 2D through toggle/compass, and perspective persistence. It does not verify live Google imagery, building coverage, or authorization.

The standard live-fixture launcher references missing historical migrations, starting with `0000_nullable_payment_received_at.sql`. Browser verification used a temporary copy of that launcher which initialized the current schema directly and skipped the obsolete reconstruction step. The original launcher was not modified. Fixture processes were stopped afterward.

The broader existing unit suite has one failure in `fleet-road-routing.test.ts`: its scheduled-preview expectation disallows a warehouse-origin preview while the existing implementation permits one. Standalone full-project TypeScript also reports a pre-existing incomplete `ResolvedPosition` fixture in that file (line 121). Neither the original routing implementation nor that unrelated test was changed.

Production GPS devices, real street-tile contrast, and the external road provider were not exercised. Browser map tests use a Google Maps SDK fixture and deterministic road geometry; group/proof display edge cases use intercepted responses. Authentication, warehouse data comparison, WebSocket ingestion, delivery confirmation, and return completion use the isolated real backend.
