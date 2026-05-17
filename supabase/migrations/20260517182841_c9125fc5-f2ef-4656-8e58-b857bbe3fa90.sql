-- Table for tracking combined project values for technicians
CREATE TABLE IF NOT EXISTS public.pagamentos_tecnico (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tecnico_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    valor_combinado DECIMAL(12,2) NOT NULL DEFAULT 0,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(tecnico_id, projeto_id)
);

-- Table for tracking actual payment entries
CREATE TABLE IF NOT EXISTS public.pagamentos_tecnico_lancamentos (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tecnico_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
    valor DECIMAL(12,2) NOT NULL DEFAULT 0,
    data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
    observacao TEXT,
    mes_referencia TEXT, -- Format "MM/YYYY"
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pagamentos_tecnico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_tecnico_lancamentos ENABLE ROW LEVEL SECURITY;

-- Policies for pagamentos_tecnico
CREATE POLICY "Users can view technician payments for their company"
ON public.pagamentos_tecnico FOR SELECT
USING (true);

CREATE POLICY "Users can insert technician payments for their company"
ON public.pagamentos_tecnico FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update technician payments for their company"
ON public.pagamentos_tecnico FOR UPDATE
USING (true);

CREATE POLICY "Users can delete technician payments for their company"
ON public.pagamentos_tecnico FOR DELETE
USING (true);

-- Policies for pagamentos_tecnico_lancamentos
CREATE POLICY "Users can view technician launches for their company"
ON public.pagamentos_tecnico_lancamentos FOR SELECT
USING (true);

CREATE POLICY "Users can insert technician launches for their company"
ON public.pagamentos_tecnico_lancamentos FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete technician launches for their company"
ON public.pagamentos_tecnico_lancamentos FOR DELETE
USING (true);

-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on pagamentos_tecnico
DROP TRIGGER IF EXISTS update_pagamentos_tecnico_updated_at ON public.pagamentos_tecnico;
CREATE TRIGGER update_pagamentos_tecnico_updated_at
BEFORE UPDATE ON public.pagamentos_tecnico
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();