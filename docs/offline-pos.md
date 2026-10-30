The core POS workflow saves on the device before starting any network work. This
applies to manual orders, item additions/removals, status changes, cancellation,
bill checkout, customer dues, clearing dues, and table creation/deletion. Cached
menu, table, order and customer-dues screens render before background refreshes.
There are no offline banners, upload counters, or sync notifications in the UI.

Browser storage uses IndexedDB. Native storage uses the existing SQLite database
with a snapshot table. Each save commits the displayed records and their upload
commands together. Storage failures reject the operation rather than reporting a
successful save. Each business has a separate snapshot; legacy caches and queued
work migrate without deleting the original storage. Web Locks and IndexedDB
revision checks protect concurrent browser tabs.

The background worker processes dependent commands in order, resolves local table,
order and dues IDs, and retries transient failures with bounded backoff. Requests
have an eight-second timeout and stable idempotency keys. Permanent conflicts are
kept in the stored queue for diagnosis, with dependent changes preserved. They are
not silently discarded or allowed to overwrite another device's work. Unrelated sales continue syncing while a conflicting record is held. Automatic
downloads preserve records with pending changes, including cleared dues.

Checkout stores a receipt and all paid order states in one device commit. The
server checks the printed items/totals and closes exactly those orders in one
transaction. Dues and table creation also use server idempotency. Original staff
order timestamps survive delayed uploads. Printed UPI QR images are generated
locally; reprinting uses the saved receipt rather than current menu/tax settings.

An account must be signed in and its menu/tables downloaded before disconnected
use. Production web builds cache the app shell, including locally hosted builds.
Metro development builds deliberately avoid service-worker caching. Printer
connectivity is still required for physical printing. Inventory scanning, AI and
remote kitchen/customer updates continue to require the server.

Validation: run `node --test tests/*.test.cjs` in `mobile-app`, and `npm test` in
`backend`. PostgreSQL integration tests require `INVENTORY_TEST_DATABASE_URL` to
point to an isolated local database whose name ends in `_test`. The integration
suite creates and removes its own schema. It covers duplicate requests, exact
checkout, discounts, stale-bill conflicts, tenant isolation and stock accounting.
