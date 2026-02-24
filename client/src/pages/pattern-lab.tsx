import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ActivitySquare, Fingerprint, Clock, TrendingUp, Search, ShieldCheck, Info, BarChart3, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { Link } from "wouter";
import type { NumberFrequency, AuditSummary, StructureProfile } from "@shared/schema";

type SortPreset = "default" | "top_all_time" | "hot_l10" | "hot_l25" | "hot_l50" | "cold_l50" | "most_overdue" | "trend_up" | "trend_down";

const SORT_PRESETS: { value: SortPreset; label: string }[] = [
  { value: "default", label: "# Order" },
  { value: "top_all_time", label: "Top All-Time" },
  { value: "hot_l10", label: "Hot (L10)" },
  { value: "hot_l25", label: "Hot (L25)" },
  { value: "hot_l50", label: "Hot (L50)" },
  { value: "cold_l50", label: "Cold (L50)" },
  { value: "most_overdue", label: "Most Overdue" },
  { value: "trend_up", label: "Trend Up" },
  { value: "trend_down", label: "Trend Down" },
];

function sortFreqs(freqs: NumberFrequency[], preset: SortPreset): NumberFrequency[] {
  const arr = [...freqs];
  switch (preset) {
    case "top_all_time": return arr.sort((a, b) => b.totalFreq - a.totalFreq);
    case "hot_l10": return arr.sort((a, b) => b.last10Freq - a.last10Freq);
    case "hot_l25": return arr.sort((a, b) => b.last25Freq - a.last25Freq);
    case "hot_l50": return arr.sort((a, b) => b.last50Freq - a.last50Freq);
    case "cold_l50": return arr.sort((a, b) => a.last50Freq - b.last50Freq);
    case "most_overdue": return arr.sort((a, b) => b.drawsSinceSeen - a.drawsSinceSeen);
    case "trend_up": return arr.sort((a, b) => b.rollingTrend - a.rollingTrend);
    case "trend_down": return arr.sort((a, b) => a.rollingTrend - b.rollingTrend);
    default: return arr.sort((a, b) => a.number - b.number);
  }
}

