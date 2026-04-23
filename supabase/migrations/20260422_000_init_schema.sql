-- ============================================
-- 주식리치고 DB 스키마 v1.0
-- Supabase PostgreSQL
-- ============================================

-- 0. ENUM 타입
CREATE TYPE verdict_type AS ENUM ('strong_buy', 'buy', 'hold', 'sell', 'strong_sell');
CREATE TYPE risk_level AS ENUM ('low', 'moderate', 'high', 'very_high');
CREATE TYPE market_type AS ENUM ('KOSPI', 'KOSDAQ');
CREATE TYPE market_state_type AS ENUM ('bull', 'bear', 'crash', 'sideways', 'theme', 'earnings_season');
CREATE TYPE cashflow_sign AS ENUM ('+', '-');
CREATE TYPE profit_status AS ENUM ('흑자', '흑자전환', '적자전환', '적자');
CREATE TYPE alert_type AS ENUM ('urgent', 'daily', 'weekly', 'score_change', 'kill_zone');

-- ============================================
-- 1. 종목 마스터
-- ============================================
CREATE TABLE stocks (
    ticker        VARCHAR(10) PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    market        market_type NOT NULL,
    sector        VARCHAR(50),
    sub_sector    VARCHAR(50),
    listed_date   DATE,
    is_active     BOOLEAN DEFAULT true,
    updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stocks_market ON stocks(market);
CREATE INDEX idx_stocks_sector ON stocks(sector);

-- ============================================
-- 2. 일별 시세
-- ============================================
CREATE TABLE daily_prices (
    ticker        VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    trade_date    DATE NOT NULL,
    open          BIGINT,
    high          BIGINT,
    low           BIGINT,
    close         BIGINT NOT NULL,
    volume        BIGINT,
    trading_value BIGINT,
    market_cap    BIGINT,
    shares        BIGINT,
    foreign_ratio NUMERIC(5,2),
    PRIMARY KEY (ticker, trade_date)
);

CREATE INDEX idx_daily_prices_date ON daily_prices(trade_date);

-- ============================================
-- 3. 분기 재무제표
-- ============================================
CREATE TABLE quarterly_financials (
    ticker             VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    fiscal_year        INT NOT NULL,
    fiscal_quarter     INT NOT NULL,
    is_estimated       BOOLEAN DEFAULT false,
    revenue            BIGINT,
    operating_profit   BIGINT,
    net_income         BIGINT,
    total_assets       BIGINT,
    total_liabilities  BIGINT,
    total_equity       BIGINT,
    operating_cf       BIGINT,
    investing_cf       BIGINT,
    financing_cf       BIGINT,
    interest_expense   BIGINT,
    roe                NUMERIC(8,2),
    per                NUMERIC(8,2),
    pbr                NUMERIC(8,2),
    eps                NUMERIC(10,2),
    debt_ratio         NUMERIC(8,2),
    current_ratio      NUMERIC(8,2),
    operating_margin   NUMERIC(8,2),
    net_margin         NUMERIC(8,2),
    PRIMARY KEY (ticker, fiscal_year, fiscal_quarter)
);

-- ============================================
-- 4. 증감율 + 저평가 인덱스
-- ============================================
CREATE TABLE growth_metrics (
    ticker              VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    calc_date           DATE NOT NULL,
    revenue_growth      NUMERIC(10,2),
    op_profit_growth    NUMERIC(10,2),
    net_income_growth   NUMERIC(10,2),
    market_cap_growth   NUMERIC(10,2),
    undervalue_ni       NUMERIC(10,2),
    undervalue_op       NUMERIC(10,2),
    undervalue_rev      NUMERIC(10,2),
    profit_status       profit_status,
    PRIMARY KEY (ticker, calc_date)
);

CREATE INDEX idx_growth_undervalue ON growth_metrics(calc_date, undervalue_ni DESC);

-- ============================================
-- 5. Kill Zone (Layer 0)
-- ============================================
CREATE TABLE kill_zone (
    ticker         VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    check_date     DATE NOT NULL,
    is_killed      BOOLEAN NOT NULL,
    audit_fail     BOOLEAN DEFAULT false,
    capital_impair BOOLEAN DEFAULT false,
    interest_cover BOOLEAN DEFAULT false,
    negative_cf    BOOLEAN DEFAULT false,
    cb_repeat      BOOLEAN DEFAULT false,
    mgmt_warning   BOOLEAN DEFAULT false,
    kill_reason    TEXT,
    PRIMARY KEY (ticker, check_date)
);

-- ============================================
-- 6. 5층 스코어 종합
-- ============================================
CREATE TABLE stock_scores (
    ticker          VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    score_date      DATE NOT NULL,
    layer1_score    NUMERIC(5,1) NOT NULL,
    layer2_score    NUMERIC(5,1) NOT NULL,
    layer3_score    NUMERIC(5,1) NOT NULL,
    layer4_score    NUMERIC(5,1) NOT NULL,
    total_score     NUMERIC(5,1) NOT NULL,
    w1              NUMERIC(4,2) DEFAULT 1.0,
    w2              NUMERIC(4,2) DEFAULT 1.0,
    w3              NUMERIC(4,2) DEFAULT 1.0,
    w4              NUMERIC(4,2) DEFAULT 1.0,
    verdict         verdict_type NOT NULL,
    confidence      INT NOT NULL,
    reasons         TEXT[] NOT NULL,
    risks           TEXT[] NOT NULL,
    invalidation    TEXT,
    PRIMARY KEY (ticker, score_date)
);

CREATE INDEX idx_scores_total ON stock_scores(score_date, total_score DESC);
CREATE INDEX idx_scores_verdict ON stock_scores(score_date, verdict);

-- ============================================
-- 7. Layer 1 상세
-- ============================================
CREATE TABLE score_fundamental (
    ticker         VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    score_date     DATE NOT NULL,
    profitability  NUMERIC(4,1),
    safety         NUMERIC(4,1),
    growth         NUMERIC(4,1),
    cashflow       NUMERIC(4,1),
    total          NUMERIC(4,1),
    detail_json    JSONB,
    PRIMARY KEY (ticker, score_date)
);

-- ============================================
-- 8. Layer 2 상세
-- ============================================
CREATE TABLE score_technical (
    ticker         VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    score_date     DATE NOT NULL,
    trend          NUMERIC(4,1),
    momentum       NUMERIC(4,1),
    supply_demand  NUMERIC(4,1),
    total          NUMERIC(4,1),
    ma5            BIGINT,
    ma20           BIGINT,
    ma60           BIGINT,
    ma120          BIGINT,
    rsi            NUMERIC(5,2),
    macd           NUMERIC(10,2),
    macd_signal    NUMERIC(10,2),
    bb_upper       BIGINT,
    bb_lower       BIGINT,
    detail_json    JSONB,
    PRIMARY KEY (ticker, score_date)
);

-- ============================================
-- 9. Layer 3: 거시경제
-- ============================================
CREATE TABLE macro_snapshot (
    snapshot_date      DATE PRIMARY KEY,
    interest_rate      NUMERIC(5,2),
    rate_direction     VARCHAR(20),
    rate_score         NUMERIC(4,1),
    business_cycle     VARCHAR(20),
    cycle_score        NUMERIC(4,1),
    vix                NUMERIC(6,2),
    yield_spread       NUMERIC(6,3),
    credit_spread      NUMERIC(6,3),
    risk_score         NUMERIC(4,1),
    total_score        NUMERIC(4,1),
    kospi_index        NUMERIC(10,2),
    kosdaq_index       NUMERIC(10,2),
    exchange_rate      NUMERIC(10,2),
    oil_price          NUMERIC(10,2),
    gold_price         NUMERIC(10,2),
    fear_greed_index   INT,
    detail_json        JSONB
);

-- ============================================
-- 10. Layer 4: 계절성
-- ============================================
CREATE TABLE seasonality_snapshot (
    snapshot_date      DATE PRIMARY KEY,
    year_cycle_score   NUMERIC(4,1),
    month_score        NUMERIC(4,1),
    month_end_score    NUMERIC(4,1),
    total_score        NUMERIC(4,1),
    detail_json        JSONB
);

-- ============================================
-- 11. 시장 상태 판단
-- ============================================
CREATE TABLE market_state (
    judge_date     DATE PRIMARY KEY,
    state          market_state_type NOT NULL,
    strategy       TEXT NOT NULL,
    cash_ratio     NUMERIC(5,2),
    detail_json    JSONB
);

-- ============================================
-- 12. 상대강도
-- ============================================
CREATE TABLE relative_strength (
    ticker              VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    calc_date           DATE NOT NULL,
    return_1w           NUMERIC(8,2),
    return_1m           NUMERIC(8,2),
    return_3m           NUMERIC(8,2),
    index_return_1w     NUMERIC(8,2),
    index_return_1m     NUMERIC(8,2),
    index_return_3m     NUMERIC(8,2),
    excess_1w           NUMERIC(8,2),
    excess_1m           NUMERIC(8,2),
    excess_3m           NUMERIC(8,2),
    rs_score            NUMERIC(8,2),
    market_cap_group    VARCHAR(10),
    PRIMARY KEY (ticker, calc_date)
);

CREATE INDEX idx_rs_score ON relative_strength(calc_date, rs_score DESC);

-- ============================================
-- 13. 이상 신호 로그
-- ============================================
CREATE TABLE anomaly_signals (
    id              BIGSERIAL PRIMARY KEY,
    detected_at     TIMESTAMPTZ DEFAULT now(),
    ticker          VARCHAR(10) REFERENCES stocks(ticker),
    signal_type     VARCHAR(50) NOT NULL,
    severity        VARCHAR(20),
    description     TEXT,
    trigger_data    JSONB,
    processed       BOOLEAN DEFAULT false,
    processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_anomaly_unprocessed ON anomaly_signals(processed, detected_at DESC);

-- ============================================
-- 14. DART 공시
-- ============================================
CREATE TABLE dart_filings (
    filing_id       VARCHAR(30) PRIMARY KEY,
    ticker          VARCHAR(10) REFERENCES stocks(ticker),
    corp_name       VARCHAR(100),
    filing_date     DATE NOT NULL,
    filing_type     VARCHAR(100),
    title           TEXT,
    content_summary TEXT,
    url             TEXT,
    is_critical     BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dart_ticker ON dart_filings(ticker, filing_date DESC);

-- ============================================
-- 15. 뉴스/테마
-- ============================================
CREATE TABLE news_events (
    id              BIGSERIAL PRIMARY KEY,
    published_at    TIMESTAMPTZ,
    source          VARCHAR(100),
    title           TEXT NOT NULL,
    summary         TEXT,
    keywords        TEXT[],
    linked_themes   TEXT[],
    linked_tickers  VARCHAR(10)[],
    sentiment       NUMERIC(4,2),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_news_published ON news_events(published_at DESC);

-- ============================================
-- 16. LEARN: 판단 성과 추적
-- ============================================
CREATE TABLE verdict_performance (
    id              BIGSERIAL PRIMARY KEY,
    ticker          VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    verdict_date    DATE NOT NULL,
    verdict         verdict_type NOT NULL,
    total_score     NUMERIC(5,1),
    return_1w       NUMERIC(8,2),
    return_2w       NUMERIC(8,2),
    return_1m       NUMERIC(8,2),
    return_3m       NUMERIC(8,2),
    was_correct_1w  BOOLEAN,
    was_correct_1m  BOOLEAN,
    evaluated_at    TIMESTAMPTZ
);

CREATE INDEX idx_perf_verdict ON verdict_performance(verdict, verdict_date);

-- ============================================
-- 17. LEARN: 가중치 이력
-- ============================================
CREATE TABLE weight_history (
    id              BIGSERIAL PRIMARY KEY,
    adjusted_at     DATE NOT NULL,
    w1              NUMERIC(4,2) NOT NULL,
    w2              NUMERIC(4,2) NOT NULL,
    w3              NUMERIC(4,2) NOT NULL,
    w4              NUMERIC(4,2) NOT NULL,
    reason          TEXT,
    accuracy_before JSONB,
    accuracy_after  JSONB
);

-- ============================================
-- 18. 사용자
-- ============================================
CREATE TABLE user_profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id),
    display_name    VARCHAR(100),
    invest_style    VARCHAR(20),
    plan            VARCHAR(20) DEFAULT 'free',
    onboarding_done BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 19. 관심종목
-- ============================================
CREATE TABLE watchlist (
    user_id     UUID NOT NULL REFERENCES user_profiles(id),
    ticker      VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    added_at    TIMESTAMPTZ DEFAULT now(),
    memo        TEXT,
    PRIMARY KEY (user_id, ticker)
);

-- ============================================
-- 20. 알림
-- ============================================
CREATE TABLE alerts (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES user_profiles(id),
    alert_type      alert_type NOT NULL,
    ticker          VARCHAR(10) REFERENCES stocks(ticker),
    title           TEXT NOT NULL,
    body            TEXT,
    channel         VARCHAR(20),
    is_read         BOOLEAN DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_alerts_user ON alerts(user_id, is_read, created_at DESC);

-- ============================================
-- 21. 포트폴리오
-- ============================================
CREATE TABLE portfolios (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES user_profiles(id),
    ticker          VARCHAR(10) NOT NULL REFERENCES stocks(ticker),
    quantity        INT NOT NULL,
    avg_price       BIGINT NOT NULL,
    target_price    BIGINT,
    stop_loss       BIGINT,
    kelly_ratio     NUMERIC(5,2),
    added_at        TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
    ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile"
    ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users manage own watchlist"
    ON watchlist FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users read own alerts"
    ON alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users manage own portfolio"
    ON portfolios FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 공개 테이블 읽기 정책 (비인증 사용자도 시장 데이터 조회 가능)
-- ============================================
ALTER TABLE stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE macro_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasonality_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE relative_strength ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read stocks" ON stocks FOR SELECT USING (true);
CREATE POLICY "Public read daily_prices" ON daily_prices FOR SELECT USING (true);
CREATE POLICY "Public read growth_metrics" ON growth_metrics FOR SELECT USING (true);
CREATE POLICY "Public read stock_scores" ON stock_scores FOR SELECT USING (true);
CREATE POLICY "Public read macro_snapshot" ON macro_snapshot FOR SELECT USING (true);
CREATE POLICY "Public read seasonality_snapshot" ON seasonality_snapshot FOR SELECT USING (true);
CREATE POLICY "Public read market_state" ON market_state FOR SELECT USING (true);
CREATE POLICY "Public read relative_strength" ON relative_strength FOR SELECT USING (true);
