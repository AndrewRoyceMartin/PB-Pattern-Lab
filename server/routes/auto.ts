import type { Express } from "express";
import { storage } from "../storage";
import { apiResponse } from "./helpers";
import type { BenchmarkRunConfig, BenchmarkStrategyStability, GeneratedPick } from "@shared/schema";
import {
  runBenchmarkValidation,
  storeBenchmarkResult,
} from "../analysis";
import { getGeneratorHandler } from "../generator-registry";

const AUTO_BENCHMARK_CONFIG = {
  benchmarkMode: "rolling_walk_forward" as const,
  windowSizes: [20, 40, 60, 100],
  minTrainDraws: 100,
  seed: 42,
  randomBaselineRuns: 500,
  runPermutation: false,
  permutationRuns: 200,
  regimeSplits: true,
  selectedStrategies: [
    "Composite",
    "Composite No-Frequency",
    "Composite Recency-Heavy",
    "Diversity Optimized",
    "Recency Smoothed",
    "Structure-Matched Random",
    "Random",
  ],
  presetName: "Auto Run (Best 12)",
};

const STRATEGY_TO_GENERATOR: Record<string, { mode: string; drawFit: number; antiPop: number }> = {
  "Composite": { mode: "balanced", drawFit: 60, antiPop: 40 },
  "Composite No-Frequency": { mode: "balanced", drawFit: 60, antiPop: 40 },
  "Composite Recency-Heavy": { mode: "balanced", drawFit: 60, antiPop: 40 },
  "Diversity Optimized": { mode: "diversity_optimized", drawFit: 50, antiPop: 50 },
  "Recency Smoothed": { mode: "recency_smoothed", drawFit: 100, antiPop: 0 },
  "Structure-Matched Random": { mode: "structure_matched_random", drawFit: 60, antiPop: 40 },
  "Random": { mode: "random_baseline", drawFit: 0, antiPop: 0 },
};

function selectWinnerStrategy(stabilities: BenchmarkStrategyStability[]): {
  strategy: string;
  reason: string;
  avgDelta: number;
  windowsBeating: number;
  isFallback: boolean;
} {
  const nonRandom = stabilities.filter(s => s.strategy !== "Random");
  const sorted = [...nonRandom].sort((a, b) => {
    if (b.avgDelta !== a.avgDelta) return b.avgDelta - a.avgDelta;
    if (b.windowsBeating !== a.windowsBeating) return b.windowsBeating - a.windowsBeating;
    return 0;
  });

  const best = sorted[0];
  if (!best || best.avgDelta <= 0) {
    return {
      strategy: "Strategy Portfolio",
      reason: "No strategies showed a positive edge vs random. Falling back to a diversified portfolio approach for maximum coverage.",
      avgDelta: 0,
      windowsBeating: 0,
      isFallback: true,
    };
  }

  return {
    strategy: best.strategy,
    reason: `Selected ${best.strategy} because it had the highest average delta vs random (+${best.avgDelta.toFixed(3)}) across ${best.windowsBeating}/${best.windowsTested} rolling windows.`,
    avgDelta: best.avgDelta,
    windowsBeating: best.windowsBeating,
    isFallback: false,
  };
}

export function registerAutoRoutes(app: Express): void {
  app.post("/api/auto/generate", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const minRequired = AUTO_BENCHMARK_CONFIG.minTrainDraws + Math.max(...AUTO_BENCHMARK_CONFIG.windowSizes);
      if (draws.length < minRequired) {
        return res.status(400).json({ ok: false, message: `Only ${draws.length} modern draws available. Need at least ${minRequired} (${AUTO_BENCHMARK_CONFIG.minTrainDraws} training + ${Math.max(...AUTO_BENCHMARK_CONFIG.windowSizes)} test window) for auto-generate.` });
      }

      console.log("[auto] Running benchmark with fixed config...");
      const { benchmarkMode, windowSizes, minTrainDraws, seed, randomBaselineRuns, runPermutation, permutationRuns, selectedStrategies, presetName, regimeSplits } = AUTO_BENCHMARK_CONFIG;

      const benchmarkResults = runBenchmarkValidation(
        draws, windowSizes, minTrainDraws, benchmarkMode, seed, randomBaselineRuns,
        runPermutation, permutationRuns, selectedStrategies, presetName, undefined, regimeSplits,
      );
      storeBenchmarkResult(benchmarkResults);

      const runConfigUsed: BenchmarkRunConfig = {
        benchmarkMode, windowSizes, minTrainDraws, seed, randomBaselineRuns,
        runPermutation, permutationRuns, totalDrawsAvailable: draws.length,
        selectedStrategies, presetName, regimeSplits,
      };
      const run = await storage.saveBenchmarkRun(runConfigUsed, benchmarkResults);

      const winner = selectWinnerStrategy(benchmarkResults.stabilityByStrategy);
      console.log(`[auto] Winner: ${winner.strategy} (delta: ${winner.avgDelta}, fallback: ${winner.isFallback})`);

      let picks: GeneratedPick[];
      if (winner.isFallback) {
        const handler = getGeneratorHandler("strategy_portfolio");
        picks = handler({ draws, count: 12, allocationMethod: "validation_weighted" });
      } else {
        const generatorConfig = STRATEGY_TO_GENERATOR[winner.strategy];
        if (generatorConfig) {
          const handler = getGeneratorHandler(generatorConfig.mode as any);
          picks = handler({
            draws, count: 12,
            drawFitWeight: generatorConfig.drawFit,
            antiPopWeight: generatorConfig.antiPop,
          });
        } else {
          console.warn(`[auto] Winner strategy "${winner.strategy}" has no generator mapping, using balanced fallback`);
          const handler = getGeneratorHandler("balanced");
          picks = handler({ draws, count: 12, drawFitWeight: 60, antiPopWeight: 40 });
        }
      }

      const scoreSummary = benchmarkResults.stabilityByStrategy
        .filter(s => s.strategy !== "Random")
        .sort((a, b) => b.avgDelta - a.avgDelta)
        .slice(0, 5)
        .map(s => ({
          strategy: s.strategy,
          avgDelta: s.avgDelta,
          windowsBeating: s.windowsBeating,
          windowsTested: s.windowsTested,
          stabilityClass: s.stabilityClass,
        }));

      res.json(apiResponse(draws, {
        benchmarkRunId: run.id,
        benchmarkRunTimestamp: run.createdAt,
        runConfigUsed,
        winner: {
          strategy: winner.strategy,
          reason: winner.reason,
          avgDelta: winner.avgDelta,
          windowsBeating: winner.windowsBeating,
          isFallback: winner.isFallback,
        },
        scoreSummary,
        picks,
        disclaimer: "These picks are generated using historical validation metrics. They are not guaranteed to outperform chance in future draws.",
      }));
    } catch (error: any) {
      console.error("[auto] Error:", error.message);
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
