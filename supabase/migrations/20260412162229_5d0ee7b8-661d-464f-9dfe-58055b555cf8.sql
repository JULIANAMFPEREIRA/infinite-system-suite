
-- Tabela de histórico de status do projeto
CREATE TABLE public.historico_projeto (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  data TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id),
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para performance
CREATE INDEX idx_historico_projeto_projeto_id ON public.historico_projeto(projeto_id);
CREATE INDEX idx_historico_projeto_data ON public.historico_projeto(data DESC);

-- Enable RLS
ALTER TABLE public.historico_projeto ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Empresa users see historico"
ON public.historico_projeto
FOR SELECT
USING (
  projeto_id IN (
    SELECT id FROM public.projetos WHERE empresa_id = get_empresa_id(auth.uid())
  )
);

CREATE POLICY "Admin manages historico"
ON public.historico_projeto
FOR ALL
USING (
  projeto_id IN (
    SELECT id FROM public.projetos WHERE empresa_id = get_empresa_id(auth.uid())
  )
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Trigger: registrar mudança de status automaticamente
CREATE OR REPLACE FUNCTION public.registrar_historico_status_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.historico_projeto (projeto_id, status, data, usuario_id)
    VALUES (NEW.id, NEW.status::text, now(), auth.uid());
    
    -- Se status = aprovado, definir data_inicio
    IF NEW.status = 'aprovado' THEN
      NEW.data_inicio = CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_historico_status_projeto
BEFORE UPDATE ON public.projetos
FOR EACH ROW
EXECUTE FUNCTION public.registrar_historico_status_projeto();
