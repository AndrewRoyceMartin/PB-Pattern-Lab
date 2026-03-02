import type { Express } from "express";
import { storage, getGameConfig, DEFAULT_GAME_CONFIG } from "../storage";
import { apiResponse } from "./helpers";
import type { BenchmarkRunConfig, BenchmarkStrategyStability, GeneratedPick, FormulaWeights, BenchmarkRun, GameConfig, PredictionDiffResult } from "@shared/schema";
import {
  runBenchmarkValidation,
  storeBenchmarkResult,
  scoreAntiPopularity,
} from "../analysis";
import { getGeneratorHandler } from "../generator-registry";
import { runFormulaOptimizer, generateDiverseFormulaCard } from "../formula-lab";
import { buildDiffResult } from "../diff-engine";
import crypto from "crypto";

async function resolveGameConfig(gameId?: string): Promise<GameConfig> {
  if (!gameId) return DEFAULT_GAME_CONFIG;
  const game = await storage.getGame(gameId);
  return game ? getGameConfig(game) : DEFAULT_GAME_CONFIG;
}

function buildConfidencePanel(strategyName: string, run: BenchmarkRun | null) {
  if (!run) {
    return {
      strategy: strategyName,
      evidenceSource: "none",
      evidenceLabel: "No benchmark evidence available. Run Validation to generate evidence.",
      deltaVsRandom: null,
      percentileVsRandom: null,
      randomBand: null,
      worthIt: null,
      significance: null,
      benchmarkRunId: null,
      benchmarkDate: null,
      benchmarkMode: null,
      permutationRuns: null,
    };
  }

  const summary = run.summary;
  const config = run.config;
  const stab = (summary.stabilityByStrategy || []).find(
    (s: BenchmarkStrategyStability) => s.strategy === strategyName
  );
  const perm = (summary.permutationTests || []).find(
    (p: any) => p.strategy === strategyName
  );

  let significance: string | null = null;
  if (perm) {
    significance = perm.empiricalPValue < 0.05 ? "Supported" : perm.empiricalPValue < 0.2 ? "Suggestive" : "Unsupported";
  }

  return {
    strategy: strategyName,
    evidenceSource: "benchmark",
    evidenceLabel: `Evidence from benchmark #${run.id} (${config.benchmarkMode === "rolling_walk_forward" ? "rolling walk-forward" : "fixed holdout"})`,
    deltaVsRandom: stab?.avgDelta ?? null,
    percentileVsRandom: stab?.percentileVsRandom ?? null,
    randomBand: summary.randomEnsemble ? { p05: summary.randomEnsemble.p05, p95: summary.randomEnsemble.p95, mean: summary.randomEnsemble.mean } : null,
    worthIt: stab?.worthIt ?? null,
    significance,
    benchmarkRunId: run.id,
    benchmarkDate: run.createdAt,
    benchmarkMode: config.benchmarkMode,
    permutationRuns: perm?.runs ?? null,
  };
}

const AUTO_BENCHMARK_CONFIG = {
  benchmarkMode: "rolling_walk_forward" as const,
  windowSizes: [20, 40, 60, 100],
  minTrainDraws: 100,
  seed: 42,
  randomBaselineRuns: 500,
  runPermutation: false,
  permutationRuns: 200,
  regimeSplits: true,
  selectedStrategies: [
    "Composite",
    "Composite No-Frequency",
    "Composite Recency-Heavy",
    "Diversity Optimized",
    "Recency Smoothed",
    "Structure-Matched Random",
    "Random",
  ],
  presetName: "Auto Run (Best 12)",
};

const STRATEGY_TO_GENERATOR: Record<string, { mode: string; drawFit: number; antiPop: number }> = {
  "Composite": { mode: "balanced", drawFit: 60, antiPop: 40 },
  "Composite No-Frequency": { mode: "composite_no_frequency", drawFit: 60, antiPop: 40 },
  "Composite Recency-Heavy": { mode: "balanced", drawFit: 60, antiPop: 40 },
  "Diversity Optimized": { mode: "diversity_optimized", drawFit: 50, antiPop: 50 },
  "Recency Smoothed": { mode: "recency_smoothed", drawFit: 100, antiPop: 0 },
  "Structure-Matched Random": { mode: "structure_matched_random", drawFit: 60, antiPop: 40 },
  "Random": { mode: "random_baseline", drawFit: 0, antiPop: 0 },
};

