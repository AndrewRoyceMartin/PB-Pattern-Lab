import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { mockDraws, mockValidationResults } from "@/lib/mock-data";
import { Activity, Database, Zap, ShieldAlert } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Overview</h1>
        <p className="text-muted-foreground mt-2">
          Powerball Pattern Lab is active. Monitoring drawing anomalies and pattern validations.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Draws</CardTitle>
            <Database className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">1,445</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Latest: {mockDraws[0].date}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Patterns</CardTitle>
            <Activity className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">24</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">+3 in last 10 draws</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Model Confidence</CardTitle>
            <ShieldAlert className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">68.2%</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Walk-forward validated</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Split Risk</CardTitle>
            <Zap className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">Low</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Anti-popularity active</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Recent Draws (AU Modern)</CardTitle>
            <CardDescription>Normalized format: 7 mains + Powerball</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockDraws.map(draw => (
                <div key={draw.draw_id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50">
                  <div className="flex flex-col">
                    <span className="font-mono text-sm text-muted-foreground">Draw {draw.draw_id}</span>
                    <span className="text-xs text-muted-foreground/70">{draw.date}</span>
                  </div>
                  <div className="flex space-x-2">
                    {draw.numbers.map((n, i) => (
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
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle>Baseline Comparisons</CardTitle>
            <CardDescription>Walk-forward validation results across strategies</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
