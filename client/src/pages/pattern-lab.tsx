import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockPatternFeatures } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { ActivitySquare, Fingerprint, Clock, TrendingUp, Search } from "lucide-react";

export default function PatternLab() {
  const hasData = mockPatternFeatures.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pattern Lab</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Feature extraction and randomness auditing.
          </p>
        </div>
        <div className="flex gap-2 opacity-50">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Structure
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            Recency
          </Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            Sequence
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Fingerprint className="w-4 h-4 mr-2" /> Number Freq
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>
        <Card className="border-border opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Clock className="w-4 h-4 mr-2" /> Recency Bias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>
        <Card className="border-border opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <ActivitySquare className="w-4 h-4 mr-2" /> Structure Fit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>
        <Card className="border-border opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" /> Rolling Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border mt-6">
        <CardHeader>
          <CardTitle>Extracted Features (Latest Draw)</CardTitle>
          <CardDescription>Live telemetry from the most recent dataset entry</CardDescription>
        </CardHeader>
        <CardContent>
          {hasData ? (
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
                  {mockPatternFeatures.map((f, i) => (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-primary/90">{f.feature}</td>
                      <td className="p-3 font-bold">{f.value}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={`
                          ${f.type === 'structure' ? 'bg-primary/10 text-primary border-primary/20' : ''}
                          ${f.type === 'recency' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : ''}
                          ${f.type === 'sequence' ? 'bg-purple-500/10 text-purple-500 border-purple-500/20' : ''}
                        `}>
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
    </div>
  );
}