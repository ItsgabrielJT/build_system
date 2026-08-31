from __future__ import annotations

from typing import Optional
from uuid import UUID

import asyncpg

_PERIOD_DATA_QUERY = """
    WITH all_periods AS (
        SELECT apartment_id, period FROM apartment_fees
        UNION
        SELECT apartment_id, period FROM payments WHERE fine_id IS NULL AND other_charge_id IS NULL
        UNION
        SELECT apartment_id, period FROM other_charges
        UNION
        SELECT apartment_id, period FROM fines
    ),
    agg_fines AS (
        SELECT 
            apartment_id, 
            period, 
            COALESCE(SUM(amount), 0) AS total_fines
        FROM fines
        WHERE status != 'ANULADA' AND status != 'ANULADO'
        GROUP BY apartment_id, period
    ),
    agg_payments AS (
        SELECT 
            apartment_id, 
            period, 
            COALESCE(SUM(amount), 0) AS total_payments
        FROM payments
        WHERE status = 'REGISTRADO' AND fine_id IS NULL AND other_charge_id IS NULL
        GROUP BY apartment_id, period
    ),
    agg_other_charges AS (
        SELECT
            apartment_id,
            period,
            COALESCE(SUM(amount), 0) AS total_other_charges
        FROM other_charges
        GROUP BY apartment_id, period
    ),
    agg_other_payments AS (
        SELECT
            oc.apartment_id,
            oc.period,
            COALESCE(SUM(p.amount), 0) AS total_other_payments
        FROM payments p
        JOIN other_charges oc ON oc.id = p.other_charge_id
        WHERE p.status = 'REGISTRADO'
        GROUP BY oc.apartment_id, oc.period
    ),
    fee_payments AS (
        SELECT
            apartment_id,
            period,
            jsonb_agg(
                jsonb_build_object('paid_at', paid_at, 'amount', amount)
                ORDER BY paid_at ASC
            ) AS payments
        FROM payments
        WHERE status = 'REGISTRADO' AND fine_id IS NULL AND other_charge_id IS NULL
        GROUP BY apartment_id, period
    )
    SELECT
        o.id           AS owner_id,
        o.full_name,
        o.email,
        o.document_id,
        a.id           AS apartment_id,
        a.code         AS apartment_code,
        a.floor,
        ap.period,
        COALESCE(af.amount, 0) AS esperado,
        COALESCE(f.total_fines, 0) AS multas,
        COALESCE(oc.total_other_charges, 0) AS otros_cobros,
        COALESCE(p.total_payments, 0) AS pagado_cuota,
        COALESCE(op.total_other_payments, 0) AS pagado_otros_cobros,
        COALESCE(p.total_payments, 0) + COALESCE(op.total_other_payments, 0) AS pagado,
        COALESCE(fp.payments, '[]'::jsonb) AS pagos_capital
    FROM owners o
    JOIN owner_apartments oa ON o.id = oa.owner_id
    JOIN apartments        a  ON oa.apartment_id = a.id
    JOIN all_periods       ap ON ap.apartment_id = a.id
    LEFT JOIN apartment_fees af ON af.apartment_id = a.id AND af.period = ap.period
    LEFT JOIN agg_fines      f  ON  f.apartment_id = a.id AND  f.period = ap.period
    LEFT JOIN agg_other_charges oc ON oc.apartment_id = a.id AND oc.period = ap.period
    LEFT JOIN agg_other_payments op ON op.apartment_id = a.id AND op.period = ap.period
    LEFT JOIN agg_payments   p  ON  p.apartment_id = a.id AND  p.period = ap.period
    LEFT JOIN fee_payments   fp ON fp.apartment_id = a.id AND fp.period = ap.period
    WHERE o.status = 'ACTIVO'
"""


