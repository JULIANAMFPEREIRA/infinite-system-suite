
-- 1) Harden SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
        AND ur.empresa_id IS NOT DISTINCT FROM public.get_empresa_id(_user_id)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_empresa_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN NULL
    ELSE (SELECT empresa_id FROM public.profiles WHERE id = _user_id LIMIT 1)
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_parceiro_fornecedor_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_empresa_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parceiro_fornecedor_id() TO authenticated, service_role;

-- 2) Slug-scoped RPCs for public authorization flow
CREATE OR REPLACE FUNCTION public.get_public_authorization(_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'authorization', to_jsonb(a),
    'items', COALESCE((
      SELECT jsonb_agg(to_jsonb(i) ORDER BY i.order_index)
      FROM public.authorization_items i
      WHERE i.authorization_id = a.id
    ), '[]'::jsonb)
  )
  FROM public.authorizations a
  WHERE a.slug = _slug
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.submit_public_authorization(_slug text, _responses jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_id uuid;
  r jsonb;
BEGIN
  SELECT id INTO v_auth_id
  FROM public.authorizations
  WHERE slug = _slug AND status = 'pending'
  FOR UPDATE;

  IF v_auth_id IS NULL THEN
    RAISE EXCEPTION 'Authorization not found or already responded';
  END IF;

  FOR r IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    UPDATE public.authorization_items
       SET response = r->>'response',
           observation = NULLIF(r->>'observation', '')
     WHERE id = (r->>'id')::uuid
       AND authorization_id = v_auth_id;
  END LOOP;

  UPDATE public.authorizations
     SET status = 'responded',
         responded_at = now()
   WHERE id = v_auth_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_public_authorization(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_public_authorization(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_authorization(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_public_authorization(text, jsonb) TO anon, authenticated, service_role;

-- 3) Drop public/anonymous access to authorizations & authorization_items
DROP POLICY IF EXISTS "Public can view public authorizations" ON public.authorizations;
DROP POLICY IF EXISTS "Public can update authorizations status" ON public.authorizations;
DROP POLICY IF EXISTS "Public can view items for public authorizations" ON public.authorization_items;
DROP POLICY IF EXISTS "Public can update item responses" ON public.authorization_items;

-- 4) Storage — tighten crm-files bucket policies
DROP POLICY IF EXISTS "Authenticated users list crm files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete crm files" ON storage.objects;

CREATE POLICY "Owners delete their crm files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'crm-files' AND owner = auth.uid());

-- 5) Multi-tenant isolation: gate writes on financial/scheduling tables by role

-- parcelas_parceiros: enforce empresa_id NOT NULL and role-gated writes
ALTER TABLE public.parcelas_parceiros ALTER COLUMN empresa_id SET NOT NULL;

DROP POLICY IF EXISTS "Users insert parcelas in empresa" ON public.parcelas_parceiros;
DROP POLICY IF EXISTS "Users update parcelas of empresa" ON public.parcelas_parceiros;
DROP POLICY IF EXISTS "Users delete parcelas of empresa" ON public.parcelas_parceiros;

CREATE POLICY "Finance roles insert parcelas"
  ON public.parcelas_parceiros FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
CREATE POLICY "Finance roles update parcelas"
  ON public.parcelas_parceiros FOR UPDATE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  )
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
CREATE POLICY "Finance roles delete parcelas"
  ON public.parcelas_parceiros FOR DELETE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role))
  );

-- pagamentos_tecnico
DROP POLICY IF EXISTS "Users insert pagamentos_tecnico in empresa" ON public.pagamentos_tecnico;
DROP POLICY IF EXISTS "Users update pagamentos_tecnico of empresa" ON public.pagamentos_tecnico;
DROP POLICY IF EXISTS "Users delete pagamentos_tecnico of empresa" ON public.pagamentos_tecnico;

CREATE POLICY "Finance roles insert pagamentos_tecnico"
  ON public.pagamentos_tecnico FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
CREATE POLICY "Finance roles update pagamentos_tecnico"
  ON public.pagamentos_tecnico FOR UPDATE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  )
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
CREATE POLICY "Finance roles delete pagamentos_tecnico"
  ON public.pagamentos_tecnico FOR DELETE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role))
  );

