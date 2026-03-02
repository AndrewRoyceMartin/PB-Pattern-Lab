import type { InsertDraw } from "@shared/schema";
import { fetchTheLottResults, formatTheLottDate } from "./common";

const GAME_ID = "AU_SATURDAY_LOTTO";
const PRODUCT_FILTER = "TattsLotto";

export async function fetchSaturdayLottoDraws(maxDrawCount: number = 10): Promise<InsertDraw[]> {
  const results = await fetchTheLottResults(PRODUCT_FILTER, maxDrawCount);

  return results.map((r) => {
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
  });
}
