/**
 * DB 접근 레이어 — 듀얼 모드
 *
 * 로컬 (brain.db 있을 때): better-sqlite3 직접 읽기 (빠름)
 * Vercel (brain.db 없을 때): Supabase REST API (배포용)
 */

let _useLocal = false;
let _db: import('better-sqlite3').Database | null = null;

function tryLocalDb(): import('better-sqlite3').Database | null {
  if (_db) return _db;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3');
    const path = require('path');
    const dbPath = path.join(process.cwd(), '..', 'projects', 'stock-brain-engine', 'data', 'brain.db');
    const fs = require('fs');
    if (!fs.existsSync(dbPath)) return null;
    _db = new Database(dbPath, { readonly: true });
    (_db as import('better-sqlite3').Database).pragma('journal_mode = WAL');
    _useLocal = true;
    return _db;
  } catch {
    return null;
  }
}

export function getDb(): import('better-sqlite3').Database {
  const db = tryLocalDb();
  if (!db) {
    throw new Error('LOCAL_DB_NOT_AVAILABLE');
  }
  return db;
}

export function isLocalDb(): boolean {
  tryLocalDb();
  return _useLocal;
}

// Types matching brain.db schema
export interface DbStock {
  code: string;
  name: string;
  market: string;
}

export interface DbDailyPrice {
  code: string;
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  market_cap: number;
  change_pct: number;
}

export interface DbFinancial {
  code: string;
  period: string;
  period_type: string;
  revenue: number;
  operating_profit: number;
  net_income: number;
  op_margin: number | null;
  net_margin: number | null;
  roe: number | null;
  debt_ratio: number | null;
  quick_ratio: number | null;
  eps: number | null;
  per: number | null;
  bps: number | null;
  pbr: number | null;
  is_estimate: number;
}
