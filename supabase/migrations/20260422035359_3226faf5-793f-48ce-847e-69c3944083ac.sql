-- Adicionar nova base 'rt_itens' que usa a SOMA do RT já calculado em projeto_itens
-- (quantidade * preco_venda * rt_percentual / 100)

CREATE OR REPLACE FUNCTION public.calcular_rt_projeto_parceiro(_pp_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo text;
  v_base text;
  v_perc numeric;
  v_valor numeric;
  v_projeto uuid;
  v_venda numeric;
  v_itens numeric;
  v_rt_itens numeric;
  v_base_valor numeric;
  v_total numeric;
BEGIN
  SELECT rt_tipo, rt_base, rt_percentual, rt_valor, projeto_id
    INTO v_tipo, v_base, v_perc, v_valor, v_projeto
  FROM public.projeto_parceiros WHERE id = _pp_id;

  IF v_projeto IS NULL THEN RETURN; END IF;

  IF v_tipo = 'fixo' THEN
    v_total := COALESCE(v_valor, 0);
  ELSIF v_base = 'rt_itens' THEN
    -- NOVO: soma direta do RT calculado nos itens (qtd * preco_venda * rt% / 100)
    SELECT COALESCE(SUM(
      COALESCE(quantidade, 1)
      * COALESCE(preco_venda, 0)
      * COALESCE(rt_percentual, 0) / 100.0
    ), 0)
      INTO v_rt_itens
    FROM public.projeto_itens WHERE projeto_id = v_projeto;
    v_total := ROUND(COALESCE(v_rt_itens, 0), 2);
  ELSE
    -- percentual sobre venda_total ou soma de itens
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
$function$;

-- Garantir que o trigger por item dispare também para 'rt_itens'
CREATE OR REPLACE FUNCTION public.trg_recalcular_rt_por_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_projeto uuid;
  r record;
BEGIN
  v_projeto := COALESCE(NEW.projeto_id, OLD.projeto_id);
  IF v_projeto IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  FOR r IN
    SELECT id FROM public.projeto_parceiros
     WHERE projeto_id = v_projeto
       AND (
         (rt_tipo = 'percentual' AND rt_base IN ('itens','rt_itens'))
       )
  LOOP
    PERFORM public.calcular_rt_projeto_parceiro(r.id);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Garantir triggers ativos em projeto_itens
DROP TRIGGER IF EXISTS trg_rt_recalc_itens_iud ON public.projeto_itens;
CREATE TRIGGER trg_rt_recalc_itens_iud
  AFTER INSERT OR UPDATE OR DELETE ON public.projeto_itens
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_rt_por_item();

-- Trigger para recalcular ao inserir/atualizar projeto_parceiros
DROP TRIGGER IF EXISTS trg_rt_recalc_pp ON public.projeto_parceiros;
CREATE TRIGGER trg_rt_recalc_pp
  AFTER INSERT OR UPDATE OF rt_tipo, rt_base, rt_percentual, rt_valor ON public.projeto_parceiros
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalcular_rt_pp();

-- BACKFILL: recalcular todos os vínculos existentes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.projeto_parceiros LOOP
    PERFORM public.calcular_rt_projeto_parceiro(r.id);
  END LOOP;
END $$;