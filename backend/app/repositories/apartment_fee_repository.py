from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import ApartmentFeeCreate


class ApartmentFeeRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            "SELECT * FROM apartment_fees ORDER BY period, apartment_id"
        )
        return [dict(r) for r in rows]

    async def get_by_period(self, period: str) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT
                f.*,
                COALESCE(p.paid_amount, 0) AS paid_amount,
                f.amount - COALESCE(p.paid_amount, 0) AS pending_amount,
                CASE
                    WHEN COALESCE(p.paid_amount, 0) > f.amount THEN COALESCE(p.paid_amount, 0) - f.amount
                    ELSE 0
                END AS credit_amount,
                COALESCE(p.paid_amount, 0) >= f.amount AS is_paid
            FROM apartment_fees f
            LEFT JOIN (
                SELECT apartment_id, period, SUM(amount) AS paid_amount
                FROM payments
                WHERE status = 'REGISTRADO' AND fine_id IS NULL
                GROUP BY apartment_id, period
            ) p ON p.apartment_id = f.apartment_id AND p.period = f.period
            WHERE f.period = $1
            ORDER BY f.apartment_id
            """,
            period,
        )
        return [dict(r) for r in rows]

    async def get_by_id(self, fee_id: UUID) -> Optional[dict]:
        row = await self._conn.fetchrow(
            "SELECT * FROM apartment_fees WHERE id = $1",
            fee_id,
        )
        return dict(row) if row else None

    async def fee_exists(self, apartment_id: UUID, period: str) -> bool:
        row = await self._conn.fetchrow(
            "SELECT 1 FROM apartment_fees WHERE apartment_id = $1 AND period = $2",
            apartment_id,
            period,
        )
        return row is not None

    async def create(self, data: ApartmentFeeCreate) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO apartment_fees (apartment_id, period, amount)
            VALUES ($1, $2, $3)
            RETURNING *
            """,
            data.apartment_id,
            data.period,
            data.amount,
        )
        return dict(row)

    async def upsert(
        self, apartment_id: UUID, period: str, amount: Decimal
    ) -> tuple[dict, bool]:
        existing = await self._conn.fetchrow(
            "SELECT id FROM apartment_fees WHERE apartment_id = $1 AND period = $2",
            apartment_id,
            period,
        )
        if existing:
            row = await self._conn.fetchrow(
                """
                UPDATE apartment_fees SET amount = $3
                WHERE apartment_id = $1 AND period = $2
                RETURNING *
                """,
                apartment_id,
                period,
                amount,
            )
            return dict(row), False
        else:
            row = await self._conn.fetchrow(
                """
                INSERT INTO apartment_fees (apartment_id, period, amount)
                VALUES ($1, $2, $3)
                RETURNING *
                """,
                apartment_id,
                period,
                amount,
            )
            return dict(row), True

    async def update_amount(self, fee_id: UUID, amount: Decimal) -> Optional[dict]:
        row = await self._conn.fetchrow(
            """
            UPDATE apartment_fees
            SET amount = $2
            WHERE id = $1
            RETURNING *
            """,
            fee_id,
            amount,
        )
        return dict(row) if row else None

    async def get_stats(self, period: str) -> dict:
        row = await self._conn.fetchrow(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM apartment_fees WHERE period = $1",
            period,
        )
        total_emitido = Decimal(str(row["total"]))

        row = await self._conn.fetchrow(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE period = $1 AND status = 'REGISTRADO' AND fine_id IS NULL",
            period,
        )
        total_recaudado = Decimal(str(row["total"]))

        pendiente_cobro = total_emitido - total_recaudado

        if total_emitido > 0:
            porcentaje_recaudado = float(total_recaudado / total_emitido * 100)
        else:
            porcentaje_recaudado = 0.0

        current_period = datetime.now().strftime("%Y-%m")
        row = await self._conn.fetchrow(
            """
            SELECT COUNT(DISTINCT af.apartment_id) AS cnt
            FROM apartment_fees af
            LEFT JOIN (
                SELECT apartment_id, period, COALESCE(SUM(amount), 0) AS pagado
                FROM payments
                WHERE status = 'REGISTRADO' AND fine_id IS NULL
                GROUP BY apartment_id, period
            ) p ON p.apartment_id = af.apartment_id AND p.period = af.period
            WHERE af.period < $1
              AND COALESCE(p.pagado, 0) < af.amount
            """,
            current_period,
        )
        unidades_deuda_vencida = int(row["cnt"])

        year_val, month_val = map(int, period.split("-"))
        if month_val == 1:
            prev_year, prev_month = year_val - 1, 12
        else:
            prev_year, prev_month = year_val, month_val - 1
        prev_period = f"{prev_year:04d}-{prev_month:02d}"

        row = await self._conn.fetchrow(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM apartment_fees WHERE period = $1",
            prev_period,
        )
        prev_emitido = Decimal(str(row["total"]))

        if prev_emitido > 0:
            tendencia_emitido: Optional[float] = float(
                (total_emitido - prev_emitido) / prev_emitido * 100
            )
        else:
            tendencia_emitido = None

        return {
            "period": period,
            "total_emitido": total_emitido,
            "total_recaudado": total_recaudado,
            "pendiente_cobro": pendiente_cobro,
            "porcentaje_recaudado": porcentaje_recaudado,
            "unidades_deuda_vencida": unidades_deuda_vencida,
            "tendencia_emitido": tendencia_emitido,
        }

    async def get_periods_summary(
        self, page: int, page_size: int, year: Optional[int]
    ) -> dict:
        current_period = datetime.now().strftime("%Y-%m")
        offset = (page - 1) * page_size

        count_row = await self._conn.fetchrow(
            """
            SELECT COUNT(DISTINCT period) AS cnt
            FROM apartment_fees
            WHERE ($1::int IS NULL OR SUBSTRING(period, 1, 4)::int = $1)
            """,
            year,
        )
        total = int(count_row["cnt"])

        rows = await self._conn.fetch(
            """
            SELECT
                af.period,
                COALESCE(SUM(af.amount), 0) AS total_emitido,
                COALESCE(SUM(p.amount), 0) AS total_recaudado
            FROM apartment_fees af
            LEFT JOIN payments p
                ON p.apartment_id = af.apartment_id
                AND p.period = af.period
                AND p.status = 'REGISTRADO'
                AND p.fine_id IS NULL
            WHERE ($1::int IS NULL OR SUBSTRING(af.period, 1, 4)::int = $1)
            GROUP BY af.period
            ORDER BY af.period DESC
            OFFSET $2 LIMIT $3
            """,
            year,
            offset,
            page_size,
        )

        _MONTHS = {
            "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
            "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
            "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
        }

        data = []
        for r in rows:
            p = r["period"]
            year_p, month_p = p.split("-")
            label = f"{_MONTHS[month_p]} {year_p}"

            month_int = int(month_p)
            year_int = int(year_p)
            if month_int == 12:
                venc_year, venc_month = year_int + 1, 1
            else:
                venc_year, venc_month = year_int, month_int + 1
            vencimiento = f"{venc_year:04d}-{venc_month:02d}-10"

            total_emitido = Decimal(str(r["total_emitido"]))
            total_recaudado = Decimal(str(r["total_recaudado"]))

            if total_emitido > 0:
                morosidad_pct = float(
                    (total_emitido - total_recaudado) / total_emitido * 100
                )
            else:
                morosidad_pct = 0.0

            if p >= current_period:
                estado = "ABIERTO"
            elif morosidad_pct == 0:
                estado = "CERRADO"
            else:
                estado = "VENCIDO"

            data.append({
                "period": p,
                "label": label,
                "vencimiento": vencimiento,
                "estado": estado,
                "total_emitido": total_emitido,
                "total_recaudado": total_recaudado,
                "morosidad_pct": morosidad_pct,
            })

        return {
            "data": data,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