const OPTIMISER_CONFIG = {
  features: {
    freqTotal: false,
    freqL50: true,
    freqL20: false,
    recencySinceSeen: true,
    trendL10: true,
    structureFit: true,
    carryoverAffinity: true,
    antiPopularity: false,
  },
  searchIterations: 200,
  regularizationStrength: 0.5,
  objective: "mean_best_score" as const,
};

function hashWeights(weights: FormulaWeights): string {
  const str = JSON.stringify(weights, Object.keys(weights).sort());
  return crypto.createHash("md5").update(str).digest("hex").slice(0, 8);
}

function selectWinnerStrategy(stabilities: BenchmarkStrategyStability[]): {
  strategy: string;
  reason: string;
  avgDelta: number;
  windowsBeating: number;
  isFallback: boolean;
} {
  const nonRandom = stabilities.filter(s => s.strategy !== "Random");
  const sorted = [...nonRandom].sort((a, b) => {
    if (b.avgDelta !== a.avgDelta) return b.avgDelta - a.avgDelta;
    if (b.windowsBeating !== a.windowsBeating) return b.windowsBeating - a.windowsBeating;
    return 0;
  });

  const best = sorted[0];
  if (!best || best.avgDelta <= 0) {
    return {
      strategy: "Strategy Portfolio",
      reason: "No strategies showed a positive edge vs random. Falling back to a diversified portfolio approach for maximum coverage.",
      avgDelta: 0,
      windowsBeating: 0,
      isFallback: true,
    };
  }

  return {
    strategy: best.strategy,
    reason: `Selected ${best.strategy} because it had the highest average delta vs random (+${best.avgDelta.toFixed(3)}) across ${best.windowsBeating}/${best.windowsTested} rolling windows.`,
    avgDelta: best.avgDelta,
    windowsBeating: best.windowsBeating,
    isFallback: false,
  };
}

function buildRunStamp(opts: {
  strategyName: string;
  benchmarkRunId: number | null;
  optimiserUsed: boolean;
  optimiserRunId: string | null;
  formulaHash: string | null;
  seed: number;
}) {
  return {
    ...opts,
    generatedAt: new Date().toISOString(),
  };
}

async function savePredictionAndDiff(
  picks: GeneratedPick[],
  gameId: string,
  lane: string,
  strategyName: string,
  seed: number,
  benchmarkRunId: number | null,
  optimiserRunId: string | null,
  formulaHash: string | null,
  mainCount: number,
): Promise<{ predictionSetId: number; diff: PredictionDiffResult | null }> {
  const previousSet = await storage.getLatestPredictionSet(gameId, lane);

  const saved = await storage.savePredictionSet({
    gameId,
    lane,
    strategyName,
    seed,
    benchmarkRunId: benchmarkRunId ?? undefined,
    optimiserRunId,
    formulaHash,
    linesJson: picks,
    notes: null,
  });

  let diff: PredictionDiffResult | null = null;
  if (previousSet) {
    diff = buildDiffResult(previousSet, picks, mainCount);
  }

  return { predictionSetId: saved.id, diff };
}

const CNF_FEATURES = {
  freqTotal: false, freqL50: false, freqL20: false,
  recencySinceSeen: true, trendL10: true, structureFit: true, carryoverAffinity: true, antiPopularity: false,
};
const CNF_WEIGHTS = {
  freqTotal: 0, freqL50: 0, freqL20: 0,
  recencySinceSeen: -0.5, trendL10: 2, structureFit: 1, carryoverAffinity: 0.5, antiPopularity: 0,
};

