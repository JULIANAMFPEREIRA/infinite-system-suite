ALTER TABLE public.visitas RENAME TO agenda_visitas;
ALTER TABLE public.visita_tecnicos RENAME TO agenda_visita_tecnicos;
ALTER TABLE public.agenda_visitas OWNER TO postgres;
ALTER TABLE public.agenda_visita_tecnicos OWNER TO postgres;
GRANT ALL ON TABLE public.agenda_visitas TO authenticated, service_role;
GRANT ALL ON TABLE public.agenda_visita_tecnicos TO authenticated, service_role;