
-- Function to sync compra updates to financeiro_pagar
CREATE OR REPLACE FUNCTION public.auto_sync_conta_pagar_compra()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only update linked financeiro_pagar that are still pendente (never touch paid ones)
  UPDATE public.financeiro_pagar
  SET
    descricao = 'Compra — ' || COALESCE(NEW.descricao, 'Sem descrição'),
    valor = COALESCE(NEW.valor_total, 0),
    fornecedor_id = NEW.fornecedor_id,
    projeto_id = NEW.projeto_id,
    data_vencimento = NEW.data_compra
  WHERE
    empresa_id = NEW.empresa_id
    AND descricao = 'Compra — ' || COALESCE(OLD.descricao, 'Sem descrição')
    AND valor = COALESCE(OLD.valor_total, 0)
    AND fornecedor_id IS NOT DISTINCT FROM OLD.fornecedor_id
    AND projeto_id IS NOT DISTINCT FROM OLD.projeto_id
    AND status = 'pendente'
    AND deletado = false;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compra_sync_conta_pagar
AFTER UPDATE ON public.compras
FOR EACH ROW
WHEN (
  OLD.descricao IS DISTINCT FROM NEW.descricao
  OR OLD.valor_total IS DISTINCT FROM NEW.valor_total
  OR OLD.fornecedor_id IS DISTINCT FROM NEW.fornecedor_id
  OR OLD.projeto_id IS DISTINCT FROM NEW.projeto_id
  OR OLD.data_compra IS DISTINCT FROM NEW.data_compra
)
EXECUTE FUNCTION public.auto_sync_conta_pagar_compra();
