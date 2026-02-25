import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FlaskConical, Play, Loader2, AlertTriangle, Info, ShieldAlert, BarChart3, TrendingUp, Beaker, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { FormulaLabResult, FormulaFeatureConfig } from "@shared/schema";

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

function OverfitBadge({ risk }: { risk: string }) {
  const config: Record<string, { label: string; className: string }> = {
    overfit_likely: { label: "OVERFIT LIKELY", className: "bg-red-500/20 text-red-500 border-red-500/30" },
    inconclusive: { label: "INCONCLUSIVE", className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" },
    weak_signal: { label: "WEAK SIGNAL", className: "bg-orange-500/20 text-orange-500 border-orange-500/30" },
    possible_signal: { label: "POSSIBLE SIGNAL", className: "bg-green-500/20 text-green-500 border-green-500/30" },
  };
  const c = config[risk] || config.inconclusive;
  return <span className={`inline-block px-2 py-0.5 rounded border text-xs font-mono font-bold uppercase ${c.className}`} data-testid="badge-overfit-risk">{c.label}</span>;
}

const OPTIMIZER_STAGES = [
  { id: "search", label: "Searching weight combinations", duration: 0.45 },
  { id: "replay", label: "Walk-forward replay", duration: 0.30 },
  { id: "permutation", label: "Monte Carlo permutation test", duration: 0.20 },
  { id: "scoring", label: "Scoring and ranking", duration: 0.05 },
] as const;

function OptimizerProgress({ iterations, isRunning }: { iterations: number; isRunning: boolean }) {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const startTime = useRef(Date.now());
  const estimatedMs = useRef(Math.max(3000, iterations * 15));

  useEffect(() => {
    if (!isRunning) {
      setProgress(0);
      setStageIndex(0);
      return;
    }
    startTime.current = Date.now();
    estimatedMs.current = Math.max(3000, iterations * 15);
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const rawProgress = Math.min(elapsed / estimatedMs.current, 0.95);
      setProgress(rawProgress);
      let cumulative = 0;
      let newStage = 0;
      for (let i = 0; i < OPTIMIZER_STAGES.length; i++) {
        cumulative += OPTIMIZER_STAGES[i].duration;
        if (rawProgress < cumulative) { newStage = i; break; }
        newStage = i;
      }
      setStageIndex(newStage);
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, iterations]);

  if (!isRunning) return null;

  const stage = OPTIMIZER_STAGES[stageIndex];
  const pct = Math.round(progress * 100);

  return (
    <div className="space-y-3 mt-4" data-testid="optimizer-progress">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-muted-foreground">{stage.label}...</span>
        <span className="text-primary font-bold">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-secondary/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-1">
        {OPTIMIZER_STAGES.map((s, i) => (
          <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
            <div className={`w-full h-1 rounded-full ${
              i < stageIndex ? "bg-green-500" :
              i === stageIndex ? "bg-primary animate-pulse" :
              "bg-secondary/30"
            }`} />
            <span className={`text-[10px] font-mono leading-tight text-center ${
              i < stageIndex ? "text-green-500" :
              i === stageIndex ? "text-primary" :
              "text-muted-foreground/50"
            }`}>
              {s.label.split(" ").slice(0, 2).join(" ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURE_OPTIONS: { key: keyof FormulaFeatureConfig; label: string; tip: string }[] = [
  { key: "freqTotal", label: "Frequency (Total)", tip: "Overall frequency of each number across all draws." },
  { key: "freqL50", label: "Frequency (L50)", tip: "Frequency in the last 50 draws — tests recent trends." },
  { key: "freqL20", label: "Frequency (L20)", tip: "Frequency in the last 20 draws — very short-term signal." },
  { key: "recencySinceSeen", label: "Recency (Since Seen)", tip: "How many draws since each number last appeared." },
  { key: "trendL10", label: "Trend (L10)", tip: "Short-term frequency trend (L10 vs prior L10)." },
  { key: "structureFit", label: "Structure Fit", tip: "How well the card's shape (odd/even, sum) matches historical norms." },
  { key: "carryoverAffinity", label: "Carryover Affinity", tip: "Tendency for numbers to repeat from the previous draw." },
  { key: "antiPopularity", label: "Anti-Popularity", tip: "Score for avoiding popular/birthday-biased numbers." },
];

export default function FormulaLab() {
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const hasData = stats?.modernDraws >= 50;

  const [features, setFeatures] = useState<FormulaFeatureConfig>({
    freqTotal: true, freqL50: true, freqL20: false,
    recencySinceSeen: true, trendL10: true,
    structureFit: true, carryoverAffinity: true, antiPopularity: false,
  });
  const [searchIterations, setSearchIterations] = useState([200]);
  const [regularization, setRegularization] = useState([50]);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<FormulaLabResult | null>(null);

  const toggleFeature = (key: keyof FormulaFeatureConfig) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOptimize = async () => {
    setIsRunning(true);
    try {
      const res = await fetch("/api/formula-lab/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features,
          searchIterations: searchIterations[0],
          regularizationStrength: regularization[0] / 100,
          objective: "mean_best_score",
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.message || "Optimization failed");
      setResult(json.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const enabledFeatureCount = Object.values(features).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-formula-lab-title">Formula Lab</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Search for weighted scoring formulas and test them with walk-forward replay.
        </p>
      </div>

      <Card className="border-orange-500/30 bg-orange-500/5" data-testid="card-caveat-banner">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm text-orange-200/80">
              <p className="font-bold text-orange-400">Important: Read before using Formula Lab</p>
              <p>A formula can fit historical draws in hindsight. Only walk-forward replay and benchmark comparison indicate whether the relationship generalizes.</p>
              <p>Results are experimental statistical analysis and do not guarantee future outcomes.</p>
              <p>Any apparent edge should be tested against random baselines and permutation/Monte Carlo controls.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border" data-testid="card-feature-selection">
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <Beaker className="w-4 h-4 mr-2" /> Feature Selection
              </CardTitle>
              <CardDescription className="text-xs font-mono">{enabledFeatureCount} features enabled</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FEATURE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => toggleFeature(opt.key)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md border text-sm font-mono transition-colors ${
                    features[opt.key]
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-secondary/20 text-muted-foreground"
                  }`}
                  data-testid={`toggle-feature-${opt.key}`}
                >
                  <Tip label={opt.label} tip={opt.tip} />
                  <span className="text-xs">{features[opt.key] ? "ON" : "OFF"}</span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border" data-testid="card-optimizer-settings">
            <CardHeader>
              <CardTitle className="text-base flex items-center">
                <FlaskConical className="w-4 h-4 mr-2" /> Optimizer Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <Tip label="Search Iterations" tip="Number of random weight combinations to evaluate. Higher = more thorough but slower." />
                  <span className="font-mono">{searchIterations[0]}</span>
                </div>
                <Slider value={searchIterations} onValueChange={setSearchIterations} min={50} max={500} step={50} data-testid="slider-iterations" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-2">
                  <Tip label="Regularization" tip="Penalty for formula complexity. Higher values favor simpler formulas with fewer active features, reducing overfit risk." />
                  <span className="font-mono">{regularization[0]}%</span>
                </div>
                <Slider value={regularization} onValueChange={setRegularization} min={0} max={100} step={10} data-testid="slider-regularization" />
              </div>

              <Button
                onClick={handleOptimize}
                disabled={isRunning || !hasData || enabledFeatureCount === 0}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-bold"
                data-testid="button-optimize"
              >
                {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {isRunning ? "OPTIMIZING..." : "RUN OPTIMIZER + REPLAY"}
              </Button>

              <OptimizerProgress iterations={searchIterations[0]} isRunning={isRunning} />

              {!hasData && (
                <p className="text-xs text-muted-foreground font-mono text-center">Need 50+ modern draws to run Formula Lab.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!result && !isRunning && (
            <Card className="border-border border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <FlaskConical className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-mono text-sm">Configure features and run the optimizer to see results.</p>
                <p className="text-xs opacity-60 mt-1">The optimizer will search for weight combinations, then replay them walk-forward.</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              <Card className={`border-border ${
                result.overfitRisk === "possible_signal" ? "border-green-500/30" :
                result.overfitRisk === "overfit_likely" ? "border-red-500/30" :
                "border-yellow-500/30"
              }`} data-testid="card-verdict">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5" />
                    Caveated Verdict
                    <OverfitBadge risk={result.overfitRisk} />
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">Retrospective fit + walk-forward replay assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{result.caveatedVerdict}</p>
                  <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/5 border border-orange-500/20">
                    <AlertTriangle className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
                    <p className="text-xs text-orange-400/90">Results depend on the selected date range, rule era, and data quality. This does not guarantee future outcomes.</p>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border" data-testid="card-retrospective">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center">
                      <BarChart3 className="w-4 h-4 mr-2" />
                      <Tip label="Retrospective Fit" tip="How well the formula explains historical data it was trained on. High fit alone does NOT indicate prediction — it may reflect overfitting." />
                    </CardTitle>
                    <CardDescription className="text-xs font-mono text-orange-400">IN-SAMPLE ONLY — not predictive evidence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">In-Sample Score</span>
                        <div className="text-lg font-mono font-bold">{result.retrospectiveFit.inSampleScore.toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Complexity Penalty</span>
                        <div className="text-lg font-mono font-bold text-orange-400">-{result.retrospectiveFit.complexityPenalty.toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Adjusted Score</span>
                        <div className="text-lg font-mono font-bold">{result.retrospectiveFit.adjustedScore.toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Train Draws</span>
                        <div className="text-lg font-mono font-bold">{result.retrospectiveFit.trainDrawsUsed}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {result.walkForwardReplay && (
                  <Card className="border-border" data-testid="card-replay">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center">
                        <TrendingUp className="w-4 h-4 mr-2" />
                        <Tip label="Walk-Forward Replay" tip="Tests the formula on draws it has never seen, using only past data for training. This is the real test of generalization." />
                      </CardTitle>
                      <CardDescription className="text-xs font-mono text-green-400">OUT-OF-SAMPLE — tests generalization</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Avg Delta vs Random</span>
                          <div className={`text-lg font-mono font-bold ${result.walkForwardReplay.overallAvgDelta > 0 ? "text-green-500" : "text-red-500"}`}>
                            {result.walkForwardReplay.overallAvgDelta >= 0 ? "+" : ""}{result.walkForwardReplay.overallAvgDelta.toFixed(3)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Windows Beating</span>
                          <div className="text-lg font-mono font-bold">{result.walkForwardReplay.windowsBeating} / {result.walkForwardReplay.windows.length}</div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Windows Losing</span>
                          <div className="text-lg font-mono font-bold text-red-400">{result.walkForwardReplay.windowsLosing}</div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Stability</span>
                          <Badge variant="outline" className={
                            result.walkForwardReplay.stability === "possible_edge" ? "bg-green-500/20 text-green-500" :
                            result.walkForwardReplay.stability === "weak_edge" ? "bg-yellow-500/20 text-yellow-500" :
                            result.walkForwardReplay.stability === "underperforming" ? "bg-red-500/20 text-red-500" :
                            "bg-muted text-muted-foreground"
                          }>{result.walkForwardReplay.stability.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {result.walkForwardReplay && result.walkForwardReplay.windows.length > 0 && (
                <Card className="border-border" data-testid="card-replay-windows">
                  <CardHeader>
                    <CardTitle className="text-base">Replay Windows</CardTitle>
                    <CardDescription className="text-xs font-mono">Walk-forward results by test window size</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border border-border/50 overflow-hidden">
                      <table className="w-full text-sm font-mono text-left">
                        <thead className="bg-secondary/50">
                          <tr>
                            <th className="p-2 text-muted-foreground font-medium">Window</th>
                            <th className="p-2 text-muted-foreground font-medium">Test</th>
                            <th className="p-2 text-muted-foreground font-medium">Train</th>
                            <th className="p-2 text-muted-foreground font-medium">Avg Main</th>
                            <th className="p-2 text-muted-foreground font-medium">Best</th>
                            <th className="p-2 text-muted-foreground font-medium">PB Hit %</th>
                            <th className="p-2 text-muted-foreground font-medium">Delta</th>
                            <th className="p-2 text-muted-foreground font-medium">Beats?</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {result.walkForwardReplay.windows.map((w) => (
                            <tr key={w.windowSize} className="hover:bg-secondary/20">
                              <td className="p-2 font-bold text-primary">{w.windowSize}</td>
                              <td className="p-2">{w.testDraws}</td>
                              <td className="p-2">{w.trainDraws}</td>
                              <td className="p-2">{w.avgMainMatches}</td>
                              <td className="p-2">{w.bestMainMatches}</td>
                              <td className="p-2">{w.pbHitRate}%</td>
                              <td className={`p-2 font-bold ${w.deltaVsRandom > 0 ? "text-green-500" : w.deltaVsRandom < 0 ? "text-red-500" : ""}`}>
                                {w.deltaVsRandom >= 0 ? "+" : ""}{w.deltaVsRandom}
                              </td>
                              <td className="p-2">
                                {w.beatsRandom ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-400" />}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.permutationTest && (
                <Card className="border-border border-purple-500/20" data-testid="card-permutation">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center">
                      <Beaker className="w-4 h-4 mr-2" />
                      <Tip label="Permutation Test" tip="Shuffles the feature-outcome relationship and reruns the formula to test whether the observed performance could arise by chance. Lower p-value = less likely to be random." />
                    </CardTitle>
                    <CardDescription className="text-xs font-mono">Monte Carlo significance test ({result.permutationTest.permutationsRun} permutations)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Observed Delta</span>
                        <div className="text-lg font-mono font-bold">{result.permutationTest.observedDelta >= 0 ? "+" : ""}{result.permutationTest.observedDelta}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Permutation Mean</span>
                        <div className="text-lg font-mono font-bold text-muted-foreground">{result.permutationTest.permutationMean >= 0 ? "+" : ""}{result.permutationTest.permutationMean}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Empirical p-value</span>
                        <div className={`text-lg font-mono font-bold ${result.permutationTest.empiricalPValue < 0.05 ? "text-green-500" : result.permutationTest.empiricalPValue < 0.2 ? "text-yellow-500" : "text-muted-foreground"}`}>
                          p={result.permutationTest.empiricalPValue}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Percentile</span>
                        <div className="text-lg font-mono font-bold">{result.permutationTest.percentile}th</div>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-md border border-border/50">{result.permutationTest.interpretation}</p>
                    <div className="flex items-start gap-2 p-3 rounded-md bg-purple-500/5 border border-purple-500/20 mt-3">
                      <Info className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-purple-400/90">This is an experimental significance test. A low p-value suggests the formula's performance is unlikely due to chance alone, but does not prove causality or guarantee future results.</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {result.topCandidates.length > 0 && (
                <Card className="border-border" data-testid="card-top-formulas">
                  <CardHeader>
                    <CardTitle className="text-base">Top Formula Candidates</CardTitle>
                    <CardDescription className="text-xs font-mono">
                      Best {result.topCandidates.length} weight sets from {result.config.searchIterations} iterations
                      <span className="text-orange-400 ml-2">(retrospective fit — not predictive evidence)</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.topCandidates.map((c) => (
                        <div key={c.rank} className={`p-3 rounded-md border ${c.rank === 1 ? "border-primary/30 bg-primary/5" : "border-border/50 bg-secondary/10"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono font-bold text-primary">#{c.rank}</span>
                            <div className="flex gap-3 text-xs font-mono text-muted-foreground">
                              <span>Score: <span className="text-foreground font-bold">{c.adjustedScore.toFixed(3)}</span></span>
                              <span>Penalty: <span className="text-orange-400">-{c.complexityPenalty.toFixed(3)}</span></span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(c.scoreBreakdown).map(([key, val]) => (
                              <span key={key} className="text-xs font-mono px-2 py-0.5 rounded bg-secondary/50 border border-border/30">
                                {key}: <span className={val > 0 ? "text-green-400" : val < 0 ? "text-red-400" : ""}>{val > 0 ? "+" : ""}{val}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
