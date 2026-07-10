-- ============================================================
-- Migración 014: Crear tablas para Avisos (Announcements) y Eventos (Events)
-- ============================================================

-- 1. TABLA DE AVISOS (ANNOUNCEMENTS)
CREATE TABLE IF NOT EXISTS announcements (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255)  NOT NULL,
    description TEXT          NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. TABLA DE EVENTOS (EVENTS)
CREATE TABLE IF NOT EXISTS events (
    id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255)  NOT NULL,
    description TEXT          NOT NULL,
    event_date  DATE          NOT NULL,
    start_time  TIME          NOT NULL,
    end_time    TIME          NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 3. TABLA RELACIONAL DE EVENTOS Y PROPIETARIOS (EVENT_OWNERS)
CREATE TABLE IF NOT EXISTS event_owners (
    event_id    UUID          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    owner_id    UUID          NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, owner_id)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_owners_owner ON event_owners(owner_id);
