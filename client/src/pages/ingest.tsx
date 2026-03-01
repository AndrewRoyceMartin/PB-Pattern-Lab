import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileType, CheckCircle, Clock, Loader2, Trash2, Rss, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadCSV, resetData, syncRSS, syncRSSAll } from "@/lib/api";
import { fetchApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function Ingest() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [rssResult, setRssResult] = useState<any>(null);
  const [fullSyncResult, setFullSyncResult] = useState<any>(null);

  const { data: stats, refetch: refetchStats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetchApi("/api/stats") });
  const hasData = stats?.totalDraws > 0;

  const handleFile = async (file: File) => {
    setIsUploading(true);
    try {
      const result = await uploadCSV(file);
      setUploadResult(result);
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
      await resetData();
      setUploadResult(null);
      setConfirmReset(false);
      await refetchStats();
      toast({ title: "Data cleared", description: "All draw data has been removed. Ready for a new upload." });
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } finally {
      setIsResetting(false);
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

  const pipelineOk = hasData || !!uploadResult;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-ingest-title">Data Ingestion</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Upload historical draws. System normalizes to AU modern format (7+1).
        </p>
      </div>

      <Card className="border-border border-dashed border-2 bg-transparent" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
        <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isUploading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <UploadCloud className="w-8 h-8 text-primary" />}
          </div>
          <div>
            <h3 className="text-lg font-medium">{isUploading ? "Processing CSV..." : "Upload CSV File"}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Drag and drop your AU Powerball history file, or click to browse.
            </p>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} data-testid="input-file-upload" />
          <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()} disabled={isUploading} data-testid="button-select-file">
            <FileType className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Select File"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Rss className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <CardTitle className="text-base">RSS Feed Sync</CardTitle>
              <CardDescription className="text-xs font-mono">
                Fetch latest AU Powerball draws from Lottolyzer RSS feed
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Import all AU Powerball draws from Lottolyzer, or sync just the latest. Full import fetches draws #877 onwards (takes 1-2 minutes on first run). Duplicates are automatically skipped.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleFullSync}
              disabled={isSyncingAll || isSyncing}
              data-testid="button-full-sync"
            >
              {isSyncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rss className="w-4 h-4 mr-2" />}
              {isSyncingAll ? "Importing all draws..." : "Import All Draws"}
            </Button>
            <Button
              variant="outline"
              onClick={handleRSSSync}
              disabled={isSyncing || isSyncingAll}
              data-testid="button-rss-sync"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              {isSyncing ? "Syncing..." : "Sync Latest Only"}
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
          {rssResult?.draws?.length > 0 && !fullSyncResult && (
            <div className="space-y-1 border-t border-border/50 pt-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Draws found in feed</span>
              {rssResult.draws.map((d: any) => (
                <div key={d.drawNumber} className="flex items-center gap-2 text-xs font-mono bg-secondary/30 rounded px-3 py-1.5" data-testid={`rss-draw-${d.drawNumber}`}>
                  <span className="text-foreground/70">#{d.drawNumber}</span>
                  <span className="text-muted-foreground">{d.drawDate}</span>
                  <span className="text-primary">{d.numbers.map((n: number) => n.toString().padStart(2, '0')).join(' ')}</span>
                  <span className="text-yellow-500">PB {d.powerball.toString().padStart(2, '0')}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Normalization Pipeline</CardTitle>
            <CardDescription>Preprocessing steps for AU format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            {["Parsed schema headers", "Modern format filter (7 mains)", "Timezone handling (AU Local)", "Duplicate/Error checking"].map((step, i) => (
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
            <CardTitle>Dataset Status</CardTitle>
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
                    <p className="text-sm text-destructive font-medium">This will delete all draw data. Are you sure?</p>
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
                    Reset Data
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
