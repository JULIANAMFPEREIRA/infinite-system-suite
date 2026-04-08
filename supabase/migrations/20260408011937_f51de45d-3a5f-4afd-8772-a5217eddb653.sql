
-- Add 'arquiteto' to origem_lead enum
ALTER TYPE public.origem_lead ADD VALUE IF NOT EXISTS 'arquiteto';

-- Add arquiteto_id to clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS arquiteto_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Create crm_itens table for pre-project items
CREATE TABLE IF NOT EXISTS public.crm_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  quantidade numeric DEFAULT 1,
  preco_custo numeric DEFAULT 0,
  preco_venda numeric DEFAULT 0,
  produto_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages crm_itens"
ON public.crm_itens FOR ALL
USING (empresa_id = get_empresa_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'administrativo')))
WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'administrativo')));

CREATE POLICY "Empresa users see crm_itens"
ON public.crm_itens FOR SELECT
USING (empresa_id = get_empresa_id(auth.uid()));
