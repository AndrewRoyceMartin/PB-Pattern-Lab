import type { InsertDraw } from "@shared/schema";

export interface NormalizedDraw {
  gameId: string;
  drawNumber: number;
  drawDate: string;
  mainNumbers: number[];
  specialBalls?: Record<string, number>;
  supplementaries?: number[];
  sourceUrl: string;
  raw?: any;
}

export interface SyncResult {
  gameId: string;
  fetchedCount: number;
  insertedCount: number;
  skippedCount: number;
  latestDrawDate: string | null;
  errors: string[];
  draws: InsertDraw[];
  source: "api" | "scrape";
}

export interface ScrapedDrawData {
  drawNumber?: number;
  drawDate?: string;
  mainNumbers: number[];
  secondaryNumbers: number[];
  source: "api" | "scrape";
}
