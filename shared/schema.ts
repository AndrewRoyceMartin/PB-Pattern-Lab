import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, json, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const draws = pgTable("draws", {
  id: serial("id").primaryKey(),
  drawNumber: integer("draw_number").notNull(),
  drawDate: text("draw_date").notNull(),
  numbers: json("numbers").$type<number[]>().notNull(),
  powerball: integer("powerball").notNull(),
  isModernFormat: boolean("is_modern_format").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDrawSchema = createInsertSchema(draws).omit({ id: true, createdAt: true });
export type InsertDraw = z.infer<typeof insertDrawSchema>;
export type Draw = typeof draws.$inferSelect;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