function mulberry32(s: number) {
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type PbMode = "default" | "unique_spread" | "guaranteed";

function applyPbMode(picks: GeneratedPick[], pbMode: PbMode, specialPool: number, rng: () => number): GeneratedPick[] {
  if (pbMode === "default" || picks.length === 0) return picks;

  if (pbMode === "unique_spread") {
    const usedPbs = new Set<number>();
    return picks.map((p, i) => {
      if (usedPbs.has(p.powerball) && usedPbs.size < specialPool) {
        let newPb = p.powerball;
        for (let tries = 0; tries < 100; tries++) {
          newPb = Math.floor(rng() * specialPool) + 1;
          if (!usedPbs.has(newPb)) break;
        }
        usedPbs.add(newPb);
        return { ...p, powerball: newPb };
      }
      usedPbs.add(p.powerball);
      return p;
    });
  }

  if (pbMode === "guaranteed") {
    const targetCount = Math.min(specialPool, picks.length);
    const pbSequence: number[] = [];
    for (let i = 1; i <= specialPool; i++) pbSequence.push(i);
    for (let i = pbSequence.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pbSequence[i], pbSequence[j]] = [pbSequence[j], pbSequence[i]];
    }
    return picks.map((p, i) => {
      if (i < targetCount) {
        return { ...p, powerball: pbSequence[i] };
      }
      return p;
    });
  }

  return picks;
}

function generateCNFPicks(draws: any[], seed: number, pbMode: PbMode = "default", specialPool: number = 20, gc: GameConfig = DEFAULT_GAME_CONFIG): GeneratedPick[] {
  const rng = mulberry32(seed);
  const picks: GeneratedPick[] = [];
  const usedSets = new Set<string>();
  const noiseSchedule = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5];

  for (let attempt = 0; attempt < 200 && picks.length < 12; attempt++) {
    const noiseLevel = noiseSchedule[picks.length] ?? (0.3 + attempt * 0.05);
    const { picks: mainNums, pb, formulaScore } = generateDiverseFormulaCard(draws, CNF_WEIGHTS, CNF_FEATURES, rng, noiseLevel, gc);
    const key = mainNums.join(",") + "|" + pb;
    if (usedSets.has(key)) continue;
    usedSets.add(key);

    const antiPopResult = scoreAntiPopularity(mainNums, pb);
    const drawFit = Math.round(Math.max(0, Math.min(100, formulaScore * 10)));

    picks.push({
      rank: picks.length + 1, numbers: mainNums, powerball: pb,
      drawFit, antiPop: antiPopResult.score,
      finalScore: Math.round(drawFit * 0.6 + antiPopResult.score * 0.4),
      antiPopBreakdown: antiPopResult.breakdown,
    });
  }
  picks.forEach((p, i) => { p.rank = i + 1; });

  const finalPicks = applyPbMode(picks, pbMode, specialPool, rng);
  return finalPicks;
}

