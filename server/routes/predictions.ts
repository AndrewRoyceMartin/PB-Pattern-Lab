import type { Express } from "express";
import { storage, getGameConfig, DEFAULT_GAME_CONFIG } from "../storage";
import { apiResponse } from "./helpers";
import { buildDiffResult } from "../diff-engine";
import type { GeneratedPick, LineEvaluationResult } from "@shared/schema";

export function registerPredictionRoutes(app: Express): void {
  app.get("/api/predictions/latest", async (req, res) => {
    try {
      const gameId = (req.query.gameId as string) || "AU_POWERBALL";
      const lane = (req.query.lane as string) || "cnf";
      const set = await storage.getLatestPredictionSet(gameId, lane);
      if (!set) {
        return res.json({ ok: true, data: null });
      }
      const draws = await storage.getModernDraws(gameId);
      res.json(apiResponse(draws, set));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/predictions/compare-latest", async (req, res) => {
    try {
      const gameId = (req.query.gameId as string) || "AU_POWERBALL";
      const lane = (req.query.lane as string) || "cnf";

      const latest = await storage.getLatestPredictionSet(gameId, lane);
      if (!latest) {
        return res.json({ ok: true, data: { latest: null, previous: null, diff: null } });
      }

      const previous = await storage.getPreviousPredictionSet(gameId, lane, latest.id);

      const game = await storage.getGame(gameId);
      const gc = game ? getGameConfig(game) : DEFAULT_GAME_CONFIG;

      let diff = null;
      if (previous) {
        diff = buildDiffResult(previous, latest.linesJson as GeneratedPick[], gc.mainCount);
      }

      const draws = await storage.getModernDraws(gameId);
      res.json(apiResponse(draws, { latest, previous, diff }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/predictions/history", async (req, res) => {
    try {
      const gameId = (req.query.gameId as string) || undefined;
      const lane = (req.query.lane as string) || undefined;
      const limit = parseInt(req.query.limit as string) || 20;
      const sets = await storage.listPredictionSets(gameId, lane, limit);
      const draws = await storage.getModernDraws(gameId);
      res.json(apiResponse(draws, sets));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.post("/api/predictions/evaluate", async (req, res) => {
    try {
      const { predictionSetId, drawNumber } = req.body;
      if (!predictionSetId || !drawNumber) {
        return res.status(400).json({ ok: false, message: "predictionSetId and drawNumber are required" });
      }

      const predSet = await storage.getPredictionSetById(predictionSetId);
      if (!predSet) {
        return res.status(404).json({ ok: false, message: "Prediction set not found" });
      }

      const draw = await storage.getDrawByNumber(drawNumber, predSet.gameId);
      if (!draw) {
        return res.status(404).json({ ok: false, message: `Draw #${drawNumber} not found for game ${predSet.gameId}` });
      }

      const drawnMains = new Set(draw.numbers as number[]);
      const drawnPb = draw.powerball;
      const lines = predSet.linesJson as GeneratedPick[];

      const lineResults: LineEvaluationResult[] = lines.map((line, i) => {
        const mainMatches = line.numbers.filter(n => drawnMains.has(n));
        const pbHit = line.powerball === drawnPb;
        return {
          lineIndex: i,
          mainHits: mainMatches.length,
          mainMatches,
          pbHit,
          prize: null,
        };
      });

      const bestLine = lineResults.reduce((best, lr) => {
        const score = lr.mainHits * 10 + (lr.pbHit ? 1 : 0);
        const bestScore = best.mainHits * 10 + (best.pbHit ? 1 : 0);
        return score > bestScore ? lr : best;
      }, lineResults[0]);

      const totalMainHits = lineResults.reduce((sum, lr) => sum + lr.mainHits, 0);
      const totalPbHits = lineResults.filter(lr => lr.pbHit).length;

      const evaluation = await storage.savePredictionEvaluation({
        predictionSetId,
        drawNumber,
        gameId: predSet.gameId,
        lineResults: lineResults as any,
        bestMainHits: bestLine.mainHits,
        bestPbHit: bestLine.pbHit,
        totalMainHits,
        totalPbHits,
        linesEvaluated: lines.length,
      });

      const game = await storage.getGame(predSet.gameId);
      const gc = game ? getGameConfig(game) : DEFAULT_GAME_CONFIG;
      const expectedMainHitRate = gc.mainCount / gc.mainPool;
      const expectedPbHitRate = 1 / gc.specialPool;

      const draws = await storage.getModernDraws(predSet.gameId);
      res.json(apiResponse(draws, {
        evaluation,
        drawnNumbers: draw.numbers,
        drawnPowerball: draw.powerball,
        bestLine: {
          lineIndex: bestLine.lineIndex,
          mainHits: bestLine.mainHits,
          mainMatches: bestLine.mainMatches,
          pbHit: bestLine.pbHit,
        },
        hitDistribution: {
          0: lineResults.filter(lr => lr.mainHits === 0).length,
          1: lineResults.filter(lr => lr.mainHits === 1).length,
          2: lineResults.filter(lr => lr.mainHits === 2).length,
          3: lineResults.filter(lr => lr.mainHits === 3).length,
          4: lineResults.filter(lr => lr.mainHits === 4).length,
          5: lineResults.filter(lr => lr.mainHits === 5).length,
          6: lineResults.filter(lr => lr.mainHits === 6).length,
          7: lineResults.filter(lr => lr.mainHits === 7).length,
        },
        pbHitRate: totalPbHits / lines.length,
        expectedMainHitRate,
        expectedPbHitRate,
        avgMainHits: totalMainHits / lines.length,
        expectedAvgMainHits: gc.mainCount * gc.mainCount / gc.mainPool,
      }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
