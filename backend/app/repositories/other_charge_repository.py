from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

import asyncpg

from app.models.schemas import OtherChargeCreate


class OtherChargeRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    async def get_all(self) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT oc.*, a.code AS apartment_code, o.full_name AS owner_name
            FROM other_charges oc
            JOIN apartments a ON oc.apartment_id = a.id
            LEFT JOIN owner_apartments oa ON oa.apartment_id = a.id AND oa.is_primary = TRUE
            LEFT JOIN owners o ON oa.owner_id = o.id
            ORDER BY oc.period DESC, oc.concept, a.code
            """
        )
        return [dict(r) for r in rows]

    async def get_by_period(
        self,
        period: str,
        periodicity: Optional[str] = None,
    ) -> list[dict]:
        rows = await self._conn.fetch(
            """
            SELECT
                oc.*,
                COALESCE(p.paid_amount, 0) AS paid_amount,
                a.code AS apartment_code,
                a.floor,
                a.tower,
                o.full_name AS owner_name
            FROM other_charges oc
            JOIN apartments a ON oc.apartment_id = a.id
            LEFT JOIN owner_apartments oa ON oa.apartment_id = a.id AND oa.is_primary = TRUE
            LEFT JOIN owners o ON oa.owner_id = o.id
            LEFT JOIN (
                SELECT other_charge_id, SUM(amount) AS paid_amount
                FROM payments
                WHERE status IN ('REGISTRADO', 'PENDIENTE_APROBACION')
                  AND other_charge_id IS NOT NULL
                GROUP BY other_charge_id
            ) p ON p.other_charge_id = oc.id
            WHERE oc.period = $1
              AND ($2::text IS NULL OR oc.periodicity = $2)
            ORDER BY oc.concept, a.tower DESC NULLS LAST, a.floor DESC NULLS LAST, a.code DESC
            """,
            period,
            periodicity,
        )
        result = []
        for raw in rows:
            row = dict(raw)
            amount = Decimal(str(row["amount"] or 0))
            paid = Decimal(str(row["paid_amount"] or 0))
            pending = max(amount - paid, Decimal("0"))
            row["pending_amount"] = pending
            row["is_paid"] = pending <= 0
            result.append(row)
        return result

    async def get_by_id(self, charge_id: UUID) -> Optional[dict]:
        row = await self._conn.fetchrow(
            "SELECT * FROM other_charges WHERE id = $1",
            charge_id,
        )
        return dict(row) if row else None

    async def charge_exists(self, apartment_id: UUID, period: str, concept: str) -> bool:
        row = await self._conn.fetchrow(
            """
            SELECT 1
            FROM other_charges
            WHERE apartment_id = $1 AND period = $2 AND LOWER(concept) = LOWER($3)
            """,
            apartment_id,
            period,
            concept.strip(),
        )
        return row is not None

    async def create(self, data: OtherChargeCreate, created_by: str) -> dict:
        row = await self._conn.fetchrow(
            """
            INSERT INTO other_charges (apartment_id, period, concept, amount, periodicity, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            """,
            data.apartment_id,
            data.period,
            data.concept.strip(),
            data.amount,
            data.periodicity,
            str(created_by),
        )
        return dict(row)

    async def upsert(
        self,
        apartment_id: UUID,
        period: str,
        concept: str,
        amount: Decimal,
        periodicity: str,
        created_by: str,
    ) -> tuple[dict, bool]:
        row = await self._conn.fetchrow(
            """
            INSERT INTO other_charges (apartment_id, period, concept, amount, periodicity, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (apartment_id, period, concept)
            DO UPDATE SET
                amount = EXCLUDED.amount,
                periodicity = EXCLUDED.periodicity,
                updated_at = NOW()
            RETURNING *, (xmax = 0) AS inserted
            """,
            apartment_id,
            period,
            concept.strip(),
            amount,
            periodicity,
            str(created_by),
        )
        data = dict(row)
        was_created = bool(data.pop("inserted", False))
        return data, was_created

    async def update(
        self,
        charge_id: UUID,
        concept: Optional[str],
        amount: Optional[Decimal],
        periodicity: Optional[str],
    ) -> Optional[dict]:
        row = await self._conn.fetchrow(
            """
            UPDATE other_charges
            SET
                concept = COALESCE($2, concept),
                amount = COALESCE($3, amount),
                periodicity = COALESCE($4, periodicity),
                updated_at = NOW()
            WHERE id = $1
            RETURNING *
            """,
            charge_id,
            concept.strip() if concept is not None else None,
            amount,
            periodicity,
        )
        return dict(row) if row else None

    async def get_stats(self, period: str) -> dict:
        total_emitido = Decimal(str(await self._conn.fetchval(
            "SELECT COALESCE(SUM(amount), 0) FROM other_charges WHERE period = $1",
            period,
        ) or 0))
        total_recaudado = Decimal(str(await self._conn.fetchval(
            """
            SELECT COALESCE(SUM(p.amount), 0)
            FROM payments p
            JOIN other_charges oc ON oc.id = p.other_charge_id
            WHERE oc.period = $1 AND p.status = 'REGISTRADO'
            """,
            period,
        ) or 0))
        pendiente_cobro = total_emitido - total_recaudado
        porcentaje_recaudado = float(total_recaudado / total_emitido * 100) if total_emitido > 0 else 0.0
        current_period = datetime.now().strftime("%Y-%m")
        unidades_deuda_vencida = int(await self._conn.fetchval(
            """
            SELECT COUNT(DISTINCT oc.apartment_id)
            FROM other_charges oc
            LEFT JOIN (
                SELECT other_charge_id, SUM(amount) AS pagado
                FROM payments
                WHERE status = 'REGISTRADO' AND other_charge_id IS NOT NULL
                GROUP BY other_charge_id
            ) p ON p.other_charge_id = oc.id
            WHERE oc.period <= $1 AND COALESCE(p.pagado, 0) < oc.amount
            """,
            current_period,
        ) or 0)
        return {
            "period": period,
            "total_emitido": total_emitido,
            "total_recaudado": total_recaudado,
            "pendiente_cobro": pendiente_cobro,
            "porcentaje_recaudado": porcentaje_recaudado,
            "unidades_deuda_vencida": unidades_deuda_vencida,
            "tendencia_emitido": None,
        }

    async def get_periods_summary(self, page: int, page_size: int, year: Optional[int]) -> dict:
        current_period = datetime.now().strftime("%Y-%m")
        offset = (page - 1) * page_size
        total = int(await self._conn.fetchval(
            """
            SELECT COUNT(DISTINCT period)
            FROM other_charges
            WHERE ($1::int IS NULL OR SUBSTRING(period, 1, 4)::int = $1)
            """,
            year,
        ) or 0)
        rows = await self._conn.fetch(
            """
            SELECT
                oc.period,
                COALESCE(SUM(oc.amount), 0) AS total_emitido,
                COALESCE(SUM(p.amount), 0) AS total_recaudado
            FROM other_charges oc
            LEFT JOIN payments p ON p.other_charge_id = oc.id AND p.status = 'REGISTRADO'
            WHERE ($1::int IS NULL OR SUBSTRING(oc.period, 1, 4)::int = $1)
            GROUP BY oc.period
            ORDER BY oc.period DESC
            OFFSET $2 LIMIT $3
            """,
            year,
            offset,
            page_size,
        )
        months = {
            "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
            "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
            "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre",
        }
        data = []
        for row in rows:
            period = row["period"]
            year_p, month_p = period.split("-")
            total_emitido = Decimal(str(row["total_emitido"] or 0))
            total_recaudado = Decimal(str(row["total_recaudado"] or 0))
            morosidad_pct = float((total_emitido - total_recaudado) / total_emitido * 100) if total_emitido > 0 else 0.0
            data.append({
                "period": period,
                "label": f"{months[month_p]} {year_p}",
                "vencimiento": f"{period}-01",
                "estado": "ABIERTO" if period >= current_period else ("CERRADO" if morosidad_pct == 0 else "VENCIDO"),
                "total_emitido": total_emitido,
                "total_recaudado": total_recaudado,
                "morosidad_pct": morosidad_pct,
            })
        return {"data": data, "total": total, "page": page, "page_size": page_size}

    async def bulk_delete(self, charge_ids: list[UUID]) -> dict:
        if not charge_ids:
            return {"deleted_charges": 0, "deleted_payments": 0}
        async with self._conn.transaction():
            payment_result = await self._conn.execute(
                "DELETE FROM payments WHERE other_charge_id = ANY($1)",
                charge_ids,
            )
            charge_result = await self._conn.execute(
                "DELETE FROM other_charges WHERE id = ANY($1)",
                charge_ids,
            )
        deleted_payments = int(payment_result.split()[1]) if payment_result.startswith("DELETE") else 0
        deleted_charges = int(charge_result.split()[1]) if charge_result.startswith("DELETE") else 0
        return {"deleted_charges": deleted_charges, "deleted_payments": deleted_payments}

    async def delete(self, charge_id: UUID) -> dict:
        return await self.bulk_delete([charge_id])
