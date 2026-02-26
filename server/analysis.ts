import {
  type Draw,
  type NumberFrequency,
  type PatternFeatureRow,
  type AuditSummary,
  type StrategyResult,
  type ValidationSummary,
  type ValidationVerdict,
  type RollingWindow,
  type GeneratedPick,
  type AntiPopularityBreakdown,
  type BenchmarkSummary,
  type BenchmarkStrategyWindow,
  type BenchmarkStrategyStability,
  type BenchmarkPermutationResult,
  type StabilityClass,
  type BenchmarkMode,
  type RandomEnsembleSummary,
  type RegimeSplitResult,
  type GeneratorMode,
  type GeneratorRecommendation,
  type RecommendationEvidence,
  type RecommendationConfidence,
  type RegimeRecommendation,
} from "@shared/schema";

let latestBenchmarkResult: BenchmarkSummary | null = null;
let latestBenchmarkTime: string | null = null;

export function storeBenchmarkResult(result: BenchmarkSummary): void {
  latestBenchmarkResult = result;
  latestBenchmarkTime = new Date().toISOString();
}

export function loadBenchmarkFromDb(summary: BenchmarkSummary, createdAt: Date | null): void {
  latestBenchmarkResult = summary;
  latestBenchmarkTime = createdAt?.toISOString() ?? new Date().toISOString();
}

export function getLatestBenchmarkTime(): string | null {
  return latestBenchmarkTime;
}

const STRATEGY_TO_MODE: Record<string, GeneratorMode> = {
  "Composite": "balanced",
  "Composite Model": "balanced",
  "Structure-Aware": "balanced",
  "Structure-Aware Random": "balanced",
  "Recency Only": "balanced",
  "Frequency Only": "balanced",
  "Most Drawn (All-Time)": "most_drawn_all_time",
  "Most Drawn (Last 50)": "most_drawn_last_50",
  "Most Drawn (Last 100)": "most_drawn_last_100",
  "Most Drawn (Last 20)": "most_drawn_last_20",
  "Least Drawn (Last 50)": "least_drawn_last_50",
  "Structure-Matched Random": "structure_matched_random",
  "Anti-Popular Only": "anti_popular_only",
  "Diversity Optimized": "diversity_optimized",
  "Random": "random_baseline",
  "Smoothed Most Drawn (L50)": "most_drawn_smoothed_last_50",
  "Smoothed Most Drawn (L20)": "most_drawn_smoothed_last_20",
  "Recency Smoothed": "recency_smoothed",
  "Composite No-Frequency": "balanced",
  "Composite Recency-Heavy": "balanced",
  "Composite No-Recency": "balanced",
  "Composite No-Structure": "balanced",
  "Composite No-AntiPop": "balanced",
  "Composite Structure-Heavy": "balanced",
  "Recency Gap Balanced": "balanced",
  "Recency Decay Weighted": "balanced",
  "Recency Short Window": "balanced",
};

const MODE_TO_LABEL: Record<GeneratorMode, string> = {
  "balanced": "Balanced",
  "anti_popular": "Low Split-Risk",
  "anti_popular_only": "Anti-Popular Only",
  "pattern_only": "Experimental Pattern",
  "random_baseline": "Random Baseline",
  "most_drawn_all_time": "Most Drawn (All-Time)",
  "most_drawn_last_50": "Most Drawn (Last 50)",
  "most_drawn_last_100": "Most Drawn (Last 100)",
  "most_drawn_last_20": "Most Drawn (Last 20)",
  "least_drawn_last_50": "Least Drawn (Last 50)",
  "structure_matched_random": "Structure-Matched Random",
  "diversity_optimized": "Diversity Optimized",
  "strategy_portfolio": "Strategy Portfolio",
  "most_drawn_smoothed_last_50": "Smoothed Most Drawn (L50)",
  "most_drawn_smoothed_last_20": "Smoothed Most Drawn (L20)",
  "recency_smoothed": "Recency Smoothed",
};

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fisherYatesShuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function seededRandomCard(rng: () => number): number[] {
  const pool = Array.from({ length: 35 }, (_, i) => i + 1);
  const picked: number[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = Math.floor(rng() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

function buildSmoothedPick(draws: Draw[], windowSize: number, alpha: number = 0.3): { picks: number[]; pb: number } {
  const window = draws.slice(0, Math.min(windowSize, draws.length));
  if (window.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };

  const uniform = 1 / 35;
  const mainScores: { number: number; smoothed: number; lastSeen: number }[] = [];

  for (let n = 1; n <= 35; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if ((window[i].numbers as number[]).includes(n)) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    const observed = count / window.length;
    const smoothed = alpha * uniform + (1 - alpha) * observed;
    mainScores.push({ number: n, smoothed, lastSeen });
  }

  mainScores.sort((a, b) => b.smoothed - a.smoothed || a.lastSeen - b.lastSeen || a.number - b.number);
  const picks = mainScores.slice(0, 7).map(m => m.number).sort((a, b) => a - b);

  const pbUniform = 1 / 20;
  const pbScores: { number: number; smoothed: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 20; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if (window[i].powerball === n) { count++; if (i < lastSeen) lastSeen = i; }
    }
    const observed = count / window.length;
    const smoothed = alpha * pbUniform + (1 - alpha) * observed;
    pbScores.push({ number: n, smoothed, lastSeen });
  }
  pbScores.sort((a, b) => b.smoothed - a.smoothed || a.lastSeen - b.lastSeen || a.number - b.number);

  return { picks, pb: pbScores[0]?.number ?? 1 };
}

function buildRecencySmoothedPick(draws: Draw[], alpha: number = 0.3): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };

  const uniform = 1 / 35;
  const mainScores: { number: number; score: number }[] = [];

  for (let n = 1; n <= 35; n++) {
    let drawsSinceSeen = draws.length;
    for (let i = 0; i < draws.length; i++) {
      if ((draws[i].numbers as number[]).includes(n)) { drawsSinceSeen = i; break; }
    }
    const recencyScore = 1 - (drawsSinceSeen / draws.length);
    const smoothed = alpha * uniform + (1 - alpha) * recencyScore;
    mainScores.push({ number: n, score: smoothed });
  }

  mainScores.sort((a, b) => b.score - a.score || a.number - b.number);
  const picks = mainScores.slice(0, 7).map(m => m.number).sort((a, b) => a - b);

  return { picks, pb: draws[0]?.powerball || 1 };
}

function buildRecencyGapBalancedPick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const mainScores: { number: number; score: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let drawsSinceSeen = draws.length;
    for (let i = 0; i < draws.length; i++) {
      if ((draws[i].numbers as number[]).includes(n)) { drawsSinceSeen = i; break; }
    }
    const gapPct = drawsSinceSeen / Math.max(draws.length, 1);
    const score = 1 - Math.abs(gapPct - 0.55) * 2;
    mainScores.push({ number: n, score });
  }
  mainScores.sort((a, b) => b.score - a.score || a.number - b.number);
  return { picks: mainScores.slice(0, 7).map(m => m.number).sort((a, b) => a - b), pb: draws[0]?.powerball || 1 };
}

function buildRecencyDecayWeightedPick(draws: Draw[], decayRate: number = 0.05): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const mainScores: { number: number; score: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let score = 0;
    for (let i = 0; i < draws.length; i++) {
      if ((draws[i].numbers as number[]).includes(n)) {
        score += Math.exp(-decayRate * i);
      }
    }
    mainScores.push({ number: n, score });
  }
  mainScores.sort((a, b) => b.score - a.score || a.number - b.number);
  const picks = mainScores.slice(0, 7).map(m => m.number).sort((a, b) => a - b);
  const pbScores: { number: number; score: number }[] = [];
  for (let n = 1; n <= 20; n++) {
    let score = 0;
    for (let i = 0; i < draws.length; i++) {
      if (draws[i].powerball === n) score += Math.exp(-decayRate * i);
    }
    pbScores.push({ number: n, score });
  }
  pbScores.sort((a, b) => b.score - a.score);
  return { picks, pb: pbScores[0]?.number ?? 1 };
}

function buildRecencyShortWindowPick(draws: Draw[], windowSize: number = 15): { picks: number[]; pb: number } {
  const window = draws.slice(0, Math.min(windowSize, draws.length));
  if (window.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const mainScores: { number: number; score: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let drawsSinceSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if ((window[i].numbers as number[]).includes(n)) { drawsSinceSeen = i; break; }
    }
    const recencyScore = 1 - (drawsSinceSeen / window.length);
    mainScores.push({ number: n, score: recencyScore });
  }
  mainScores.sort((a, b) => b.score - a.score || a.number - b.number);
  return { picks: mainScores.slice(0, 7).map(m => m.number).sort((a, b) => a - b), pb: window[0]?.powerball || 1 };
}

function buildCompositeNoFrequencyPick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: -f.drawsSinceSeen * 1.5 + f.rollingTrend * 3,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: draws[0]?.powerball || 1 };
}

function buildCompositeRecencyHeavyPick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: -f.drawsSinceSeen * 3 + f.rollingTrend * 2 + f.last10Freq * 1,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(draws.slice(0, 20))) };
}

function buildCompositeNoRecencyPick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: f.last25Freq * 2 + f.last10Freq * 3 + f.rollingTrend * 2,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(draws.slice(0, 25))) };
}

function buildCompositeNoStructurePick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(draws.slice(0, 25))) };
}

function buildCompositeNoAntiPopPick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
  }));
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(draws.slice(0, 25))) };
}

function buildCompositeStructureHeavyPick(draws: Draw[]): { picks: number[]; pb: number } {
  if (draws.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };
  const freqs = computeNumberFrequencies(draws);
  const profile = computeStructureProfile(draws);
  const scored = freqs.map(f => {
    const baseScore = f.last25Freq * 1 + f.last10Freq * 1 - f.drawsSinceSeen * 0.3 + f.rollingTrend * 1;
    return { number: f.number, score: baseScore };
  });
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const candidates = sorted.slice(0, 14).map(f => f.number);
  const bestCombo = pickStructureMatchedFromCandidates(candidates, profile);
  return { picks: bestCombo, pb: topPb(getPbFreqs(draws.slice(0, 25))) };
}

function pickStructureMatchedFromCandidates(candidates: number[], profile: any): number[] {
  if (candidates.length < 7) return candidates.slice(0, 7).sort((a, b) => a - b);
  let bestPick = candidates.slice(0, 7);
  let bestFit = -Infinity;
  for (let attempt = 0; attempt < 200; attempt++) {
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pick = shuffled.slice(0, 7).sort((a, b) => a - b);
    const oddCount = pick.filter(n => n % 2 === 1).length;
    const sum = pick.reduce((a, b) => a + b, 0);
    const range = pick[6] - pick[0];
    const targetOdd = profile?.oddEvenSplit?.mostCommonOddCount ?? 4;
    const targetSum = profile?.sumStats?.mean ?? 126;
    const targetRange = profile?.spreadStats?.mean ?? 28;
    const fit = -(Math.abs(oddCount - targetOdd) * 2 + Math.abs(sum - targetSum) * 0.05 + Math.abs(range - targetRange) * 0.3);
    if (fit > bestFit) { bestFit = fit; bestPick = pick; }
  }
  return bestPick;
}

