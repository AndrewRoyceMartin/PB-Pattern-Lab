import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import {
  computeNumberFrequencies,
  computeStructureFeatures,
  computeCarryoverFeatures,
  runWalkForwardValidation,
  generatePicks,
} from "./analysis";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        return res.status(400).json({ message: "CSV file appears to be empty" });
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
        return res.status(400).json({ message: "No valid draws found in CSV. Check format: expects columns for draw number, date, 7 main numbers, and powerball." });
      }

      const inserted = await storage.insertDraws(drawsToInsert);

      res.json({
        message: "Upload successful",
        totalRows: rows.length,
        validDraws: inserted.length,
        modernDraws: inserted.filter(d => d.isModernFormat).length,
        latestDate: inserted.length > 0 ? inserted[0].drawDate : null,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Failed to process CSV: " + error.message });
    }
  });

  app.get("/api/draws", async (_req, res) => {
    try {
      const allDraws = await storage.getModernDraws();
      res.json(allDraws);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stats", async (_req, res) => {
    try {
      const allDraws = await storage.getAllDraws();
      const modernDraws = allDraws.filter(d => d.isModernFormat);
      const count = allDraws.length;
      const modernCount = modernDraws.length;
      const latestDate = modernDraws.length > 0 ? modernDraws[0].drawDate : null;
      res.json({ totalDraws: count, modernDraws: modernCount, latestDate });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis/frequencies", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const freqs = computeNumberFrequencies(draws);
      res.json(freqs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis/features", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      if (draws.length === 0) {
        return res.json({ structure: [], carryover: [] });
      }
      const structure = computeStructureFeatures(draws[0]);
      const carryover = computeCarryoverFeatures(draws);
      res.json({ structure, carryover });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis/validation", async (_req, res) => {
    try {
      const draws = await storage.getModernDraws();
      const results = runWalkForwardValidation(draws);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { count = 10, drawFitWeight = 60, antiPopWeight = 40 } = req.body || {};
      const draws = await storage.getModernDraws();
      if (draws.length === 0) {
        return res.status(400).json({ message: "No draws available. Upload data first." });
      }
      const picks = generatePicks(draws, count, drawFitWeight, antiPopWeight);
      res.json(picks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
