# Powerball Pattern Lab

## Overview
Powerball Pattern Lab is a full-stack web application for analyzing the Australian Powerball lottery. It allows users to import historical draw data (via CSV upload or RSS feed sync), discover statistical patterns (frequency, recency, structure, carryover), validate these patterns via walk-forward backtesting, and generate ranked number picks. The core principle is a "benchmark-first" approach, validating pattern strategies against seeded random ensemble baselines with permutation significance testing and anti-popularity scoring to ensure practical utility and avoid look-ahead bias.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite
- **Routing**: Wouter, supporting System Overview (Dashboard), CSV Ingest, Pattern Lab, Validation, Pick Generator, and Formula Lab.
- **UI Components**: shadcn/ui (New York style) built on Radix UI and Tailwind CSS.
- **State Management**: TanStack React Query for server state, local React state for UI.
- **Styling**: Tailwind CSS v4, dark mode by default, Inter and JetBrains Mono fonts.

### Backend
- **Runtime**: Node.js with Express.
- **Language**: TypeScript.
- **API Pattern**: RESTful JSON API under `/api/`, using `{ok, meta, data}` response format.
- **Request Validation**: Zod schemas validate all POST endpoints with structured 400 error responses.
- **Core Engines**:
    - **Pattern Discovery**: Extracts frequency, structure, carryover, and rolling drift patterns.
    - **Validation**: Walk-forward backtesting (24 strategies), multi-window benchmarking with seeded random ensemble, permutation significance testing, stability classification, 3 benchmark presets, regime split testing, and config transparency (runConfigUsed echo).
    - **Generator**: Ranked picks via a handler registry (16 modes including frequency benchmarks, Bayesian-smoothed strategies, Strategy Portfolio, Structure-Matched Random, Anti-Popular Only, Diversity Optimized, and Random Baseline).
    - **Auto Run**: Three endpoints for one-click 12-line generation:
      - `POST /api/auto/generate` — Generic: runs rolling benchmark, selects top strategy by avg delta vs random, generates 12 lines.
      - `POST /api/auto/generate-composite-no-frequency` — Recommended lane: direct generation using Composite No-Frequency strategy (fast, no optimiser).
      - `POST /api/auto/optimise-and-generate` — Experimental lane: runs Formula Lab optimiser fresh, generates 12 lines with jittered optimised weights.
    - **Pick Run Stamps**: Every auto-generated result includes a `runStamp` tracking `strategyName`, `benchmarkRunId`, `optimiserUsed`, `optimiserRunId`, `formulaHash`, `seed`, and `generatedAt` for full audit trail.
    - **Formula Lab**: Weighted feature formula optimization, walk-forward replay, Monte Carlo permutation test, and overfit risk diagnostics. `generateFormulaCard` exported for use by Auto Run optimiser lane.

### Database
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**: `draws` (historical lottery data), `benchmark_runs` (persisted results), `users` (planned).
- **Migrations**: Drizzle Kit.

### Validation Engine — Strategy Registry (24 strategies)
1. Random (seeded ensemble baseline)
2. Frequency Only
3. Recency Only
4. Structure-Aware
5. Composite (frequency + recency + trend)
6. Most Drawn (All-Time)
7. Most Drawn (Last 50)
8. Most Drawn (Last 100)
9. Most Drawn (Last 20)
10. Least Drawn (Last 50)
11. Structure-Matched Random
12. Anti-Popular Only
13. Diversity Optimized
14. Smoothed Most Drawn (L50)
15. Smoothed Most Drawn (L20)
16. Recency Smoothed (Bayesian)
17. Recency Gap Balanced (moderate gap preference)
18. Recency Decay Weighted (exponential decay)
19. Recency Short Window (last 10-20 draws)
20. Composite No-Frequency (ablation)
21. Composite Recency-Heavy (60% recency)
22. Composite No-Recency (ablation)
23. Composite No-Structure (ablation)
24. Composite No-AntiPop (ablation)
25. Composite Structure-Heavy (60% structure) — total 24 non-Random + Random baseline

