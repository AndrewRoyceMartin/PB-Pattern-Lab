import type { Express } from "express";
import { storage } from "../storage";
import { apiResponse } from "./helpers";
import type { BenchmarkStrategyStability, BenchmarkRunConfig } from "@shared/schema";
import {
  computeNumberFrequencies,
  computePatternFeatures,
  computeStructureProfile,
  runRandomnessAuditMain,
  runRandomnessAuditPowerball,
  runWalkForwardValidation,
} from "../analysis";

export function registerAnalysisRoutes(app: Express): void {
  app.get("/api/analysis/frequencies", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const freqs = computeNumberFrequencies(draws);
      res.json(apiResponse(draws, freqs));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/analysis/features", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const features = computePatternFeatures(draws);
      res.json(apiResponse(draws, features));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/analysis/audit", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const mainAudit = runRandomnessAuditMain(draws);
      const pbAudit = runRandomnessAuditPowerball(draws);
      res.json(apiResponse(draws, { main: mainAudit, powerball: pbAudit }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/analysis/structure-profile", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const profile = computeStructureProfile(draws);
      res.json(apiResponse(draws, profile));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/analysis/validation", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const results = runWalkForwardValidation(draws);
      res.json(apiResponse(draws, results));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/system/overview", async (_req, res) => {
    try {
      const allDraws = await storage.getAllDraws();
      const modernDraws = allDraws.filter(d => d.isModernFormat);
      const latestDate = modernDraws.length > 0 ? modernDraws[0].drawDate : null;

      const latestRun = await storage.getLatestBenchmarkRun();

      let bestStrategySummary: any = null;

      if (latestRun) {
        const summary = latestRun.summary;
        const config = latestRun.config as BenchmarkRunConfig;

        const nonRandom = (summary.stabilityByStrategy || [])
          .filter((s: BenchmarkStrategyStability) => s.strategy !== "Random")
          .sort((a: BenchmarkStrategyStability, b: BenchmarkStrategyStability) => {
            if (b.avgDelta !== a.avgDelta) return b.avgDelta - a.avgDelta;
            return b.windowsBeating - a.windowsBeating;
          });

        const best = nonRandom[0] ?? null;
        const runnerUp = nonRandom[1] ?? null;

        const composite = (summary.stabilityByStrategy || [])
          .find((s: BenchmarkStrategyStability) =>
            s.strategy === "Composite" || s.strategy === "Composite Model"
          );

        const permResult = best && summary.permutationTests?.length
          ? summary.permutationTests.find((p: any) => p.strategy === best.strategy)
          : null;

        bestStrategySummary = {
          benchmarkRunId: latestRun.id,
          generatedAt: latestRun.createdAt,
          benchmarkMode: config.benchmarkMode ?? summary.benchmarkMode,
          windows: config.windowSizes ?? summary.windowSizesTested,
          randomBaselineRuns: summary.randomEnsemble?.runs ?? config.randomBaselineRuns ?? null,
          runPermutation: config.runPermutation ?? false,
          permutationRuns: config.permutationRuns ?? null,
          presetName: config.presetName ?? summary.presetName ?? null,
          seed: config.seed ?? summary.seed,

          bestStrategy: best ? {
            name: best.strategy,
            avgDeltaVsRandom: best.avgDelta,
            stability: best.stabilityClass.replace(/_/g, " ").toUpperCase(),
            windowsTested: best.windowsTested,
            windowsBeating: best.windowsBeating,
            windowsLosing: best.windowsLosing,
            permutationPValue: permResult?.empiricalPValue ?? null,
          } : null,

          runnerUp: runnerUp ? {
            name: runnerUp.strategy,
            avgDeltaVsRandom: runnerUp.avgDelta,
          } : null,

          composite: composite ? {
            avgDeltaVsRandom: composite.avgDelta,
            stability: composite.stabilityClass.replace(/_/g, " ").toUpperCase(),
          } : null,

          overallVerdict: summary.overallVerdict,
          strategiesTested: (summary.stabilityByStrategy || []).length,
        };
      }

      res.json({
        ok: true,
        data: {
          totalDraws: allDraws.length,
          modernDraws: modernDraws.length,
          latestDrawDate: latestDate,
          bestStrategySummary,
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
