ALTER TABLE public.pagamentos_tecnico_lancamentos 
ADD COLUMN tipo TEXT DEFAULT 'realizado',
ADD COLUMN data_prevista DATE;

-- Update existing records to 'realizado' (though default handles it)
UPDATE public.pagamentos_tecnico_lancamentos SET tipo = 'realizado' WHERE tipo IS NULL;