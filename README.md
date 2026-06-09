NIHAGENT-ECHO
# News Intelligence Hub

News Intelligence Hub is an RSS intelligence dashboard for technical news. It ingests feeds, filters low-value content before LLM usage, analyzes accepted articles in background workers, and exposes a feed, entity pages, digests, telemetry, and a React Flow graph.

## Stack Choices

- Backend: NestJS. The project needs explicit queue, worker, LLM, and graph orchestration, so a code-first backend is easier to reason about than a generated admin backend.
- Frontend: React with Vite. The UI is a client dashboard with React Flow and no SSR requirement.
- Database: PostgreSQL with Prisma. Relational constraints are useful for tenant isolation, article deduplication, and graph edge uniqueness.
- Queues: BullMQ with Redis.
- Queue monitoring: Bull Board at `/admin/queues`.
- LLM providers: custom adapter interface with OpenAI and Anthropic adapters, plus a deterministic mock mode for local demos.

## Run

Prerequisites:

- Docker and Docker Compose.
- Node.js 24 if running outside Docker.

Start with Docker:

```bash
cp .env.example .env
docker compose up --build
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open:

- App: `http://localhost:5173`
- API: `http://localhost:3000`
- Bull Board: `http://localhost:3000/admin/queues` with `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` from `.env` (default example values: `admin` / `change-me`).

Default demo account seeded on startup:

- Email: `demo@example.com`
- Password: `Password123!`

For a new account, register in the UI. In development mode the verification link is returned on the registration screen and logged by the API with a `DEV MODE` label in the UI.

## Local Development

```bash
npm install
npm run prisma:generate --workspace apps/server
npm run dev
```

Useful checks:

```bash
npm run lint
npm run test
npm run check:unicode
```

## Repository Structure

- `apps/server`: NestJS API, BullMQ workers, Prisma schema, LLM adapters, RSS ingestion, graph building.
- `apps/web`: React, Tailwind CSS, React Flow dashboard.
- `docker-compose.yml`: Postgres, Redis, API, worker, frontend.
- `.env.example`: all runtime configuration without secrets.

## Demo Data

On Docker startup, `prisma db push` applies the schema and `prisma/seed.ts` creates a verified demo user, example categories and axes, a demo feed, processed articles, entities, mentions, and graph edges. This lets reviewers see the article list and graph immediately after startup.

## Implemented Scope

Must features implemented:

- Registration, dev email verification, login, logout, persistent JWT session.
- Per-user data isolation in API queries.
- Feed CRUD with status and manual pull.
- Category and categorization axis CRUD with seeded axes.
- BullMQ queues for feed pull, article processing, regeneration, and digest building.
- Article pre-filter before LLM analysis.
- Custom LLM abstraction with OpenAI and Anthropic adapters selected by env.
- LLM cache keyed by content hash and axes hash.
- Entity deduplication, exact article deduplication, and deterministic semantic article similarity edges.
- LLM telemetry grouped by operation, provider, and model.
- Article feed, article detail, entity detail API, React Flow graph, settings UI, regeneration action.
- Bull Board protected by basic auth.
- Docker Compose startup.

Should features included:

- Provider failover when mock mode is disabled and a primary provider fails.
- Unit tests for the pre-filter, feed discovery, category matching, and digest filters.
- Basic LLM telemetry dashboard.
- Digest generation through a queue, with day/week/month period selection and category/entity filters.
- Graph category, node-type, and text-search filters.
- Semantic similarity edges between related articles without pairwise LLM calls.

Known limits:

- Semantic article similarity uses deterministic weighted overlap instead of embeddings or LLM pairwise comparisons to keep cost bounded.
- Entity matching is deterministic with aliases and normalization, with the required Microsoft aliases covered.
- Regeneration progress is queue-driven and lightweight; it is sufficient for MVP visibility but not a full job timeline.

## Architectural Decisions

## ADR-1: NestJS Backend

Context: The application has authentication, queues, workers, LLM adapters, graph construction, and tenant-aware data access.

Decision: Use NestJS for the backend and worker runtime.

Alternatives: Directus could provide CRUD and admin features quickly.

Trade-offs: NestJS requires more code for routine endpoints, but keeps business logic, queue boundaries, and LLM calls explicit and easy to explain. Directus would reduce CRUD effort but leave the hard pipeline in a second service anyway.

## ADR-2: Deterministic Code Before LLM

Context: LLM calls are expensive and should only handle semantic tasks.

Decision: RSS parsing, URL normalization, content hashing, pre-filtering, exact deduplication, queueing, graph edge updates, and aggregation are deterministic. LLM is used for article analysis and digest prose.

Alternatives: Use an LLM to classify all incoming material or build graph relationships directly.

Trade-offs: Deterministic code is less flexible but cheaper, testable, and predictable. The LLM gets a narrower prompt and one structured call per accepted article.

## ADR-3: Entity Deduplication

Context: Entity nodes must merge common aliases without merging unrelated names.

Decision: Normalize names with Unicode normalization, cleanup, simple transliteration, and explicit aliases. The canonical key maps `Microsoft`, `MSFT`, `Microsoft Corp.`, `MS`, and Cyrillic spelling to one company node.

Alternatives: Ask the LLM to compare each candidate with all known entities.

Trade-offs: Deterministic matching avoids quadratic LLM cost and false confidence. It misses some subtle cases, but keeps merges auditable and safe for MVP.

## ADR-4: LLM Cost Control

Context: Article processing can become the highest variable cost.

Decision: A heuristic pre-filter runs first. Accepted articles use one structured LLM request. Results are cached by content hash plus current categories and axes. Concurrency and token limits are env-configured. Usage is written to `LlmTelemetry`.

Alternatives: Run separate LLM calls for entities, summaries, importance, and categories.

Trade-offs: One call reduces cost and queue pressure. The response contract is larger, so strict validation is required before persisting analysis.

## ADR-5: LLM Failure Handling

Context: Provider outages should not break the whole app.

Decision: Worker jobs own LLM calls. The LLM service records structured errors, falls back to the secondary provider when configured, and lets BullMQ retry failed jobs.

Alternatives: Call providers directly in HTTP handlers and return provider errors to users.

Trade-offs: Asynchronous processing makes results eventual, but it preserves UI responsiveness and keeps long or costly work outside request handlers.

## ADR-6: Tenant Isolation

Context: Users must never see another user's feeds, articles, categories, axes, graph, or digests.

Decision: Domain tables include `userId`, and every API query filters by the authenticated user. Delete operations verify ownership before mutation.

Alternatives: Keep shared article storage with user-specific annotation tables.

Trade-offs: User-scoped articles duplicate some raw content, but the access model is simpler and safer for an MVP. Shared raw storage can be introduced later behind the same user-scoped annotations.

## ADR-7: Deterministic Article Similarity

Context: The graph should connect related articles from different sources, but pairwise LLM comparison would become expensive as feeds grow.

Decision: Build `similar` graph edges with a deterministic score from title/content token overlap, assigned categories, and shared entities. Exact duplicate detection still uses normalized URL and content hash.

Alternatives: Use embeddings, ask the LLM to compare article pairs, or skip semantic similarity for MVP.

Trade-offs: The deterministic score is cheaper, testable, and explainable, but less nuanced than embeddings. It is enough for MVP graph context and avoids quadratic LLM usage.
