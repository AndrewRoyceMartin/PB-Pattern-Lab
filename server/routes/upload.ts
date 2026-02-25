import type { Express } from "express";
import multer from "multer";
import { parse as csvParse } from "csv-parse/sync";
import { storage } from "../storage";
import { apiResponse } from "./helpers";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export function registerUploadRoutes(app: Express): void {
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, message: "No file uploaded" });
      }

      const csvText = req.file.buffer.toString("utf-8");

      let records: string[][];
      try {
        records = csvParse(csvText, {
          columns: false,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
          relax_quotes: true,
        });
      } catch (parseErr: any) {
        return res.status(400).json({ ok: false, message: `CSV parsing error: ${parseErr.message}` });
      }

      if (records.length < 2) {
        return res.status(400).json({ ok: false, message: "CSV file appears to be empty" });
      }

      const headerCols = records[0].map(h => h.trim().toLowerCase());
      const dataRows = records.slice(1);

      await storage.clearDraws();

      const drawsToInsert: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < dataRows.length; i++) {
        const cols = dataRows[i].map(c => c.trim());
        if (cols.length < 9) {
          errors.push(`Row ${i + 2}: insufficient columns (${cols.length}, need at least 9)`);
          continue;
        }

        const parsed = parseCSVRow(headerCols, cols);
        if (!parsed) {
          errors.push(`Row ${i + 2}: could not extract valid draw data`);
          continue;
        }

        drawsToInsert.push(parsed);
      }

      if (drawsToInsert.length === 0) {
        return res.status(400).json({
          ok: false,
          message: "No valid draws found in CSV. Check format: expects columns for draw number, date, 7 main numbers, and powerball.",
          errors: errors.slice(0, 20),
        });
      }

      const inserted = await storage.insertDraws(drawsToInsert);

      res.json({
        ok: true,
        meta: { drawsUsed: inserted.length, modernFormatOnly: false, generatedAt: new Date().toISOString() },
        data: {
          totalRows: dataRows.length,
          validDraws: inserted.length,
          modernDraws: inserted.filter(d => d.isModernFormat).length,
          latestDate: inserted.length > 0 ? inserted[0].drawDate : null,
          parseErrors: errors.length > 0 ? errors.slice(0, 20) : undefined,
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
}

function parseCSVRow(headers: string[], cols: string[]): any | null {
  try {
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
