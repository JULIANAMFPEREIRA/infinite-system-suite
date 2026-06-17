ALTER TABLE public.clientes DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.clientes ADD COLUMN user_id uuid REFERENCES auth.users(id);
GRANT ALL ON TABLE public.clientes TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');