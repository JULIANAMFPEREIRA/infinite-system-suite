GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitas TO authenticated;
GRANT ALL ON public.visitas TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.visita_tecnicos TO authenticated;
GRANT ALL ON public.visita_tecnicos TO service_role;