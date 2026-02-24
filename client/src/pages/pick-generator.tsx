import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Zap, Play, CheckCircle, SearchX, Loader2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePicks, fetchApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import type { GeneratedPick, GeneratorMode } from "@shared/schema";

const MODES: { value: GeneratorMode; label: string; description: string; drawFit: number; antiPop: number }[] = [
  { value: "balanced", label: "Balanced", description: "60% pattern signals, 40% anti-popularity", drawFit: 60, antiPop: 40 },
  { value: "anti_popular", label: "Low Split-Risk", description: "20% pattern, 80% anti-popularity", drawFit: 20, antiPop: 80 },
  { value: "pattern_only", label: "Experimental Pattern", description: "100% pattern signals (experimental)", drawFit: 100, antiPop: 0 },
  { value: "random_baseline", label: "Random Baseline", description: "Pure random for comparison", drawFit: 0, antiPop: 0 },
];

export default function PickGenerator() {
  const { toast } = useToast();
  const [selectedMode, setSelectedMode] = useState<GeneratorMode>("balanced");
  const [customAntiPop, setCustomAntiPop] = useState([40]);
  const [picks, setPicks] = useState<GeneratedPick[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          {/* Mode Selector */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Model Objective</CardTitle>
              <CardDescription>Choose generation strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setSelectedMode(mode.value)}
                  className={`w-full text-left p-3 rounded-md border transition-colors ${
                    selectedMode === mode.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/50 hover:border-border hover:bg-secondary/30 text-muted-foreground"
                  }`}
                  data-testid={`button-mode-${mode.value}`}
                >
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs opacity-70 mt-0.5">{mode.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Custom Weights (Balanced only) */}
          {selectedMode === "balanced" && (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-lg">Custom Weights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-primary">Draw-Fit</span>
                  <span className="font-bold text-primary">{drawFitWeight}%</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-yellow-500">Anti-Popularity</span>
                  <span className="font-bold text-yellow-500">{antiPopWeight}%</span>
                </div>
                <Slider defaultValue={[40]} max={100} step={5} onValueChange={setCustomAntiPop} data-testid="slider-anti-pop" />
              </CardContent>
            </Card>
          )}

          {/* Penalties */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">Anti-Popularity Penalties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 font-mono text-xs">
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Birthday concentration (&le;31)</div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Sequence detection</div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Repeated endings</div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Aesthetic pattern</div>
              <div className="flex items-center text-muted-foreground"><CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Low Powerball bias</div>
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
                      <div className={`w-8 text-center font-mono font-bold text-lg ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        #{pick.rank}
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
                        <span className="text-muted-foreground">Draw-Fit</span>
                        <span className="text-primary">{pick.drawFit}</span>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground">Anti-Pop</span>
                        <span className="text-yellow-500">{pick.antiPop}</span>
                      </div>
                      <div className="w-px h-8 bg-border"></div>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground font-bold">SCORE</span>
                        <span className={`font-bold ${i === 0 ? 'text-primary text-base' : ''}`}>{pick.finalScore.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Anti-popularity breakdown on hover/expand */}
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
