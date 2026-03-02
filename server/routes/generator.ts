import type { Express } from "express";
import { storage, getGameConfig, DEFAULT_GAME_CONFIG } from "../storage";
import { apiResponse } from "./helpers";
import { generateRequestSchema } from "@shared/schema";
import type { GameConfig, PredictionDiffResult } from "@shared/schema";
import {
  getGeneratorRecommendation,
  loadBenchmarkFromDb,
  getLatestBenchmarkTime,
} from "../analysis";
import { getGeneratorHandler } from "../generator-registry";
import { buildDiffResult } from "../diff-engine";

async function resolveGameConfig(gameId?: string): Promise<GameConfig> {
  if (!gameId) return DEFAULT_GAME_CONFIG;
  const game = await storage.getGame(gameId);
  return game ? getGameConfig(game) : DEFAULT_GAME_CONFIG;
}

export function registerGeneratorRoutes(app: Express): void {
  app.get("/api/generator/recommendation", async (req, res) => {
    try {
      const gameId = (req.query.gameId as string) || undefined;
      if (!getLatestBenchmarkTime(gameId)) {
        const latestRun = await storage.getLatestBenchmarkRun(gameId);
        if (latestRun) {
          loadBenchmarkFromDb(latestRun.summary as any, latestRun.createdAt, gameId);
        }
      }
      const recommendation = getGeneratorRecommendation(gameId);
      const draws = await storage.getModernDraws(gameId);

      const latestRun = await storage.getLatestBenchmarkRun(gameId);
      const benchmarkAge = latestRun?.createdAt ? Math.floor((Date.now() - new Date(latestRun.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : null;
      const stale = benchmarkAge !== null && benchmarkAge > 7;

      res.json(apiResponse(draws, {
        ...recommendation,
        benchmarkRunId: latestRun?.id ?? null,
        benchmarkRunTimestamp: latestRun?.createdAt ?? null,
        benchmarkStale: stale,
        benchmarkAgeDays: benchmarkAge,
      }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const parsed = generateRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          message: "Invalid generate request",
          errors: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })),
        });
      }
      const { count, mode, drawFitWeight, antiPopWeight, allocationMethod } = parsed.data;
      const gameId = (req.body?.gameId as string) || undefined;
      const gc = await resolveGameConfig(gameId);

      const draws = await storage.getModernDraws(gameId);
      if (draws.length === 0) {
        return res.status(400).json({ ok: false, message: "No draws available. Upload data first." });
      }

      const handler = getGeneratorHandler(mode);
      const picks = handler({ draws, count, drawFitWeight, antiPopWeight, allocationMethod, gc, gameId });

      const effectiveGameId = gameId || "AU_POWERBALL";
      const previousSet = await storage.getLatestPredictionSet(effectiveGameId, "advanced");

      const saved = await storage.savePredictionSet({
        gameId: effectiveGameId,
        lane: "advanced",
        strategyName: mode,
        seed: 0,
        linesJson: picks,
        notes: null,
      });

      let diff: PredictionDiffResult | null = null;
      if (previousSet) {
        diff = buildDiffResult(previousSet, picks, gc.mainCount);
      }

      res.json(apiResponse(draws, { picks, predictionSetId: saved.id, diff }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
