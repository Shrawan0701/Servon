# Inventory scanning and recipes: implementation and deployment

This upgrade extends the existing Expo/React Native inventory screen (including its web version), Express inventory routes, `menu_item_ingredients`, `inventory_items`, `inventory_stock_logs`, and order helper. Render remains the backend, Railway remains PostgreSQL, and Vercel remains the web host. No deployment or live database migration is performed by development checks.

## Accounting rules

- `inventory_items.current_stock` remains expected stock. Existing stock balances are preserved; quantities support six decimal places.
- A scan stores suggested detections and a snapshot of expected stock **when analysis is requested**. Staff review, map, exclude, and correct detections. Confirmation writes physical counts, their units, bottle breakdowns, confirmer and timestamp; it does not update expected stock.
- Photograph the whole stock pool being counted, immediately before analysis, and avoid movements during capture. A partial shelf count must not be reconciled as the whole restaurant's stock. Photos from an earlier date cannot establish an accurate current baseline.
- Owner reconciliation applies `physical - expected_at_scan` to the current balance. Sales/restocks since the snapshot are preserved. A later physical adjustment invalidates an overlapping unreconciled photo count, preventing two photos from applying the same shortage twice. Every adjustment is logged and linked to the count. Repeated confirmations/reconciliations are harmless.
- Full bottles and opened stock are disjoint: `3 × 650 ml + 90 ml = 2,040 ml`. Opened volume is manual and must be less than one full bottle; full bottles belong in the full-bottle count. `bottle_size` on the existing stock record remains expressed in **that record's stock unit**, matching the existing Add Stock UI; physical-count `bottle_size_ml` and `opened_ml` are always millilitres. Thus an existing litre stock with `bottle_size=0.65` is presented as 650 ml in scan review. Count-based products use `pcs`; volume servings use `ml` or `litre` stock.
- Preparations use **Option B (recipe expansion)**. A preparation is a recipe definition, not a separate stock item. A sale expands its ingredients into raw stock consumption using `used preparation / usable batch yield`. No raw ingredients are deducted when defining or editing a preparation. No prepared stock is added or deducted. Nested preparations are allowed; cycles and graphs deeper than 20 levels are rejected.
- Expected usable yield is `yield_quantity × (1 - wastage_percent/100)`. Enter expected yield before the optional wastage adjustment; use zero wastage if the configured yield is already net of waste. Actual batch production/stock is intentionally outside this accounting model.
- Recipes accept stock items and preparations, and compatible unit conversions (`gm`/`g`/`kg`, `ml`/`litre`). Quantities are normalized to the referenced stock/preparation unit. Duplicate ingredients, nonpositive values and incompatible units fail the entire save. Separate veg/non-veg preparations and pools can be created intentionally; names/categories never imply an ingredient recipe.
- Bulk **merge** updates only chosen ingredient mappings and preserves all unrelated ones. **Replace** removes the selected dishes' previous recipe mappings. Preview displays the before/after lists and per-dish editable quantities. Apply is atomic across at most 250 dishes; a failure rolls back every dish and identifies the failing menu ID. A preview token detects intervening recipe edits. Recipe indicators show configured mappings, not a claim that a chef has verified recipe completeness.

## Orders and historical compatibility

New orders retain the existing immediate `CONFIRMED` behavior and deduct at creation. Forward status changes synchronize the same order state rather than introducing another deduction. Appending/removing items updates that state in the same PostgreSQL transaction as the order. Table-wide payment synchronizes all affected active orders. The legacy editable-order timer remains supported.

Each order line stores per-serving raw ingredient consumption. Repeated events compute no additional movement. Removal/rejection refunds the stored quantities once, even if a dish/preparation recipe later changes. New quantities of an existing line retain that order's original recipe snapshot. The unique persisted state, tenant advisory lock, and atomic balance updates protect concurrent orders and insufficient-stock failures. One business's inventory writes are serialized; unrelated businesses can write concurrently. Lock waits are bounded at 15 seconds.

The current codebase has no payment-refund-to-stock policy or structured modifier ingredient definitions. `REJECTED` is the existing inventory reversal event; a monetary refund alone does not imply stock is returned. Portion/liquor variants with different menu IDs have independent recipes. Free-text thali customizations do not invent deductions. Unconfigured new dishes remain untracked until recipes are explicitly configured.

The migration seeds historical order state from existing **net** order movement logs and snapshots orders without earlier deductions as untracked. It never re-deducts those sales using today's recipes. Additional quantities use new recipe snapshots. Old logs do not identify which dish consumed each ingredient; consequently a partial removal from a pre-upgrade order is rejected when it would require guessing historical attribution. Cancel the complete old order and create a corrected order instead. Full cancellation restores its recorded net movements once. Existing over-refunds or balance errors from the old code are not silently repaired.