class DelinquencyRepository:
    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn

    _GROUP_ALL = ""


    async def get_all_period_data(self) -> list[dict]:
        query = _PERIOD_DATA_QUERY + self._GROUP_ALL + " ORDER BY o.id, a.id, ap.period"
        rows = await self._conn.fetch(query)
        return [dict(r) for r in rows]

    async def get_active_apartment_count(self) -> int:
        row = await self._conn.fetchrow(
            """
            SELECT COUNT(*) AS total
            FROM apartments
            WHERE status IN ('ACTIVA', 'ACTIVO')
            """
        )
        return int(row["total"] or 0) if row else 0

    async def get_period_data_for_owner(self, owner_id: UUID) -> list[dict]:
        query = (
            _PERIOD_DATA_QUERY
            + " AND o.id = $1"
            + self._GROUP_ALL
            + " ORDER BY a.code, ap.period"
        )
        rows = await self._conn.fetch(query, owner_id)
        return [dict(r) for r in rows]

    async def get_statement_data(
        self,
        owner_id: UUID,
        start_period: Optional[str],
        end_period: Optional[str],
    ) -> list[dict]:
        params: list = [owner_id]
        
        if end_period:
            query = """
                WITH all_periods AS (
                    SELECT apartment_id, period FROM apartment_fees WHERE period <= $2
                    UNION
                    SELECT apartment_id, period FROM payments WHERE status = 'REGISTRADO' AND fine_id IS NULL AND other_charge_id IS NULL AND TO_CHAR(paid_at, 'YYYY-MM') <= $2
                    UNION
                    SELECT apartment_id, period FROM other_charges WHERE period <= $2
                    UNION
                    SELECT apartment_id, period FROM fines WHERE status != 'ANULADA' AND status != 'ANULADO' AND period <= $2
                ),
                agg_fines AS (
                    SELECT 
                        apartment_id, 
                        period, 
                        COALESCE(SUM(amount), 0) AS total_fines
                    FROM fines
                    WHERE status != 'ANULADA' AND status != 'ANULADO' AND period <= $2
                    GROUP BY apartment_id, period
                ),
                agg_payments AS (
                    SELECT 
                        apartment_id, 
                        period, 
                        COALESCE(SUM(amount), 0) AS total_payments
                    FROM payments
                    WHERE status = 'REGISTRADO' AND fine_id IS NULL AND other_charge_id IS NULL AND TO_CHAR(paid_at, 'YYYY-MM') <= $2
                    GROUP BY apartment_id, period
                ),
                agg_other_charges AS (
                    SELECT
                        apartment_id,
                        period,
                        COALESCE(SUM(amount), 0) AS total_other_charges
                    FROM other_charges
                    WHERE period <= $2
                    GROUP BY apartment_id, period
                ),
                agg_other_payments AS (
                    SELECT
                        oc.apartment_id,
                        oc.period,
                        COALESCE(SUM(p.amount), 0) AS total_other_payments
                    FROM payments p
                    JOIN other_charges oc ON oc.id = p.other_charge_id
                    WHERE p.status = 'REGISTRADO' AND TO_CHAR(p.paid_at, 'YYYY-MM') <= $2
                    GROUP BY oc.apartment_id, oc.period
                ),
                fee_payments AS (
                    SELECT
                        apartment_id,
                        period,
                        jsonb_agg(
                            jsonb_build_object('paid_at', paid_at, 'amount', amount)
                            ORDER BY paid_at ASC
                        ) AS payments
                    FROM payments
                    WHERE status = 'REGISTRADO' AND fine_id IS NULL AND other_charge_id IS NULL AND TO_CHAR(paid_at, 'YYYY-MM') <= $2
                    GROUP BY apartment_id, period
                )
                SELECT
                    o.id           AS owner_id,
                    o.full_name,
                    o.email,
                    o.document_id,
                    a.id           AS apartment_id,
                    a.code         AS apartment_code,
                    a.floor,
                    ap.period,
                    COALESCE(af.amount, 0) AS esperado,
                    COALESCE(f.total_fines, 0) AS multas,
                    COALESCE(oc.total_other_charges, 0) AS otros_cobros,
                    COALESCE(p.total_payments, 0) AS pagado_cuota,
                    COALESCE(op.total_other_payments, 0) AS pagado_otros_cobros,
                    COALESCE(p.total_payments, 0) + COALESCE(op.total_other_payments, 0) AS pagado,
                    COALESCE(fp.payments, '[]'::jsonb) AS pagos_capital
                FROM owners o
                JOIN owner_apartments oa ON o.id = oa.owner_id
                JOIN apartments        a  ON oa.apartment_id = a.id
                JOIN all_periods       ap ON ap.apartment_id = a.id
                LEFT JOIN apartment_fees af ON af.apartment_id = a.id AND af.period = ap.period
                LEFT JOIN agg_fines      f  ON  f.apartment_id = a.id AND  f.period = ap.period
                LEFT JOIN agg_other_charges oc ON oc.apartment_id = a.id AND oc.period = ap.period
                LEFT JOIN agg_other_payments op ON op.apartment_id = a.id AND op.period = ap.period
                LEFT JOIN agg_payments   p  ON  p.apartment_id = a.id AND  p.period = ap.period
                LEFT JOIN fee_payments   fp ON fp.apartment_id = a.id AND fp.period = ap.period
                WHERE o.status = 'ACTIVO' AND o.id = $1
            """
            params.append(end_period)
            
            if start_period:
                query += " AND ap.period >= $3"
                params.append(start_period)
            
            query += " ORDER BY ap.period, a.code"
        else:
            extra = " AND o.id = $1"
            idx = 2
            if start_period:
                extra += f" AND ap.period >= ${idx}"
                params.append(start_period)
                idx += 1
            query = _PERIOD_DATA_QUERY + extra + " ORDER BY ap.period, a.code"
            
        rows = await self._conn.fetch(query, *params)
        return [dict(r) for r in rows]

    async def get_other_charge_statement_lines(
        self,
        owner_id: UUID,
        start_period: Optional[str],
        end_period: Optional[str],
    ) -> list[dict]:
        conditions = ["oa.owner_id = $1"]
        params: list = [owner_id]
        idx = 2
        if start_period:
            conditions.append(f"oc.period >= ${idx}")
            params.append(start_period)
            idx += 1
        if end_period:
            conditions.append(f"oc.period <= ${idx}")
            params.append(end_period)

        rows = await self._conn.fetch(
            f"""
            SELECT
                oc.id AS other_charge_id,
                oc.apartment_id,
                a.code AS apartment_code,
                oc.period,
                oc.concept,
                oc.amount,
                COALESCE(p.paid_amount, 0) AS paid_amount
            FROM other_charges oc
            JOIN owner_apartments oa ON oa.apartment_id = oc.apartment_id
            JOIN apartments a ON a.id = oc.apartment_id
            LEFT JOIN (
                SELECT other_charge_id, SUM(amount) AS paid_amount
                FROM payments
                WHERE status = 'REGISTRADO' AND other_charge_id IS NOT NULL
                GROUP BY other_charge_id
            ) p ON p.other_charge_id = oc.id
            WHERE {" AND ".join(conditions)}
            ORDER BY oc.period, a.code, oc.concept
            """,
            *params,
        )
        return [dict(r) for r in rows]
