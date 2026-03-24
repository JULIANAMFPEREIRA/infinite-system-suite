
CREATE TABLE public.necessidades_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id),
  projeto_item_id uuid REFERENCES public.projeto_itens(id),
  produto_id uuid REFERENCES public.produtos(id),
  descricao text,
  quantidade numeric DEFAULT 1,
  status text DEFAULT 'pendente',
  compra_id uuid REFERENCES public.compras(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.necessidades_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages necessidades" ON public.necessidades_compra
  FOR ALL TO public
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see necessidades" ON public.necessidades_compra
  FOR SELECT TO public
  USING (empresa_id = get_empresa_id(auth.uid()));
