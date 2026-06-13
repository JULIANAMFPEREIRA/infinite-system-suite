ALTER TABLE public.visitas OWNER TO postgres;
ALTER TABLE public.visita_tecnicos OWNER TO postgres;
NOTIFY pgrst, 'reload schema';