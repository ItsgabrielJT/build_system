-- ============================================================
-- Migración inicial: MVP Gestión de Edificios
-- Ejecutar una sola vez sobre la base de datos "edificios"
-- ============================================================

-- Extensión para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. OWNERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owners (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name    VARCHAR(255) NOT NULL,
    document_id  VARCHAR(50)  UNIQUE NOT NULL,
    phone        VARCHAR(20),
    email        VARCHAR(255),
    allocated_quota_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    firebase_uid VARCHAR(128),          -- UID de Firebase Auth del propietario
    status       VARCHAR(50)  NOT NULL DEFAULT 'ACTIVO',  -- ACTIVO | INACTIVO
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. APARTMENTS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apartments (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code       VARCHAR(50)  UNIQUE NOT NULL,
    floor      INT,
    tower      VARCHAR(10),
    status     VARCHAR(50)  NOT NULL DEFAULT 'ACTIVO',  -- ACTIVO | INACTIVO
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 3. OWNER_APARTMENTS (muchos a muchos) ────────────────────
CREATE TABLE IF NOT EXISTS owner_apartments (
    owner_id     UUID REFERENCES owners(id)     ON DELETE CASCADE,
    apartment_id UUID REFERENCES apartments(id) ON DELETE CASCADE,
    is_primary   BOOLEAN     NOT NULL DEFAULT TRUE,
    assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (owner_id, apartment_id)
);

-- ── 4. APARTMENT_FEES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apartment_fees (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID         NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    period       CHAR(7)      NOT NULL,   -- formato 'YYYY-MM'
    amount       DECIMAL(12,2) NOT NULL,
    created_by   VARCHAR(128),            -- Firebase UID de quien registró
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (apartment_id, period)
);

-- ── 5. PAYMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID          NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    owner_id     UUID          NOT NULL REFERENCES owners(id)     ON DELETE CASCADE,
    period       CHAR(7)       NOT NULL,
    paid_at      DATE          NOT NULL,
    amount       DECIMAL(12,2) NOT NULL,
    method       VARCHAR(50),             -- 'transferencia', 'efectivo', 'cheque'
    reference    VARCHAR(255),
    status       VARCHAR(50)   NOT NULL DEFAULT 'REGISTRADO',  -- REGISTRADO | ANULADO
    created_by   VARCHAR(128),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 6. FINES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fines (
    id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    apartment_id UUID          NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
    owner_id     UUID          NOT NULL REFERENCES owners(id)     ON DELETE CASCADE,
    period       CHAR(7)       NOT NULL,
    issued_at    DATE          NOT NULL,
    reason       VARCHAR(255),
    amount       DECIMAL(12,2) NOT NULL,
    status       VARCHAR(50)   NOT NULL DEFAULT 'ACTIVA',  -- ACTIVA | ANULADA
    created_by   VARCHAR(128),
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 7. EXPENSES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    date       DATE          NOT NULL,
    provider   VARCHAR(255),
    category   VARCHAR(100),
    concept    VARCHAR(255)  NOT NULL,
    amount     DECIMAL(12,2) NOT NULL,
    status     VARCHAR(50)   NOT NULL DEFAULT 'REGISTRADO',
    created_by VARCHAR(128),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── 8. INCOMES ───────────────────────────────────────────────
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

-- ── 9. SETTINGS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    building_name    VARCHAR(255),
    building_address VARCHAR(255),
    due_day          INT         NOT NULL DEFAULT 5,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ÍNDICES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_owner_apartments_owner_id     ON owner_apartments(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_apartments_apartment_id ON owner_apartments(apartment_id);
CREATE INDEX IF NOT EXISTS idx_apartment_fees_apt_period     ON apartment_fees(apartment_id, period);
CREATE INDEX IF NOT EXISTS idx_payments_apt_period           ON payments(apartment_id, period);
CREATE INDEX IF NOT EXISTS idx_payments_owner_id             ON payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_fines_apt_period              ON fines(apartment_id, period);
CREATE INDEX IF NOT EXISTS idx_fines_owner_id                ON fines(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date                 ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_incomes_date                  ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_incomes_period_status         ON incomes(period, status);
CREATE INDEX IF NOT EXISTS idx_incomes_apartment_period      ON incomes(apartment_id, period);
CREATE INDEX IF NOT EXISTS idx_incomes_owner_id              ON incomes(owner_id);
CREATE INDEX IF NOT EXISTS idx_owners_document               ON owners(document_id);
CREATE INDEX IF NOT EXISTS idx_owners_firebase_uid           ON owners(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_apartments_code               ON apartments(code);
