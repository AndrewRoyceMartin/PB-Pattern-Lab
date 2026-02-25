import type { Draw, GeneratedPick, GeneratorMode } from "@shared/schema";
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
}

export type GeneratorHandler = (ctx: GeneratorHandlerContext) => GeneratedPick[];

const registry: Record<GeneratorMode, GeneratorHandler> = {
  most_drawn_all_time: (ctx) =>
    generateMostDrawnCards(ctx.draws, ctx.draws.length, ctx.count),

  most_drawn_last_50: (ctx) =>
    generateMostDrawnCards(ctx.draws, 50, ctx.count),

  most_drawn_last_100: (ctx) =>
    generateMostDrawnCards(ctx.draws, 100, ctx.count),

  most_drawn_last_20: (ctx) =>
    generateMostDrawnCards(ctx.draws, 20, ctx.count),

  least_drawn_last_50: (ctx) =>
    generateLeastDrawnCards(ctx.draws, 50, ctx.count),

  structure_matched_random: (ctx) =>
    generateStructureMatchedCards(ctx.draws, ctx.count),

  anti_popular_only: (ctx) =>
    generateAntiPopularCards(ctx.count),

  diversity_optimized: (ctx) =>
    generateDiverseCards(ctx.draws, ctx.count),

  strategy_portfolio: (ctx) =>
    generateStrategyPortfolio(ctx.draws, ctx.count, ctx.allocationMethod || "equal"),

  most_drawn_smoothed_last_50: (ctx) =>
    generateSmoothedCards(ctx.draws, 50, ctx.count),

  most_drawn_smoothed_last_20: (ctx) =>
    generateSmoothedCards(ctx.draws, 20, ctx.count),

  recency_smoothed: (ctx) =>
    generateRecencySmoothedCards(ctx.draws, ctx.count),

  anti_popular: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, 20, 80),

  pattern_only: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, 100, 0),

  random_baseline: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, 0, 0),

  balanced: (ctx) =>
    generateRankedPicks(ctx.draws, ctx.count, ctx.drawFitWeight ?? 60, ctx.antiPopWeight ?? 40),
};

export function getGeneratorHandler(mode: GeneratorMode): GeneratorHandler {
  return registry[mode];
}

export function isRegisteredMode(mode: string): mode is GeneratorMode {
  return mode in registry;
}
