import type { Express } from "express";
import { storage } from "../storage";
import { fetchPowerballDraws } from "../sources/thelott/powerball";
import { fetchSaturdayLottoDraws } from "../sources/thelott/saturdayLotto";
import type { InsertDraw } from "@shared/schema";

function apiResponse(data: any, drawsUsed: number = 0) {
  return {
    ok: true,
    meta: { drawsUsed, modernFormatOnly: true, generatedAt: new Date().toISOString() },
    data,
  };
}

export function registerSyncRoutes(app: Express) {
  app.get("/api/games", async (_req, res) => {
    try {
      const gamesList = await storage.listGames();
      res.json(apiResponse(gamesList, 0));
    } catch (err: any) {
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/sync/thelott/powerball", async (req, res) => {
    try {
      const maxPages = Math.min(req.body?.maxPages ?? 1, 50);
      const stopIfSeen = req.body?.stopIfSeen ?? true;
      const gameId = "AU_POWERBALL";

      let totalSynced = 0;
      let totalSkipped = 0;
      let allDraws: InsertDraw[] = [];

      for (let page = 0; page < maxPages; page++) {
        const draws = await fetchPowerballDraws(10);
        if (draws.length === 0) break;

        let seenExisting = false;
        for (const draw of draws) {
          const existing = await storage.getDrawByNumber(draw.drawNumber, gameId);
          if (existing) {
            totalSkipped++;
            seenExisting = true;
          } else {
            allDraws.push(draw);
            totalSynced++;
          }
        }

        if (stopIfSeen && seenExisting) break;
      }

      if (allDraws.length > 0) {
        await storage.insertDraws(allDraws);
      }

      res.json(apiResponse({
        synced: totalSynced,
        skipped: totalSkipped,
        message: totalSynced > 0
          ? `Synced ${totalSynced} new Powerball draws from TheLott`
          : `Already up to date (${totalSkipped} draws already exist)`,
        draws: allDraws.map(d => ({
          drawNumber: d.drawNumber,
          drawDate: d.drawDate,
          numbers: d.numbers,
          powerball: d.powerball,
        })),
      }, totalSynced));
    } catch (err: any) {
      console.error("[sync/powerball]", err.message);
      res.status(500).json({ ok: false, message: err.message });
    }
  });

  app.post("/api/sync/thelott/saturday-lotto", async (req, res) => {
    try {
      const maxPages = Math.min(req.body?.maxPages ?? 1, 50);
      const stopIfSeen = req.body?.stopIfSeen ?? true;
      const gameId = "AU_SATURDAY_LOTTO";

      let totalSynced = 0;
      let totalSkipped = 0;
      let allDraws: InsertDraw[] = [];

      for (let page = 0; page < maxPages; page++) {
        const draws = await fetchSaturdayLottoDraws(10);
        if (draws.length === 0) break;

        let seenExisting = false;
        for (const draw of draws) {
          const existing = await storage.getDrawByNumber(draw.drawNumber, gameId);
          if (existing) {
            totalSkipped++;
            seenExisting = true;
          } else {
            allDraws.push(draw);
            totalSynced++;
          }
        }

        if (stopIfSeen && seenExisting) break;
      }

      if (allDraws.length > 0) {
        await storage.insertDraws(allDraws);
      }

      res.json(apiResponse({
        synced: totalSynced,
        skipped: totalSkipped,
        message: totalSynced > 0
          ? `Synced ${totalSynced} new Saturday Lotto draws from TheLott`
          : `Already up to date (${totalSkipped} draws already exist)`,
        draws: allDraws.map(d => ({
          drawNumber: d.drawNumber,
          drawDate: d.drawDate,
          numbers: d.numbers,
          supplementary: d.supplementary,
        })),
      }, totalSynced));
    } catch (err: any) {
      console.error("[sync/saturday-lotto]", err.message);
      res.status(500).json({ ok: false, message: err.message });
    }
  });
}
