import {
  type Draw,
  type FormulaFeatureConfig,
  type FormulaWeights,
  type FormulaOptimizerConfig,
  type FormulaCandidateResult,
  type FormulaOverfitRisk,
  type FormulaReplayWindow,
  type FormulaReplayResult,
  type FormulaPermutationResult,
  type FormulaLabResult,
  type StabilityClass,
} from "@shared/schema";
import { computeNumberFrequencies, scoreAntiPopularity } from "./analysis";

const DEFAULT_FEATURES: FormulaFeatureConfig = {
  freqTotal: true,
  freqL50: true,
  freqL20: false,
  recencySinceSeen: true,
  trendL10: true,
  structureFit: true,
  carryoverAffinity: true,
  antiPopularity: false,
};

const DEFAULT_WEIGHTS: FormulaWeights = {
  freqTotal: 1, freqL50: 2, freqL20: 0,
  recencySinceSeen: -0.5, trendL10: 2,
  structureFit: 1, carryoverAffinity: 0.5, antiPopularity: 0,
};

const WEIGHT_RANGES: Record<keyof FormulaWeights, [number, number]> = {
  freqTotal: [0, 5],
  freqL50: [0, 5],
  freqL20: [0, 5],
  recencySinceSeen: [-3, 0],
  trendL10: [0, 5],
  structureFit: [0, 3],
  carryoverAffinity: [0, 3],
  antiPopularity: [0, 3],
};

const CAVEATS = {
  retrospective: "A formula can fit historical draws in hindsight. Only walk-forward replay and benchmark comparison indicate whether the relationship generalizes.",
  noGuarantee: "Results are experimental statistical analysis and do not guarantee future outcomes.",
  significance: "Any apparent edge should be tested against random baselines and permutation/Monte Carlo controls.",
  dataScope: "Results depend on the selected date range, rule era, and data quality.",
};

function computeNumberFeatures(
  number: number,
  trainDraws: Draw[],
  features: FormulaFeatureConfig
): Record<string, number> {
  const result: Record<string, number> = {};
  const freqs = computeNumberFrequencies(trainDraws);
  const f = freqs.find(fr => fr.number === number);
  if (!f) return result;

  if (features.freqTotal) result.freqTotal = f.totalFreq / Math.max(trainDraws.length, 1);
  if (features.freqL50) result.freqL50 = f.last50Freq / Math.min(50, trainDraws.length);
  if (features.freqL20) {
    const last20 = trainDraws.slice(0, Math.min(20, trainDraws.length));
    result.freqL20 = last20.filter(d => (d.numbers as number[]).includes(number)).length / Math.max(last20.length, 1);
  }
  if (features.recencySinceSeen) result.recencySinceSeen = f.drawsSinceSeen / Math.max(trainDraws.length, 1);
  if (features.trendL10) result.trendL10 = f.rollingTrend;

  return result;
}

function computeCardFeatures(
  card: number[],
  trainDraws: Draw[],
  features: FormulaFeatureConfig
): Record<string, number> {
  const result: Record<string, number> = {};

  if (features.structureFit) {
    const sampleSize = Math.min(trainDraws.length, 50);
    let avgOdd = 0, avgSum = 0;
    for (let i = 0; i < sampleSize; i++) {
      const nums = trainDraws[i].numbers as number[];
      avgOdd += nums.filter(n => n % 2 !== 0).length;
      avgSum += nums.reduce((a, b) => a + b, 0);
    }
    avgOdd /= sampleSize;
    avgSum /= sampleSize;
    const cardOdd = card.filter(n => n % 2 !== 0).length;
    const cardSum = card.reduce((a, b) => a + b, 0);
    const oddDiff = Math.abs(cardOdd - avgOdd);
    const sumDiff = Math.abs(cardSum - avgSum) / 20;
    result.structureFit = Math.max(0, 1 - (oddDiff + sumDiff) / 3);
  }

  if (features.carryoverAffinity && trainDraws.length >= 1) {
    const prevNums = trainDraws[0].numbers as number[];
    const overlap = card.filter(n => prevNums.includes(n)).length;
    result.carryoverAffinity = overlap / 7;
  }

  if (features.antiPopularity) {
    const pb = Math.floor(Math.random() * 20) + 1;
    const { score } = scoreAntiPopularity(card, pb);
    result.antiPopularity = score / 100;
  }

  return result;
}

