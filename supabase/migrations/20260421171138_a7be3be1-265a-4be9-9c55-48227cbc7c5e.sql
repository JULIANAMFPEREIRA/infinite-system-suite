ALTER TABLE public.crm_itens
  ADD COLUMN IF NOT EXISTS rt_tipo text NOT NULL DEFAULT 'valor',
  ADD COLUMN IF NOT EXISTS rt_percentual numeric NOT NULL DEFAULT 0;