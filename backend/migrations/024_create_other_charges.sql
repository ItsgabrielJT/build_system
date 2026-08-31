-- Migración 024: Cobros adicionales separados de alícuotas y multas

CREATE TABLE IF NOT EXISTS other_charges (
    id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id  UUID          NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    period        CHAR(7)       NOT NULL,
    concept       VARCHAR(160)  NOT NULL,
    amount        DECIMAL(12,2) NOT NULL,
    periodicity   VARCHAR(20)   NOT NULL DEFAULT 'MENSUAL',
    created_by    VARCHAR(128),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    UNIQUE (apartment_id, period, concept),
    CHECK (periodicity IN ('MENSUAL', 'SEMESTRAL', 'ANUAL'))
);

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS other_charge_id UUID REFERENCES other_charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_other_charges_apt_period ON other_charges(apartment_id, period);
CREATE INDEX IF NOT EXISTS idx_other_charges_periodicity ON other_charges(periodicity);
CREATE INDEX IF NOT EXISTS idx_payments_other_charge_id ON payments(other_charge_id);