-- pagamentos_tecnico_lancamentos
DROP POLICY IF EXISTS "Users insert lancamentos in empresa" ON public.pagamentos_tecnico_lancamentos;
DROP POLICY IF EXISTS "Users update lancamentos of empresa" ON public.pagamentos_tecnico_lancamentos;
DROP POLICY IF EXISTS "Users delete lancamentos of empresa" ON public.pagamentos_tecnico_lancamentos;

CREATE POLICY "Finance roles insert lancamentos"
  ON public.pagamentos_tecnico_lancamentos FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
CREATE POLICY "Finance roles update lancamentos"
  ON public.pagamentos_tecnico_lancamentos FOR UPDATE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  )
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
CREATE POLICY "Finance roles delete lancamentos"
  ON public.pagamentos_tecnico_lancamentos FOR DELETE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'financeiro'::app_role))
  );

-- agenda_visitas: gate writes to admin/administrativo/operacional/comercial roles
DROP POLICY IF EXISTS "Users insert visitas in their empresa" ON public.agenda_visitas;
DROP POLICY IF EXISTS "Users update visitas of their empresa" ON public.agenda_visitas;
DROP POLICY IF EXISTS "Users delete visitas of their empresa" ON public.agenda_visitas;

CREATE POLICY "Staff insert visitas"
  ON public.agenda_visitas FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role)
         OR has_role(auth.uid(),'operacional'::app_role)
         OR has_role(auth.uid(),'comercial'::app_role))
  );
CREATE POLICY "Staff update visitas"
  ON public.agenda_visitas FOR UPDATE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role)
         OR has_role(auth.uid(),'operacional'::app_role)
         OR has_role(auth.uid(),'comercial'::app_role))
  )
  WITH CHECK (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role)
         OR has_role(auth.uid(),'operacional'::app_role)
         OR has_role(auth.uid(),'comercial'::app_role))
  );
CREATE POLICY "Staff delete visitas"
  ON public.agenda_visitas FOR DELETE TO authenticated
  USING (
    empresa_id = get_empresa_id(auth.uid())
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );

-- agenda_visita_tecnicos: mirror gates against parent agenda_visita empresa
DROP POLICY IF EXISTS "Users insert visita_tecnicos via empresa" ON public.agenda_visita_tecnicos;
DROP POLICY IF EXISTS "Users update visita_tecnicos via empresa" ON public.agenda_visita_tecnicos;
DROP POLICY IF EXISTS "Users delete visita_tecnicos via empresa" ON public.agenda_visita_tecnicos;

CREATE POLICY "Staff insert visita_tecnicos"
  ON public.agenda_visita_tecnicos FOR INSERT TO authenticated
  WITH CHECK (
    visita_id IN (SELECT id FROM public.agenda_visitas WHERE empresa_id = get_empresa_id(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role)
         OR has_role(auth.uid(),'operacional'::app_role)
         OR has_role(auth.uid(),'comercial'::app_role))
  );
CREATE POLICY "Staff update visita_tecnicos"
  ON public.agenda_visita_tecnicos FOR UPDATE TO authenticated
  USING (
    visita_id IN (SELECT id FROM public.agenda_visitas WHERE empresa_id = get_empresa_id(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role)
         OR has_role(auth.uid(),'operacional'::app_role)
         OR has_role(auth.uid(),'comercial'::app_role))
  )
  WITH CHECK (
    visita_id IN (SELECT id FROM public.agenda_visitas WHERE empresa_id = get_empresa_id(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role)
         OR has_role(auth.uid(),'operacional'::app_role)
         OR has_role(auth.uid(),'comercial'::app_role))
  );
CREATE POLICY "Staff delete visita_tecnicos"
  ON public.agenda_visita_tecnicos FOR DELETE TO authenticated
  USING (
    visita_id IN (SELECT id FROM public.agenda_visitas WHERE empresa_id = get_empresa_id(auth.uid()))
    AND (has_role(auth.uid(),'admin'::app_role)
         OR has_role(auth.uid(),'administrativo'::app_role))
  );
