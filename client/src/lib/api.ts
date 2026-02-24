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

async function fetchApi(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (json.ok !== undefined) return json.data;
  return json;
}

export { fetchApi };
