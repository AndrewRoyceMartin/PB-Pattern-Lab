import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileType, CheckCircle, Clock, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { uploadCSV } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";

export default function Ingest() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  const { data: stats } = useQuery({ queryKey: ["/api/stats"], queryFn: () => fetch("/api/stats").then(r => r.json()) });
  const hasData = stats?.totalDraws > 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadCSV(file);
      setUploadResult(result);
      toast({ title: "Upload successful", description: `Processed ${result.validDraws} valid draws (${result.modernDraws} modern format).` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadCSV(file);
      setUploadResult(result);
      toast({ title: "Upload successful", description: `Processed ${result.validDraws} valid draws (${result.modernDraws} modern format).` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const pipelineOk = hasData || !!uploadResult;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight" data-testid="text-ingest-title">Data Ingestion</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Upload historical draws. System automatically normalizes to AU modern format (7+1).
        </p>
      </div>

      <Card
        className="border-border border-dashed border-2 bg-transparent"
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {isUploading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : <UploadCloud className="w-8 h-8 text-primary" />}
          </div>
          <div>
            <h3 className="text-lg font-medium">{isUploading ? "Processing CSV..." : "Upload CSV File"}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Drag and drop your AU Powerball history file here, or click to browse.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileSelect}
            data-testid="input-file-upload"
          />
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            data-testid="button-select-file"
          >
            <FileType className="w-4 h-4 mr-2" />
            {isUploading ? "Uploading..." : "Select File"}
          </Button>
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
            <CardTitle>Current Dataset Status</CardTitle>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
