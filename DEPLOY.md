# Deployment Guide

## What is live now
- Email/password auth (built-in)
- OAuth login buttons for Google/OpenAI/Claude/Grok
- Per-user card/saved/graph state
- Per-user custom knowledge CRUD at `/my-knowledge`

## 1. Local Testing Checklist

1. Install and run:
```bash
npm install
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000)

3. Test auth:
- Go to `/signup`
- Create an account
- Confirm redirect to `/practice`
- Log out and log in again

4. Test private routes:
- Visit `/saved`, `/knowledge`, `/my-knowledge` while logged out
- Confirm redirect to `/login`

5. Test user knowledge CRUD:
- Open `/my-knowledge`
- Add item
- Edit item
- Delete item

6. Test saved delete:
- Save a card in `/practice`
- Open `/saved`
- Click `Delete`

Note:
- In local development, social buttons work even without OAuth keys using a dev-only bypass.
- In production, real OAuth credentials are required.

## 2. Database Setup (Recommended: Neon Postgres)

1. Create a Neon project.
2. Copy pooled `DATABASE_URL`.
3. Run `schema.sql` in Neon SQL editor.

## 3. Google OAuth Setup

1. In Google Cloud Console, create OAuth credentials.
2. Authorized redirect URI:
- Local: `http://localhost:3000/api/auth/oauth/google/callback`
- Prod: `https://YOUR_DOMAIN/api/auth/oauth/google/callback`
3. Set env vars:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
4. Restart the app after changing env:
```bash
npm run dev
```
5. Test:
- Open `/login`
- Click `Continue with Google`

## 4. Environment Variables

Use `.env.example` as the template.

Required in production:
- `DATABASE_URL`
- `APP_BASE_URL`

Optional providers:
- Google via `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- OpenAI/Claude/Grok via `*_OAUTH_*` values

## 5. Deploy to Vercel (fastest path)

1. Push repo to GitHub.
2. Import project in Vercel.
3. Add env vars from `.env.example`.
4. Deploy.

Build settings:
- Framework: Next.js
- Build command: `next build`
- Output: default

## 6. Deploy to Cloudflare Pages (current stack compatible)

1. Connect repo in Cloudflare Pages.
2. Build command:
```bash
npx @cloudflare/next-on-pages@1
```
3. Output directory:
```text
.vercel/output/static
```
4. Add production env vars.

## 7. Post-Deploy Smoke Test

After deploy:
1. Visit `/signup`
2. Create account
3. Add/edit/delete an item in `/my-knowledge`
4. Save and delete a card in `/saved`
5. Test Google login
