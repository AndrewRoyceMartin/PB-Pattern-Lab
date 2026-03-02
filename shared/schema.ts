import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const games = pgTable("games", {
  gameId: text("game_id").primaryKey(),
  displayName: text("display_name").notNull(),
  mainCount: integer("main_count").notNull(),
  mainPool: integer("main_pool").notNull(),
  specialName: text("special_name").notNull(),
  specialCount: integer("special_count").notNull(),
  specialPool: integer("special_pool").notNull(),
  hasSupplementary: boolean("has_supplementary").notNull().default(false),
  supplementaryCount: integer("supplementary_count").default(0),
  supplementaryPool: integer("supplementary_pool").default(0),
  productFilter: text("product_filter").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const insertGameSchema = createInsertSchema(games);
export type InsertGame = z.infer<typeof insertGameSchema>;
export type Game = typeof games.$inferSelect;

export interface GameConfig {
  gameId: string;
  displayName: string;
  mainCount: number;
  mainPool: number;
  specialName: string;
  specialCount: number;
  specialPool: number;
  hasSupplementary: boolean;
  supplementaryCount: number;
  supplementaryPool: number;
  productFilter: string;
}

export const draws = pgTable("draws", {
  id: serial("id").primaryKey(),
  drawNumber: integer("draw_number").notNull(),
  drawDate: text("draw_date").notNull(),
  numbers: json("numbers").$type<number[]>().notNull(),
  powerball: integer("powerball").notNull(),
  supplementary: json("supplementary").$type<number[]>(),
  gameId: text("game_id").notNull().default("AU_POWERBALL"),
  isModernFormat: boolean("is_modern_format").notNull().default(true),
  source: text("source"),
  sourceCompanyId: text("source_company_id"),
  sourceFetchedAt: timestamp("source_fetched_at"),
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
  gameId: text("game_id").notNull().default("AU_POWERBALL"),
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
  selectedStrategies?: string[];
  presetName?: string;
  permutationStrategies?: string[];
  regimeSplits?: boolean;
  gameId?: string;
}

export const insertBenchmarkRunSchema = createInsertSchema(benchmarkRuns).omit({ id: true, createdAt: true });
export type InsertBenchmarkRun = z.infer<typeof insertBenchmarkRunSchema>;
export type BenchmarkRun = typeof benchmarkRuns.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const predictionSets = pgTable("prediction_sets", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull(),
  lane: text("lane").notNull(),
  strategyName: text("strategy_name").notNull(),
  benchmarkRunId: integer("benchmark_run_id"),
  optimiserRunId: text("optimiser_run_id"),
  formulaHash: text("formula_hash"),
  seed: integer("seed").notNull(),
  linesJson: json("lines_json").$type<GeneratedPick[]>().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPredictionSetSchema = createInsertSchema(predictionSets).omit({ id: true, createdAt: true });
export type InsertPredictionSet = z.infer<typeof insertPredictionSetSchema>;
export type PredictionSet = typeof predictionSets.$inferSelect;

export const predictionEvaluations = pgTable("prediction_evaluations", {
  id: serial("id").primaryKey(),
  predictionSetId: integer("prediction_set_id").notNull(),
  drawNumber: integer("draw_number").notNull(),
  gameId: text("game_id").notNull(),
  lineResults: json("line_results").$type<LineEvaluationResult[]>().notNull(),
  bestMainHits: integer("best_main_hits").notNull(),
  bestPbHit: boolean("best_pb_hit").notNull(),
  totalMainHits: integer("total_main_hits").notNull(),
  totalPbHits: integer("total_pb_hits").notNull(),
  linesEvaluated: integer("lines_evaluated").notNull(),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
});

export const insertPredictionEvaluationSchema = createInsertSchema(predictionEvaluations).omit({ id: true, evaluatedAt: true });
export type InsertPredictionEvaluation = z.infer<typeof insertPredictionEvaluationSchema>;
export type PredictionEvaluation = typeof predictionEvaluations.$inferSelect;

export interface LineEvaluationResult {
  lineIndex: number;
  mainHits: number;
  mainMatches: number[];
  pbHit: boolean;
  prize: string | null;
}

export interface PredictionDiffSummary {
  mainsPercentChanged: number;
  pbPercentChanged: number;
  mainsOverlapRatio: number;
  pbOverlapRatio: number;
  newMains: number[];
  removedMains: number[];
  newPBs: number[];
  removedPBs: number[];
}

export interface LineDiffMapping {
  currentIndex: number;
  previousIndex: number;
  mainOverlap: number;
  pbMatch: boolean;
  keptMains: number[];
  addedMains: number[];
  removedMains: number[];
  pbChanged: boolean;
  linePercentChanged: number;
}

export interface PredictionDiffResult {
  summary: PredictionDiffSummary;
  lineMapping: LineDiffMapping[];
  previousSetId: number;
  previousGeneratedAt: string;
}

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

export type WorthItClass = "worth_trying" | "promising" | "no_edge" | "underperforming";

export interface BenchmarkStrategyStability {
  strategy: string;
  windowsTested: number;
  windowsBeating: number;
  windowsLosing: number;
  avgDelta: number;
  stabilityClass: StabilityClass;
  percentileVsRandom?: number;
  aboveP95?: boolean;
  worthIt?: WorthItClass;
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

export interface RegimeSplitResult {
  regime: string;
  drawCount: number;
  dateRange: string;
  stabilityByStrategy: BenchmarkStrategyStability[];
  byWindowByStrategy: BenchmarkStrategyWindow[];
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
  presetName?: string;
  selectedStrategies?: string[];
  regimeSplits?: RegimeSplitResult[];
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

export interface RegimeRecommendation {
  regime: string;
  bestStrategy: string;
  bestAvgDelta: number;
  bestStabilityClass: StabilityClass;
  recommendedMode: GeneratorMode;
}

export interface GeneratorRecommendation {
  recommendedMode: GeneratorMode;
  recommendedStrategy: string;
  confidence: RecommendationConfidence;
  reasonSummary: string;
  evidence: RecommendationEvidence | null;
  strategyBadges: Record<string, StabilityClass>;
  hasBenchmark: boolean;
  regimeAware?: boolean;
  regimeRecommendations?: RegimeRecommendation[];
  regimeBasis?: "full_history" | "recent_regime" | "consensus";
  regimeCaveat?: string;
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
  permutationRuns: z.number().int().min(1).max(1000).default(200),
  selectedStrategies: z.array(z.string()).optional(),
  presetName: z.string().optional(),
  permutationStrategies: z.array(z.string()).optional(),
  regimeSplits: z.boolean().default(false),
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
