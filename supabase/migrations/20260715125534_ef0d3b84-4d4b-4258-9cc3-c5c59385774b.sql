ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS origem_detalhe text;