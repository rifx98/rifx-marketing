-- Add flow_variables JSONB field to conversations to store dynamic variables
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS flow_variables jsonb DEFAULT '{}'::jsonb;
