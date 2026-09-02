-- Add tracking_pixels JSONB column to platform_settings

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS tracking_pixels jsonb NOT NULL DEFAULT '{"google_analytics": "", "facebook_pixel": "", "tiktok_pixel": ""}'::jsonb;

-- Ensure the structure is valid
UPDATE public.platform_settings
SET tracking_pixels = '{"google_analytics": "", "facebook_pixel": "", "tiktok_pixel": ""}'::jsonb
WHERE tracking_pixels IS NULL;
