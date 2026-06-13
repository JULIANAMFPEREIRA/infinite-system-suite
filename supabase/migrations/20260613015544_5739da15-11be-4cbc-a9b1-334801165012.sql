ALTER TABLE public.visitas RENAME TO visitas_temp;
ALTER TABLE public.visitas_temp RENAME TO visitas;
NOTIFY pgrst, 'reload schema';