export function getGeneratorRecommendation(): GeneratorRecommendation {
  if (!latestBenchmarkResult || latestBenchmarkResult.stabilityByStrategy.length === 0) {
    return {
      recommendedMode: "balanced",
      recommendedStrategy: "Balanced",
      confidence: "low",
      reasonSummary: "No benchmark validation has been run yet. Run a benchmark on the Validation page to get evidence-based recommendations.",
      evidence: null,
      strategyBadges: {},
      hasBenchmark: false,
    };
  }

  const benchmark = latestBenchmarkResult;
  const stabilities = benchmark.stabilityByStrategy;

  const badges: Record<string, StabilityClass> = {};
  for (const s of stabilities) {
    badges[s.strategy] = s.stabilityClass;
  }

  const possibleEdge = stabilities.filter(s => s.stabilityClass === "possible_edge");
  const weakEdge = stabilities.filter(s => s.stabilityClass === "weak_edge");
  const sorted = [...stabilities].sort((a, b) => b.avgDelta - a.avgDelta);
  const best = sorted[0];

  const evidence: RecommendationEvidence = {
    bestStrategy: best.strategy,
    bestStrategyStability: best.stabilityClass,
    bestAvgDelta: best.avgDelta,
    windowsTested: benchmark.windowSizesTested,
    strategiesTested: stabilities.length,
    lastBenchmarkAt: latestBenchmarkTime!,
  };

  const regimeRecs = buildRegimeRecommendations(benchmark);
  const regimeAware = regimeRecs.length > 0;
  let regimeBasis: "full_history" | "recent_regime" | "consensus" = "full_history";
  let regimeCaveat: string | undefined;

  if (regimeAware) {
    const recentRegime = regimeRecs.find(r => r.regime === "recent_modern");
    const fullRegime = regimeRecs.find(r => r.regime === "full_modern") || regimeRecs.find(r => r.regime === "older_modern");
    const recentBest = recentRegime?.bestStrategy;
    const fullBest = best.strategy;
    if (recentBest && recentBest !== fullBest) {
      regimeBasis = "recent_regime";
      regimeCaveat = `Recent regime favors "${recentBest}" while full history favors "${fullBest}". Using recent regime as default — toggle to full history if you prefer stability over recency.`;
    } else {
      regimeBasis = "consensus";
      regimeCaveat = "Results are consistent across regimes. Using full-history recommendation.";
    }
  }

  const buildResult = (base: Omit<GeneratorRecommendation, "regimeAware" | "regimeRecommendations" | "regimeBasis" | "regimeCaveat">): GeneratorRecommendation => ({
    ...base,
    regimeAware,
    regimeRecommendations: regimeAware ? regimeRecs : undefined,
    regimeBasis: regimeAware ? regimeBasis : undefined,
    regimeCaveat: regimeAware ? regimeCaveat : undefined,
  });

  if (possibleEdge.length > 0) {
    const top = possibleEdge.sort((a, b) => b.avgDelta - a.avgDelta)[0];
    const mode = STRATEGY_TO_MODE[top.strategy] || "balanced";
    const modeLabel = MODE_TO_LABEL[mode] || "Balanced";
    const isMostDrawn = top.strategy.startsWith("Most Drawn");
    return buildResult({
      recommendedMode: mode,
      recommendedStrategy: modeLabel,
      confidence: possibleEdge.length >= 2 ? "high" : "medium",
      reasonSummary: `"${top.strategy}" consistently outperformed random across ${top.windowsBeating} of ${top.windowsTested} test windows (avg delta +${top.avgDelta}). ${isMostDrawn ? "Using this frequency benchmark directly." : `Using ${modeLabel} mode to blend this signal with anti-popularity protection.`}`,
      evidence,
      strategyBadges: badges,
      hasBenchmark: true,
    });
  }

  if (weakEdge.length > 0) {
    const top = weakEdge.sort((a, b) => b.avgDelta - a.avgDelta)[0];
    const mode = STRATEGY_TO_MODE[top.strategy] || "balanced";
    const modeLabel = MODE_TO_LABEL[mode] || "Balanced";
    return buildResult({
      recommendedMode: mode,
      recommendedStrategy: modeLabel,
      confidence: "low",
      reasonSummary: `"${top.strategy}" showed a small advantage in ${top.windowsBeating} of ${top.windowsTested} windows (avg delta +${top.avgDelta}), but it's not stable across all windows. Using ${modeLabel} mode to mix this weak signal with anti-popularity scoring. Monitor over future benchmarks.`,
      evidence,
      strategyBadges: badges,
      hasBenchmark: true,
    });
  }

  const structureMatched = stabilities.find(s => s.strategy === "Structure-Matched Random");
  if (structureMatched && structureMatched.avgDelta > 0.05) {
    return buildResult({
      recommendedMode: "structure_matched_random",
      recommendedStrategy: "Structure-Matched Random",
      confidence: "low",
      reasonSummary: `No predictive edge found, but "Structure-Matched Random" showed a small structural advantage (avg delta +${structureMatched.avgDelta}). Using structure-matched mode for better baseline coverage. Anti-popularity protection is still your main practical advantage.`,
      evidence,
      strategyBadges: badges,
      hasBenchmark: true,
    });
  }

  return buildResult({
    recommendedMode: "strategy_portfolio",
    recommendedStrategy: "Strategy Portfolio",
    confidence: "medium",
    reasonSummary: "No single strategy beat random consistently. Recommending Strategy Portfolio mode — it builds a mixed 10-game pack from multiple strategies for maximum coverage and diversity. This combines the practical anti-popularity advantage with diverse strategic approaches.",
    evidence,
    strategyBadges: badges,
    hasBenchmark: true,
  });
}

function buildRegimeRecommendations(benchmark: BenchmarkSummary): RegimeRecommendation[] {
  if (!benchmark.regimeSplits || benchmark.regimeSplits.length === 0) return [];
  const results: RegimeRecommendation[] = [];
  for (const regime of benchmark.regimeSplits) {
    const sorted = [...regime.stabilityByStrategy].sort((a, b) => b.avgDelta - a.avgDelta);
    const best = sorted.find(s => s.strategy !== "Random");
    if (best) {
      const mode = STRATEGY_TO_MODE[best.strategy] || "balanced";
      results.push({
        regime: regime.regime,
        bestStrategy: best.strategy,
        bestAvgDelta: best.avgDelta,
        bestStabilityClass: best.stabilityClass,
        recommendedMode: mode,
      });
    }
  }
  return results;
}

// ═══════════════════════════════════════════
// Engine A: Pattern Discovery
// ═══════════════════════════════════════════

export function computeNumberFrequencies(draws: Draw[]): NumberFrequency[] {
  if (draws.length === 0) return [];
  const frequencies: NumberFrequency[] = [];
  const last10 = draws.slice(0, Math.min(10, draws.length));
  const last25 = draws.slice(0, Math.min(25, draws.length));
  const last50 = draws.slice(0, Math.min(50, draws.length));
  const prior10 = draws.slice(Math.min(10, draws.length), Math.min(20, draws.length));

  for (let n = 1; n <= 35; n++) {
    const totalFreq = draws.filter(d => (d.numbers as number[]).includes(n)).length;
    const f10 = last10.filter(d => (d.numbers as number[]).includes(n)).length;
    const f25 = last25.filter(d => (d.numbers as number[]).includes(n)).length;
    const f50 = last50.filter(d => (d.numbers as number[]).includes(n)).length;
    const fPrior10 = prior10.filter(d => (d.numbers as number[]).includes(n)).length;

    let drawsSinceSeen = draws.length;
    for (let i = 0; i < draws.length; i++) {
      if ((draws[i].numbers as number[]).includes(n)) {
        drawsSinceSeen = i;
        break;
      }
    }

    frequencies.push({
      number: n,
      totalFreq,
      last10Freq: f10,
      last25Freq: f25,
      last50Freq: f50,
      drawsSinceSeen,
      rollingTrend: f10 - fPrior10,
    });
  }

  return frequencies;
}

export function computePatternFeatures(draws: Draw[]): { structure: PatternFeatureRow[]; carryover: PatternFeatureRow[] } {
  if (draws.length === 0) return { structure: [], carryover: [] };
  const structure = computeStructureFeatures(draws[0]);
  const carryover = computeCarryoverFeatures(draws);

  if (draws.length >= 10) {
    const historicalValues = computeHistoricalFeatureDistributions(draws.slice(1));
    const allFeatures = [...structure, ...carryover];
    for (const f of allFeatures) {
      if (typeof f.value === "number" && historicalValues[f.feature]) {
        const dist = historicalValues[f.feature];
        const pct = computePercentile(dist, f.value);
        f.percentile = pct;
        f.typicality = pct >= 20 && pct <= 80 ? "typical" : (pct >= 5 && pct <= 95 ? "uncommon" : "rare");
        const q10 = quantile(dist, 0.1);
        const q90 = quantile(dist, 0.9);
        f.normalRange = `${q10}–${q90}`;
      }
    }
  }

  return { structure, carryover };
}

function computeHistoricalFeatureDistributions(draws: Draw[]): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  for (const draw of draws) {
    const nums = draw.numbers as number[];
    const sorted = [...nums].sort((a, b) => a - b);
    const oddCount = nums.filter(n => n % 2 !== 0).length;
    const sum = nums.reduce((a, b) => a + b, 0);
    const range = sorted[sorted.length - 1] - sorted[0];
    const lowCount = nums.filter(n => n <= 17).length;

    let consecutiveCount = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) consecutiveCount++;
    }

    const endings = nums.map(n => n % 10);
    const endingCounts: Record<number, number> = {};
    endings.forEach(e => { endingCounts[e] = (endingCounts[e] || 0) + 1; });
    const repeatedEndings = Object.values(endingCounts).filter(c => c > 1).length;

    const decades: Record<string, number> = { "1-9": 0, "10-19": 0, "20-29": 0, "30-35": 0 };
    nums.forEach(n => {
      if (n < 10) decades["1-9"]++;
      else if (n < 20) decades["10-19"]++;
      else if (n < 30) decades["20-29"]++;
      else decades["30-35"]++;
    });

    const push = (key: string, val: number) => {
      if (!result[key]) result[key] = [];
      result[key].push(val);
    };

    push("odd_count", oddCount);
    push("even_count", 7 - oddCount);
    push("sum", sum);
    push("range", range);
    push("consecutive_count", consecutiveCount);
    push("repeated_endings", repeatedEndings);
    push("decade_1_9", decades["1-9"]);
    push("decade_10_19", decades["10-19"]);
    push("decade_20_29", decades["20-29"]);
    push("decade_30_35", decades["30-35"]);
  }

  if (draws.length >= 2) {
    for (let i = 0; i < draws.length - 1; i++) {
      const current = draws[i].numbers as number[];
      const prev = draws[i + 1].numbers as number[];
      const carryover = current.filter(n => prev.includes(n)).length;
      if (!result["carryover_from_prev"]) result["carryover_from_prev"] = [];
      result["carryover_from_prev"].push(carryover);
    }
  }

  if (draws.length >= 4) {
    for (let i = 0; i < draws.length - 3; i++) {
      const current = draws[i].numbers as number[];
      const last3Nums = new Set<number>();
      for (let j = 1; j <= 3; j++) {
        (draws[i + j].numbers as number[]).forEach(n => last3Nums.add(n));
      }
      const carryover3 = current.filter(n => last3Nums.has(n)).length;
      if (!result["carryover_from_last_3"]) result["carryover_from_last_3"] = [];
      result["carryover_from_last_3"].push(carryover3);
    }
  }

  return result;
}

