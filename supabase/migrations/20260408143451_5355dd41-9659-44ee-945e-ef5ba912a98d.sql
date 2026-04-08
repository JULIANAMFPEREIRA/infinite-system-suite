
-- 1. Tabela equipe
CREATE TABLE public.equipe (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  funcao TEXT,
  contato TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.equipe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages equipe"
ON public.equipe FOR ALL
USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see equipe"
ON public.equipe FOR SELECT
USING (empresa_id = get_empresa_id(auth.uid()));

-- 2. Tabela crm_arquivos
CREATE TABLE public.crm_arquivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'documento',
  nome_arquivo TEXT NOT NULL,
  url TEXT NOT NULL,
  tamanho BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages crm_arquivos"
ON public.crm_arquivos FOR ALL
USING (empresa_id = get_empresa_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrativo'::app_role)))
WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'administrativo'::app_role)));

CREATE POLICY "Empresa users see crm_arquivos"
ON public.crm_arquivos FOR SELECT
USING (empresa_id = get_empresa_id(auth.uid()));

-- 3. Coluna rt_comissao em crm_itens
ALTER TABLE public.crm_itens ADD COLUMN rt_comissao NUMERIC DEFAULT 0;

-- 4. Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('crm-files', 'crm-files', true);

CREATE POLICY "Anyone can view crm files"
ON storage.objects FOR SELECT
USING (bucket_id = 'crm-files');

CREATE POLICY "Authenticated users upload crm files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'crm-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users delete crm files"
ON storage.objects FOR DELETE
USING (bucket_id = 'crm-files' AND auth.uid() IS NOT NULL);
