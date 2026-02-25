# Powerball Pattern Lab

## Overview

Powerball Pattern Lab is a full-stack web application designed for analyzing the Australian Powerball lottery. It enables users to import historical draw data, discover statistical patterns (frequency, recency, structure, carryover), validate these patterns through walk-forward backtesting, and generate ranked number picks. A key feature is its "benchmark-first" approach, where pattern strategies are rigorously validated against seeded random ensemble baselines, with permutation significance testing and anti-popularity scoring to ensure practical utility.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite
- **Routing**: Wouter, supporting 6 main pages: Dashboard, CSV Ingest, Pattern Lab, Validation, Pick Generator, and Formula Lab.
- **UI Components**: shadcn/ui (New York style) built on Radix UI primitives with Tailwind CSS.
- **State Management**: TanStack React Query for server state, local React state for UI.
- **Styling**: Tailwind CSS v4, dark mode by default.
- **Fonts**: Inter (sans) and JetBrains Mono (monospace).

### Backend
- **Runtime**: Node.js with Express.
- **Language**: TypeScript.
- **API Pattern**: RESTful JSON API under `/api/`, standardized `{ok, meta, data}` response format.
- **Route Modules**: Routes are split into focused modules under `server/routes/`:
  - `upload.ts` — CSV file upload, draw CRUD, stats
  - `analysis.ts` — frequency, features, audit, structure profile, validation
  - `validation.ts` — multi-window benchmark, benchmark history, benchmark detail
  - `generator.ts` — recommendation engine, pick generation via handler registry
  - `formulaLab.ts` — formula optimization endpoint
  - `helpers.ts` — shared apiResponse helper
- **Request Validation**: Zod schemas validate all POST endpoints (benchmark, generator, formula lab) with structured 400 error responses on invalid input.
- **Core Engines**:
  - **Pattern Discovery**: Extracts frequency, structure, carryover, and rolling drift patterns.
  - **Validation**: Walk-forward backtesting using 20 strategies (15 original + 5 recency ablation variants), multi-window benchmarking with seeded random ensemble (configurable runs/seed), fixed holdout and rolling walk-forward modes, Fisher-Yates permutation significance testing (cross-draw null model, focused strategy targeting up to 1000 runs), stability classification (possible_edge/weak_edge/no_edge/underperforming), benchmark presets (Recency Signal Verification), regime split testing (recent/mid/older thirds).
  - **Generator**: Ranked picks via handler registry map (`server/generator-registry.ts`), 16 modes including frequency benchmarks, Bayesian-smoothed strategies (Smoothed L50/L20, Recency Smoothed), Strategy Portfolio (multi-strategy mixed pack), Structure-Matched Random, Anti-Popular Only, Diversity Optimized, and Random Baseline.
  - **Formula Lab**: Weighted feature formula optimization, walk-forward replay, Monte Carlo permutation test, overfit risk diagnostics.
- **Generator Registry**: `server/generator-registry.ts` — typed handler map (`Record<GeneratorMode, GeneratorHandler>`) for all 16 modes. Adding a new mode requires registering one handler function.

### Database
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**:
  - `draws` — historical lottery draw data (drawNumber, drawDate, numbers, powerball, isModernFormat)
  - `benchmark_runs` — persisted benchmark results with config JSON, summary JSON, status, timestamp
  - `users` — planned for future use
- **Connection**: `pg.Pool` via `DATABASE_URL`.
- **Migrations**: Drizzle Kit (`npm run db:push`).

