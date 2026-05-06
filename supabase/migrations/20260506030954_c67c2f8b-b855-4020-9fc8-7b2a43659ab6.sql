-- Add parcelamento columns to comissoes
ALTER TABLE public.comissoes 
ADD COLUMN IF NOT EXISTS parcelado BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS num_parcelas INTEGER;

-- No new RLS policies needed as these are just columns on an existing table with RLS enabled.
