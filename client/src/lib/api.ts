import { queryClient } from "./queryClient";
import type { GeneratorMode } from "@shared/schema";

export async function uploadCSV(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Upload failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/draws"] });
  queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/frequencies"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/features"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/audit"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/validation"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/structure-profile"] });
  return json.data;
}

export async function resetData() {
  const res = await fetch("/api/draws", { method: "DELETE" });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Reset failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/draws"] });
  queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/frequencies"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/features"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/audit"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/validation"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/structure-profile"] });
  return json.data;
}

export async function generatePicks(mode: GeneratorMode, drawFitWeight: number, antiPopWeight: number, count: number = 10) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, drawFitWeight, antiPopWeight, count }),
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
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Benchmark failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/generator/recommendation"] });
  return json.data;
}

export async function runAutoGenerate() {
  const res = await fetch("/api/auto/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.message || "Auto generate failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/generator/recommendation"] });
  return json.data;
}

export async function fetchRecommendation() {
  const res = await fetch("/api/generator/recommendation");
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
