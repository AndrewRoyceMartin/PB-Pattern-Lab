import { queryClient } from "./queryClient";

export async function uploadCSV(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Upload failed");
  }
  queryClient.invalidateQueries({ queryKey: ["/api/draws"] });
  queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/frequencies"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/features"] });
  queryClient.invalidateQueries({ queryKey: ["/api/analysis/validation"] });
  return res.json();
}

export async function generatePicks(drawFitWeight: number, antiPopWeight: number, count: number = 10) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drawFitWeight, antiPopWeight, count }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Generation failed");
  }
  return res.json();
}
