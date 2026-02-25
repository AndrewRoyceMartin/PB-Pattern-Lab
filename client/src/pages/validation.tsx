import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Target, GitCompare, LayoutDashboard, TrendingUp, BarChart3, Info, Play, Loader2, Download, Shield, Beaker, Settings2, History, Eye, ChevronDown, ChevronRight, FileJson, FileText, ListChecks, Bookmark, X, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApi, runBenchmark } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { ValidationSummary, BenchmarkSummary, BenchmarkRunConfig, BenchmarkStrategyStability, RegimeSplitResult } from "@shared/schema";

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
  "Recency Gap Balanced": "Prefers numbers with moderate gap (not extreme overdue or just appeared).",
  "Recency Decay Weighted": "Exponential decay weighting on recency — recent appearances weighted more heavily.",
  "Recency Short Window": "Recency emphasis on last 10-20 draws only.",
  "Composite No-Frequency": "Composite ablation removing frequency signal — keeps recency + trend only.",
  "Composite Recency-Heavy": "Composite with recency weight boosted (60% recency, 20% trend, 20% structure).",
  "Composite No-Recency": "Composite ablation removing recency signal — keeps frequency + trend + structure.",
  "Composite No-Structure": "Composite ablation removing structure signal — keeps frequency + recency + trend.",
  "Composite No-AntiPop": "Composite ablation removing anti-popularity signal — keeps frequency + recency + trend + structure.",
  "Composite Structure-Heavy": "Composite with structure weight boosted (60% structure, 20% frequency, 20% recency).",
};

const RECENCY_VERIFICATION_STRATEGIES = [
  "Recency Only", "Recency Smoothed", "Composite",
  "Most Drawn (Last 20)", "Smoothed Most Drawn (L20)",
  "Recency Gap Balanced", "Recency Decay Weighted", "Recency Short Window",
  "Composite No-Frequency", "Composite Recency-Heavy",
  "Random", "Structure-Matched Random", "Anti-Popular Only", "Diversity Optimized",
];

const RECENCY_PERMUTATION_TARGETS = [
  "Recency Only", "Recency Smoothed", "Composite",
  "Recency Gap Balanced", "Recency Decay Weighted", "Recency Short Window",
  "Composite No-Frequency", "Composite Recency-Heavy",
];

const ROLLING_CONFIRMATION_STRATEGIES = [
  "Most Drawn (Last 50)", "Most Drawn (Last 20)", "Most Drawn (Last 100)",
  "Smoothed Most Drawn (L50)", "Smoothed Most Drawn (L20)",
  "Recency Smoothed", "Composite",
  "Random", "Structure-Matched Random",
];

const SIGNIFICANCE_CHECK_STRATEGIES = [
  "Composite", "Composite No-Frequency", "Composite Recency-Heavy",
  "Composite No-Recency", "Composite No-Structure", "Composite No-AntiPop", "Composite Structure-Heavy",
  "Random", "Structure-Matched Random", "Anti-Popular Only",
];

const SIGNIFICANCE_PERMUTATION_TARGETS = [
  "Composite", "Composite No-Frequency", "Composite Recency-Heavy",
  "Composite No-Recency", "Composite No-Structure", "Composite No-AntiPop", "Composite Structure-Heavy",
];

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

