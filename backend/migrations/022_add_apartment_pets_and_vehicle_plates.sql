-- Agrega campos administrativos para perfil de departamento.
ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS pet_count INTEGER;

ALTER TABLE apartments
ADD COLUMN IF NOT EXISTS vehicle_plates TEXT[];

-- Normaliza nulos en datos existentes.
UPDATE apartments
SET pet_count = 0
WHERE pet_count IS NULL;

UPDATE apartments
SET vehicle_plates = ARRAY[]::TEXT[]
WHERE vehicle_plates IS NULL;
