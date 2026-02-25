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

export const benchmarkRuns = pgTable("benchmark_runs", {
  id: serial("id").primaryKey(),
  config: json("config").$type<BenchmarkRunConfig>().notNull(),
  summary: json("summary").$type<BenchmarkSummary>().notNull(),
  status: text("status").notNull().default("success"),
  createdAt: timestamp("created_at").defaultNow(),
});

export interface BenchmarkRunConfig {
  benchmarkMode: BenchmarkMode;
  windowSizes: number[];
  minTrainDraws: number;
  seed: number;
  randomBaselineRuns: number;
  runPermutation: boolean;
  permutationRuns: number;
  totalDrawsAvailable: number;
}

export const insertBenchmarkRunSchema = createInsertSchema(benchmarkRuns).omit({ id: true, createdAt: true });
export type InsertBenchmarkRun = z.infer<typeof insertBenchmarkRunSchema>;
export type BenchmarkRun = typeof benchmarkRuns.$inferSelect;

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

export type BenchmarkMode = "fixed_holdout" | "rolling_walk_forward";

export interface RandomEnsembleSummary {
  runs: number;
  seed: number;
  mean: number;
  p05: number;
  p95: number;
  stdDev: number;
}

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
  deltaVsRandomMean: number;
  beatsRandom: boolean;
  withinRandomBand: boolean;
  evaluatedDraws: number;
  skippedDraws: number;
}

export interface BenchmarkStrategyStability {
  strategy: string;
  windowsTested: number;
  windowsBeating: number;
  windowsLosing: number;
  avgDelta: number;
  stabilityClass: StabilityClass;
}

export interface BenchmarkPermutationResult {
  strategy: string;
  metric: string;
  observedDelta: number;
  nullMean: number;
  nullStd: number;
  percentile: number;
  empiricalPValue: number;
  cautionText: string;
  shuffleMethod: string;
  scope: string;
  runs: number;
}

export interface BenchmarkSummary {
  byWindowByStrategy: BenchmarkStrategyWindow[];
  stabilityByStrategy: BenchmarkStrategyStability[];
  windowSizesTested: number[];
  totalDrawsAvailable: number;
  overallVerdict: string;
  benchmarkMode: BenchmarkMode;
  seed: number;
  randomEnsemble: RandomEnsembleSummary | null;
  permutationTests: BenchmarkPermutationResult[];
}

export type GeneratorMode = "balanced" | "anti_popular" | "pattern_only" | "random_baseline" | "most_drawn_all_time" | "most_drawn_last_50" | "most_drawn_last_100" | "most_drawn_last_20" | "least_drawn_last_50" | "structure_matched_random" | "anti_popular_only" | "diversity_optimized" | "strategy_portfolio" | "most_drawn_smoothed_last_50" | "most_drawn_smoothed_last_20" | "recency_smoothed";

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
  sourceStrategy?: string;
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

// ── Formula Lab types ──

export interface FormulaFeatureConfig {
  freqTotal: boolean;
  freqL50: boolean;
  freqL20: boolean;
  recencySinceSeen: boolean;
  trendL10: boolean;
  structureFit: boolean;
  carryoverAffinity: boolean;
  antiPopularity: boolean;
}

export interface FormulaWeights {
  freqTotal: number;
  freqL50: number;
  freqL20: number;
  recencySinceSeen: number;
  trendL10: number;
  structureFit: number;
  carryoverAffinity: number;
  antiPopularity: number;
}

export interface FormulaOptimizerConfig {
  features: FormulaFeatureConfig;
  trainingWindowSize: number;
  searchIterations: number;
  regularizationStrength: number;
  objective: "mean_best_score" | "avg_top10_score" | "stability_weighted";
}

export interface FormulaCandidateResult {
  rank: number;
  weights: FormulaWeights;
  inSampleScore: number;
  complexityPenalty: number;
  adjustedScore: number;
  scoreBreakdown: Record<string, number>;
}

export type FormulaOverfitRisk = "overfit_likely" | "inconclusive" | "weak_signal" | "possible_signal";

