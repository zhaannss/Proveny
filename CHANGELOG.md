# CHANGELOG

This file documents architectural decisions that diverge from the original blueprint, as required by the assignment specification:

> *"Contract Compliance: Every implemented endpoint must match the request/response schemas in your blueprint. If you deviate, document the architectural reason in a CHANGELOG.md."*

---

## [Phase 1] — Bootstrap

### Changed

#### **Language: JavaScript (ES Modules)**

- **Original blueprint:** `architecture.docx` specified TypeScript 5.x as the implementation language.
- **Actual implementation:** JavaScript (ES2022) with ES Modules (`"type": "module"` in `package.json`).
- **Reason:** Decision was made to reduce build complexity and tooling overhead. JavaScript with strict ESLint rules and JSDoc type annotations provides sufficient code quality for this project scope. No transpilation step is required, and Node.js 20+ runs the code directly.
- **Mitigations:**
  - JSDoc annotations on public APIs preserve IDE autocomplete and inline documentation
  - Zod runtime validation enforces type-like guarantees at all I/O boundaries (env vars, request bodies)
  - ESLint configured with strict rules (`no-undef`, `no-unused-vars`, `eqeqeq`, etc.) catches common type-related bugs at lint time
- **Impact on contract compliance:** None. API request/response shapes (defined in `openapi.yaml`) remain identical — they are validated at runtime by Zod regardless of source language.

#### **`bcrypt` → `bcryptjs`**

- **Original blueprint:** Implied `bcrypt` (native module with C++ bindings).
- **Actual implementation:** `bcryptjs` (pure JavaScript implementation).
- **Reason:** `bcrypt` requires a native compiler toolchain (node-gyp, Python, C++) at install time, which is fragile across CI/CD environments and Windows dev machines. `bcryptjs` is a drop-in replacement with identical API and a long track record of safe use.
- **Performance trade-off:** `bcryptjs` is ~30% slower than native `bcrypt`. Acceptable for the auth endpoint volume in this project. With `BCRYPT_ROUNDS=12`, hashing takes ~250ms — well within UX budgets for login/register.

#### **Build pipeline simplification**

- **Original blueprint:** TypeScript compilation step (`tsc` → `dist/`) before `node dist/server.js`.
- **Actual implementation:** Direct execution via `node src/server.js` (development) and `node src/server.js` (production). Hot-reload via Node 20's built-in `--watch` flag.
- **Reason:** Without a transpilation step, there is no `dist/` directory to manage, no source maps to publish, and no possibility of source/output drift. Node.js 20 supports all ES2022 features natively.

### Unchanged from blueprint

- **Folder structure** — matches `project-structure.txt` (modules/, engines/, middleware/, config/) with `.js` extensions instead of `.ts`
- **API contracts** — `openapi.yaml` schemas are the source of truth, validated by Zod at runtime
- **Database schema** — `prisma/schema.prisma` matches `database-schema.docx` exactly
- **Security model** — all STRIDE mitigations from `security-analysis.docx` remain in place (JWT structure, RBAC layering, audit log append-only design, rate limiting)
