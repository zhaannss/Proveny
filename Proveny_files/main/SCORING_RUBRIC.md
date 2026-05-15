# SylLab Sophistication Scoring Rubric (v1)

This rubric is **rule-based** and deterministic (no ML / external APIs). It maps AST-derived signals into a **0–100** `sophisticationScore`.

Implementation: `src/engines/ast/sophisticationScorer.js`

## Metrics (minimum set)

### 1) Error handling tier (0–5)

File: `src/engines/ast/metrics/errorHandling.js`

- 0: no `try/catch`, no `throw`
- 1: at least one `throw`
- 2: at least one `try/catch`
- 4: multiple `try/catch` plus `throw`
- 5: custom error class (`class X extends Error`) + `try/catch` + `throw`

### 2) Architecture tier (0–5)

File: `src/engines/ast/metrics/architecture.js`

Heuristic signals:
- number of classes
- presence of identifiers containing `Service|Repository|Controller`

### 3) Type safety tier (0–3)

File: `src/engines/ast/metrics/typeSafety.js`

Counts TypeScript AST nodes (any node with type starting with `TS`):
- 0: none
- 1: few TS nodes
- 2: moderate TS nodes
- 3: many TS nodes

### 4) Naming verbosity score (0–2)

File: `src/engines/ast/metrics/naming.js`

Average identifier length:
- 0: avg < 12
- 1: 12–17
- 2: >= 18

### 5) Advanced technique flags (booleans)

File: `src/engines/ast/metrics/advancedTechniques.js`

Currently detected:
- `hasDecorators`
- `hasAsyncAwait`
- `hasCircuitBreaker` (identifier `CircuitBreaker`)
- `hasDependencyInjection` (identifiers `container|inject|Inject`)

## Final score (0–100)

Weights (current v1):

- errorHandlingTier: `tier * 12`
- architectureTier: `tier * 12`
- typeSafetyTier: `tier * 10`
- advancedTechniquesScore: `min(count(flags==true), 5) * 8`
- namingVerbosityScore: `score * 5`

Then clamped to `[0, 100]`.

