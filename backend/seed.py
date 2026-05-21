"""
Seed de datos de prueba — MVP Gestión de Edificios
Idempotente: borra y recrea los registros en cada ejecución.
Uso: python seed.py  (desde la carpeta backend/, con .venv activo)
"""
from __future__ import annotations

import asyncio
import os
from datetime import date
from pathlib import Path

import asyncpg
from dotenv import load_dotenv


def d(s: str) -> date:
    """Convierte 'YYYY-MM-DD' a datetime.date (requerido por asyncpg)."""
    return date.fromisoformat(s)

load_dotenv(Path(__file__).parent / ".env")
DATABASE_URL: str = os.environ["DATABASE_URL"]


# ─── Datos de prueba ──────────────────────────────────────────────────────────

OWNERS = [
    {
        "full_name": "Carlos Andrade",
        "document_id": "1001001001",
        "phone": "3101234567",
        "email": "carlos.andrade@mail.com",
    },
    {
        "full_name": "María Torres",
        "document_id": "1002002002",
        "phone": "3152345678",
        "email": "maria.torres@mail.com",
    },
    {
        "full_name": "Luis Herrera",
        "document_id": "1003003003",
        "phone": "3003456789",
        "email": "luis.herrera@mail.com",
    },
]

APARTMENTS = [
    {"code": "101", "floor": 1, "tower": "A"},
    {"code": "102", "floor": 1, "tower": "A"},
    {"code": "201", "floor": 2, "tower": "A"},
    {"code": "202", "floor": 2, "tower": "A"},
    {"code": "301", "floor": 3, "tower": "B"},
    {"code": "302", "floor": 3, "tower": "B"},
]

# owner_index → list of apartment_codes
OWNER_APARTMENTS = {
    0: ["101", "102"],      # Carlos posee 2 deptos (morosidad en uno)
    1: ["201", "202", "301"],  # María posee 3 deptos
    2: ["302"],             # Luis posee 1 depto
}

# (apt_code, period, amount)
FEES = [
    ("101", "2026-03", 5000),
    ("101", "2026-04", 5000),
    ("101", "2026-05", 5000),
    ("102", "2026-03", 4500),
    ("102", "2026-04", 4500),
    ("102", "2026-05", 4500),
    ("201", "2026-04", 6000),
    ("201", "2026-05", 6000),
    ("202", "2026-05", 5500),
    ("301", "2026-05", 5200),
    ("302", "2026-05", 4800),
]

# (apt_code, owner_index, period, amount, method, paid_at)
PAYMENTS = [
    # Carlos — 101: pago parcial en 2026-04 → queda en mora
    ("101", 0, "2026-04", 3000.00, "transferencia", d("2026-04-03")),
    # Carlos — 101: 2026-03 pagado completo
    ("101", 0, "2026-03", 5000.00, "efectivo", d("2026-03-02")),
    # Carlos — 102: 2026-05 sin pago (mora)
    # María — 201: pago completo
    ("201", 1, "2026-04", 6000.00, "transferencia", d("2026-04-04")),
    ("201", 1, "2026-05", 6000.00, "transferencia", d("2026-05-03")),
    # María — 202: pago parcial
    ("202", 1, "2026-05", 2000.00, "cheque", d("2026-05-04")),
    # Luis — 302: pagado completo
    ("302", 2, "2026-05", 4800.00, "transferencia", d("2026-05-02")),
]

# (apt_code, owner_index, period, amount, reason, issued_at)
FINES = [
    ("101", 0, "2026-04", 500.00, "Incumplimiento pago anterior", d("2026-05-01")),
    ("102", 0, "2026-05", 300.00, "Daños en área común", d("2026-05-10")),
]

# (date, provider, category, concept, amount)
EXPENSES = [
    (d("2026-03-15"), "Empresa de Aseo SAS", "Servicios", "Servicio de aseo mensual", 800000),
    (d("2026-03-20"), "EPM", "Servicios", "Factura de agua y alcantarillado", 450000),
    (d("2026-04-15"), "Empresa de Aseo SAS", "Servicios", "Servicio de aseo mensual", 800000),
    (d("2026-04-28"), "TechElevadores", "Mantenimiento", "Mantenimiento preventivo ascensor", 1200000),
    (d("2026-05-15"), "Empresa de Aseo SAS", "Servicios", "Servicio de aseo mensual", 800000),
    (d("2026-05-18"), "EPM", "Servicios", "Factura de agua y alcantarillado", 470000),
    (d("2026-05-20"), "Ferretería Central", "Mantenimiento", "Materiales pintura paredes", 250000),
]


