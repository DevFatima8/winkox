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

SUPER_ADMIN_NAME=Super Admin
SUPER_ADMIN_ID=WX-ADM-0001
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_PHONE=03000000000
SUPER_ADMIN_PASSWORD=replace-with-a-strong-password
SUPER_ADMIN_DEPOSIT_LIMIT=0
```

`MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, and `MYSQL_PASSWORD` must point to a reachable database. For hosted MySQL, replace `127.0.0.1` with the database host supplied by the hosting provider and use the provider's SSL requirement.

The app uses MySQL when these variables are configured. Browser-side development utilities can use the LocalDB fallback, but production server operations require MySQL. A configured but unreachable MySQL server will cause login, signup, seed, and other server-side operations to fail.

## Database setup

The application creates its JSON-backed tables on first server connection. To test the configured MySQL connection and ensure the tables manually, run:

```bash
node scripts/test-mysql.mjs
```

The script requires the same `MYSQL_*` variables as the application and does not create a database; create the database and user first.

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

Server data is stored in MySQL when the database environment is configured. LocalDB data, when used by browser-side development utilities, is stored in browser storage and is separate from MySQL.

Do not reset a shared or production database casually. For browser LocalDB testing, clear the site's local storage from browser developer tools. For MySQL, use an intentional backup and migration process instead of deleting tables manually.

## Deployment

Set all required `MYSQL_*` and `SUPER_ADMIN_*` variables in the hosting provider's environment settings, then deploy the Next.js application. Verify the database connection with the provider's host, port, credentials, database name, and SSL settings before testing login or signup.


