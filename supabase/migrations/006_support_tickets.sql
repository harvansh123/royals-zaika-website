-- ============================================================
-- 006_support_tickets.sql
-- Unified Help & Support System
-- ============================================================

-- 1. Create handle_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create support_tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'rider', 'owner')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    attachments TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
CREATE TRIGGER set_support_tickets_updated_at
BEFORE UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 3. Row Level Security for support_tickets
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can insert their own tickets
CREATE POLICY "Users can insert their own support tickets" 
ON public.support_tickets FOR INSERT 
WITH CHECK (
    user_id = auth.uid() OR auth.uid() IS NULL -- allow guests if needed, though UI enforces login
);

-- Users can view their own tickets
CREATE POLICY "Users can view their own support tickets"
ON public.support_tickets FOR SELECT
USING (user_id = auth.uid());

-- Admins/Owners can view all tickets
CREATE POLICY "Admins can view all support tickets"
ON public.support_tickets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'restaurant_owner'
    )
);

-- Admins/Owners can update any ticket
CREATE POLICY "Admins can update support tickets"
ON public.support_tickets FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'restaurant_owner'
    )
);

-- 4. Storage Bucket for Attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('support_attachments', 'support_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage Policies
-- Anyone authenticated can upload to support_attachments
CREATE POLICY "Authenticated users can upload support attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'support_attachments');

-- Anyone can view the public support attachments
CREATE POLICY "Public read access for support attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'support_attachments');

-- Owners can delete attachments (if needed for cleanup)
CREATE POLICY "Owners can delete support attachments"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'support_attachments' AND 
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() AND users.role = 'restaurant_owner'
    )
);
