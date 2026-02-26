import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Database, Trophy, ShieldAlert, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";


interface BestStrategy {
  name: string;
  avgDeltaVsRandom: number;
  stability: string;
  windowsTested: number;
  windowsBeating: number;
  windowsLosing: number;
  permutationPValue: number | null;
}

interface RunnerUp {
  name: string;
  avgDeltaVsRandom: number;
}

interface CompositeDebug {
  avgDeltaVsRandom: number;
  stability: string;
}

interface StrategyRow {
  name: string;
  avgDeltaVsRandom: number;
  stability: string;
  windowsTested: number;
  windowsBeating: number;
  windowsLosing: number;
}

interface BestStrategySummary {
  benchmarkRunId: number;
  generatedAt: string;
  benchmarkMode: string;
  windows: number[];
  randomBaselineRuns: number | null;
  runPermutation: boolean;
  permutationRuns: number | null;
  presetName: string | null;
  seed: number;
  bestStrategy: BestStrategy | null;
  runnerUp: RunnerUp | null;
  composite: CompositeDebug | null;
  overallVerdict: string;
  strategiesTested: number;
  allStrategies: StrategyRow[];
}

interface OverviewData {
  totalDraws: number;
  modernDraws: number;
  latestDrawDate: string | null;
  bestStrategySummary: BestStrategySummary | null;
}

function stabilityColor(stability: string): string {
  const s = stability.toUpperCase();
  if (s.includes("UNDERPERFORMING")) return "text-red-500";
  if (s.includes("NO EDGE")) return "text-muted-foreground";
  if (s.includes("WEAK EDGE")) return "text-yellow-500";
  if (s.includes("POSSIBLE EDGE")) return "text-green-500";
  return "text-muted-foreground";
}

function verdictColor(verdict: string): string {
  const v = verdict.toLowerCase().replace(/[_\s]+/g, "_");
  if (v.includes("possible_edge")) return "text-green-500";
  if (v.includes("weak_edge")) return "text-yellow-500";
  if (v.includes("no_edge")) return "text-orange-500";
  if (v.includes("underperforming")) return "text-red-500";
  return "text-muted-foreground";
}

function formatDelta(d: number): string {
  return d >= 0 ? `+${d.toFixed(2)}` : d.toFixed(2);
}

