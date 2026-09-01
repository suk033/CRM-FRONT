# SUPRA CRM Frontend

Phase 1 provides the executable frontend foundation for SUPRA CRM. It includes a strict React + TypeScript setup, responsive accessible readiness landing, React Router and TanStack Query providers, and a typed OpenAPI client.

Authentication, current-user lookup, company/contact workflows, and business error handling are intentionally deferred to later phases. `Prototipo/` contains design references only and is not part of the executable app.

## Start

1. Copy `env.example` to `.env.local`.
2. Set `VITE_API_BASE_URL` to the backend origin (no secrets).
3. Run `npm ci` and `npm run dev`.

## Quality

Run `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run openapi:check`.

The OpenAPI snapshot lives at `src/api/openapi.json`; its generated TypeScript schema is `src/api/schema.ts`. After replacing the snapshot, run `npm run openapi:generate` and then `npm run openapi:check` to confirm no drift.
