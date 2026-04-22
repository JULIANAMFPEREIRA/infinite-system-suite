
-- Add valor_recebido to financeiro_receber
ALTER TABLE public.financeiro_receber
ADD COLUMN IF NOT EXISTS valor_recebido numeric NOT NULL DEFAULT 0;

-- Add 'parcial' to status_financeiro enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'parcial'
      AND enumtypid = 'public.status_financeiro'::regtype
  ) THEN
    ALTER TYPE public.status_financeiro ADD VALUE 'parcial';
  END IF;
END$$;

-- Create recebimentos_parciais table for history
CREATE TABLE IF NOT EXISTS public.recebimentos_parciais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id uuid NOT NULL,
  financeiro_receber_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receb_parciais_fr ON public.recebimentos_parciais(financeiro_receber_id);
CREATE INDEX IF NOT EXISTS idx_receb_parciais_emp ON public.recebimentos_parciais(empresa_id);

ALTER TABLE public.recebimentos_parciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Empresa users see recebimentos_parciais" ON public.recebimentos_parciais;
CREATE POLICY "Empresa users see recebimentos_parciais"
ON public.recebimentos_parciais
FOR SELECT
USING (empresa_id = get_empresa_id(auth.uid()));

DROP POLICY IF EXISTS "Admin/Financeiro manage recebimentos_parciais" ON public.recebimentos_parciais;
CREATE POLICY "Admin/Financeiro manage recebimentos_parciais"
ON public.recebimentos_parciais
FOR ALL
USING (
  empresa_id = get_empresa_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
)
WITH CHECK (
  empresa_id = get_empresa_id(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'financeiro'::app_role))
);
