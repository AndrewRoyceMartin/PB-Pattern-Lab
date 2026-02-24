import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Target, GitCompare, LayoutDashboard, TrendingUp, BarChart3, Info, Play, Loader2, Download, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi, runBenchmark } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { ValidationSummary, BenchmarkSummary } from "@shared/schema";

export default function Validation() {
  const { toast } = useToast();
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const { data: validation } = useQuery<ValidationSummary>({ queryKey: ["/api/analysis/validation"], queryFn: () => fetchApi("/api/analysis/validation"), enabled: !!stats?.modernDraws });

  const [benchmark, setBenchmark] = useState<BenchmarkSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedWindows, setSelectedWindows] = useState([20, 40, 60, 100]);

  const hasData = validation && validation.verdict !== "insufficient_data";

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    try {
      const result = await runBenchmark(selectedWindows, 100);
      setBenchmark(result);
      toast({ title: "Benchmark complete", description: `Tested ${result.windowSizesTested.length} windows across ${result.stabilityByStrategy.length} strategies.` });
    } catch (error: any) {
      toast({ title: "Benchmark failed", description: error.message, variant: "destructive" });
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportCSV = () => {
    if (!benchmark) return;
    const headers = ["Window", "Strategy", "Test Draws", "Train Draws", "Avg Match", "Best Match", "PB Rate%", "Delta vs Random", "Beats Random"];
    const rows = benchmark.byWindowByStrategy.map(r =>
      [r.windowSize, r.strategy, r.testDraws, r.trainDraws, r.avgMainMatches, r.bestMainMatches, r.powerballHitRate, r.deltaVsRandom, r.beatsRandom ? "YES" : "NO"].join(",")
    );
    const stabilityHeaders = ["Strategy", "Windows Tested", "Windows Beating", "Windows Losing", "Avg Delta", "Stability Class"];
    const stabilityRows = benchmark.stabilityByStrategy.map(s =>
      [s.strategy, s.windowsTested, s.windowsBeating, s.windowsLosing, s.avgDelta, s.stabilityClass].join(",")
    );
    const csv = [
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
    a.download = `benchmark_${new Date().toISOString().slice(0, 10)}.csv`;
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
                        const isMostDrawn = result.strategy.startsWith("Most Drawn");
                        return (
                          <tr key={i} className={`hover:bg-secondary/20 transition-colors ${isMostDrawn ? "bg-blue-500/5" : ""}`}>
                            <td className={`p-3 font-bold ${isMostDrawn ? "text-blue-400" : isRandom ? "text-muted-foreground" : ""}`}>{result.strategy}</td>
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
                Most Drawn strategies are descriptive benchmarks based on historical frequency. They do not imply future draws are dependent on past draws — lottery outcomes are independent events.
              </p>
              <p className="font-mono">
                {anyBeat
                  ? `${bestMD.strategy} averaged ${bestMD.avgMainMatches} main matches vs ${randomAvg} for random (delta ${bestDelta >= 0 ? "+" : ""}${bestDelta.toFixed(2)}). While this shows a positive result in this test window, frequency patterns should be monitored across multiple windows for consistency.`
                  : `No Most Drawn variant beat random in this walk-forward test. This is expected — lottery draws are designed to be random. The anti-popularity engine remains the most practical edge.`
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

        <div className="flex gap-2 mb-6">
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
                        <th className="p-3 text-muted-foreground font-medium text-center">Windows Tested</th>
                        <th className="p-3 text-muted-foreground font-medium text-center">Beating Random</th>
                        <th className="p-3 text-muted-foreground font-medium text-center">Losing to Random</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">Avg Delta</th>
                        <th className="p-3 text-muted-foreground font-medium text-right">Stability</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {benchmark.stabilityByStrategy.map((s, i) => (
                        <tr key={i} className="hover:bg-secondary/20 transition-colors">
                          <td className={`p-3 font-bold ${s.strategy.startsWith("Most Drawn") ? "text-blue-400" : ""}`}>{s.strategy}</td>
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
                              <th className="p-2.5 text-muted-foreground font-medium text-center">Beats?</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {windowRows.map((r, j) => (
                              <tr key={j} className={`hover:bg-secondary/20 transition-colors ${r.strategy.startsWith("Most Drawn") ? "bg-blue-500/5" : ""}`}>
                                <td className={`p-2.5 font-bold ${r.strategy === "Random" ? "text-muted-foreground" : r.strategy.startsWith("Most Drawn") ? "text-blue-400" : ""}`}>
                                  {r.strategy}
                                </td>
                                <td className="p-2.5 text-right font-bold">{r.avgMainMatches}</td>
                                <td className="p-2.5 text-right">{r.bestMainMatches}/7</td>
                                <td className="p-2.5 text-right">{r.powerballHitRate}%</td>
                                <td className={`p-2.5 text-right font-bold ${r.strategy === "Random" ? "text-muted-foreground" : r.deltaVsRandom > 0 ? "text-green-500" : r.deltaVsRandom < 0 ? "text-red-500" : ""}`}>
                                  {r.strategy === "Random" ? "--" : `${r.deltaVsRandom >= 0 ? "+" : ""}${r.deltaVsRandom}`}
                                </td>
                                <td className="p-2.5 text-center">
                                  {r.strategy === "Random" ? "--" : r.beatsRandom ? <span className="text-green-500 font-bold">YES</span> : <span className="text-muted-foreground">NO</span>}
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
      </div>
    </div>
  );
}
