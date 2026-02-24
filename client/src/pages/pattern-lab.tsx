import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivitySquare, Fingerprint, Clock, TrendingUp, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function PatternLab() {
  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetch("/api/stats").then(r => r.json()) });
  const { data: freqs } = useQuery({ queryKey: ["/api/analysis/frequencies"], queryFn: () => fetch("/api/analysis/frequencies").then(r => r.json()), enabled: !!stats?.modernDraws });
  const { data: features } = useQuery({ queryKey: ["/api/analysis/features"], queryFn: () => fetch("/api/analysis/features").then(r => r.json()), enabled: !!stats?.modernDraws });

  const hasData = stats?.modernDraws > 0;
  const allFeatures = [...(features?.structure || []), ...(features?.carryover || [])];

  const hotNumbers = freqs ? [...freqs].sort((a: any, b: any) => b.last50Freq - a.last50Freq).slice(0, 3).map((f: any) => f.number).join(", ") : "--";
  const maxDrift = freqs ? Math.max(...freqs.map((f: any) => Math.abs(f.rollingTrend))) : 0;
  const hasCarryover = (features?.carryover || []).some((f: any) => f.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-pattern-title">Pattern Lab</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Feature extraction and randomness auditing.
          </p>
        </div>
        <div className={`flex gap-2 ${!hasData ? "opacity-50" : ""}`}>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Structure</Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Recency</Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">Sequence</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Fingerprint className="w-4 h-4 mr-2" /> Hot Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold" data-testid="text-hot-numbers">{hasData ? hotNumbers : "--"}</div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? "Last 50 draws" : "Awaiting data"}</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Clock className="w-4 h-4 mr-2" /> Recency Bias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-mono font-bold ${hasData && hasCarryover ? "text-orange-500" : "text-muted-foreground"}`}>
              {hasData ? (hasCarryover ? "Detected" : "None") : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? "Carryover analysis" : "Awaiting data"}</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <ActivitySquare className="w-4 h-4 mr-2" /> Structure Fit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold" data-testid="text-structure-fit">
              {hasData ? "Normal" : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? "Sum/Spread expected" : "Awaiting data"}</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" /> Rolling Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-mono font-bold ${hasData ? (maxDrift > 3 ? "text-orange-500" : "text-green-500") : "text-muted-foreground"}`}>
              {hasData ? (maxDrift > 3 ? "Drifting" : "Stable") : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? `Max drift: ${maxDrift}` : "Awaiting data"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border mt-6">
        <CardHeader>
          <CardTitle>Extracted Features (Latest Draw)</CardTitle>
          <CardDescription>Live telemetry from the most recent dataset entry</CardDescription>
        </CardHeader>
        <CardContent>
          {allFeatures.length > 0 ? (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-3 text-muted-foreground font-medium">Feature Key</th>
                    <th className="p-3 text-muted-foreground font-medium">Value</th>
                    <th className="p-3 text-muted-foreground font-medium">Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {allFeatures.map((f: any, i: number) => (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-primary/90">{f.feature}</td>
                      <td className="p-3 font-bold">{String(f.value)}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={
                          f.type === 'structure' ? 'bg-primary/10 text-primary border-primary/20' :
                          f.type === 'recency' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' :
                          'bg-purple-500/10 text-purple-500 border-purple-500/20'
                        }>
                          {f.type}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10">
              <Search className="w-10 h-10 mb-3 opacity-30" />
              <p className="font-mono text-sm">No patterns discovered.</p>
              <p className="text-xs opacity-70 mt-1">Please upload a dataset to begin feature extraction.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {hasData && freqs && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Number Frequencies (1-35)</CardTitle>
            <CardDescription>Frequency analysis across different windows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border/50 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-2 text-muted-foreground font-medium">#</th>
                    <th className="p-2 text-muted-foreground font-medium">Total</th>
                    <th className="p-2 text-muted-foreground font-medium">L10</th>
                    <th className="p-2 text-muted-foreground font-medium">L25</th>
                    <th className="p-2 text-muted-foreground font-medium">L50</th>
                    <th className="p-2 text-muted-foreground font-medium">Since</th>
                    <th className="p-2 text-muted-foreground font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {freqs.map((f: any) => (
                    <tr key={f.number} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-2 font-bold text-primary">{f.number}</td>
                      <td className="p-2">{f.totalFreq}</td>
                      <td className="p-2">{f.last10Freq}</td>
                      <td className="p-2">{f.last25Freq}</td>
                      <td className="p-2">{f.last50Freq}</td>
                      <td className="p-2">{f.drawsSinceSeen}</td>
                      <td className={`p-2 font-bold ${f.rollingTrend > 0 ? "text-green-500" : f.rollingTrend < 0 ? "text-red-500" : ""}`}>
                        {f.rollingTrend > 0 ? "+" : ""}{f.rollingTrend}
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
