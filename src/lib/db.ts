import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '..', 'projects', 'stock-brain-engine', 'data', 'brain.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
    _db.pragma('journal_mode = WAL');
  }
  return _db;
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
  market_cap: number;   // 억원
  change_pct: number;
}

export interface DbFinancial {
  code: string;
  period: string;
  period_type: string;  // 'annual' | 'quarter'
  revenue: number;      // 억원
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
