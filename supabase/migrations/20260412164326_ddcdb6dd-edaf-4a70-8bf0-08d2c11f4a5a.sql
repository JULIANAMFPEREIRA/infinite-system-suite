
CREATE TABLE public.transportadoras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'transportadora',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.transportadoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages transportadoras"
  ON public.transportadoras FOR ALL
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see transportadoras"
  ON public.transportadoras FOR SELECT
  USING (empresa_id = get_empresa_id(auth.uid()));