function Tip({ label, tip, className }: { label: string; tip: string; className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`${className ?? ""} cursor-help border-b border-dotted border-current`}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs">
        <p>{tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function TypicalityBadge({ typicality }: { typicality: string | null | undefined }) {
  if (!typicality) return null;
  const config: Record<string, { className: string }> = {
    typical: { className: "bg-green-500/15 text-green-500 border-green-500/30" },
    uncommon: { className: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
    rare: { className: "bg-red-500/15 text-red-500 border-red-500/30" },
  };
  const c = config[typicality] || config.typical;
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${c.className}`} data-testid={`badge-typicality-${typicality}`}>{typicality}</span>;
}

function AuditCard({ audit, title }: { audit: AuditSummary; title: string }) {
  const verdictLabel = audit.verdict === "pass" ? "PASS" : audit.verdict === "marginal" ? "FLAGGED" : "FAIL";
  const verdictColor = audit.verdict === "pass" ? "text-green-500" : audit.verdict === "marginal" ? "text-yellow-500" : "text-red-500";
  const borderColor = audit.verdict === "pass" ? "border-green-500/30" : audit.verdict === "marginal" ? "border-yellow-500/30" : "border-red-500/30";

  return (
    <Card className={`border-border ${borderColor}`} data-testid={`card-audit-${audit.scope}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-base">
          <ShieldCheck className="w-4 h-4 mr-2" /> {title}
        </CardTitle>
        <CardDescription className="text-xs font-mono">
          {audit.scope === "main" ? "Numbers 1-35 · Uniform frequency test" : "Numbers 1-20 · Uniform frequency test"} · {audit.drawsUsed} draws · Modern format only
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Verdict</span>
            <div className={`text-xl font-mono font-bold ${verdictColor}`} data-testid={`text-verdict-${audit.scope}`}>
              {verdictLabel}
            </div>
          </div>
          <div className="space-y-1">
            <Tip label="Chi-Square" tip="Measures how much the observed frequencies deviate from what uniform randomness would predict. Higher values = more deviation." className="text-xs text-muted-foreground uppercase tracking-wider" />
            <div className="text-xl font-mono font-bold">{audit.chiSquareStat}</div>
            <span className="text-xs text-muted-foreground font-mono">p={audit.chiSquarePValue}</span>
          </div>
          <div className="space-y-1">
            <Tip label="Entropy" tip="A measure of how evenly distributed the frequencies are. Higher entropy = more uniform/random distribution." className="text-xs text-muted-foreground uppercase tracking-wider" />
            <div className="text-xl font-mono font-bold">{audit.entropyScore}</div>
            <span className="text-xs text-muted-foreground font-mono">max={audit.maxEntropy}</span>
          </div>
          <div className="space-y-1">
            <Tip label="Entropy Ratio" tip="Entropy as a percentage of the theoretical maximum. Values close to 100% indicate near-uniform randomness." className="text-xs text-muted-foreground uppercase tracking-wider" />
            <div className="text-xl font-mono font-bold">{(audit.entropyRatio * 100).toFixed(1)}%</div>
            <span className="text-xs text-muted-foreground font-mono">of maximum</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground bg-secondary/30 p-3 rounded-md border border-border/50 mb-3">{audit.details}</p>
        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/5 border border-blue-500/20">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-400/90 leading-relaxed">{audit.interpretation}</p>
        </div>
        {audit.verdict !== "pass" && (
          <div className="flex gap-2 mt-3">
            <Link href="/validation">
              <Button variant="outline" size="sm" className="text-xs font-mono" data-testid="button-audit-to-validation">
                Open Validation
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PatternLab() {
  const [sortPreset, setSortPreset] = useState<SortPreset>("default");

  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const { data: freqs } = useQuery<NumberFrequency[]>({ queryKey: ["/api/analysis/frequencies"], queryFn: () => fetchApi("/api/analysis/frequencies"), enabled: !!stats?.modernDraws });
  const { data: features } = useQuery({ queryKey: ["/api/analysis/features"], queryFn: () => fetchApi("/api/analysis/features"), enabled: !!stats?.modernDraws });
  const { data: audit } = useQuery<{ main: AuditSummary; powerball: AuditSummary }>({ queryKey: ["/api/analysis/audit"], queryFn: () => fetchApi("/api/analysis/audit"), enabled: !!stats?.modernDraws });
  const { data: structureProfile } = useQuery<StructureProfile>({ queryKey: ["/api/analysis/structure-profile"], queryFn: () => fetchApi("/api/analysis/structure-profile"), enabled: !!stats?.modernDraws });

  const hasData = stats?.modernDraws > 0;
  const allFeatures = [...(features?.structure || []), ...(features?.carryover || [])];
  const sortedFreqs = freqs ? sortFreqs(freqs, sortPreset) : [];

  const hotNumbers = freqs ? [...freqs].sort((a, b) => b.last50Freq - a.last50Freq).slice(0, 3).map(f => f.number).join(", ") : "--";
  const coldNumbers = freqs ? [...freqs].sort((a, b) => b.drawsSinceSeen - a.drawsSinceSeen).slice(0, 3).map(f => f.number).join(", ") : "--";
  const maxDrift = freqs ? Math.max(...freqs.map(f => Math.abs(f.rollingTrend))) : 0;
  const hasCarryover = (features?.carryover || []).some((f: any) => f.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-pattern-title">Pattern Lab</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Feature extraction, frequency analysis, and randomness audit.
          </p>
        </div>
        <div className={`flex gap-2 ${!hasData ? "opacity-50" : ""}`}>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Structure</Badge>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">Recency</Badge>
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">Sequence</Badge>
          {hasData && <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Modern Format Only</Badge>}
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
            <div className="text-xl font-mono font-bold" data-testid="text-hot-numbers">{hasData ? hotNumbers : "--"}</div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? "Highest freq (L50)" : "Awaiting data"}</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <Clock className="w-4 h-4 mr-2" /> Cold Numbers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-mono font-bold text-blue-400">{hasData ? coldNumbers : "--"}</div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? "Most overdue" : "Awaiting data"}</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <ActivitySquare className="w-4 h-4 mr-2" /> Carryover
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-mono font-bold ${hasData && hasCarryover ? "text-orange-500" : "text-muted-foreground"}`}>
              {hasData ? (hasCarryover ? "Detected" : "None") : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? "From previous draws" : "Awaiting data"}</p>
          </CardContent>
        </Card>
        <Card className={`border-border ${!hasData ? "opacity-50" : ""}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" /> Rolling Drift
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-xl font-mono font-bold ${hasData ? (maxDrift > 3 ? "text-orange-500" : "text-green-500") : "text-muted-foreground"}`}>
              {hasData ? (maxDrift > 3 ? "Drifting" : "Stable") : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{hasData ? `Max: ${maxDrift}` : "Awaiting data"}</p>
          </CardContent>
        </Card>
      </div>

      {hasData && audit && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AuditCard audit={audit.main} title="Main Numbers Audit" />
          <AuditCard audit={audit.powerball} title="Powerball Audit" />
        </div>
      )}

      {hasData && structureProfile && structureProfile.drawsAnalyzed > 0 && (
        <Card className="border-border border-blue-500/20" data-testid="card-structure-profile">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Layers className="w-5 h-5 mr-2" /> Historical Structure Profile
            </CardTitle>
            <CardDescription className="text-xs font-mono">{structureProfile.drawsAnalyzed} modern draws analyzed · Defines what a "typical" draw looks like</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Odd/Even</span>
                <div className="text-sm font-mono font-bold" data-testid="text-profile-odd-even">{structureProfile.oddEvenMode}</div>
                <span className="text-[10px] text-muted-foreground font-mono">most common split</span>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Low/High</span>
                <div className="text-sm font-mono font-bold">{structureProfile.lowHighMode}</div>
                <span className="text-[10px] text-muted-foreground font-mono">1-17 vs 18-35</span>
              </div>
              <div className="space-y-1">
                <Tip label="Sum" tip="Total of all 7 main numbers added together. The normal range covers the 10th to 90th percentile of historical draws." className="text-xs text-muted-foreground uppercase tracking-wider" />
                <div className="text-sm font-mono font-bold">{structureProfile.sumMedian}</div>
                <span className="text-[10px] text-muted-foreground font-mono">range {structureProfile.sumQ10}–{structureProfile.sumQ90}</span>
              </div>
              <div className="space-y-1">
                <Tip label="Spread" tip="Difference between the highest and lowest number in the draw. Wider spreads mean numbers are more spread across the 1-35 range." className="text-xs text-muted-foreground uppercase tracking-wider" />
                <div className="text-sm font-mono font-bold">{structureProfile.rangeMedian}</div>
                <span className="text-[10px] text-muted-foreground font-mono">range {structureProfile.rangeQ10}–{structureProfile.rangeQ90}</span>
              </div>
              <div className="space-y-1">
                <Tip label="Carryover" tip="Average number of main numbers that repeat from the immediately previous draw." className="text-xs text-muted-foreground uppercase tracking-wider" />
                <div className="text-sm font-mono font-bold">{structureProfile.avgCarryover}</div>
                <span className="text-[10px] text-muted-foreground font-mono">avg from prev draw</span>
              </div>
              <div className="space-y-1">
                <Tip label="Consecutive" tip="Average number of consecutive-pair adjacencies (e.g. 5-6, 12-13) within a draw." className="text-xs text-muted-foreground uppercase tracking-wider" />
                <div className="text-sm font-mono font-bold">{structureProfile.avgConsecutive}</div>
                <span className="text-[10px] text-muted-foreground font-mono">avg pairs per draw</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Extracted Features (Latest Draw)</CardTitle>
          <CardDescription>Structure and sequence telemetry with historical context</CardDescription>
        </CardHeader>
        <CardContent>
          {allFeatures.length > 0 ? (
            <div className="rounded-md border border-border/50 overflow-hidden">
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary/50">
                  <tr>
                    <th className="p-3 text-muted-foreground font-medium">Feature</th>
                    <th className="p-3 text-muted-foreground font-medium">Value</th>
                    <th className="p-3 text-muted-foreground font-medium">
                      <Tip label="Normal Range" tip="The 10th to 90th percentile range from historical draws. Values inside this range are typical." />
                    </th>
                    <th className="p-3 text-muted-foreground font-medium">
                      <Tip label="%ile" tip="Percentile rank of this value vs historical draws. 50th = exactly average. Below 20th or above 80th = uncommon." />
                    </th>
                    <th className="p-3 text-muted-foreground font-medium">Typicality</th>
                    <th className="p-3 text-muted-foreground font-medium">Class</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {allFeatures.map((f: any, i: number) => (
                    <tr key={i} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3 text-primary/90">{f.feature}</td>
                      <td className="p-3 font-bold">{String(f.value)}</td>
                      <td className="p-3 text-muted-foreground">{f.normalRange ?? "—"}</td>
                      <td className="p-3">{f.percentile != null ? `${f.percentile}th` : "—"}</td>
                      <td className="p-3"><TypicalityBadge typicality={f.typicality} /></td>
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
              <p className="text-xs opacity-70 mt-1">Upload a dataset to begin.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {hasData && freqs && (
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" /> Number Frequencies (1-35)
                </CardTitle>
                <CardDescription>Frequency across different rolling windows</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-4" data-testid="frequency-sort-presets">
              {SORT_PRESETS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={sortPreset === preset.value ? "default" : "outline"}
                  size="sm"
                  className="text-xs font-mono h-7 px-2.5"
                  onClick={() => setSortPreset(preset.value)}
                  data-testid={`button-sort-${preset.value}`}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="rounded-md border border-border/50 overflow-hidden overflow-x-auto">
              <table className="w-full text-sm font-mono text-left">
                <thead className="bg-secondary/50 sticky top-0">
                  <tr>
                    {sortPreset !== "default" && <th className="p-2 text-muted-foreground font-medium w-12">Rank</th>}
                    <th className="p-2 text-muted-foreground font-medium">#</th>
                    <th className="p-2 text-muted-foreground font-medium">Total</th>
                    <th className="p-2 text-muted-foreground font-medium">L10</th>
                    <th className="p-2 text-muted-foreground font-medium">L25</th>
                    <th className="p-2 text-muted-foreground font-medium">L50</th>
                    <th className="p-2 text-muted-foreground font-medium">Since</th>
                    <th className="p-2 text-muted-foreground font-medium">
                      <Tip label="Trend" tip="Trend = L10 frequency minus prior-L10 frequency. Positive means the number is appearing more often recently compared to the 10 draws before that." />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {sortedFreqs.map((f, idx) => (
                    <tr key={f.number} className="hover:bg-secondary/20 transition-colors">
                      {sortPreset !== "default" && <td className="p-2 text-muted-foreground text-xs">{idx + 1}</td>}
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
