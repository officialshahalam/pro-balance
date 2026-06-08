# Fine Balance Sheet

Financial reporting tool for Indian Chartered Accountants — manage clients, capture financial data, and generate projected/actual Balance Sheet and Profit & Loss reports (with annexures and PDF export).

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19, TypeScript, TanStack Query, Zustand, Tailwind, `@react-pdf/renderer`.
- **Backend:** Express 5 + TypeScript, Prisma ORM, PostgreSQL (Neon), Upstash Redis (OTP), JWT auth (httpOnly cookie).

## Prerequisites

- Node.js 20+, pnpm (backend) / npm (frontend)
- A PostgreSQL database (Neon or local via `docker-compose.local.yml`)
- An Upstash Redis instance (for signup OTP)
- SMTP credentials (Gmail App Password) for sending OTP emails

## Setup

### Backend
```bash
cd backend
cp .env.example .env        # fill in real values — NEVER commit .env
pnpm install
pnpm prisma migrate deploy  # or: pnpm prisma migrate dev
pnpm start:dev              # http://localhost:4000  (docs: /api-docs in dev only)
```

Required env vars (see `backend/.env.example`): `DATABASE_URL`, `ACCESS_TOKEN_SECRET` (≥ 32 chars), `FRONTEND_URL`, `SMTP_USER`, `SMTP_PASS`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`. The server fails fast at boot if `DATABASE_URL` or `ACCESS_TOKEN_SECRET` is missing/weak.

Optional local Postgres:
```bash
# set POSTGRES_PASSWORD in backend/.env first
docker compose -f docker-compose.local.yml up -d
```

### Frontend
```bash
cd frontend
printf 'NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1\n' > .env.local
npm install
npm run dev                        # http://localhost:3000
```

## Scripts

| Location | Command | Purpose |
|---|---|---|
| backend | `pnpm start:dev` | Dev server (tsx watch) |
| backend | `pnpm start:build` / `pnpm start:prod` | Build / run compiled `dist/main.js` |
| frontend | `npm run dev` / `build` / `start` | Next.js dev / build / serve |

## Security notes

- Secrets live only in `.env` / `.env.local` (gitignored) — only `*.example` files are committed.
- Auth is a JWT in an httpOnly, `secure` (prod), `sameSite` cookie; the token is never returned in a response body.
- Run `pnpm audit` / `npm audit` before each release.
