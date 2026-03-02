# Powerball Pattern Lab

## Overview
Powerball Pattern Lab is a full-stack web application designed for in-depth analysis of Australian lottery games. It enables users to import historical draw data, identify statistical patterns (frequency, recency, structure, carryover), validate these patterns through walk-forward backtesting, and generate ranked number picks. The project emphasizes a "benchmark-first" approach, validating strategies against seeded random ensembles using permutation significance testing and anti-popularity scoring to ensure practical utility and avoid look-ahead bias. The business vision is to provide a robust tool for lottery enthusiasts, offering data-driven insights and a transparent approach to pattern analysis.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Game Support
The application supports multiple lottery games (AU Powerball, AU Saturday Lotto) via a `GameConfig` interface that parameterizes all analysis and generation functions, ensuring adaptability without hardcoding game-specific rules. A React `GameProvider` manages the active game context.

### Data Sources
Primary data is sourced from TheLott public JSON API, with fallback mechanisms including HTML scraping of TheLott website and Lottolyzer RSS for historical bulk imports. CSV upload is also supported. Rate limiting and caching are implemented for external API calls.

### Frontend
Built with React, TypeScript, and Vite, the frontend uses Wouter for routing and shadcn/ui (New York style) with Radix UI and Tailwind CSS for UI components. State management is handled by TanStack React Query for server state and React's local state for UI components. The styling is dark-mode-first with Inter and JetBrains Mono fonts.

### Backend
The Node.js Express backend, written in TypeScript, provides a RESTful JSON API. All endpoints accept `gameId` for game-specific operations. Zod schemas are used for request validation. Core engines include Pattern Discovery, Validation (with 24 strategies and 3 benchmark presets), Generator (with 16 generation modes), and Formula Lab for weighted feature formula optimization. Auto-generated picks include `runStamp` for full auditability.

### Database
A PostgreSQL database managed by Drizzle ORM stores game definitions, historical draw data (with `gameId` and provenance details), benchmark runs, prediction sets, and prediction evaluations. Drizzle Kit is used for migrations.

### Key Design Decisions
The architecture emphasizes a monorepo with shared types, server-side analysis, walk-forward validation to prevent look-ahead bias, and a benchmark-first design against random baselines. Reproducibility is ensured via seeded PRNGs. The UI adopts a "results-first" layout, with consolidated configuration states and robust transparency features (e.g., `runConfigUsed` echoes). A multi-game architecture, DB-backed prediction tracking with stable line pairing, and PB coverage modes are also central.

## External Dependencies

### Required Services
- **PostgreSQL Database**: Essential for all data storage.

### Key NPM Packages
- **Frontend**: React, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS, Recharts, Embla Carousel.
- **Backend**: Express, Multer, Drizzle ORM, `pg`, `connect-pg-simple`, `csv-parse`.
- **Shared**: Zod, `drizzle-zod`.
- **Build**: Vite, esbuild, `tsx`.