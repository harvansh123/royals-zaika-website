-- ============================================================
-- 009_rider_management.sql
-- Rider Management & Control System
-- ============================================================

-- 1. Add account_status columns to delivery_partners
ALTER TABLE public.delivery_partners
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active','disabled','suspended','blocked')),
  ADD COLUMN IF NOT EXISTS suspension_end    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_reason    TEXT;

-- 2. Rider Audit Logs table
CREATE TABLE IF NOT EXISTS public.rider_audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id    UUID NOT NULL REFERENCES public.delivery_partners(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  reason      TEXT,
  owner_id    UUID REFERENCES public.users(id),
  owner_name  TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_rider ON public.rider_audit_logs(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.rider_audit_logs(created_at DESC);

-- 3. RLS for audit logs (owner-only read, service-role write)
ALTER TABLE public.rider_audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rider_audit_logs' AND policyname='audit_logs_owner_read') THEN
    CREATE POLICY "audit_logs_owner_read" ON public.rider_audit_logs
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('restaurant_owner', 'admin'))
      );
  END IF;
END $$;

