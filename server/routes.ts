import type { Express } from "express";
import type { Server } from "http";
import { registerUploadRoutes } from "./routes/upload";
import { registerAnalysisRoutes } from "./routes/analysis";
import { registerValidationRoutes } from "./routes/validation";
import { registerGeneratorRoutes } from "./routes/generator";
import { registerFormulaLabRoutes } from "./routes/formulaLab";
import { registerAutoRoutes } from "./routes/auto";
import { registerSyncRoutes } from "./routes/sync";
import { registerPredictionRoutes } from "./routes/predictions";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerUploadRoutes(app);
  registerAnalysisRoutes(app);
  registerValidationRoutes(app);
  registerGeneratorRoutes(app);
  registerFormulaLabRoutes(app);
  registerAutoRoutes(app);
  registerSyncRoutes(app);
  registerPredictionRoutes(app);

  return httpServer;
}
