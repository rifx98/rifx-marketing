-- Agregar columna image_url a la tabla announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;
-- Agregar columna button_text para texto del botón CTA
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS button_text TEXT DEFAULT NULL;
-- Agregar columna button_url para link del botón CTA
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS button_url TEXT DEFAULT NULL;