# ─── Lógica de seeding ────────────────────────────────────────────────────────

async def run() -> None:
    conn: asyncpg.Connection = await asyncpg.connect(DATABASE_URL)
    print("🔗  Conectado a la base de datos")

    async with conn.transaction():
        # Borra en orden inverso de FK
        for table in ("fines", "payments", "apartment_fees",
                      "owner_apartments", "expenses",
                      "apartments", "owners", "settings"):
            await conn.execute(f"DELETE FROM {table} WHERE TRUE")
        print("🗑   Datos anteriores eliminados")

        # ── Owners ───────────────────────────────────────────────
        owner_ids: dict[int, str] = {}
        for i, o in enumerate(OWNERS):
            row = await conn.fetchrow(
                """
                INSERT INTO owners (full_name, document_id, phone, email)
                VALUES ($1, $2, $3, $4)
                RETURNING id
                """,
                o["full_name"], o["document_id"], o["phone"], o["email"],
            )
            owner_ids[i] = str(row["id"])
        print(f"✅  {len(OWNERS)} propietarios creados")

        # ── Apartments ───────────────────────────────────────────
        apt_ids: dict[str, str] = {}
        for a in APARTMENTS:
            row = await conn.fetchrow(
                """
                INSERT INTO apartments (code, floor, tower)
                VALUES ($1, $2, $3)
                RETURNING id
                """,
                a["code"], a["floor"], a["tower"],
            )
            apt_ids[a["code"]] = str(row["id"])
        print(f"✅  {len(APARTMENTS)} departamentos creados")

        # ── Owner ↔ Apartment assignments ────────────────────────
        count_assignments = 0
        for owner_idx, codes in OWNER_APARTMENTS.items():
            for code in codes:
                await conn.execute(
                    """
                    INSERT INTO owner_apartments (owner_id, apartment_id)
                    VALUES ($1::uuid, $2::uuid)
                    """,
                    owner_ids[owner_idx], apt_ids[code],
                )
                count_assignments += 1
        print(f"✅  {count_assignments} asignaciones propietario↔departamento")

        # ── Apartment fees ────────────────────────────────────────
        for code, period, amount in FEES:
            await conn.execute(
                """
                INSERT INTO apartment_fees (apartment_id, period, amount)
                VALUES ($1::uuid, $2, $3)
                """,
                apt_ids[code], period, amount,
            )
        print(f"✅  {len(FEES)} cuotas por período creadas")

        # ── Payments ─────────────────────────────────────────────
        for code, owner_idx, period, amount, method, paid_at in PAYMENTS:
            await conn.execute(
                """
                INSERT INTO payments (apartment_id, owner_id, period, amount, method, paid_at)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
                """,
                apt_ids[code], owner_ids[owner_idx],
                period, amount, method, paid_at,
            )
        print(f"✅  {len(PAYMENTS)} pagos registrados")

        # ── Fines ─────────────────────────────────────────────────
        for code, owner_idx, period, amount, reason, issued_at in FINES:
            await conn.execute(
                """
                INSERT INTO fines (apartment_id, owner_id, period, amount, reason, issued_at)
                VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6)
                """,
                apt_ids[code], owner_ids[owner_idx],
                period, amount, reason, issued_at,
            )
        print(f"✅  {len(FINES)} multas registradas")

        # ── Expenses ─────────────────────────────────────────────
        for date, provider, category, concept, amount in EXPENSES:
            await conn.execute(
                """
                INSERT INTO expenses (date, provider, category, concept, amount)
                VALUES ($1, $2, $3, $4, $5)
                """,
                date, provider, category, concept, amount,
            )
        print(f"✅  {len(EXPENSES)} gastos registrados")

        # ── Settings ─────────────────────────────────────────────
        await conn.execute(
            """
            INSERT INTO settings (building_name, building_address, due_day)
            VALUES ($1, $2, $3)
            """,
            "Edificio Laureles 101", "Cra. 76B #39A-50, Medellín", 5,
        )
        print("✅  Configuración de edificio creada")

    await conn.close()
    print("\n🎉  Seed completado. Datos disponibles para desarrollo y pruebas.")
    print("\nResumen de escenarios cargados:")
    print("  • Carlos Andrade  → depto 101 en mora (2026-04 parcial + multa), depto 102 sin pago 2026-05")
    print("  • María Torres    → deptos 201 (al día), 202 (pago parcial 2026-05), 301 (sin pago)")
    print("  • Luis Herrera    → depto 302 pagado completo")


if __name__ == "__main__":
    asyncio.run(run())
