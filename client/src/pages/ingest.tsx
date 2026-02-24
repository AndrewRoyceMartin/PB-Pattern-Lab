import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileType, CheckCircle, Clock } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Ingest() {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [hasFile, setHasFile] = useState(false);

  const handleSimulateUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setHasFile(true);
      toast({
        title: "File processed",
        description: "Dataset uploaded successfully in mockup mode.",
      });
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Ingestion</h1>
        <p className="text-muted-foreground mt-2 font-mono text-sm">
          Upload historical draws. System automatically normalizes to AU modern format (7+1).
        </p>
      </div>

      <Card className="border-border border-dashed border-2 bg-transparent">
        <CardContent className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <UploadCloud className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium">Upload CSV File</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Drag and drop your AU Powerball history file here, or click to browse.
            </p>
          </div>
          <div className="flex gap-4 mt-4">
            <Button variant="outline" onClick={handleSimulateUpload} disabled={isUploading}>
              <FileType className="w-4 h-4 mr-2" />
              {isUploading ? "Uploading..." : "Select File"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Normalization Pipeline</CardTitle>
            <CardDescription>Preprocessing steps for AU format</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 font-mono text-sm">
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center">
                {hasFile ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Clock className="w-4 h-4 mr-2 text-muted-foreground" />}
                Parsed schema headers
              </span>
              <span className={hasFile ? "text-green-500" : "text-muted-foreground"}>{hasFile ? "OK" : "Waiting"}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center">
                {hasFile ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Clock className="w-4 h-4 mr-2 text-muted-foreground" />}
                Modern format filter (7 mains)
              </span>
              <span className={hasFile ? "text-green-500" : "text-muted-foreground"}>{hasFile ? "OK" : "Waiting"}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center">
                {hasFile ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Clock className="w-4 h-4 mr-2 text-muted-foreground" />}
                Timezone handling (AU Local)
              </span>
              <span className={hasFile ? "text-green-500" : "text-muted-foreground"}>{hasFile ? "OK" : "Waiting"}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center">
                {hasFile ? <CheckCircle className="w-4 h-4 mr-2 text-green-500" /> : <Clock className="w-4 h-4 mr-2 text-muted-foreground" />}
                Duplicate/Error checking
              </span>
              <span className={hasFile ? "text-green-500" : "text-muted-foreground"}>{hasFile ? "OK" : "Waiting"}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Current Dataset Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Rows</span>
              <div className={`text-2xl font-mono ${hasFile ? "" : "text-muted-foreground"}`}>{hasFile ? "1,445" : "0"}</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Valid Modern Era</span>
              <div className={`text-2xl font-mono ${hasFile ? "text-primary" : "text-muted-foreground"}`}>{hasFile ? "824" : "0"}</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Draw Date</span>
              <div className={`text-xl font-mono ${hasFile ? "" : "text-muted-foreground"}`}>{hasFile ? "2024-01-25" : "N/A"}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}