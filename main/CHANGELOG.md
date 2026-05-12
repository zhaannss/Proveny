# Changelog

## [1.0.1] - Pre-Defense Hardening

- Implemented email verification, resend verification, forgot password, and reset password flows.
- Implemented refresh token rotation with Redis JTI revocation.
- Restricted public registration to `STUDENT`; elevated roles are admin-provisioned.
- Added BullMQ email, analysis, and maintenance workers.
- Added recurring `stale-flag-review` maintenance schedule.
- Added queue visibility endpoint: `GET /api/v1/queue/jobs`.
- Added analysis result, interview outcome, action queue, and reports modules.
- Required locked proctored baseline and non-expired due date for assignment submissions.
- Scoped instructor access to owned courses.
- Updated `openapi.yaml`, `.env.example`, and README for the restored API surface.
- Added focused tests for auth security and submission business rules.

## [1.0.0] - Baseline

- Initial Express + Prisma API with auth, users, courses, sessions, baselines, submissions, and one-shot analysis.
