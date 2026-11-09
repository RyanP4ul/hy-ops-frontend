# Lalamove delivery workspace

## Design intent

**User / moment / type:** Operations staff preparing a courier delivery or checking an existing booking during daily dispatch. This is an operational workspace.

**Questions, ranked:**

1. Which orders are ready for a courier, and which bookings need attention?
2. Is this order's pickup contact, destination, and vehicle service correct?
3. What will the courier cost, and what action should I take next?
4. Has the driver been assigned, picked up the goods, or completed delivery?

## Layout and behavior

- Overview: environment and update time, scoped counts, ready-order cards, searchable booking history, status filters, and pagination. Settings are a separate administrator tab.
- Order: three booking steps, a pickup/drop-off route, saved warehouse pickup selection with save feedback, city and vehicle selection, and a quotation panel that stays visible on desktop.
- Pickup now uses saved warehouses through `components/paginated-combobox.tsx`, with scoped search, ten options per page, a name/address/phone preview, save feedback, and persistence after reload. Warehouse phone numbers are managed in the warehouse create/edit form. The order's stock warehouse remains separate from its selected courier pickup warehouse.
- Quotation: prominent courier fee, price-validity countdown, fee breakdown, package confirmation, and an explicit booking action. Requesting a quote does not book a courier.
- Booking: readable status, delivery progress, tracking, synchronization freshness, refresh action, and a separate confirmation before cancellation. Previous attempts and technical reconciliation tools are disclosures.
- Mobile: two-column headline counts, full-width review count, stacked order sections, and booking history cards. Links retain native link semantics; forms have visible labels and pending/error feedback. Quotation focus moves to the review heading after a successful request and respects reduced-motion preferences.
- Search, status filter, history page, and selected tab persist in the URL. Search applies to loaded records. Ready orders are limited to the latest 100; booking history contains up to 50 records per page. Counts disclose these scopes and do not imply global totals or invented comparisons.

**Formatting:** Currency uses `Intl.NumberFormat` with the provider currency, defaulting to PHP. Dates use `Intl.DateTimeFormat` in `Asia/Manila`. Zero fees remain zero; missing or invalid fees show “Not available.” Status uses both text and color.

**States covered:** Per-section loading skeletons, empty results with reset actions, partial data with scoped labels, synchronization staleness, recoverable query errors with retry, quote expiry, pending mutations, save success/failure, and zero versus missing amounts.

## Verification

- Visual review at 1440px desktop and 390px mobile: ready/review counts, next booking action, courier price, and status are visible with explanatory labels. No horizontal overflow at the tested mobile width.
- Five browser tests passed using isolated local authentication and mocked courier responses: saved warehouse search/pagination, saving/error/persistence and missing-phone feedback, quotation and explicit confirmation, administrator settings, URL filter/search persistence and mobile layout, and cancellation confirmation/dismissal.
- The backend's 21-test disposable database suite passes, including pickup selection persistence, staff scope, quotation invalidation, and warehouse phone create/update/listing behavior. A new migration is required for `warehouses.phone_number` and `orders.lalamove_pickup_warehouse_id`; see `backend/docs/lalamove-integration.md`.
- Scoped ESLint passed; all 41 frontend unit tests passed; the production build passed, including TypeScript and prerendering.
- Existing backend validation, delivery-method eligibility, explicit package confirmation, quotation expiry, and idempotent booking retries remain in use. These checks do not create real courier bookings or verify live credentials.

Build verification used `.next-build-check`. Two malformed generated files from the isolated browser-test cache were removed before the successful build; application source required no build workaround.