function computePercentile(dist: number[], value: number): number {
  const sorted = [...dist].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v < value) count++;
    else if (v === value) count += 0.5;
  }
  return Math.round((count / sorted.length) * 100);
}

function quantile(dist: number[], q: number): number {
  const sorted = [...dist].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo));
}

function computeStructureFeatures(draw: Draw): PatternFeatureRow[] {
  const nums = draw.numbers as number[];
  const sorted = [...nums].sort((a, b) => a - b);
  const oddCount = nums.filter(n => n % 2 !== 0).length;
  const evenCount = nums.filter(n => n % 2 === 0).length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const range = sorted[sorted.length - 1] - sorted[0];
  const lowCount = nums.filter(n => n <= 17).length;
  const highCount = nums.filter(n => n > 17).length;

  let consecutiveCount = 0;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) consecutiveCount++;
  }

  const endings = nums.map(n => n % 10);
  const endingCounts: Record<number, number> = {};
  endings.forEach(e => { endingCounts[e] = (endingCounts[e] || 0) + 1; });
  const repeatedEndings = Object.values(endingCounts).filter(c => c > 1).length;

  const decades: Record<string, number> = { "1-9": 0, "10-19": 0, "20-29": 0, "30-35": 0 };
  nums.forEach(n => {
    if (n < 10) decades["1-9"]++;
    else if (n < 20) decades["10-19"]++;
    else if (n < 30) decades["20-29"]++;
    else decades["30-35"]++;
  });

  return [
    { feature: "odd_count", value: oddCount, type: "structure" },
    { feature: "even_count", value: evenCount, type: "structure" },
    { feature: "sum", value: sum, type: "structure" },
    { feature: "range", value: range, type: "structure" },
    { feature: "low_high_split", value: `${lowCount}/${highCount}`, type: "structure" },
    { feature: "consecutive_count", value: consecutiveCount, type: "structure" },
    { feature: "repeated_endings", value: repeatedEndings, type: "structure" },
    { feature: "decade_1_9", value: decades["1-9"], type: "structure" },
    { feature: "decade_10_19", value: decades["10-19"], type: "structure" },
    { feature: "decade_20_29", value: decades["20-29"], type: "structure" },
    { feature: "decade_30_35", value: decades["30-35"], type: "structure" },
  ];
}

function computeCarryoverFeatures(draws: Draw[]): PatternFeatureRow[] {
  if (draws.length < 2) return [];
  const current = draws[0].numbers as number[];
  const prev1 = draws[1].numbers as number[];
  const carryover1 = current.filter(n => prev1.includes(n)).length;
  const features: PatternFeatureRow[] = [
    { feature: "carryover_from_prev", value: carryover1, type: "sequence" },
  ];
  if (draws.length >= 4) {
    const last3Nums = new Set<number>();
    for (let i = 1; i <= 3; i++) {
      (draws[i].numbers as number[]).forEach(n => last3Nums.add(n));
    }
    const carryover3 = current.filter(n => last3Nums.has(n)).length;
    features.push({ feature: "carryover_from_last_3", value: carryover3, type: "sequence" });
  }
  return features;
}

export function computeStructureProfile(draws: Draw[]): StructureProfile {
  if (draws.length < 5) {
    return { oddEvenMode: "N/A", sumMedian: 0, sumQ10: 0, sumQ90: 0, rangeMedian: 0, rangeQ10: 0, rangeQ90: 0, lowHighMode: "N/A", avgCarryover: 0, avgConsecutive: 0, drawsAnalyzed: 0 };
  }

  const oddCounts: number[] = [];
  const sums: number[] = [];
  const ranges: number[] = [];
  const lowCounts: number[] = [];
  const consecutives: number[] = [];
  const carryovers: number[] = [];

  for (let i = 0; i < draws.length; i++) {
    const nums = draws[i].numbers as number[];
    const sorted = [...nums].sort((a, b) => a - b);
    oddCounts.push(nums.filter(n => n % 2 !== 0).length);
    sums.push(nums.reduce((a, b) => a + b, 0));
    ranges.push(sorted[sorted.length - 1] - sorted[0]);
    lowCounts.push(nums.filter(n => n <= 17).length);

    let consec = 0;
    for (let j = 1; j < sorted.length; j++) {
      if (sorted[j] - sorted[j - 1] === 1) consec++;
    }
    consecutives.push(consec);

    if (i < draws.length - 1) {
      const prev = draws[i + 1].numbers as number[];
      carryovers.push(nums.filter(n => prev.includes(n)).length);
    }
  }

  const mode = (arr: number[]): number => {
    const counts: Record<number, number> = {};
    arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Number(Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0]);
  };

  const oddMode = mode(oddCounts);
  const lowMode = mode(lowCounts);

  return {
    oddEvenMode: `${oddMode} odd / ${7 - oddMode} even`,
    sumMedian: quantile(sums, 0.5),
    sumQ10: quantile(sums, 0.1),
    sumQ90: quantile(sums, 0.9),
    rangeMedian: quantile(ranges, 0.5),
    rangeQ10: quantile(ranges, 0.1),
    rangeQ90: quantile(ranges, 0.9),
    lowHighMode: `${lowMode} low / ${7 - lowMode} high`,
    avgCarryover: carryovers.length > 0 ? Number((carryovers.reduce((a, b) => a + b, 0) / carryovers.length).toFixed(1)) : 0,
    avgConsecutive: Number((consecutives.reduce((a, b) => a + b, 0) / consecutives.length).toFixed(1)),
    drawsAnalyzed: draws.length,
  };
}

// ═══════════════════════════════════════════
// Randomness Audit
// ═══════════════════════════════════════════

export function runRandomnessAudit(draws: Draw[]): AuditSummary {
  return runRandomnessAuditMain(draws);
}

export function runRandomnessAuditMain(draws: Draw[]): AuditSummary {
  if (draws.length < 20) {
    return {
      chiSquareStat: 0, chiSquarePValue: 1, entropyScore: 0, maxEntropy: 0,
      entropyRatio: 0, verdict: "fail", details: "Insufficient data for audit (need 20+ draws).",
      scope: "main", drawsUsed: draws.length,
      interpretation: "Not enough data to perform a meaningful audit."
    };
  }

  const observed: number[] = new Array(35).fill(0);
  for (const d of draws) {
    for (const n of d.numbers as number[]) {
      observed[n - 1]++;
    }
  }
  const totalBalls = draws.length * 7;
  const expected = totalBalls / 35;

  let chiSquare = 0;
  for (let i = 0; i < 35; i++) {
    chiSquare += Math.pow(observed[i] - expected, 2) / expected;
  }

  const df = 34;
  const pValue = 1 - chiSquaredCDF(chiSquare, df);

  const probs = observed.map(o => o / totalBalls);
  let entropy = 0;
  for (const p of probs) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(35);
  const entropyRatio = entropy / maxEntropy;

  let verdict: "pass" | "marginal" | "fail";
  let details: string;
  let interpretation: string;

  if (pValue > 0.05 && entropyRatio > 0.95) {
    verdict = "pass";
    details = "Main number distribution appears consistent with random draws. No significant deviations detected.";
    interpretation = "The frequencies of main numbers (1-35) are statistically consistent with uniform random selection. No exploitable pattern detected.";
  } else if (pValue > 0.01 && entropyRatio > 0.90) {
    verdict = "marginal";
    details = "Minor deviations from uniform distribution detected in main numbers. Could be natural variance or a weak signal worth monitoring.";
    interpretation = "Some main numbers appear slightly more or less often than expected, but this is within the range of normal statistical fluctuation. This does not imply a predictive edge.";
  } else {
    verdict = "fail";
    details = "Significant deviation from uniform distribution in main numbers. This may indicate structural patterns or data quality issues.";
    interpretation = "The observed frequency distribution of main numbers differs significantly from what uniform randomness would produce. This is common in real lottery data and does not by itself imply a predictive signal — it may reflect natural variance over the sample period.";
  }

  return {
    chiSquareStat: Number(chiSquare.toFixed(2)),
    chiSquarePValue: Number(pValue.toFixed(4)),
    entropyScore: Number(entropy.toFixed(4)),
    maxEntropy: Number(maxEntropy.toFixed(4)),
    entropyRatio: Number(entropyRatio.toFixed(4)),
    verdict, details, scope: "main", drawsUsed: draws.length, interpretation,
  };
}

export function runRandomnessAuditPowerball(draws: Draw[]): AuditSummary {
  if (draws.length < 20) {
    return {
      chiSquareStat: 0, chiSquarePValue: 1, entropyScore: 0, maxEntropy: 0,
      entropyRatio: 0, verdict: "fail", details: "Insufficient data for Powerball audit (need 20+ draws).",
      scope: "powerball", drawsUsed: draws.length,
      interpretation: "Not enough data to perform a meaningful audit."
    };
  }

  const observed: number[] = new Array(20).fill(0);
  for (const d of draws) {
    observed[d.powerball - 1]++;
  }
  const totalBalls = draws.length;
  const expected = totalBalls / 20;

  let chiSquare = 0;
  for (let i = 0; i < 20; i++) {
    chiSquare += Math.pow(observed[i] - expected, 2) / expected;
  }

  const df = 19;
  const pValue = 1 - chiSquaredCDF(chiSquare, df);

  const probs = observed.map(o => o / totalBalls);
  let entropy = 0;
  for (const p of probs) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  const maxEntropy = Math.log2(20);
  const entropyRatio = entropy / maxEntropy;

  let verdict: "pass" | "marginal" | "fail";
  let details: string;
  let interpretation: string;

  if (pValue > 0.05 && entropyRatio > 0.95) {
    verdict = "pass";
    details = "Powerball distribution appears consistent with random draws. No significant deviations detected.";
    interpretation = "Powerball frequencies (1-20) are statistically consistent with uniform random selection.";
  } else if (pValue > 0.01 && entropyRatio > 0.90) {
    verdict = "marginal";
    details = "Minor deviations from uniform distribution detected in Powerball numbers.";
    interpretation = "Some Powerball values appear slightly more or less often than expected. This is within normal statistical fluctuation and does not imply predictability.";
  } else {
    verdict = "fail";
    details = "Significant deviation from uniform distribution in Powerball numbers.";
    interpretation = "The Powerball frequency distribution differs significantly from uniform randomness. This is a statistical observation — it does not mean Powerball draws are predictable.";
  }

  return {
    chiSquareStat: Number(chiSquare.toFixed(2)),
    chiSquarePValue: Number(pValue.toFixed(4)),
    entropyScore: Number(entropy.toFixed(4)),
    maxEntropy: Number(maxEntropy.toFixed(4)),
    entropyRatio: Number(entropyRatio.toFixed(4)),
    verdict, details, scope: "powerball", drawsUsed: draws.length, interpretation,
  };
}

