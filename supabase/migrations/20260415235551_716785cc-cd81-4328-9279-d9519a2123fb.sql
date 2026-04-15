
-- Function to auto-create financeiro_pagar when a compra is inserted
CREATE OR REPLACE FUNCTION public.auto_gerar_conta_pagar_compra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only on INSERT, skip if a linked record already exists
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_pagar
    WHERE descricao LIKE 'Compra — %'
      AND empresa_id = NEW.empresa_id
      AND projeto_id IS NOT DISTINCT FROM NEW.projeto_id
      AND fornecedor_id IS NOT DISTINCT FROM NEW.fornecedor_id
      AND valor = COALESCE(NEW.valor_total, 0)
      AND created_at >= NEW.created_at - interval '5 seconds'
  ) THEN
    INSERT INTO public.financeiro_pagar (
      empresa_id,
      projeto_id,
      fornecedor_id,
      descricao,
      valor,
      data_vencimento,
      status
    ) VALUES (
      NEW.empresa_id,
      NEW.projeto_id,
      NEW.fornecedor_id,
      'Compra — ' || COALESCE(NEW.descricao, 'Sem descrição'),
      COALESCE(NEW.valor_total, 0),
      NEW.data_compra,
      'pendente'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on compras table
CREATE TRIGGER trg_compra_gera_conta_pagar
AFTER INSERT ON public.compras
FOR EACH ROW
EXECUTE FUNCTION public.auto_gerar_conta_pagar_compra();
