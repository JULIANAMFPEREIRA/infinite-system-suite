
ALTER TABLE public.crm_orcamentos
ADD COLUMN IF NOT EXISTS frete numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS imposto numeric DEFAULT 0;

ALTER TABLE public.produtos
ADD COLUMN IF NOT EXISTS cor text;
