-- Migración 012_add_receipt_to_expenses.sql — Agregar soporte para comprobantes en gastos
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_file_name VARCHAR(255);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_content_type VARCHAR(100);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_storage_path VARCHAR(500);
