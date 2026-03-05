import { queryClient } from "./queryClient";
import type { GeneratorMode } from "@shared/schema";

function invalidateAll() {
  queryClient.invalidateQueries({ queryKey: ["/api/draws"] });
  queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/frequencies"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/features"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/audit"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/validation"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/structure-profile"] });
  queryClient.invalidateQueries({ queryKey: ["/api/system/overview"] });
  queryClient.invalidateQueries({ queryKey: ["/api/generator/recommendation"] });
}

export async function uploadCSV(file: File, gameId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (gameId) formData.append("gameId", gameId);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Upload failed");
  }
  invalidateAll();
  return json.data;
}

export async function resetData(gameId?: string) {
  const url = gameId ? `/api/draws?gameId=${gameId}` : "/api/draws";
  const res = await fetch(url, { method: "DELETE" });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Reset failed");
  }
  invalidateAll();
  return json.data;
}

export async function generatePicks(mode: GeneratorMode, drawFitWeight: number, antiPopWeight: number, count: number = 10, gameId?: string) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, drawFitWeight, antiPopWeight, count, gameId }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Generation failed");
  }
  return json.data;
}

export interface BenchmarkOptions {
  windowSizes?: number[];
  minTrainDraws?: number;
  benchmarkMode?: "fixed_holdout" | "rolling_walk_forward";
  seed?: number;
  randomBaselineRuns?: number;
  runPermutation?: boolean;
  permutationRuns?: number;
  selectedStrategies?: string[];
  presetName?: string;
  permutationStrategies?: string[];
  regimeSplits?: boolean;
  gameId?: string;
}

export async function runBenchmark(opts: BenchmarkOptions = {}) {
  const res = await fetch("/api/validation/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      windowSizes: opts.windowSizes ?? [20, 40, 60, 100],
      minTrainDraws: opts.minTrainDraws ?? 100,
      benchmarkMode: opts.benchmarkMode ?? "fixed_holdout",
      seed: opts.seed ?? 42,
      randomBaselineRuns: opts.randomBaselineRuns ?? 200,
      runPermutation: opts.runPermutation ?? false,
      permutationRuns: opts.permutationRuns ?? 200,
      selectedStrategies: opts.selectedStrategies,
      presetName: opts.presetName,
      permutationStrategies: opts.permutationStrategies,
      regimeSplits: opts.regimeSplits ?? false,
      gameId: opts.gameId,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Benchmark failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/generator/recommendation"] });
  return json.data;
}

export async function runAutoGenerate(gameId?: string, pbMode?: string) {
  const res = await fetch("/api/auto/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, pbMode }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Auto generate failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/generator/recommendation"] });
  return json.data;
}

export async function runAutoCompositeNoFrequency(gameId?: string, pbMode?: string) {
  const res = await fetch("/api/auto/generate-composite-no-frequency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, pbMode }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Composite No-Frequency generation failed");
  }
  return json.data;
}

export async function runAutoPowerHit(gameId?: string) {
  const res = await fetch("/api/auto/generate-powerhit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "PowerHit generation failed");
  }
  return json.data;
}

export async function runAutoOptimiseAndGenerate(gameId?: string, pbMode?: string) {
  const res = await fetch("/api/auto/optimise-and-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameId, pbMode }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Optimise & generate failed");
  }
  return json.data;
}

export async function syncRSSAll() {
  const res = await fetch("/api/rss-sync-all", { method: "POST" });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Full sync failed");
  }
  invalidateAll();
  return json.data;
}

export async function syncRSS() {
  const res = await fetch("/api/rss-sync", { method: "POST" });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "RSS sync failed");
  }
  invalidateAll();
  return json.data;
}

export async function syncTheLott(gameType: "powerball" | "saturday-lotto") {
  const res = await fetch(`/api/sync/thelott/${gameType}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ maxPages: 1, stopIfSeen: true }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "TheLott sync failed");
  }
  invalidateAll();
  return json.data;
}

export async function fetchRecommendation(gameId?: string) {
  const url = gameId ? `/api/generator/recommendation?gameId=${gameId}` : "/api/generator/recommendation";
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Failed to fetch recommendation");
  }
  return json.data;
}

async function fetchApi(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.ok !== undefined) return json.data;
  return json;
}

export { fetchApi };
