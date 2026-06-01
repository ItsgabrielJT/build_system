-- ============================================================
-- Migración 009: SPEC-008 — Pagos con Comprobante, Aprobación y Notificaciones
-- Alcance: ampliar payments con auditoría de aprobación/rechazo,
--          crear payment_proofs (metadata de comprobantes)
--          y notifications (bandeja interna de eventos).
-- Reversión manual: ver sección DOWN al final del archivo.
-- ============================================================

-- ─── 1. AMPLIAR TABLA payments ──────────────────────────────
-- Se agregan campos de auditoría para el ciclo de vida
-- PENDIENTE_APROBACION → APROBADO / RECHAZADO.
-- Los pagos históricos (status = REGISTRADO | ANULADO) conservan
-- estos campos en NULL sin romper contratos existentes.

ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS approved_by      VARCHAR(128),
    ADD COLUMN IF NOT EXISTS approved_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_by      VARCHAR(128),
    ADD COLUMN IF NOT EXISTS rejected_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500);

-- ─── 2. CREAR TABLA payment_proofs ──────────────────────────
-- Guarda la metadata del archivo de comprobante asociado a un pago.
-- El contenido binario se almacena en disco (storage local).
-- Una FK hacia payments permite trazar reenvíos tras rechazos
-- (múltiples proof por payment_id).

CREATE TABLE IF NOT EXISTS payment_proofs (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id   UUID         NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    file_name    VARCHAR(255) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    uploaded_by  VARCHAR(128) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 3. CREAR TABLA notifications ───────────────────────────
-- Bandeja interna de notificaciones. Soporta notificaciones
-- dirigidas a un rol completo (target_role = 'ADMIN') o a un
-- usuario específico (target_user_id = firebase_uid).
-- reference_id apunta al pago relacionado (o null para eventos globales).

CREATE TABLE IF NOT EXISTS notifications (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    type           VARCHAR(100) NOT NULL,      -- 'PAGO_PENDIENTE_APROBACION', 'PAGO_APROBADO', etc.
    payload        JSONB,                      -- datos adicionales del evento
    target_role    VARCHAR(50)  NOT NULL,      -- 'ADMIN' | 'PROPIETARIO'
    target_user_id VARCHAR(128),               -- uid Firebase del destinatario (opcional)
    reference_id   UUID,                       -- payment_id u otro UUID referenciado
    read_at        TIMESTAMPTZ,                -- NULL = sin leer
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── 4. ÍNDICES ─────────────────────────────────────────────
-- Justificación: según spec sección "Índices / Constraints"

-- Historial y filtros por propietario/período/estado (HU-01, HU-02)
CREATE INDEX IF NOT EXISTS idx_payments_period_owner_status
    ON payments(period, owner_id, status);

-- Bandeja de pendientes del ADMIN — ordenada por fecha de creación (HU-02)
CREATE INDEX IF NOT EXISTS idx_payments_status_created_at
    ON payments(status, created_at DESC);

-- Revisión cronológica de comprobantes asociados a un pago (CRITERIO-1.5)
CREATE INDEX IF NOT EXISTS idx_payment_proofs_payment_created
    ON payment_proofs(payment_id, created_at DESC);

-- Bandeja de notificaciones: filtro por rol y lectura pendiente (HU-02, CRITERIO-1.2)
CREATE INDEX IF NOT EXISTS idx_notifications_role_read
    ON notifications(target_role, read_at);

-- Lookup de notificaciones por recurso referenciado
CREATE INDEX IF NOT EXISTS idx_notifications_reference_id
    ON notifications(reference_id);

-- ─── 5. VALIDACIÓN DE INTEGRIDAD ────────────────────────────
-- Confirmar que las columnas nuevas existen en payments
DO $$
BEGIN
    ASSERT (
        SELECT COUNT(*) = 5
        FROM information_schema.columns
        WHERE table_name = 'payments'
          AND column_name IN (
              'approved_by', 'approved_at',
              'rejected_by', 'rejected_at',
              'rejection_reason'
          )
    ), 'ERROR: columnas de auditoría no encontradas en payments';

    ASSERT (
        SELECT COUNT(*) = 1
        FROM information_schema.tables
        WHERE table_name = 'payment_proofs'
    ), 'ERROR: tabla payment_proofs no creada';

    ASSERT (
        SELECT COUNT(*) = 1
        FROM information_schema.tables
        WHERE table_name = 'notifications'
    ), 'ERROR: tabla notifications no creada';
END;
$$;

-- ============================================================
-- DOWN (reversión manual — NO ejecutar en producción sin backup)
-- ============================================================
--
-- DROP TABLE IF EXISTS notifications;
-- DROP TABLE IF EXISTS payment_proofs;
-- ALTER TABLE payments
--     DROP COLUMN IF EXISTS approved_by,
--     DROP COLUMN IF EXISTS approved_at,
--     DROP COLUMN IF EXISTS rejected_by,
--     DROP COLUMN IF EXISTS rejected_at,
--     DROP COLUMN IF EXISTS rejection_reason;
--
-- ============================================================
