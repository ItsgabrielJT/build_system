-- Migracion 023: tasas activas BCE para interes por mora

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS interest_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period CHAR(7) NOT NULL UNIQUE,
    annual_rate_percent DECIMAL(9,6) NOT NULL CHECK (annual_rate_percent >= 0),
    source VARCHAR(255) DEFAULT 'Banco Central del Ecuador',
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_interest_rates_period_format CHECK (period ~ '^[0-9]{4}-[0-9]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_interest_rates_period ON interest_rates(period);

INSERT INTO settings (building_name, building_address, due_day)
SELECT 'Edificio Principal', '', 5
WHERE NOT EXISTS (SELECT 1 FROM settings);
