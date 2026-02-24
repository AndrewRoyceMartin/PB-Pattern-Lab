import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadCloud, FileType, CheckCircle } from "lucide-react";

export default function Ingest() {
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
          <Button variant="outline" className="mt-4">
            <FileType className="w-4 h-4 mr-2" />
            Select File
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
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Parsed schema headers</span>
              <span className="text-green-500">OK</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Modern format filter (7 mains)</span>
              <span className="text-green-500">OK</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Timezone handling (AU Local)</span>
              <span className="text-green-500">OK</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded bg-secondary/50 border border-border/50">
              <span className="flex items-center"><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Duplicate/Error checking</span>
              <span className="text-green-500">OK</span>
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
              <div className="text-2xl font-mono">1,445</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Valid Modern Era</span>
              <div className="text-2xl font-mono text-primary">824</div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Last Draw Date</span>
              <div className="text-xl font-mono">2024-01-25</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
