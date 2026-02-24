import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Database, Zap, ShieldAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetch("/api/stats").then(r => r.json()) });
  const { data: draws } = useQuery({ queryKey: ["/api/draws"], queryFn: () => fetch("/api/draws").then(r => r.json()) });
  const { data: validation } = useQuery({ queryKey: ["/api/analysis/validation"], queryFn: () => fetch("/api/analysis/validation").then(r => r.json()), enabled: !!stats?.modernDraws });

  const hasData = stats?.totalDraws > 0;
  const recentDraws = (draws || []).slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">System Overview</h1>
        <p className="text-muted-foreground mt-2">
          {hasData ? "Powerball Pattern Lab is active. Dataset loaded." : "Powerball Pattern Lab is active. Waiting for dataset upload."}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Modern Era Draws</CardTitle>
            <Activity className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-modern-draws">{stats?.modernDraws?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{hasData ? "7+1 format" : "Awaiting data"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Model Confidence</CardTitle>
            <ShieldAlert className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              {validation && hasData ? `${((validation.find((v: any) => v.strategy === "Composite Model")?.avgMainMatches || 0) / 7 * 100).toFixed(1)}%` : "0%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Walk-forward validated</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Split Risk</CardTitle>
            <Zap className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{hasData ? "Active" : "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{hasData ? "Anti-popularity ready" : "Anti-popularity inactive"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="border-border flex flex-col">
          <CardHeader>
            <CardTitle>Recent Draws (AU Modern)</CardTitle>
            <CardDescription>Normalized format: 7 mains + Powerball</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {recentDraws.length > 0 ? (
              <div className="space-y-4">
                {recentDraws.map((draw: any) => (
                  <div key={draw.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50" data-testid={`row-draw-${draw.drawNumber}`}>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-muted-foreground">Draw {draw.drawNumber}</span>
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
                <p className="font-mono text-sm">No draws processed yet.</p>
                <p className="text-xs opacity-70">Please upload a dataset in Data Ingest.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border flex flex-col">
          <CardHeader>
            <CardTitle>Baseline Comparisons</CardTitle>
            <CardDescription>Walk-forward validation results across strategies</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {validation && hasData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium p-2 text-muted-foreground">Strategy</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">Avg Main Match</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">PB Hit Rate</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {validation.map((result: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className={`p-3 ${result.strategy === 'Composite Model' ? 'text-primary font-bold' : ''}`}>
                          {result.strategy}
                        </td>
                        <td className="p-3 text-right">{result.avgMainMatches}</td>
                        <td className="p-3 text-right">{result.powerballHitRate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/20">
                <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                <p className="font-mono text-sm">Validation pending.</p>
                <p className="text-xs opacity-70">Waiting for data to run backtests.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
