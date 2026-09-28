# winkox

winkox is a Next.js gaming and earning platform with a player lobby, original games, wallet flows, referrals, notifications, support chat, and a role-based admin panel.

## Requirements

- Node.js 20 or newer
- npm
- MySQL 8+ or a compatible MySQL/MariaDB server for server-side data

## Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Other commands:

```bash
npm run typecheck
npm run lint
npm run build
npm run start
```


Create a local `.env` file. Do not commit it.

```env
MYSQL_HOST=
MYSQL_PORT=3306
MYSQL_DATABASE=winkox
MYSQL_USER=winkox_user
MYSQL_PASSWORD=replace-with-your-password
MYSQL_SSL=false
NEXTAUTH_SECRET=replace-with-a-random-secret-at-least-32-characters

SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_ID=WX-ADM-0001
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PHONE=03000000000
SUPER_ADMIN_PASSWORD=replace-with-a-strong-password
SUPER_ADMIN_DEPOSIT_LIMIT=0
```

`MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` must point to a reachable database. For hosted MySQL, replace `127.0.0.1` with the database host supplied by the hosting provider and use the provider's SSL requirement.

All application data is stored in MySQL. Browser-side database access and LocalDB fallback are disabled. Configure a reachable MySQL database before running the app; missing or unreachable MySQL configuration causes data operations to fail rather than writing to a local store.

## Database setup

The application creates its JSON-backed tables on first server connection. To test the configured MySQL connection and ensure the tables manually, run:

```bash
node scripts/test-mysql.mjs
```

The script requires the same `MYSQL_*` variables as the application and does not create a database; create the database and user first.

Live chat uses the `supportthreads` and `supportmessages` JSON-document tables. The application creates them on startup; to create them manually, run [scripts/live-chat-schema.sql](scripts/live-chat-schema.sql) against the selected database. Users must sign in again after deploying the authenticated chat update so the server can issue a secure session cookie.

The schema reference for Hostinger deployments is in [scripts/hostinger-schema.sql](scripts/hostinger-schema.sql). The runtime model abstraction is in [src/lib/db-model.ts](src/lib/db-model.ts), with MySQL connection handling in [src/lib/mysql.ts](src/lib/mysql.ts).

## Authentication

On first initialization, the configured `SUPER_ADMIN_*` values are used to create the super-admin account if it does not already exist. There are no guaranteed built-in demo client, agent, or sub-admin accounts.

## Main areas

- `/` — public lobby and games
- `/games/[slug]` — guest game pages
- `/player` — authenticated player area
- `/player/wallet` — deposits and withdrawals
- `/player/team` — referrals and commissions
- `/admin` — protected admin dashboard
- `/admin/notifications` — platform broadcasts
- `/api/health` — health check

## Data and reset notes

User accounts, game activity, wallet transactions, referral commissions, notifications, and settings are stored in MySQL. Browser storage is not used as an application database.

Do not reset a shared or production database casually. Use an intentional backup and migration process instead of deleting tables manually.

## Deployment

Set all required `MYSQL_*` and `SUPER_ADMIN_*` variables in the hosting provider's environment settings, then deploy the Next.js application. Verify the database connection with the provider's host, port, credentials, database name, and SSL settings before testing login or signup.

### Hostinger (Node.js hosting)

Do not upload the raw project (without `node_modules`/`.next`) and rely on Hostinger to run `npm install` — its dynamic `mysql2` import is invisible to that flow and Hostinger will report the MySQL driver as missing. Instead, build a self-contained bundle locally and upload that:

```bash
npm install
npm run build
npm run package:hostinger
```

This produces a `deploy/` folder containing `server.js`, a pruned `node_modules` (with `mysql2` included), `.next/static`, and `public/`. Zip the **contents** of `deploy/` (not the project root) and upload/extract that on Hostinger. In hPanel's Node.js app settings:

- Startup file: `server.js`
- No `npm install` step needed — everything required is already inside `node_modules`
- Set the same `MYSQL_*`/`SUPER_ADMIN_*` environment variables in hPanel (or keep the `.env` file, which is already copied into `deploy/`)

Repeat `npm run build && npm run package:hostinger` and re-upload on every future deploy.



