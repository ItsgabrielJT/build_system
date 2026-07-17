-- Agrega tipo de unidad independiente de uso del departamento.
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS unit_type VARCHAR(100);

-- Backfill para mantener compatibilidad con datos existentes.
UPDATE apartments
SET unit_type = use_type
WHERE unit_type IS NULL
  AND use_type IS NOT NULL;