Client order creation and append calls send `Idempotency-Key`. Offline sync uses persistent local action/record IDs so a failed upload response can be retried safely. External clients should reuse the same key and identical payload on retries; a key reused with a different payload returns 409. A new intentional order needs a new key. Direct calls without keys retain API compatibility; repeating creation/append without a key is a new request. Request-key records are retained to preserve retry protection; set a retention policy only with a matching client retry horizon.

## Authentication and isolation

All inventory APIs use the existing Bearer-token middleware and the business ID from the verified token. Catalogue matching, recipe references, counts and adjustments validate ownership. New relational tables use composite business/record foreign keys. Existing direct recipe tables gain ownership foreign keys with `NOT VALID`: future writes are checked while old inconsistent data remains intact for review.

This checkout issues business-owner tokens and has no branch relationship or staff login model. Each business/account is an isolated stock pool. No parent account or browser-supplied branch ID can read/adjust another pool. If production has an additional branch authorization system absent from this checkout, connect its verified branch context before enabling shared-business branch pools; this implementation does not invent cross-branch permissions. Tokens with a staff role require explicit `inventory:adjust` permission for reconciliation/adjustment and inventory configuration; owner/admin business tokens retain existing access. Audit actors use the token subject/staff ID where available, otherwise `business:<id>`.

Deleting a stock item archives it so balances, historical movements and cancellation references survive. Remove it from recipes/preparation definitions first. Changing an existing stock unit is blocked: recipes provide unit conversions without reinterpreting past balances. Existing cards, Add Stock and liquor brand/variant grouping remain available.

## Vision provider setup

Set these **server-side on Render**, never as `EXPO_PUBLIC_*` or `VITE_*` variables:

| Variable | Default / purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required to analyze photos; existing OpenAI integration key can be reused |
| `INVENTORY_VISION_PROVIDER` | `openai`; currently the supported adapter |
| `INVENTORY_VISION_MODEL` | `gpt-4o-mini`; override with a model supporting image input and strict JSON-schema responses |
| `DATABASE_URL` | Existing Railway PostgreSQL connection string |
| `NODE_ENV` | Existing Render `production` setting, preserving the project's PostgreSQL SSL convention |
| `JWT_SECRET` | Existing backend token secret |

