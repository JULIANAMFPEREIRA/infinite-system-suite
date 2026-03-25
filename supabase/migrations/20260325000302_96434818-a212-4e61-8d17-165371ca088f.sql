
-- Create contratos table
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  projeto_id uuid REFERENCES public.projetos(id),
  cliente_id uuid REFERENCES public.clientes(id),
  status text NOT NULL DEFAULT 'rascunho',
  descricao text,
  valor numeric DEFAULT 0,
  data_envio date,
  data_assinatura date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages contratos" ON public.contratos FOR ALL TO public
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'))
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Empresa users see contratos" ON public.contratos FOR SELECT TO public
  USING (empresa_id = get_empresa_id(auth.uid()));
