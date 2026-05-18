# GoalSync Enterprise — Deployment & Optimization Guide

## Quick Start (Local Demo)

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

**Demo credentials:** `admin@test.com` / `manager@test.com` / `employee@test.com` — password: `1234`

---

## Architecture Overview

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + Ant Design + Recharts |
| Backend | Node.js + Express + Prisma ORM |
| Database | SQLite (dev) → PostgreSQL (production) |
| Auth | JWT (24h expiry) + bcrypt password hashing |
| Notifications | In-app + MS Teams Adaptive Card simulation |
| Escalations | Automated SLA engine (hourly cron) |

---

## Performance Optimizations (Implemented)

### Frontend
- **DashboardLayout decoupled** — `NotificationPopover` extracted as a standalone dynamic import; no more monolithic layout re-renders
- **LazyCharts barrel** — All Recharts imports via `components/LazyCharts.tsx` → single shared webpack chunk
- **Webpack chunk splitting** — `next.config.js` splits `antd`, `recharts`, and general vendors into separate cached bundles
- **Module-level API caching** — 60–90 second TTLs on `admin/*`, `manager/*`, `approvals`, `team-goals`, `access-requests`, `audit`, `escalations`, `impact` pages prevent redundant fetches on route navigation
- **Skeleton loaders** — KPI cards show animated skeletons during data fetch to prevent layout shift
- **Phased loading** — Admin dashboard loads stats first (priority), then defers overview table by 300ms
- **Dead code removed** — Unused `getProgressColor2` alias and `_sharedGoalsCache` stub cleaned up

### Backend
- **Prisma singleton** — All 10 route/utility files now share a single `PrismaClient` instance via `src/lib/prisma.ts`, eliminating 9 redundant DB connection pools
- **Escalation engine** — Runs at startup + hourly interval; uses `findFirst` with `not: 'resolved'` guard to avoid duplicate escalation records
- **Parallel DB queries** — `admin/stats` uses `Promise.all` across 6 count queries

---

## Security (Implemented)

```
Content-Security-Policy: script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

> **Note:** `unsafe-inline` is required by Ant Design's CSS-in-JS runtime and Next.js bootstrap scripts. In production, consider `nonce`-based CSP once Ant Design v6 (static CSS) is available.

---

## Database — Current: SQLite (Local Demo)

```env
DATABASE_URL="file:./dev.db"
```

---

## Production: PostgreSQL via Neon (Recommended)

### Step 1 — Create free Neon database
1. Go to [https://neon.tech](https://neon.tech) and sign up free
2. Create a new project → copy the connection string

### Step 2 — Update `.env`
```env
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/goalsync?sslmode=require"
JWT_SECRET="your-strong-32-char-secret"
ADMIN_SECRET_KEY="GOALSYNC-ADMIN-2024-ENTERPRISE"
PORT=5000
NODE_ENV=production
FRONTEND_URL="https://your-domain.com"
```

### Step 3 — Update `schema.prisma`
```prisma
datasource db {
  provider = "postgresql"   # change from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 4 — Run migration & seed
```bash
cd backend
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

---

## Schema Compatibility

All Prisma models are fully PostgreSQL-compatible:
- `String` → `TEXT`
- `Float` → `DOUBLE PRECISION`
- `Boolean` → `BOOLEAN`
- `DateTime` → `TIMESTAMP WITH TIME ZONE`
- `cuid()` → works in both (Prisma-generated)

---

## Deployment Options

| Option | Setup Time | Cost | Best For |
|--------|-----------|------|---------| 
| **Neon** | 5 min | Free tier | Hackathon demo |
| **Supabase** | 5 min | Free tier | Hackathon demo |
| **Azure PostgreSQL** | 20 min | Pay-as-you-go | Production (pairs with Azure Entra ID) |
| **AWS RDS** | 30 min | Pay-as-you-go | Enterprise production |
| **Railway** | 5 min | Free tier | Quick cloud demo |

---

## Microsoft Entra ID — Production SSO Path

For real enterprise deployment:

1. Register app in Azure AD (App Registration)
2. Configure OIDC redirect URIs pointing to `/api/auth/callback`
3. Map AD Groups → GoalSync roles:
   - `GoalSync-Employees` → `employee`
   - `GoalSync-Managers` → `manager`
   - `GoalSync-HR` → `admin`
4. Use `@azure/msal-react` for token acquisition
5. Sync department + reporting hierarchy from Azure AD Graph API

> Current demo shows the full SSO flow simulation on the login page.

---

## Backend Prisma Singleton

All backend route files import from the shared singleton:

```typescript
// src/lib/prisma.ts — single PrismaClient for the entire process
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient({ log: ['error', 'warn'] });
export default prisma;

// In every route file:
import prisma from '../lib/prisma';
```

This replaces 10 separate `new PrismaClient()` calls, reducing DB connection overhead from 10 pools to 1.
