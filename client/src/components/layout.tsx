import { Link, useLocation } from "wouter";
import { 
  Database, 
  TestTubes, 
  CheckCircle2, 
  Dna,
  LayoutDashboard,
  FlaskConical,
  ChevronDown
} from "lucide-react";
import { useGame } from "@/contexts/game-context";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { activeGameId, setActiveGameId, games, activeGame } = useGame();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ingest", label: "Data Ingest", icon: Database },
    { href: "/patterns", label: "Pattern Lab", icon: TestTubes },
    { href: "/validation", label: "Validation", icon: CheckCircle2 },
    { href: "/generator", label: "Pick Generator", icon: Dna },
    { href: "/formula-lab", label: "Formula Lab", icon: FlaskConical },
  ];

  const gameFormat = activeGame
    ? `${activeGame.mainCount}+${activeGame.specialCount}${activeGame.hasSupplementary ? `+${activeGame.supplementaryCount}s` : ""}`
    : "7+1";

  return (
    <div className="min-h-screen flex w-full bg-background overflow-hidden">
      <aside className="w-64 border-r border-sidebar-border bg-sidebar shrink-0 hidden md:block">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <Dna className="w-6 h-6 text-primary mr-3" />
          <h1 className="font-bold text-sidebar-foreground tracking-tight">Pattern Lab</h1>
        </div>

        <div className="px-4 pt-4 pb-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-mono mb-1.5 block">Active Game</label>
          <div className="relative">
            <select
              value={activeGameId}
              onChange={(e) => setActiveGameId(e.target.value)}
              className="w-full appearance-none bg-sidebar-accent/50 border border-sidebar-border rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground cursor-pointer pr-8 focus:outline-none focus:ring-1 focus:ring-primary/50"
              data-testid="select-game"
            >
              {games.map((g) => (
                <option key={g.gameId} value={g.gameId}>
                  {g.displayName}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center px-3 py-2.5 rounded-md transition-colors ${
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" 
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}>
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="absolute bottom-0 w-64 p-4 border-t border-sidebar-border">
          <div className="flex items-center space-x-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-muted-foreground font-mono">SYSTEM ONLINE</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b flex items-center px-8 shrink-0 bg-card/50 backdrop-blur-sm">
          <h2 className="text-sm font-medium text-muted-foreground font-mono">
            {location === "/" ? "SYSTEM_OVERVIEW" : 
             location.replace("/", "").toUpperCase() + "_MODULE"}
          </h2>
          <div className="ml-auto flex items-center space-x-4">
            <span className="text-xs font-mono text-muted-foreground" data-testid="text-game-format">
              {activeGame?.displayName?.toUpperCase() || "POWERBALL"} : {gameFormat}
            </span>
            <span className="text-xs font-mono px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">v2.0.0</span>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
