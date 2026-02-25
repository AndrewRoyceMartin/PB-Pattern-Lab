# Powerball Pattern Lab

## Overview
Powerball Pattern Lab is a full-stack web application for analyzing the Australian Powerball lottery. It allows users to import historical draw data, discover statistical patterns (frequency, recency, structure, carryover), validate these patterns via walk-forward backtesting, and generate ranked number picks. The core principle is a "benchmark-first" approach, validating pattern strategies against seeded random ensemble baselines with permutation significance testing and anti-popularity scoring to ensure practical utility and avoid look-ahead bias.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Vite
- **Routing**: Wouter, supporting Dashboard, CSV Ingest, Pattern Lab, Validation, Pick Generator, and Formula Lab.
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
    - **Validation**: Walk-forward backtesting (20 strategies), multi-window benchmarking with seeded random ensemble, permutation significance testing, stability classification, benchmark presets, and regime split testing.
    - **Generator**: Ranked picks via a handler registry (16 modes including frequency benchmarks, Bayesian-smoothed strategies, Strategy Portfolio, Structure-Matched Random, Anti-Popular Only, Diversity Optimized, and Random Baseline).
    - **Formula Lab**: Weighted feature formula optimization, walk-forward replay, Monte Carlo permutation test, and overfit risk diagnostics.

### Database
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**: `draws` (historical lottery data), `benchmark_runs` (persisted results), `users` (planned).
- **Migrations**: Drizzle Kit.

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
11. **Results-first UI**: Validation page uses a three-tier layout for clear presentation of results.

## External Dependencies

### Required Services
- **PostgreSQL Database**: For storing imported draw data and benchmark runs.

### Key NPM Packages
- **Frontend**: React, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS, Recharts, Embla Carousel.
- **Backend**: Express, Multer, Drizzle ORM, `pg`, `connect-pg-simple`, `csv-parse`.
- **Shared**: Zod, `drizzle-zod`.
- **Build**: Vite, esbuild, `tsx`.