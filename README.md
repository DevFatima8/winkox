# winkox (winkox.shop) — LocalDB / No-database edition

This build runs **without any server database**. All data (users, balances, games, rounds, chats, settings)
is stored in the browser's `localStorage`, so it deploys to Vercel with zero configuration.
Data is per-browser (open Admin and Client in two tabs of the same browser to test the full flow).

## Deploy to Vercel
1. Push this folder to GitHub.
2. vercel.com → Add New Project → import the repo → Deploy (no environment variables needed).
3. Add your domain (winkox.shop) in Project → Settings → Domains.

## Run locally
```bash
npm install
npm run dev      # http://localhost:3000
```

## Default login accounts (auto-created on first visit)
| Role | Login ID / phone / username | Password |
|---|---|---|
| Owner (hidden / mysterious admin) | `WX-SYS-0000` · `03999999999` · `system` | `owner@winx555` |
| Super Admin | `WX-ADM-0001` · `03000000000` · `superadmin` | `admin123` |
| Sub Admin | `WX-ADM-0002` · `03000000001` | `subadmin123` |
| Client (Rs. 50,000, PIN 1234) | `demo` · `03001234567` | `client123` |
| Client (Rs. 12,000, PIN 1111) | `ali` · `03211112222` | `ali123` |
| Agent | `agent` · `03007654321` | `agent123` |

Login page has a "Demo accounts" panel that fills these in with one tap.

## Reset data
Browser DevTools → Application → Local Storage → delete key `winx555_db_v1` (or clear site data).

## Connecting a real database later
`src/lib/localdb.ts` implements the Mongoose query subset used by the app. The original Mongoose schema is
preserved in `src/models/mongoose-schema.bak`; `src/lib/client.ts` maps the old `/api/*` routes to the
game engines. To go back to MongoDB: restore the schema, re-add the API routes, and point `localApi` to `fetch`.