function chiSquaredCDF(x: number, k: number): number {
  if (x <= 0) return 0;
  return regularizedGammaP(k / 2, x / 2);
}

function regularizedGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  } else {
    let f = 1;
    let c = 1;
    let d = 1 / (x + 1 - a);
    let h = d;
    for (let i = 1; i < 200; i++) {
      const an = -i * (i - a);
      const bn = x + 2 * i + 1 - a;
      d = bn + an * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = bn + an / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-10) break;
    }
    return 1 - h * Math.exp(-x + a * Math.log(x) - lnGamma(a));
  }
}

function lnGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let x = z;
  let y = z;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += c[j] / y;
  }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ═══════════════════════════════════════════
// Engine B: Validation
// ═══════════════════════════════════════════

export function runWalkForwardValidation(draws: Draw[]): ValidationSummary {
  if (draws.length < 50) {
    return {
      verdict: "insufficient_data",
      verdictExplanation: `Only ${draws.length} modern draws available. Need at least 50 for meaningful walk-forward validation. Upload more data or check that your CSV contains modern format (7+1) draws.`,
      byStrategy: [],
      rollingWindows: [],
      diagnostics: {
        totalDrawsUsed: draws.length,
        testSetSize: 0,
        trainSetSize: 0,
        modernFormatOnly: true,
        compositeVsRandomDelta: 0,
      },
    };
  }

  const testSize = Math.min(50, Math.floor(draws.length * 0.2));
  const testDraws = draws.slice(0, testSize);
  const trainDraws = draws.slice(testSize);

  function scoreStrategy(strategyName: string, strategyFn: (train: Draw[]) => { picks: number[]; pb: number }): StrategyResult {
    let totalMain = 0;
    let bestMain = 0;
    let pbHits = 0;

    for (const testDraw of testDraws) {
      const actual = testDraw.numbers as number[];
      const actualPB = testDraw.powerball;
      const { picks, pb } = strategyFn(trainDraws);
      const mainMatches = picks.filter(n => actual.includes(n)).length;
      totalMain += mainMatches;
      bestMain = Math.max(bestMain, mainMatches);
      if (pb === actualPB) pbHits++;
    }

    return {
      strategy: strategyName,
      avgMainMatches: Number((totalMain / testDraws.length).toFixed(2)),
      bestMainMatches: bestMain,
      powerballHitRate: Number(((pbHits / testSize) * 100).toFixed(1)),
      powerballHits: pbHits,
      testDraws: testSize,
    };
  }

  const randomResult = scoreStrategy("Random", () => ({
    picks: generateRandomCard(),
    pb: Math.floor(Math.random() * 20) + 1,
  }));

  const freqResult = scoreStrategy("Frequency Only", (train) => {
    const freqs = computeNumberFrequencies(train);
    const sorted = [...freqs].sort((a, b) => b.totalFreq - a.totalFreq);
    const picks = sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b);
    const pbFreqs = getPbFreqs(train);
    return { picks, pb: topPb(pbFreqs) };
  });

  const recencyResult = scoreStrategy("Recency Only", (train) => {
    const freqs = computeNumberFrequencies(train);
    const sorted = [...freqs].sort((a, b) => a.drawsSinceSeen - b.drawsSinceSeen);
    const picks = sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b);
    return { picks, pb: train[0]?.powerball || 1 };
  });

  const structureResult = scoreStrategy("Structure-Aware Random", (train) => {
    const card = generateStructureAwareCard(train);
    return { picks: card, pb: Math.floor(Math.random() * 20) + 1 };
  });

  const compositeResult = scoreStrategy("Composite Model", (train) => {
    const freqs = computeNumberFrequencies(train);
    const scored = freqs.map(f => ({
      number: f.number,
      score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
    }));
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const picks = sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b);
    const pbFreqs = getPbFreqs(train.slice(0, 25));
    return { picks, pb: topPb(pbFreqs) };
  });

  const mostDrawnAllTime = scoreStrategy("Most Drawn (All-Time)", (train) => {
    return buildMostDrawnPick(train, train.length);
  });

  const mostDrawnLast50 = scoreStrategy("Most Drawn (Last 50)", (train) => {
    return buildMostDrawnPick(train, 50);
  });

  const mostDrawnLast100 = scoreStrategy("Most Drawn (Last 100)", (train) => {
    return buildMostDrawnPick(train, 100);
  });

  const mostDrawnLast20 = scoreStrategy("Most Drawn (Last 20)", (train) => {
    return buildMostDrawnPick(train, 20);
  });

  const leastDrawnLast50 = scoreStrategy("Least Drawn (Last 50)", (train) => {
    return buildLeastDrawnPick(train, 50);
  });

  const structureMatchedResult = scoreStrategy("Structure-Matched Random", (train) => {
    return { picks: generateStructureMatchedCard(train), pb: Math.floor(Math.random() * 20) + 1 };
  });

  const antiPopularResult = scoreStrategy("Anti-Popular Only", () => {
    return generateAntiPopularPick();
  });

  const diversityResult = scoreStrategy("Diversity Optimized", (train) => {
    const freqs = computeNumberFrequencies(train);
    const scored = freqs.map(f => ({
      number: f.number,
      score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
    }));
    return { picks: weightedSample(scored, 7), pb: Math.floor(Math.random() * 20) + 1 };
  });

  const strategies = [randomResult, freqResult, recencyResult, structureResult, compositeResult, mostDrawnAllTime, mostDrawnLast50, mostDrawnLast100, mostDrawnLast20, leastDrawnLast50, structureMatchedResult, antiPopularResult, diversityResult];

  const rollingWindows = computeRollingWindows(draws);

  const delta = compositeResult.avgMainMatches - randomResult.avgMainMatches;
  let verdict: ValidationVerdict;
  let verdictExplanation: string;

  if (delta > 0.5) {
    verdict = "possible_edge";
    verdictExplanation = `The composite model averages ${compositeResult.avgMainMatches} main matches per draw vs ${randomResult.avgMainMatches} for random — a delta of +${delta.toFixed(2)}. This suggests a possible statistical edge, though it should be monitored over time for stability.`;
  } else if (delta > 0.15) {
    verdict = "weak_edge";
    verdictExplanation = `The composite model averages ${compositeResult.avgMainMatches} main matches per draw vs ${randomResult.avgMainMatches} for random — a delta of +${delta.toFixed(2)}. This is a weak signal that may not persist. The anti-popularity engine remains your most practical advantage.`;
  } else {
    verdict = "no_edge";
    verdictExplanation = `The composite model averages ${compositeResult.avgMainMatches} main matches per draw vs ${randomResult.avgMainMatches} for random — a delta of ${delta >= 0 ? '+' : ''}${delta.toFixed(2)}. No meaningful predictive edge detected. This is expected — lottery draws are designed to be random. The anti-popularity engine is where the real value lies: reducing split-risk if you do win.`;
  }

  return {
    verdict,
    verdictExplanation,
    byStrategy: strategies,
    rollingWindows,
    diagnostics: {
      totalDrawsUsed: draws.length,
      testSetSize: testSize,
      trainSetSize: trainDraws.length,
      modernFormatOnly: true,
      compositeVsRandomDelta: Number(delta.toFixed(2)),
    },
  };
}

// ═══════════════════════════════════════════
// Engine B2: Multi-Window Benchmark Validation
// ═══════════════════════════════════════════

type StrategyFn = (trainDraws: Draw[]) => { picks: number[]; pb: number };

function getStrategyRegistry(): { name: string; fn: StrategyFn }[] {
  return [
    {
      name: "Random",
      fn: () => ({ picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 }),
    },
    {
      name: "Frequency Only",
      fn: (train) => {
        const freqs = computeNumberFrequencies(train);
        const sorted = [...freqs].sort((a, b) => b.totalFreq - a.totalFreq);
        return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(train)) };
      },
    },
    {
      name: "Recency Only",
      fn: (train) => {
        const freqs = computeNumberFrequencies(train);
        const sorted = [...freqs].sort((a, b) => a.drawsSinceSeen - b.drawsSinceSeen);
        return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: train[0]?.powerball || 1 };
      },
    },
    {
      name: "Structure-Aware",
      fn: (train) => ({ picks: generateStructureAwareCard(train), pb: Math.floor(Math.random() * 20) + 1 }),
    },
    {
      name: "Composite",
      fn: (train) => {
        const freqs = computeNumberFrequencies(train);
        const scored = freqs.map(f => ({
          number: f.number,
          score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
        }));
        const sorted = [...scored].sort((a, b) => b.score - a.score);
        return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(train.slice(0, 25))) };
      },
    },
    {
      name: "Most Drawn (All-Time)",
      fn: (train) => buildMostDrawnPick(train, train.length),
    },
    {
      name: "Most Drawn (Last 50)",
      fn: (train) => buildMostDrawnPick(train, 50),
    },
    {
      name: "Most Drawn (Last 100)",
      fn: (train) => buildMostDrawnPick(train, 100),
    },
    {
      name: "Most Drawn (Last 20)",
      fn: (train) => buildMostDrawnPick(train, 20),
    },
    {
      name: "Least Drawn (Last 50)",
      fn: (train) => buildLeastDrawnPick(train, 50),
    },
    {
      name: "Structure-Matched Random",
      fn: (train) => ({ picks: generateStructureMatchedCard(train), pb: Math.floor(Math.random() * 20) + 1 }),
    },
    {
      name: "Anti-Popular Only",
      fn: () => generateAntiPopularPick(),
    },
    {
      name: "Diversity Optimized",
      fn: (train) => {
        const freqs = computeNumberFrequencies(train);
        const scored = freqs.map(f => ({
          number: f.number,
          score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
        }));
        return { picks: weightedSample(scored, 7), pb: Math.floor(Math.random() * 20) + 1 };
      },
    },
    {
      name: "Smoothed Most Drawn (L50)",
      fn: (train) => buildSmoothedPick(train, 50),
    },
    {
      name: "Smoothed Most Drawn (L20)",
      fn: (train) => buildSmoothedPick(train, 20),
    },
    {
      name: "Recency Smoothed",
      fn: (train) => buildRecencySmoothedPick(train),
    },
    {
      name: "Recency Gap Balanced",
      fn: (train) => buildRecencyGapBalancedPick(train),
    },
    {
      name: "Recency Decay Weighted",
      fn: (train) => buildRecencyDecayWeightedPick(train),
    },
    {
      name: "Recency Short Window",
      fn: (train) => buildRecencyShortWindowPick(train),
    },
    {
      name: "Composite No-Frequency",
      fn: (train) => buildCompositeNoFrequencyPick(train),
    },
    {
      name: "Composite Recency-Heavy",
      fn: (train) => buildCompositeRecencyHeavyPick(train),
    },
    {
      name: "Composite No-Recency",
      fn: (train) => buildCompositeNoRecencyPick(train),
    },
    {
      name: "Composite No-Structure",
      fn: (train) => buildCompositeNoStructurePick(train),
    },
    {
      name: "Composite No-AntiPop",
      fn: (train) => buildCompositeNoAntiPopPick(train),
    },
    {
      name: "Composite Structure-Heavy",
      fn: (train) => buildCompositeStructureHeavyPick(train),
    },
  ];
}

