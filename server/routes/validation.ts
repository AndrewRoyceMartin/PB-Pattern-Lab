import type { Express } from "express";
import { storage } from "../storage";
import { apiResponse } from "./helpers";
import { benchmarkRequestSchema } from "@shared/schema";
import type { BenchmarkRunConfig } from "@shared/schema";
import {
  runBenchmarkValidation,
  storeBenchmarkResult,
  loadBenchmarkFromDb,
  getLatestBenchmarkTime,
} from "../analysis";

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
      const { windowSizes, minTrainDraws, benchmarkMode, seed, randomBaselineRuns, runPermutation, permutationRuns } = parsed.data;
      const draws = await storage.getModernDraws();
      if (draws.length < 50) {
        return res.status(400).json({ ok: false, message: `Only ${draws.length} modern draws available. Need at least 120 (min window + min training) for benchmark.` });
      }
      const results = runBenchmarkValidation(draws, windowSizes, minTrainDraws, benchmarkMode, seed, randomBaselineRuns, runPermutation, permutationRuns);
      storeBenchmarkResult(results);

      const config: BenchmarkRunConfig = {
        benchmarkMode, windowSizes, minTrainDraws, seed, randomBaselineRuns,
        runPermutation, permutationRuns, totalDrawsAvailable: draws.length,
      };
      const run = await storage.saveBenchmarkRun(config, results);
      res.json(apiResponse(draws, { ...results, benchmarkRunId: run.id, benchmarkRunTimestamp: run.createdAt }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/validation/benchmark/history", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 10, 50);
      const runs = await storage.listBenchmarkRuns(limit);
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
