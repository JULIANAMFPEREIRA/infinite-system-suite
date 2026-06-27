ALTER TABLE public.agenda_visitas ADD COLUMN IF NOT EXISTS visivel_portal boolean NOT NULL DEFAULT true;
SELECT pg_notify('pgrst', 'reload schema');