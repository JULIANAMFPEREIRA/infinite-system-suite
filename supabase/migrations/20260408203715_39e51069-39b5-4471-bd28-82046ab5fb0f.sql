
-- Create crm_orcamentos table
CREATE TABLE public.crm_orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nome TEXT NOT NULL DEFAULT 'Orçamento 1',
  aprovado BOOLEAN NOT NULL DEFAULT false,
  simulacao_pagamento JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add orcamento_id to crm_itens (nullable for backward compat)
ALTER TABLE public.crm_itens ADD COLUMN orcamento_id UUID REFERENCES public.crm_orcamentos(id) ON DELETE CASCADE;

-- Enable RLS
ALTER TABLE public.crm_orcamentos ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin manages crm_orcamentos"
ON public.crm_orcamentos
FOR ALL
USING (
  empresa_id = get_empresa_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'administrativo'))
)
WITH CHECK (
  empresa_id = get_empresa_id(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'administrativo'))
);

CREATE POLICY "Empresa users see crm_orcamentos"
ON public.crm_orcamentos
FOR SELECT
USING (empresa_id = get_empresa_id(auth.uid()));
