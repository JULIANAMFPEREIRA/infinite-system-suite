
-- Create the INSERT trigger that was missing
CREATE TRIGGER trg_compra_gerar_conta_pagar
AFTER INSERT ON public.compras
FOR EACH ROW
EXECUTE FUNCTION public.auto_gerar_conta_pagar_compra();

-- Also re-create the UPDATE sync trigger (was in migration but not active)
DROP TRIGGER IF EXISTS trg_compra_sync_conta_pagar ON public.compras;
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
