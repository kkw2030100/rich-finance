-- ============================================================
-- 2026-04-26: 미국 시장 + Stage 2 Breakout 신호 추가
-- ============================================================
--
-- 사용법: Supabase Dashboard → SQL Editor에 복사 → Run
-- 한 번만 실행하면 됨. 안전하게 IF NOT EXISTS / IF NOT EXISTS 사용.
-- ============================================================

-- 1) market_type enum에 'US' 추가
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'US'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'market_type')
  ) THEN
    ALTER TYPE market_type ADD VALUE 'US';
  END IF;
END $$;


-- 2) Stage 2 Breakout 신호 테이블
CREATE TABLE IF NOT EXISTS stage2_signals (
  ticker TEXT NOT NULL,
  scan_date DATE NOT NULL,
  score INTEGER NOT NULL,
  box_pos REAL,
  ma_diff REAL,
  ma60_slope REAL,
  vol_ratio REAL,
  ret_4w REAL,
  confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (ticker, scan_date)
);

CREATE INDEX IF NOT EXISTS idx_stage2_date_desc ON stage2_signals(scan_date DESC);
CREATE INDEX IF NOT EXISTS idx_stage2_ticker ON stage2_signals(ticker);
CREATE INDEX IF NOT EXISTS idx_stage2_score ON stage2_signals(scan_date DESC, score DESC);

-- RLS 활성화 (anon 읽기 허용)
ALTER TABLE stage2_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stage2_read ON stage2_signals;
CREATE POLICY stage2_read ON stage2_signals
  FOR SELECT TO anon, authenticated USING (true);

-- service_role은 전체 권한 (sync용)
DROP POLICY IF EXISTS stage2_service_all ON stage2_signals;
CREATE POLICY stage2_service_all ON stage2_signals
  FOR ALL TO service_role USING (true) WITH CHECK (true);


-- 3) 확인 쿼리
SELECT 'market_type values:' as info,
       string_agg(enumlabel, ', ') as values
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'market_type');

SELECT 'stage2_signals' as table_name,
       COUNT(*) as row_count
FROM stage2_signals;
