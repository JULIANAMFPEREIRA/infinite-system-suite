-- Add origem and tipo_manual columns to financeiro_pagar if they don't exist
ALTER TABLE public.financeiro_pagar
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS tipo_manual TEXT;

-- Update existing records to have 'manual' as default for origem if null
UPDATE public.financeiro_pagar SET origem = 'manual' WHERE origem IS NULL;
