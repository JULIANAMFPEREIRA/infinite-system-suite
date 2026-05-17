-- Add cliente_id column to pagamentos_tecnico
ALTER TABLE public.pagamentos_tecnico 
ADD COLUMN cliente_id UUID REFERENCES public.clientes(id);

-- No change needed to existing RLS policies if they use enterprise_id or tecnico_id, 
-- but ensuring they cover the new column if necessary.
-- Assuming existing policies are broad enough.
