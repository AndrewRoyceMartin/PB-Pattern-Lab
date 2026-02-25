import type { Express } from "express";
import { storage } from "../storage";
import { apiResponse } from "./helpers";
import { generateRequestSchema } from "@shared/schema";
import {
  getGeneratorRecommendation,
  loadBenchmarkFromDb,
  getLatestBenchmarkTime,
} from "../analysis";
import { getGeneratorHandler } from "../generator-registry";

export function registerGeneratorRoutes(app: Express): void {
  app.get("/api/generator/recommendation", async (_req, res) => {
    try {
      if (!getLatestBenchmarkTime()) {
        const latestRun = await storage.getLatestBenchmarkRun();
        if (latestRun) {
          loadBenchmarkFromDb(latestRun.summary as any, latestRun.createdAt);
        }
      }
      const recommendation = getGeneratorRecommendation();
      const draws = await storage.getModernDraws();

      const latestRun = await storage.getLatestBenchmarkRun();
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

      const draws = await storage.getModernDraws();
      if (draws.length === 0) {
        return res.status(400).json({ ok: false, message: "No draws available. Upload data first." });
      }

      const handler = getGeneratorHandler(mode);
      const picks = handler({ draws, count, drawFitWeight, antiPopWeight, allocationMethod });
      res.json(apiResponse(draws, picks));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
