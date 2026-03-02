import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Game } from "@shared/schema";

interface GameContextValue {
  activeGameId: string;
  setActiveGameId: (id: string) => void;
  games: Game[];
  activeGame: Game | null;
  isLoading: boolean;
}

const GameContext = createContext<GameContextValue>({
  activeGameId: "AU_POWERBALL",
  setActiveGameId: () => {},
  games: [],
  activeGame: null,
  isLoading: true,
});

export function GameProvider({ children }: { children: ReactNode }) {
  const [activeGameId, setActiveGameIdState] = useState<string>(() => {
    return localStorage.getItem("activeGameId") || "AU_POWERBALL";
  });

  const { data: games = [], isLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
    queryFn: async () => {
      const res = await fetch("/api/games");
      const json = await res.json();
      return json.data || [];
    },
  });

  const activeGame = games.find((g) => g.gameId === activeGameId) || null;

  const setActiveGameId = (id: string) => {
    setActiveGameIdState(id);
    localStorage.setItem("activeGameId", id);
  };

  useEffect(() => {
    if (games.length > 0 && !games.find((g) => g.gameId === activeGameId)) {
      setActiveGameId(games[0].gameId);
    }
  }, [games, activeGameId]);

  return (
    <GameContext.Provider value={{ activeGameId, setActiveGameId, games, activeGame, isLoading }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
}
