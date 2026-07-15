
CREATE SEQUENCE IF NOT EXISTS public.pedidos_compra_numero_seq START 2001;

CREATE TABLE public.pedidos_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  numero integer NOT NULL DEFAULT nextval('public.pedidos_compra_numero_seq'),
  fornecedor_id uuid REFERENCES public.fornecedores(id),
  status text NOT NULL DEFAULT 'rascunho',
  data_pedido date DEFAULT now(),
  condicao_pagamento text,
  prazo_entrega text,
  transportadora_id uuid REFERENCES public.transportadoras(id),
  observacoes text,
  local_entrega text,
  responsavel text,
  frete numeric DEFAULT 0,
  desconto_total numeric DEFAULT 0,
  ipi numeric DEFAULT 0,
  total numeric DEFAULT 0,
  itens jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.pedidos_compra_numero_seq OWNED BY public.pedidos_compra.numero;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra TO authenticated;
GRANT ALL ON public.pedidos_compra TO service_role;
GRANT USAGE ON SEQUENCE public.pedidos_compra_numero_seq TO authenticated, service_role;

ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_members_manage_pedidos_compra"
  ON public.pedidos_compra
  FOR ALL
  TO authenticated
  USING (empresa_id = public.get_empresa_id(auth.uid()))
  WITH CHECK (empresa_id = public.get_empresa_id(auth.uid()));

CREATE TRIGGER pedidos_compra_updated_at
  BEFORE UPDATE ON public.pedidos_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