export function registerAutoRoutes(app: Express): void {
  app.post("/api/auto/generate", async (req, res) => {
    try {
      const gameId = (req.body?.gameId as string) || undefined;
      const gc = await resolveGameConfig(gameId);
      const draws = await storage.getModernDraws(gameId);
      const minRequired = AUTO_BENCHMARK_CONFIG.minTrainDraws + Math.max(...AUTO_BENCHMARK_CONFIG.windowSizes);
      if (draws.length < minRequired) {
        return res.status(400).json({ ok: false, message: `Only ${draws.length} modern draws available. Need at least ${minRequired} (${AUTO_BENCHMARK_CONFIG.minTrainDraws} training + ${Math.max(...AUTO_BENCHMARK_CONFIG.windowSizes)} test window) for auto-generate.` });
      }

      const pbMode = (req.body?.pbMode as PbMode) || "default";
      console.log(`[auto] Running benchmark with fixed config (pbMode=${pbMode})...`);
      const { benchmarkMode, windowSizes, minTrainDraws, seed, randomBaselineRuns, runPermutation, permutationRuns, selectedStrategies, presetName, regimeSplits } = AUTO_BENCHMARK_CONFIG;

      const benchmarkResults = runBenchmarkValidation(
        draws, windowSizes, minTrainDraws, benchmarkMode, seed, randomBaselineRuns,
        runPermutation, permutationRuns, selectedStrategies, presetName, undefined, regimeSplits, gc,
      );
      storeBenchmarkResult(benchmarkResults, gameId);

      const runConfigUsed: BenchmarkRunConfig = {
        benchmarkMode, windowSizes, minTrainDraws, seed, randomBaselineRuns,
        runPermutation, permutationRuns, totalDrawsAvailable: draws.length,
        selectedStrategies, presetName, regimeSplits,
      };
      const run = await storage.saveBenchmarkRun(runConfigUsed, benchmarkResults, gameId);

      const winner = selectWinnerStrategy(benchmarkResults.stabilityByStrategy);
      console.log(`[auto] Winner: ${winner.strategy} (delta: ${winner.avgDelta}, fallback: ${winner.isFallback})`);

      let picks: GeneratedPick[];
      const autoRng = mulberry32(seed + 1);
      if (winner.isFallback) {
        const handler = getGeneratorHandler("strategy_portfolio");
        picks = handler({ draws, count: 12, allocationMethod: "validation_weighted", gc });
        if (pbMode !== "default") {
          picks = applyPbMode(picks, pbMode, gc.specialPool, autoRng);
        }
      } else {
        const generatorConfig = STRATEGY_TO_GENERATOR[winner.strategy];
        if (generatorConfig && generatorConfig.mode === "composite_no_frequency") {
          picks = generateCNFPicks(draws, seed, pbMode, gc.specialPool, gc);
        } else if (generatorConfig) {
          const handler = getGeneratorHandler(generatorConfig.mode as any);
          picks = handler({
            draws, count: 12,
            drawFitWeight: generatorConfig.drawFit,
            antiPopWeight: generatorConfig.antiPop,
            gc,
          });
          if (pbMode !== "default") {
            picks = applyPbMode(picks, pbMode, gc.specialPool, autoRng);
          }
        } else {
          console.warn(`[auto] Winner strategy "${winner.strategy}" has no generator mapping, using balanced fallback`);
          const handler = getGeneratorHandler("balanced");
          picks = handler({ draws, count: 12, drawFitWeight: 60, antiPopWeight: 40, gc });
          if (pbMode !== "default") {
            picks = applyPbMode(picks, pbMode, gc.specialPool, autoRng);
          }
        }
      }

      const scoreSummary = benchmarkResults.stabilityByStrategy
        .filter(s => s.strategy !== "Random")
        .sort((a, b) => b.avgDelta - a.avgDelta)
        .slice(0, 5)
        .map(s => ({
          strategy: s.strategy,
          avgDelta: s.avgDelta,
          windowsBeating: s.windowsBeating,
          windowsTested: s.windowsTested,
          stabilityClass: s.stabilityClass,
        }));

      const runStamp = buildRunStamp({
        strategyName: winner.strategy,
        benchmarkRunId: run.id,
        optimiserUsed: false,
        optimiserRunId: null,
        formulaHash: null,
        seed,
      });

      const effectiveGameId = gameId || "AU_POWERBALL";
      const { predictionSetId, diff } = await savePredictionAndDiff(
        picks, effectiveGameId, "auto", winner.strategy, seed, run.id, null, null, gc.mainCount
      );

      res.json(apiResponse(draws, {
        benchmarkRunId: run.id,
        benchmarkRunTimestamp: run.createdAt,
        runConfigUsed,
        runStamp,
        predictionSetId,
        diff,
        winner: {
          strategy: winner.strategy,
          reason: winner.reason,
          avgDelta: winner.avgDelta,
          windowsBeating: winner.windowsBeating,
          isFallback: winner.isFallback,
        },
        scoreSummary,
        picks,
        disclaimer: "These picks are generated using historical validation metrics. They are not guaranteed to outperform chance in future draws.",
      }));
    } catch (error: any) {
      console.error("[auto] Error:", error.message);
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.post("/api/auto/generate-composite-no-frequency", async (req, res) => {
    try {
      const gameId = (req.body?.gameId as string) || undefined;
      const gc = await resolveGameConfig(gameId);
      const draws = await storage.getModernDraws(gameId);
      if (draws.length < 10) {
        return res.status(400).json({ ok: false, message: `Only ${draws.length} modern draws available. Need at least 10 for generation. Sync more draws from Data Ingest.` });
      }

      const pbMode = (req.body?.pbMode as PbMode) || "default";
      console.log(`[auto] Generating 12 lines using Composite No-Frequency (pbMode=${pbMode})...`);
      const seed = 42;
      const picks = generateCNFPicks(draws, seed, pbMode, gc.specialPool, gc);

      const latestRun = await storage.getLatestBenchmarkRun(gameId);

      const formulaHash = hashWeights(CNF_WEIGHTS);
      const runStamp = buildRunStamp({
        strategyName: "Composite No-Frequency",
        benchmarkRunId: latestRun?.id ?? null,
        optimiserUsed: false,
        optimiserRunId: null,
        formulaHash,
        seed,
      });

      const confidence = buildConfidencePanel("Composite No-Frequency", latestRun);

      const effectiveGameId = gameId || "AU_POWERBALL";
      const { predictionSetId, diff } = await savePredictionAndDiff(
        picks, effectiveGameId, "cnf", "Composite No-Frequency", seed,
        latestRun?.id ?? null, null, formulaHash, gc.mainCount
      );

      res.json(apiResponse(draws, {
        runStamp,
        picks,
        confidence,
        predictionSetId,
        diff,
        strategyDescription: "Composite scoring using recency + trend + structure + carryover. Frequency signals (freqTotal, freqL50, freqL20) are explicitly disabled — set to zero weight.",
        disclaimer: "These picks are generated using historical validation metrics. They are not guaranteed to outperform chance in future draws.",
      }));
    } catch (error: any) {
      console.error("[auto] CNF Error:", error.message);
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.post("/api/auto/optimise-and-generate", async (req, res) => {
    try {
      const gameId = (req.body?.gameId as string) || undefined;
      const gc = await resolveGameConfig(gameId);
      const draws = await storage.getModernDraws(gameId);
      if (draws.length < 10) {
        return res.status(400).json({ ok: false, message: `Only ${draws.length} modern draws available. Need at least 10 for optimise-and-generate. Sync more draws from Data Ingest.` });
      }

      const pbMode = (req.body?.pbMode as PbMode) || "default";
      console.log(`[auto] Step 1: Running optimiser (pbMode=${pbMode})...`);
      const config = {
        ...OPTIMISER_CONFIG,
        trainingWindowSize: Math.min(200, Math.floor(draws.length * 0.7)),
      };
      const optimiserResult = runFormulaOptimizer(draws, config);
      const bestWeights = optimiserResult.bestWeights;
      const formulaHash = hashWeights(bestWeights);
      const optimiserRunId = `opt-${Date.now()}`;
      const seed = Date.now() % 100000;

      console.log(`[auto] Step 2: Generating 12 lines with optimised weights (hash: ${formulaHash})...`);
      const rng = mulberry32(seed);

      const picks: GeneratedPick[] = [];
      const usedSets = new Set<string>();

      const optNoiseSchedule = [0, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5];
      for (let attempt = 0; attempt < 200 && picks.length < 12; attempt++) {
        const noiseLevel = optNoiseSchedule[picks.length] ?? (0.3 + attempt * 0.05);

        const { picks: mainNums, pb, formulaScore } = generateDiverseFormulaCard(draws, bestWeights, OPTIMISER_CONFIG.features, rng, noiseLevel);
        const key = mainNums.join(",") + "|" + pb;
        if (usedSets.has(key)) continue;
        usedSets.add(key);

        const antiPopResult = scoreAntiPopularity(mainNums, pb);
        const drawFit = Math.round(Math.max(0, Math.min(100, formulaScore * 10)));

        picks.push({
          rank: picks.length + 1,
          numbers: mainNums,
          powerball: pb,
          drawFit,
          antiPop: antiPopResult.score,
          finalScore: Math.round(drawFit * 0.6 + antiPopResult.score * 0.4),
          antiPopBreakdown: antiPopResult.breakdown,
        });
      }

      picks.forEach((p, i) => { p.rank = i + 1; });
      const finalPicks = applyPbMode(picks, pbMode, gc.specialPool, rng);
      finalPicks.forEach((p, i) => { p.rank = i + 1; });

      const runStamp = buildRunStamp({
        strategyName: "Optimised Formula",
        benchmarkRunId: null,
        optimiserUsed: true,
        optimiserRunId,
        formulaHash,
        seed,
      });

      const replay = optimiserResult.walkForwardReplay;
      const confidence = {
        strategy: "Optimised Formula",
        evidenceSource: "local_replay",
        evidenceLabel: "Optimised evidence is local (replay-based) unless validated by benchmark.",
        deltaVsRandom: replay?.avgDelta ?? null,
        percentileVsRandom: null as number | null,
        randomBand: null as { p05: number; p95: number; mean: number } | null,
        worthIt: (replay?.avgDelta ?? 0) > 0 ? "promising" as const : "no_edge" as const,
        significance: null as string | null,
        benchmarkRunId: null as number | null,
        benchmarkDate: null as string | null,
        benchmarkMode: null as string | null,
        permutationRuns: null as number | null,
        overfitRisk: optimiserResult.overfitRisk,
        caveatedVerdict: optimiserResult.caveatedVerdict,
      };

      const effectiveGameId = gameId || "AU_POWERBALL";
      const { predictionSetId, diff } = await savePredictionAndDiff(
        finalPicks, effectiveGameId, "optimised", "Optimised Formula", seed,
        null, optimiserRunId, formulaHash, gc.mainCount
      );

      res.json(apiResponse(draws, {
        runStamp,
        picks: finalPicks,
        confidence,
        predictionSetId,
        diff,
        optimiserMeta: {
          weightsUsed: bestWeights,
          formulaHash,
          optimiserRunId,
          overfitRisk: optimiserResult.overfitRisk,
          caveatedVerdict: optimiserResult.caveatedVerdict,
          walkForwardReplay: optimiserResult.walkForwardReplay,
          searchIterations: config.searchIterations,
          trainingWindowSize: config.trainingWindowSize,
        },
        disclaimer: "These picks are generated using an auto-optimised formula. The optimiser ran fresh for this request — no stale weights. They are not guaranteed to outperform chance in future draws.",
      }));
    } catch (error: any) {
      console.error("[auto] Optimise Error:", error.message);
      res.status(500).json({ ok: false, message: error.message });
    }
  });

  app.get("/api/dev/determinism-check", async (req, res) => {
    try {
      const gameId = (req.query.gameId as string) || "AU_POWERBALL";
      const lane = (req.query.lane as string) || "cnf";
      const seed = parseInt(req.query.seed as string) || 42;

      const gc = await resolveGameConfig(gameId);
      const draws = await storage.getModernDraws(gameId);
      if (draws.length < 50) {
        return res.status(400).json({ ok: false, message: "Need at least 50 draws" });
      }

      const picksA = generateCNFPicks(draws, seed, "default", gc.specialPool, gc);
      const picksB = generateCNFPicks(draws, seed, "default", gc.specialPool, gc);

      const identical = picksA.length === picksB.length &&
        picksA.every((p, i) =>
          p.numbers.join(",") === picksB[i].numbers.join(",") &&
          p.powerball === picksB[i].powerball
        );

      res.json({
        ok: true,
        data: {
          seed,
          lane,
          gameId,
          identical,
          linesA: picksA.map(p => ({ numbers: p.numbers, pb: p.powerball })),
          linesB: picksB.map(p => ({ numbers: p.numbers, pb: p.powerball })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, message: error.message });
    }
  });
}
