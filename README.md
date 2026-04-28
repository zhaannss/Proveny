# SylLab Backend

Anti-Plagiarism Code Forensics Platform — Backend API.

Detects AI-assisted code generation by establishing **proctored authentic baselines** in Week 1 and analyzing later submissions for sophistication delta, technique genealogy violations, and cohort outliers.

> ⚠️ **Note on language:** This implementation uses **JavaScript (ES Modules)** rather than TypeScript as originally specified in `architecture.docx`. See [CHANGELOG.md](./CHANGELOG.md) for the rationale.

---

## 🏛️ Architecture Decisions

### Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js 20 LTS | Non-blocking I/O, native ESM, built-in `--watch` |
| Framework | Express 4 | Lightweight, custom middleware for RBAC + rate limiting |
| Language | JavaScript (ES2022, ESM) | Direct execution, no transpile step |
| ORM | Prisma 5 | Type-safe queries; **zero raw SQL** required |
| DB | PostgreSQL 15 | Window functions for cohort analysis, JSONB for AST metrics |
| Cache | Redis 7 | Token bucket rate limiting + refresh token store |
| Auth | JWT (jsonwebtoken) | Stateless access tokens + revocable refresh tokens |
| Validation | Zod | Runtime schema validation on env vars **and** request bodies |
| Lint | ESLint | Primary quality gate (no compile-time type checker) |

### Key principles

1. **Refuse to start on bad config.** `src/config/env.js` validates every secret with Zod. Missing `JWT_ACCESS_SECRET` or weak (<32 chars) → process exits with code 1 BEFORE the HTTP server starts.
2. **Singletons for DB/Redis.** One `PrismaClient` and one `Redis` instance per process — prevents connection-pool exhaustion in dev hot-reload.
3. **Custom error classes + global handler.** Throw `new NotFoundError(...)` anywhere → standardized JSON response. No ad-hoc `res.status(404).json(...)` scattered through controllers.
4. **App factory pattern.** `createApp()` returns a configured app WITHOUT `.listen()` — allows Supertest to test in-memory.
5. **Graceful shutdown.** SIGTERM/SIGINT trigger Prisma + Redis cleanup with a 10-second timeout, then exit.

---

## 🚀 Setup (Local Development)

### Prerequisites

- Node.js ≥ 20
- Docker Desktop (or PostgreSQL 15 + Redis 7 installed locally)

### Steps

```bash
# 1. Clone & install
git clone <repo-url> && cd syllab-backend
npm install

# 2. Copy env template and fill in real values
cp .env.example .env
# Generate strong JWT secrets:
#   openssl rand -hex 32
# Paste them into JWT_ACCESS_SECRET and JWT_REFRESH_SECRET

# 3. Start PostgreSQL + Redis
docker-compose up -d

# 4. Generate Prisma client
npm run prisma:generate

# 5. Run migrations (creates the User table for now)
npm run prisma:migrate:dev

# 6. Start dev server (auto-reloads on file changes)
npm run dev
```

The server should print a banner and listen on `http://localhost:3000`. Hit `/health` to confirm:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"...","environment":"development"}
```

---

## 📂 Project Structure

```
syllab-backend/
├── src/
│   ├── app.js             # Express factory (CORS, helmet, routes)
│   ├── server.js          # Entry point + graceful shutdown
│   ├── config/
│   │   ├── env.js         # ⭐ Zod env validation — refuses to boot on bad config
│   │   ├── prisma.js      # PrismaClient singleton
│   │   └── redis.js       # Redis singleton
│   ├── middleware/
│   │   └── errorHandler.js # Custom error classes + global handler
│   └── modules/           # auth/, users/, ... (Phase 3+)
├── prisma/
│   └── schema.prisma      # Data model
├── tests/
│   ├── unit/              # Pure logic tests
│   └── integration/       # API tests via Supertest
├── docker-compose.yml     # Postgres 15 + Redis 7
├── eslint.config.js       # Lint rules
├── .env.example           # Template — copy to .env
├── CHANGELOG.md           # Deviations from blueprint
└── README.md
```

---

## 🛠️ Available Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Hot-reload dev server (Node `--watch`) |
| `npm start` | Run production server |
| `npm run prisma:migrate:dev` | Create + apply a migration in dev |
| `npm run prisma:migrate:deploy` | Apply pending migrations in prod |
| `npm run prisma:studio` | GUI to inspect DB |
| `npm test` | Run Jest test suite |
| `npm run lint` | Lint with ESLint |
| `npm run lint:fix` | Auto-fix lint issues |

---

## 🗺️ Implementation Roadmap

This 20% sprint covers:

- ✅ **Phase 1** — Bootstrap (env validation, Prisma + Redis singletons, error handler, health check) ← **YOU ARE HERE**
- ⏳ **Phase 2** — Database schema + first migration
- ⏳ **Phase 3** — Auth (register, login, refresh, logout, RBAC, rate limiting)
- ⏳ **Phase 4** — AST sophistication scoring engine (5 metrics)
- ⏳ **Phase 5** — Baseline + Submission + Comparison endpoints
- ⏳ **Phase 6** — Tests, Swagger UI, CI/CD

---

## 📜 License

Educational project. Not for production use.
