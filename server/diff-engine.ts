import type { GeneratedPick, PredictionDiffSummary, LineDiffMapping, PredictionDiffResult, PredictionSet } from "@shared/schema";

function jaccard(setA: Set<number>, setB: Set<number>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const v of setA) {
    if (setB.has(v)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

function computeSetLevelMetrics(
  prevLines: GeneratedPick[],
  currLines: GeneratedPick[]
): PredictionDiffSummary {
  const prevMains = new Set(prevLines.flatMap(l => l.numbers));
  const currMains = new Set(currLines.flatMap(l => l.numbers));
  const prevPBs = new Set(prevLines.map(l => l.powerball));
  const currPBs = new Set(currLines.map(l => l.powerball));

  const mainsOverlapRatio = jaccard(prevMains, currMains);
  const pbOverlapRatio = jaccard(prevPBs, currPBs);

  return {
    mainsPercentChanged: Math.round(100 * (1 - mainsOverlapRatio)),
    pbPercentChanged: Math.round(100 * (1 - pbOverlapRatio)),
    mainsOverlapRatio: Math.round(mainsOverlapRatio * 1000) / 1000,
    pbOverlapRatio: Math.round(pbOverlapRatio * 1000) / 1000,
    newMains: [...currMains].filter(n => !prevMains.has(n)).sort((a, b) => a - b),
    removedMains: [...prevMains].filter(n => !currMains.has(n)).sort((a, b) => a - b),
    newPBs: [...currPBs].filter(n => !prevPBs.has(n)).sort((a, b) => a - b),
    removedPBs: [...prevPBs].filter(n => !currPBs.has(n)).sort((a, b) => a - b),
  };
}

interface PairCandidate {
  currentIndex: number;
  prevIndex: number;
  score: number;
  mainOverlap: number;
  pbMatch: boolean;
}

function computeStableLineMapping(
  prevLines: GeneratedPick[],
  currLines: GeneratedPick[],
  mainCount: number
): LineDiffMapping[] {
  const candidates: PairCandidate[] = [];

  for (let ci = 0; ci < currLines.length; ci++) {
    const currSet = new Set(currLines[ci].numbers);
    for (let pi = 0; pi < prevLines.length; pi++) {
      const prevSet = new Set(prevLines[pi].numbers);
      let mainOverlap = 0;
      for (const n of currSet) {
        if (prevSet.has(n)) mainOverlap++;
      }
      const pbMatch = currLines[ci].powerball === prevLines[pi].powerball;
      const score = mainOverlap * 10 + (pbMatch ? 2 : 0);
      candidates.push({ currentIndex: ci, prevIndex: pi, score, mainOverlap, pbMatch });
    }
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.mainOverlap !== a.mainOverlap) return b.mainOverlap - a.mainOverlap;
    if (a.pbMatch !== b.pbMatch) return a.pbMatch ? -1 : 1;
    if (a.prevIndex !== b.prevIndex) return a.prevIndex - b.prevIndex;
    return a.currentIndex - b.currentIndex;
  });

  const assignedCurrent = new Set<number>();
  const assignedPrev = new Set<number>();
  const mapping: LineDiffMapping[] = [];

  for (const c of candidates) {
    if (assignedCurrent.has(c.currentIndex) || assignedPrev.has(c.prevIndex)) continue;
    assignedCurrent.add(c.currentIndex);
    assignedPrev.add(c.prevIndex);

    const currNums = new Set(currLines[c.currentIndex].numbers);
    const prevNums = new Set(prevLines[c.prevIndex].numbers);

    mapping.push({
      currentIndex: c.currentIndex,
      previousIndex: c.prevIndex,
      mainOverlap: c.mainOverlap,
      pbMatch: c.pbMatch,
      keptMains: [...currNums].filter(n => prevNums.has(n)).sort((a, b) => a - b),
      addedMains: [...currNums].filter(n => !prevNums.has(n)).sort((a, b) => a - b),
      removedMains: [...prevNums].filter(n => !currNums.has(n)).sort((a, b) => a - b),
      pbChanged: !c.pbMatch,
      linePercentChanged: Math.round(100 * (1 - c.mainOverlap / mainCount)),
    });
  }

  for (let ci = 0; ci < currLines.length; ci++) {
    if (!assignedCurrent.has(ci)) {
      const currNums = currLines[ci].numbers;
      mapping.push({
        currentIndex: ci,
        previousIndex: -1,
        mainOverlap: 0,
        pbMatch: false,
        keptMains: [],
        addedMains: [...currNums].sort((a, b) => a - b),
        removedMains: [],
        pbChanged: true,
        linePercentChanged: 100,
      });
    }
  }

  mapping.sort((a, b) => a.currentIndex - b.currentIndex);
  return mapping;
}

export function diffPredictionSets(
  prevLines: GeneratedPick[],
  currLines: GeneratedPick[],
  mainCount: number
): { summary: PredictionDiffSummary; lineMapping: LineDiffMapping[] } {
  const summary = computeSetLevelMetrics(prevLines, currLines);
  const lineMapping = computeStableLineMapping(prevLines, currLines, mainCount);
  return { summary, lineMapping };
}

export function buildDiffResult(
  prevSet: PredictionSet,
  currLines: GeneratedPick[],
  mainCount: number
): PredictionDiffResult {
  const prevLines = prevSet.linesJson as GeneratedPick[];
  const { summary, lineMapping } = diffPredictionSets(prevLines, currLines, mainCount);
  return {
    summary,
    lineMapping,
    previousSetId: prevSet.id,
    previousGeneratedAt: prevSet.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}
