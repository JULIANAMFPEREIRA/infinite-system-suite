ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.anotacoes_usuario ADD COLUMN IF NOT EXISTS visivel_cliente boolean NOT NULL DEFAULT false;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);