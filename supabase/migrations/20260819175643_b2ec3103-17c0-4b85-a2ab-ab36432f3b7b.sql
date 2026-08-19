DROP POLICY IF EXISTS "Authenticated Uploads to Logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload crm files" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete their crm files" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_financeiro_arquivos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_insert_financeiro_arquivos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read_financeiro_arquivos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_financeiro_arquivos" ON storage.objects;

CREATE POLICY "empresa_read_files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('crm-files','financeiro-arquivos')
  AND public.get_empresa_id(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_empresa_id(auth.uid())::text
);

CREATE POLICY "empresa_insert_files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('crm-files','financeiro-arquivos')
  AND public.get_empresa_id(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_empresa_id(auth.uid())::text
);

CREATE POLICY "empresa_update_files" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('crm-files','financeiro-arquivos')
  AND public.get_empresa_id(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_empresa_id(auth.uid())::text
)
WITH CHECK (
  bucket_id IN ('crm-files','financeiro-arquivos')
  AND public.get_empresa_id(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_empresa_id(auth.uid())::text
);

CREATE POLICY "empresa_delete_files" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('crm-files','financeiro-arquivos')
  AND public.get_empresa_id(auth.uid()) IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_empresa_id(auth.uid())::text
);

CREATE OR REPLACE FUNCTION public.prevent_self_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND COALESCE(NEW.user_id, OLD.user_id) = auth.uid() THEN
    RAISE EXCEPTION 'Users cannot assign or modify their own roles';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_self_role_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_self_role_assignment() FROM anon;
REVOKE ALL ON FUNCTION public.prevent_self_role_assignment() FROM authenticated;

DROP TRIGGER IF EXISTS trg_prevent_self_role_assignment ON public.user_roles;
CREATE TRIGGER trg_prevent_self_role_assignment
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_assignment();