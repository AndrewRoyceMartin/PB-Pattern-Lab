# Powerball Pattern Lab

## Overview

Powerball Pattern Lab is a full-stack web application for Australian Powerball lottery analysis. It allows users to import historical draw results via CSV, discover statistical patterns (frequency, recency, structure, carryover), validate those patterns through walk-forward backtesting, and generate ranked number picks using validated signals combined with anti-popularity scoring.

The app follows a monorepo structure with three main directories:
- `client/` — React SPA frontend
- `server/` — Express API backend
- `shared/` — Shared TypeScript types and database schema

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter (lightweight client-side router) with 5 main pages:
  - `/` — Dashboard (system overview, stats summary)
  - `/ingest` — CSV file upload for importing Powerball draw data
  - `/patterns` — Pattern Lab (frequency analysis, structure features, randomness auditing)
  - `/validation` — Walk-forward backtest results and strategy comparison
  - `/generator` — Pick generation with configurable draw-fit vs anti-popularity weighting
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **State Management**: TanStack React Query for server state; local React state for UI
- **Styling**: Tailwind CSS v4 with CSS variables for theming; dark mode by default for a "lab" aesthetic
- **Fonts**: Inter (sans) and JetBrains Mono (monospace) for the data-heavy UI
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript, executed via `tsx` in development
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Key Endpoints**:
  - `POST /api/upload` — CSV file upload (multer, memory storage, 10MB limit)
  - `GET /api/stats` — Draw count and dataset summary
  - `GET /api/draws` — All draws ordered by draw number
  - `GET /api/analysis/frequencies` — Number frequency analysis
  - `GET /api/analysis/features` — Structure and carryover feature extraction
  - `GET /api/analysis/validation` — Walk-forward backtest results
  - `POST /api/generate` — Generate ranked picks with configurable weights
- **Analysis Engine** (`server/analysis.ts`): Pure TypeScript computation for frequency analysis, structure features, carryover detection, walk-forward validation, and pick generation
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