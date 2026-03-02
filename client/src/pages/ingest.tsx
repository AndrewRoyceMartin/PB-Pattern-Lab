import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileType, CheckCircle, Clock, Loader2, Trash2, Rss, RefreshCw, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadCSV, resetData, syncRSS, syncRSSAll, syncTheLott } from "@/lib/api";
import { fetchApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useGame } from "@/contexts/game-context";

export default function Ingest() {
  const { toast } = useToast();
  const { activeGameId, activeGame } = useGame();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [isSyncingTheLott, setIsSyncingTheLott] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [rssResult, setRssResult] = useState<any>(null);
  const [fullSyncResult, setFullSyncResult] = useState<any>(null);
  const [theLottResult, setTheLottResult] = useState<any>(null);

  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["/api/stats", activeGameId],
    queryFn: () => fetchApi(`/api/stats?gameId=${activeGameId}`),
  });
  const hasData = stats?.totalDraws > 0;

  const isPowerball = activeGameId === "AU_POWERBALL";
  const isSaturdayLotto = activeGameId === "AU_SATURDAY_LOTTO";

  const gameName = activeGame?.displayName || "Powerball";
  const gameFormat = activeGame
    ? `${activeGame.mainCount} from ${activeGame.mainPool} + ${activeGame.specialName} ${activeGame.specialCount} from ${activeGame.specialPool}`
    : "7 from 35 + Powerball 1 from 20";

  const handleFile = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadCSV(file, activeGameId);
      setUploadResult(result);
      await refetchStats();
      toast({ title: "Upload successful", description: `Processed ${result.validDraws} draws (${result.modernDraws} modern format).` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setIsResetting(true);
    try {
      await resetData(activeGameId);
      setUploadResult(null);
      setConfirmReset(false);
      await refetchStats();
      toast({ title: "Data cleared", description: `All ${gameName} draw data has been removed.` });
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
    }
  };

  const handleTheLottSync = async () => {
    setIsSyncingTheLott(true);
    setTheLottResult(null);
    try {
      const gameType = isPowerball ? "powerball" : "saturday-lotto";
      const result = await syncTheLott(gameType as "powerball" | "saturday-lotto");
      setTheLottResult(result);
      await refetchStats();
      toast({
        title: result.synced > 0 ? "Sync complete" : "Already up to date",
        description: result.message,
      });
    } catch (error: any) {
      toast({ title: "TheLott sync failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncingTheLott(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncingAll(true);
    setFullSyncResult(null);
    try {
      const result = await syncRSSAll();
      setFullSyncResult(result);
      await refetchStats();
      toast({
        title: result.synced > 0 ? "Full import complete" : "Already up to date",
        description: result.message,
      });
    } catch (error: any) {
      toast({ title: "Full import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleRSSSync = async () => {
    setIsSyncing(true);
    setRssResult(null);
    try {
      const result = await syncRSS();
      setRssResult(result);
      await refetchStats();
      toast({
        title: result.synced > 0 ? "RSS sync complete" : "Already up to date",
        description: result.message,
      });
    } catch (error: any) {
      toast({ title: "RSS sync failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const anySyncing = isSyncing || isSyncingAll || isSyncingTheLott;
  const pipelineOk = hasData || !!uploadResult;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-ingest-title">Data Ingestion</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          {gameName} — {gameFormat}
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-base">TheLott API Sync</CardTitle>
              <CardDescription className="text-xs font-mono">
                Official {gameName} results from TheLott (recommended)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Fetches the latest {gameName} results directly from The Lott's official API. Returns up to 10 most recent draws. Duplicates are automatically skipped.
          </p>
          <Button
            onClick={handleTheLottSync}
            disabled={anySyncing}
            data-testid="button-thelott-sync"
          >
            {isSyncingTheLott ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            {isSyncingTheLott ? "Syncing from TheLott..." : `Sync ${gameName} from TheLott`}
          </Button>
          {theLottResult && (
            <div className={`text-xs font-mono p-3 rounded border ${theLottResult.synced > 0 ? "text-green-400 border-green-500/30 bg-green-500/5" : "text-muted-foreground border-border/50 bg-secondary/10"}`} data-testid="text-thelott-result">
              {theLottResult.message}
              {theLottResult.source && (
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${theLottResult.source === "api" ? "bg-blue-500/20 text-blue-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {theLottResult.source === "api" ? "API" : "SCRAPE"}
                </span>
              )}
            </div>
          )}
          {theLottResult?.draws?.length > 0 && (
            <div className="space-y-1 border-t border-border/50 pt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Synced draws</span>
              {theLottResult.draws.map((d: any) => (
                <div key={d.drawNumber} className="flex items-center gap-2 text-xs font-mono bg-secondary/30 rounded px-3 py-1.5" data-testid={`thelott-draw-${d.drawNumber}`}>
                  <span className="text-foreground/70">#{d.drawNumber}</span>
                  <span className="text-muted-foreground">{d.drawDate}</span>
                  <span className="text-primary">{d.numbers.map((n: number) => n.toString().padStart(2, '0')).join(' ')}</span>
                  {d.powerball != null && <span className="text-yellow-500">{activeGame?.specialName || "PB"} {d.powerball.toString().padStart(2, '0')}</span>}
                  {d.supplementary && <span className="text-cyan-400">Supp {d.supplementary.map((n: number) => n.toString().padStart(2, '0')).join(' ')}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isPowerball && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Rss className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-base">Lottolyzer Import</CardTitle>
                <CardDescription className="text-xs font-mono">
                  Bulk historical import from Lottolyzer (Powerball only)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Import all Powerball draws from Lottolyzer (draws #877 onwards, takes 1-2 minutes on first run). Use for initial bulk data load. Duplicates are automatically skipped.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleFullSync}
                disabled={anySyncing}
                data-testid="button-full-sync"
              >
                {isSyncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rss className="w-4 h-4 mr-2" />}
                {isSyncingAll ? "Importing all draws..." : "Import All Draws"}
              </Button>
              <Button
                variant="outline"
                onClick={handleRSSSync}
                disabled={anySyncing}
                data-testid="button-rss-sync"
              >
                {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                {isSyncing ? "Syncing..." : "Sync Latest (RSS)"}
              </Button>
            </div>
            {isSyncingAll && (
              <div className="text-xs font-mono text-muted-foreground/70 animate-pulse">
                Fetching draws from Lottolyzer... this may take 1-2 minutes.
              </div>
            )}
            {fullSyncResult && (
              <div className={`text-xs font-mono p-3 rounded border ${fullSyncResult.synced > 0 ? "text-green-400 border-green-500/30 bg-green-500/5" : "text-muted-foreground border-border/50 bg-secondary/10"}`} data-testid="text-full-sync-result">
                <div>{fullSyncResult.message}</div>
                {fullSyncResult.drawRange && (
                  <div className="text-muted-foreground/60 mt-1">Range: Draw #{fullSyncResult.drawRange.first} — #{fullSyncResult.drawRange.last}</div>
                )}
              </div>
            )}
            {rssResult && !fullSyncResult && (
              <div className={`text-xs font-mono ${rssResult.synced > 0 ? "text-green-500" : "text-muted-foreground"}`} data-testid="text-rss-result">
                {rssResult.message}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border border-dashed border-2 bg-transparent" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            {isUploading ? <Loader2 className="w-7 h-7 text-primary animate-spin" /> : <UploadCloud className="w-7 h-7 text-primary" />}
          </div>
          <div>
            <h3 className="text-lg font-medium">{isUploading ? "Processing CSV..." : "Upload CSV File"}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Drag and drop your {gameName} history file, or click to browse.
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} data-testid="input-file-upload" />
          <Button variant="outline" className="mt-2" onClick={() => fileInputRef.current?.click()} disabled={isUploading} data-testid="button-select-file">
            <FileType className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Select File"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Normalization Pipeline</CardTitle>
            <CardDescription>Preprocessing steps for {gameName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            {[
              `Parsed schema headers`,
              `Modern format filter (${activeGame?.mainCount || 7} mains)`,
              "Timezone handling (AU Local)",
              "Duplicate/Error checking"
            ].map((step, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
                <span className="flex items-center">
                  {pipelineOk ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Clock className="w-4 h-4 mr-2 text-muted-foreground" />}
                  {step}
                </span>
                <span className={pipelineOk ? "text-green-500" : "text-muted-foreground"}>{pipelineOk ? "OK" : "Waiting"}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Dataset Status — {gameName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Rows</span>
              <div className={`text-2xl font-mono ${hasData ? "" : "text-muted-foreground"}`} data-testid="text-total-rows">{stats?.totalDraws?.toLocaleString() ?? "0"}</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Valid Modern Era</span>
              <div className={`text-2xl font-mono ${hasData ? "text-primary" : "text-muted-foreground"}`} data-testid="text-modern-rows">{stats?.modernDraws?.toLocaleString() ?? "0"}</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Draw Date</span>
              <div className={`text-xl font-mono ${hasData ? "" : "text-muted-foreground"}`} data-testid="text-latest-date">{stats?.latestDate ?? "N/A"}</div>
            </div>
            {hasData && (
              <div className="pt-4 border-t border-border">
                {confirmReset ? (
                  <div className="space-y-2">
                    <p className="text-sm text-destructive font-medium">This will delete all {gameName} draw data. Are you sure?</p>
                    <div className="flex gap-2">
                      <Button variant="destructive" size="sm" onClick={handleReset} disabled={isResetting} data-testid="button-confirm-reset">
                        {isResetting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        {isResetting ? "Clearing..." : "Yes, clear all data"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)} disabled={isResetting} data-testid="button-cancel-reset">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleReset} data-testid="button-reset-data">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Reset {gameName} Data
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
