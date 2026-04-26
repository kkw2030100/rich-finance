-- ============================================================
-- 2026-04-26: 점수 산식 6 layer 확장 — L5 컨센서스, L6 모멘텀 컬럼 추가
-- ============================================================

ALTER TABLE stock_score_history
  ADD COLUMN IF NOT EXISTS l5_score REAL,
  ADD COLUMN IF NOT EXISTS l6_score REAL;

-- 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'stock_score_history'
ORDER BY ordinal_position;
