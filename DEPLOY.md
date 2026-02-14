# 🚀 Deployment Guide

## 1. Stack Overview
- **Frontend**: Cloudflare Pages (Next.js)
- **Database**: Neon (Serverless Postgres)
- **Auth**: Clerk
- **Storage**: Cloudflare R2 (S3-compatible)

---

## 2. Database Setup (Neon)

1. Go to [Neon Console](https://console.neon.tech).
2. Create a new project.
3. Get the **Connection String** (Pooled connection recommended, usually ends with `?sslmode=require`).
4. Run the schema creation SQL in the Neon SQL Editor (copy content from `schema.sql`).

---

## 3. Auth Setup (Clerk)

1. Go to [Clerk Dashboard](https://dashboard.clerk.com).
2. Create an application.
3. Get `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

---

## 4. Storage Setup (Cloudflare R2)

1. Go to Cloudflare Dashboard > R2.
2. Create a bucket (e.g., `eng-cards-assets`).
3. Manage R2 API Tokens > Create Token.
   - Permissions: Admin Read/Write
   - Copy `Account ID`, `Access Key ID`, `Secret Access Key`.

---

## 5. Deploy to Cloudflare Pages

1. **GitHub**: Push your code to a repository.
2. **Cloudflare Dashboard**:
   - Go to "Workers & Pages" > "Create Application" > "Pages" > "Connect to Git".
   - Select your repo.
3. **Build Settings**:
   - **Framework Preset**: `Next.js`
   - **Build Command**: `npx @cloudflare/next-on-pages@1`
   - **Output Directory**: `.vercel/output/static` (Default for next-on-pages)
   - *Note*: If the build fails, try adding `"pages:build": "npx @cloudflare/next-on-pages"` to your `package.json` scripts and use `npm run pages:build`.

4. **Environment Variables** (Add these in Cloudflare Settings):
   - `DATABASE_URL`: `postgres://...` (Neon)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: `pk_test_...`
   - `CLERK_SECRET_KEY`: `sk_test_...`
   - `R2_ACCOUNT_ID`: `...`
   - `R2_ACCESS_KEY_ID`: `...`
   - `R2_SECRET_ACCESS_KEY`: `...`
   - `NODE_VERSION`: `20` (Optional, good practice)

5. **Deploy!**

---

## 6. Local Development

To run locally with this stack:
1. Create `.env.local` with all the above keys.
2. `npm run dev`.
