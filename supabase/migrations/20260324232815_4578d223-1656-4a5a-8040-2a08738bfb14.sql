
-- 1. New tables
CREATE TABLE public.visitas_tecnicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  tecnico_id uuid REFERENCES public.fornecedores(id),
  data date,
  descricao text,
  produtos_levados jsonb DEFAULT '[]'::jsonb,
  servicos_executados text,
  valor_pago_tecnico numeric DEFAULT 0,
  status_pagamento text DEFAULT 'pendente',
  data_pagamento date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.visitas_tecnicas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages visitas" ON public.visitas_tecnicas FOR ALL TO public
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see visitas" ON public.visitas_tecnicas FOR SELECT TO public
  USING (empresa_id = get_empresa_id(auth.uid()));

-- 2. Formas de pagamento
CREATE TABLE public.formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages formas_pagamento" ON public.formas_pagamento FOR ALL TO public
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see formas_pagamento" ON public.formas_pagamento FOR SELECT TO public
  USING (empresa_id = get_empresa_id(auth.uid()));

-- 3. Categorias
CREATE TABLE public.categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  nome text NOT NULL,
  tipo text DEFAULT 'produto',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages categorias" ON public.categorias FOR ALL TO public
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see categorias" ON public.categorias FOR SELECT TO public
  USING (empresa_id = get_empresa_id(auth.uid()));

-- 4. Alter projetos
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS endereco_obra text;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS observacoes_pagamento text;
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS numero_parcelas integer DEFAULT 1;

-- 5. Alter clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS endereco_obra text;

-- 6. Extend status_projeto enum with new values
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'lead';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'proposta';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'vendido';
ALTER TYPE public.status_projeto ADD VALUE IF NOT EXISTS 'pos_venda';
