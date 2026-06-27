
-- =====================================================
-- 1. has_role: scope by empresa_id (current user's company)
-- =====================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.empresa_id IS NOT DISTINCT FROM public.get_empresa_id(_user_id)
  );
$$;

-- =====================================================
-- 2. user_roles: scope admin management by empresa
-- =====================================================
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND empresa_id = public.get_empresa_id(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND empresa_id = public.get_empresa_id(auth.uid())
  );

-- =====================================================
-- 3. agenda_visitas: empresa_id scoping
-- =====================================================
DROP POLICY IF EXISTS "Authenticated can manage visitas" ON public.agenda_visitas;
CREATE POLICY "Users select visitas of their empresa" ON public.agenda_visitas
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users insert visitas in their empresa" ON public.agenda_visitas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users update visitas of their empresa" ON public.agenda_visitas
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users delete visitas of their empresa" ON public.agenda_visitas
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

-- =====================================================
-- 4. agenda_visita_tecnicos: scope via parent visit
-- =====================================================
DROP POLICY IF EXISTS "Authenticated can manage visita_tecnicos" ON public.agenda_visita_tecnicos;
CREATE POLICY "Users select visita_tecnicos via empresa" ON public.agenda_visita_tecnicos
  FOR SELECT TO authenticated
  USING (
    visita_id IN (
      SELECT id FROM public.agenda_visitas
      WHERE empresa_id = public.get_empresa_id(auth.uid())
    )
  );
CREATE POLICY "Users insert visita_tecnicos via empresa" ON public.agenda_visita_tecnicos
  FOR INSERT TO authenticated
  WITH CHECK (
    visita_id IN (
      SELECT id FROM public.agenda_visitas
      WHERE empresa_id = public.get_empresa_id(auth.uid())
    )
  );
CREATE POLICY "Users update visita_tecnicos via empresa" ON public.agenda_visita_tecnicos
  FOR UPDATE TO authenticated
  USING (
    visita_id IN (
      SELECT id FROM public.agenda_visitas
      WHERE empresa_id = public.get_empresa_id(auth.uid())
    )
  )
  WITH CHECK (
    visita_id IN (
      SELECT id FROM public.agenda_visitas
      WHERE empresa_id = public.get_empresa_id(auth.uid())
    )
  );
CREATE POLICY "Users delete visita_tecnicos via empresa" ON public.agenda_visita_tecnicos
  FOR DELETE TO authenticated
  USING (
    visita_id IN (
      SELECT id FROM public.agenda_visitas
      WHERE empresa_id = public.get_empresa_id(auth.uid())
    )
  );

-- =====================================================
-- 5. pagamentos_tecnico: empresa_id scoping
-- =====================================================
DROP POLICY IF EXISTS "Users can view technician payments for their company" ON public.pagamentos_tecnico;
DROP POLICY IF EXISTS "Users can insert technician payments for their company" ON public.pagamentos_tecnico;
DROP POLICY IF EXISTS "Users can update technician payments for their company" ON public.pagamentos_tecnico;
DROP POLICY IF EXISTS "Users can delete technician payments for their company" ON public.pagamentos_tecnico;
CREATE POLICY "Users view pagamentos_tecnico of empresa" ON public.pagamentos_tecnico
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users insert pagamentos_tecnico in empresa" ON public.pagamentos_tecnico
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users update pagamentos_tecnico of empresa" ON public.pagamentos_tecnico
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users delete pagamentos_tecnico of empresa" ON public.pagamentos_tecnico
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

-- =====================================================
-- 6. pagamentos_tecnico_lancamentos: empresa_id scoping
-- =====================================================
DROP POLICY IF EXISTS "Users can view technician launches for their company" ON public.pagamentos_tecnico_lancamentos;
DROP POLICY IF EXISTS "Users can insert technician launches for their company" ON public.pagamentos_tecnico_lancamentos;
DROP POLICY IF EXISTS "Users can delete technician launches for their company" ON public.pagamentos_tecnico_lancamentos;
CREATE POLICY "Users view lancamentos of empresa" ON public.pagamentos_tecnico_lancamentos
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users insert lancamentos in empresa" ON public.pagamentos_tecnico_lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users update lancamentos of empresa" ON public.pagamentos_tecnico_lancamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users delete lancamentos of empresa" ON public.pagamentos_tecnico_lancamentos
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

-- =====================================================
-- 7. parcelas_parceiros: replace tautology
-- =====================================================
DROP POLICY IF EXISTS "Users can view parcelas from their company" ON public.parcelas_parceiros;
DROP POLICY IF EXISTS "Users can insert parcelas for their company" ON public.parcelas_parceiros;
DROP POLICY IF EXISTS "Users can update parcelas from their company" ON public.parcelas_parceiros;
DROP POLICY IF EXISTS "Users can delete parcelas from their company" ON public.parcelas_parceiros;
CREATE POLICY "Users view parcelas of empresa" ON public.parcelas_parceiros
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users insert parcelas in empresa" ON public.parcelas_parceiros
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users update parcelas of empresa" ON public.parcelas_parceiros
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users delete parcelas of empresa" ON public.parcelas_parceiros
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

-- =====================================================
-- 8. subcategorias: empresa_id scoping
-- =====================================================
DROP POLICY IF EXISTS "subcategorias_all_authenticated" ON public.subcategorias;
CREATE POLICY "Users view subcategorias of empresa" ON public.subcategorias
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users insert subcategorias in empresa" ON public.subcategorias
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users update subcategorias of empresa" ON public.subcategorias
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users delete subcategorias of empresa" ON public.subcategorias
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

-- =====================================================
-- 9. Fix mutable search_path on trigger helpers
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =====================================================
-- 10. Revoke EXECUTE on internal SECURITY DEFINER helpers
--     from anon/authenticated (keep only those needed by app/RLS).
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.calcular_rt_projeto_parceiro(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_rt_recebido(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.format_whatsapp_rt_message(text, text, numeric, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_fornecedor_id_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_custo_real_projeto() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_gerar_conta_pagar_comissao() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_gerar_conta_pagar_compra() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_sync_conta_pagar_compra() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_historico_status_projeto() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_enviar_whatsapp_rt() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notificar_pagamento_rt() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_cliente_imagem() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_cliente_status_projeto() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_notify_cliente_visita() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalc_rt_recebido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalcular_rt_por_item() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalcular_rt_por_projeto() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recalcular_rt_pp() FROM PUBLIC, anon, authenticated;

-- Functions still required by app/RLS keep EXECUTE for authenticated:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_parceiro_fornecedor_id() TO authenticated;

-- =====================================================
-- 11. Storage: stop allowing anonymous listing of crm-files
-- (public URLs of published files still work because the
--  bucket is public; this only removes broad listing rights).
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view crm files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to Logos" ON storage.objects;
CREATE POLICY "Authenticated users list crm files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'crm-files');