### Key Design Decisions
1. **Monorepo with shared types**: `shared/` directory ensures type safety across client and server.
2. **Dark-mode-first theme**: Aligns with the "lab" aesthetic.
3. **Robust CSV import**: Uses `csv-parse` library for safe parsing of quoted fields, embedded commas, whitespace variations. Flexible header-matching logic supports multiple Powerball CSV layouts.
4. **Server-side analysis**: All statistical computations are handled by the server to keep the client lightweight.
5. **Walk-forward validation**: Essential for avoiding look-ahead bias in backtesting.
6. **Benchmark-first design**: Emphasizes rigorous validation; strategies tested against seeded random ensemble baselines with permutation significance testing.
7. **Benchmark persistence**: Benchmark results are persisted to the `benchmark_runs` database table. Recommendation engine loads from DB on restart, with stale-benchmark warning (>7 days).
8. **Reproducibility**: Seeded mulberry32 PRNG for random baselines, configurable seed/runs, Fisher-Yates shuffle for permutation tests. Benchmark metadata (mode, seed, windows, runs) is visible in UI and CSV exports.
9. **Standardized API responses**: Consistent `{ok, meta, data}` format for all API endpoints.
10. **Rolling benchmark correctness**: Rolling walk-forward mode uses `evaluatedDraws` (not total test draws) as denominator, correctly handling skipped draws due to insufficient training data.
11. **Generator handler registry**: Typed handler map replaces if/else dispatch chain, making it trivial to add new generation modes.
12. **Results-first UI**: Validation page uses three-tier layout — top summary always visible, compact strategy table always visible, detail sections (config, ensemble, permutation, per-window) collapsed by default with "Show Details" toggle persisted to localStorage.
13. **Drill-down queue**: Bookmark strategies for follow-up with notes, persisted to localStorage, included in JSON export for research continuity.

## External Dependencies

### Required Services
- **PostgreSQL Database**: For storing imported draw data and benchmark runs, configured via `DATABASE_URL`.

### Key NPM Packages
- **Frontend**: React, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS, Recharts, Embla Carousel.
- **Backend**: Express, Multer, Drizzle ORM, `pg`, `connect-pg-simple`, `csv-parse`.
- **Shared**: Zod, `drizzle-zod`.
- **Build**: Vite, esbuild, `tsx`.

## Methodology Notes

### CSV Import
- Uses `csv-parse` for robust row/field splitting (handles quoted fields, embedded commas, trim, relaxed column counts).
- Flexible header-matching logic detects draw number, date, ball numbers, and powerball columns by pattern — supports multiple Powerball CSV layouts.
- Row-level error messages reported on import failure (up to 20 errors returned).
- Modern format validation: exactly 7 numbers in range 1-35, powerball in range 1-20.

### Benchmark Engine
- **Modes**: `fixed_holdout` (static train/test split) and `rolling_walk_forward` (each test draw uses all subsequent draws as training, with minTrainDraws threshold).
- **Rolling mode denominator fix**: Averages divide by `evaluatedDraws` (draws actually tested), not `testDraws.length`. Skipped draws (insufficient training data) are tracked and surfaced in UI.
- **Random baseline**: Seeded ensemble (default 200 runs, configurable up to 500) using mulberry32 PRNG. Ensemble mean replaces single-run random baseline. 5th/95th percentile bands computed.
- **Delta computation**: `deltaVsRandomMean` compares strategy average against ensemble mean. `withinRandomBand` flags whether performance falls within p05-p95 range.

### Permutation Testing (v2 + focused targeting)
- **Shuffle method**: Fisher-Yates (Knuth) using seeded PRNG — replaces biased `sort(() => rng - 0.5)`.
- **Null model**: Cross-draw permutation — shuffles entire draw objects across temporal positions, breaking the draw-timestamp relationship (stronger null than within-draw number scrambling).
- **Scope**: Default tests top-3 strategies by average delta. Focused mode targets specific strategies via `permutationStrategies` param (up to 1000 runs).
- **Output**: Empirical p-value, null distribution stats (mean, std), percentile, caution text.
- **Metadata**: API response includes `shuffleMethod`, `scope`, `runs` for each permutation result.
- **Caveat**: Permutation testing provides supporting evidence only — a low p-value does not prove predictive edge for lottery draws.

### Recency Ablation Strategies
- 5 variants added for recency signal investigation:
  - `Recency Gap Balanced` — prefers numbers with moderate gap (40-70th percentile)
  - `Recency Decay Weighted` — exponential decay weighting on recency
  - `Recency Short Window` — recency emphasis on last 10-20 draws only
  - `Composite No-Frequency` — composite ablation removing frequency signal
  - `Composite Recency-Heavy` — composite with 60% recency, 20% trend, 20% structure
