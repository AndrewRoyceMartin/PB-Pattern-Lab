import { type Draw, type InsertDraw, draws, type BenchmarkRun, type InsertBenchmarkRun, benchmarkRuns, type BenchmarkSummary, type BenchmarkRunConfig, type Game, type InsertGame, games, type GameConfig } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, sql, and } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  insertDraws(drawList: InsertDraw[]): Promise<Draw[]>;
  getAllDraws(gameId?: string): Promise<Draw[]>;
  getModernDraws(gameId?: string): Promise<Draw[]>;
  getDrawCount(gameId?: string): Promise<number>;
  getDrawByNumber(drawNumber: number, gameId?: string): Promise<Draw | null>;
  clearDraws(gameId?: string): Promise<void>;
  saveBenchmarkRun(config: BenchmarkRunConfig, summary: BenchmarkSummary, gameId?: string): Promise<BenchmarkRun>;
  getLatestBenchmarkRun(gameId?: string): Promise<BenchmarkRun | null>;
  listBenchmarkRuns(limit?: number, gameId?: string): Promise<BenchmarkRun[]>;
  getBenchmarkRunById(id: number): Promise<BenchmarkRun | null>;
  getGame(gameId: string): Promise<Game | null>;
  listGames(): Promise<Game[]>;
  upsertGame(game: InsertGame): Promise<Game>;
}

const GAME_DEFINITIONS: InsertGame[] = [
  {
    gameId: "AU_POWERBALL",
    displayName: "Powerball",
    mainCount: 7,
    mainPool: 35,
    specialName: "Powerball",
    specialCount: 1,
    specialPool: 20,
    hasSupplementary: false,
    supplementaryCount: 0,
    supplementaryPool: 0,
    productFilter: "Powerball",
    enabled: true,
  },
  {
    gameId: "AU_SATURDAY_LOTTO",
    displayName: "Saturday Lotto",
    mainCount: 6,
    mainPool: 45,
    specialName: "Supplementary",
    specialCount: 2,
    specialPool: 45,
    hasSupplementary: true,
    supplementaryCount: 2,
    supplementaryPool: 45,
    productFilter: "TattsLotto",
    enabled: true,
  },
];

export async function seedGames(): Promise<void> {
  for (const game of GAME_DEFINITIONS) {
    const existing = await db.select().from(games).where(eq(games.gameId, game.gameId)).limit(1);
    if (existing.length === 0) {
      await db.insert(games).values(game);
      console.log(`[seed] Created game: ${game.displayName} (${game.gameId})`);
    }
  }
}

export function getGameConfig(game: Game): GameConfig {
  return {
    gameId: game.gameId,
    displayName: game.displayName,
    mainCount: game.mainCount,
    mainPool: game.mainPool,
    specialName: game.specialName,
    specialCount: game.specialCount,
    specialPool: game.specialPool,
    hasSupplementary: game.hasSupplementary,
    supplementaryCount: game.supplementaryCount ?? 0,
    supplementaryPool: game.supplementaryPool ?? 0,
    productFilter: game.productFilter,
  };
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  gameId: "AU_POWERBALL",
  displayName: "Powerball",
  mainCount: 7,
  mainPool: 35,
  specialName: "Powerball",
  specialCount: 1,
  specialPool: 20,
  hasSupplementary: false,
  supplementaryCount: 0,
  supplementaryPool: 0,
  productFilter: "Powerball",
};

export class DatabaseStorage implements IStorage {
  async insertDraws(drawList: InsertDraw[]): Promise<Draw[]> {
    if (drawList.length === 0) return [];
    const inserted = await db.insert(draws).values(drawList).returning();
    return inserted;
  }

  async getAllDraws(gameId?: string): Promise<Draw[]> {
    if (gameId) {
      return db.select().from(draws).where(eq(draws.gameId, gameId)).orderBy(desc(draws.drawNumber));
    }
    return db.select().from(draws).orderBy(desc(draws.drawNumber));
  }

  async getModernDraws(gameId?: string): Promise<Draw[]> {
    if (gameId) {
      return db.select().from(draws).where(and(eq(draws.isModernFormat, true), eq(draws.gameId, gameId))).orderBy(desc(draws.drawNumber));
    }
    return db.select().from(draws).where(eq(draws.isModernFormat, true)).orderBy(desc(draws.drawNumber));
  }

  async getDrawCount(gameId?: string): Promise<number> {
    if (gameId) {
      const result = await db.select({ count: sql<number>`count(*)` }).from(draws).where(eq(draws.gameId, gameId));
      return Number(result[0].count);
    }
    const result = await db.select({ count: sql<number>`count(*)` }).from(draws);
    return Number(result[0].count);
  }

  async getDrawByNumber(drawNumber: number, gameId?: string): Promise<Draw | null> {
    if (gameId) {
      const rows = await db.select().from(draws).where(and(eq(draws.drawNumber, drawNumber), eq(draws.gameId, gameId))).limit(1);
      return rows[0] ?? null;
    }
    const rows = await db.select().from(draws).where(eq(draws.drawNumber, drawNumber)).limit(1);
    return rows[0] ?? null;
  }

  async clearDraws(gameId?: string): Promise<void> {
    if (gameId) {
      await db.delete(draws).where(eq(draws.gameId, gameId));
    } else {
      await db.delete(draws);
    }
  }

  async saveBenchmarkRun(config: BenchmarkRunConfig, summary: BenchmarkSummary, gameId?: string): Promise<BenchmarkRun> {
    const [run] = await db.insert(benchmarkRuns).values({
      config: config as any,
      summary: summary as any,
      gameId: gameId || "AU_POWERBALL",
      status: "success",
    }).returning();
    return run;
  }

  async getLatestBenchmarkRun(gameId?: string): Promise<BenchmarkRun | null> {
    if (gameId) {
      const rows = await db.select().from(benchmarkRuns)
        .where(and(eq(benchmarkRuns.status, "success"), eq(benchmarkRuns.gameId, gameId)))
        .orderBy(desc(benchmarkRuns.createdAt))
        .limit(1);
      return rows[0] ?? null;
    }
    const rows = await db.select().from(benchmarkRuns)
      .where(eq(benchmarkRuns.status, "success"))
      .orderBy(desc(benchmarkRuns.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async listBenchmarkRuns(limit: number = 10, gameId?: string): Promise<BenchmarkRun[]> {
    if (gameId) {
      return db.select().from(benchmarkRuns)
        .where(eq(benchmarkRuns.gameId, gameId))
        .orderBy(desc(benchmarkRuns.createdAt))
        .limit(limit);
    }
    return db.select().from(benchmarkRuns)
      .orderBy(desc(benchmarkRuns.createdAt))
      .limit(limit);
  }

  async getBenchmarkRunById(id: number): Promise<BenchmarkRun | null> {
    const rows = await db.select().from(benchmarkRuns)
      .where(eq(benchmarkRuns.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async getGame(gameId: string): Promise<Game | null> {
    const rows = await db.select().from(games).where(eq(games.gameId, gameId)).limit(1);
    return rows[0] ?? null;
  }

  async listGames(): Promise<Game[]> {
    return db.select().from(games).where(eq(games.enabled, true));
  }

  async upsertGame(game: InsertGame): Promise<Game> {
    const existing = await this.getGame(game.gameId);
    if (existing) {
      const [updated] = await db.update(games).set(game).where(eq(games.gameId, game.gameId)).returning();
      return updated;
    }
    const [inserted] = await db.insert(games).values(game).returning();
    return inserted;
  }
}

export const storage = new DatabaseStorage();