export function runBenchmarkValidation(
  draws: Draw[],
  windowSizes: number[] = [20, 40, 60, 100],
  minTrainDraws: number = 100,
  benchmarkMode: BenchmarkMode = "fixed_holdout",
  seed: number = 42,
  randomBaselineRuns: number = 200,
  runPermutation: boolean = false,
  permutationRuns: number = 200,
  selectedStrategies?: string[],
  presetName?: string,
  permutationStrategies?: string[],
  regimeSplits: boolean = false
): BenchmarkSummary {
  const allStrategies = getStrategyRegistry();
  const strategies = selectedStrategies && selectedStrategies.length > 0
    ? allStrategies.filter(s => selectedStrategies.includes(s.name) || s.name === "Random")
    : allStrategies;
  const validWindows = windowSizes.filter(w => draws.length >= w + minTrainDraws);

  if (validWindows.length === 0) {
    return {
      byWindowByStrategy: [],
      stabilityByStrategy: [],
      windowSizesTested: [],
      totalDrawsAvailable: draws.length,
      overallVerdict: `Insufficient data: ${draws.length} draws available, need at least ${Math.min(...windowSizes) + minTrainDraws} for the smallest window.`,
      benchmarkMode,
      seed,
      randomEnsemble: null,
      permutationTests: [],
    };
  }

  const allResults: BenchmarkStrategyWindow[] = [];
  const ensembleRng = mulberry32(seed);
  let globalEnsembleDeltas: number[] = [];

  for (const windowSize of validWindows) {
    const testDraws = draws.slice(0, windowSize);
    const trainDraws = draws.slice(windowSize);

    const ensembleAvgs: number[] = [];
    for (let run = 0; run < randomBaselineRuns; run++) {
      let total = 0;
      for (const testDraw of testDraws) {
        const actual = testDraw.numbers as number[];
        const card = seededRandomCard(ensembleRng);
        total += card.filter(n => actual.includes(n)).length;
      }
      ensembleAvgs.push(total / testDraws.length);
    }

    const ensembleMean = ensembleAvgs.reduce((s, v) => s + v, 0) / ensembleAvgs.length;
    const sortedEnsemble = [...ensembleAvgs].sort((a, b) => a - b);
    const p05 = sortedEnsemble[Math.floor(ensembleAvgs.length * 0.05)];
    const p95 = sortedEnsemble[Math.floor(ensembleAvgs.length * 0.95)];

    const windowResults: { strategy: string; avgMain: number; bestMain: number; pbHits: number; evaluatedDraws: number; skippedDraws: number }[] = [];

    for (const strat of strategies) {
      if (strat.name === "Random") {
        windowResults.push({ strategy: "Random", avgMain: ensembleMean, bestMain: 0, pbHits: 0, evaluatedDraws: testDraws.length, skippedDraws: 0 });
        continue;
      }

      let totalMain = 0;
      let bestMain = 0;
      let pbHits = 0;
      let evaluatedDraws = 0;

      if (benchmarkMode === "rolling_walk_forward") {
        for (let i = testDraws.length - 1; i >= 0; i--) {
          const rollingTrain = draws.slice(i + 1);
          if (rollingTrain.length < minTrainDraws) continue;
          evaluatedDraws++;
          const testDraw = draws[i];
          const actual = testDraw.numbers as number[];
          const actualPB = testDraw.powerball;
          const { picks, pb } = strat.fn(rollingTrain);
          const mainMatches = picks.filter(n => actual.includes(n)).length;
          totalMain += mainMatches;
          bestMain = Math.max(bestMain, mainMatches);
          if (pb === actualPB) pbHits++;
        }
      } else {
        evaluatedDraws = testDraws.length;
        for (const testDraw of testDraws) {
          const actual = testDraw.numbers as number[];
          const actualPB = testDraw.powerball;
          const { picks, pb } = strat.fn(trainDraws);
          const mainMatches = picks.filter(n => actual.includes(n)).length;
          totalMain += mainMatches;
          bestMain = Math.max(bestMain, mainMatches);
          if (pb === actualPB) pbHits++;
        }
      }

      const denominator = evaluatedDraws > 0 ? evaluatedDraws : 1;
      const skippedDraws = testDraws.length - evaluatedDraws;
      windowResults.push({ strategy: strat.name, avgMain: totalMain / denominator, bestMain, pbHits, evaluatedDraws, skippedDraws });
    }

    for (const r of windowResults) {
      const delta = r.strategy === "Random" ? 0 : Number((r.avgMain - ensembleMean).toFixed(3));
      const withinBand = r.avgMain >= p05 && r.avgMain <= p95;
      const pbDenom = r.evaluatedDraws > 0 ? r.evaluatedDraws : 1;
      allResults.push({
        strategy: r.strategy,
        windowSize,
        testDraws: windowSize,
        trainDraws: trainDraws.length,
        avgMainMatches: Number(r.avgMain.toFixed(2)),
        bestMainMatches: r.bestMain,
        powerballHitRate: Number(((r.pbHits / pbDenom) * 100).toFixed(1)),
        powerballHits: r.pbHits,
        deltaVsRandom: Number(delta.toFixed(2)),
        deltaVsRandomMean: Number(delta.toFixed(2)),
        beatsRandom: r.strategy !== "Random" && delta > 0,
        withinRandomBand: withinBand,
        evaluatedDraws: r.evaluatedDraws,
        skippedDraws: r.skippedDraws,
      });
      if (r.strategy !== "Random") globalEnsembleDeltas.push(delta);
    }
  }

  const allEnsembleAvgs: number[] = [];
  const ensembleRng2 = mulberry32(seed);
  const firstWindow = validWindows[0];
  const firstTestDraws = draws.slice(0, firstWindow);
  for (let run = 0; run < randomBaselineRuns; run++) {
    let total = 0;
    for (const td of firstTestDraws) {
      total += seededRandomCard(ensembleRng2).filter(n => (td.numbers as number[]).includes(n)).length;
    }
    allEnsembleAvgs.push(total / firstTestDraws.length);
  }
  const eMean = allEnsembleAvgs.reduce((s, v) => s + v, 0) / allEnsembleAvgs.length;
  const sortedE = [...allEnsembleAvgs].sort((a, b) => a - b);
  const eStdDev = Math.sqrt(allEnsembleAvgs.reduce((s, v) => s + Math.pow(v - eMean, 2), 0) / allEnsembleAvgs.length);

  const randomEnsemble: RandomEnsembleSummary = {
    runs: randomBaselineRuns,
    seed,
    mean: Number(eMean.toFixed(3)),
    p05: Number(sortedE[Math.floor(allEnsembleAvgs.length * 0.05)].toFixed(3)),
    p95: Number(sortedE[Math.floor(allEnsembleAvgs.length * 0.95)].toFixed(3)),
    stdDev: Number(eStdDev.toFixed(4)),
  };

  const strategyNames = [...new Set(allResults.map(r => r.strategy))].filter(s => s !== "Random");
  const stabilityByStrategy: BenchmarkStrategyStability[] = strategyNames.map(name => {
    const rows = allResults.filter(r => r.strategy === name);
    const windowsTested = rows.length;
    const windowsBeating = rows.filter(r => r.deltaVsRandom > 0.05).length;
    const windowsLosing = rows.filter(r => r.deltaVsRandom < -0.05).length;
    const avgDelta = Number((rows.reduce((sum, r) => sum + r.deltaVsRandom, 0) / windowsTested).toFixed(2));

    let stabilityClass: StabilityClass;
    if (windowsTested === 0) {
      stabilityClass = "insufficient_data";
    } else if (windowsBeating >= 3 && windowsLosing === 0) {
      stabilityClass = "possible_edge";
    } else if (windowsBeating >= 2) {
      stabilityClass = "weak_edge";
    } else if (windowsLosing > windowsBeating && avgDelta < -0.1) {
      stabilityClass = "underperforming";
    } else {
      stabilityClass = "no_edge";
    }

    const strategyAvg = rows.length > 0 ? rows.reduce((sum, r) => sum + r.avgMainMatches, 0) / rows.length : 0;
    const belowCount = sortedE.filter(v => v < strategyAvg).length;
    const percentileVsRandom = Math.round((belowCount / sortedE.length) * 100);
    const aboveP95 = strategyAvg > randomEnsemble.p95;

    let worthIt: import("@shared/schema").WorthItClass;
    if (avgDelta < -0.1) {
      worthIt = "underperforming";
    } else if (avgDelta <= 0) {
      worthIt = "no_edge";
    } else if (aboveP95) {
      worthIt = "worth_trying";
    } else {
      worthIt = "promising";
    }

    return { strategy: name, windowsTested, windowsBeating, windowsLosing, avgDelta, stabilityClass, percentileVsRandom, aboveP95, worthIt };
  });

  let permutationTests: BenchmarkPermutationResult[] = [];
  if (runPermutation && validWindows.length > 0) {
    let topStrategies: BenchmarkStrategyStability[];
    if (permutationStrategies && permutationStrategies.length > 0) {
      topStrategies = stabilityByStrategy.filter(s => permutationStrategies.includes(s.strategy));
    } else {
      topStrategies = [...stabilityByStrategy].sort((a, b) => b.avgDelta - a.avgDelta).slice(0, 3).filter(s => s.avgDelta > 0);
    }
    const permRng = mulberry32(seed + 7919);
    const actualPermRuns = Math.min(permutationRuns, 1000);

    for (const strat of topStrategies) {
      const observedDelta = strat.avgDelta;
      const nullDeltas: number[] = [];

      for (let p = 0; p < actualPermRuns; p++) {
        const shuffled = fisherYatesShuffle([...draws], permRng);
        const wSize = validWindows[0];
        const pTest = shuffled.slice(0, wSize);
        const pTrain = shuffled.slice(wSize);
        const stratFn = strategies.find(s => s.name === strat.strategy);
        if (!stratFn) continue;

        let total = 0;
        for (const td of pTest) {
          const { picks } = stratFn.fn(pTrain as Draw[]);
          total += picks.filter(n => (td.numbers as number[]).includes(n)).length;
        }
        const permAvg = total / pTest.length;

        let randTotal = 0;
        for (const td of pTest) {
          randTotal += seededRandomCard(permRng).filter(n => (td.numbers as number[]).includes(n)).length;
        }
        const randAvg = randTotal / pTest.length;
        nullDeltas.push(permAvg - randAvg);
      }

      const nullMean = nullDeltas.reduce((s, d) => s + d, 0) / nullDeltas.length;
      const nullStd = Math.sqrt(nullDeltas.reduce((s, d) => s + Math.pow(d - nullMean, 2), 0) / nullDeltas.length);
      const betterCount = nullDeltas.filter(d => d >= observedDelta).length;
      const empiricalPValue = Number((betterCount / nullDeltas.length).toFixed(3));
      const percentile = Math.round(((nullDeltas.length - betterCount) / nullDeltas.length) * 100);

      permutationTests.push({
        strategy: strat.strategy,
        metric: "avg_main_matches_delta_vs_random",
        observedDelta: Number(observedDelta.toFixed(3)),
        nullMean: Number(nullMean.toFixed(3)),
        nullStd: Number(nullStd.toFixed(3)),
        percentile,
        empiricalPValue,
        cautionText: empiricalPValue < 0.05
          ? `${strat.strategy} performance (delta +${observedDelta.toFixed(2)}) exceeds ${percentile}% of permuted baselines. This is suggestive but not proof of a predictive edge — lottery draws are independent events.`
          : `${strat.strategy} performance is within the range of permuted baselines (p=${empiricalPValue}). No evidence that this strategy's performance exceeds random chance.`,
        shuffleMethod: "fisher_yates",
        scope: "cross_draw",
        runs: actualPermRuns,
      });
    }
  }

  const modeLabel = benchmarkMode === "rolling_walk_forward" ? "rolling walk-forward" : "fixed holdout";
  const edgeStrategies = stabilityByStrategy.filter(s => s.stabilityClass === "possible_edge" || s.stabilityClass === "weak_edge");
  let overallVerdict: string;
  if (edgeStrategies.length === 0) {
    overallVerdict = `No strategy showed a consistent edge over the random ensemble (${randomBaselineRuns} runs, seed ${seed}) across ${validWindows.length} test windows in ${modeLabel} mode. This is expected — lottery draws are designed to be random.`;
  } else {
    const names = edgeStrategies.map(s => s.strategy).join(", ");
    const classes = edgeStrategies.map(s => `${s.strategy}: ${s.stabilityClass.replace(/_/g, " ")}`).join("; ");
    overallVerdict = `[${modeLabel.toUpperCase()}] Potential signals detected: ${names}. Classification: ${classes}. Tested against random ensemble (${randomBaselineRuns} runs). Monitor over time.`;
  }

  let regimeSplitResults: RegimeSplitResult[] | undefined;
  if (regimeSplits && draws.length >= 60) {
    const third = Math.floor(draws.length / 3);
    const regimes: { name: string; slice: Draw[] }[] = [
      { name: "recent_modern", slice: draws.slice(0, third) },
      { name: "mid_modern", slice: draws.slice(third, third * 2) },
      { name: "older_modern", slice: draws.slice(third * 2) },
    ];
    regimeSplitResults = [];
    for (const regime of regimes) {
      const rDraws = regime.slice;
      if (rDraws.length < 30) continue;
      const rWindows = windowSizes.filter(w => rDraws.length >= w + Math.min(minTrainDraws, Math.floor(rDraws.length * 0.4)));
      if (rWindows.length === 0) continue;
      const rMinTrain = Math.min(minTrainDraws, Math.floor(rDraws.length * 0.4));
      const rResult = runBenchmarkValidation(rDraws, rWindows, rMinTrain, benchmarkMode, seed, Math.min(randomBaselineRuns, 100), false, 0, selectedStrategies, undefined, undefined, false);
      const firstDate = rDraws[rDraws.length - 1]?.drawDate || "?";
      const lastDate = rDraws[0]?.drawDate || "?";
      regimeSplitResults.push({
        regime: regime.name,
        drawCount: rDraws.length,
        dateRange: `${firstDate} – ${lastDate}`,
        stabilityByStrategy: rResult.stabilityByStrategy,
        byWindowByStrategy: rResult.byWindowByStrategy,
      });
    }
  }

  return {
    byWindowByStrategy: allResults,
    stabilityByStrategy,
    windowSizesTested: validWindows,
    totalDrawsAvailable: draws.length,
    overallVerdict,
    benchmarkMode,
    seed,
    randomEnsemble,
    permutationTests,
    presetName,
    selectedStrategies: selectedStrategies || undefined,
    regimeSplits: regimeSplitResults,
  };
}

