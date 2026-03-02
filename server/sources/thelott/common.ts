import * as cheerio from "cheerio";
import type { ScrapedDrawData } from "./types";

const THELOTT_API_URL = "https://data.api.thelott.com/sales/vmax/web/data/lotto/latestresults";

const COMPANY_IDS = ["GoldenCasket", "NSWLotteries", "SALotteries"];

const SCRAPE_URLS: Record<string, string> = {
  Powerball: "https://www.thelott.com/powerball/results",
  TattsLotto: "https://www.thelott.com/saturday-lotto/results",
};

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-AU,en;q=0.9",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1100;

const htmlCache: Map<string, { html: string; timestamp: number }> = new Map();
const HTML_CACHE_TTL_MS = 60_000;

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

async function rateLimitedWait(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export async function fetchTheLottResults(
  productFilter: string,
  maxDrawCount: number = 10
): Promise<TheLottDrawResult[]> {
  const errors: string[] = [];

  for (const companyId of COMPANY_IDS) {
    try {
      await rateLimitedWait();

      const resp = await fetch(THELOTT_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "PBPatternLab/1.0",
        },
        body: JSON.stringify({
          CompanyId: companyId,
          MaxDrawCountPerProduct: Math.min(maxDrawCount, 20),
          OptionalProductFilter: [productFilter],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        errors.push(`${companyId}: HTTP ${resp.status}`);
        continue;
      }

      const data: TheLottResponse = await resp.json();

      if (!data.Success || data.ErrorInfo) {
        errors.push(`${companyId}: ${data.ErrorInfo?.DisplayMessage || "API error"}`);
        continue;
      }

      if (data.DrawResults && data.DrawResults.length > 0) {
        return data.DrawResults;
      }

      errors.push(`${companyId}: Empty results`);
    } catch (err: any) {
      errors.push(`${companyId}: ${err.message}`);
    }
  }

  throw new Error(`All API sources failed for ${productFilter}: ${errors.join("; ")}`);
}

export function formatTheLottDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

async function fetchHtml(url: string): Promise<string> {
  const cached = htmlCache.get(url);
  if (cached && Date.now() - cached.timestamp < HTML_CACHE_TTL_MS) {
    return cached.html;
  }

  await rateLimitedWait();

  const resp = await fetch(url, {
    method: "GET",
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });

  if (!resp.ok) {
    throw new Error(`HTML fetch ${url} returned ${resp.status}`);
  }

  const html = await resp.text();
  htmlCache.set(url, { html, timestamp: Date.now() });
  return html;
}

function extractNextData(html: string): any | null {
  try {
    const match = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
    if (match?.[1]) {
      return JSON.parse(match[1]);
    }
  } catch {}
  return null;
}

function extractLdJson(html: string): any[] {
  const results: any[] = [];
  const regex = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {}
  }
  return results;
}

function extractJsonCandidates(html: string): any[] {
  const candidates: any[] = [];

  const nextData = extractNextData(html);
  if (nextData) candidates.push(nextData);

  const ldJsons = extractLdJson(html);
  candidates.push(...ldJsons);

  return candidates;
}

function parseNumbersFromText(text: string): number[] {
  const nums = text.match(/\d+/g);
  return nums ? nums.map(Number).filter((n) => n >= 1 && n <= 45) : [];
}

function fallbackHtmlParse(html: string, gameId: string): ScrapedDrawData[] {
  const $ = cheerio.load(html);
  const draws: ScrapedDrawData[] = [];

  const numberBlocks = $('[class*="winning"], [class*="result"], [class*="number"], [class*="ball"]');

  if (numberBlocks.length === 0) {
    const bodyText = $("body").text();
    const drawMatch = bodyText.match(/Draw\s*#?\s*(\d+)/i);
    const dateMatch = bodyText.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    const allNums = parseNumbersFromText(bodyText);

    if (allNums.length >= 6) {
      const isPowerball = gameId === "AU_POWERBALL";
      const mainCount = isPowerball ? 7 : 6;
      const mainNumbers = allNums.slice(0, mainCount);
      const secondaryNumbers = allNums.slice(mainCount, mainCount + (isPowerball ? 1 : 2));

      draws.push({
        drawNumber: drawMatch ? parseInt(drawMatch[1]) : undefined,
        drawDate: dateMatch ? `${dateMatch[1].padStart(2, "0")}/${getMonthNumber(dateMatch[2])}/${dateMatch[3]}` : undefined,
        mainNumbers,
        secondaryNumbers,
        source: "scrape",
      });
    }
  } else {
    $('[class*="result-card"], [class*="draw-result"], article, .result').each((_, el) => {
      const text = $(el).text();
      const nums = parseNumbersFromText(text);
      const drawMatch = text.match(/Draw\s*#?\s*(\d+)/i);
      const dateMatch = text.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);

      if (nums.length >= 6) {
        const isPowerball = gameId === "AU_POWERBALL";
        const mainCount = isPowerball ? 7 : 6;

        draws.push({
          drawNumber: drawMatch ? parseInt(drawMatch[1]) : undefined,
          drawDate: dateMatch ? `${dateMatch[1].padStart(2, "0")}/${getMonthNumber(dateMatch[2])}/${dateMatch[3]}` : undefined,
          mainNumbers: nums.slice(0, mainCount),
          secondaryNumbers: nums.slice(mainCount, mainCount + (isPowerball ? 1 : 2)),
          source: "scrape",
        });
      }
    });
  }

  return draws;
}

function getMonthNumber(month: string): string {
  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };
  return months[month.toLowerCase()] || "01";
}

function safeDateFormat(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  try {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return undefined;
    return formatTheLottDate(dateStr);
  } catch {
    return undefined;
  }
}

function findDrawsInJsonCandidates(candidates: any[], gameId: string): ScrapedDrawData[] {
  const draws: ScrapedDrawData[] = [];

  function searchObj(obj: any, depth: number = 0): void {
    if (depth > 10 || !obj || typeof obj !== "object") return;

    if (Array.isArray(obj)) {
      for (const item of obj) searchObj(item, depth + 1);
      return;
    }

    const hasPrimary = obj.PrimaryNumbers || obj.primaryNumbers || obj.winningNumbers || obj.numbers;
    const hasDrawNum = obj.DrawNumber || obj.drawNumber || obj.draw_number;

    if (hasPrimary && hasDrawNum) {
      const primary = obj.PrimaryNumbers || obj.primaryNumbers || obj.winningNumbers || obj.numbers;
      const secondary = obj.SecondaryNumbers || obj.secondaryNumbers || obj.supplementary || obj.bonusNumbers || [];
      const drawNum = obj.DrawNumber || obj.drawNumber || obj.draw_number;
      const rawDate = obj.DrawDate || obj.drawDate || obj.draw_date;

      const parsedDrawNum = typeof drawNum === "number" ? drawNum : parseInt(drawNum);
      const parsedDate = rawDate ? safeDateFormat(rawDate) : undefined;

      if (Array.isArray(primary) && primary.length >= 6 && parsedDrawNum > 0) {
        draws.push({
          drawNumber: parsedDrawNum,
          drawDate: parsedDate,
          mainNumbers: primary.map(Number),
          secondaryNumbers: Array.isArray(secondary) ? secondary.map(Number) : [],
          source: "scrape",
        });
      }
    }

    for (const key of Object.keys(obj)) {
      searchObj(obj[key], depth + 1);
    }
  }

  for (const candidate of candidates) {
    searchObj(candidate);
  }

  return draws;
}

export async function scrapeTheLottResults(
  productFilter: string,
  gameId: string
): Promise<ScrapedDrawData[]> {
  const url = SCRAPE_URLS[productFilter];
  if (!url) {
    throw new Error(`No scrape URL configured for ${productFilter}`);
  }

  try {
    const html = await fetchHtml(url);

    const jsonCandidates = extractJsonCandidates(html);
    if (jsonCandidates.length > 0) {
      const draws = findDrawsInJsonCandidates(jsonCandidates, gameId);
      if (draws.length > 0) {
        console.log(`[thelott/scrape] Found ${draws.length} draws via JSON extraction for ${productFilter}`);
        return draws;
      }
    }

    const htmlDraws = fallbackHtmlParse(html, gameId);
    if (htmlDraws.length > 0) {
      console.log(`[thelott/scrape] Found ${htmlDraws.length} draws via HTML fallback for ${productFilter}`);
      return htmlDraws;
    }

    console.warn(`[thelott/scrape] Could not parse results for ${productFilter} – site format may have changed`);
    return [];
  } catch (err: any) {
    console.error(`[thelott/scrape] Scrape failed for ${productFilter}: ${err.message}`);
    return [];
  }
}
