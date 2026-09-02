-- Add flow engine state fields to conversations table
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS current_node_id text,
ADD COLUMN IF NOT EXISTS is_human_mode boolean NOT NULL DEFAULT false;

-- Add index to current_node_id for performance
CREATE INDEX IF NOT EXISTS idx_conversations_current_node ON public.conversations(current_node_id);
