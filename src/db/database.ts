import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'recruiterbot.db');
export const db = new DatabaseSync(dbPath);

// Enable foreign keys and WAL mode for reliability
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

/**
 * Execute raw SQL script (DDL or batch commands)
 */
export function executeRawSql(sql: string): void {
  db.exec(sql);
}

/**
 * Run a raw query returning all matched rows
 */
export function queryRawAll<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

/**
 * Run a raw query returning a single row
 */
export function queryRawGet<T = Record<string, unknown>>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

/**
 * Run a raw DML command (INSERT, UPDATE, DELETE)
 */
export function runRaw(sql: string, params: (string | number | null)[] = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}
