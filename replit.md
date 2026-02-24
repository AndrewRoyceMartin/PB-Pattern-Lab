# Powerball Pattern Lab

## Overview

Powerball Pattern Lab is a full-stack web application for Australian Powerball lottery analysis. It allows users to import historical draw results via CSV, discover statistical patterns (frequency, recency, structure, carryover), validate those patterns through walk-forward backtesting, and generate ranked number picks using validated signals combined with anti-popularity scoring.

The app follows a monorepo structure with three main directories:
- `client/` — React SPA frontend
- `server/` — Express API backend
- `shared/` — Shared TypeScript types, database schema, and typed DTOs

## Recent Changes

- **2026-02-24**: Major refactor implementing benchmark-first architecture:
  - Added typed DTOs in `shared/schema.ts` (NumberFrequency, PatternFeatureRow, AuditSummary, StrategyResult, ValidationSummary, RollingWindow, GeneratorConfig, GeneratedPick with AntiPopularityBreakdown, ApiResponse wrapper)
  - Refactored `server/analysis.ts` into 3 engines: Pattern Discovery, Validation (walk-forward with verdict classification), Generator (mode-based with anti-popularity breakdown)
  - Added randomness audit (chi-square + entropy analysis)
  - Standardized all API responses to `{ok, meta, data}` format
  - Added `/api/analysis/audit` endpoint
  - Generator supports 4 modes: balanced, anti_popular, pattern_only, random_baseline
  - Rebuilt all 5 frontend pages with improved UX

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter (lightweight client-side router) with 5 main pages:
  - `/` — Dashboard (system overview, verdict summary, recent draws, strategy benchmarks)
  - `/ingest` — CSV file upload for importing Powerball draw data
  - `/patterns` — Pattern Lab (frequency analysis, structure features, randomness audit with chi-square/entropy)
  - `/validation` — Walk-forward backtest with verdict classification, strategy comparison, rolling windows, diagnostics
  - `/generator` — Pick generation with 4 modes (Balanced, Low Split-Risk, Experimental Pattern, Random Baseline), anti-popularity breakdown
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **State Management**: TanStack React Query for server state; local React state for UI
- **Styling**: Tailwind CSS v4 with CSS variables for theming; dark mode by default for a "lab" aesthetic
- **Fonts**: Inter (sans) and JetBrains Mono (monospace) for the data-heavy UI
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript, executed via `tsx` in development
- **API Pattern**: RESTful JSON API under `/api/` prefix, standardized `{ok, meta, data}` response format
- **Key Endpoints**:
  - `POST /api/upload` — CSV file upload (multer, memory storage, 10MB limit)
  - `GET /api/stats` — Draw count and dataset summary
  - `GET /api/draws` — All modern draws ordered by draw number
  - `GET /api/analysis/frequencies` — Number frequency analysis (L10, L25, L50 windows)
  - `GET /api/analysis/features` — Structure and carryover feature extraction
  - `GET /api/analysis/audit` — Randomness audit (chi-square + entropy)
  - `GET /api/analysis/validation` — Walk-forward backtest with verdict classification
  - `POST /api/generate` — Generate ranked picks with mode selection and configurable weights
- **Analysis Engine** (`server/analysis.ts`): Three engines:
  - Engine A (Pattern Discovery): frequency, structure, carryover, rolling drift
  - Engine B (Validation): walk-forward backtest with 5 strategies (Random, Frequency, Recency, Structure-Aware, Composite), rolling windows, verdict classification (no_edge/weak_edge/possible_edge/insufficient_data)
  - Engine C (Generator): ranked picks with draw-fit scoring, anti-popularity penalties (birthday, sequence, endings, aesthetic, low PB), mode-based generation
- **Dev Server**: Vite middleware is integrated into Express for HMR during development
- **Production Build**: Vite builds the client; esbuild bundles the server into `dist/index.cjs`

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema validation
- **Schema** (in `shared/schema.ts`):
  - `draws` table: `id` (serial PK), `drawNumber` (int), `drawDate` (text), `numbers` (JSON array of ints), `powerball` (int), `isModernFormat` (boolean), `createdAt` (timestamp)
  - `users` table: `id` (UUID PK), `username` (unique text), `password` (text) — defined but not actively used yet
- **Connection**: `pg.Pool` via `DATABASE_URL` environment variable
- **Migrations**: Drizzle Kit with `db:push` command for schema sync
- **Storage Layer** (`server/storage.ts`): `DatabaseStorage` class implementing `IStorage` interface with methods for CRUD on draws

### Build System
- **Development**: `tsx server/index.ts` runs the full-stack app with Vite middleware for hot reloading
- **Production Build**: `script/build.ts` runs Vite build for client assets, then esbuild for server bundle
- **Server bundling strategy**: Common dependencies are bundled (allowlisted) to reduce cold start syscalls; uncommon deps are externalized

### Key Design Decisions
1. **Monorepo with shared types**: The `shared/` directory contains the database schema and TypeScript types used by both client and server, ensuring type safety across the stack.
2. **Dark-mode-first theme**: The app uses a dark color scheme by default to match the "lab" concept, configured via CSS custom properties.
3. **CSV-based data import**: Rather than scraping or API integration, users upload CSV files of historical draws. The server parses and normalizes them, filtering for the modern 7+1 format.
4. **Server-side analysis**: All statistical computation happens on the server to keep the client lightweight. The client simply fetches and displays results.
5. **Walk-forward validation**: Backtesting uses walk-forward methodology to avoid look-ahead bias when evaluating pattern strategies.
6. **Benchmark-first design**: Validation is the gatekeeper — what doesn't beat random doesn't influence the generator. The anti-popularity engine provides practical value even when no predictive edge exists.
7. **Standardized API responses**: All endpoints return `{ok, meta, data}` format for consistent client consumption.

## External Dependencies

### Required Services
- **PostgreSQL Database**: Required. Connected via `DATABASE_URL` environment variable. Used for storing imported draw data.

### Key NPM Packages
- **Frontend**: React, Wouter, TanStack React Query, shadcn/ui (Radix UI), Tailwind CSS, Recharts (charting), Embla Carousel
- **Backend**: Express, Multer (file uploads), Drizzle ORM, pg (PostgreSQL driver), connect-pg-simple (session store)
- **Shared**: Zod (validation), drizzle-zod (schema-to-zod bridge)
- **Build**: Vite, esbuild, tsx

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (required)
- `NODE_ENV` — Set to `production` for production builds
