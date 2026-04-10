
CREATE UNIQUE INDEX IF NOT EXISTS uq_projeto_itens_projeto_desc_tipo
ON public.projeto_itens (projeto_id, descricao, tipo)
WHERE descricao IS NOT NULL;
