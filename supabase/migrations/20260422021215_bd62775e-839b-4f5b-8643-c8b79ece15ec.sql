-- Campos em fornecedores
ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS subtipo_parceiro text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Tabela projeto_parceiros (N:N)
CREATE TABLE IF NOT EXISTS public.projeto_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_id, parceiro_id)
);

CREATE INDEX IF NOT EXISTS idx_projeto_parceiros_projeto ON public.projeto_parceiros(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_parceiros_parceiro ON public.projeto_parceiros(parceiro_id);

ALTER TABLE public.projeto_parceiros ENABLE ROW LEVEL SECURITY;

-- Helper: fornecedor_id do parceiro logado (via JWT email)
CREATE OR REPLACE FUNCTION public.get_parceiro_fornecedor_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.fornecedores
  WHERE email = (auth.jwt() ->> 'email')
  LIMIT 1;
$$;

-- RLS projeto_parceiros
CREATE POLICY "Admin manages projeto_parceiros"
  ON public.projeto_parceiros FOR ALL
  USING (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (empresa_id = get_empresa_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresa users see projeto_parceiros"
  ON public.projeto_parceiros FOR SELECT
  USING (empresa_id = get_empresa_id(auth.uid()));

CREATE POLICY "Parceiro sees own vinculos"
  ON public.projeto_parceiros FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND parceiro_id = public.get_parceiro_fornecedor_id()
  );

-- Parceiro vê projetos vinculados
CREATE POLICY "Parceiro sees vinculados projetos"
  ON public.projetos FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND id IN (
      SELECT projeto_id FROM public.projeto_parceiros
      WHERE parceiro_id = public.get_parceiro_fornecedor_id()
    )
  );

-- Visitas técnicas
CREATE POLICY "Parceiro sees visitas vinculadas"
  ON public.visitas_tecnicas FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND projeto_id IN (
      SELECT projeto_id FROM public.projeto_parceiros
      WHERE parceiro_id = public.get_parceiro_fornecedor_id()
    )
  );

-- Comissões (RT) próprias
CREATE POLICY "Parceiro sees own comissoes"
  ON public.comissoes FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND fornecedor_id = public.get_parceiro_fornecedor_id()
  );

-- Histórico (timeline)
CREATE POLICY "Parceiro sees historico vinculado"
  ON public.historico_projeto FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND projeto_id IN (
      SELECT projeto_id FROM public.projeto_parceiros
      WHERE parceiro_id = public.get_parceiro_fornecedor_id()
    )
  );

-- Anotações (crm_interacoes)
CREATE POLICY "Parceiro sees interacoes vinculadas"
  ON public.crm_interacoes FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND cliente_id IN (
      SELECT p.cliente_id FROM public.projetos p
      JOIN public.projeto_parceiros pp ON pp.projeto_id = p.id
      WHERE pp.parceiro_id = public.get_parceiro_fornecedor_id()
    )
  );

CREATE POLICY "Parceiro insere interacoes vinculadas"
  ON public.crm_interacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND cliente_id IN (
      SELECT p.cliente_id FROM public.projetos p
      JOIN public.projeto_parceiros pp ON pp.projeto_id = p.id
      WHERE pp.parceiro_id = public.get_parceiro_fornecedor_id()
    )
  );

-- Imagens (crm_arquivos)
CREATE POLICY "Parceiro sees arquivos vinculados"
  ON public.crm_arquivos FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'parceiro'::app_role)
    AND cliente_id IN (
      SELECT p.cliente_id FROM public.projetos p
      JOIN public.projeto_parceiros pp ON pp.projeto_id = p.id
      WHERE pp.parceiro_id = public.get_parceiro_fornecedor_id()
    )
  );