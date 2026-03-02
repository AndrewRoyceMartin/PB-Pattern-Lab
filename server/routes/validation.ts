import type { Express } from "express";
import { storage, getGameConfig, DEFAULT_GAME_CONFIG } from "../storage";
import { apiResponse } from "./helpers";
import { benchmarkRequestSchema } from "@shared/schema";
import type { BenchmarkRunConfig, GameConfig } from "@shared/schema";
import {
  runBenchmarkValidation,
  storeBenchmarkResult,
  loadBenchmarkFromDb,
  getLatestBenchmarkTime,
} from "../analysis";

async function resolveGameConfig(gameId?: string): Promise<GameConfig> {
  if (!gameId) return DEFAULT_GAME_CONFIG;
  const game = await storage.getGame(gameId);
  return game ? getGameConfig(game) : DEFAULT_GAME_CONFIG;
}

export function registerValidationRoutes(app: Express): void {
  app.post("/api/validation/benchmark", async (req, res) => {
    try {
      const parsed = benchmarkRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          message: "Invalid benchmark request",
          errors: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })),
        });
      }
      const { windowSizes, minTrainDraws, benchmarkMode, seed, randomBaselineRuns, runPermutation, permutationRuns, selectedStrategies, presetName, permutationStrategies, regimeSplits } = parsed.data;
      const gameId = (req.body?.gameId as string) || undefined;
      const gc = await resolveGameConfig(gameId);
      const draws = await storage.getModernDraws(gameId);
      if (draws.length < 50) {
        return res.status(400).json({ ok: false, message: `Only ${draws.length} modern draws available. Need at least 120 (min window + min training) for benchmark.` });
      }
      const runConfigUsed: BenchmarkRunConfig = {
        benchmarkMode, windowSizes, minTrainDraws, seed, randomBaselineRuns,
        runPermutation, permutationRuns, totalDrawsAvailable: draws.length,
        selectedStrategies, presetName, permutationStrategies, regimeSplits,
        gameId: gc.gameId,
      };

      if (process.env.NODE_ENV !== "production") {
        console.log("[benchmark] runConfigUsed =", {
          benchmarkMode: runConfigUsed.benchmarkMode,
          runPermutation: runConfigUsed.runPermutation,
          permutationRuns: runConfigUsed.permutationRuns,
          randomBaselineRuns: runConfigUsed.randomBaselineRuns,
          windowSizes: runConfigUsed.windowSizes,
          presetName: runConfigUsed.presetName,
          selectedStrategiesCount: runConfigUsed.selectedStrategies?.length ?? "all",
          gameId: gc.gameId,
        });
      }

      const results = runBenchmarkValidation(draws, windowSizes, minTrainDraws, benchmarkMode, seed, randomBaselineRuns, runPermutation, permutationRuns, selectedStrategies, presetName, permutationStrategies, regimeSplits, gc);
      storeBenchmarkResult(results, gc.gameId);

      const run = await storage.saveBenchmarkRun(runConfigUsed, results, gc.gameId);
      res.json(apiResponse(draws, { ...results, benchmarkRunId: run.id, benchmarkRunTimestamp: run.createdAt, runConfigUsed }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/validation/benchmark/history", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const gameId = (req.query.gameId as string) || undefined;
      const runs = await storage.listBenchmarkRuns(limit, gameId);
      const summaries = runs.map(r => ({
        id: r.id,
        createdAt: r.createdAt,
        status: r.status,
        config: r.config,
        verdict: (r.summary as any)?.overallVerdict ?? "",
        strategiesTested: (r.summary as any)?.stabilityByStrategy?.length ?? 0,
        windowsTested: (r.summary as any)?.windowSizesTested?.length ?? 0,
      }));
      res.json({ ok: true, data: summaries });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/validation/benchmark/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ ok: false, message: "Invalid benchmark run ID" });
      const run = await storage.getBenchmarkRunById(id);
      if (!run) return res.status(404).json({ ok: false, message: "Benchmark run not found" });
      res.json({ ok: true, data: { id: run.id, createdAt: run.createdAt, config: run.config, summary: run.summary, status: run.status } });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
