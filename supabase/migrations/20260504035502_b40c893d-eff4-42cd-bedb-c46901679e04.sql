-- Add technician columns to crm_orcamentos
ALTER TABLE public.crm_orcamentos
  ADD COLUMN IF NOT EXISTS tecnico_id UUID;

ALTER TABLE public.crm_orcamentos
  ADD COLUMN IF NOT EXISTS tecnico_rt_valor NUMERIC DEFAULT 0;

ALTER TABLE public.crm_orcamentos
  ADD COLUMN IF NOT EXISTS tecnico_rt_vencimento TEXT;

-- Create parcelas_parceiros table
CREATE TABLE IF NOT EXISTS public.parcelas_parceiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id),
  projeto_id UUID REFERENCES public.projetos(id),
  orcamento_id UUID REFERENCES public.crm_orcamentos(id),
  parceiro_id UUID REFERENCES public.fornecedores(id),
  parceiro_nome TEXT,
  tipo_parceiro TEXT,
  descricao TEXT,
  valor NUMERIC DEFAULT 0,
  data_vencimento TEXT,
  data_pagamento TEXT,
  status TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parcelas_parceiros ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Users can view parcelas from their company" 
ON public.parcelas_parceiros 
FOR SELECT 
USING (empresa_id IN (
    SELECT id FROM empresas WHERE id = empresa_id
));

CREATE POLICY "Users can insert parcelas for their company" 
ON public.parcelas_parceiros 
FOR INSERT 
WITH CHECK (empresa_id IN (
    SELECT id FROM empresas WHERE id = empresa_id
));

CREATE POLICY "Users can update parcelas from their company" 
ON public.parcelas_parceiros 
FOR UPDATE 
USING (empresa_id IN (
    SELECT id FROM empresas WHERE id = empresa_id
));

CREATE POLICY "Users can delete parcelas from their company" 
ON public.parcelas_parceiros 
FOR DELETE 
USING (empresa_id IN (
    SELECT id FROM empresas WHERE id = empresa_id
));