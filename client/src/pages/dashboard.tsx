import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Database, Zap, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import type { ValidationSummary } from "@shared/schema";

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const { data: draws } = useQuery({ queryKey: ["/api/draws"], queryFn: () => fetchApi("/api/draws") });
  const { data: validation } = useQuery<ValidationSummary>({ queryKey: ["/api/analysis/validation"], queryFn: () => fetchApi("/api/analysis/validation"), enabled: !!stats?.modernDraws });

  const hasData = stats?.totalDraws > 0;
  const recentDraws = (draws || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">System Overview</h1>
        <p className="text-muted-foreground mt-2">
          {hasData ? "Dataset loaded. All engines operational." : "Waiting for dataset upload."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Draws</CardTitle>
            <Database className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-draws">{stats?.totalDraws?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Latest: {stats?.latestDate ?? "None"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Modern Era</CardTitle>
            <Activity className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-modern-draws">{stats?.modernDraws?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{hasData ? "7+1 format" : "Awaiting data"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Validation Verdict</CardTitle>
            <ShieldAlert className={`w-4 h-4 ${validation?.verdict === "possible_edge" ? "text-green-500" : validation?.verdict === "weak_edge" ? "text-yellow-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${
              validation?.verdict === "possible_edge" ? "text-green-500" :
              validation?.verdict === "weak_edge" ? "text-yellow-500" :
              validation?.verdict === "no_edge" ? "text-orange-500" : "text-muted-foreground"
            }`}>
              {validation?.verdict ? validation.verdict.replace(/_/g, " ").toUpperCase() : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Walk-forward tested</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Composite vs Random</CardTitle>
            <Zap className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {validation?.diagnostics ? `${validation.diagnostics.compositeVsRandomDelta >= 0 ? "+" : ""}${validation.diagnostics.compositeVsRandomDelta}` : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{hasData ? "Avg main match delta" : "Awaiting data"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="border-border flex flex-col">
          <CardHeader>
            <CardTitle>Recent Draws</CardTitle>
            <CardDescription>AU Modern Format: 7 mains + Powerball</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {recentDraws.length > 0 ? (
              <div className="space-y-3">
                {recentDraws.map((draw: any) => (
                  <div key={draw.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50" data-testid={`row-draw-${draw.drawNumber}`}>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-muted-foreground">#{draw.drawNumber}</span>
                      <span className="text-xs text-muted-foreground/70">{draw.drawDate}</span>
                    </div>
                    <div className="flex space-x-1.5">
                      {(draw.numbers as number[]).map((n: number, i: number) => (
                        <div key={i} className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-mono text-sm border border-border/50">
                          {n.toString().padStart(2, '0')}
                        </div>
                      ))}
                      <div className="w-8 h-8 rounded bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-mono text-sm font-bold ml-1">
                        {draw.powerball.toString().padStart(2, '0')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/20">
                <Database className="w-8 h-8 mb-2 opacity-50" />
                <p className="font-mono text-sm">No draws loaded.</p>
                <p className="text-xs opacity-70">Upload a CSV in Data Ingest.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border flex flex-col">
          <CardHeader>
            <CardTitle>Strategy Benchmarks</CardTitle>
            <CardDescription>Walk-forward backtest performance</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {validation && validation.byStrategy.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium p-2 text-muted-foreground">Strategy</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">Avg Main</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">Best</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">PB Hit%</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {validation.byStrategy.map((result, i) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className={`p-3 ${result.strategy === 'Composite Model' ? 'text-primary font-bold' : ''}`}>
                          {result.strategy}
                        </td>
                        <td className="p-3 text-right">{result.avgMainMatches}</td>
                        <td className="p-3 text-right">{result.bestMainMatches}</td>
                        <td className="p-3 text-right">{result.powerballHitRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/20">
                <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                <p className="font-mono text-sm">{hasData && stats?.modernDraws < 50 ? "Need 50+ modern draws." : "Validation pending."}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
