const THELOTT_API_URL = "https://data.api.thelott.com/sales/vmax/web/data/lotto/latestresults";

export interface TheLottDrawResult {
  ProductId: string;
  DrawNumber: number;
  DrawDate: string;
  DrawDisplayName: string;
  PrimaryNumbers: number[];
  SecondaryNumbers: number[];
  DrawType: string;
}

export interface TheLottResponse {
  DrawResults: TheLottDrawResult[];
  ErrorInfo: { DisplayMessage: string } | null;
  Success: boolean;
}

export async function fetchTheLottResults(
  productFilter: string,
  maxDrawCount: number = 10
): Promise<TheLottDrawResult[]> {
  const resp = await fetch(THELOTT_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "PBPatternLab/1.0",
    },
    body: JSON.stringify({
      CompanyId: "GoldenCasket",
      MaxDrawCountPerProduct: Math.min(maxDrawCount, 20),
      OptionalProductFilter: [productFilter],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) {
    throw new Error(`TheLott API returned ${resp.status}`);
  }

  const data: TheLottResponse = await resp.json();

  if (!data.Success || data.ErrorInfo) {
    throw new Error(data.ErrorInfo?.DisplayMessage || "TheLott API error");
  }

  return data.DrawResults || [];
}

export function formatTheLottDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
