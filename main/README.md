# SylLab Backend (Express + JavaScript + Prisma + PostgreSQL + Redis)

This repository implements the **mandatory authentication + authorization baseline** (register/login/refresh/logout, JWT access+refresh, RBAC, rate limiting, CORS) and the start of the **SylLab core workflow** (courses/sessions/baselines with AST-based scoring).

## Requirements

- Node.js 20+
- PostgreSQL 15+
- Redis 7+

## Setup

1. Install dependencies

```bash
npm install
```

2. Create `.env` from template

```bash
copy .env.example .env
```

3. Ensure PostgreSQL + Redis are running

- Update `DATABASE_URL` and `REDIS_URL` in `.env` to match your local setup.

4. Generate Prisma client

```bash
npm run prisma:generate
```

5. Apply DB schema

This repo includes a baseline migration SQL generated from `prisma/schema.prisma` in `prisma/migrations/00000000000000_init/`.

To apply migrations against your database:

```bash
npm run prisma:migrate
```

6. Seed an initial admin (so you can use `/users` admin endpoints)

```bash
npm run seed
```

Defaults:
- `SEED_ADMIN_EMAIL=admin@syllab.local`
- `SEED_ADMIN_PASSWORD=AdminPass123!`

7. Run the API

```bash
npm run dev
```

## API

- Base URL: `http://localhost:3000/api/v1`
- Swagger UI: `http://localhost:3000/docs`

### Auth flow (baseline)

- `POST /auth/register` (rate limited: 5/min/IP)
- `POST /auth/login` (rate limited: 5/min/IP)
- `POST /auth/refresh` (rate limited: 5/min/IP)
- `POST /auth/logout` (revokes all refresh tokens for the current user)

### Roles (RBAC)

Implemented roles match schema: `STUDENT`, `INSTRUCTOR`, `PROCTOR`, `ADMIN`.

Example:
- `/users/*` requires `ADMIN`

## Notes / Decisions

- **JavaScript-only** implementation (CommonJS). TypeScript is not used.
- Prisma is pinned to **v6** because the blueprint `schema.prisma` uses the classic `datasource db { url = env("DATABASE_URL") }` format (Prisma v7 changed config format).
- Refresh tokens are **reusable but revocable**: each refresh token has a `jti` stored in Redis; logout deletes all refresh JTIs for the user.