OpenAI image analysis is a billed dependency; no API call is made when the key is absent. The adapter sends actual image input and a strict response schema, then validates parsed values, catalogue membership and confidence. It has a 45-second timeout and no automatic provider retries. Exact unique catalogue names at confidence ≥0.8 may be preselected; uncertain matches require manual mapping. The frontend always requires human confirmation. Duplicate aggregate labels are rejected rather than summed. Counts are approximate, and neither confidence nor a structured response guarantees correct counting. See the official [image input documentation](https://developers.openai.com/api/docs/guides/images-vision) and [structured output documentation](https://developers.openai.com/api/docs/guides/structured-outputs).

The detection adapter lives in `backend/services/inventoryVision.js`; replacing `detect(image, catalogue)` with a specialized counting service does not require replacing counts, recipes or reconciliation.

Only one JPEG, PNG or WebP up to 5 MB is accepted, with content-signature/MIME checks. Bytes are transmitted privately to the configured provider and discarded after the request; raw images are not stored, no Cloudinary duplicate is created, and no public photo URL is exposed. The audit stores image hashes and structured results, not source photographs. Identical photo/catalogue submissions reuse prior analysis; take a fresh photo for a new count. Six new scans per business per minute are allowed. Failed requests are recorded and may be retried without fabricating detections. In-flight duplicate requests return 409, and a stale in-flight record can be retried after two minutes.

The existing Expo image picker dependency is reused; its config plugin adds camera/photo permission descriptions. Native camera support requires rebuilding the mobile binary with the updated app configuration. Web/mobile browsers can upload images; supported phone upload choosers may also offer camera capture. HEIC images must be converted to a supported format.

## Safe deployment steps (performed by the deployer)

1. Back up the Railway database and test against a staging copy of its **actual deployed schema**. The local environment may point at a different/incomplete database; absence of a local table does not establish production's schema.
2. In `backend`, with the intended Railway connection configured, run `npm run inventory:check`. This script only reads schema metadata, prints column types/constraints and never applies SQL. Review existing integer inventory IDs, UUID business/menu/order IDs, units, column precision and ownership constraints. The migration refuses unsupported inventory ID types or quantities with more than six decimal places instead of converting them silently.
3. Pause order/inventory writes while switching backend versions, so old code cannot create deductions outside the new ledger during migration. Run **only** `npm run migrate:inventory`. It applies `db/migrations/20261028_inventory_upgrade.sql` once in a transaction and records the version. Existing tables/data are retained; missing legacy inventory tables are created only if absent. Decimal precision is widened, ownership indexes/constraints are added, and history is seeded. The runner has a bounded DDL lock wait and rolls back on errors. Re-running reports that the version is already applied. Do not use the unrelated full `db/migrate.js` initializer as this upgrade's production migration command.
4. Deploy the matching backend code to Render, set the server vision configuration, then deploy the `mobile-app` web bundle and `customer-web` update to Vercel. Keep the existing API origin variables. Rebuild the native application if camera capture is needed. No new hosting service, provider account or frontend secret is introduced.
5. Verify a normal sale, cancellation, Add Stock, a recipe with a preparation, and a reviewed scan on staging before reopening writes. A scan without reconciliation must leave expected stock unchanged.

Migrations are never attached to server startup or the build command. No live deployment, remote migration, secret modification, or real billed vision request was performed during implementation. For application rollback, keep the additive schema and restore the previous backend/frontend build during a write pause; review movement reconciliation before resuming writes with older code.

## API reference

All inventory paths below are under `/api/inventory`, authenticated, and scoped to the token business. Configuration/stock mutations require owner permission.

| Method / path | Behavior |
| --- | --- |
| `GET /`, `GET /alerts/count` | Existing stock list and low-stock badge |
| `POST /`, `PUT /:id`, `DELETE /:id` | Create, edit, archive stock |
| `PATCH /:id/restock`, `PATCH /:id/adjust` | Existing stock workflows, now transactional and audited |
| `GET /history?offset=0` | Movement history, 50 entries per page |
| `GET /recipes`, `GET /recipes/:menuItemId` | Configured ingredient counts and full recipe |
| `PUT /recipes/:menuItemId` | Replace this dish's recipe atomically |
| `POST /recipes/bulk` | `{mode:'merge'|'replace', preview:boolean, preview_token?, changes:[{menu_item_id,ingredients}]}` |
| `GET /preparations`, `POST /preparations` | List/create preparation definitions |
| `PUT /preparations/:id` | Optimistic update; submit current `version` |
| `DELETE /preparations/:id` | Archive an unused preparation |
| `POST /scans` | Multipart `image` and optional `inventory_item_id`; reviewable suggestions only |
| `GET /scans`, `GET /scans/:id` | Last 50 scans and count/adjustment detail |
| `POST /scans/:id/confirm` | `{counts:[{inventory_item_id,full_bottles,bottle_size_ml,opened_ml}]}` or explicit `physical_stock` in the stock unit |
| `POST /scans/:id/reconcile` | Owner-only `{note:'reason'}` applies recorded variances once |

An ingredient is `{inventory_item_id,quantity_required,unit?}` **or** `{preparation_id,quantity_required,unit?}`. Omitting `unit` preserves the existing API contract (the referenced record's stock/yield unit). Preparation writes include `name`, `yield_quantity`, `yield_unit`, optional `wastage_percent`, `ingredients`, and `version` when editing. Existing order endpoints retain their paths and accept optional `Idempotency-Key` headers.

## Files and verification

Main changes: `backend/routes/inventory.js`, `routes/orders.js`, `utils/inventoryHelper.js`; new `services/inventory{Units,Recipes,Transaction,Vision}.js`, owner/transaction middleware, versioned SQL and explicit scripts; `mobile-app/src/screens/InventoryScreen.js`, new `InventoryRecipeEditor.js` and `InventoryTools.js`, image-picker app configuration; order API and offline retry keys; customer order retry keys. No new runtime dependency or UI framework was added.

Backend checks use Node's built-in test runner (the project had no test framework):

```powershell
cd backend
npm test
# To include PostgreSQL HTTP/concurrency/migration tests:
$env:INVENTORY_TEST_DATABASE_URL='postgresql://TEST_USER@127.0.0.1:TEST_PORT/servon_inventory_test'
npm test
```

Integration tests refuse non-local database hosts and database names without `_test`. They create an isolated, randomly named schema, apply the real migration to representative legacy tables, run actual HTTP requests and concurrent transactions, then remove only that test schema. With no explicit test URL they are skipped; unit tests never load production `.env` or call a real vision endpoint.

Coverage includes conversions, bottle/opened-volume totals, vision parsing/matching/uncertainty/errors, physical counts without stock changes, manual mapping, reconciliation retries/overlap, raw/preparation consumption, bulk merge/rollback/preview conflicts, legacy state, concurrent orders/last-unit contention, failed order rollback, cancellation after recipe changes, tenant/owner denial, liquor volumes and audit preservation. Vision responses are mocked; real photo accuracy and native device capture require deployment smoke testing. No existing lint/type-check scripts are configured in this JavaScript repository. Build checks use Expo web/Android export and Vite customer-web build; existing missing-favicon and Vite CJS warnings are unrelated to this change.

Implementation verification: all 25 backend checks passed with the explicit isolated PostgreSQL test URL. Expo web and Android exports and the customer Vite build passed. A headless Edge browser check exercised desktop/mobile layouts, bulk dish selection and preparation quantities, the existing recipe editor, image upload, an uncertain detection mapped manually to a stock item, manual opened volume, and confirmation that displayed physical count separately from unchanged expected stock. Browser API responses and vision results were mocked, and no external network writes were allowed.
