import type { Express } from "express";
import { storage } from "../storage";
import { apiResponse } from "./helpers";
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
}