function scoreNumber(number: number, trainDraws: Draw[], weights: FormulaWeights, features: FormulaFeatureConfig): number {
  const feats = computeNumberFeatures(number, trainDraws, features);
  let score = 0;
  const weightKeys = Object.keys(feats) as (keyof FormulaWeights)[];
  for (const key of weightKeys) {
    score += (feats[key] || 0) * (weights[key] || 0);
  }
  return score;
}

function generateFormulaCard(trainDraws: Draw[], weights: FormulaWeights, features: FormulaFeatureConfig): { picks: number[]; pb: number } {
  const scored: { number: number; score: number }[] = [];
  for (let n = 1; n <= 35; n++) {
    scored.push({ number: n, score: scoreNumber(n, trainDraws, weights, features) });
  }
  scored.sort((a, b) => b.score - a.score);
  const picks = scored.slice(0, 7).map(s => s.number).sort((a, b) => a - b);

  const pbScores: { number: number; score: number }[] = [];
  const pbFreqs: Record<number, number> = {};
  const pb50 = trainDraws.slice(0, Math.min(50, trainDraws.length));
  pb50.forEach(d => { pbFreqs[d.powerball] = (pbFreqs[d.powerball] || 0) + 1; });
  for (let n = 1; n <= 20; n++) {
    pbScores.push({ number: n, score: pbFreqs[n] || 0 });
  }
  pbScores.sort((a, b) => b.score - a.score);
  const pb = pbScores[0]?.number ?? 1;

  return { picks, pb };
}

function evaluateFormula(
  trainDraws: Draw[],
  testDraws: Draw[],
  weights: FormulaWeights,
  features: FormulaFeatureConfig
): { avgMainMatches: number; bestMainMatches: number; pbHits: number } {
  let totalMain = 0;
  let bestMain = 0;
  let pbHits = 0;

  for (const testDraw of testDraws) {
    const actual = testDraw.numbers as number[];
    const actualPB = testDraw.powerball;
    const { picks, pb } = generateFormulaCard(trainDraws, weights, features);
    const mainMatches = picks.filter(n => actual.includes(n)).length;
    totalMain += mainMatches;
    bestMain = Math.max(bestMain, mainMatches);
    if (pb === actualPB) pbHits++;
  }

  return {
    avgMainMatches: testDraws.length > 0 ? totalMain / testDraws.length : 0,
    bestMainMatches: bestMain,
    pbHits,
  };
}

function randomWeights(features: FormulaFeatureConfig): FormulaWeights {
  const w: FormulaWeights = { ...DEFAULT_WEIGHTS };
  const keys = Object.keys(WEIGHT_RANGES) as (keyof FormulaWeights)[];
  for (const key of keys) {
    const featureKey = key as keyof FormulaFeatureConfig;
    if (!features[featureKey]) {
      w[key] = 0;
      continue;
    }
    const [min, max] = WEIGHT_RANGES[key];
    w[key] = Number((min + Math.random() * (max - min)).toFixed(2));
  }
  return w;
}

