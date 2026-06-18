ALTER TABLE public.crm_interacoes 
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES projetos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'aberta',
  ADD COLUMN IF NOT EXISTS autor_tipo text DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS visivel_portal boolean DEFAULT true;

ALTER TABLE public.crm_arquivos
  ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES projetos(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS autor_tipo text DEFAULT 'admin';

GRANT ALL ON TABLE public.crm_interacoes TO authenticated, service_role;
GRANT ALL ON TABLE public.crm_arquivos TO authenticated, service_role;
SELECT pg_notify('pgrst', 'reload schema');