function computeRollingWindows(draws: Draw[]): RollingWindow[] {
  const windowSize = 25;
  const windows: RollingWindow[] = [];
  if (draws.length < windowSize + 10) return windows;

  for (let start = 0; start + windowSize <= Math.min(draws.length, 200); start += windowSize) {
    const testSlice = draws.slice(start, start + 5);
    const trainSlice = draws.slice(start + 5, start + windowSize);
    if (trainSlice.length < 10) break;

    let compositeTotal = 0;
    let randomTotal = 0;

    for (const testDraw of testSlice) {
      const actual = testDraw.numbers as number[];

      const freqs = computeNumberFrequencies(trainSlice);
      const scored = freqs.map(f => ({
        number: f.number,
        score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
      }));
      const sorted = [...scored].sort((a, b) => b.score - a.score);
      const compositePicks = sorted.slice(0, 7).map(f => f.number);
      compositeTotal += compositePicks.filter(n => actual.includes(n)).length;

      const randomPicks = generateRandomCard();
      randomTotal += randomPicks.filter(n => actual.includes(n)).length;
    }

    const compositeAvg = compositeTotal / testSlice.length;
    const randomAvg = randomTotal / testSlice.length;

    windows.push({
      windowStart: start,
      windowEnd: start + windowSize,
      compositeAvg: Number(compositeAvg.toFixed(2)),
      randomAvg: Number(randomAvg.toFixed(2)),
      delta: Number((compositeAvg - randomAvg).toFixed(2)),
    });
  }

  return windows;
}

function buildMostDrawnPick(draws: Draw[], windowSize: number): { picks: number[]; pb: number } {
  const window = draws.slice(0, Math.min(windowSize, draws.length));
  if (window.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };

  const mainCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if ((window[i].numbers as number[]).includes(n)) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    mainCounts.push({ number: n, count, lastSeen });
  }
  mainCounts.sort((a, b) => b.count - a.count || a.lastSeen - b.lastSeen || a.number - b.number);
  const picks = mainCounts.slice(0, 7).map(m => m.number).sort((a, b) => a - b);

  const pbCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 20; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if (window[i].powerball === n) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    pbCounts.push({ number: n, count, lastSeen });
  }
  pbCounts.sort((a, b) => b.count - a.count || a.lastSeen - b.lastSeen || a.number - b.number);
  const pb = pbCounts[0]?.number ?? 1;

  return { picks, pb };
}

function generateMostDrawnCards(draws: Draw[], windowSize: number, count: number): GeneratedPick[] {
  const window = draws.slice(0, Math.min(windowSize, draws.length));
  if (window.length === 0) return [];

  const mainCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if ((window[i].numbers as number[]).includes(n)) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    mainCounts.push({ number: n, count, lastSeen });
  }
  mainCounts.sort((a, b) => b.count - a.count || a.lastSeen - b.lastSeen || a.number - b.number);

  const pbCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 20; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if (window[i].powerball === n) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    pbCounts.push({ number: n, count, lastSeen });
  }
  pbCounts.sort((a, b) => b.count - a.count || a.lastSeen - b.lastSeen || a.number - b.number);

  const mainPool = Math.min(18, mainCounts.length);
  const pbPool = Math.min(10, pbCounts.length);
  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 30 && candidates.length < count; attempt++) {
    let card: number[];
    let pb: number;

    if (attempt === 0) {
      card = mainCounts.slice(0, 7).map(m => m.number).sort((a, b) => a - b);
      pb = pbCounts[0]?.number ?? 1;
    } else {
      const poolSlice = mainCounts.slice(0, mainPool);
      const weights = poolSlice.map((m, i) => ({ number: m.number, score: mainPool - i + m.count }));
      card = weightedSample(weights, 7);
      const pbIdx = Math.floor(Math.random() * Math.min(pbPool, pbCounts.length));
      pb = pbCounts[pbIdx]?.number ?? 1;
    }

    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const topMainSet = new Set(mainCounts.slice(0, 7).map(m => m.number));
    const overlapCount = card.filter(n => topMainSet.has(n)).length;
    const drawFit = Math.round((overlapCount / 7) * 100);
    const finalScore = (drawFit * 60 + antiPop * 40) / 100;

    candidates.push({
      rank: 0,
      numbers: card,
      powerball: pb,
      drawFit,
      antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

function buildLeastDrawnPick(draws: Draw[], windowSize: number): { picks: number[]; pb: number } {
  const window = draws.slice(0, Math.min(windowSize, draws.length));
  if (window.length === 0) return { picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 };

  const mainCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if ((window[i].numbers as number[]).includes(n)) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    mainCounts.push({ number: n, count, lastSeen });
  }
  mainCounts.sort((a, b) => a.count - b.count || b.lastSeen - a.lastSeen || a.number - b.number);
  const picks = mainCounts.slice(0, 7).map(m => m.number).sort((a, b) => a - b);

  const pbCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 20; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if (window[i].powerball === n) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    pbCounts.push({ number: n, count, lastSeen });
  }
  pbCounts.sort((a, b) => a.count - b.count || b.lastSeen - a.lastSeen || a.number - b.number);
  const pb = pbCounts[0]?.number ?? 1;

  return { picks, pb };
}

function generateStructureMatchedCard(draws: Draw[]): number[] {
  if (draws.length < 5) return generateRandomCard();

  const sampleSize = Math.min(draws.length, 100);
  let avgOdd = 0;
  let avgSum = 0;
  let avgLow = 0;
  let avgRange = 0;
  for (let i = 0; i < sampleSize; i++) {
    const nums = draws[i].numbers as number[];
    const sorted = [...nums].sort((a, b) => a - b);
    avgOdd += nums.filter(n => n % 2 !== 0).length;
    avgSum += nums.reduce((a, b) => a + b, 0);
    avgLow += nums.filter(n => n <= 17).length;
    avgRange += sorted[sorted.length - 1] - sorted[0];
  }
  avgOdd = Math.round(avgOdd / sampleSize);
  avgSum = Math.round(avgSum / sampleSize);
  avgLow = Math.round(avgLow / sampleSize);
  avgRange = Math.round(avgRange / sampleSize);

  let bestCard = generateRandomCard();
  let bestFit = Infinity;

  for (let attempt = 0; attempt < 200; attempt++) {
    const card = generateRandomCard();
    const odd = card.filter(n => n % 2 !== 0).length;
    const sum = card.reduce((a, b) => a + b, 0);
    const low = card.filter(n => n <= 17).length;
    const range = card[card.length - 1] - card[0];

    const fit = Math.abs(odd - avgOdd) + Math.abs(sum - avgSum) / 15 + Math.abs(low - avgLow) + Math.abs(range - avgRange) / 5;
    if (fit < bestFit) {
      bestFit = fit;
      bestCard = card;
    }
    if (fit < 1.5) return card;
  }
  return bestCard;
}

function generateAntiPopularPick(): { picks: number[]; pb: number } {
  let bestCard = generateRandomCard();
  let bestPb = Math.floor(Math.random() * 20) + 1;
  let bestScore = -1;

  for (let attempt = 0; attempt < 200; attempt++) {
    const card = generateRandomCard();
    const pb = Math.floor(Math.random() * 13) + 8;
    const { score } = scoreAntiPopularity(card, pb);
    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
      bestPb = pb;
    }
  }
  return { picks: bestCard, pb: bestPb };
}

