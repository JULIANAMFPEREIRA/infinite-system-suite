GRANT ALL ON TABLE public.orcamento_grupos TO authenticated, anon, service_role;
ALTER TABLE public.orcamento_grupos OWNER TO postgres;
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');