function computeComplexityPenalty(weights: FormulaWeights, features: FormulaFeatureConfig, strength: number): number {
  let activeCount = 0;
  let totalMagnitude = 0;
  const keys = Object.keys(weights) as (keyof FormulaWeights)[];
  for (const key of keys) {
    const featureKey = key as keyof FormulaFeatureConfig;
    if (features[featureKey] && weights[key] !== 0) {
      activeCount++;
      totalMagnitude += Math.abs(weights[key]);
    }
  }
  return strength * (activeCount * 0.1 + totalMagnitude * 0.02);
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

export function runFormulaOptimizer(
  draws: Draw[],
  config: FormulaOptimizerConfig
): FormulaLabResult {
  const allCaveats = [CAVEATS.retrospective, CAVEATS.noGuarantee, CAVEATS.significance, CAVEATS.dataScope];

  if (draws.length < 50) {
    return {
      config,
      topCandidates: [],
      bestWeights: DEFAULT_WEIGHTS,
      retrospectiveFit: { inSampleScore: 0, complexityPenalty: 0, adjustedScore: 0, trainDrawsUsed: draws.length },
      walkForwardReplay: null,
      permutationTest: null,
      overfitRisk: "inconclusive",
      caveatedVerdict: "Insufficient data for formula optimization (need 50+ modern draws).",
      caveats: allCaveats,
      benchmarkComparison: [],
      timestamp: new Date().toISOString(),
    };
  }

  const trainSize = Math.min(config.trainingWindowSize, Math.floor(draws.length * 0.8));
  const testDraws = draws.slice(0, draws.length - trainSize);
  const trainDraws = draws.slice(draws.length - trainSize);

  const candidates: FormulaCandidateResult[] = [];

  for (let i = 0; i < config.searchIterations; i++) {
    const weights = randomWeights(config.features);
    const eval_ = evaluateFormula(trainDraws, trainDraws.slice(0, Math.min(30, trainDraws.length)), weights, config.features);
    const complexityPenalty = computeComplexityPenalty(weights, config.features, config.regularizationStrength);
    const inSampleScore = eval_.avgMainMatches;
    const adjustedScore = Number((inSampleScore - complexityPenalty).toFixed(4));

    const breakdown: Record<string, number> = {};
    const wKeys = Object.keys(weights) as (keyof FormulaWeights)[];
    for (const key of wKeys) {
      if (config.features[key as keyof FormulaFeatureConfig] && weights[key] !== 0) {
        breakdown[key] = weights[key];
      }
    }

    candidates.push({
      rank: 0,
      weights: { ...weights },
      inSampleScore: Number(inSampleScore.toFixed(4)),
      complexityPenalty: Number(complexityPenalty.toFixed(4)),
      adjustedScore,
      scoreBreakdown: breakdown,
    });
  }

  candidates.sort((a, b) => b.adjustedScore - a.adjustedScore);
  const topCandidates = candidates.slice(0, 5).map((c, i) => ({ ...c, rank: i + 1 }));
  const bestWeights = topCandidates[0].weights;

  const replayWindowSizes = [20, 40, 60, 100].filter(w => draws.length >= w + 50);
  let replay: FormulaReplayResult | null = null;

  if (replayWindowSizes.length > 0) {
    const windows: FormulaReplayWindow[] = [];

    for (const windowSize of replayWindowSizes) {
      const wTestDraws = draws.slice(0, windowSize);
      const wTrainDraws = draws.slice(windowSize);

      const formulaEval = evaluateFormula(wTrainDraws, wTestDraws, bestWeights, config.features);

      let randomTotal = 0;
      let randomPbHits = 0;
      for (const td of wTestDraws) {
        const actual = td.numbers as number[];
        const randomCard = generateRandomCard();
        randomTotal += randomCard.filter(n => actual.includes(n)).length;
        if (Math.floor(Math.random() * 20) + 1 === td.powerball) randomPbHits++;
      }
      const randomAvg = randomTotal / wTestDraws.length;
      const delta = Number((formulaEval.avgMainMatches - randomAvg).toFixed(3));

      windows.push({
        windowSize,
        testDraws: windowSize,
        trainDraws: wTrainDraws.length,
        avgMainMatches: Number(formulaEval.avgMainMatches.toFixed(2)),
        bestMainMatches: formulaEval.bestMainMatches,
        pbHitRate: Number(((formulaEval.pbHits / windowSize) * 100).toFixed(1)),
        deltaVsRandom: Number(delta.toFixed(2)),
        beatsRandom: delta > 0,
      });
    }

    const windowsBeating = windows.filter(w => w.deltaVsRandom > 0.05).length;
    const windowsLosing = windows.filter(w => w.deltaVsRandom < -0.05).length;
    const overallAvgDelta = Number((windows.reduce((s, w) => s + w.deltaVsRandom, 0) / windows.length).toFixed(3));

    let stability: StabilityClass;
    if (windowsBeating >= 3 && windowsLosing === 0) stability = "possible_edge";
    else if (windowsBeating >= 2) stability = "weak_edge";
    else if (windowsLosing > windowsBeating && overallAvgDelta < -0.1) stability = "underperforming";
    else stability = "no_edge";

    replay = { windows, overallAvgDelta, windowsBeating, windowsLosing, stability };
  }

  let permutation: FormulaPermutationResult | null = null;
  if (replay && replay.windows.length > 0) {
    const observedDelta = replay.overallAvgDelta;
    const permDeltas: number[] = [];
    const permCount = 100;

    for (let p = 0; p < permCount; p++) {
      const shuffledDraws = [...draws];
      for (let i = shuffledDraws.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmpNums = shuffledDraws[i].numbers;
        const tmpPb = shuffledDraws[i].powerball;
        (shuffledDraws[i] as any).numbers = shuffledDraws[j].numbers;
        (shuffledDraws[i] as any).powerball = shuffledDraws[j].powerball;
        (shuffledDraws[j] as any).numbers = tmpNums;
        (shuffledDraws[j] as any).powerball = tmpPb;
      }

      const ws = replay.windows[0].windowSize;
      const pTest = shuffledDraws.slice(0, ws);
      const pTrain = shuffledDraws.slice(ws);
      const pEval = evaluateFormula(pTrain, pTest, bestWeights, config.features);

      let pRandTotal = 0;
      for (const td of pTest) {
        const actual = td.numbers as number[];
        pRandTotal += generateRandomCard().filter(n => actual.includes(n)).length;
      }
      const pRandAvg = pRandTotal / pTest.length;
      permDeltas.push(pEval.avgMainMatches - pRandAvg);
    }

    const permMean = permDeltas.reduce((s, d) => s + d, 0) / permDeltas.length;
    const permStd = Math.sqrt(permDeltas.reduce((s, d) => s + Math.pow(d - permMean, 2), 0) / permDeltas.length);
    const betterCount = permDeltas.filter(d => d >= observedDelta).length;
    const empiricalPValue = Number((betterCount / permCount).toFixed(3));
    const percentile = Math.round(((permCount - betterCount) / permCount) * 100);

    let interpretation: string;
    if (empiricalPValue < 0.05) {
      interpretation = `The observed delta (+${observedDelta.toFixed(3)}) exceeds ${percentile}% of permuted baselines (p=${empiricalPValue}). This suggests the formula's performance is unlikely to be purely due to chance, though further validation is recommended.`;
    } else if (empiricalPValue < 0.20) {
      interpretation = `The observed delta (+${observedDelta.toFixed(3)}) is in the ${percentile}th percentile of permuted baselines (p=${empiricalPValue}). Inconclusive — the result could plausibly arise by chance.`;
    } else {
      interpretation = `The observed delta (+${observedDelta.toFixed(3)}) is within the normal range of permuted baselines (p=${empiricalPValue}). No evidence that the formula's performance exceeds random chance.`;
    }

    permutation = {
      observedDelta: Number(observedDelta.toFixed(3)),
      permutationMean: Number(permMean.toFixed(3)),
      permutationStd: Number(permStd.toFixed(3)),
      empiricalPValue,
      percentile,
      permutationsRun: permCount,
      interpretation,
    };
  }

  const inSampleScore = topCandidates[0].inSampleScore;
  const oosScore = replay?.overallAvgDelta ?? 0;
  const gap = inSampleScore - (oosScore + 1.4);

  let overfitRisk: FormulaOverfitRisk;
  if (gap > 0.5 || (replay && replay.stability === "underperforming")) {
    overfitRisk = "overfit_likely";
  } else if (replay && replay.stability === "possible_edge" && permutation && permutation.empiricalPValue < 0.1) {
    overfitRisk = "possible_signal";
  } else if (replay && replay.stability === "weak_edge") {
    overfitRisk = "weak_signal";
  } else {
    overfitRisk = "inconclusive";
  }

  let caveatedVerdict: string;
  switch (overfitRisk) {
    case "overfit_likely":
      caveatedVerdict = "Strong historical fit, weak replay performance. The optimizer found a formula that explains past draws in-sample, but it did not outperform benchmark strategies in walk-forward replay. This suggests likely overfitting rather than stable predictive signal.";
      break;
    case "weak_signal":
      caveatedVerdict = "Weak/unstable signal. The formula showed small improvements versus random in some windows, but results were inconsistent across replay periods. Treat as experimental and continue testing with permutation/Monte Carlo controls.";
      break;
    case "possible_signal":
      caveatedVerdict = "Possible signal (not confirmed). The formula outperformed random in multiple replay windows, but results remain subject to sampling error and overfitting risk. Validate with additional permutation tests before treating this as a meaningful edge.";
      break;
    default:
      caveatedVerdict = "Inconclusive results. The formula's replay performance does not clearly distinguish it from random chance. This is the expected outcome for lottery data — draws are designed to be random.";
  }

  const benchmarkComparison: { strategy: string; avgDelta: number }[] = [];
  if (replay) {
    benchmarkComparison.push({ strategy: "Formula Lab", avgDelta: replay.overallAvgDelta });
  }

  return {
    config,
    topCandidates,
    bestWeights,
    retrospectiveFit: {
      inSampleScore: topCandidates[0].inSampleScore,
      complexityPenalty: topCandidates[0].complexityPenalty,
      adjustedScore: topCandidates[0].adjustedScore,
      trainDrawsUsed: trainSize,
    },
    walkForwardReplay: replay,
    permutationTest: permutation,
    overfitRisk,
    caveatedVerdict,
    caveats: allCaveats,
    benchmarkComparison,
    timestamp: new Date().toISOString(),
  };
}
