-- Migración 018: módulo de ingresos administrativos

CREATE TABLE IF NOT EXISTS incomes (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    date         DATE          NOT NULL,
    concept      VARCHAR(255)  NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    source       VARCHAR(120),
    category     VARCHAR(100),
    method       VARCHAR(50),
    reference    VARCHAR(255),
    period       CHAR(7),
    apartment_id UUID          REFERENCES apartments(id) ON DELETE SET NULL,
    owner_id     UUID          REFERENCES owners(id) ON DELETE SET NULL,
    status       VARCHAR(50)   NOT NULL DEFAULT 'REGISTRADO',
    created_by   VARCHAR(128),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_incomes_period_status ON incomes(period, status);
CREATE INDEX IF NOT EXISTS idx_incomes_apartment_period ON incomes(apartment_id, period);
CREATE INDEX IF NOT EXISTS idx_incomes_owner_id ON incomes(owner_id);
