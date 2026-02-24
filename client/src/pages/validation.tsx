import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Target, GitCompare, LayoutDashboard } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Validation() {
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetch("/api/stats").then(r => r.json()) });
  const { data: validation } = useQuery({ queryKey: ["/api/analysis/validation"], queryFn: () => fetch("/api/analysis/validation").then(r => r.json()), enabled: !!stats?.modernDraws });

  const hasData = stats?.modernDraws >= 50;
  const composite = validation?.find((v: any) => v.strategy === "Composite Model");
  const random = validation?.find((v: any) => v.strategy === "Random");
  const beatsRandom = composite && random && composite.avgMainMatches > random.avgMainMatches;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-validation-title">Validation Engine</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Walk-forward backtest results & strategy comparison.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border col-span-1 md:col-span-2 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitCompare className="w-5 h-5 mr-2" /> Strategy Comparison
            </CardTitle>
            <CardDescription>Performance against historical out-of-sample draws</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {validation && hasData ? (
              <div className="space-y-6">
                {validation.map((result: any, i: number) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className={`font-bold ${result.strategy === 'Composite Model' ? 'text-primary' : ''}`}>
                        {result.strategy}
                      </span>
                      <span className="text-muted-foreground">PB Hit Rate: {result.powerballHitRate}</span>
                    </div>
                    <Progress value={parseFloat(result.powerballHitRate) * 10} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono mt-1">
                      <span>Avg Main: {result.avgMainMatches}</span>
                      <span>Top 10 Overlap: {result.top10Overlap}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/10">
                <LayoutDashboard className="w-8 h-8 mb-2 opacity-30" />
                <p className="font-mono text-sm">{stats?.modernDraws > 0 ? "Need at least 50 modern draws for validation." : "Awaiting dataset upload."}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Walk-Forward Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Target className={`w-10 h-10 ${hasData && beatsRandom ? "text-green-500" : "text-muted-foreground"}`} />
                <div>
                  <div className={`text-3xl font-mono font-bold ${hasData && beatsRandom ? "text-green-500" : "text-muted-foreground"}`}>
                    {hasData ? (beatsRandom ? "Valid" : "Weak") : "--"}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {hasData ? (beatsRandom ? "Outperforms Random" : "Does not beat Random") : "No validation data"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border-border bg-card ${hasData ? "border-orange-500/30" : ""}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" /> Edge Classification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-mono font-bold ${
                hasData ? (beatsRandom ? "text-yellow-500" : "text-muted-foreground") : "text-muted-foreground opacity-50"
              }`}>
                {hasData ? (beatsRandom ? "Possible Edge" : "No Edge") : "--"}
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {hasData ? "Based on walk-forward results" : "Awaiting data"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