### Benchmark Presets
- **Recency Verification**: Fixed holdout, targets recency + composite ablation strategies, no permutation by default.
- **Rolling Confirmation**: Rolling walk-forward, regime splits ON, 500 random runs.
- **Significance Check**: Rolling walk-forward, regime splits ON, permutation ON (1000 runs), 500 random runs, targets composite ablation strategies.

### Validation UI Architecture
- **Results-first layout**: Three tiers — (A) Top Summary always visible, (B) Compact Strategy Results table always visible, (C) Details collapsed by default.
- **Consolidated config state**: Single `BenchmarkConfigState` object replaces 7+ scattered state variables; atomic preset application via `applyPreset()`.
- **Config transparency**: `RunConfigUsedCard` displays exact params used per run; amber mismatch warning when UI differs from loaded results; backend echoes `runConfigUsed` in response.
- **Dual badge system**: Separate "Validation" (StabilityBadge) and "Significance" (SignificanceBadge: Supported/Suggestive/Unsupported) columns in strategy table and summary card.
- **Preset summary bar**: Shows what the selected preset will configure before running.
- **Drill-down queue**: Bookmark strategies for follow-up, add notes, persisted in localStorage, included in JSON export.
- **Four export formats**: CSV Summary, CSV Detailed, CSV Permutation, JSON Full — all use `runConfigUsed` (not current UI state).
- **Show Details toggle**: Persisted in localStorage; controls visibility of benchmark config, random ensemble, permutation tests, full window×strategy results, single-window validation, rolling window stability, and diagnostics.

### Pick Generator UI
- **Two-lane Simple mode**: Recommended lane (Composite No-Frequency, fast) vs Experimental lane (Optimised, runs optimiser first).
- **Advanced mode**: Full strategy selection with 16 generator modes, custom draw-fit/anti-pop weight slider, recommendation engine integration.
- **Run Stamp transparency**: Every generation shows strategy, seed, benchmark ID, optimiser ID, formula hash, and timestamp.
- **Export**: CSV (12 lines) and JSON Full export for both lanes.
- **Progress indication**: Loading spinners with step descriptions for optimiser lane.

### Key Design Decisions
1. **Monorepo with shared types**: Ensures type safety across client and server.
2. **Dark-mode-first theme**: Aligns with the "lab" aesthetic.
3. **Robust CSV import**: `csv-parse` for flexible parsing and header matching.
4. **Server-side analysis**: All statistical computations are backend-handled for a lightweight client.
5. **Walk-forward validation**: Essential for avoiding look-ahead bias in backtesting.
6. **Benchmark-first design**: Emphasizes rigorous validation against random baselines.
7. **Benchmark persistence**: Results stored in `benchmark_runs` table, loaded by recommendation engine.
8. **Reproducibility**: Seeded mulberry32 PRNG for random baselines and Fisher-Yates shuffle for permutation tests.
9. **Standardized API responses**: Consistent `{ok, meta, data}` format.
10. **Generator handler registry**: Typed handler map for easy addition of new generation modes.
11. **Results-first UI**: Validation page uses a three-tier layout with summary-first, details on demand.
12. **Config transparency**: Backend echoes `runConfigUsed` in responses; exports use result payload not current UI state.
13. **Atomic preset application**: Presets override mode/permutation/regime atomically; manual changes clear preset indicator.
14. **Data-driven System Overview**: Dashboard tiles reflect actual benchmark winner (Best Strategy vs Random), not hardcoded Composite. Verdict, delta, runner-up, and benchmark metadata all pulled from `GET /api/system/overview` which reads latest persisted benchmark run.
15. **RSS feed sync**: `POST /api/rss-sync` fetches latest AU Powerball draws from Lottolyzer RSS feed, parses ball images from HTML descriptions, deduplicates by draw number, and inserts new draws. Supplements CSV bulk import for keeping data current.

## External Dependencies

### Required Services
- **PostgreSQL Database**: For storing imported draw data and benchmark runs.

### Key NPM Packages
- **Frontend**: React, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS, Recharts, Embla Carousel.
- **Backend**: Express, Multer, Drizzle ORM, `pg`, `connect-pg-simple`, `csv-parse`.
- **Shared**: Zod, `drizzle-zod`.
- **Build**: Vite, esbuild, `tsx`.
