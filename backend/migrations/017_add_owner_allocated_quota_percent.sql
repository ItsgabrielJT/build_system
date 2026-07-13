-- Migración 017: alícuota porcentual por propietario
-- Este porcentaje se usa para distribuir cuotas ordinarias o extraordinarias.

ALTER TABLE owners
ADD COLUMN IF NOT EXISTS allocated_quota_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;

UPDATE owners o
SET allocated_quota_percent = COALESCE(src.total_percent, 0)
FROM (
    SELECT
        oa.owner_id,
        SUM(COALESCE(a.allocated_quota_percent, 0)) AS total_percent
    FROM owner_apartments oa
    JOIN apartments a ON a.id = oa.apartment_id
    GROUP BY oa.owner_id
) src
WHERE o.id = src.owner_id
  AND COALESCE(o.allocated_quota_percent, 0) = 0;
