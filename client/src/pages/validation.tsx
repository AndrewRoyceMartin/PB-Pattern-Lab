import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Target, GitCompare, LayoutDashboard, TrendingUp, BarChart3, Info, Play, Loader2, Download, Shield, Beaker, Settings2, History, Eye } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi, runBenchmark } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { ValidationSummary, BenchmarkSummary, BenchmarkRunConfig } from "@shared/schema";

const STRATEGY_DESCRIPTIONS: Record<string, string> = {
  "Random": "Random ensemble baseline — averaged across multiple seeded runs for stability.",
  "Frequency Only": "Picks the 7 most frequently drawn main numbers from all training data.",
  "Recency Only": "Picks numbers that appeared most recently.",
  "Structure-Aware Random": "Random picks filtered to match typical draw structure.",
  "Structure-Aware": "Random picks filtered to match typical draw structure.",
  "Composite Model": "Blends frequency, recency, and trend signals into a weighted score.",
  "Composite": "Blends frequency, recency, and trend signals into a weighted score.",
  "Most Drawn (All-Time)": "Picks the 7 most frequently drawn numbers across the entire dataset.",
  "Most Drawn (Last 50)": "Picks the 7 most frequent numbers from the last 50 draws only.",
  "Most Drawn (Last 100)": "Picks the 7 most frequent numbers from the last 100 draws.",
  "Most Drawn (Last 20)": "Short-window hot numbers — picks the 7 most frequent numbers from only the last 20 draws.",
  "Least Drawn (Last 50)": "Contrarian strategy — picks the 7 least frequently drawn numbers from the last 50 draws.",
  "Structure-Matched Random": "Random picks constrained to match historical draw structure.",
  "Anti-Popular Only": "Pure anti-popularity scoring with no pattern signals.",
  "Diversity Optimized": "Optimizes number coverage across the top 10 cards.",
  "Smoothed Most Drawn (L50)": "Bayesian-smoothed frequency from last 50 draws — reduces noise by shrinking toward uniform baseline.",
  "Smoothed Most Drawn (L20)": "Bayesian-smoothed frequency from last 20 draws — short-term signal with noise reduction.",
  "Recency Smoothed": "Bayesian-smoothed recency scoring — reduces overreaction to recent draws.",
};

