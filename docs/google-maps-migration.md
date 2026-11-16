# Google Maps migration

All website map renderers now use the Google Maps JavaScript API through `components/ui/map.tsx`. This covers the main dashboard, the older dashboard example, Fleet Map, Fleet Map 1, Fleet Map 2, both legacy fleet examples, warehouse forms/details, user address forms, walk-in delivery destination picking, and map examples (`test-3`, `test-9`). Pages already using the shared map inherit the replacement without changing their business logic.

## Configuration

The existing `GOOGLE_MAP_API_KEY` in `frontend/.env` is supported. `next.config.ts` exposes it to the browser as `NEXT_PUBLIC_GOOGLE_MAP_API_KEY`; an explicitly supplied public key takes precedence. The actual `.env` and key value were not changed or committed. Restart the Next.js server after applying the changes; production builds need the variable available at build time.

Enable Maps JavaScript API and billing for the key's Google Cloud project, and restrict the browser key to the application's HTTP referrers. Optionally set `NEXT_PUBLIC_GOOGLE_MAP_ID` to a Google vector map ID. The default is Google's `DEMO_MAP_ID`.

The SDK is loaded once across simultaneous maps and dialogs. Failed loads can be retried, and Google authorization failures display a configuration error. Google's attribution stays visible. Light/dark themes use Google's color scheme. Changing theme reconstructs the native map while preserving its camera.

Existing `[longitude, latitude]` data is converted at the Google boundary. Custom markers, coordinate click/drag callbacks, tooltips, popups, route colors/dashes, zoom, north reset, location, fullscreen, camera focus, resize, fit bounds, and follow interruption are supported. Camera updates use Google's `moveCamera`/`panBy` behavior; legacy animation durations are not reproduced. Fleet Map 1's 3D toggle enters street zoom (at least 17) for Google's tilt support. Actual tilt and buildings depend on Google's coverage and capabilities.

Address search and server-side road routing continue using their existing services. Route geometry is now displayed as Google polylines. This migration does not replace those services with Google Places or Google Routes.

## Every changed file

Paths below are relative to `hy_ops/frontend`. This list includes only changes made for this migration; unrelated existing workspace edits were preserved.

| File | Change |
| --- | --- |
| `.env.example` | Document the existing key name and optional Google map ID. |
| `next.config.ts` | Make the configured browser Maps key available to the shared renderer. |
| `lib/google-maps.ts` | Add the shared SDK loader, error handling, coordinate conversion, and camera/event adapter. |
| `types/google-maps.d.ts` | Declare the subset of the browser SDK used by the app, without adding a runtime package. |
| `components/ui/map.tsx` | Replace MapCN/MapLibre with Google maps, advanced markers, info windows, tooltips, polylines, and controls; remove unused MapLibre visualization primitives. |
| `components/static/dashboard-map.tsx` | Replace the older Leaflet dashboard renderer with the shared Google map. |
| `app/(protected)/panel/(main)/page_1.tsx` | Remove both Leaflet stylesheet imports. |
| `app/globals.css` | Remove obsolete MapLibre popup/attribution rules and hidden Leaflet attribution. |
| `app/(protected)/panel/fleet-map-1/components/map-canvas.tsx` | Remove MapLibre layer contrast mutations and use Google-compatible zoom for 3D. |
| `app/(protected)/panel/fleet-map-1/components/map-perspective.tsx` | Replace OpenFreeMap extrusion layers with Google tilt observation. |
| `types/geocode.ts` | Replace the obsolete OpenFreeMap style option with a Google option. |
| `app/(protected)/panel/fleet-map-old/provider.tsx` | Match the renamed Google 3D option. |
| `app/(protected)/panel/fleet-map-old/components/viewport-debug.tsx` | Rename the legacy example's style selection. |
| `app/(protected)/panel/test-9/deliver-map.tsx` | Update the coordinate convention comment. |
| `components.json` | Remove the MapCN component registry. |
| `package.json` | Remove MapLibre/React Leaflet/Leaflet types and add `test:maps`. |
| `bun.lock` | Update dependencies after removing the old map libraries. |
| `live-tests/google-maps.ts` | Add a deterministic Google SDK fixture shared by browser tests. |
| `live-tests/dashboard-map.spec.ts` | Install the Google SDK fixture for dashboard checks. |
| `live-tests/fleet-map-1.spec.ts` | Replace Carto basemap mocks with the Google SDK fixture. |
| `live-tests/fleet-map-1-dispatch.spec.ts` | Replace vector-tile/worker fixtures and OSM assertions with Google map checks. |
| `live-tests/operations.spec.ts` | Replace the obsolete basemap fixture with the Google SDK fixture. |
| `live-tests/selected-workflows.spec.ts` | Use the Google SDK fixture and Google map selector in dialogs. |
| `map-tests/harness.tsx` | Add a standalone React harness for concurrent maps and interactions. |
| `map-tests/google-maps.spec.ts` | Test SDK sharing, markers, tooltips/popups, route options, coordinate picking/dragging, 3D reset, retry, and authorization failures. |
| `map-tests/typescript-loader.cjs` | Transpile the standalone test harness with the installed TypeScript compiler. |
| `playwright.maps.config.ts` | Run the standalone Chromium tests without a backend or database. |
| `docs/fleet-map-1.md` | Update the current map-provider and 3D testing descriptions. |
| `docs/google-maps-migration.md` | Record setup, behavior, full file list, and verification. |

## Verification

- `node node_modules/@playwright/test/cli.js test --config playwright.maps.config.ts`: **3 passed**. These run the actual shared React map component against a mocked Google SDK; no live API key is included in the test bundle.
- Source-only TypeScript checking: **passed**, covering application source, the standalone map tests, and the Google browser fixture.
- ESLint: **passed** for migration application code and browser tests.
- `bun test ./tests`: **73 passed, 1 failed**. The failure is the existing `fleet-road-routing.test.ts` scheduled-preview expectation at line 159, already documented in `fleet-map-1.md` before this migration. Bun also printed a parent-directory `EPERM` message under the sandbox.
- The ordinary full-project TypeScript command is blocked by pre-existing syntax errors in `.next-live-fixture/dev/types/routes.d.ts` and `validator.ts`. Generated files were not modified.
- Database-backed live workflow tests were updated but not run. Real Google tiles, real key authorization/billing/referrer settings, and Google building coverage were not verified in this environment.

SDK behavior follows Google's [loader documentation](https://developers.google.com/maps/documentation/javascript/load-maps-js-api), [advanced marker guide](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration), and [JavaScript API reference](https://developers.google.com/maps/documentation/javascript/reference).
