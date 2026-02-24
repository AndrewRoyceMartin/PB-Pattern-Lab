import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import type { ApiResponse, GeneratorMode } from "@shared/schema";
import {
  computeNumberFrequencies,
  computePatternFeatures,
  runRandomnessAudit,
  runWalkForwardValidation,
  generateRankedPicks,
} from "./analysis";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function apiResponse<T>(draws: any[], data: T): ApiResponse<T> {
  return {
    ok: true,
    meta: {
      drawsUsed: draws.length,
      modernFormatOnly: true,
      generatedAt: new Date().toISOString(),
    },
    data,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({ ok: false, message: "CSV file appears to be empty" });
      }

      const header = lines[0].toLowerCase();
      const rows = lines.slice(1);

      await storage.clearDraws();

      const drawsToInsert: any[] = [];

      for (const row of rows) {
        const cols = row.split(",").map(c => c.trim());
        if (cols.length < 9) continue;

        const parsed = parseCSVRow(header, cols);
        if (!parsed) continue;

        drawsToInsert.push(parsed);
      }

      if (drawsToInsert.length === 0) {
        return res.status(400).json({ ok: false, message: "No valid draws found in CSV. Check format: expects columns for draw number, date, 7 main numbers, and powerball." });
      }

      const inserted = await storage.insertDraws(drawsToInsert);

      res.json({
        ok: true,
        meta: { drawsUsed: inserted.length, modernFormatOnly: false, generatedAt: new Date().toISOString() },
        data: {
          totalRows: rows.length,
          validDraws: inserted.length,
          modernDraws: inserted.filter(d => d.isModernFormat).length,
          latestDate: inserted.length > 0 ? inserted[0].drawDate : null,
        },
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ ok: false, message: "Failed to process CSV: " + error.message });
    }
  });

  app.delete("/api/draws", async (_req, res) => {
    try {
      await storage.clearDraws();
      res.json({ ok: true, meta: { drawsUsed: 0, modernFormatOnly: true, generatedAt: new Date().toISOString() }, data: { message: "All draw data cleared." } });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/draws", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      res.json(apiResponse(draws, draws));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const allDraws = await storage.getAllDraws();
      const modernDraws = allDraws.filter(d => d.isModernFormat);
      const latestDate = modernDraws.length > 0 ? modernDraws[0].drawDate : null;
      res.json(apiResponse(allDraws, {
        totalDraws: allDraws.length,
        modernDraws: modernDraws.length,
        latestDate,
      }));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

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
      const audit = runRandomnessAudit(draws);
      res.json(apiResponse(draws, audit));
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

  app.post("/api/generate", async (req, res) => {
    try {
      const { count = 10, mode = "balanced" } = req.body || {};

      let drawFitWeight: number;
      let antiPopWeight: number;

      switch (mode as GeneratorMode) {
        case "anti_popular":
          drawFitWeight = 20; antiPopWeight = 80; break;
        case "pattern_only":
          drawFitWeight = 100; antiPopWeight = 0; break;
        case "random_baseline":
          drawFitWeight = 0; antiPopWeight = 0; break;
        default:
          drawFitWeight = req.body?.drawFitWeight ?? 60;
          antiPopWeight = req.body?.antiPopWeight ?? 40;
      }

      const draws = await storage.getModernDraws();
      if (draws.length === 0) {
        return res.status(400).json({ ok: false, message: "No draws available. Upload data first." });
      }
      const picks = generateRankedPicks(draws, count, drawFitWeight, antiPopWeight);
      res.json(apiResponse(draws, picks));
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  return httpServer;
}

function parseCSVRow(header: string, cols: string[]): any | null {
  try {
    const headers = header.split(",").map(h => h.trim().toLowerCase());

    let drawNumber = 0;
    let drawDate = "";
    let numbers: number[] = [];
    let powerball = 0;

    const drawNumIdx = headers.findIndex(h => h.includes("draw") && (h.includes("num") || h.includes("no") || h.includes("#")));
    const dateIdx = headers.findIndex(h => h.includes("date") || h.includes("draw date"));

    if (drawNumIdx >= 0) {
      drawNumber = parseInt(cols[drawNumIdx]) || 0;
    }
    if (dateIdx >= 0) {
      drawDate = cols[dateIdx];
    }

    const numHeaders: number[] = [];
    const pbIdx = headers.findIndex(h =>
      h === "powerball" || h === "pb" || h === "supp" ||
      h.includes("powerball") || h.includes("supplementary")
    );

    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (i === drawNumIdx || i === dateIdx || i === pbIdx) continue;

      if (
        h.match(/^(number|num|ball|winning)\s*\d*$/) ||
        h.match(/^\d+$/) ||
        h.includes("number") ||
        h.includes("ball") ||
        h.includes("winning")
      ) {
        const val = parseInt(cols[i]);
        if (!isNaN(val) && val >= 1 && val <= 35) {
          numHeaders.push(i);
        }
      }
    }

    if (numHeaders.length < 7) {
      for (let i = 0; i < headers.length; i++) {
        if (numHeaders.includes(i) || i === drawNumIdx || i === dateIdx || i === pbIdx) continue;
        const val = parseInt(cols[i]);
        if (!isNaN(val) && val >= 1 && val <= 45) {
          numHeaders.push(i);
        }
      }
    }

    numbers = numHeaders.slice(0, 7).map(idx => parseInt(cols[idx])).filter(n => !isNaN(n));

    if (pbIdx >= 0) {
      powerball = parseInt(cols[pbIdx]) || 0;
    } else if (numHeaders.length > 7) {
      powerball = parseInt(cols[numHeaders[7]]) || 0;
    }

    const isModern = numbers.length === 7 && numbers.every(n => n >= 1 && n <= 35) && powerball >= 1 && powerball <= 20;

    if (numbers.length < 7) return null;
    if (drawNumber === 0 && drawDate === "") return null;

    return {
      drawNumber: drawNumber || 0,
      drawDate: drawDate || "unknown",
      numbers: numbers.sort((a, b) => a - b),
      powerball,
      isModernFormat: isModern,
    };
  } catch {
    return null;
  }
}
