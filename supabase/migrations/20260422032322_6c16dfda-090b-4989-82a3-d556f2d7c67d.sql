
-- 1) Adicionar campos de configuração e cálculo de RT em projeto_parceiros
ALTER TABLE public.projeto_parceiros
  ADD COLUMN IF NOT EXISTS rt_tipo text NOT NULL DEFAULT 'percentual' CHECK (rt_tipo IN ('percentual','fixo')),
  ADD COLUMN IF NOT EXISTS rt_base text NOT NULL DEFAULT 'venda_total' CHECK (rt_base IN ('venda_total','itens')),
  ADD COLUMN IF NOT EXISTS rt_percentual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rt_valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rt_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rt_recebido numeric NOT NULL DEFAULT 0;

-- 2) Função que calcula o RT total para uma linha de projeto_parceiros
CREATE OR REPLACE FUNCTION public.calcular_rt_projeto_parceiro(_pp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo text;
  v_base text;
  v_perc numeric;
  v_valor numeric;
  v_projeto uuid;
  v_venda numeric;
  v_itens numeric;
  v_base_valor numeric;
  v_total numeric;
BEGIN
  SELECT rt_tipo, rt_base, rt_percentual, rt_valor, projeto_id
    INTO v_tipo, v_base, v_perc, v_valor, v_projeto
  FROM public.projeto_parceiros WHERE id = _pp_id;

  IF v_projeto IS NULL THEN RETURN; END IF;

  IF v_tipo = 'fixo' THEN
    v_total := COALESCE(v_valor, 0);
  ELSE
    -- percentual: depende da base
    IF v_base = 'itens' THEN
      SELECT COALESCE(SUM(COALESCE(quantidade,1) * COALESCE(preco_venda,0)), 0)
        INTO v_itens
      FROM public.projeto_itens WHERE projeto_id = v_projeto;
      v_base_valor := v_itens;
    ELSE
      SELECT COALESCE(venda_total, 0) INTO v_venda
      FROM public.projetos WHERE id = v_projeto;
      v_base_valor := v_venda;
    END IF;
    v_total := ROUND(COALESCE(v_base_valor,0) * COALESCE(v_perc,0) / 100.0, 2);
  END IF;

  UPDATE public.projeto_parceiros
     SET rt_total = v_total
   WHERE id = _pp_id;
END;
$$;

-- 3) Trigger no próprio projeto_parceiros (insert/update de config)
CREATE OR REPLACE FUNCTION public.trg_recalcular_rt_pp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.calcular_rt_projeto_parceiro(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalcular_rt_pp_trigger ON public.projeto_parceiros;
CREATE TRIGGER recalcular_rt_pp_trigger
AFTER INSERT OR UPDATE OF rt_tipo, rt_base, rt_percentual, rt_valor, projeto_id
ON public.projeto_parceiros
FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_rt_pp();

-- 4) Trigger em projetos: quando venda_total mudar, recalcula todos os parceiros vinculados
CREATE OR REPLACE FUNCTION public.trg_recalcular_rt_por_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.projeto_parceiros WHERE projeto_id = NEW.id LOOP
    PERFORM public.calcular_rt_projeto_parceiro(r.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recalcular_rt_por_projeto_trigger ON public.projetos;
CREATE TRIGGER recalcular_rt_por_projeto_trigger
AFTER UPDATE OF venda_total ON public.projetos
FOR EACH ROW
WHEN (OLD.venda_total IS DISTINCT FROM NEW.venda_total)
EXECUTE FUNCTION public.trg_recalcular_rt_por_projeto();

-- 5) Trigger em projeto_itens: qualquer mudança recalcula parceiros do projeto (apenas se base = itens)
CREATE OR REPLACE FUNCTION public.trg_recalcular_rt_por_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_projeto uuid;
  r record;
BEGIN
  v_projeto := COALESCE(NEW.projeto_id, OLD.projeto_id);
  IF v_projeto IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  FOR r IN
    SELECT id FROM public.projeto_parceiros
     WHERE projeto_id = v_projeto AND rt_tipo = 'percentual' AND rt_base = 'itens'
  LOOP
    PERFORM public.calcular_rt_projeto_parceiro(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recalcular_rt_por_item_trigger ON public.projeto_itens;
CREATE TRIGGER recalcular_rt_por_item_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.projeto_itens
FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_rt_por_item();