function generateDiverseCards(draws: Draw[], count: number): GeneratedPick[] {
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
  }));
  const pbFreqs = getPbFreqs(draws.slice(0, 50));

  const candidatePool: GeneratedPick[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 50 && candidatePool.length < count * 5; attempt++) {
    let card: number[];
    let pb: number;

    if (attempt % 3 === 0) {
      card = weightedSample(scored, 7);
      const pbEntries = Object.entries(pbFreqs).sort(([, a], [, b]) => b - a);
      pb = pbEntries.length > 0 ? Number(pbEntries[Math.floor(Math.random() * Math.min(5, pbEntries.length))][0]) : Math.floor(Math.random() * 20) + 1;
    } else if (attempt % 3 === 1) {
      card = generateStructureMatchedCard(draws);
      pb = Math.floor(Math.random() * 20) + 1;
    } else {
      card = generateRandomCard();
      pb = Math.floor(Math.random() * 20) + 1;
    }

    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const drawFit = computeDrawFitScore(card, scored);
    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const finalScore = (drawFit * 50 + antiPop * 50) / 100;

    candidatePool.push({
      rank: 0,
      numbers: card,
      powerball: pb,
      drawFit: Math.round(drawFit),
      antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidatePool.sort((a, b) => b.finalScore - a.finalScore);

  const selected: GeneratedPick[] = [];
  const usedPbs = new Set<number>();
  const usedNumbers = new Map<number, number>();

  for (const candidate of candidatePool) {
    if (selected.length >= count) break;

    let overlapPenalty = 0;
    for (const n of candidate.numbers) {
      overlapPenalty += (usedNumbers.get(n) || 0) * 2;
    }
    if (usedPbs.has(candidate.powerball)) overlapPenalty += 5;

    const diversityScore = candidate.finalScore - overlapPenalty;
    if (selected.length > 0 && diversityScore < candidate.finalScore * 0.3) continue;

    selected.push(candidate);
    usedPbs.add(candidate.powerball);
    for (const n of candidate.numbers) {
      usedNumbers.set(n, (usedNumbers.get(n) || 0) + 1);
    }
  }

  while (selected.length < count && candidatePool.length > selected.length) {
    const remaining = candidatePool.filter(c => !selected.includes(c));
    if (remaining.length === 0) break;
    selected.push(remaining[0]);
  }

  return selected.map((c, i) => ({ ...c, rank: i + 1 }));
}

function generateAntiPopularCards(count: number): GeneratedPick[] {
  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 100 && candidates.length < count * 5; attempt++) {
    const card = generateRandomCard();
    const pb = Math.floor(Math.random() * 13) + 8;
    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    candidates.push({
      rank: 0,
      numbers: card,
      powerball: pb,
      drawFit: 0,
      antiPop: Math.round(antiPop),
      finalScore: Math.round(antiPop * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

function generateStructureMatchedCards(draws: Draw[], count: number): GeneratedPick[] {
  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
  }));

  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 50 && candidates.length < count * 3; attempt++) {
    const card = generateStructureMatchedCard(draws);
    const pb = Math.floor(Math.random() * 20) + 1;
    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const drawFit = computeDrawFitScore(card, scored);
    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const finalScore = (drawFit * 60 + antiPop * 40) / 100;

    candidates.push({
      rank: 0,
      numbers: card,
      powerball: pb,
      drawFit: Math.round(drawFit),
      antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

function generateLeastDrawnCards(draws: Draw[], windowSize: number, count: number): GeneratedPick[] {
  const window = draws.slice(0, Math.min(windowSize, draws.length));
  if (window.length === 0) return [];

  const mainCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if ((window[i].numbers as number[]).includes(n)) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    mainCounts.push({ number: n, count, lastSeen });
  }
  mainCounts.sort((a, b) => a.count - b.count || b.lastSeen - a.lastSeen || a.number - b.number);

  const pbCounts: { number: number; count: number; lastSeen: number }[] = [];
  for (let n = 1; n <= 20; n++) {
    let count = 0;
    let lastSeen = window.length;
    for (let i = 0; i < window.length; i++) {
      if (window[i].powerball === n) {
        count++;
        if (i < lastSeen) lastSeen = i;
      }
    }
    pbCounts.push({ number: n, count, lastSeen });
  }
  pbCounts.sort((a, b) => a.count - b.count || b.lastSeen - a.lastSeen || a.number - b.number);

  const mainPool = Math.min(18, mainCounts.length);
  const pbPool = Math.min(10, pbCounts.length);
  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 30 && candidates.length < count; attempt++) {
    let card: number[];
    let pb: number;

    if (attempt === 0) {
      card = mainCounts.slice(0, 7).map(m => m.number).sort((a, b) => a - b);
      pb = pbCounts[0]?.number ?? 1;
    } else {
      const poolSlice = mainCounts.slice(0, mainPool);
      const weights = poolSlice.map((m, i) => ({ number: m.number, score: mainPool - i + (mainPool - m.count) }));
      card = weightedSample(weights, 7);
      const pbIdx = Math.floor(Math.random() * Math.min(pbPool, pbCounts.length));
      pb = pbCounts[pbIdx]?.number ?? 1;
    }

    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const topMainSet = new Set(mainCounts.slice(0, 7).map(m => m.number));
    const overlapCount = card.filter(n => topMainSet.has(n)).length;
    const drawFit = Math.round((overlapCount / 7) * 100);
    const finalScore = (drawFit * 60 + antiPop * 40) / 100;

    candidates.push({
      rank: 0,
      numbers: card,
      powerball: pb,
      drawFit,
      antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

function generateStructureAwareCard(draws: Draw[]): number[] {
  if (draws.length < 5) return generateRandomCard();

  let avgOdd = 0;
  let avgSum = 0;
  const sampleSize = Math.min(draws.length, 50);
  for (let i = 0; i < sampleSize; i++) {
    const nums = draws[i].numbers as number[];
    avgOdd += nums.filter(n => n % 2 !== 0).length;
    avgSum += nums.reduce((a, b) => a + b, 0);
  }
  avgOdd = Math.round(avgOdd / sampleSize);
  avgSum = Math.round(avgSum / sampleSize);

  for (let attempt = 0; attempt < 100; attempt++) {
    const card = generateRandomCard();
    const odd = card.filter(n => n % 2 !== 0).length;
    const sum = card.reduce((a, b) => a + b, 0);
    if (Math.abs(odd - avgOdd) <= 1 && Math.abs(sum - avgSum) <= 20) {
      return card;
    }
  }
  return generateRandomCard();
}

function getPbFreqs(draws: Draw[]): Record<number, number> {
  const freqs: Record<number, number> = {};
  draws.forEach(d => { freqs[d.powerball] = (freqs[d.powerball] || 0) + 1; });
  return freqs;
}

function topPb(freqs: Record<number, number>): number {
  const entries = Object.entries(freqs).sort(([, a], [, b]) => b - a);
  return entries.length > 0 ? Number(entries[0][0]) : 1;
}

function generateRandomCard(): number[] {
  const pool = Array.from({ length: 35 }, (_, i) => i + 1);
  const picked: number[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked.sort((a, b) => a - b);
}

// ═══════════════════════════════════════════
// Engine C: Pick Generator
// ═══════════════════════════════════════════

export function scoreAntiPopularity(numbers: number[], powerball: number): { score: number; breakdown: AntiPopularityBreakdown } {
  let birthdayPenalty = 0;
  let sequencePenalty = 0;
  let repeatedEndingPenalty = 0;
  let aestheticPenalty = 0;
  let lowPowerballPenalty = 0;

  const birthdayCount = numbers.filter(n => n <= 31).length;
  if (birthdayCount >= 6) birthdayPenalty = 25;
  else if (birthdayCount >= 5) birthdayPenalty = 20;
  else if (birthdayCount >= 4) birthdayPenalty = 10;

  const sorted = [...numbers].sort((a, b) => a - b);
  let maxConsecutive = 1;
  let currentRun = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 1) { currentRun++; maxConsecutive = Math.max(maxConsecutive, currentRun); }
    else currentRun = 1;
  }
  if (maxConsecutive >= 4) sequencePenalty = 25;
  else if (maxConsecutive >= 3) sequencePenalty = 15;

  const endings = numbers.map(n => n % 10);
  const endingCounts: Record<number, number> = {};
  endings.forEach(e => { endingCounts[e] = (endingCounts[e] || 0) + 1; });
  const maxEnding = Math.max(...Object.values(endingCounts));
  if (maxEnding >= 4) repeatedEndingPenalty = 15;
  else if (maxEnding >= 3) repeatedEndingPenalty = 10;

  const isAesthetic = sorted.every((n, i) => i === 0 || sorted[i] - sorted[i - 1] === sorted[1] - sorted[0]);
  if (isAesthetic && sorted.length > 2) aestheticPenalty = 25;

  if (powerball <= 7) lowPowerballPenalty = 5;

  const totalPenalty = birthdayPenalty + sequencePenalty + repeatedEndingPenalty + aestheticPenalty + lowPowerballPenalty;
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  return {
    score,
    breakdown: {
      birthdayPenalty,
      sequencePenalty,
      repeatedEndingPenalty,
      aestheticPenalty,
      lowPowerballPenalty,
    },
  };
}

export function generateSmoothedCards(draws: Draw[], windowSize: number, count: number): GeneratedPick[] {
  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();
  const basePick = buildSmoothedPick(draws, windowSize);

  for (let attempt = 0; attempt < count * 30 && candidates.length < count; attempt++) {
    let card: number[];
    let pb: number;

    if (attempt === 0) {
      card = basePick.picks;
      pb = basePick.pb;
    } else {
      const window = draws.slice(0, Math.min(windowSize, draws.length));
      const uniform = 1 / 35;
      const alpha = 0.3;
      const smoothed: { number: number; score: number }[] = [];
      for (let n = 1; n <= 35; n++) {
        const count_ = window.filter(d => (d.numbers as number[]).includes(n)).length;
        const observed = count_ / Math.max(window.length, 1);
        smoothed.push({ number: n, score: alpha * uniform + (1 - alpha) * observed });
      }
      card = weightedSample(smoothed.map(s => ({ number: s.number, score: s.score * 1000 })), 7);
      const pbFreqs = getPbFreqs(window);
      const pbEntries = Object.entries(pbFreqs).sort(([, a], [, b]) => b - a);
      pb = pbEntries.length > 0 ? Number(pbEntries[Math.floor(Math.random() * Math.min(5, pbEntries.length))][0]) : Math.floor(Math.random() * 20) + 1;
    }

    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const overlap = card.filter(n => basePick.picks.includes(n)).length;
    const drawFit = Math.round((overlap / 7) * 100);
    const finalScore = (drawFit * 60 + antiPop * 40) / 100;

    candidates.push({
      rank: 0, numbers: card, powerball: pb,
      drawFit, antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

export function generateRecencySmoothedCards(draws: Draw[], count: number): GeneratedPick[] {
  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();
  const basePick = buildRecencySmoothedPick(draws);

  for (let attempt = 0; attempt < count * 30 && candidates.length < count; attempt++) {
    let card: number[];
    let pb: number;

    if (attempt === 0) {
      card = basePick.picks;
      pb = basePick.pb;
    } else {
      const uniform = 1 / 35;
      const alpha = 0.3;
      const scored: { number: number; score: number }[] = [];
      for (let n = 1; n <= 35; n++) {
        let dss = draws.length;
        for (let i = 0; i < draws.length; i++) {
          if ((draws[i].numbers as number[]).includes(n)) { dss = i; break; }
        }
        const rec = 1 - (dss / draws.length);
        scored.push({ number: n, score: (alpha * uniform + (1 - alpha) * rec) * 1000 });
      }
      card = weightedSample(scored, 7);
      pb = draws[0]?.powerball || Math.floor(Math.random() * 20) + 1;
    }

    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const overlap = card.filter(n => basePick.picks.includes(n)).length;
    const drawFit = Math.round((overlap / 7) * 100);
    const finalScore = (drawFit * 60 + antiPop * 40) / 100;

    candidates.push({
      rank: 0, numbers: card, powerball: pb,
      drawFit, antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

export function generateStrategyPortfolio(draws: Draw[], count: number = 10, allocationMethod: "equal" | "validation_weighted" = "equal"): GeneratedPick[] {
  const categories: { label: string; fn: (train: Draw[]) => { picks: number[]; pb: number }; slots: number }[] = [
    { label: "Most Drawn (All-Time)", fn: (t) => buildMostDrawnPick(t, t.length), slots: 2 },
    { label: "Smoothed Most Drawn (L50)", fn: (t) => buildSmoothedPick(t, 50), slots: 1 },
    { label: "Recency Smoothed", fn: (t) => buildRecencySmoothedPick(t), slots: 1 },
    { label: "Structure-Matched Random", fn: (t) => ({ picks: generateStructureMatchedCard(t), pb: Math.floor(Math.random() * 20) + 1 }), slots: 2 },
    { label: "Anti-Popular Only", fn: () => generateAntiPopularPick(), slots: 2 },
    { label: "Composite", fn: (t) => {
      const freqs = computeNumberFrequencies(t);
      const scored = freqs.map(f => ({ number: f.number, score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2 }));
      const sorted = [...scored].sort((a, b) => b.score - a.score);
      return { picks: sorted.slice(0, 7).map(f => f.number).sort((a, b) => a - b), pb: topPb(getPbFreqs(t.slice(0, 25))) };
    }, slots: 1 },
    { label: "Random Baseline", fn: () => ({ picks: generateRandomCard(), pb: Math.floor(Math.random() * 20) + 1 }), slots: 1 },
  ];

  if (allocationMethod === "validation_weighted" && latestBenchmarkResult) {
    const stabilities = latestBenchmarkResult.stabilityByStrategy;
    for (const cat of categories) {
      const stability = stabilities.find(s => s.strategy === cat.label);
      if (stability) {
        if (stability.stabilityClass === "possible_edge") cat.slots = Math.min(cat.slots + 1, 3);
        else if (stability.stabilityClass === "underperforming") cat.slots = Math.max(cat.slots - 1, 0);
      }
    }
  }

  const totalSlots = categories.reduce((s, c) => s + c.slots, 0);
  const scaleFactor = count / totalSlots;
  let allocated = 0;
  for (const cat of categories) {
    cat.slots = Math.max(1, Math.round(cat.slots * scaleFactor));
    allocated += cat.slots;
  }
  while (allocated > count) { categories[categories.length - 1].slots--; allocated--; }
  while (allocated < count) { categories[0].slots++; allocated++; }

  const allCandidates: GeneratedPick[] = [];
  const seen = new Set<string>();
  const usedNumbers = new Map<number, number>();

  for (const cat of categories) {
    for (let i = 0; i < cat.slots; i++) {
      let bestPick: GeneratedPick | null = null;
      let bestDiversityScore = -Infinity;

      for (let attempt = 0; attempt < 20; attempt++) {
        const { picks, pb } = cat.fn(draws);
        const key = picks.join(",") + ":" + pb;
        if (seen.has(key)) continue;

        let overlapPenalty = 0;
        for (const n of picks) overlapPenalty += (usedNumbers.get(n) || 0) * 3;

        const { score: antiPop, breakdown } = scoreAntiPopularity(picks, pb);
        const freqs = computeNumberFrequencies(draws);
        const scored = freqs.map(f => ({ number: f.number, score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2 }));
        const drawFit = computeDrawFitScore(picks, scored);
        const finalScore = (drawFit * 50 + antiPop * 50) / 100;
        const diversityScore = finalScore - overlapPenalty;

        if (diversityScore > bestDiversityScore) {
          bestDiversityScore = diversityScore;
          bestPick = {
            rank: 0, numbers: picks, powerball: pb,
            drawFit: Math.round(drawFit), antiPop: Math.round(antiPop),
            finalScore: Math.round(finalScore * 10) / 10,
            antiPopBreakdown: breakdown,
            sourceStrategy: cat.label,
          };
        }
      }

      if (bestPick) {
        seen.add(bestPick.numbers.join(",") + ":" + bestPick.powerball);
        for (const n of bestPick.numbers) usedNumbers.set(n, (usedNumbers.get(n) || 0) + 1);
        allCandidates.push(bestPick);
      }
    }
  }

  allCandidates.sort((a, b) => b.finalScore - a.finalScore);
  return allCandidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

export { generateMostDrawnCards, generateAntiPopularCards, generateDiverseCards, generateStructureMatchedCards, generateLeastDrawnCards };

export function generateRankedPicks(
  draws: Draw[],
  count: number = 10,
  drawFitWeight: number = 60,
  antiPopWeight: number = 40
): GeneratedPick[] {
  if (draws.length === 0) return [];

  const freqs = computeNumberFrequencies(draws);
  const scored = freqs.map(f => ({
    number: f.number,
    score: f.last25Freq * 2 + f.last10Freq * 3 - f.drawsSinceSeen * 0.5 + f.rollingTrend * 2,
  }));

  const pbFreqs = getPbFreqs(draws.slice(0, 50));

  const candidates: GeneratedPick[] = [];
  const seen = new Set<string>();

  for (let attempt = 0; attempt < count * 30 && candidates.length < count; attempt++) {
    let card: number[];
    let pb: number;

    if (attempt % 4 === 0) {
      card = weightedSample(scored, 7);
      const pbEntries = Object.entries(pbFreqs).sort(([, a], [, b]) => b - a);
      pb = pbEntries.length > 0 ? Number(pbEntries[Math.floor(Math.random() * Math.min(5, pbEntries.length))][0]) : Math.floor(Math.random() * 20) + 1;
    } else if (attempt % 4 === 1) {
      const topNumbers = [...scored].sort((a, b) => b.score - a.score).slice(0, 15);
      card = weightedSample(topNumbers, 7);
      pb = Math.floor(Math.random() * 20) + 1;
    } else if (attempt % 4 === 2) {
      card = generateStructureAwareCard(draws);
      pb = Math.floor(Math.random() * 20) + 1;
    } else {
      card = generateRandomCard();
      pb = Math.floor(Math.random() * 20) + 1;
    }

    const key = card.join(",") + ":" + pb;
    if (seen.has(key)) continue;
    seen.add(key);

    const drawFit = computeDrawFitScore(card, scored);
    const { score: antiPop, breakdown } = scoreAntiPopularity(card, pb);
    const finalScore = (drawFit * drawFitWeight + antiPop * antiPopWeight) / 100;

    candidates.push({
      rank: 0,
      numbers: card,
      powerball: pb,
      drawFit: Math.round(drawFit),
      antiPop: Math.round(antiPop),
      finalScore: Math.round(finalScore * 10) / 10,
      antiPopBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.finalScore - a.finalScore);
  return candidates.slice(0, count).map((c, i) => ({ ...c, rank: i + 1 }));
}

function weightedSample(scored: { number: number; score: number }[], count: number): number[] {
  const minScore = Math.min(...scored.map(s => s.score));
  const adjusted = scored.map(s => ({ ...s, weight: s.score - minScore + 1 }));
  const picked: number[] = [];
  const available = [...adjusted];

  for (let i = 0; i < count && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, s) => sum + s.weight, 0);
    let r = Math.random() * totalWeight;
    let selectedIdx = 0;
    for (let j = 0; j < available.length; j++) {
      r -= available[j].weight;
      if (r <= 0) { selectedIdx = j; break; }
    }
    picked.push(available[selectedIdx].number);
    available.splice(selectedIdx, 1);
  }

  return picked.sort((a, b) => a - b);
}

function computeDrawFitScore(card: number[], scored: { number: number; score: number }[]): number {
  const scoreMap = new Map(scored.map(s => [s.number, s.score]));
  const maxPossible = [...scored].sort((a, b) => b.score - a.score).slice(0, 7).reduce((sum, s) => sum + s.score, 0);
  const actual = card.reduce((sum, n) => sum + (scoreMap.get(n) || 0), 0);
  if (maxPossible <= 0) return 50;
  return Math.min(100, Math.max(0, (actual / maxPossible) * 100));
}
