
-- 1) Tabela pagamentos_rt
CREATE TABLE IF NOT EXISTS public.pagamentos_rt (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_parceiro_id uuid NOT NULL REFERENCES public.projeto_parceiros(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_rt_pp ON public.pagamentos_rt(projeto_parceiro_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_rt_parceiro ON public.pagamentos_rt(parceiro_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_rt_projeto ON public.pagamentos_rt(projeto_id);

-- 2) RLS
ALTER TABLE public.pagamentos_rt ENABLE ROW LEVEL SECURITY;

-- Empresa: usuários da mesma empresa têm acesso completo
CREATE POLICY "pagamentos_rt_empresa_select" ON public.pagamentos_rt
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

CREATE POLICY "pagamentos_rt_empresa_insert" ON public.pagamentos_rt
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));

CREATE POLICY "pagamentos_rt_empresa_update" ON public.pagamentos_rt
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

CREATE POLICY "pagamentos_rt_empresa_delete" ON public.pagamentos_rt
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()));

-- Parceiro: pode ver seus próprios pagamentos (consulta via fornecedor vinculado ao email)
CREATE POLICY "pagamentos_rt_parceiro_select" ON public.pagamentos_rt
  FOR SELECT TO authenticated
  USING (parceiro_id = public.get_fornecedor_id_by_email((auth.jwt() ->> 'email')));

-- 3) Função que recalcula rt_recebido a partir do somatório de pagamentos_rt
CREATE OR REPLACE FUNCTION public.recalc_rt_recebido(_pp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_soma numeric;
BEGIN
  SELECT COALESCE(SUM(valor), 0) INTO v_soma
  FROM public.pagamentos_rt WHERE projeto_parceiro_id = _pp_id;

  UPDATE public.projeto_parceiros
     SET rt_recebido = ROUND(v_soma, 2)
   WHERE id = _pp_id;
END;
$$;

-- 4) Trigger no pagamentos_rt para manter rt_recebido sincronizado
CREATE OR REPLACE FUNCTION public.trg_recalc_rt_recebido()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_rt_recebido(OLD.projeto_parceiro_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_rt_recebido(NEW.projeto_parceiro_id);
    IF TG_OP = 'UPDATE' AND OLD.projeto_parceiro_id <> NEW.projeto_parceiro_id THEN
      PERFORM public.recalc_rt_recebido(OLD.projeto_parceiro_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS pagamentos_rt_recalc_trigger ON public.pagamentos_rt;
CREATE TRIGGER pagamentos_rt_recalc_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos_rt
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_rt_recebido();
