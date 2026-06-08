# Deployment Guide

Production topology:
- **Frontend (Next.js)** → Vercel
- **Backend (Express API)** → Railway (Nixpacks, runs via `tsx`; see `backend/railway.json`)
- **Database (Postgres)** → a dedicated **Neon** prod project (separate from dev)
- **Redis (OTP)** → Upstash

> Deploys run from `main`. Merge your changes to `main` first.

---

## 0. Provision the production database (Neon)

1. [Neon console](https://console.neon.tech) → **New Project** (e.g. `probalance-prod`), region near your users (Singapore/Mumbai).
2. Copy the **pooled** connection string — the one containing `-pooler`, with `sslmode=require`. This is your prod `DATABASE_URL`.
3. The new DB is empty — apply the schema from your machine (uses the committed `prisma/migrations`):
   ```bash
   cd backend
   DATABASE_URL="<neon-prod-pooled-url>" npx prisma migrate deploy
   ```
   Re-run this command whenever you add new migrations.

Keep this prod URL out of your dev `.env`; you'll paste it into Railway next.

---

## 1. Backend → Railway  *(do this first — the frontend needs the API URL)*

1. [Railway](https://railway.app) → **New Project → Deploy from GitHub repo** → select this repo.
2. Open the service → **Settings → Root Directory = `backend`** (this is a monorepo). Railway will read `backend/railway.json` and build with Nixpacks.
3. **Variables** (Settings → Variables):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon prod pooled URL (from step 0) |
   | `ACCESS_TOKEN_SECRET` | a fresh random string ≥ 32 chars (e.g. `openssl rand -base64 48`) |
   | `SMTP_USER` | your Gmail address |
   | `SMTP_PASS` | your Gmail App Password |
   | `UPSTASH_REDIS_REST_URL` | from Upstash |
   | `UPSTASH_REDIS_REST_TOKEN` | from Upstash |
   | `NODE_ENV` | `production` |
   | `FRONTEND_URL` | `https://placeholder` *(updated in step 3)* |

   Do **not** set `PORT` — Railway injects it and the app reads `process.env.PORT`.
4. Deploy. Then **Settings → Networking → Generate Domain**. Note the URL, e.g. `https://probalance-backend-production.up.railway.app`.
5. Verify: open `https://<backend>/health` → should return `{"message":"ProBalance server is running"}`.

---

## 2. Frontend → Vercel

1. [Vercel](https://vercel.com) → **Add New → Project** → import this repo.
2. **Root Directory = `frontend`** (Next.js auto-detected; installs from the committed `package-lock.json`).
3. **Environment Variables:**
   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<backend>.up.railway.app/api/v1` |

   The `/api/v1` suffix is required — the axios client appends route paths to it.
4. Deploy. Note the URL, e.g. `https://probalance.vercel.app`.

---

## 3. Close the loop (CORS + cookie origin)

1. Railway → service Variables → set `FRONTEND_URL = https://<frontend>.vercel.app` (exact, **no trailing slash**).
2. Redeploy the backend. CORS `origin` and the auth cookie now match the real frontend.

Test the full flow on the Vercel URL: **Sign up → OTP email → verify → log in**. In DevTools → Application → Cookies, confirm `access_token` is `HttpOnly`, `Secure`, `SameSite=None`.

---

## 4. (Recommended) Custom domain — required for Safari/Brave users

Cross-site `SameSite=None` cookies (`*.vercel.app` ↔ `*.up.railway.app`) are blocked by Safari and Brave's default third-party-cookie protection, so those users won't stay logged in. Fix it by putting both on **one parent domain** so the cookie is first-party:

1. Frontend domain `app.yourdomain.com` → Vercel (Project → Domains).
2. Backend domain `api.yourdomain.com` → Railway (Settings → Networking → Custom Domain).
3. Update env and redeploy both:
   - Vercel: `NEXT_PUBLIC_API_URL = https://api.yourdomain.com/api/v1`
   - Railway: `FRONTEND_URL = https://app.yourdomain.com`

---

## Notes & troubleshooting

- **Login works locally but not in prod** → almost always the cookie. Confirm `NODE_ENV=production` on Railway (so `SameSite=None; Secure` is set) and HTTPS on both ends.
- **CORS error in console** → `FRONTEND_URL` on Railway must exactly equal the frontend origin (scheme + host, no trailing slash). Vercel *preview* URLs differ per deploy and won't match — test on the production URL or add the preview origin.
- **Migrations** → run `prisma migrate deploy` against the prod `DATABASE_URL` from local whenever the schema changes (the Railway runtime image intentionally doesn't run migrations).
- **Build/runtime** → Railway uses `backend/railway.json` (Nixpacks → `prisma generate` → run with `tsx`). The stale `backend/Dockerfile` is unused and can be deleted.
- **Secrets** → never commit `.env`; rotate `ACCESS_TOKEN_SECRET`/DB/SMTP/Upstash if they were ever exposed.
