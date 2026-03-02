import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { GameProvider } from "@/contexts/game-context";

import { Layout } from "@/components/layout";
import Dashboard from "@/pages/dashboard";
import Ingest from "@/pages/ingest";
import PatternLab from "@/pages/pattern-lab";
import Validation from "@/pages/validation";
import PickGenerator from "@/pages/pick-generator";
import FormulaLab from "@/pages/formula-lab";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard}/>
        <Route path="/ingest" component={Ingest}/>
        <Route path="/patterns" component={PatternLab}/>
        <Route path="/validation" component={Validation}/>
        <Route path="/generator" component={PickGenerator}/>
        <Route path="/formula-lab" component={FormulaLab}/>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <GameProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </GameProvider>
    </QueryClientProvider>
  );
}

export default App;