function StabilityBadge({ stabilityClass }: { stabilityClass: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${
      stabilityClass === "possible_edge" ? "bg-green-500/20 text-green-500" :
      stabilityClass === "weak_edge" ? "bg-yellow-500/20 text-yellow-500" :
      stabilityClass === "underperforming" ? "bg-red-500/20 text-red-500" :
      "bg-muted text-muted-foreground"
    }`}>
      {stabilityClass.replace(/_/g, " ").toUpperCase()}
    </span>
  );
}

function CollapsibleSection({ title, icon, defaultOpen = false, children, badge, testId }: {
  title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode; badge?: React.ReactNode; testId?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border" data-testid={testId}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-secondary/10 transition-colors">
        <div className="flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
          {badge}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

interface DrillDownItem {
  strategy: string;
  note: string;
  timestamp: string;
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

function getStrategyColor(name: string): string {
  if (name === "Random") return "text-muted-foreground";
  if (name.startsWith("Most Drawn")) return "text-blue-400";
  if (name.includes("Smoothed") || name.includes("Recency")) return "text-purple-400";
  if (name.includes("Composite")) return "text-cyan-400";
  return "";
}

function getStrategyBg(name: string): string {
  if (name.startsWith("Most Drawn")) return "bg-blue-500/5";
  if (name.includes("Smoothed") || name.includes("Recency")) return "bg-purple-500/5";
  if (name.includes("Composite")) return "bg-cyan-500/5";
  return "";
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
  const [permutationRuns, setPermutationRuns] = useState(200);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(() => {
    try { return localStorage.getItem("validation_show_details") === "true"; } catch { return false; }
  });
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [regimeSplits, setRegimeSplits] = useState(false);
  const [drillDownQueue, setDrillDownQueue] = useState<DrillDownItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("drill_down_queue") || "[]"); } catch { return []; }
  });
  const [drillDownNote, setDrillDownNote] = useState("");

  const hasData = validation && validation.verdict !== "insufficient_data";

  useEffect(() => {
    localStorage.setItem("validation_show_details", String(showDetails));
  }, [showDetails]);

  useEffect(() => {
    localStorage.setItem("drill_down_queue", JSON.stringify(drillDownQueue));
  }, [drillDownQueue]);

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const presetConfig = activePreset === "recency_verification" ? {
        selectedStrategies: RECENCY_VERIFICATION_STRATEGIES,
        presetName: "Recency Signal Verification",
        permutationStrategies: runPermutation ? RECENCY_PERMUTATION_TARGETS : undefined,
      } : activePreset === "rolling_confirmation" ? {
        selectedStrategies: ROLLING_CONFIRMATION_STRATEGIES,
        presetName: "Rolling Confirmation",
        permutationStrategies: undefined,
      } : activePreset === "significance_check" ? {
        selectedStrategies: SIGNIFICANCE_CHECK_STRATEGIES,
        presetName: "Significance Check (Composite Ablation)",
        permutationStrategies: runPermutation ? SIGNIFICANCE_PERMUTATION_TARGETS : undefined,
      } : {
        selectedStrategies: undefined,
        presetName: undefined,
        permutationStrategies: undefined,
      };
      const result = await runBenchmark({
        windowSizes: selectedWindows,
        minTrainDraws: 100,
        benchmarkMode,
        seed,
        randomBaselineRuns: randomRuns,
        runPermutation,
        permutationRuns,
        ...presetConfig,
        regimeSplits,
      });
      setBenchmark(result);
      setBenchmarkRunMeta({
        timestamp: new Date().toISOString(),
        minTrainDraws: 100,
        permutationRuns,
        windowSizes: [...selectedWindows],
        mode: benchmarkMode,
        seed,
        randomBaselineRuns: randomRuns,
        runPermutation,
        totalDraws: result.totalDrawsAvailable,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/validation/benchmark/history"] });
      toast({ title: "Benchmark complete", description: `Tested ${result.windowSizesTested.length} windows across ${result.stabilityByStrategy.length} strategies${result.presetName ? ` [${result.presetName}]` : ""}.` });
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

  const addToDrillDown = (strategy: string) => {
    if (drillDownQueue.some(d => d.strategy === strategy)) return;
    setDrillDownQueue(prev => [...prev, { strategy, note: drillDownNote || "", timestamp: new Date().toISOString() }]);
    setDrillDownNote("");
  };

  const removeDrillDown = (strategy: string) => {
    setDrillDownQueue(prev => prev.filter(d => d.strategy !== strategy));
  };

  const toggleWindow = (w: number) => {
    setSelectedWindows(prev => prev.includes(w) ? prev.filter(x => x !== w) : [...prev, w].sort((a, b) => a - b));
  };

  const exportSummaryCSV = () => {
    if (!benchmark) return;
    const meta = buildMetaRows();
    const headers = ["Strategy", "Stability", "Windows Tested", "Windows Beating", "Windows Losing", "Avg Delta", "Significance p-value"];
    const rows = benchmark.stabilityByStrategy.map(s => {
      const perm = benchmark.permutationTests?.find(p => p.strategy === s.strategy);
      return [s.strategy, s.stabilityClass, s.windowsTested, s.windowsBeating, s.windowsLosing, s.avgDelta, perm?.empiricalPValue ?? ""].join(",");
    });
    downloadCSV([...meta, "", headers.join(","), ...rows, "", `Verdict: ${benchmark.overallVerdict}`].join("\n"), "summary");
  };

  const exportDetailedCSV = () => {
    if (!benchmark) return;
    const meta = buildMetaRows();
    const headers = ["Window", "Strategy", "Test Draws", "Evaluated", "Skipped", "Train Draws", "Avg Match", "Best Match", "PB Rate%", "Delta vs Random", "Beats Random", "Within Band"];
    const rows = benchmark.byWindowByStrategy.map(r =>
      [r.windowSize, r.strategy, r.testDraws, r.evaluatedDraws, r.skippedDraws, r.trainDraws, r.avgMainMatches, r.bestMainMatches, r.powerballHitRate, r.deltaVsRandom, r.beatsRandom ? "YES" : "NO", r.withinRandomBand ? "YES" : "NO"].join(",")
    );
    downloadCSV([...meta, "", headers.join(","), ...rows].join("\n"), "detailed");
  };

  const exportPermutationCSV = () => {
    if (!benchmark?.permutationTests?.length) return;
    const meta = buildMetaRows();
    const headers = ["Strategy", "Metric", "Observed Delta", "Null Mean", "Null Std", "Percentile", "Empirical p-value", "Runs", "Shuffle Method", "Scope"];
    const rows = benchmark.permutationTests.map(p =>
      [p.strategy, p.metric, p.observedDelta, p.nullMean, p.nullStd, p.percentile, p.empiricalPValue, p.runs, p.shuffleMethod, p.scope].join(",")
    );
    downloadCSV([...meta, "", headers.join(","), ...rows].join("\n"), "permutation");
  };

  const exportFullJSON = () => {
    if (!benchmark) return;
    const data = {
      benchmark,
      meta: benchmarkRunMeta,
      drillDownQueue,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark_full_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildMetaRows = (): string[] => [
    "=== Benchmark Configuration ===",
    `Mode: ${benchmark?.benchmarkMode === "rolling_walk_forward" ? "Rolling Walk-Forward" : "Fixed Holdout"}`,
    `Windows: ${benchmark?.windowSizesTested?.join(", ") ?? ""}`,
    `Seed: ${benchmark?.seed ?? ""}`,
    `Total Draws: ${benchmark?.totalDrawsAvailable ?? ""}`,
    `Random Baseline Runs: ${benchmark?.randomEnsemble?.runs ?? ""}`,
    benchmark?.presetName ? `Preset: ${benchmark.presetName}` : "",
    benchmarkRunMeta ? `Timestamp: ${benchmarkRunMeta.timestamp}` : "",
  ].filter(Boolean);

  const downloadCSV = (content: string, type: string) => {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `benchmark_${type}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const edgeStrategies = benchmark?.stabilityByStrategy.filter(s => s.stabilityClass === "possible_edge" || s.stabilityClass === "weak_edge") ?? [];
  const noEdgeStrategies = benchmark?.stabilityByStrategy.filter(s => s.stabilityClass === "no_edge") ?? [];
  const underperforming = benchmark?.stabilityByStrategy.filter(s => s.stabilityClass === "underperforming") ?? [];
  const sortedStability = benchmark ? [...benchmark.stabilityByStrategy].sort((a, b) => b.avgDelta - a.avgDelta) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-validation-title">Validation Engine</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Walk-forward backtest, multi-window benchmark, strategy stability analysis.
          </p>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
            showDetails ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
          }`}
          data-testid="button-toggle-details"
        >
          <Eye className="w-3 h-3" />
          {showDetails ? "Hide Details" : "Show Details"}
        </button>
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Multi-Window Benchmark
            </h2>
            <p className="text-muted-foreground text-sm font-mono mt-1">
              Test strategies across multiple windows for stability analysis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRunBenchmark} disabled={isRunning || !hasData} className="bg-primary hover:bg-primary/90 font-mono" data-testid="button-run-benchmark">
              {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isRunning ? "RUNNING..." : "RUN BENCHMARK"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {[20, 40, 60, 100].map(w => (
              <button key={w} onClick={() => toggleWindow(w)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                  selectedWindows.includes(w) ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
                }`}
                data-testid={`button-window-${w}`}
              >{w} draws</button>
            ))}
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          <div className="flex gap-1.5">
            <button onClick={() => setBenchmarkMode("fixed_holdout")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                benchmarkMode === "fixed_holdout" ? "border-primary bg-primary/10 text-primary" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid="button-mode-fixed"
            >Fixed Holdout</button>
            <button onClick={() => setBenchmarkMode("rolling_walk_forward")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                benchmarkMode === "rolling_walk_forward" ? "border-green-500 bg-green-500/10 text-green-500" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid="button-mode-rolling"
            >Rolling Walk-Forward</button>
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          <div className="flex gap-1.5">
            <button onClick={() => setActivePreset(activePreset === "recency_verification" ? null : "recency_verification")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                activePreset === "recency_verification" ? "border-purple-500 bg-purple-500/10 text-purple-500" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid="button-preset-recency"
            >
              <Beaker className="w-3 h-3 inline mr-1" />
              Recency Verification
            </button>
            <button onClick={() => setActivePreset(activePreset === "rolling_confirmation" ? null : "rolling_confirmation")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                activePreset === "rolling_confirmation" ? "border-blue-500 bg-blue-500/10 text-blue-500" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid="button-preset-rolling"
            >
              <GitCompare className="w-3 h-3 inline mr-1" />
              Rolling Confirmation
            </button>
            <button onClick={() => setActivePreset(activePreset === "significance_check" ? null : "significance_check")}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                activePreset === "significance_check" ? "border-cyan-500 bg-cyan-500/10 text-cyan-500" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid="button-preset-significance"
            >
              <Target className="w-3 h-3 inline mr-1" />
              Significance Check
            </button>
            <button onClick={() => setRegimeSplits(!regimeSplits)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                regimeSplits ? "border-orange-500 bg-orange-500/10 text-orange-500" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
              }`}
              data-testid="button-regime-splits"
            >
              <BarChart3 className="w-3 h-3 inline mr-1" />
              Regime Splits
            </button>
          </div>
        </div>

        <button onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors mb-4"
          data-testid="button-toggle-advanced"
        >
          <Settings2 className="w-3 h-3" /> {showAdvanced ? "Hide" : "Show"} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 p-4 border border-border/50 rounded-md bg-secondary/10">
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Seed</label>
              <input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 42)}
                className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md"
                data-testid="input-seed" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Random Runs</label>
              <input type="number" value={randomRuns} onChange={(e) => setRandomRuns(Math.min(500, Math.max(10, Number(e.target.value) || 200)))}
                className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md"
                data-testid="input-random-runs" />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground block mb-1">Permutation Runs</label>
              <input type="number" value={permutationRuns} onChange={(e) => setPermutationRuns(Math.min(1000, Math.max(10, Number(e.target.value) || 200)))}
                className="w-full px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md"
                data-testid="input-permutation-runs" />
            </div>
            <div className="flex items-end">
              <button onClick={() => setRunPermutation(!runPermutation)}
                className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border transition-colors ${
                  runPermutation ? "border-purple-500 bg-purple-500/10 text-purple-500" : "border-border/50 text-muted-foreground hover:bg-secondary/30"
                }`}
                data-testid="button-toggle-permutation"
              >
                <Beaker className="w-3 h-3 inline mr-1" />
                Permutation {runPermutation ? "ON" : "OFF"}
              </button>
            </div>
            <div className="flex items-end">
              <p className="text-[10px] text-muted-foreground font-mono">Same seed + config = reproducible results.</p>
            </div>
          </div>
        )}

        {benchmark ? (
          <div className="space-y-4">
            {/* A) TOP SUMMARY — always visible */}
            <Card className={`border-border ${
              edgeStrategies.length > 0 && edgeStrategies.some(s => s.stabilityClass === "possible_edge") ? "border-green-500/30 bg-green-500/5" :
              edgeStrategies.length > 0 ? "border-yellow-500/30 bg-yellow-500/5" :
              "border-orange-500/30 bg-orange-500/5"
            }`} data-testid="card-benchmark-summary">
              <CardContent className="py-5">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    edgeStrategies.length > 0 ? "bg-green-500/20" : "bg-orange-500/20"
                  }`}>
                    <Target className={`w-5 h-5 ${edgeStrategies.length > 0 ? "text-green-500" : "text-orange-500"}`} />
                  </div>
                  <div className="flex-1 space-y-3">
                    {benchmark.presetName && (
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-1">
                        {benchmark.presetName}
                      </span>
                    )}
                    <div>
                      <h3 className="text-sm font-bold text-muted-foreground mb-1">Top candidates</h3>
                      {edgeStrategies.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {edgeStrategies.sort((a, b) => b.avgDelta - a.avgDelta).map(s => (
                            <div key={s.strategy} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/30 border border-border/50">
                              <span className={`text-sm font-mono font-bold ${getStrategyColor(s.strategy)}`}>{s.strategy}</span>
                              <StabilityBadge stabilityClass={s.stabilityClass} />
                              <span className={`text-xs font-mono ${s.avgDelta > 0 ? "text-green-500" : "text-red-500"}`}>
                                {s.avgDelta >= 0 ? "+" : ""}{s.avgDelta}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground font-mono">No strategies showing consistent edge.</p>
                      )}
                    </div>

                    {noEdgeStrategies.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground font-mono">
                          No edge: {noEdgeStrategies.map(s => s.strategy).join(", ")}
                        </span>
                      </div>
                    )}
                    {underperforming.length > 0 && (
                      <div>
                        <span className="text-xs text-red-400/70 font-mono">
                          Underperforming: {underperforming.map(s => s.strategy).join(", ")}
                        </span>
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/30 pt-2">
                      {benchmark.overallVerdict}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* EXPORT BUTTONS */}
            <div className="flex flex-wrap gap-2" data-testid="export-buttons">
              <Button variant="outline" size="sm" onClick={exportSummaryCSV} data-testid="button-export-summary">
                <FileText className="w-3 h-3 mr-1.5" /> CSV Summary
              </Button>
              <Button variant="outline" size="sm" onClick={exportDetailedCSV} data-testid="button-export-detailed">
                <FileText className="w-3 h-3 mr-1.5" /> CSV Detailed
              </Button>
              {benchmark.permutationTests?.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportPermutationCSV} data-testid="button-export-permutation">
                  <FileText className="w-3 h-3 mr-1.5" /> CSV Permutation
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={exportFullJSON} data-testid="button-export-json">
                <FileJson className="w-3 h-3 mr-1.5" /> JSON Full
              </Button>
            </div>

            {/* B) COMPACT KEY RESULTS TABLE — always visible */}
            <Card className="border-border" data-testid="card-strategy-stability">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-base">
                  <Shield className="w-4 h-4 mr-2" /> Strategy Results
                </CardTitle>
                <CardDescription className="text-xs font-mono">
                  {benchmark.stabilityByStrategy.length} strategies across {benchmark.windowSizesTested.length} windows ({benchmark.windowSizesTested.join(", ")} draws)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/50 overflow-hidden">
                  <table className="w-full text-sm font-mono text-left">
                    <thead className="bg-secondary/50">
                      <tr>
                        <th className="p-2.5 text-muted-foreground font-medium">Strategy</th>
                        <th className="p-2.5 text-muted-foreground font-medium text-right">Stability</th>
                        <th className="p-2.5 text-muted-foreground font-medium text-center">Tested</th>
                        <th className="p-2.5 text-muted-foreground font-medium text-center">Beating</th>
                        <th className="p-2.5 text-muted-foreground font-medium text-center">Losing</th>
                        <th className="p-2.5 text-muted-foreground font-medium text-right">Avg Delta</th>
                        {benchmark.permutationTests?.length > 0 && (
                          <th className="p-2.5 text-muted-foreground font-medium text-right">Significance</th>
                        )}
                        <th className="p-2.5 text-muted-foreground font-medium text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {sortedStability.map((s, i) => {
                        const perm = benchmark.permutationTests?.find(p => p.strategy === s.strategy);
                        const isQueued = drillDownQueue.some(d => d.strategy === s.strategy);
                        return (
                          <tr key={i} className={`hover:bg-secondary/20 transition-colors ${getStrategyBg(s.strategy)}`}>
                            <td className={`p-2.5 font-bold ${getStrategyColor(s.strategy)}`}>
                              <StrategyName name={s.strategy} />
                            </td>
                            <td className="p-2.5 text-right"><StabilityBadge stabilityClass={s.stabilityClass} /></td>
                            <td className="p-2.5 text-center">{s.windowsTested}</td>
                            <td className="p-2.5 text-center text-green-500 font-bold">{s.windowsBeating}</td>
                            <td className="p-2.5 text-center text-red-500 font-bold">{s.windowsLosing}</td>
                            <td className={`p-2.5 text-right font-bold ${s.avgDelta > 0 ? "text-green-500" : s.avgDelta < 0 ? "text-red-500" : ""}`}>
                              {s.avgDelta >= 0 ? "+" : ""}{s.avgDelta}
                            </td>
                            {benchmark.permutationTests?.length > 0 && (
                              <td className="p-2.5 text-right">
                                {perm ? (
                                  <span className={`text-xs font-bold ${
                                    perm.empiricalPValue < 0.05 ? "text-green-500" :
                                    perm.empiricalPValue < 0.2 ? "text-yellow-500" :
                                    "text-muted-foreground"
                                  }`}>p={perm.empiricalPValue}</span>
                                ) : <span className="text-muted-foreground/50">—</span>}
                              </td>
                            )}
                            <td className="p-2.5 text-center">
                              <button onClick={() => isQueued ? removeDrillDown(s.strategy) : addToDrillDown(s.strategy)}
                                className={`p-1 rounded transition-colors ${isQueued ? "text-yellow-500 hover:text-yellow-400" : "text-muted-foreground/30 hover:text-muted-foreground"}`}
                                title={isQueued ? "Remove from drill-down" : "Queue for drill-down"}
                                data-testid={`button-drilldown-${s.strategy.replace(/\s+/g, "-")}`}
                              >
                                <Bookmark className="w-3.5 h-3.5" fill={isQueued ? "currentColor" : "none"} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* REGIME SPLITS — shown if available */}
            {benchmark.regimeSplits && benchmark.regimeSplits.length > 0 && (
              <Card className="border-border border-orange-500/20" data-testid="card-regime-splits">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <BarChart3 className="w-4 h-4 mr-2 text-orange-400" />
                    Regime Split Analysis
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Performance across different historical periods — stable signals persist across regimes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {benchmark.regimeSplits.map((regime: RegimeSplitResult) => (
                      <div key={regime.regime} className="p-3 rounded-md border border-border/50 bg-secondary/10">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-mono font-bold text-orange-400">
                            {regime.regime.replace(/_/g, " ").toUpperCase()}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {regime.drawCount} draws · {regime.dateRange}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {regime.stabilityByStrategy
                            .filter(s => s.stabilityClass === "possible_edge" || s.stabilityClass === "weak_edge" || s.avgDelta > 0)
                            .sort((a, b) => b.avgDelta - a.avgDelta)
                            .slice(0, 6)
                            .map(s => (
                              <div key={s.strategy} className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/30 border border-border/50 text-xs font-mono">
                                <span className={getStrategyColor(s.strategy)}>{s.strategy}</span>
                                <span className={s.avgDelta > 0 ? "text-green-500" : "text-red-500"}>
                                  {s.avgDelta >= 0 ? "+" : ""}{s.avgDelta}
                                </span>
                                <StabilityBadge stabilityClass={s.stabilityClass} />
                              </div>
                            ))}
                          {regime.stabilityByStrategy.filter(s => s.avgDelta > 0).length === 0 && (
                            <span className="text-xs text-muted-foreground font-mono">No strategies beat random in this regime.</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/5 border border-orange-500/20">
                      <Info className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-orange-400/90">A real signal should be more stable across regimes. Strategies that appear only in one period are more likely noise.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* DRILL-DOWN QUEUE */}
            {drillDownQueue.length > 0 && (
              <Card className="border-border border-yellow-500/20" data-testid="card-drilldown-queue">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-base">
                    <ListChecks className="w-4 h-4 mr-2 text-yellow-400" />
                    Drill-Down Queue
                    <span className="ml-2 text-xs font-mono text-muted-foreground">({drillDownQueue.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {drillDownQueue.map(item => (
                      <div key={item.strategy} className="flex items-center justify-between p-2 rounded bg-secondary/20 border border-border/50">
                        <div className="flex-1">
                          <span className={`text-sm font-mono font-bold ${getStrategyColor(item.strategy)}`}>{item.strategy}</span>
                          {item.note && <p className="text-xs text-muted-foreground mt-0.5">{item.note}</p>}
                        </div>
                        <button onClick={() => removeDrillDown(item.strategy)} className="p-1 text-muted-foreground hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input
                      type="text"
                      placeholder="Add note for next queued item..."
                      value={drillDownNote}
                      onChange={(e) => setDrillDownNote(e.target.value)}
                      className="flex-1 px-2 py-1.5 text-xs font-mono bg-background border border-border rounded-md"
                      data-testid="input-drilldown-note"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* C) DETAILS — collapsed by default */}
            {showDetails && (
              <>
                <CollapsibleSection title="Benchmark Config" icon={<Settings2 className="w-4 h-4 text-primary" />} defaultOpen testId="card-benchmark-config">
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
                      <span className="text-muted-foreground text-xs">Random Runs</span>
                      <span className="font-bold text-xs">{benchmark.randomEnsemble?.runs ?? benchmarkRunMeta?.randomBaselineRuns ?? "--"}</span>
                    </div>
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Permutation</span>
                      <span className="font-bold text-xs">
                        {benchmark.permutationTests?.length ? `ON (${benchmark.permutationTests[0].runs} runs)` : "OFF"}
                      </span>
                    </div>
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Data Scope</span>
                      <span className="font-bold text-xs">{benchmark.totalDrawsAvailable} draws</span>
                    </div>
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Timestamp</span>
                      <span className="font-bold text-xs">{benchmarkRunMeta?.timestamp ? new Date(benchmarkRunMeta.timestamp).toLocaleString() : "--"}</span>
                    </div>
                  </div>
                </CollapsibleSection>

                {benchmark.randomEnsemble && (
                  <CollapsibleSection title="Random Baseline Ensemble" icon={<BarChart3 className="w-4 h-4 text-blue-400" />} testId="card-random-ensemble">
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
                  </CollapsibleSection>
                )}

                {benchmark.permutationTests && benchmark.permutationTests.length > 0 && (
                  <CollapsibleSection title="Permutation Significance Tests" icon={<Beaker className="w-4 h-4 text-purple-400" />}
                    badge={<span className="text-xs font-mono text-muted-foreground ml-2">(supporting evidence only)</span>}
                    testId="card-permutation-tests"
                  >
                    <div className="space-y-3">
                      {benchmark.permutationTests.map((pt, i) => (
                        <div key={i} className="p-3 rounded-md border border-border/50 bg-secondary/10">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-mono font-bold">{pt.strategy}</span>
                            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                              pt.empiricalPValue < 0.05 ? "bg-green-500/20 text-green-500" :
                              pt.empiricalPValue < 0.2 ? "bg-yellow-500/20 text-yellow-500" :
                              "bg-muted text-muted-foreground"
                            }`}>p={pt.empiricalPValue}</span>
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-xs font-mono text-center mb-2">
                            <div><span className="text-muted-foreground block">Observed</span><span className="font-bold">{pt.observedDelta >= 0 ? "+" : ""}{pt.observedDelta}</span></div>
                            <div><span className="text-muted-foreground block">Null Mean</span><span className="font-bold">{pt.nullMean >= 0 ? "+" : ""}{pt.nullMean}</span></div>
                            <div><span className="text-muted-foreground block">Null Std</span><span className="font-bold">{pt.nullStd}</span></div>
                            <div><span className="text-muted-foreground block">Percentile</span><span className="font-bold">{pt.percentile}th</span></div>
                          </div>
                          <p className="text-xs text-muted-foreground">{pt.cautionText}</p>
                        </div>
                      ))}
                      <div className="flex items-start gap-2 p-3 rounded-md bg-purple-500/5 border border-purple-500/20">
                        <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-purple-400/90">Permutation testing shuffles entire draw outcomes across timestamps. A low p-value is suggestive but not proof of causality.</p>
                      </div>
                    </div>
                  </CollapsibleSection>
                )}

                <CollapsibleSection title="Full Results (Window × Strategy)" icon={<GitCompare className="w-4 h-4" />} testId="card-full-results">
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
                                <th className="p-2 text-muted-foreground font-medium">Strategy</th>
                                <th className="p-2 text-muted-foreground font-medium text-right">Avg Match</th>
                                <th className="p-2 text-muted-foreground font-medium text-right">Best</th>
                                <th className="p-2 text-muted-foreground font-medium text-right">PB Rate</th>
                                <th className="p-2 text-muted-foreground font-medium text-right">Delta</th>
                                <th className="p-2 text-muted-foreground font-medium text-center">Beats?</th>
                                <th className="p-2 text-muted-foreground font-medium text-center">In Band?</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {windowRows.map((r, j) => (
                                <tr key={j} className={`hover:bg-secondary/20 transition-colors ${getStrategyBg(r.strategy)}`}>
                                  <td className={`p-2 font-bold ${getStrategyColor(r.strategy)}`}><StrategyName name={r.strategy} /></td>
                                  <td className="p-2 text-right font-bold">{r.avgMainMatches}</td>
                                  <td className="p-2 text-right">{r.bestMainMatches}/7</td>
                                  <td className="p-2 text-right">{r.powerballHitRate}%</td>
                                  <td className={`p-2 text-right font-bold ${r.strategy === "Random" ? "text-muted-foreground" : r.deltaVsRandom > 0 ? "text-green-500" : r.deltaVsRandom < 0 ? "text-red-500" : ""}`}>
                                    {r.strategy === "Random" ? "--" : `${r.deltaVsRandom >= 0 ? "+" : ""}${r.deltaVsRandom}`}
                                  </td>
                                  <td className="p-2 text-center">
                                    {r.strategy === "Random" ? "--" : r.beatsRandom ? <span className="text-green-500 font-bold">YES</span> : <span className="text-muted-foreground">NO</span>}
                                  </td>
                                  <td className="p-2 text-center">
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
                </CollapsibleSection>

                {validation && hasData && (
                  <CollapsibleSection title="Single-Window Validation" icon={<TrendingUp className="w-4 h-4" />} testId="card-single-window">
                    <div className="rounded-md border border-border/50 overflow-hidden">
                      <table className="w-full text-sm font-mono text-left">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="p-2.5 text-muted-foreground font-medium">Strategy</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">Avg Match</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">Best</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">PB Rate</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">vs Random</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {validation.byStrategy.map((result, i) => {
                            const randomAvg = validation.byStrategy.find(s => s.strategy === "Random")?.avgMainMatches ?? 0;
                            const delta = result.avgMainMatches - randomAvg;
                            return (
                              <tr key={i} className={`hover:bg-secondary/20 ${getStrategyBg(result.strategy)}`}>
                                <td className={`p-2.5 font-bold ${getStrategyColor(result.strategy)}`}><StrategyName name={result.strategy} /></td>
                                <td className="p-2.5 text-right font-bold">{result.avgMainMatches}</td>
                                <td className="p-2.5 text-right">{result.bestMainMatches}/7</td>
                                <td className="p-2.5 text-right">{result.powerballHitRate}%</td>
                                <td className={`p-2.5 text-right font-bold ${result.strategy === "Random" ? "text-muted-foreground" : delta > 0 ? "text-green-500" : delta < 0 ? "text-red-500" : ""}`}>
                                  {result.strategy === "Random" ? "--" : `${delta >= 0 ? "+" : ""}${delta.toFixed(2)}`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                {validation && hasData && validation.rollingWindows.length > 0 && (
                  <CollapsibleSection title="Rolling Window Stability" icon={<TrendingUp className="w-4 h-4" />} testId="card-rolling-windows">
                    <div className="rounded-md border border-border/50 overflow-hidden">
                      <table className="w-full text-sm font-mono text-left">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="p-2.5 text-muted-foreground font-medium">Window</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">Composite Avg</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">Random Avg</th>
                            <th className="p-2.5 text-muted-foreground font-medium text-right">Delta</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {validation.rollingWindows.map((w, i) => (
                            <tr key={i} className="hover:bg-secondary/20">
                              <td className="p-2.5 text-muted-foreground">{w.windowStart}-{w.windowEnd}</td>
                              <td className="p-2.5 text-right font-bold text-primary">{w.compositeAvg}</td>
                              <td className="p-2.5 text-right">{w.randomAvg}</td>
                              <td className={`p-2.5 text-right font-bold ${w.delta > 0 ? "text-green-500" : w.delta < 0 ? "text-red-500" : ""}`}>
                                {w.delta >= 0 ? "+" : ""}{w.delta}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleSection>
                )}

                <CollapsibleSection title="Diagnostics" icon={<AlertCircle className="w-4 h-4" />} testId="card-diagnostics">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-sm">
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Draws Used</span>
                      <span className="font-bold">{validation?.diagnostics?.totalDrawsUsed ?? "--"}</span>
                    </div>
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Test Set</span>
                      <span className="font-bold">{validation?.diagnostics?.testSetSize ?? "--"}</span>
                    </div>
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Train Set</span>
                      <span className="font-bold">{validation?.diagnostics?.trainSetSize ?? "--"}</span>
                    </div>
                    <div className="flex justify-between md:flex-col md:gap-0.5">
                      <span className="text-muted-foreground text-xs">Composite Delta</span>
                      <span className={`font-bold ${(validation?.diagnostics?.compositeVsRandomDelta ?? 0) > 0 ? "text-green-500" : "text-muted-foreground"}`}>
                        {validation?.diagnostics?.compositeVsRandomDelta !== undefined
                          ? `${validation.diagnostics.compositeVsRandomDelta >= 0 ? "+" : ""}${validation.diagnostics.compositeVsRandomDelta}`
                          : "--"}
                      </span>
                    </div>
                  </div>
                </CollapsibleSection>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10">
            <Shield className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-mono text-sm">{hasData ? "Click RUN BENCHMARK to test all strategies across multiple windows." : "Upload data and run single-window validation first."}</p>
            <p className="text-xs opacity-70 mt-1">Tests windows of 20, 40, 60, and 100 draws with stability classification.</p>
          </div>
        )}

        {benchmarkHistory && benchmarkHistory.length > 0 && (
          <CollapsibleSection title="Benchmark History" icon={<History className="w-4 h-4" />} testId="card-benchmark-history">
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-2.5 text-muted-foreground font-medium">Run</th>
                    <th className="p-2.5 text-muted-foreground font-medium">Timestamp</th>
                    <th className="p-2.5 text-muted-foreground font-medium">Mode</th>
                    <th className="p-2.5 text-muted-foreground font-medium text-center">Win</th>
                    <th className="p-2.5 text-muted-foreground font-medium text-center">Strat</th>
                    <th className="p-2.5 text-muted-foreground font-medium text-right">Verdict</th>
                    <th className="p-2.5 text-muted-foreground font-medium text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {benchmarkHistory.map((run) => (
                    <tr key={run.id} className="hover:bg-secondary/20" data-testid={`row-benchmark-history-${run.id}`}>
                      <td className="p-2.5 text-muted-foreground">#{run.id}</td>
                      <td className="p-2.5 text-muted-foreground text-xs">{run.createdAt ? new Date(run.createdAt).toLocaleString() : "--"}</td>
                      <td className="p-2.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          run.config?.benchmarkMode === "rolling_walk_forward" ? "bg-green-500/20 text-green-500" : "bg-blue-500/20 text-blue-500"
                        }`}>
                          {run.config?.benchmarkMode === "rolling_walk_forward" ? "ROLL" : "FIXED"}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">{run.windowsTested}</td>
                      <td className="p-2.5 text-center">{run.strategiesTested}</td>
                      <td className="p-2.5 text-right">
                        <span className="text-xs truncate max-w-[150px] inline-block">
                          {run.verdict ? (run.verdict.length > 50 ? run.verdict.slice(0, 50) + "…" : run.verdict) : "--"}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <Button variant="ghost" size="sm" onClick={() => handleLoadRun(run.id)} disabled={loadingRunId === run.id}
                          data-testid={`button-load-run-${run.id}`}>
                          {loadingRunId === run.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
