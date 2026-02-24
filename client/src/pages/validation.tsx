import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockValidationResults } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Target, GitCompare } from "lucide-react";

export default function Validation() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validation Engine</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Walk-forward backtest results & Monte Carlo simulation tests.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <GitCompare className="w-5 h-5 mr-2" /> Strategy Comparison
            </CardTitle>
            <CardDescription>Performance against historical out-of-sample draws</CardDescription>
          </CardHeader>
          <CardContent>
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
                    // @ts-ignore - dealing with tailwind custom colors
                    indicatorClassName={result.strategy === 'Composite Model' ? 'bg-primary' : 'bg-muted'}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground font-mono mt-1">
                    <span>Avg Main: {result.avgMainMatches}</span>
                    <span>Top 10 Overlap: {result.top10Overlap}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Walk-Forward Accuracy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <Target className="w-10 h-10 text-green-500" />
                <div>
                  <div className="text-3xl font-mono font-bold text-green-500">Valid</div>
                  <p className="text-xs text-muted-foreground font-mono">Outperforms Random</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card border-orange-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-orange-500" /> Permutation Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-mono font-bold text-orange-500">Weak Edge</div>
              <p className="text-xs text-muted-foreground font-mono mt-1">Pattern stability low over last 100 draws</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
