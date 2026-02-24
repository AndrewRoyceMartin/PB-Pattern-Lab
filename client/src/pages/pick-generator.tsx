import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Zap, Play, CheckCircle, SearchX, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePicks } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function PickGenerator() {
  const { toast } = useToast();
  const [antiPopWeight, setAntiPopWeight] = useState([40]);
  const drawFitWeight = 100 - antiPopWeight[0];
  const [picks, setPicks] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetch("/api/stats").then(r => r.json()) });
  const hasData = stats?.modernDraws > 0;

  const handleGenerate = async () => {
    if (!hasData) {
      toast({ title: "No Data Available", description: "Please upload a dataset first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generatePicks(drawFitWeight, antiPopWeight[0], 10);
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
            Generate ranked picks using validated signals and anti-popularity scoring.
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !hasData}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-mono font-bold"
          data-testid="button-generate"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          {isGenerating ? "GENERATING..." : "GENERATE (TOP 10)"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">Generator Strategy</CardTitle>
              <CardDescription>Adjust composite scoring weights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-primary">Draw-Fit Score</span>
                  <span className="font-bold text-primary">{drawFitWeight}%</span>
                </div>
                <div className="flex justify-between text-sm font-mono">
                  <span className="text-yellow-500">Anti-Popularity</span>
                  <span className="font-bold text-yellow-500">{antiPopWeight[0]}%</span>
                </div>
                <Slider
                  defaultValue={[40]}
                  max={100}
                  step={10}
                  onValueChange={setAntiPopWeight}
                  className="mt-4"
                  data-testid="slider-anti-pop"
                />
              </div>

              <div className="pt-4 border-t border-border/50">
                <h4 className="text-xs font-mono font-bold text-muted-foreground mb-3 uppercase tracking-wider">Active Penalties</h4>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Birthday concentration (&le;31)
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Sequence detection
                  </div>
                  <div className="flex items-center text-muted-foreground">
                    <CheckCircle className="w-3 h-3 mr-2 text-green-500" /> Repeated endings
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-medium font-mono text-muted-foreground mb-4 border-b border-border/50 pb-2">
            GENERATED CANDIDATES [CONFIDENCE RANKED]
          </h3>

          {picks.length > 0 ? (
            <div className="space-y-3">
              {picks.map((pick: any, i: number) => (
                <div key={i} className={`p-4 rounded-lg border ${i === 0 ? 'bg-primary/5 border-primary/30' : 'bg-card border-border/50'} relative overflow-hidden group hover:border-primary/50 transition-colors`} data-testid={`card-pick-${pick.rank}`}>
                  {i === 0 && <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-4">
                      <div className={`w-8 text-center font-mono font-bold text-lg ${i === 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        #{pick.rank}
                      </div>

                      <div className="flex space-x-2">
                        {(pick.numbers as number[]).map((n: number, idx: number) => (
                          <div key={idx} className="w-9 h-9 rounded bg-secondary flex items-center justify-center font-mono text-sm border border-border/80 shadow-sm">
                            {n.toString().padStart(2, '0')}
                          </div>
                        ))}
                        <div className="w-9 h-9 rounded bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-mono text-sm font-bold shadow-sm ml-2 relative">
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
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-secondary/10">
              <SearchX className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-mono">{hasData ? "Click GENERATE to create picks." : "No picks generated."}</p>
              <p className="text-sm opacity-70 mt-1">{hasData ? "Adjust weights and hit the button." : "Upload data first."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
