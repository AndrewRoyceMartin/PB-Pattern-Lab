import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { mockPatternFeatures } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { ActivitySquare, Fingerprint, Clock, TrendingUp } from "lucide-react";

export default function PatternLab() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pattern Lab</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Feature extraction and randomness auditing.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            Structure
          </Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20">
            Recency
          </Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20">
            Sequence
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Fingerprint className="w-4 h-4 mr-2" /> Number Freq
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold">Hot: 17, 7, 22</div>
            <p className="text-xs text-muted-foreground mt-1">Last 50 draws</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Clock className="w-4 h-4 mr-2" /> Recency Bias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-orange-500">High</div>
            <p className="text-xs text-muted-foreground mt-1">Carryover detected</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <ActivitySquare className="w-4 h-4 mr-2" /> Structure Fit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold">Normal</div>
            <p className="text-xs text-muted-foreground mt-1">Sum/Spread expected</p>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" /> Rolling Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-mono font-bold text-green-500">Stable</div>
            <p className="text-xs text-muted-foreground mt-1">No major shift</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border mt-6">
        <CardHeader>
          <CardTitle>Extracted Features (Latest Draw)</CardTitle>
          <CardDescription>Live telemetry from the most recent dataset entry</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
