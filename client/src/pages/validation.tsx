import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockValidationResults } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Target, GitCompare, LayoutDashboard } from "lucide-react";

export default function Validation() {
  const hasData = mockValidationResults.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validation Engine</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Walk-forward backtest results & Monte Carlo simulation tests.
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
            {hasData ? (
              <div className="space-y-6">
                {mockValidationResults.map((result, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-mono">
                      <span className={`font-bold ${result.strategy === 'Composite Model' ? 'text-primary' : ''}`}>
                        {result.strategy}
                      </span>
                      <span className="text-muted-foreground">PB Hit Rate: {result.powerballHitRate}</span>
                    </div>
                    <Progress 
                      value={parseFloat(result.powerballHitRate) * 10} 
                      className="h-2" 
                      // @ts-ignore
                      indicatorClassName={result.strategy === 'Composite Model' ? 'bg-primary' : 'bg-muted'}
                    />
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
                <p className="font-mono text-sm">Awaiting dataset upload.</p>
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
              <div className="flex items-center space-x-4 opacity-50">
                <Target className="w-10 h-10 text-muted-foreground" />
                <div>
                  <div className="text-3xl font-mono font-bold text-muted-foreground">--</div>
                  <p className="text-xs text-muted-foreground font-mono">No validation data</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" /> Permutation Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-muted-foreground opacity-50">--</div>
              <p className="text-xs text-muted-foreground font-mono mt-1 opacity-50">Awaiting data</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}