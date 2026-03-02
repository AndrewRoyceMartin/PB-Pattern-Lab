import type { Draw, GeneratedPick, GeneratorMode, GameConfig } from "@shared/schema";
import { DEFAULT_GAME_CONFIG } from "./storage";
import {
  generateRankedPicks,
  generateMostDrawnCards,
  generateAntiPopularCards,
  generateDiverseCards,
  generateStructureMatchedCards,
  generateLeastDrawnCards,
  generateSmoothedCards,
  generateRecencySmoothedCards,
  generateStrategyPortfolio,
} from "./analysis";

export interface GeneratorHandlerContext {
  draws: Draw[];
  count: number;
  drawFitWeight?: number;
  antiPopWeight?: number;
  allocationMethod?: "equal" | "validation_weighted";
  gc?: GameConfig;
  gameId?: string;
}

export type GeneratorHandler = (ctx: GeneratorHandlerContext) => GeneratedPick[];

const registry: Record<GeneratorMode, GeneratorHandler> = {
  most_drawn_all_time: (ctx) =>
    generateMostDrawnCards(ctx.draws, ctx.draws.length, ctx.count, ctx.gc),

  most_drawn_last_50: (ctx) =>
    generateMostDrawnCards(ctx.draws, 50, ctx.count, ctx.gc),

  most_drawn_last_100: (ctx) =>
    generateMostDrawnCards(ctx.draws, 100, ctx.count, ctx.gc),

  most_drawn_last_20: (ctx) =>
    generateMostDrawnCards(ctx.draws, 20, ctx.count, ctx.gc),

  least_drawn_last_50: (ctx) =>
    generateLeastDrawnCards(ctx.draws, 50, ctx.count, ctx.gc),

  structure_matched_random: (ctx) =>
    generateStructureMatchedCards(ctx.draws, ctx.count, ctx.gc),

  anti_popular_only: (ctx) =>
    generateAntiPopularCards(ctx.count, ctx.gc),

  diversity_optimized: (ctx) =>
    generateDiverseCards(ctx.draws, ctx.count, ctx.gc),

  strategy_portfolio: (ctx) =>
    generateStrategyPortfolio(ctx.draws, ctx.count, ctx.allocationMethod || "equal", ctx.gc, ctx.gameId),

  most_drawn_smoothed_last_50: (ctx) =>
    generateSmoothedCards(ctx.draws, 50, ctx.count, ctx.gc),

  most_drawn_smoothed_last_20: (ctx) =>
    generateSmoothedCards(ctx.draws, 20, ctx.count, ctx.gc),

  recency_smoothed: (ctx) =>
    generateRecencySmoothedCards(ctx.draws, ctx.count, ctx.gc),

  anti_popular: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, 20, 80, ctx.gc),

  pattern_only: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, 100, 0, ctx.gc),

  random_baseline: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, 0, 0, ctx.gc),

  balanced: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, ctx.drawFitWeight ?? 60, ctx.antiPopWeight ?? 40, ctx.gc),
};

export function getGeneratorHandler(mode: GeneratorMode): GeneratorHandler {
  return registry[mode];
}

export function isRegisteredMode(mode: string): mode is GeneratorMode {
  return mode in registry;
}
