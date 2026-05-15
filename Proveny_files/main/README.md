# SylLab Backend

Production-oriented Express + Prisma backend for anti-plagiarism code forensics. It supports verified auth, RBAC, proctored baselines, assignment submissions, asynchronous analysis, email notifications, queue visibility, and reports.

## Requirements

- Node.js 20+
- PostgreSQL 15+
- Redis 7+
- SMTP provider credentials such as Mailtrap, Brevo, SendGrid, or another SMTP service

## Setup

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

Edit `.env` before running the app. `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, and `JWT_REFRESH_SECRET` are mandatory. SMTP values are required for a real defense demo because verification and business emails are queued through the email worker.

## Run

Start the API:

```bash
npm run dev
```

Start workers in separate terminals:

```bash
npm run worker:email
npm run worker:analysis
npm run worker:maintenance
```

API base URL: `http://localhost:3000/api/v1`  
Swagger UI: `http://localhost:3000/docs`

## Auth Flow

```text
POST /api/v1/auth/register         -> queues verification email
GET  /api/v1/auth/verify-email     -> activates account
POST /api/v1/auth/login            -> returns accessToken + refreshToken
POST /api/v1/auth/refresh          -> rotates refresh token + access token
POST /api/v1/auth/logout           -> revokes all refresh tokens
POST /api/v1/auth/forgot-password  -> queues password reset email
POST /api/v1/auth/reset-password   -> resets password and revokes sessions
```

Public registration always creates a `STUDENT`. `INSTRUCTOR`, `PROCTOR`, and `ADMIN` accounts are created through the admin-only `/api/v1/users` endpoints.

## Business Workflows

1. Instructor/admin creates a course and enrolls students.
2. Instructor/proctor/admin creates a proctored session.
3. Proctor/admin activates the session.
4. Student submits a Week 1 baseline during the active session.
5. Proctor/admin locks the session, making baselines immutable.
6. Student submits assignment code only after the locked baseline and before `dueDate`.
7. Submission queues an async BullMQ analysis job.
8. Analysis worker creates `AnalysisResult` using trajectory, genealogy, and cohort signals.
9. Flagged/critical submissions enqueue instructor email notifications.
10. Instructor records oral interview outcome; the student receives an email.

## Queue Visibility & Cron

`GET /api/v1/queue/jobs` shows BullMQ counts and recent waiting/active/failed jobs for `email`, `analysis`, and `maintenance`.

The maintenance worker registers a recurring stale-review job:

| Job | Schedule | Purpose |
|---|---|---|
| `stale-flag-review` | Monday 09:00 UTC | Notify instructors about high-risk PENDING reviews older than 7 days |

## Testing

```bash
npm run lint
npm test
npx prisma validate
```

## Architecture Decisions

- Prisma ORM is the only database access layer; raw SQL is not used in application code.
- SMTP calls never run in API request handlers; email is queued through BullMQ.
- Refresh tokens are rotated on every refresh and stored by JTI in Redis.
- Instructor access is scoped to owned courses for submissions, baselines, analysis, queues, and reports.
- A deterministic trajectory standard deviation fallback of `8` is used until enough cohort data exists.