export interface FormulaReplayWindow {
  windowSize: number;
  testDraws: number;
  trainDraws: number;
  avgMainMatches: number;
  bestMainMatches: number;
  pbHitRate: number;
  deltaVsRandom: number;
  beatsRandom: boolean;
}

export interface FormulaReplayResult {
  windows: FormulaReplayWindow[];
  overallAvgDelta: number;
  windowsBeating: number;
  windowsLosing: number;
  stability: StabilityClass;
}

export interface FormulaPermutationResult {
  observedDelta: number;
  permutationMean: number;
  permutationStd: number;
  empiricalPValue: number;
  percentile: number;
  permutationsRun: number;
  interpretation: string;
}

export interface FormulaLabResult {
  config: FormulaOptimizerConfig;
  topCandidates: FormulaCandidateResult[];
  bestWeights: FormulaWeights;
  retrospectiveFit: {
    inSampleScore: number;
    complexityPenalty: number;
    adjustedScore: number;
    trainDrawsUsed: number;
  };
  walkForwardReplay: FormulaReplayResult | null;
  permutationTest: FormulaPermutationResult | null;
  overfitRisk: FormulaOverfitRisk;
  caveatedVerdict: string;
  caveats: string[];
  benchmarkComparison: {
    strategy: string;
    avgDelta: number;
  }[];
  timestamp: string;
}

// ── Request validation schemas ──

export const benchmarkRequestSchema = z.object({
  windowSizes: z.array(z.number().int().min(5).max(500)).min(1).max(10).default([20, 40, 60, 100]),
  minTrainDraws: z.number().int().min(10).max(1000).default(100),
  benchmarkMode: z.enum(["fixed_holdout", "rolling_walk_forward"]).default("fixed_holdout"),
  seed: z.number().int().min(0).default(42),
  randomBaselineRuns: z.number().int().min(1).max(500).default(200),
  runPermutation: z.boolean().default(false),
  permutationRuns: z.number().int().min(1).max(200).default(200),
});
export type BenchmarkRequest = z.infer<typeof benchmarkRequestSchema>;

const generatorModeEnum = z.enum([
  "balanced", "anti_popular", "pattern_only", "random_baseline",
  "most_drawn_all_time", "most_drawn_last_50", "most_drawn_last_100", "most_drawn_last_20",
  "least_drawn_last_50", "structure_matched_random", "anti_popular_only",
  "diversity_optimized", "strategy_portfolio",
  "most_drawn_smoothed_last_50", "most_drawn_smoothed_last_20", "recency_smoothed",
]);

export const generateRequestSchema = z.object({
  count: z.number().int().min(1).max(100).default(10),
  mode: generatorModeEnum.default("balanced"),
  drawFitWeight: z.number().min(0).max(100).optional(),
  antiPopWeight: z.number().min(0).max(100).optional(),
  allocationMethod: z.enum(["equal", "validation_weighted"]).optional(),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const formulaLabRequestSchema = z.object({
  features: z.object({
    freqTotal: z.boolean().default(true),
    freqL50: z.boolean().default(true),
    freqL20: z.boolean().default(false),
    recencySinceSeen: z.boolean().default(true),
    trendL10: z.boolean().default(true),
    structureFit: z.boolean().default(true),
    carryoverAffinity: z.boolean().default(true),
    antiPopularity: z.boolean().default(false),
  }).default({}),
  trainingWindowSize: z.number().int().min(20).max(2000).optional(),
  searchIterations: z.number().int().min(10).max(500).default(200),
  regularizationStrength: z.number().min(0).max(5).default(0.5),
  objective: z.enum(["mean_best_score", "avg_top10_score", "stability_weighted"]).default("mean_best_score"),
});
export type FormulaLabRequest = z.infer<typeof formulaLabRequestSchema>;

export interface ApiResponse<T> {
  ok: boolean;
  meta: {
    drawsUsed: number;
    modernFormatOnly: boolean;
    generatedAt: string;
  };
  data: T;
}