export default function Dashboard() {
  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["/api/system/overview"],
    queryFn: () => fetchApi("/api/system/overview"),
  });
  const { data: draws } = useQuery({
    queryKey: ["/api/draws"],
    queryFn: () => fetchApi("/api/draws"),
  });

  const hasData = (overview?.totalDraws ?? 0) > 0;
  const recentDraws = (draws || []).slice(0, 5);
  const bench = overview?.bestStrategySummary;
  const best = bench?.bestStrategy;

  const verdictLabel = best
    ? best.stability
    : bench?.overallVerdict
      ? bench.overallVerdict.replace(/[_]/g, " ").toUpperCase()
      : "--";

  const verdictClass = best
    ? stabilityColor(best.stability)
    : bench?.overallVerdict
      ? verdictColor(bench.overallVerdict)
      : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">System Overview</h1>
        <p className="text-muted-foreground mt-2">
          {hasData ? "Dataset loaded. All engines operational." : "Waiting for dataset upload."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Draws</CardTitle>
            <Database className="w-4 h-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-total-draws">{overview?.totalDraws?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">Latest: {overview?.latestDrawDate ?? "None"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Modern Era</CardTitle>
            <Activity className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="text-modern-draws">{overview?.modernDraws?.toLocaleString() ?? "0"}</div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">{hasData ? "7+1 format" : "Awaiting data"}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Overall Verdict</CardTitle>
            <ShieldAlert className={`w-4 h-4 ${verdictClass}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${verdictClass}`} data-testid="text-verdict">
              {bench ? verdictLabel : "--"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {bench
                ? `From latest benchmark (${bench.benchmarkMode === "rolling_walk_forward" ? "rolling" : "fixed"})`
                : "Run Validation first"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Strategy vs Random</CardTitle>
            <Trophy className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {best ? (
              <>
                <div className="text-2xl font-bold font-mono" data-testid="text-best-delta">
                  {formatDelta(best.avgDeltaVsRandom)}
                </div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">Avg main match delta</p>
                <p className="text-xs text-primary mt-0.5 font-mono">{best.name}</p>
                {bench?.runnerUp && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">
                    Runner-up: {bench.runnerUp.name} ({formatDelta(bench.runnerUp.avgDeltaVsRandom)})
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="text-2xl font-bold font-mono text-muted-foreground" data-testid="text-best-delta">--</div>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {hasData ? "No benchmark run yet" : "Awaiting data"}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {bench && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 font-mono px-1">
          <Info className="w-3 h-3 flex-shrink-0" />
          <span>
            Benchmark #{bench.benchmarkRunId} · {bench.benchmarkMode === "rolling_walk_forward" ? "rolling" : "fixed holdout"}
            {bench.windows?.length ? ` · windows: ${bench.windows.join("/")}` : ""}
            {bench.randomBaselineRuns ? ` · random runs: ${bench.randomBaselineRuns}` : ""}
            {bench.runPermutation ? ` · perm: ${bench.permutationRuns ?? "on"}` : " · perm: off"}
            {bench.presetName ? ` · preset: ${bench.presetName}` : ""}
            {bench.strategiesTested ? ` · ${bench.strategiesTested} strategies` : ""}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        <Card className="border-border flex flex-col">
          <CardHeader>
            <CardTitle>Recent Draws</CardTitle>
            <CardDescription>AU Modern Format: 7 mains + Powerball</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {recentDraws.length > 0 ? (
              <div className="space-y-3">
                {recentDraws.map((draw: any) => (
                  <div key={draw.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50" data-testid={`row-draw-${draw.drawNumber}`}>
                    <div className="flex flex-col">
                      <span className="font-mono text-sm text-muted-foreground">#{draw.drawNumber}</span>
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
                <p className="font-mono text-sm">No draws loaded.</p>
                <p className="text-xs opacity-70">Upload a CSV in Data Ingest.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border flex flex-col">
          <CardHeader>
            <CardTitle>Strategy Rankings</CardTitle>
            <CardDescription>All strategies from latest benchmark, ranked by delta vs random</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {bench && bench.allStrategies?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-strategy-rankings">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left font-medium p-2 text-muted-foreground">#</th>
                      <th className="text-left font-medium p-2 text-muted-foreground">Strategy</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">Delta</th>
                      <th className="text-center font-medium p-2 text-muted-foreground">Windows</th>
                      <th className="text-right font-medium p-2 text-muted-foreground">Stability</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono text-xs">
                    {bench.allStrategies.map((s, i) => {
                      const isBest = i === 0;
                      return (
                        <tr
                          key={s.name}
                          className={`border-b border-border/50 last:border-0 ${isBest ? "bg-primary/5" : ""}`}
                          data-testid={`row-strategy-${i}`}
                        >
                          <td className="p-2 text-muted-foreground">{i + 1}</td>
                          <td className={`p-2 ${isBest ? "text-primary font-bold" : ""}`}>
                            {s.name}
                            {isBest && <span className="ml-1.5 text-[10px] text-primary/70">BEST</span>}
                          </td>
                          <td className={`p-2 text-right font-bold ${s.avgDeltaVsRandom > 0 ? "text-green-400" : s.avgDeltaVsRandom < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                            {formatDelta(s.avgDeltaVsRandom)}
                          </td>
                          <td className="p-2 text-center">
                            <span className="text-green-400">{s.windowsBeating}</span>
                            <span className="text-muted-foreground/50">/{s.windowsTested}</span>
                          </td>
                          <td className={`p-2 text-right ${stabilityColor(s.stability)}`}>
                            {s.stability}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-lg bg-secondary/20">
                <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                <p className="font-mono text-sm">{hasData && (overview?.modernDraws ?? 0) < 50 ? "Need 50+ modern draws." : "Run Validation to generate evidence."}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
