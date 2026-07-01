-- ============================================================
-- 007_support_tickets_archive.sql
-- Add archiving support to support_tickets
-- ============================================================

-- Add is_archived column (tickets auto-hide after 48 hours)
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Add attachments_count for quick display
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS attachments_count INTEGER DEFAULT 0;

-- Update RLS: owners can also view archived tickets
-- (existing policies already cover this via restaurant_owner role check)

-- Create index for faster archive queries
CREATE INDEX IF NOT EXISTS idx_support_tickets_is_archived 
ON public.support_tickets (is_archived);

CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at 
ON public.support_tickets (created_at);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id_created 
ON public.support_tickets (user_id, created_at DESC);
