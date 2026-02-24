import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Target, GitCompare, LayoutDashboard, TrendingUp, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { ValidationSummary } from "@shared/schema";

export default function Validation() {
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const { data: validation } = useQuery<ValidationSummary>({ queryKey: ["/api/analysis/validation"], queryFn: () => fetchApi("/api/analysis/validation"), enabled: !!stats?.modernDraws });

  const hasData = validation && validation.verdict !== "insufficient_data";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-validation-title">Validation Engine</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Walk-forward backtest, strategy benchmarks, and edge classification.
        </p>
      </div>

      {/* Top-line Verdict */}
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
                  {validation.verdict.replace(/_/g, " ").toUpperCase()}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{validation.verdictExplanation}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Strategy Table */}
        <Card className="border-border col-span-1 md:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitCompare className="w-5 h-5 mr-2" /> Strategy Comparison
            </CardTitle>
            <CardDescription>
              {hasData ? `${validation.diagnostics.testSetSize} test draws, ${validation.diagnostics.trainSetSize} training draws` : "Performance against historical out-of-sample draws"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {hasData ? (
              <div className="space-y-5">
                {validation.byStrategy.map((result, i) => {
                  const isComposite = result.strategy === "Composite Model";
                  const barValue = Math.min(100, (result.avgMainMatches / 7) * 100);
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between items-center text-sm font-mono">
                        <span className={`font-bold ${isComposite ? 'text-primary' : ''}`}>{result.strategy}</span>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>Best: {result.bestMainMatches}/7</span>
                          <span>PB: {result.powerballHits}/{result.testDraws} ({result.powerballHitRate}%)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={barValue} className="h-2 flex-1" />
                        <span className={`font-mono text-sm font-bold w-12 text-right ${isComposite ? 'text-primary' : ''}`}>
                          {result.avgMainMatches}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/10">
                <LayoutDashboard className="w-8 h-8 mb-2 opacity-30" />
                <p className="font-mono text-sm">{stats?.modernDraws > 0 ? "Need 50+ modern draws for validation." : "Awaiting dataset upload."}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Cards */}
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

      {/* Rolling Windows */}
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
    </div>
  );
}