function StrategyName({ name, className }: { name: string; className?: string }) {
  const description = STRATEGY_DESCRIPTIONS[name];
  if (!description) return <span className={className}>{name}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${className ?? ""} cursor-help border-b border-dotted border-current`}>{name}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-xs">
        <p>{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface BenchmarkHistoryItem {
  id: number;
  createdAt: string;
  status: string;
  config: BenchmarkRunConfig;
  verdict: string;
  strategiesTested: number;
  windowsTested: number;
}

export default function Validation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const { data: validation } = useQuery<ValidationSummary>({ queryKey: ["/api/analysis/validation"], queryFn: () => fetchApi("/api/analysis/validation"), enabled: !!stats?.modernDraws });
  const { data: benchmarkHistory } = useQuery<BenchmarkHistoryItem[]>({
    queryKey: ["/api/validation/benchmark/history"],
    queryFn: () => fetchApi("/api/validation/benchmark/history"),
  });

  const [benchmark, setBenchmark] = useState<BenchmarkSummary | null>(null);
  const [benchmarkRunMeta, setBenchmarkRunMeta] = useState<{
    timestamp: string;
    minTrainDraws: number;
    permutationRuns: number;
    windowSizes: number[];
    mode: string;
    seed: number;
    randomBaselineRuns: number;
    runPermutation: boolean;
    totalDraws: number;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedWindows, setSelectedWindows] = useState([20, 40, 60, 100]);
  const [benchmarkMode, setBenchmarkMode] = useState<"fixed_holdout" | "rolling_walk_forward">("fixed_holdout");
  const [seed, setSeed] = useState(42);
  const [randomRuns, setRandomRuns] = useState(200);
  const [runPermutation, setRunPermutation] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState<number | null>(null);

  const hasData = validation && validation.verdict !== "insufficient_data";

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const result = await runBenchmark(selectedWindows, 100, benchmarkMode, seed, randomRuns, runPermutation, 100);
      setBenchmark(result);
      setBenchmarkRunMeta({
        timestamp: new Date().toISOString(),
        minTrainDraws: 100,
        permutationRuns: 100,
        windowSizes: [...selectedWindows],
        mode: benchmarkMode,
        seed,
        randomBaselineRuns: randomRuns,
        runPermutation,
        totalDraws: result.totalDrawsAvailable,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/validation/benchmark/history"] });
      toast({ title: "Benchmark complete", description: `Tested ${result.windowSizesTested.length} windows across ${result.stabilityByStrategy.length} strategies [${benchmarkMode === "rolling_walk_forward" ? "rolling" : "fixed"}].` });
    } catch (error: any) {
      toast({ title: "Benchmark failed", description: error.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  const handleLoadRun = async (runId: number) => {
    setLoadingRunId(runId);
    try {
      const result = await fetchApi(`/api/validation/benchmark/${runId}`);
      if (result?.summary) {
        setBenchmark(result.summary as BenchmarkSummary);
        const cfg = result.config as BenchmarkRunConfig;
        setBenchmarkRunMeta({
          timestamp: result.createdAt,
          minTrainDraws: cfg.minTrainDraws,
          permutationRuns: cfg.permutationRuns,
          windowSizes: cfg.windowSizes,
          mode: cfg.benchmarkMode,
          seed: cfg.seed,
          randomBaselineRuns: cfg.randomBaselineRuns,
          runPermutation: cfg.runPermutation,
          totalDraws: cfg.totalDrawsAvailable,
        });
        toast({ title: "Benchmark loaded", description: `Loaded run #${runId} from history.` });
      }
    } catch (error: any) {
      toast({ title: "Failed to load run", description: error.message, variant: "destructive" });
    } finally {
      setLoadingRunId(null);
    }
  };

  const handleExportCSV = () => {
    if (!benchmark) return;
    const headers = ["Window", "Strategy", "Test Draws", "Evaluated", "Skipped", "Train Draws", "Avg Match", "Best Match", "PB Rate%", "Delta vs Random", "Delta vs Mean", "Beats Random", "Within Band"];
    const rows = benchmark.byWindowByStrategy.map(r =>
      [r.windowSize, r.strategy, r.testDraws, r.evaluatedDraws, r.skippedDraws, r.trainDraws, r.avgMainMatches, r.bestMainMatches, r.powerballHitRate, r.deltaVsRandom, r.deltaVsRandomMean, r.beatsRandom ? "YES" : "NO", r.withinRandomBand ? "YES" : "NO"].join(",")
    );
    const stabilityHeaders = ["Strategy", "Windows Tested", "Windows Beating", "Windows Losing", "Avg Delta", "Stability Class"];
    const stabilityRows = benchmark.stabilityByStrategy.map(s =>
      [s.strategy, s.windowsTested, s.windowsBeating, s.windowsLosing, s.avgDelta, s.stabilityClass].join(",")
    );
    const metaRows = [
      "=== Benchmark Configuration ===",
      `Benchmark Mode: ${benchmark.benchmarkMode === "rolling_walk_forward" ? "Rolling Walk-Forward" : "Fixed Holdout"}`,
      `Windows Tested: ${benchmark.windowSizesTested.join(", ")}`,
      `Seed: ${benchmark.seed}`,
      `Total Draws Available: ${benchmark.totalDrawsAvailable}`,
      benchmarkRunMeta ? `Min Train Draws: ${benchmarkRunMeta.minTrainDraws}` : "",
      benchmarkRunMeta ? `Random Baseline Runs: ${benchmarkRunMeta.randomBaselineRuns}` : "",
      benchmarkRunMeta ? `Permutation Test: ${benchmarkRunMeta.runPermutation ? "ON" : "OFF"}` : "",
      benchmarkRunMeta && benchmarkRunMeta.runPermutation ? `Permutation Runs: ${benchmarkRunMeta.permutationRuns}` : "",
      benchmarkRunMeta ? `Timestamp: ${benchmarkRunMeta.timestamp}` : `Timestamp: ${new Date().toISOString()}`,
      benchmark.randomEnsemble ? `Random Ensemble: ${benchmark.randomEnsemble.runs} runs, mean=${benchmark.randomEnsemble.mean}, stdDev=${benchmark.randomEnsemble.stdDev}, p05=${benchmark.randomEnsemble.p05}, p95=${benchmark.randomEnsemble.p95}` : "",
      benchmark.permutationTests?.length ? `Permutation Method: ${benchmark.permutationTests[0].shuffleMethod}, scope=${benchmark.permutationTests[0].scope}` : "",
    ].filter(Boolean);
    const csv = [
      ...metaRows,
      "",
      "=== Window x Strategy Results ===",
      headers.join(","),
      ...rows,
      "",
      "=== Stability Summary ===",
      stabilityHeaders.join(","),
      ...stabilityRows,
      "",
      `Overall Verdict: ${benchmark.overallVerdict}`,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark_${benchmarkMode}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleWindow = (w: number) => {
    setSelectedWindows(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w].sort((a, b) => a - b));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-validation-title">Validation Engine</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Walk-forward backtest, multi-window benchmark, strategy stability analysis.
        </p>
      </div>

      {validation && (
        <Card className={`border-border ${
          validation.verdict === "possible_edge" ? "border-green-500/30 bg-green-500/5" :
          validation.verdict === "weak_edge" ? "border-yellow-500/30 bg-yellow-500/5" :
          validation.verdict === "no_edge" ? "border-orange-500/30 bg-orange-500/5" :
          ""
        }`}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                validation.verdict === "possible_edge" ? "bg-green-500/20" :
                validation.verdict === "weak_edge" ? "bg-yellow-500/20" :
                validation.verdict === "no_edge" ? "bg-orange-500/20" :
                "bg-muted"
              }`}>
                <Target className={`w-6 h-6 ${
                  validation.verdict === "possible_edge" ? "text-green-500" :
                  validation.verdict === "weak_edge" ? "text-yellow-500" :
                  validation.verdict === "no_edge" ? "text-orange-500" :
                  "text-muted-foreground"
                }`} />
              </div>
              <div className="flex-1">
                <div className={`text-2xl font-mono font-bold mb-2 ${
                  validation.verdict === "possible_edge" ? "text-green-500" :
                  validation.verdict === "weak_edge" ? "text-yellow-500" :
                  validation.verdict === "no_edge" ? "text-orange-500" :
                  "text-muted-foreground"
                }`} data-testid="text-verdict">
                  {validation.verdict?.replace(/_/g, " ").toUpperCase() ?? "--"}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{validation.verdictExplanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border col-span-1 md:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitCompare className="w-5 h-5 mr-2" /> Strategy Comparison (Single Window)
            </CardTitle>
            <CardDescription>
              {hasData ? `${validation.diagnostics.testSetSize} test draws, ${validation.diagnostics.trainSetSize} training draws` : "Performance against historical out-of-sample draws"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {hasData ? (() => {
              const randomAvg = validation.byStrategy.find(s => s.strategy === "Random")?.avgMainMatches ?? 0;
              return (
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <table className="w-full text-sm font-mono text-left">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="p-3 text-muted-foreground font-medium">Strategy</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">Avg Match</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">Best</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">PB Rate</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">vs Random</th>
                        <th className="p-3 text-muted-foreground font-medium text-center">Beats?</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {validation.byStrategy.map((result, i) => {
                        const isRandom = result.strategy === "Random";
                        const delta = result.avgMainMatches - randomAvg;
                        const beats = !isRandom && delta > 0;
                        const isSmoothed = result.strategy.includes("Smoothed");
                        const isMostDrawn = result.strategy.startsWith("Most Drawn");
                        return (
                          <tr key={i} className={`hover:bg-secondary/20 transition-colors ${isMostDrawn ? "bg-blue-500/5" : ""} ${isSmoothed ? "bg-purple-500/5" : ""}`}>
                            <td className={`p-3 font-bold ${isSmoothed ? "text-purple-400" : isMostDrawn ? "text-blue-400" : isRandom ? "text-muted-foreground" : ""}`}><StrategyName name={result.strategy} /></td>
                            <td className="p-3 text-right font-bold">{result.avgMainMatches}</td>
                            <td className="p-3 text-right">{result.bestMainMatches}/7</td>
                            <td className="p-3 text-right">{result.powerballHitRate}%</td>
                            <td className={`p-3 text-right font-bold ${isRandom ? "text-muted-foreground" : delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : ""}`}>
                              {isRandom ? "--" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`}
                            </td>
                            <td className="p-3 text-center">
                              {isRandom ? "--" : beats ? <span className="text-green-500 font-bold">YES</span> : <span className="text-muted-foreground">NO</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/10">
                <LayoutDashboard className="w-8 h-8 mb-2 opacity-30" />
                <p className="font-mono text-sm">{stats?.modernDraws > 0 ? "Need 50+ modern draws for validation." : "Awaiting dataset upload."}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center">
                <BarChart3 className="w-4 h-4 mr-2" /> Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Draws Used</span>
                <span className="font-bold">{validation?.diagnostics?.totalDrawsUsed ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Test Set</span>
                <span className="font-bold">{validation?.diagnostics?.testSetSize ?? "--"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Train Set</span>
                <span className="font-bold">{validation?.diagnostics?.trainSetSize ?? "--"}</span>
              </div>
              <div className="flex justify-between border-t border-border/50 pt-2">
                <span className="text-muted-foreground">Composite Delta</span>
                <span className={`font-bold ${
                  (validation?.diagnostics?.compositeVsRandomDelta ?? 0) > 0 ? "text-green-500" : "text-muted-foreground"
                }`}>
                  {validation?.diagnostics?.compositeVsRandomDelta !== undefined
                    ? `${validation.diagnostics.compositeVsRandomDelta >= 0 ? "+" : ""}${validation.diagnostics.compositeVsRandomDelta}`
                    : "--"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-border bg-card ${hasData ? "border-primary/30" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" /> Edge Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-mono font-bold ${
                validation?.verdict === "possible_edge" ? "text-green-500" :
                validation?.verdict === "weak_edge" ? "text-yellow-500" :
                validation?.verdict === "no_edge" ? "text-orange-500" :
                "text-muted-foreground opacity-50"
              }`}>
                {hasData ? validation!.verdict.replace(/_/g, " ").toUpperCase() : "--"}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {hasData ? "Based on walk-forward backtest" : "Awaiting data"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {hasData && validation.rollingWindows.length > 0 && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center"><TrendingUp className="w-5 h-5 mr-2" /> Rolling Window Stability</CardTitle>
            <CardDescription>Composite vs Random performance across time windows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-3 text-muted-foreground font-medium">Window</th>
                    <th className="p-3 text-muted-foreground font-medium text-right">Composite Avg</th>
                    <th className="p-3 text-muted-foreground font-medium text-right">Random Avg</th>
                    <th className="p-3 text-muted-foreground font-medium text-right">Delta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {validation.rollingWindows.map((w, i) => (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-muted-foreground">{w.windowStart}-{w.windowEnd}</td>
                      <td className="p-3 text-right font-bold text-primary">{w.compositeAvg}</td>
                      <td className="p-3 text-right">{w.randomAvg}</td>
                      <td className={`p-3 text-right font-bold ${w.delta > 0 ? "text-green-500" : w.delta < 0 ? "text-red-500" : ""}`}>
                        {w.delta >= 0 ? "+" : ""}{w.delta}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && (() => {
        const randomAvg = validation.byStrategy.find(s => s.strategy === "Random")?.avgMainMatches ?? 0;
        const mostDrawnStrategies = validation.byStrategy.filter(s => s.strategy.startsWith("Most Drawn"));
        if (mostDrawnStrategies.length === 0) return null;
        const bestMD = mostDrawnStrategies.reduce((best, s) => s.avgMainMatches > best.avgMainMatches ? s : best, mostDrawnStrategies[0]);
        const bestDelta = bestMD.avgMainMatches - randomAvg;
        const anyBeat = mostDrawnStrategies.some(s => s.avgMainMatches > randomAvg);
        return (
          <Card className="border-border border-blue-500/20 bg-blue-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-blue-400">
                <Info className="w-5 h-5 mr-2" /> Most Drawn Benchmark Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Most Drawn strategies are descriptive benchmarks based on historical frequency. They do not imply future draws are dependent on past draws.
              </p>
              <p className="font-mono">
                {anyBeat
                  ? `${bestMD.strategy} averaged ${bestMD.avgMainMatches} main matches vs ${randomAvg} for random (delta ${bestDelta >= 0 ? "+" : ""}${bestDelta.toFixed(2)}).`
                  : `No Most Drawn variant beat random in this walk-forward test. This is expected.`
                }
              </p>
            </CardContent>
          </Card>
        );
      })()}

      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Multi-Window Benchmark
            </h2>
            <p className="text-muted-foreground text-sm font-mono mt-1">
              Test all strategies across multiple windows for stability analysis.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {benchmark && (
              <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            )}
            <Button onClick={handleRunBenchmark} disabled={isRunning || !hasData} className="bg-primary hover:bg-primary/90 font-mono" data-testid="button-run-benchmark">
              {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isRunning ? "RUNNING..." : "RUN BENCHMARK"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {[20, 40, 60, 100].map(w => (
            <button
              key={w}
              onClick={() => toggleWindow(w)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                selectedWindows.includes(w)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid={`button-window-${w}`}
            >
              {w} draws
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setBenchmarkMode("fixed_holdout")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
              benchmarkMode === "fixed_holdout"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:bg-secondary/30"
            }`}
            data-testid="button-mode-fixed"
          >
            Fixed Holdout
          </button>
          <button
            onClick={() => setBenchmarkMode("rolling_walk_forward")}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
              benchmarkMode === "rolling_walk_forward"
                ? "border-green-500 bg-green-500/10 text-green-500"
                : "border-border/50 text-muted-foreground hover:bg-secondary/30"
            }`}
            data-testid="button-mode-rolling"
          >
            Rolling Walk-Forward
          </button>
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-4"
          data-testid="button-toggle-advanced"
        >
          <Settings2 className="w-3 h-3" /> {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 border border-border/50 rounded-md bg-secondary/10">
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Seed</label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 42)}
                className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md"
                data-testid="input-seed"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Random Runs</label>
              <input
                type="number"
                value={randomRuns}
                onChange={(e) => setRandomRuns(Math.min(500, Math.max(10, Number(e.target.value) || 200)))}
                className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md"
                data-testid="input-random-runs"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setRunPermutation(!runPermutation)}
                className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                  runPermutation
                    ? "border-purple-500 bg-purple-500/10 text-purple-500"
                    : "border-border/50 text-muted-foreground hover:bg-secondary/30"
                }`}
                data-testid="button-toggle-permutation"
              >
                <Beaker className="w-3 h-3 inline mr-1" />
                Permutation Test {runPermutation ? "ON" : "OFF"}
              </button>
            </div>
            <div className="flex items-end">
              <p className="text-[10px] text-muted-foreground font-mono">
                Same seed + config = reproducible results. Random ensemble stabilizes baselines.
              </p>
            </div>
          </div>
        )}

        {benchmark ? (
          <div className="space-y-6">
            <Card className={`border-border ${
              benchmark.stabilityByStrategy.some(s => s.stabilityClass === "possible_edge") ? "border-green-500/30 bg-green-500/5" :
              benchmark.stabilityByStrategy.some(s => s.stabilityClass === "weak_edge") ? "border-yellow-500/30 bg-yellow-500/5" :
              "border-orange-500/30 bg-orange-500/5"
            }`}>
              <CardContent className="py-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{benchmark.overallVerdict}</p>
              </CardContent>
            </Card>

            <Card className="border-border border-primary/20" data-testid="card-benchmark-config">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center">
                  <Settings2 className="w-4 h-4 mr-2 text-primary" />
                  Benchmark Config
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  Reproducibility metadata — same config + seed = identical results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm font-mono">
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Mode</span>
                    <span className="font-bold text-xs">{benchmark.benchmarkMode === "rolling_walk_forward" ? "Rolling Walk-Forward" : "Fixed Holdout"}</span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Windows</span>
                    <span className="font-bold text-xs">{benchmark.windowSizesTested.join(", ")}</span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Min Train Draws</span>
                    <span className="font-bold text-xs">{benchmarkRunMeta?.minTrainDraws ?? 100}</span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Seed</span>
                    <span className="font-bold text-xs">{benchmark.seed}</span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Random Baseline Runs</span>
                    <span className="font-bold text-xs">{benchmark.randomEnsemble?.runs ?? benchmarkRunMeta?.randomBaselineRuns ?? "--"}</span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Permutation Test</span>
                    <span className="font-bold text-xs">
                      {benchmark.permutationTests?.length
                        ? `ON (${benchmark.permutationTests[0].runs} runs)`
                        : "OFF"}
                    </span>
                  </div>
                  {benchmark.permutationTests?.length > 0 && (
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Shuffle Method</span>
                      <span className="font-bold text-xs">{benchmark.permutationTests[0].shuffleMethod.replace(/_/g, "-")} / {benchmark.permutationTests[0].scope.replace(/_/g, "-")}</span>
                    </div>
                  )}
                  <div className="flex justify-between md:flex-col md:gap-0.5">
                    <span className="text-muted-foreground text-xs">Data Scope</span>
                    <span className="font-bold text-xs">{benchmark.totalDrawsAvailable} draws</span>
                  </div>
                  <div className="flex justify-between md:flex-col md:gap-0.5 col-span-2">
                    <span className="text-muted-foreground text-xs">Timestamp</span>
                    <span className="font-bold text-xs">{benchmarkRunMeta?.timestamp ? new Date(benchmarkRunMeta.timestamp).toLocaleString() : "--"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {benchmark.randomEnsemble && (
              <Card className="border-border border-blue-500/20" data-testid="card-random-ensemble">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-blue-400" />
                    Random Baseline Ensemble
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    {benchmark.randomEnsemble.runs} runs, seed {benchmark.randomEnsemble.seed} — {benchmark.benchmarkMode === "rolling_walk_forward" ? "ROLLING" : "FIXED"} mode
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center font-mono">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Mean</div>
                      <div className="text-lg font-bold">{benchmark.randomEnsemble.mean}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">5th %ile</div>
                      <div className="text-lg font-bold text-red-400">{benchmark.randomEnsemble.p05}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">95th %ile</div>
                      <div className="text-lg font-bold text-green-400">{benchmark.randomEnsemble.p95}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Std Dev</div>
                      <div className="text-lg font-bold">{benchmark.randomEnsemble.stdDev}</div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-3 text-center">
                    Strategies must exceed the ensemble mean to claim any advantage over random chance.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <Shield className="w-5 h-5 mr-2" /> Strategy Stability
                </CardTitle>
                <CardDescription>Consistency across {benchmark.windowSizesTested.length} test windows ({benchmark.windowSizesTested.join(", ")} draws)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <table className="w-full text-sm font-mono text-left">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="p-3 text-muted-foreground font-medium">Strategy</th>
                        <th className="p-3 text-muted-foreground font-medium text-center">Tested</th>
                        <th className="p-3 text-muted-foreground font-medium text-center">Beating</th>
                        <th className="p-3 text-muted-foreground font-medium text-center">Losing</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">Avg Delta</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">Stability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {benchmark.stabilityByStrategy.map((s, i) => (
                        <tr key={i} className={`hover:bg-secondary/20 transition-colors ${s.strategy.includes("Smoothed") ? "bg-purple-500/5" : ""}`}>
                          <td className={`p-3 font-bold ${s.strategy.startsWith("Most Drawn") ? "text-blue-400" : s.strategy.includes("Smoothed") || s.strategy.includes("Recency Smooth") ? "text-purple-400" : ""}`}><StrategyName name={s.strategy} /></td>
                          <td className="p-3 text-center">{s.windowsTested}</td>
                          <td className="p-3 text-center text-green-500 font-bold">{s.windowsBeating}</td>
                          <td className="p-3 text-center text-red-500 font-bold">{s.windowsLosing}</td>
                          <td className={`p-3 text-right font-bold ${s.avgDelta > 0 ? "text-green-500" : s.avgDelta < 0 ? "text-red-500" : ""}`}>
                            {s.avgDelta >= 0 ? "+" : ""}{s.avgDelta}
                          </td>
                          <td className="p-3 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              s.stabilityClass === "possible_edge" ? "bg-green-500/20 text-green-500" :
                              s.stabilityClass === "weak_edge" ? "bg-yellow-500/20 text-yellow-500" :
                              s.stabilityClass === "underperforming" ? "bg-red-500/20 text-red-500" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {s.stabilityClass.replace(/_/g, " ").toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {benchmark.permutationTests && benchmark.permutationTests.length > 0 && (
              <Card className="border-border border-purple-500/20" data-testid="card-permutation-tests">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Beaker className="w-5 h-5 mr-2 text-purple-400" /> Permutation Significance Tests
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Experimental significance checks — not proof of predictive edge
                    {benchmark.permutationTests[0] && (
                      <span className="ml-2 text-muted-foreground">
                        ({benchmark.permutationTests[0].runs} runs · {benchmark.permutationTests[0].shuffleMethod.replace(/_/g, "-")} · {benchmark.permutationTests[0].scope.replace(/_/g, "-")} shuffle)
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {benchmark.permutationTests.map((pt, i) => (
                    <div key={i} className="p-3 rounded-md border border-border/50 bg-secondary/10">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono font-bold">{pt.strategy}</span>
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          pt.empiricalPValue < 0.05 ? "bg-green-500/20 text-green-500" :
                          pt.empiricalPValue < 0.2 ? "bg-yellow-500/20 text-yellow-500" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          p={pt.empiricalPValue}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-xs font-mono text-center mb-2">
                        <div>
                          <span className="text-muted-foreground block">Observed</span>
                          <span className="font-bold">{pt.observedDelta >= 0 ? "+" : ""}{pt.observedDelta}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Null Mean</span>
                          <span className="font-bold">{pt.nullMean >= 0 ? "+" : ""}{pt.nullMean}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Null Std</span>
                          <span className="font-bold">{pt.nullStd}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block">Percentile</span>
                          <span className="font-bold">{pt.percentile}th</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{pt.cautionText}</p>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 p-3 rounded-md bg-purple-500/5 border border-purple-500/20">
                    <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-purple-400/90">Permutation testing shuffles entire draw outcomes across timestamps (cross-draw Fisher-Yates) and tests whether observed performance could arise by chance. A low p-value is suggestive but not proof of causality — lottery draws are independent events.</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <GitCompare className="w-5 h-5 mr-2" /> Full Results (Window x Strategy)
                </CardTitle>
                <CardDescription>Detailed performance for each window size and strategy</CardDescription>
              </CardHeader>
              <CardContent>
                {benchmark.windowSizesTested.map(windowSize => {
                  const windowRows = benchmark.byWindowByStrategy.filter(r => r.windowSize === windowSize);
                  return (
                    <div key={windowSize} className="mb-6 last:mb-0">
                      <h4 className="text-sm font-mono text-muted-foreground mb-2 border-b border-border/30 pb-1">
                        WINDOW: {windowSize} TEST DRAWS / {windowRows[0]?.trainDraws ?? "?"} TRAINING
                        {windowRows[0]?.skippedDraws > 0 && (
                          <span className="ml-2 text-yellow-500">({windowRows[0]?.evaluatedDraws} evaluated, {windowRows[0]?.skippedDraws} skipped)</span>
                        )}
                      </h4>
                      <div className="rounded-md border border-border/50 overflow-hidden">
                        <table className="w-full text-sm font-mono text-left">
                          <thead className="bg-secondary/50">
                            <tr>
                              <th className="p-2.5 text-muted-foreground font-medium">Strategy</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-right">Avg Match</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-right">Best</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-right">PB Rate</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-right">Delta</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-center">Eval'd</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-center">Beats?</th>
                              <th className="p-2.5 text-muted-foreground font-medium text-center">In Band?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {windowRows.map((r, j) => (
                              <tr key={j} className={`hover:bg-secondary/20 transition-colors ${r.strategy.startsWith("Most Drawn") ? "bg-blue-500/5" : ""} ${r.strategy.includes("Smoothed") || r.strategy.includes("Recency Smooth") ? "bg-purple-500/5" : ""}`}>
                                <td className={`p-2.5 font-bold ${r.strategy === "Random" ? "text-muted-foreground" : r.strategy.startsWith("Most Drawn") ? "text-blue-400" : r.strategy.includes("Smoothed") || r.strategy.includes("Recency Smooth") ? "text-purple-400" : ""}`}>
                                  <StrategyName name={r.strategy} />
                                </td>
                                <td className="p-2.5 text-right font-bold">{r.avgMainMatches}</td>
                                <td className="p-2.5 text-right">{r.bestMainMatches}/7</td>
                                <td className="p-2.5 text-right">{r.powerballHitRate}%</td>
                                <td className={`p-2.5 text-right font-bold ${r.strategy === "Random" ? "text-muted-foreground" : r.deltaVsRandom > 0 ? "text-green-500" : r.deltaVsRandom < 0 ? "text-red-500" : ""}`}>
                                  {r.strategy === "Random" ? "--" : `${r.deltaVsRandom >= 0 ? "+" : ""}${r.deltaVsRandom}`}
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className={r.skippedDraws > 0 ? "text-yellow-500" : ""}>{r.evaluatedDraws}{r.skippedDraws > 0 ? `/${r.testDraws}` : ""}</span>
                                </td>
                                <td className="p-2.5 text-center">
                                  {r.strategy === "Random" ? "--" : r.beatsRandom ? <span className="text-green-500 font-bold">YES</span> : <span className="text-muted-foreground">NO</span>}
                                </td>
                                <td className="p-2.5 text-center">
                                  {r.strategy === "Random" ? "--" : r.withinRandomBand ? <span className="text-yellow-500">IN</span> : <span className="text-green-500 font-bold">OUT</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10">
            <Shield className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-mono text-sm">{hasData ? "Click RUN BENCHMARK to test all strategies across multiple windows." : "Upload data and run single-window validation first."}</p>
            <p className="text-xs opacity-70 mt-1">Tests windows of 20, 40, 60, and 100 draws with stability classification.</p>
          </div>
        )}

        {benchmarkHistory && benchmarkHistory.length > 0 && (
          <Card className="border-border mt-6" data-testid="card-benchmark-history">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <History className="w-5 h-5 mr-2" /> Benchmark History
              </CardTitle>
              <CardDescription>Recent benchmark runs — click to load results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border/50 overflow-hidden">
                <table className="w-full text-sm font-mono text-left">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="p-3 text-muted-foreground font-medium">Run</th>
                      <th className="p-3 text-muted-foreground font-medium">Timestamp</th>
                      <th className="p-3 text-muted-foreground font-medium">Mode</th>
                      <th className="p-3 text-muted-foreground font-medium text-center">Windows</th>
                      <th className="p-3 text-muted-foreground font-medium text-center">Strategies</th>
                      <th className="p-3 text-muted-foreground font-medium text-right">Verdict</th>
                      <th className="p-3 text-muted-foreground font-medium text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {benchmarkHistory.map((run) => (
                      <tr key={run.id} className="hover:bg-secondary/20 transition-colors" data-testid={`row-benchmark-history-${run.id}`}>
                        <td className="p-3 text-muted-foreground">#{run.id}</td>
                        <td className="p-3 text-muted-foreground text-xs">
                          {run.createdAt ? new Date(run.createdAt).toLocaleString() : "--"}
                        </td>
                        <td className="p-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            run.config?.benchmarkMode === "rolling_walk_forward"
                              ? "bg-green-500/20 text-green-500"
                              : "bg-blue-500/20 text-blue-500"
                          }`}>
                            {run.config?.benchmarkMode === "rolling_walk_forward" ? "ROLLING" : "FIXED"}
                          </span>
                        </td>
                        <td className="p-3 text-center">{run.windowsTested}</td>
                        <td className="p-3 text-center">{run.strategiesTested}</td>
                        <td className="p-3 text-right">
                          {run.verdict ? (
                            <span className="text-xs truncate max-w-[200px] inline-block">{run.verdict.length > 60 ? run.verdict.slice(0, 60) + "…" : run.verdict}</span>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadRun(run.id)}
                            disabled={loadingRunId === run.id}
                            data-testid={`button-load-run-${run.id}`}
                          >
                            {loadingRunId === run.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
