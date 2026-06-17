CREATE TABLE IF NOT EXISTS public.orcamento_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  cliente_id uuid REFERENCES public.clientes(id),
  projeto_id uuid REFERENCES public.projetos(id),
  nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_grupos TO authenticated;
GRANT ALL ON public.orcamento_grupos TO service_role;

ALTER TABLE public.orcamento_grupos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users manage orcamento_grupos"
  ON public.orcamento_grupos FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

ALTER TABLE public.crm_orcamentos
  ADD COLUMN IF NOT EXISTS grupo_id uuid REFERENCES public.orcamento_grupos(id);

NOTIFY pgrst, 'reload schema';