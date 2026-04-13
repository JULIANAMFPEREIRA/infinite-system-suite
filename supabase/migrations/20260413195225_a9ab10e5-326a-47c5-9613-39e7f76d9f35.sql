
CREATE TABLE public.formulario_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  orcamento_id UUID REFERENCES public.crm_orcamentos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  status TEXT NOT NULL DEFAULT 'pendente',
  dados_preenchidos JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.formulario_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages formulario_tokens"
ON public.formulario_tokens
FOR ALL
TO public
USING (
  (empresa_id = get_empresa_id(auth.uid())) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrativo'::app_role))
)
WITH CHECK (
  (empresa_id = get_empresa_id(auth.uid())) AND
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrativo'::app_role))
);

CREATE POLICY "Empresa users see formulario_tokens"
ON public.formulario_tokens
FOR SELECT
TO public
USING (empresa_id = get_empresa_id(auth.uid()));
