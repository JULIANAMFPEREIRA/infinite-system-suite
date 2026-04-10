
-- Unique constraint on necessidades_compra to prevent duplicate entries per projeto_item
CREATE UNIQUE INDEX IF NOT EXISTS uq_necessidades_projeto_item
ON public.necessidades_compra (projeto_id, projeto_item_id)
WHERE projeto_item_id IS NOT NULL AND status = 'pendente';

-- Unique constraint on comissoes to prevent duplicate entries per projeto_item + fornecedor
CREATE UNIQUE INDEX IF NOT EXISTS uq_comissoes_projeto_item_fornecedor
ON public.comissoes (projeto_id, projeto_item_id, fornecedor_id)
WHERE projeto_item_id IS NOT NULL AND status = 'pendente';