- These are benchmark-only strategies (no generator mode yet)

### Benchmark Presets
- **Recency Signal Verification**: Tests 14 strategies (recency variants + baselines) with focused permutation on 8 recency/composite strategies. Designed to isolate whether recency signals are real or noise.
- `selectedStrategies` optional field filters which strategies to benchmark (runs all if omitted).
- `presetName` labels the benchmark run for identification.

### Regime Split Testing
- Divides modern draws into thirds by draw date: `recent_modern`, `mid_modern`, `older_modern`.
- Each regime runs independently with capped `minTrainDraws`.
- Stable signals should persist across regimes; regime-dependent signals are likely noise.
- Enabled via `regimeSplits: true` in benchmark request.

### Benchmark Persistence
- Results stored in `benchmark_runs` table with config JSON and summary JSON.
- Recommendation engine loads latest successful benchmark from DB when in-memory state is empty (e.g. after server restart).
- Stale benchmark warning: recommendations flag benchmarks older than 7 days.
- History endpoint: `GET /api/validation/benchmark/history` returns recent runs for comparison.
- Detail endpoint: `GET /api/validation/benchmark/:id` returns full run data.

### API Request Validation
- **POST /api/validation/benchmark**: Zod schema validates windowSizes (array of ints 5-500, max 10), minTrainDraws (10-1000), benchmarkMode enum, seed, randomBaselineRuns (1-500), runPermutation boolean, permutationRuns (1-1000), selectedStrategies (optional string array), presetName (optional string), permutationStrategies (optional string array), regimeSplits (boolean, default false).
- **POST /api/generate**: Zod schema validates count (1-100), mode (16 generator modes), optional weights (0-100), allocationMethod.
- **POST /api/formula-lab/optimize**: Zod schema validates features, trainingWindowSize, searchIterations (10-500), regularizationStrength, objective.
- Invalid payloads return structured 400 errors with field-level messages.

## Recent Changes

### Phase: Recency Signal Verification Sprint (2026-02-25)
- **T001**: Results-first Validation UI — three-tier layout (summary always visible → compact table → details collapsed), Show Details toggle persisted to localStorage
- **T002**: Comprehensive export options — CSV Summary, CSV Detailed (window×strategy), CSV Permutation, JSON Full (includes drill-down queue), all with benchmark metadata
- **T003**: 5 recency ablation strategies — Recency Gap Balanced, Recency Decay Weighted, Recency Short Window, Composite No-Frequency, Composite Recency-Heavy
- **T004**: Benchmark preset system — selectedStrategies filter, presetName labeling, Recency Signal Verification preset (14 strategies)
- **T005**: Focused permutation testing — `permutationStrategies` param targets specific strategies, max 1000 runs
- **T006**: Regime split testing — divides modern draws into thirds, stability across historical periods
- **T007**: Drill-down queue — bookmark strategies for follow-up, add notes, persisted in localStorage, included in JSON export
- **T008**: Updated replit.md with methodology and infrastructure documentation

### Phase: Validation Hardening + Research Infrastructure (2026-02-25)
- Fixed rolling benchmark averaging, Fisher-Yates permutation v2, Zod validation, benchmark persistence, route modules, generator registry, csv-parse upgrade, benchmark metadata UI, benchmark history viewer

### Prior Phases
- **2026-02-24**: Forecasting Quality Upgrade Sprint — seeded ensemble baselines, Bayesian-smoothed strategies (Smoothed L50/L20, Recency Smoothed), Strategy Portfolio mode, permutation significance testing v1
- **2026-02-24**: Formula Lab module — weighted formula search, walk-forward replay, Monte Carlo permutation test, overfit diagnostics
- **2026-02-24**: Major refactor implementing benchmark-first architecture — 16 validation strategies, multi-window benchmark, stability classification, 16 generator modes, anti-popularity engine
