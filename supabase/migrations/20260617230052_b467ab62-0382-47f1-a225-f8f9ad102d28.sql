ALTER TABLE public.clientes OWNER TO postgres;
GRANT ALL ON TABLE public.clientes TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');