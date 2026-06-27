
-- Scope authorizations to creator
DROP POLICY IF EXISTS "Authenticated users have full access to authorizations" ON public.authorizations;
CREATE POLICY "Creators manage authorizations"
  ON public.authorizations
  FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated users have full access to authorization_items" ON public.authorization_items;
CREATE POLICY "Creators manage authorization_items"
  ON public.authorization_items
  FOR ALL TO authenticated
  USING (
    authorization_id IN (
      SELECT id FROM public.authorizations WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    authorization_id IN (
      SELECT id FROM public.authorizations WHERE created_by = auth.uid()
    )
  );

-- Revoke PUBLIC/anon on helper SECURITY DEFINER functions; keep authenticated-only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_parceiro_fornecedor_id() FROM PUBLIC, anon;
