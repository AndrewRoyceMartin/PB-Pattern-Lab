import { type Draw, type InsertDraw, draws } from "@shared/schema";
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
}

export const storage = new DatabaseStorage();
