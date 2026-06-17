GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategorias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subcategorias TO anon;
GRANT ALL ON public.subcategorias TO service_role;
NOTIFY pgrst, 'reload schema';