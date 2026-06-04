-- ============================================================
-- Migración 011: Agregar fine_id a payments
-- ============================================================

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS fine_id UUID REFERENCES fines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_fine_id ON payments(fine_id);
