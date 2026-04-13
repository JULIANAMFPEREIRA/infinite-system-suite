-- Add quick quote fields to crm_orcamentos
ALTER TABLE public.crm_orcamentos 
  ADD COLUMN IF NOT EXISTS is_avulso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cliente_nome_avulso text,
  ADD COLUMN IF NOT EXISTS cliente_telefone_avulso text;

-- Make cliente_id nullable for avulso quotes (it already is nullable? let's check)
-- cliente_id is NOT NULL, so we need to allow null for avulso quotes
ALTER TABLE public.crm_orcamentos ALTER COLUMN cliente_id DROP NOT NULL;