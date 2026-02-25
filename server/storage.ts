import { type Draw, type InsertDraw, draws, type BenchmarkRun, type InsertBenchmarkRun, benchmarkRuns, type BenchmarkSummary, type BenchmarkRunConfig } from "@shared/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, desc, sql } from "drizzle-orm";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

export interface IStorage {
  insertDraws(drawList: InsertDraw[]): Promise<Draw[]>;
  getAllDraws(): Promise<Draw[]>;
  getModernDraws(): Promise<Draw[]>;
  getDrawCount(): Promise<number>;
  clearDraws(): Promise<void>;
  saveBenchmarkRun(config: BenchmarkRunConfig, summary: BenchmarkSummary): Promise<BenchmarkRun>;
  getLatestBenchmarkRun(): Promise<BenchmarkRun | null>;
  listBenchmarkRuns(limit?: number): Promise<BenchmarkRun[]>;
  getBenchmarkRunById(id: number): Promise<BenchmarkRun | null>;
}

export class DatabaseStorage implements IStorage {
  async insertDraws(drawList: InsertDraw[]): Promise<Draw[]> {
    if (drawList.length === 0) return [];
    const inserted = await db.insert(draws).values(drawList).returning();
    return inserted;
  }

  async getAllDraws(): Promise<Draw[]> {
    return db.select().from(draws).orderBy(desc(draws.drawNumber));
  }

  async getModernDraws(): Promise<Draw[]> {
    return db.select().from(draws).where(eq(draws.isModernFormat, true)).orderBy(desc(draws.drawNumber));
  }

  async getDrawCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(draws);
    return Number(result[0].count);
  }

  async clearDraws(): Promise<void> {
    await db.delete(draws);
  }

  async saveBenchmarkRun(config: BenchmarkRunConfig, summary: BenchmarkSummary): Promise<BenchmarkRun> {
    const [run] = await db.insert(benchmarkRuns).values({
      config: config as any,
      summary: summary as any,
      status: "success",
    }).returning();
    return run;
  }

  async getLatestBenchmarkRun(): Promise<BenchmarkRun | null> {
    const rows = await db.select().from(benchmarkRuns)
      .where(eq(benchmarkRuns.status, "success"))
      .orderBy(desc(benchmarkRuns.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async listBenchmarkRuns(limit: number = 10): Promise<BenchmarkRun[]> {
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
}

export const storage = new DatabaseStorage();
