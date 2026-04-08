
-- Add orcamento_id to projetos to track which CRM quote originated it
ALTER TABLE public.projetos
ADD COLUMN orcamento_id uuid REFERENCES public.crm_orcamentos(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_projetos_orcamento_id ON public.projetos(orcamento_id);
