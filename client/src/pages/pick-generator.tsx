import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap, Play, CheckCircle, SearchX, Loader2, Info, Sparkles, AlertTriangle, ArrowRight, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePicks, fetchApi, fetchRecommendation } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { GeneratedPick, GeneratorMode, GeneratorRecommendation } from "@shared/schema";

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

const MODES: { value: GeneratorMode; label: string; description: string; drawFit: number; antiPop: number; group?: string; strategyName?: string }[] = [
  { value: "strategy_portfolio", label: "Strategy Portfolio", description: "Best from Each Test — mixed 10-game pack from multiple strategies for maximum coverage", drawFit: 50, antiPop: 50, strategyName: "Strategy Portfolio" },
  { value: "balanced", label: "Balanced", description: "60% pattern signals, 40% anti-popularity", drawFit: 60, antiPop: 40, strategyName: "Composite" },
  { value: "anti_popular", label: "Low Split-Risk", description: "20% pattern, 80% anti-popularity", drawFit: 20, antiPop: 80 },
  { value: "anti_popular_only", label: "Anti-Popular Only", description: "Pure anti-popularity scoring — maximum split-risk reduction", drawFit: 0, antiPop: 100, strategyName: "Anti-Popular Only" },
  { value: "pattern_only", label: "Experimental Pattern", description: "100% pattern signals (experimental)", drawFit: 100, antiPop: 0 },
  { value: "structure_matched_random", label: "Structure-Matched Random", description: "Random picks filtered by historical draw structure (odd/even, sum, range)", drawFit: 60, antiPop: 40, strategyName: "Structure-Matched Random" },
  { value: "diversity_optimized", label: "Diversity Optimized", description: "Maximizes number coverage across top 10 cards — ideal for multi-ticket buyers", drawFit: 50, antiPop: 50, strategyName: "Diversity Optimized" },
  { value: "most_drawn_all_time", label: "Most Drawn (All-Time)", description: "Top frequency numbers from full history", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (All-Time)" },
  { value: "most_drawn_last_100", label: "Most Drawn (Last 100)", description: "Top frequency from last 100 draws", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (Last 100)" },
  { value: "most_drawn_last_50", label: "Most Drawn (Last 50)", description: "Top frequency from last 50 draws", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (Last 50)" },
  { value: "most_drawn_last_20", label: "Most Drawn (Last 20)", description: "Top frequency from last 20 draws — short-window hot numbers", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Most Drawn (Last 20)" },
  { value: "least_drawn_last_50", label: "Least Drawn (Last 50)", description: "Contrarian — picks the coldest numbers from last 50 draws", drawFit: 100, antiPop: 0, group: "frequency", strategyName: "Least Drawn (Last 50)" },
  { value: "most_drawn_smoothed_last_50", label: "Smoothed Most Drawn (L50)", description: "Bayesian-smoothed frequency — reduces noise by shrinking toward uniform baseline", drawFit: 100, antiPop: 0, group: "smoothed", strategyName: "Smoothed Most Drawn (L50)" },
  { value: "most_drawn_smoothed_last_20", label: "Smoothed Most Drawn (L20)", description: "Short-window Bayesian-smoothed frequency with noise reduction", drawFit: 100, antiPop: 0, group: "smoothed", strategyName: "Smoothed Most Drawn (L20)" },
  { value: "recency_smoothed", label: "Recency Smoothed", description: "Bayesian-smoothed recency scoring — reduces overreaction to recent draws", drawFit: 100, antiPop: 0, group: "smoothed", strategyName: "Recency Smoothed" },
  { value: "random_baseline", label: "Random Baseline", description: "Pure random for comparison", drawFit: 0, antiPop: 0, strategyName: "Random" },
];

function StabilityBadge({ stabilityClass }: { stabilityClass: string }) {
  const config: Record<string, { label: string; className: string }> = {
    possible_edge: { label: "possible edge", className: "bg-green-500/20 text-green-500" },
    weak_edge: { label: "weak edge", className: "bg-yellow-500/20 text-yellow-500" },
    no_edge: { label: "no edge", className: "bg-muted text-muted-foreground" },
    underperforming: { label: "underperforming", className: "bg-red-500/20 text-red-500" },
  };
  const c = config[stabilityClass] || config.no_edge;
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${c.className}`}>{c.label}</span>;
}


export default function PickGenerator() {
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<GeneratorMode>("balanced");
  const [customAntiPop, setCustomAntiPop] = useState([40]);
  const [picks, setPicks] = useState<GeneratedPick[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const { data: recommendation } = useQuery<GeneratorRecommendation>({
    queryKey: ["/api/generator/recommendation"],
    queryFn: fetchRecommendation,
    enabled: !!stats?.modernDraws,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hasData = stats?.modernDraws > 0;

  const currentMode = MODES.find(m => m.value === selectedMode)!;
  const drawFitWeight = selectedMode === "balanced" ? 100 - customAntiPop[0] : currentMode.drawFit;
  const antiPopWeight = selectedMode === "balanced" ? customAntiPop[0] : currentMode.antiPop;

  const handleGenerate = async () => {
    if (!hasData) {
      toast({ title: "No Data", description: "Upload a dataset first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generatePicks(selectedMode, drawFitWeight, antiPopWeight, 10);
      setPicks(result);
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyRecommendation = () => {
    if (!recommendation) return;
    setSelectedMode(recommendation.recommendedMode);
    if (recommendation.recommendedMode === "balanced") {
      setCustomAntiPop([40]);
    }
    toast({ title: "Recommendation applied", description: `Switched to ${recommendation.recommendedStrategy} mode.` });
  };

  const isRecommended = recommendation && selectedMode === recommendation.recommendedMode;

  function getBadgeForMode(mode: typeof MODES[number]): string | null {
    if (!recommendation?.hasBenchmark || !recommendation.strategyBadges) return null;
    if (mode.strategyName && recommendation.strategyBadges[mode.strategyName]) {
      return recommendation.strategyBadges[mode.strategyName];
    }
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-generator-title">Pick Generator</h1>
          <p className="text-muted-foreground mt-2 font-mono text-sm">
            Ranked picks using validated signals + anti-popularity scoring.
          </p>
        </div>
        <Button onClick={handleGenerate} disabled={isGenerating || !hasData} className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-bold" data-testid="button-generate">
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {isGenerating ? "GENERATING..." : "GENERATE (TOP 10)"}
        </Button>
      </div>

      {recommendation && (
        <Card className={`border-border ${
          !recommendation.hasBenchmark ? "border-orange-500/30 bg-orange-500/5" :
          recommendation.confidence === "high" ? "border-green-500/30 bg-green-500/5" :
          recommendation.confidence === "medium" ? "border-yellow-500/30 bg-yellow-500/5" :
          "border-orange-500/30 bg-orange-500/5"
        }`} data-testid="card-recommendation">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-lg">
              {recommendation.hasBenchmark ? <Sparkles className="w-5 h-5 mr-2 text-yellow-500" /> : <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />}
              <Tip label="Recommended Technique" tip="This recommendation is automatically generated based on the latest benchmark validation results. It picks the strategy and mode most supported by the evidence." />
            </CardTitle>
            <CardDescription>
              {recommendation.hasBenchmark ? "Based on latest benchmark validation results" : "No benchmark data available yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold font-mono" data-testid="text-recommended-strategy">{recommendation.recommendedStrategy}</span>
                  {isRecommended && (
                    <span className="inline-block px-2 py-0.5 rounded border text-xs font-mono font-bold bg-green-500/20 text-green-500 border-green-500/30">SELECTED</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <Tip label={`Confidence: ${recommendation.confidence.toUpperCase()}`}
                    tip="How strongly the benchmark evidence supports this recommendation. HIGH = consistent results across multiple windows."
                    className={`px-2 py-0.5 rounded border ${
                      recommendation.confidence === "high" ? "border-green-500/30 text-green-500" :
                      recommendation.confidence === "medium" ? "border-yellow-500/30 text-yellow-500" :
                      "border-orange-500/30 text-orange-500"
                    }`} />
                  {recommendation.evidence && (
                    <Tip label={`Delta: ${recommendation.evidence.bestAvgDelta >= 0 ? "+" : ""}${recommendation.evidence.bestAvgDelta}`}
                      tip="Average number of extra main-ball matches per draw compared to random across all tested windows."
                      className={`font-bold ${recommendation.evidence.bestAvgDelta > 0 ? "text-green-500" : "text-muted-foreground"}`} />
                  )}
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed">{recommendation.reasonSummary}</p>

                {recommendation.evidence && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-muted-foreground pt-2 border-t border-border/30">
                    <Tip label={`Best: ${recommendation.evidence.bestStrategy}`} tip="The strategy with the highest average delta vs random across all tested windows." />
                    <Tip label={`Windows: ${recommendation.evidence.windowsTested.join(", ")}`} tip="The test window sizes used in the benchmark (number of draws per test window)." />
                    <Tip label={`Strategies: ${recommendation.evidence.strategiesTested}`} tip="Total number of predictive strategies tested in the benchmark." />
                  </div>
                )}
              </div>

              {!isRecommended && (
                <Button onClick={handleApplyRecommendation} variant="outline" className="shrink-0 border-primary/50 text-primary hover:bg-primary/10 font-mono" data-testid="button-apply-recommendation">
                  <ArrowRight className="w-4 h-4 mr-2" /> APPLY
                </Button>
              )}
            </div>

            {recommendation.regimeAware && recommendation.regimeRecommendations && recommendation.regimeRecommendations.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <Shield className="w-3 h-3" />
                  <span>Regime Analysis {recommendation.regimeBasis === "consensus" ? "(consistent)" : recommendation.regimeBasis === "recent_regime" ? "(recent-biased)" : ""}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recommendation.regimeRecommendations.map(r => (
                    <div key={r.regime} className="text-[10px] font-mono px-2 py-1 rounded border border-border/30 bg-secondary/10">
                      <span className="text-muted-foreground">{r.regime.replace(/_/g, " ")}:</span>{" "}
                      <span className={r.bestAvgDelta > 0 ? "text-green-500" : "text-muted-foreground"}>{r.bestStrategy}</span>
                      <span className="text-muted-foreground/60 ml-1">({r.bestAvgDelta >= 0 ? "+" : ""}{r.bestAvgDelta.toFixed(3)})</span>
                    </div>
                  ))}
                </div>
                {recommendation.regimeCaveat && (
                  <p className="text-[10px] text-muted-foreground/60 font-mono">{recommendation.regimeCaveat}</p>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground/60 font-mono mt-3">You can override this recommendation manually by selecting any mode below.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Model Objective</CardTitle>
              <CardDescription>Choose generation strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MODES.map((mode, i) => {
                const prevMode = i > 0 ? MODES[i - 1] : null;
                const showFreqLabel = mode.group === "frequency" && prevMode?.group !== "frequency";
                const badge = getBadgeForMode(mode);
                const modeIsRecommended = recommendation?.hasBenchmark && recommendation.recommendedMode === mode.value;
                return (
                  <div key={mode.value}>
                    {showFreqLabel && (
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono mb-2 mt-1 border-t border-border/30 pt-3">Frequency Benchmark</div>
                    )}
                    <button
                      onClick={() => setSelectedMode(mode.value)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${
                        selectedMode === mode.value
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/50 hover:border-border hover:bg-secondary/30 text-muted-foreground"
                      }`}
                      data-testid={`button-mode-${mode.value}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {mode.label}
                          {modeIsRecommended && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 font-mono font-bold">REC</span>}
                        </div>
                        {badge && <StabilityBadge stabilityClass={badge} />}
                      </div>
                      <div className="text-xs opacity-70 mt-0.5">{mode.description}</div>
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {selectedMode === "balanced" && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Custom Weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm font-mono">
                  <Tip label="Draw-Fit" tip="Weight given to historical pattern signals (frequency, recency, structure, trends). Higher = picks lean more toward numbers that match past draw patterns." className="text-primary" />
                  <span className="font-bold text-primary">{drawFitWeight}%</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <Tip label="Anti-Popularity" tip="Weight given to avoiding popular number choices. Higher = picks lean more toward combinations other players are unlikely to choose, reducing split risk." className="text-yellow-500" />
                  <span className="font-bold text-yellow-500">{antiPopWeight}%</span>
                </div>
                <Slider defaultValue={[40]} max={100} step={5} onValueChange={setCustomAntiPop} data-testid="slider-anti-pop" />
              </CardContent>
            </Card>
          )}

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Anti-Popularity Penalties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-xs">
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Birthday concentration (≤31)" tip="Penalises picks where too many numbers are 31 or below, since many players pick birthdates. Avoiding these reduces the chance of splitting a prize." className="text-muted-foreground" /></div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Sequence detection" tip="Penalises consecutive number runs like 5-6-7. Sequences are a common player favourite, so avoiding them means fewer co-winners." className="text-muted-foreground" /></div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Repeated endings" tip="Penalises picks where multiple numbers share the same last digit (e.g. 5, 15, 25). These patterns are popular with players." className="text-muted-foreground" /></div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Aesthetic pattern" tip="Penalises visually 'neat' patterns people tend to pick, like evenly spaced numbers or symmetric arrangements on the ticket grid." className="text-muted-foreground" /></div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> <Tip label="Low Powerball bias" tip="Penalises very low Powerball numbers (1–5). Many players gravitate to small numbers for the Powerball, increasing split risk." className="text-muted-foreground" /></div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-medium font-mono text-muted-foreground mb-4 border-b border-border/50 pb-2">
            GENERATED CANDIDATES [{currentMode.label.toUpperCase()}]
          </h3>

          {picks.length > 0 ? (
            <div className="space-y-3">
              {picks.map((pick, i) => (
                <div key={i} className={`p-4 rounded-lg border ${i === 0 ? 'bg-primary/5 border-primary/30' : 'bg-card border-border/50'} relative overflow-hidden group hover:border-primary/50 transition-colors`} data-testid={`card-pick-${pick.rank}`}>
                  {i === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-center w-8">
                        <div className={`text-center font-mono font-bold text-lg ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                          #{pick.rank}
                        </div>
                        {pick.sourceStrategy && (
                          <span className="text-[9px] font-mono text-muted-foreground truncate max-w-[80px] text-center leading-tight" title={pick.sourceStrategy}>
                            {pick.sourceStrategy.replace(/\(.*\)/, "").trim()}
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-1.5">
                        {pick.numbers.map((n, idx) => (
                          <div key={idx} className="w-9 h-9 rounded bg-secondary flex items-center justify-center font-mono text-sm border border-border/80 shadow-sm">
                            {n.toString().padStart(2, '0')}
                          </div>
                        ))}
                        <div className="w-9 h-9 rounded bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-mono text-sm font-bold shadow-sm ml-1 relative">
                          <Zap className="w-3 h-3 absolute -top-1 -right-1 text-yellow-500" />
                          {pick.powerball.toString().padStart(2, '0')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-12 md:ml-0 font-mono text-xs">
                      <div className="flex flex-col items-end">
                        <Tip label="Draw-Fit" tip="How well these numbers match historical patterns — frequency, recency, structure, and trend signals. Higher = better fit to past draws." className="text-muted-foreground" />
                        <span className="text-primary">{pick.drawFit}</span>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="flex flex-col items-end">
                        <Tip label="Anti-Pop" tip="How unpopular this combination is among typical players. Higher = fewer people likely picked these numbers, meaning less chance of splitting a jackpot." className="text-muted-foreground" />
                        <span className="text-yellow-500">{pick.antiPop}</span>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="flex flex-col items-end">
                        <Tip label="SCORE" tip="The final combined score, blending Draw-Fit and Anti-Pop based on the weights set by your chosen mode. Higher = better overall pick." className="text-muted-foreground font-bold" />
                        <span className={`font-bold ${i === 0 ? 'text-primary text-base' : ''}`}>{pick.finalScore.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  {pick.antiPopBreakdown && (
                    <div className="mt-3 pt-3 border-t border-border/30 flex gap-4 text-xs font-mono text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Info className="w-3 h-3" /> Penalties:</span>
                      {pick.antiPopBreakdown.birthdayPenalty > 0 && <span className="text-orange-400">Birthday -{pick.antiPopBreakdown.birthdayPenalty}</span>}
                      {pick.antiPopBreakdown.sequencePenalty > 0 && <span className="text-orange-400">Sequence -{pick.antiPopBreakdown.sequencePenalty}</span>}
                      {pick.antiPopBreakdown.repeatedEndingPenalty > 0 && <span className="text-orange-400">Endings -{pick.antiPopBreakdown.repeatedEndingPenalty}</span>}
                      {pick.antiPopBreakdown.aestheticPenalty > 0 && <span className="text-orange-400">Pattern -{pick.antiPopBreakdown.aestheticPenalty}</span>}
                      {pick.antiPopBreakdown.lowPowerballPenalty > 0 && <span className="text-orange-400">Low PB -{pick.antiPopBreakdown.lowPowerballPenalty}</span>}
                      {Object.values(pick.antiPopBreakdown).every(v => v === 0) && <span className="text-green-500">None (clean pick)</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10">
              <SearchX className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-mono">{hasData ? "Click GENERATE to create picks." : "No data loaded."}</p>
              <p className="text-sm opacity-70 mt-1">{hasData ? "Select a mode and generate." : "Upload data first."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
