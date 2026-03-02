import type { InsertDraw } from "@shared/schema";
import { fetchTheLottResults, formatTheLottDate, scrapeTheLottResults } from "./common";
import type { ScrapedDrawData } from "./types";

const GAME_ID = "AU_SATURDAY_LOTTO";
const PRODUCT_FILTER = "TattsLotto";

function normalizeApiDraw(r: { DrawNumber: number; DrawDate: string; PrimaryNumbers: number[]; SecondaryNumbers: number[] }): InsertDraw {
  const mainNumbers = [...r.PrimaryNumbers].sort((a, b) => a - b);
  const supplementary = r.SecondaryNumbers.length > 0
    ? [...r.SecondaryNumbers].sort((a, b) => a - b)
    : null;

  return {
    drawNumber: r.DrawNumber,
    drawDate: formatTheLottDate(r.DrawDate),
    numbers: mainNumbers,
    powerball: supplementary ? supplementary[0] : 0,
    supplementary,
    gameId: GAME_ID,
    isModernFormat: mainNumbers.length === 6 &&
      mainNumbers.every((n) => n >= 1 && n <= 45),
  };
}

function normalizeScrapedDraw(d: ScrapedDrawData): InsertDraw | null {
  if (d.mainNumbers.length < 6) return null;
  if (!d.drawNumber || d.drawNumber <= 0) return null;
  if (!d.drawDate) return null;

  const main = d.mainNumbers.slice(0, 6).sort((a, b) => a - b);
  if (!main.every((n) => n >= 1 && n <= 45)) return null;

  const supps = d.secondaryNumbers.length >= 2
    ? d.secondaryNumbers.slice(0, 2).sort((a, b) => a - b)
    : d.secondaryNumbers.length > 0
      ? d.secondaryNumbers
      : null;

  if (supps && !supps.every((n) => n >= 1 && n <= 45)) return null;

  return {
    drawNumber: d.drawNumber,
    drawDate: d.drawDate,
    numbers: main,
    powerball: supps ? supps[0] : 0,
    supplementary: supps,
    gameId: GAME_ID,
    isModernFormat: true,
  };
}

export async function fetchSaturdayLottoDraws(maxDrawCount: number = 10): Promise<{ draws: InsertDraw[]; source: "api" | "scrape" }> {
  try {
    const results = await fetchTheLottResults(PRODUCT_FILTER, maxDrawCount);
    const draws = results.map(normalizeApiDraw);
    console.log(`[thelott/saturday-lotto] API returned ${draws.length} draws`);
    return { draws, source: "api" };
  } catch (apiErr: any) {
    console.warn(`[thelott/saturday-lotto] API failed: ${apiErr.message}, trying scrape fallback...`);

    try {
      const scraped = await scrapeTheLottResults(PRODUCT_FILTER, GAME_ID);
      const draws = scraped
        .map(normalizeScrapedDraw)
        .filter((d): d is InsertDraw => d !== null);

      if (draws.length > 0) {
        console.log(`[thelott/saturday-lotto] Scrape fallback returned ${draws.length} draws`);
        return { draws, source: "scrape" };
      }
    } catch (scrapeErr: any) {
      console.error(`[thelott/saturday-lotto] Scrape fallback also failed: ${scrapeErr.message}`);
    }

    throw new Error(`Could not fetch Saturday Lotto results: API error (${apiErr.message}) and scrape fallback failed`);
  }
}

export async function fetchSaturdayLottoDrawsLegacy(maxDrawCount: number = 10): Promise<InsertDraw[]> {
  const { draws } = await fetchSaturdayLottoDraws(maxDrawCount);
  return draws;
}
