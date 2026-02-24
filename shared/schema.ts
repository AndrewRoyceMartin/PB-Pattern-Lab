import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const draws = pgTable("draws", {
  id: serial("id").primaryKey(),
  drawNumber: integer("draw_number").notNull(),
  drawDate: text("draw_date").notNull(),
  numbers: json("numbers").$type<number[]>().notNull(),
  powerball: integer("powerball").notNull(),
  isModernFormat: boolean("is_modern_format").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDrawSchema = createInsertSchema(draws).omit({ id: true, createdAt: true });
export type InsertDraw = z.infer<typeof insertDrawSchema>;
export type Draw = typeof draws.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ── Typed DTOs for analysis pipeline ──

export interface NumberFrequency {
  number: number;
  totalFreq: number;
  last10Freq: number;
  last25Freq: number;
  last50Freq: number;
  drawsSinceSeen: number;
  rollingTrend: number;
}

export interface PatternFeatureRow {
  feature: string;
  value: number | string;
  type: "structure" | "recency" | "sequence";
  percentile?: number | null;
  typicality?: "typical" | "uncommon" | "rare" | null;
  normalRange?: string | null;
}

export interface AuditSummary {
  chiSquareStat: number;
  chiSquarePValue: number;
  entropyScore: number;
  maxEntropy: number;
  entropyRatio: number;
  verdict: "pass" | "marginal" | "fail";
  details: string;
  scope: "main" | "powerball" | "combined";
  drawsUsed: number;
  interpretation: string;
}

export interface StructureProfile {
  oddEvenMode: string;
  sumMedian: number;
  sumQ10: number;
  sumQ90: number;
  rangeMedian: number;
  rangeQ10: number;
  rangeQ90: number;
  lowHighMode: string;
  avgCarryover: number;
  avgConsecutive: number;
  drawsAnalyzed: number;
}

export interface StrategyResult {
  strategy: string;
  avgMainMatches: number;
  bestMainMatches: number;
  powerballHitRate: number;
  powerballHits: number;
  testDraws: number;
}

export type ValidationVerdict = "no_edge" | "weak_edge" | "possible_edge" | "insufficient_data";

export interface RollingWindow {
  windowStart: number;
  windowEnd: number;
  compositeAvg: number;
  randomAvg: number;
  delta: number;
}

export interface ValidationSummary {
  verdict: ValidationVerdict;
  verdictExplanation: string;
  byStrategy: StrategyResult[];
  rollingWindows: RollingWindow[];
  diagnostics: {
    totalDrawsUsed: number;
    testSetSize: number;
    trainSetSize: number;
    modernFormatOnly: boolean;
    compositeVsRandomDelta: number;
  };
}

export type StabilityClass = "possible_edge" | "weak_edge" | "no_edge" | "underperforming" | "insufficient_data";

export interface BenchmarkStrategyWindow {
  strategy: string;
  windowSize: number;
  testDraws: number;
  trainDraws: number;
  avgMainMatches: number;
  bestMainMatches: number;
  powerballHitRate: number;
  powerballHits: number;
  deltaVsRandom: number;
  beatsRandom: boolean;
}

export interface BenchmarkStrategyStability {
  strategy: string;
  windowsTested: number;
  windowsBeating: number;
  windowsLosing: number;
  avgDelta: number;
  stabilityClass: StabilityClass;
}

export interface BenchmarkSummary {
  byWindowByStrategy: BenchmarkStrategyWindow[];
  stabilityByStrategy: BenchmarkStrategyStability[];
  windowSizesTested: number[];
  totalDrawsAvailable: number;
  overallVerdict: string;
}

export type GeneratorMode = "balanced" | "anti_popular" | "pattern_only" | "random_baseline" | "most_drawn_all_time" | "most_drawn_last_50" | "most_drawn_last_100" | "most_drawn_last_20" | "least_drawn_last_50" | "structure_matched_random" | "anti_popular_only" | "diversity_optimized";

export interface GeneratorConfig {
  mode: GeneratorMode;
  drawFitWeight: number;
  antiPopWeight: number;
  count: number;
}

export interface AntiPopularityBreakdown {
  birthdayPenalty: number;
  sequencePenalty: number;
  repeatedEndingPenalty: number;
  aestheticPenalty: number;
  lowPowerballPenalty: number;
}

export interface GeneratedPick {
  rank: number;
  numbers: number[];
  powerball: number;
  drawFit: number;
  antiPop: number;
  finalScore: number;
  antiPopBreakdown: AntiPopularityBreakdown;
}

export type RecommendationConfidence = "low" | "medium" | "high";

export interface RecommendationEvidence {
  bestStrategy: string;
  bestStrategyStability: StabilityClass;
  bestAvgDelta: number;
  windowsTested: number[];
  strategiesTested: number;
  lastBenchmarkAt: string;
}

export interface GeneratorRecommendation {
  recommendedMode: GeneratorMode;
  recommendedStrategy: string;
  confidence: RecommendationConfidence;
  reasonSummary: string;
  evidence: RecommendationEvidence | null;
  strategyBadges: Record<string, StabilityClass>;
  hasBenchmark: boolean;
}

export interface ApiResponse<T> {
  ok: boolean;
  meta: {
    drawsUsed: number;
    modernFormatOnly: boolean;
    generatedAt: string;
  };
  data: T;
}
