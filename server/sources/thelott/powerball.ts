import type { InsertDraw } from "@shared/schema";
import { fetchTheLottResults, formatTheLottDate } from "./common";

const GAME_ID = "AU_POWERBALL";
const PRODUCT_FILTER = "Powerball";

export async function fetchPowerballDraws(maxDrawCount: number = 10): Promise<InsertDraw[]> {
  const results = await fetchTheLottResults(PRODUCT_FILTER, maxDrawCount);

  return results.map((r) => ({
    drawNumber: r.DrawNumber,
    drawDate: formatTheLottDate(r.DrawDate),
    numbers: [...r.PrimaryNumbers].sort((a, b) => a - b),
    powerball: r.SecondaryNumbers[0],
    supplementary: null,
    gameId: GAME_ID,
    isModernFormat: r.PrimaryNumbers.length === 7 &&
      r.PrimaryNumbers.every((n) => n >= 1 && n <= 35) &&
      r.SecondaryNumbers[0] >= 1 && r.SecondaryNumbers[0] <= 20,
  }));
}
