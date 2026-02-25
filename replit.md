# Powerball Pattern Lab

## Overview

Powerball Pattern Lab is a full-stack web application designed for analyzing the Australian Powerball lottery. It enables users to import historical draw data, discover statistical patterns (frequency, recency, structure, carryover), validate these patterns through walk-forward backtesting, and generate ranked number picks. A key feature is its "benchmark-first" approach, where pattern strategies are rigorously validated against random baselines and anti-popularity scoring to ensure practical utility. The application aims to provide insights and tools for lottery enthusiasts.

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
- **Core Engines**:
    - **Pattern Discovery**: Extracts frequency, structure, carryover, and rolling drift patterns.
    - **Validation**: Performs walk-forward backtesting using 16 strategies (including random, frequency, recency, structure-aware, composite, and various "most drawn" and "least drawn" approaches), supporting multi-window benchmarking with stability classification and permutation significance testing.
    - **Generator**: Produces ranked picks based on draw-fit scoring and anti-popularity penalties, offering 16 generation modes including frequency benchmarks, Bayesian-smoothed strategies, and a Strategy Portfolio.
    - **Formula Lab**: Allows for weighted feature formula optimization, walk-forward replay, and permutation testing with overfit diagnostics.

### Database
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with `drizzle-zod`.
- **Schema**: `draws` table for historical lottery data, `users` table (planned for future use).
- **Connection**: `pg.Pool` via `DATABASE_URL`.
- **Migrations**: Drizzle Kit.

### Key Design Decisions
1.  **Monorepo with shared types**: `shared/` directory ensures type safety across client and server.
2.  **Dark-mode-first theme**: Aligns with the "lab" aesthetic.
3.  **CSV-based data import**: Users upload historical draw data, parsed and normalized server-side.
4.  **Server-side analysis**: All statistical computations are handled by the server to keep the client lightweight.
5.  **Walk-forward validation**: Essential for avoiding look-ahead bias in backtesting.
6.  **Benchmark-first design**: Emphasizes rigorous validation; only strategies proven to beat random or provide anti-popularity benefits influence pick generation.
7.  **Standardized API responses**: Consistent `{ok, meta, data}` format for all API endpoints.

## External Dependencies

### Required Services
-   **PostgreSQL Database**: For storing imported draw data, configured via `DATABASE_URL`.

### Key NPM Packages
-   **Frontend**: React, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS, Recharts, Embla Carousel.
-   **Backend**: Express, Multer, Drizzle ORM, `pg`, `connect-pg-simple`.
-   **Shared**: Zod, `drizzle-zod`.
-   **Build**: Vite, esbuild, `tsx`.