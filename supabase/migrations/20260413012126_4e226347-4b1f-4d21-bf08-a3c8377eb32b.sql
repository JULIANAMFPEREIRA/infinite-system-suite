ALTER TABLE public.crm_itens ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'produto';
COMMENT ON COLUMN public.crm_itens.tipo IS 'Tipo do item: produto ou servico';