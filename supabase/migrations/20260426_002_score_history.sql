-- ============================================================
-- 2026-04-26: 종합점수 시계열 (시점별 brain v5)
-- Supabase Dashboard → SQL Editor에서 1회 실행
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_score_history (
  code TEXT NOT NULL,
  date DATE NOT NULL,
  total_score REAL NOT NULL,
  l1_score REAL,
  l2_score REAL,
  l3_score REAL,
  l4_score REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (code, date)
);

CREATE INDEX IF NOT EXISTS idx_ssh_code_date ON stock_score_history(code, date DESC);
CREATE INDEX IF NOT EXISTS idx_ssh_date ON stock_score_history(date DESC);

-- RLS
ALTER TABLE stock_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssh_read ON stock_score_history;
CREATE POLICY ssh_read ON stock_score_history
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS ssh_service_all ON stock_score_history;
CREATE POLICY ssh_service_all ON stock_score_history
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 확인
SELECT 'stock_score_history' as table_name, COUNT(*) as row_count
FROM stock_score_history;
