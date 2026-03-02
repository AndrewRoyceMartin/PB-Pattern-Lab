import type { Express } from "express";
import { storage, getGameConfig, DEFAULT_GAME_CONFIG } from "../storage";
import { apiResponse } from "./helpers";
import { formulaLabRequestSchema } from "@shared/schema";
import type { GameConfig } from "@shared/schema";
import { runFormulaOptimizer } from "../formula-lab";

async function resolveGameConfig(gameId?: string): Promise<GameConfig> {
  if (!gameId) return DEFAULT_GAME_CONFIG;
  const game = await storage.getGame(gameId);
  return game ? getGameConfig(game) : DEFAULT_GAME_CONFIG;
}

export function registerFormulaLabRoutes(app: Express): void {
  app.post("/api/formula-lab/optimize", async (req, res) => {
    try {
      const parsed = formulaLabRequestSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({
          ok: false,
          message: "Invalid Formula Lab request",
          errors: parsed.error.issues.map(i => ({ path: i.path.join("."), message: i.message })),
        });
      }

      const gameId = (req.body?.gameId as string) || undefined;
      const gc = await resolveGameConfig(gameId);
      const draws = await storage.getModernDraws(gameId);
      if (draws.length < 50) {
        return res.status(400).json({ ok: false, message: "Need at least 50 modern draws for Formula Lab optimization." });
      }

      const validated = parsed.data;
      const config = {
        features: validated.features,
        trainingWindowSize: validated.trainingWindowSize ?? Math.min(200, Math.floor(draws.length * 0.7)),
        searchIterations: validated.searchIterations,
        regularizationStrength: validated.regularizationStrength,
        objective: validated.objective,
      };

      const result = runFormulaOptimizer(draws, config, gc);
      res.json(apiResponse(draws, result));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
