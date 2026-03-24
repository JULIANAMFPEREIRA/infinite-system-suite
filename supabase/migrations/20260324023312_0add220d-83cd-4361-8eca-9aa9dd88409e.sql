
-- Fix audit_logs INSERT policy to restrict to authenticated users only
DROP POLICY IF EXISTS "System inserts audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated inserts audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
