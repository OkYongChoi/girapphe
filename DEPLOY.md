# Test/Dev/Prod Runbook

## 1. Environment Model

The app has two storage modes.

1. DB mode (`DATABASE_URL` set)
- Auth users/sessions and app data are stored in Postgres.

2. Local fallback mode (`DATABASE_URL` missing)
- Auth data is stored in:
  - `/.local/auth-store.json` (project root)
- Session is stored in browser cookie:
  - `psb_session`

Use fallback only for local development.

## 2. Local Dev

1. Install
```bash
npm install
```

2. (Optional) create `.env.local`
```bash
cp .env.example .env.local
```

3. Start
```bash
npm run dev
```

4. Open
- `http://localhost:3000`

5. Quick checks
```bash
npm run check
```

6. App smoke check (server must already be running)
```bash
npm run smoke
```

## 3. Test Strategy

Use this order in CI/local:

1. Static quality gate
```bash
npm run lint
npm run typecheck
```

2. Runtime smoke
```bash
npm run dev
npm run smoke
```

3. Health endpoint verification
- `GET /api/health`
- expected:
  - `200` with `"status":"ok"` in local fallback or DB healthy
  - `503` when DB configured but unavailable

## 4. Production Required Config

Required:
- `DATABASE_URL`
- `APP_BASE_URL`

Optional (OAuth):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- other providers via `*_OAUTH_*`

## 5. Production Deploy - Vercel

1. Push repo to GitHub.
2. Import project in Vercel.
3. Configure env vars:
- `DATABASE_URL`
- `APP_BASE_URL`
- OAuth vars (if used)
4. Build command:
- `npm run build`
5. Deploy.

Post deploy:
```bash
curl -sS https://YOUR_DOMAIN/api/health
```

## 6. Production Deploy - Cloudflare Workers (OpenNext)

1. Ensure Cloudflare auth:
```bash
npx wrangler whoami
```
2. Build Next.js output for Cloudflare Workers:
```bash
npm run build:cf
```
3. Deploy worker:
```bash
npm run deploy:cf
```
4. Set env vars in Worker settings:
- `DATABASE_URL`
- `APP_BASE_URL`
- OAuth vars (optional)
5. Deploy via CI/CD (optional):
- connect repository and run `npm run deploy:cf` in pipeline

## 7. Manual Steps You Must Do Yourself

These cannot be completed automatically by code changes:

1. Provision production DB and run `schema.sql`.
2. Set production environment variables on hosting platform.
3. Configure OAuth provider consoles with exact callback URLs.
4. Add custom domain and HTTPS settings in hosting platform.
5. Run live smoke test against real domain after each deploy.

## 8. Manual Release Checklist

1. `npm run check`
2. `npm run build`
3. Deploy to staging/prod
4. Verify:
- `/api/health`
- signup/login/logout
- `/practice`, `/saved`, `/my-knowledge`, `/knowledge`
- `/knowledge` default opens 3D view
- navbar active link highlight works on each route
- saved/my-knowledge filter `Clear` resets query params
5. Verify DB writes (new user/session row)
6. Verify rollback plan (previous deployment available)
