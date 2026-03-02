import type { InsertDraw } from "@shared/schema";
import { fetchTheLottResults, formatTheLottDate, scrapeTheLottResults } from "./common";
import type { ScrapedDrawData } from "./types";

const GAME_ID = "AU_POWERBALL";
const PRODUCT_FILTER = "Powerball";

function normalizeApiDraw(r: { DrawNumber: number; DrawDate: string; PrimaryNumbers: number[]; SecondaryNumbers: number[] }): InsertDraw {
  return {
    drawNumber: r.DrawNumber,
    drawDate: formatTheLottDate(r.DrawDate),
    numbers: [...r.PrimaryNumbers].sort((a, b) => a - b),
    powerball: r.SecondaryNumbers[0],
    supplementary: null,
    gameId: GAME_ID,
    isModernFormat: r.PrimaryNumbers.length === 7 &&
      r.PrimaryNumbers.every((n) => n >= 1 && n <= 35) &&
      r.SecondaryNumbers[0] >= 1 && r.SecondaryNumbers[0] <= 20,
  };
}

function normalizeScrapedDraw(d: ScrapedDrawData): InsertDraw | null {
  if (d.mainNumbers.length < 7) return null;
  if (!d.drawNumber || d.drawNumber <= 0) return null;
  if (!d.drawDate) return null;

  const main = d.mainNumbers.slice(0, 7).sort((a, b) => a - b);
  if (!main.every((n) => n >= 1 && n <= 35)) return null;

  const pb = d.secondaryNumbers.length > 0 ? d.secondaryNumbers[0] : 0;
  if (pb < 1 || pb > 20) return null;

  return {
    drawNumber: d.drawNumber,
    drawDate: d.drawDate,
    numbers: main,
    powerball: pb,
    supplementary: null,
    gameId: GAME_ID,
    isModernFormat: true,
  };
}

export async function fetchPowerballDraws(maxDrawCount: number = 10): Promise<{ draws: InsertDraw[]; source: "api" | "scrape" }> {
  try {
    const results = await fetchTheLottResults(PRODUCT_FILTER, maxDrawCount);
    const draws = results.map(normalizeApiDraw);
    console.log(`[thelott/powerball] API returned ${draws.length} draws`);
    return { draws, source: "api" };
  } catch (apiErr: any) {
    console.warn(`[thelott/powerball] API failed: ${apiErr.message}, trying scrape fallback...`);

    try {
      const scraped = await scrapeTheLottResults(PRODUCT_FILTER, GAME_ID);
      const draws = scraped
        .map(normalizeScrapedDraw)
        .filter((d): d is InsertDraw => d !== null);

      if (draws.length > 0) {
        console.log(`[thelott/powerball] Scrape fallback returned ${draws.length} draws`);
        return { draws, source: "scrape" };
      }
    } catch (scrapeErr: any) {
      console.error(`[thelott/powerball] Scrape fallback also failed: ${scrapeErr.message}`);
    }

    throw new Error(`Could not fetch Powerball results: API error (${apiErr.message}) and scrape fallback failed`);
  }
}

export async function fetchPowerballDrawsLegacy(maxDrawCount: number = 10): Promise<InsertDraw[]> {
  const { draws } = await fetchPowerballDraws(maxDrawCount);
  return draws;
}
