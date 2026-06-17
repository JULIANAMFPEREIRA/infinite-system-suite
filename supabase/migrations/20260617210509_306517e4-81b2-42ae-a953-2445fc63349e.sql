CREATE TABLE public.subcategorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  nome text NOT NULL,
  categoria_id uuid REFERENCES public.categorias(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON TABLE public.subcategorias TO authenticated, service_role;
ALTER TABLE public.subcategorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcategorias_all_authenticated" ON public.subcategorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
NOTIFY pgrst, 'reload schema';