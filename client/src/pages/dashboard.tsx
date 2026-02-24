import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { mockDraws, mockValidationResults } from "@/lib/mock-data";
import { Activity, Database, Zap, ShieldAlert } from "lucide-react";

export default function Dashboard() {
  const hasData = mockDraws.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-muted-foreground mt-2">
          Powerball Pattern Lab is active. Waiting for dataset upload.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Draws</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{hasData ? "1,445" : "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Latest: {hasData ? mockDraws[0].date : "None"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Patterns</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{hasData ? "24" : "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{hasData ? "+3 in last 10 draws" : "Awaiting data"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Model Confidence</CardTitle>
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{hasData ? "68.2%" : "0%"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Walk-forward validated</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Split Risk</CardTitle>
            <Zap className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{hasData ? "Low" : "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Anti-popularity inactive</p>
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
            {hasData ? (
              <div className="space-y-4">
                {mockDraws.map(draw => (
                  <div key={draw.draw_id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-muted-foreground">Draw {draw.draw_id}</span>
                      <span className="text-xs text-muted-foreground/70">{draw.date}</span>
                    </div>
                    <div className="flex space-x-2">
                      {draw.numbers.map((n: number, i: number) => (
                        <div key={i} className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-mono text-sm border border-border/50">
                          {n.toString().padStart(2, '0')}
                        </div>
                      ))}
                      <div className="w-8 h-8 rounded bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-mono text-sm font-bold ml-2">
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
            {hasData ? (
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
                    {mockValidationResults.map((result, i) => (
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