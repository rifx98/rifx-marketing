-- Migration: 036_allow_null_video_storage_path.sql
-- Permite que la columna video_storage_path en social_posts sea NULL
-- una vez que el video ha sido publicado en las redes sociales y eliminado de Cloudflare R2
-- para liberar almacenamiento y memoria.

ALTER TABLE public.social_posts 
  ALTER COLUMN video_storage_path DROP NOT NULL;
