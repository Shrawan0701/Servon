# Local development

Work locally without pushing backend edits to Render:

| Component | Local address |
| --- | --- |
| Backend + Socket.IO | `http://localhost:5000` |
| Hotel/business web app | `http://localhost:8081` |
| Customer web app | `http://localhost:3000` |
| PostgreSQL | `127.0.0.1:5432`, database `servon` |

## Start the apps

Run each in its own terminal from the repository root:

```powershell
cd backend
npm run dev
```

```powershell
cd mobile-app
npm run web
```

```powershell
cd customer-web
npm run dev
```

`npm run dev` in the backend uses nodemon: saving backend source or local environment files restarts the local server. Expo and Vite update their apps while developing. Restart Expo/Vite after changing environment files, then reload the browser. Stop a server with Ctrl+C before starting another on its port.

## Environment files

Local files were configured in this workspace and are ignored by Git:

- `backend/.env.development.local`: local PostgreSQL connection, backend port 5000, hotel origin 8081, and `CUSTOMER_URL=http://localhost:3000` for newly generated table QR codes.
- `mobile-app/.env.development.local`: `EXPO_PUBLIC_API_URL=http://localhost:5000` and `EXPO_PUBLIC_ADVISOR_API_URL=http://localhost:5000/api`.
- `customer-web/.env.development.local`: `VITE_API_URL=http://localhost:5000/api`.

The local backend sets `ENABLE_BACKGROUND_JOBS=false`, so the development copy does not run scheduled summaries or subscription reminders. Production retains its existing default of running those jobs. Manually requested app features still use the configured provider keys.

The backend resolves environment files using absolute paths. Hosting/shell variables take precedence; development overrides load before `backend/.env` so existing JWT/provider keys continue working. Development overrides are excluded when `NODE_ENV=production` or `test`. Render's existing environment variables remain the production configuration. Expo/Vite production builds exclude `.env.development.local` and use their existing production build variables. The existing hotel `.env` Render URL is retained for that purpose. Shared hotel API configuration now also controls login, advisor, Socket.IO and download links.

All `.env` files, including local overrides and `.local.example` templates, are excluded from Git. On another computer, create the local files listed above and set the backend `DATABASE_URL` to that computer's PostgreSQL connection. Never put database credentials in `EXPO_PUBLIC_*` or `VITE_*` variables.

## pgAdmin

pgAdmin is the database client; PostgreSQL is the local server. This computer already has PostgreSQL 17 running and a `servon` database. In pgAdmin use:

- Host: `127.0.0.1`
- Port: `5432`
- Maintenance database: `postgres`
- Username: `postgres`
- Password: your existing local PostgreSQL password (also used by the ignored backend local configuration)

Expand **Databases → servon** to inspect the database the local backend uses. No Railway connection is required for local requests.

Local `servon` was refreshed from a consistent Railway backup on 28 October 2026. All 35 restored tables, their column definitions/types and every table's row count were verified against the backup snapshot before switching databases. The prior local database remains available as `servon_before_railway_20261028231910` (connections disabled), and both database dumps plus the verification report are in `%LOCALAPPDATA%\Servon\backups`. Refresh the Databases node in pgAdmin to see the restored `servon` schema. This is a separate development copy: future Railway schema/data changes do not synchronize automatically. Use `npm run inventory:check` for a read-only schema inspection; migration commands target the connection selected by the same environment loader.

### Restore Railway into local servon

`npm run db:clone:railway` in `backend` performs an explicitly requested refresh of the local database. Supply the public source connection in the ignored `backend/.env.railway.local` file as `RAILWAY_DATABASE_URL`. The target remains the `DATABASE_URL` selected by local development configuration; the script refuses any target other than a loopback `servon` database. PostgreSQL 18 client tools are required for the current Railway server. Tools can be taken from the official [EDB Windows binary distribution](https://www.enterprisedb.com/download-postgresql-binaries); the default client directory is `%LOCALAPPDATA%\Servon\tools\postgresql18\pgsql\bin`, or set `PG18_BIN` in the shell.

The source is read only. The script backs up local `servon`, takes a consistent Railway snapshot, restores into a new temporary local database, and compares table names, columns/types, and every table's row count against that same snapshot. Only after verification does it disconnect local sessions and atomically rename the staged database to `servon`. The old local database is retained as `servon_before_railway_<timestamp>` with connections disabled, and both custom-format dumps plus a JSON report are kept under `%LOCALAPPDATA%\Servon\backups`. No database is dropped. If restoration/validation fails, the existing local database is retained. Refresh the Databases node in pgAdmin after a successful switch, and restart the local backend. The result is a point-in-time copy, not continuous replication; future Railway changes do not appear locally automatically.

## Physical phone / emulator

On a physical phone, `localhost` points to the phone. Change the ignored hotel API URLs to the PC's Wi-Fi IPv4 address (for example `http://192.168.1.10:5000` and the same address ending in `/api`). Keep both devices on the same network and allow local backend traffic through Windows Firewall. Start Expo with `npm start` for Expo Go. Android Emulator can use `http://10.0.2.2:5000`; desktop web uses `localhost`.

For customer QR testing on a physical phone, also use the PC's LAN address in backend `CUSTOMER_URL`, start Vite with `npm run dev -- --host 0.0.0.0`, and include the customer browser's origin in the backend's allowed CORS origins. Old printed QR codes still contain their original deployed URLs; generate a local QR to test the local customer app. Hosted apps continue to call Render until their own deployed configuration changes.

If your browser has cached a production login or pending offline orders, use a fresh browser profile/private window for local testing or log out before signing into local data.
