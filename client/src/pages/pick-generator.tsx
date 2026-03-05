import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Play, CheckCircle, SearchX, Loader2, Info, Sparkles, AlertTriangle, ArrowRight, Shield, Rocket, Download, ChevronDown, ChevronUp, Trophy, Beaker, Settings2, RotateCcw, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePicks, fetchApi, fetchRecommendation, runAutoGenerate, runAutoCompositeNoFrequency, runAutoOptimiseAndGenerate, runAutoPowerHit } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { GeneratedPick, GeneratorMode, GeneratorRecommendation, PredictionDiffResult, LineDiffMapping } from "@shared/schema";
import { HelpTip } from "@/components/help-tip";
import { useGame } from "@/contexts/game-context";

function ChangesSummary({ diff, showSpecialBall = true }: { diff: PredictionDiffResult; showSpecialBall?: boolean }) {
  const { summary } = diff;
  const timeAgo = formatTimeAgo(new Date(diff.previousGeneratedAt));
  const [showRemoved, setShowRemoved] = useState(false);

  return (
    <Card className="border-border/50 bg-secondary/5" data-testid="card-changes-summary">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <RotateCcw className="w-4 h-4 text-primary" />
            <span className="font-medium">Compared to last run (same lane)</span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground/60">
            Set #{diff.previousSetId} · {timeAgo}
          </span>
        </div>

        <div className={`grid grid-cols-2 ${showSpecialBall ? "md:grid-cols-4" : "md:grid-cols-3"} gap-3`}>
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Mains Changed</div>
            <div className="text-sm font-bold font-mono mt-0.5">{summary.mainsPercentChanged}%</div>
          </div>
          {showSpecialBall && (
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">PBs Changed</div>
            <div className="text-sm font-bold font-mono mt-0.5">{summary.pbPercentChanged}%</div>
          </div>
          )}
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">New Mains</div>
            <div className="text-sm font-bold font-mono mt-0.5 text-green-400">{summary.newMains.length}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Removed</div>
            <div className="text-sm font-bold font-mono mt-0.5 text-red-400">{summary.removedMains.length}</div>
          </div>
        </div>

        {(summary.newMains.length > 0 || summary.removedMains.length > 0) && (
          <div className="flex flex-wrap gap-2 text-xs font-mono border-t border-border/30 pt-2">
            {summary.newMains.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground/60">New:</span>
                {summary.newMains.map(n => (
                  <span key={n} className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">{n.toString().padStart(2, '0')}</span>
                ))}
              </div>
            )}
            {summary.removedMains.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap ml-2">
                <button onClick={() => setShowRemoved(!showRemoved)} className="text-muted-foreground/60 flex items-center gap-0.5 hover:text-muted-foreground transition-colors" data-testid="button-toggle-removed">
                  {showRemoved ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>Dropped ({summary.removedMains.length})</span>
                </button>
                {showRemoved && summary.removedMains.map(n => (
                  <span key={n} className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 line-through">{n.toString().padStart(2, '0')}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {showSpecialBall && (summary.newPBs.length > 0 || summary.removedPBs.length > 0) && (
          <div className="flex flex-wrap gap-2 text-xs font-mono border-t border-border/30 pt-2">
            {summary.newPBs.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-muted-foreground/60">New PBs:</span>
                {summary.newPBs.map(n => (
                  <span key={n} className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">{n.toString().padStart(2, '0')}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Tip({ label, tip, className }: { label: string; tip: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${className ?? ""} cursor-help border-b border-dotted border-current`}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p>{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

interface RunStamp {
  strategyName: string;
  benchmarkRunId: number | null;
  optimiserUsed: boolean;
  optimiserRunId: string | null;
  formulaHash: string | null;
  seed: number;
  generatedAt: string;
}

interface ConfidenceData {
  strategy: string;
  evidenceSource: "benchmark" | "local_replay" | "none";
  evidenceLabel: string;
  deltaVsRandom: number | null;
  percentileVsRandom: number | null;
  randomBand: { p05: number; p95: number; mean: number } | null;
  worthIt: string | null;
  significance: string | null;
  benchmarkRunId: number | null;
  benchmarkDate: string | null;
  benchmarkMode: string | null;
  permutationRuns: number | null;
  overfitRisk?: string;
  caveatedVerdict?: string;
}

interface SimpleResult {
  runStamp: RunStamp;
  picks: GeneratedPick[];
  disclaimer: string;
  strategyDescription?: string;
  confidence?: ConfidenceData;
  predictionSetId?: number;
  diff?: PredictionDiffResult;
  optimiserMeta?: {
    weightsUsed: any;
    formulaHash: string;
    optimiserRunId: string;
    overfitRisk: string;
    caveatedVerdict: string;
    walkForwardReplay: any;
    searchIterations: number;
    trainingWindowSize: number;
  };
  winner?: {
    strategy: string;
    reason: string;
    avgDelta: number;
    windowsBeating: number;
    isFallback: boolean;
  };
  scoreSummary?: {
    strategy: string;
    avgDelta: number;
    windowsBeating: number;
    windowsTested: number;
    stabilityClass: string;
  }[];
  benchmarkRunId?: number;
  runConfigUsed?: any;
}

function RunStampCard({ stamp }: { stamp: RunStamp }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-mono text-muted-foreground border border-border/30 rounded-lg px-4 py-2.5 bg-secondary/10" data-testid="card-run-stamp">
      <span><span className="text-foreground/70">Strategy:<HelpTip id="stamp.strategyName" side="bottom" /></span> {stamp.strategyName}</span>
      <span><span className="text-foreground/70">Optimiser:<HelpTip id="stamp.optimiserUsed" side="bottom" /></span> {stamp.optimiserUsed ? <span className="text-yellow-500">ON</span> : <span className="text-muted-foreground">OFF</span>}</span>
      {stamp.optimiserRunId && <span><span className="text-foreground/70">Opt ID:<HelpTip id="stamp.optimiserRunId" side="bottom" /></span> {stamp.optimiserRunId}</span>}
      {stamp.formulaHash && <span><span className="text-foreground/70">Formula:<HelpTip id="stamp.formulaHash" side="bottom" /></span> {stamp.formulaHash}</span>}
      {stamp.benchmarkRunId && <span><span className="text-foreground/70">Benchmark:<HelpTip id="stamp.benchmarkRunId" side="bottom" /></span> #{stamp.benchmarkRunId}</span>}
      <span><span className="text-foreground/70">Seed:<HelpTip id="advanced.seed" side="bottom" /></span> {stamp.seed}</span>
      <span><span className="text-foreground/70">Generated:<HelpTip id="stamp.generatedAt" side="bottom" /></span> {new Date(stamp.generatedAt).toLocaleString()}</span>
    </div>
  );
}

function GameLine({ pick, index, lineMapping, showSpecialBall = true }: { pick: GeneratedPick; index: number; lineMapping?: LineDiffMapping | null; showSpecialBall?: boolean }) {
  const addedSet = useMemo(() => lineMapping ? new Set(lineMapping.addedMains) : new Set<number>(), [lineMapping]);

  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-lg ${index === 0 ? 'bg-primary/5 border border-primary/20' : 'bg-card/50'}`} data-testid={`auto-game-${index + 1}`}>
      <span className="font-mono font-bold text-muted-foreground w-16 text-sm shrink-0">Game {index + 1}</span>
      <div className="flex gap-1.5">
        {pick.numbers.map((n, idx) => {
          const isNew = addedSet.has(n);
          return (
            <div
              key={idx}
              className={`w-9 h-9 rounded flex items-center justify-center font-mono text-sm border shadow-sm transition-all ${
                isNew
                  ? "bg-green-500/20 border-green-500/50 text-green-300 ring-1 ring-green-500/30"
                  : "bg-secondary border-border/80"
              }`}
              title={isNew ? "New this run" : undefined}
            >
              {n.toString().padStart(2, '0')}
            </div>
          );
        })}
        {showSpecialBall && (
        <div className={`w-9 h-9 rounded flex items-center justify-center font-mono text-sm font-bold shadow-sm ml-1 relative ${
          lineMapping?.pbChanged
            ? "bg-green-500/20 text-green-300 border border-green-500/50 ring-1 ring-green-500/30"
            : "bg-primary/20 text-primary border border-primary/30"
        }`}>
          <Zap className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500" />
          {pick.powerball.toString().padStart(2, '0')}
        </div>
        )}
      </div>
      {lineMapping && (lineMapping.addedMains.length > 0 || (showSpecialBall && lineMapping.pbChanged)) && (
        <span className="text-[10px] font-mono text-green-400/70 ml-1">
          {lineMapping.linePercentChanged}% changed
          {showSpecialBall && lineMapping.pbChanged && " · PB changed"}
        </span>
      )}
    </div>
  );
}

function WorthItBadge({ worthIt }: { worthIt: string | null }) {
  if (!worthIt) return null;
  const config: Record<string, { label: string; icon: string; cls: string }> = {
    worth_trying: { label: "Worth trying", icon: "\u2705", cls: "text-green-400 border-green-500/30 bg-green-500/10" },
    promising: { label: "Promising", icon: "\uD83D\uDFE1", cls: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
    no_edge: { label: "No edge", icon: "\u26AA", cls: "text-muted-foreground border-border bg-secondary/20" },
    underperforming: { label: "Underperforming", icon: "\uD83D\uDD34", cls: "text-red-400 border-red-500/30 bg-red-500/10" },
  };
  const c = config[worthIt] ?? config.no_edge;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border ${c.cls}`} data-testid="badge-worth-it">
      <span>{c.icon}</span> {c.label}
    </span>
  );
}

function SignificanceBadge({ sig }: { sig: string | null }) {
  if (!sig) return <span className="text-[11px] font-mono text-muted-foreground/60">Not tested</span>;
  const cls = sig === "Supported" ? "text-green-400" : sig === "Suggestive" ? "text-yellow-400" : "text-muted-foreground";
  return <span className={`text-[11px] font-mono ${cls}`} data-testid="badge-significance">{sig}</span>;
}

function ConfidencePanel({ confidence }: { confidence: ConfidenceData }) {
  if (confidence.evidenceSource === "none") {
    return (
      <Card className="border-border/50 bg-secondary/5" data-testid="panel-confidence">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Confidence</span>
          </div>
          <p className="text-xs text-muted-foreground/70 mt-2 font-mono">{confidence.evidenceLabel}</p>
        </CardContent>
      </Card>
    );
  }

  const delta = confidence.deltaVsRandom;
  const band = confidence.randomBand;

  return (
    <Card className="border-border/50 bg-secondary/5" data-testid="panel-confidence">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-medium">Confidence</span>
          </div>
          <WorthItBadge worthIt={confidence.worthIt} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Strategy</div>
            <div className="text-xs font-mono text-primary mt-0.5">{confidence.strategy}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{"\u0394"} vs Random</div>
            <div className={`text-sm font-bold font-mono mt-0.5 ${delta !== null && delta > 0 ? "text-green-400" : delta !== null && delta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
              {delta !== null ? (delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : "--"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Percentile</div>
            <div className="text-sm font-bold font-mono mt-0.5">
              {confidence.percentileVsRandom !== null ? `${confidence.percentileVsRandom}th` : "--"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Significance</div>
            <div className="mt-0.5"><SignificanceBadge sig={confidence.significance} /></div>
          </div>
        </div>

        {band && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/70">
            <span>Random band (5-95):</span>
            <span>[{band.p05.toFixed(3)}, {band.p95.toFixed(3)}]</span>
            <span className="text-muted-foreground/50">mean: {band.mean.toFixed(3)}</span>
          </div>
        )}

        <div className="text-[10px] font-mono text-muted-foreground/50 border-t border-border/30 pt-2">
          {confidence.evidenceLabel}
          {confidence.benchmarkDate && (
            <span> · Run date: {new Date(confidence.benchmarkDate).toLocaleDateString()}</span>
          )}
          {confidence.permutationRuns && (
            <span> · Permutation runs: {confidence.permutationRuns}</span>
          )}
          {confidence.overfitRisk && (
            <span> · Overfit risk: {confidence.overfitRisk}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StabilityBadge({ stabilityClass }: { stabilityClass: string }) {
  const config: Record<string, { label: string; className: string }> = {
    possible_edge: { label: "possible edge", className: "bg-green-500/20 text-green-500" },
    weak_edge: { label: "weak edge", className: "bg-yellow-500/20 text-yellow-500" },
    no_edge: { label: "no edge", className: "bg-muted text-muted-foreground" },
    underperforming: { label: "underperforming", className: "bg-red-500/20 text-red-500" },
  };
  const c = config[stabilityClass] || config.no_edge;
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${c.className}`}>{c.label}</span>;
}

function exportCSVLines(result: SimpleResult, showSpecialBall: boolean = true) {
  const mainHeaders = result.picks[0]?.numbers.map((_, i) => `N${i + 1}`).join(",") || "N1,N2,N3,N4,N5,N6,N7";
  const header = showSpecialBall ? `Game,${mainHeaders},PB` : `Game,${mainHeaders}`;
  const lines = [
    header,
    ...result.picks.map((p, i) => showSpecialBall ? `${i + 1},${p.numbers.join(",")},${p.powerball}` : `${i + 1},${p.numbers.join(",")}`),
    "",
    `Strategy,${result.runStamp.strategyName}`,
    `Optimiser,${result.runStamp.optimiserUsed ? "ON" : "OFF"}`,
    result.runStamp.formulaHash ? `Formula Hash,${result.runStamp.formulaHash}` : "",
    result.runStamp.benchmarkRunId ? `Benchmark Run,${result.runStamp.benchmarkRunId}` : "",
    `Generated,${result.runStamp.generatedAt}`,
  ].filter(Boolean);
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `picks_12_${result.runStamp.strategyName.replace(/\s+/g, "_").toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(result: SimpleResult) {
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `picks_12_full_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const MODES: { value: GeneratorMode; label: string; description: string; drawFit: number; antiPop: number; group?: string; strategyName?: string }[] = [
  { value: "strategy_portfolio", label: "Strategy Portfolio", description: "Best from Each Test — mixed 10-game pack from multiple strategies for maximum coverage", drawFit: 50, antiPop: 50, strategyName: "Strategy Portfolio" },
  { value: "balanced", label: "Balanced", description: "60% pattern signals, 40% anti-popularity", drawFit: 60, antiPop: 40, strategyName: "Composite" },
  { value: "anti_popular", label: "Low Split-Risk", description: "20% pattern, 80% anti-popularity", drawFit: 20, antiPop: 80 },
  { value: "anti_popular_only", label: "Anti-Popular Only", description: "Pure anti-popularity scoring — maximum split-risk reduction", drawFit: 0, antiPop: 100, strategyName: "Anti-Popular Only" },
  { value: "pattern_only", label: "Experimental Pattern", description: "100% pattern signals (experimental)", drawFit: 100, antiPop: 0 },
  { value: "structure_matched_random", label: "Structure-Matched Random", description: "Random picks filtered by historical draw structure (odd/even, sum, range)", drawFit: 60, antiPop: 40, strategyName: "Structure-Matched Random" },
  { value: "diversity_optimized", label: "Diversity Optimized", description: "Maximizes number coverage across top 10 cards — ideal for multi-ticket buyers", drawFit: 50, antiPop: 50, strategyName: "Diversity Optimized" },
  { value: "most_drawn_all_time", label: "Most Drawn (All-Time)", description: "Top frequency numbers from full history", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (All-Time)" },
  { value: "most_drawn_last_100", label: "Most Drawn (Last 100)", description: "Top frequency from last 100 draws", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (Last 100)" },
  { value: "most_drawn_last_50", label: "Most Drawn (Last 50)", description: "Top frequency from last 50 draws", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (Last 50)" },
  { value: "most_drawn_last_20", label: "Most Drawn (Last 20)", description: "Top frequency from last 20 draws — short-window hot numbers", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (Last 20)" },
  { value: "least_drawn_last_50", label: "Least Drawn (Last 50)", description: "Contrarian — picks the coldest numbers from last 50 draws", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Least Drawn (Last 50)" },
  { value: "most_drawn_smoothed_last_50", label: "Smoothed Most Drawn (L50)", description: "Bayesian-smoothed frequency — reduces noise by shrinking toward uniform baseline", drawFit: 100, antiPop: 0, group: "smoothed", strategyName: "Smoothed Most Drawn (L50)" },
  { value: "most_drawn_smoothed_last_20", label: "Smoothed Most Drawn (L20)", description: "Short-window Bayesian-smoothed frequency with noise reduction", drawFit: 100, antiPop: 0, group: "smoothed", strategyName: "Smoothed Most Drawn (L20)" },
  { value: "recency_smoothed", label: "Recency Smoothed", description: "Bayesian-smoothed recency scoring — reduces overreaction to recent draws", drawFit: 100, antiPop: 0, group: "smoothed", strategyName: "Recency Smoothed" },
  { value: "random_baseline", label: "Random Baseline", description: "Pure random for comparison", drawFit: 0, antiPop: 0, strategyName: "Random" },
];

export default function PickGenerator() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple");
  const [selectedMode, setSelectedMode] = useState<GeneratorMode>("balanced");
  const [customAntiPop, setCustomAntiPop] = useState([40]);
  const [picks, setPicks] = useState<GeneratedPick[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const [isLaneARunning, setIsLaneARunning] = useState(false);
  const [isLaneBRunning, setIsLaneBRunning] = useState(false);
  const [isPowerHitRunning, setIsPowerHitRunning] = useState(false);
  const [powerHitLines, setPowerHitLines] = useState(20);
  const [laneBStep, setLaneBStep] = useState<string>("");
  const [simpleResult, setSimpleResult] = useState<SimpleResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [pbMode, setPbMode] = useState<"default" | "unique_spread" | "guaranteed">("default");

  const { activeGameId, activeGame } = useGame();
  const [simpleDiff, setSimpleDiff] = useState<PredictionDiffResult | null>(null);
  const [advancedDiff, setAdvancedDiff] = useState<PredictionDiffResult | null>(null);
  const { data: stats } = useQuery({ queryKey: ["/api/stats", activeGameId], queryFn: () => fetchApi(`/api/stats?gameId=${activeGameId}`) });
  const { data: recommendation } = useQuery<GeneratorRecommendation>({
    queryKey: ["/api/generator/recommendation", activeGameId],
    queryFn: () => fetchRecommendation(activeGameId),
    enabled: !!stats?.modernDraws,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hasData = stats?.modernDraws > 0;

  const showSpecialBall = !activeGame?.hasSupplementary;

  useEffect(() => {
    if (activeGame?.specialPool) {
      setPowerHitLines(activeGame.specialPool);
    }
  }, [activeGame?.specialPool]);

  const currentMode = MODES.find(m => m.value === selectedMode)!;
  const drawFitWeight = selectedMode === "balanced" ? 100 - customAntiPop[0] : currentMode.drawFit;
  const antiPopWeight = selectedMode === "balanced" ? customAntiPop[0] : currentMode.antiPop;

  const handleLaneA = async () => {
    if (!hasData) return;
    setIsLaneARunning(true);
    setSimpleResult(null);
    setSimpleDiff(null);
    try {
      const result = await runAutoCompositeNoFrequency(activeGameId, pbMode);
      setSimpleResult(result);
      setSimpleDiff(result.diff ?? null);
      toast({ title: "Picks generated", description: "12 lines using Composite No-Frequency." });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLaneARunning(false);
    }
  };

  const handleLaneB = async () => {
    if (!hasData) return;
    setIsLaneBRunning(true);
    setSimpleResult(null);
    setSimpleDiff(null);
    setLaneBStep("Optimising...");
    try {
      setLaneBStep("Step 1: Running optimiser...");
      const result = await runAutoOptimiseAndGenerate(activeGameId, pbMode);
      setLaneBStep("");
      setSimpleResult(result);
      setSimpleDiff(result.diff ?? null);
      toast({ title: "Optimised picks generated", description: `12 lines using optimised formula (${result.optimiserMeta?.formulaHash}).` });
    } catch (error: any) {
      setLaneBStep("");
      toast({ title: "Optimise & generate failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLaneBRunning(false);
    }
  };

  const handleGenerate = async () => {
    if (!hasData) {
      toast({ title: "No Data", description: "Upload a dataset first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generatePicks(selectedMode, drawFitWeight, antiPopWeight, 10, activeGameId);
      setPicks(result.picks ?? result);
      setAdvancedDiff(result.diff ?? null);
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePowerHit = async () => {
    if (!hasData) return;
    setIsPowerHitRunning(true);
    setSimpleResult(null);
    setSimpleDiff(null);
    try {
      const result = await runAutoPowerHit(activeGameId, powerHitLines);
      setSimpleResult(result);
      setSimpleDiff(result.diff ?? null);
      const coverageDesc = result.isFullCoverage
        ? `${result.lineCount} lines covering all ${activeGame?.specialName || "Powerball"} numbers`
        : `${result.lineCount} lines covering top ${activeGame?.specialName || "Powerball"} numbers (${result.coveragePct}%)`;
      toast({ title: "PowerHit generated", description: coverageDesc });
    } catch (error: any) {
      toast({ title: "PowerHit failed", description: error.message, variant: "destructive" });
    } finally {
      setIsPowerHitRunning(false);
    }
  };

  const handleApplyRecommendation = () => {
    if (!recommendation) return;
    setSelectedMode(recommendation.recommendedMode);
    if (recommendation.recommendedMode === "balanced") {
      setCustomAntiPop([40]);
    }
    toast({ title: "Recommendation applied", description: `Switched to ${recommendation.recommendedStrategy} mode.` });
  };

  const isRecommended = recommendation && selectedMode === recommendation.recommendedMode;

  function getBadgeForMode(mode: typeof MODES[number]): string | null {
    if (!recommendation?.hasBenchmark || !recommendation.strategyBadges) return null;
    if (mode.strategyName && recommendation.strategyBadges[mode.strategyName]) {
      return recommendation.strategyBadges[mode.strategyName];
    }
    return null;
  }

  const anyLaneRunning = isLaneARunning || isLaneBRunning || isPowerHitRunning;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-generator-title">Pick Generator</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Generate 12 picks for a {activeGame?.displayName || "lottery"} card. Choose your lane below.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "simple" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("simple")}
            className="font-mono text-xs"
            data-testid="button-simple-mode"
          >
            Simple
          </Button>
          <Button
            variant={viewMode === "advanced" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("advanced")}
            className="font-mono text-xs"
            data-testid="button-advanced-mode"
          >
            <Settings2 className="w-3 h-3 mr-1" /> Advanced
          </Button>
        </div>
      </div>

      {viewMode === "simple" && (
        <>
          {activeGame && !activeGame.hasSupplementary && (
          <div className="flex items-center gap-3 text-xs font-mono" data-testid="pb-mode-selector">
            <span className="text-muted-foreground">{activeGame?.specialName || "PB"} Coverage:</span>
            {([
              { value: "default" as const, label: "Default", tip: `${activeGame?.specialName || "Powerball"} chosen by strategy` },
              { value: "unique_spread" as const, label: "Unique Spread", tip: `No duplicate ${activeGame?.specialName || "PB"}s across 12 lines` },
              { value: "guaranteed" as const, label: "Full Coverage", tip: `All ${activeGame?.specialName || "PB"} values 1-${activeGame?.specialPool || 20} covered` },
            ] as const).map(opt => (
              <button
                key={opt.value}
                onClick={() => setPbMode(opt.value)}
                className={`px-2.5 py-1 rounded border transition-colors ${
                  pbMode === opt.value
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "border-border/50 text-muted-foreground hover:border-border"
                }`}
                title={opt.tip}
                data-testid={`button-pb-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-green-500/30 bg-green-500/5" data-testid="card-lane-a">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Trophy className="w-5 h-5 mr-2 text-green-500" />
                  Composite No-Frequency
                  <HelpTip id="lane.cnf" />
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-500 font-mono font-bold">RECOMMENDED</span>
                </CardTitle>
                <CardDescription>
                  Uses the current validated best strategy. No optimiser involved.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleLaneA}
                  disabled={anyLaneRunning || !hasData}
                  size="lg"
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-mono font-bold"
                  data-testid="button-lane-a"
                >
                  {isLaneARunning ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2" />}
                  {isLaneARunning ? "GENERATING..." : "Generate 12 Picks"}
                  <HelpTip id="button.autoGenerate12Cnf" />
                </Button>
                <div className="mt-3 space-y-1 text-[11px] font-mono text-muted-foreground">
                  <span>No optimiser involved. Direct generation, fast and reproducible.</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/30 bg-yellow-500/5" data-testid="card-lane-b">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Beaker className="w-5 h-5 mr-2 text-yellow-500" />
                  Optimised
                  <HelpTip id="lane.optimised" />
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 font-mono font-bold">EXPERIMENTAL</span>
                </CardTitle>
                <CardDescription>
                  Runs optimiser first, then generates. Shows formula version used.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={handleLaneB}
                  disabled={anyLaneRunning || !hasData}
                  size="lg"
                  variant="outline"
                  className="w-full border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 font-mono font-bold"
                  data-testid="button-lane-b"
                >
                  {isLaneBRunning ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Beaker className="w-5 h-5 mr-2" />}
                  {isLaneBRunning ? laneBStep || "OPTIMISING..." : "Optimise & Generate 12 Picks"}
                  <HelpTip id="button.autoOptimiseAndGenerate12" />
                </Button>
                <div className="mt-3 space-y-1 text-[11px] font-mono text-muted-foreground">
                  <span>Optimiser runs first (10-30s). Fresh weights every time.</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {showSpecialBall && (
            <Card className="border-purple-500/30 bg-purple-500/5" data-testid="card-powerhit">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center text-lg">
                      <Zap className="w-5 h-5 mr-2 text-purple-500" />
                      PowerHit
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-500 font-mono font-bold">COVERAGE</span>
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {powerHitLines === (activeGame?.specialPool || 20)
                        ? `Generates ${activeGame?.specialPool || 20} lines with the same ${activeGame?.mainCount || 7} main numbers, covering every ${activeGame?.specialName || "Powerball"} (1–${activeGame?.specialPool || 20}).`
                        : `Generates ${powerHitLines} lines using the top ${activeGame?.specialName || "Powerball"} numbers by recent frequency. ${Math.round((powerHitLines / (activeGame?.specialPool || 20)) * 100)}% coverage.`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono text-muted-foreground">Lines</label>
                    <span className="text-[11px] font-mono text-purple-400 font-bold">{powerHitLines} / {activeGame?.specialPool || 20}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={activeGame?.specialPool || 20}
                      value={powerHitLines}
                      onChange={(e) => setPowerHitLines(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-purple-500 bg-purple-500/20"
                      data-testid="slider-powerhit-lines"
                    />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {[5, 10, 15, activeGame?.specialPool || 20].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setPowerHitLines(preset)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                          powerHitLines === preset
                            ? "bg-purple-500/20 border-purple-500/50 text-purple-400 font-bold"
                            : "bg-secondary/20 border-border/30 text-muted-foreground hover:border-purple-500/30"
                        }`}
                        data-testid={`button-powerhit-preset-${preset}`}
                      >
                        {preset === (activeGame?.specialPool || 20) ? `All ${preset}` : preset}
                      </button>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={handlePowerHit}
                  disabled={anyLaneRunning || !hasData}
                  size="lg"
                  variant="outline"
                  className="w-full border-purple-500/50 text-purple-500 hover:bg-purple-500/10 font-mono font-bold"
                  data-testid="button-powerhit"
                >
                  {isPowerHitRunning ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Zap className="w-5 h-5 mr-2" />}
                  {isPowerHitRunning ? "GENERATING..." : `Generate PowerHit (${powerHitLines} Lines)`}
                </Button>
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-muted-foreground">
                  <div className="p-2 rounded bg-secondary/20 border border-border/30 text-center">
                    <div className="text-purple-400 font-bold text-xs">{powerHitLines}</div>
                    <div>Lines</div>
                  </div>
                  <div className="p-2 rounded bg-secondary/20 border border-border/30 text-center">
                    <div className="text-purple-400 font-bold text-xs">{powerHitLines === (activeGame?.specialPool || 20) ? "100%" : `${Math.round((powerHitLines / (activeGame?.specialPool || 20)) * 100)}%`}</div>
                    <div>{activeGame?.specialName || "PB"} Coverage</div>
                  </div>
                  <div className="p-2 rounded bg-secondary/20 border border-border/30 text-center">
                    <div className="text-purple-400 font-bold text-xs">~${(powerHitLines * 1.575).toFixed(2)}</div>
                    <div>Est. Cost</div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/70 font-mono">
                  {powerHitLines === (activeGame?.specialPool || 20)
                    ? `Full coverage: guarantees the winning ${activeGame?.specialName || "Powerball"} is included.`
                    : `Partial coverage: top ${powerHitLines} ${activeGame?.specialName || "Powerball"} numbers selected by recent draw frequency (last 50 draws).`}
                </p>
              </CardContent>
            </Card>
          )}

          {!hasData && (
            <div className="text-center py-6 text-muted-foreground font-mono text-sm border border-dashed border-border/50 rounded-lg">
              <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-40" />
              Upload a dataset first to generate picks.
            </div>
          )}

          {simpleResult && (
            <div className="space-y-3" data-testid="simple-results">
              <RunStampCard stamp={simpleResult.runStamp} />

              {simpleResult.predictionSetId && (
                <div className="text-[10px] font-mono text-muted-foreground/50 px-1" data-testid="text-prediction-set-id">
                  Prediction Set #{simpleResult.predictionSetId}
                </div>
              )}

              {simpleResult.confidence && (
                <ConfidencePanel confidence={simpleResult.confidence} />
              )}

              {simpleResult.winner && (
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground px-1">
                  <Trophy className="w-4 h-4 text-green-500" />
                  <span>{simpleResult.winner.reason}</span>
                </div>
              )}

              {simpleResult.strategyDescription && (
                <div className="text-xs font-mono text-muted-foreground/70 px-1">
                  {simpleResult.strategyDescription}
                </div>
              )}

              {simpleDiff && (
                <ChangesSummary diff={simpleDiff} showSpecialBall={showSpecialBall} />
              )}

              <Card className="border-border">
                <CardContent className="pt-4 space-y-1">
                  {simpleResult.picks.map((pick, i) => {
                    const lm = simpleDiff?.lineMapping?.find(m => m.currentIndex === i);
                    return <GameLine key={i} pick={pick} index={i} lineMapping={lm} showSpecialBall={showSpecialBall} />;
                  })}
                </CardContent>
              </Card>

              <p className="text-[10px] text-muted-foreground/60 font-mono px-1">
                {simpleResult.disclaimer}
              </p>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => exportCSVLines(simpleResult, showSpecialBall)} data-testid="button-export-csv">
                  <Download className="w-3 h-3 mr-1.5" /> CSV (12 Lines)
                </Button>
                <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => exportJSON(simpleResult)} data-testid="button-export-json">
                  <Download className="w-3 h-3 mr-1.5" /> JSON (Full)
                </Button>
              </div>

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-details"
              >
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showDetails ? "Hide details" : "Show details"}
              </button>

              {showDetails && (
                <div className="space-y-3 pt-2 border-t border-border/30">
                  {simpleResult.optimiserMeta && (
                    <Card className="border-yellow-500/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono text-yellow-500">Optimiser Details</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs font-mono text-muted-foreground space-y-1">
                        <div>Formula hash: <span className="text-foreground">{simpleResult.optimiserMeta.formulaHash}</span></div>
                        <div>Run ID: <span className="text-foreground">{simpleResult.optimiserMeta.optimiserRunId}</span></div>
                        <div>Overfit risk: <span className={simpleResult.optimiserMeta.overfitRisk === "possible_signal" ? "text-green-500" : "text-yellow-500"}>{simpleResult.optimiserMeta.overfitRisk}</span></div>
                        <div>Verdict: <span className="text-foreground">{simpleResult.optimiserMeta.caveatedVerdict}</span></div>
                        <div>Search iterations: {simpleResult.optimiserMeta.searchIterations}</div>
                        <div>Training window: {simpleResult.optimiserMeta.trainingWindowSize} draws</div>
                        {simpleResult.optimiserMeta.walkForwardReplay && (
                          <div>Walk-forward: {simpleResult.optimiserMeta.walkForwardReplay.windowsBeating}/{simpleResult.optimiserMeta.walkForwardReplay.windows?.length ?? 0} windows beating random (avg delta: {simpleResult.optimiserMeta.walkForwardReplay.overallAvgDelta?.toFixed(3)})</div>
                        )}
                        <div className="pt-2 border-t border-border/20">
                          <div className="font-bold text-foreground/70 mb-1">Weights Used:</div>
                          {Object.entries(simpleResult.optimiserMeta.weightsUsed).map(([k, v]) => (
                            <span key={k} className="inline-block mr-3">{k}: <span className="text-foreground">{(v as number).toFixed(2)}</span></span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {simpleResult.scoreSummary && simpleResult.scoreSummary.length > 0 && (
                    <Card className="border-border/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-mono text-muted-foreground">Benchmark Scores</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs font-mono text-muted-foreground">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-border/30">
                              <th className="py-1 pr-3">Strategy</th>
                              <th className="py-1 pr-3">Avg Delta</th>
                              <th className="py-1 pr-3">Beating</th>
                              <th className="py-1">Stability</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simpleResult.scoreSummary.map(s => (
                              <tr key={s.strategy} className={`border-b border-border/10 ${s.strategy === simpleResult.winner?.strategy ? 'text-green-500' : ''}`}>
                                <td className="py-1 pr-3">{s.strategy}</td>
                                <td className="py-1 pr-3">{s.avgDelta >= 0 ? "+" : ""}{s.avgDelta.toFixed(3)}</td>
                                <td className="py-1 pr-3">{s.windowsBeating}/{s.windowsTested}</td>
                                <td className="py-1"><StabilityBadge stabilityClass={s.stabilityClass} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </CardContent>
                    </Card>
                  )}

                  {simpleResult.runConfigUsed && (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] font-mono text-muted-foreground/60 px-1">
                      <span>Mode: {simpleResult.runConfigUsed.benchmarkMode}</span>
                      <span>Windows: {simpleResult.runConfigUsed.windowSizes?.join("/")}</span>
                      <span>Random runs: {simpleResult.runConfigUsed.randomBaselineRuns}</span>
                      <span>Seed: {simpleResult.runConfigUsed.seed}</span>
                      <span>Regime splits: {simpleResult.runConfigUsed.regimeSplits ? "ON" : "OFF"}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {viewMode === "advanced" && (
        <>
          {recommendation && (
            <Card className={`border-border ${
              !recommendation.hasBenchmark ? "border-orange-500/30 bg-orange-500/5" :
              recommendation.confidence === "high" ? "border-green-500/30 bg-green-500/5" :
              recommendation.confidence === "medium" ? "border-yellow-500/30 bg-yellow-500/5" :
              "border-orange-500/30 bg-orange-500/5"
            }`} data-testid="card-recommendation">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  {recommendation.hasBenchmark ? <Sparkles className="w-5 h-5 mr-2 text-yellow-500" /> : <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />}
                  <Tip label="Recommended Technique" tip="This recommendation is automatically generated based on the latest benchmark validation results. It picks the strategy and mode most supported by the evidence." />
                </CardTitle>
                <CardDescription>
                  {recommendation.hasBenchmark ? "Based on latest benchmark validation results" : "No benchmark data available yet"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold font-mono" data-testid="text-recommended-strategy">{recommendation.recommendedStrategy}</span>
                      {isRecommended && (
                        <span className="inline-block px-2 py-0.5 rounded border text-xs font-mono font-bold bg-green-500/20 text-green-500 border-green-500/30">SELECTED</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <Tip label={`Confidence: ${recommendation.confidence.toUpperCase()}`}
                        tip="How strongly the benchmark evidence supports this recommendation. HIGH = consistent results across multiple windows."
                        className={`px-2 py-0.5 rounded border ${
                          recommendation.confidence === "high" ? "border-green-500/30 text-green-500" :
                          recommendation.confidence === "medium" ? "border-yellow-500/30 text-yellow-500" :
                          "border-orange-500/30 text-orange-500"
                        }`} />
                      {recommendation.evidence && (
                        <Tip label={`Delta: ${recommendation.evidence.bestAvgDelta >= 0 ? "+" : ""}${recommendation.evidence.bestAvgDelta}`}
                          tip="Average number of extra main-ball matches per draw compared to random across all tested windows."
                          className={`font-bold ${recommendation.evidence.bestAvgDelta > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">{recommendation.reasonSummary}</p>

                    {recommendation.evidence && (
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground pt-2 border-t border-border/30">
                        <Tip label={`Best: ${recommendation.evidence.bestStrategy}`} tip="The strategy with the highest average delta vs random across all tested windows." />
                        <Tip label={`Windows: ${recommendation.evidence.windowsTested.join(", ")}`} tip="The test window sizes used in the benchmark (number of draws per test window)." />
                        <Tip label={`Strategies: ${recommendation.evidence.strategiesTested}`} tip="Total number of predictive strategies tested in the benchmark." />
                      </div>
                    )}
                  </div>

                  {!isRecommended && (
                    <Button onClick={handleApplyRecommendation} variant="outline" className="shrink-0 border-primary/50 text-primary hover:bg-primary/10 font-mono" data-testid="button-apply-recommendation">
                      <ArrowRight className="w-4 h-4 mr-2" /> APPLY
                    </Button>
                  )}
                </div>

                {recommendation.regimeAware && recommendation.regimeRecommendations && recommendation.regimeRecommendations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <Shield className="w-3 h-3" />
                      <span>Regime Analysis {recommendation.regimeBasis === "consensus" ? "(consistent)" : recommendation.regimeBasis === "recent_regime" ? "(recent-biased)" : ""}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recommendation.regimeRecommendations.map(r => (
                        <div key={r.regime} className="text-[10px] font-mono px-2 py-1 rounded border border-border/30 bg-secondary/10">
                          <span className="text-muted-foreground">{r.regime.replace(/_/g, " ")}:</span>{" "}
                          <span className={r.bestAvgDelta > 0 ? "text-green-500" : "text-muted-foreground"}>{r.bestStrategy}</span>
                          <span className="text-muted-foreground/60 ml-1">({r.bestAvgDelta >= 0 ? "+" : ""}{r.bestAvgDelta.toFixed(3)})</span>
                        </div>
                      ))}
                    </div>
                    {recommendation.regimeCaveat && (
                      <p className="text-[10px] text-muted-foreground/60 font-mono">{recommendation.regimeCaveat}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={isGenerating || !hasData} className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-bold" data-testid="button-generate">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {isGenerating ? "GENERATING..." : "GENERATE (TOP 10)"}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Model Objective</CardTitle>
                  <CardDescription>Choose generation strategy</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {MODES.map((mode, i) => {
                    const prevMode = i > 0 ? MODES[i - 1] : null;
                    const showFreqLabel = mode.group === "frequency" && prevMode?.group !== "frequency";
                    const showSmoothedLabel = mode.group === "smoothed" && prevMode?.group !== "smoothed";
                    const badge = getBadgeForMode(mode);
                    const modeIsRecommended = recommendation?.hasBenchmark && recommendation.recommendedMode === mode.value;
                    return (
                      <div key={mode.value}>
                        {showFreqLabel && (
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2 mt-1 border-t border-border/30 pt-3">Frequency Benchmark</div>
                        )}
                        {showSmoothedLabel && (
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2 mt-1 border-t border-border/30 pt-3">Smoothed / Bayesian</div>
                        )}
                        <button
                          onClick={() => setSelectedMode(mode.value)}
                          className={`w-full text-left p-3 rounded-md border transition-colors ${
                            selectedMode === mode.value
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border/50 hover:border-border hover:bg-secondary/30 text-muted-foreground"
                          }`}
                          data-testid={`button-mode-${mode.value}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-sm flex items-center gap-2">
                              {mode.label}
                              {modeIsRecommended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 font-mono font-bold">REC</span>}
                            </div>
                            {badge && <StabilityBadge stabilityClass={badge} />}
                          </div>
                          <div className="text-xs opacity-70 mt-0.5">{mode.description}</div>
                        </button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {selectedMode === "balanced" && (
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-lg">Custom Weights</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between text-sm font-mono">
                      <Tip label="Draw-Fit" tip="Weight given to historical pattern signals (frequency, recency, structure, trends). Higher = picks lean more toward numbers that match past draw patterns." className="text-primary" />
                      <span className="font-bold text-primary">{drawFitWeight}%</span>
                    </div>
                    <div className="flex justify-between text-sm font-mono">
                      <Tip label="Anti-Popularity" tip="Weight given to avoiding popular number choices. Higher = picks lean more toward combinations other players are unlikely to choose, reducing split risk." className="text-yellow-500" />
                      <span className="font-bold text-yellow-500">{antiPopWeight}%</span>
                    </div>
                    <Slider defaultValue={[40]} max={100} step={5} onValueChange={setCustomAntiPop} data-testid="slider-anti-pop" />
                  </CardContent>
                </Card>
              )}

              <Card className="border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Anti-Popularity Penalties</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 font-mono text-xs">
                  <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Birthday concentration (≤31)" tip="Penalises picks where too many numbers are 31 or below, since many players pick birthdates. Avoiding these reduces the chance of splitting a prize." className="text-muted-foreground" /></div>
                  <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Sequence detection" tip="Penalises consecutive number runs like 5-6-7. Sequences are a common player favourite, so avoiding them means fewer co-winners." className="text-muted-foreground" /></div>
                  <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Repeated endings" tip="Penalises picks where multiple numbers share the same last digit (e.g. 5, 15, 25). These patterns are popular with players." className="text-muted-foreground" /></div>
                  <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Aesthetic pattern" tip="Penalises visually 'neat' patterns people tend to pick, like evenly spaced numbers or symmetric arrangements on the ticket grid." className="text-muted-foreground" /></div>
                  {showSpecialBall && (
                  <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label={`Low ${activeGame?.specialName || "Powerball"} bias`} tip={`Penalises very low ${activeGame?.specialName || "Powerball"} numbers (1–5). Many players gravitate to small numbers, increasing split risk.`} className="text-muted-foreground" /></div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-medium font-mono text-muted-foreground mb-4 border-b border-border/50 pb-2">
                GENERATED CANDIDATES [{currentMode.label.toUpperCase()}]
              </h3>

              {picks.length > 0 && advancedDiff && (
                <ChangesSummary diff={advancedDiff} showSpecialBall={showSpecialBall} />
              )}

              {picks.length > 0 ? (
                <div className="space-y-3">
                  {picks.map((pick, i) => {
                    const diff = advancedDiff?.lineMapping?.find(m => m.currentIndex === i);
                    return (
                    <div key={i} className={`p-4 rounded-lg border ${i === 0 ? 'bg-primary/5 border-primary/30' : 'bg-card border-border/50'} relative overflow-hidden group hover:border-primary/50 transition-colors`} data-testid={`card-pick-${pick.rank}`}>
                      {i === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>}

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex flex-col items-center w-8">
                            <div className={`text-center font-mono font-bold text-lg ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                              #{pick.rank}
                            </div>
                            {pick.sourceStrategy && (
                              <span className="text-[9px] font-mono text-muted-foreground truncate max-w-[80px] text-center leading-tight" title={pick.sourceStrategy}>
                                {pick.sourceStrategy.replace(/\(.*\)/, "").trim()}
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-1.5">
                            {(() => {
                              const addedSet = diff ? new Set(diff.addedMains) : new Set<number>();
                              return pick.numbers.map((n, idx) => {
                                const isNew = addedSet.has(n);
                                return (
                                <div key={idx} className={`w-9 h-9 rounded flex items-center justify-center font-mono text-sm border shadow-sm ${
                                  isNew
                                    ? "bg-green-500/20 border-green-500/50 text-green-300 ring-1 ring-green-500/30"
                                    : "bg-secondary border-border/80"
                                }`} title={isNew ? "New this run" : undefined}>
                                  {n.toString().padStart(2, '0')}
                                </div>
                                );
                              });
                            })()}
                            {showSpecialBall && (
                            <div className={`w-9 h-9 rounded flex items-center justify-center font-mono text-sm font-bold shadow-sm ml-1 relative ${
                              diff?.pbChanged
                                ? "bg-green-500/20 text-green-300 border border-green-500/50 ring-1 ring-green-500/30"
                                : "bg-primary/20 text-primary border border-primary/30"
                            }`}>
                              <Zap className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500" />
                              {pick.powerball.toString().padStart(2, '0')}
                            </div>
                            )}
                          </div>
                          {diff && diff.linePercentChanged > 0 && (
                            <span className="text-[10px] font-mono text-green-400/70 ml-1">
                              {diff.linePercentChanged}% changed
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-3 ml-12 md:ml-0 font-mono text-xs">
                          <div className="flex flex-col items-end">
                            <Tip label="Draw-Fit" tip="How well these numbers match historical patterns — frequency, recency, structure, and trend signals. Higher = better fit to past draws." className="text-muted-foreground" />
                            <span className="text-primary">{pick.drawFit}</span>
                          </div>
                          <div className="w-px h-8 bg-border"></div>
                          <div className="flex flex-col items-end">
                            <Tip label="Anti-Pop" tip="How unpopular this combination is among typical players. Higher = fewer people likely picked these numbers, meaning less chance of splitting a jackpot." className="text-muted-foreground" />
                            <span className="text-yellow-500">{pick.antiPop}</span>
                          </div>
                          <div className="w-px h-8 bg-border"></div>
                          <div className="flex flex-col items-end">
                            <Tip label="SCORE" tip="The final combined score, blending Draw-Fit and Anti-Pop based on the weights set by your chosen mode. Higher = better overall pick." className="text-muted-foreground font-bold" />
                            <span className={`font-bold ${i === 0 ? 'text-primary text-base' : ''}`}>{pick.finalScore.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      {pick.antiPopBreakdown && (
                        <div className="mt-3 pt-3 border-t border-border/30 flex gap-4 text-xs font-mono text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Penalties:</span>
                          {pick.antiPopBreakdown.birthdayPenalty > 0 && <span className="text-orange-400">Birthday -{pick.antiPopBreakdown.birthdayPenalty}</span>}
                          {pick.antiPopBreakdown.sequencePenalty > 0 && <span className="text-orange-400">Sequence -{pick.antiPopBreakdown.sequencePenalty}</span>}
                          {pick.antiPopBreakdown.repeatedEndingPenalty > 0 && <span className="text-orange-400">Endings -{pick.antiPopBreakdown.repeatedEndingPenalty}</span>}
                          {pick.antiPopBreakdown.aestheticPenalty > 0 && <span className="text-orange-400">Pattern -{pick.antiPopBreakdown.aestheticPenalty}</span>}
                          {showSpecialBall && pick.antiPopBreakdown.lowPowerballPenalty > 0 && <span className="text-orange-400">Low {activeGame?.specialName || "PB"} -{pick.antiPopBreakdown.lowPowerballPenalty}</span>}
                          {Object.values(pick.antiPopBreakdown).every(v => v === 0) && <span className="text-green-500">None (clean pick)</span>}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10">
                  <SearchX className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-mono">{hasData ? "Click GENERATE to create picks." : "No data loaded."}</p>
                  <p className="text-sm opacity-70 mt-1">{hasData ? "Select a mode and generate." : "Upload data first."}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
