
-- =============================================
-- INFINIT SYSTEM — ERP DATABASE SCHEMA
-- =============================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'administrativo', 'financeiro', 'tecnico', 'arquiteto', 'cliente');
CREATE TYPE public.origem_lead AS ENUM ('whatsapp', 'instagram', 'indicacao', 'outro');
CREATE TYPE public.status_crm AS ENUM ('lead', 'contato', 'proposta', 'projeto');
CREATE TYPE public.tipo_fornecedor AS ENUM ('fornecedor', 'arquiteto');
CREATE TYPE public.status_projeto AS ENUM ('orcamento', 'aprovado', 'em_andamento', 'concluido', 'cancelado');
CREATE TYPE public.tipo_projeto_item AS ENUM ('produto', 'servico', 'mao_de_obra');
CREATE TYPE public.status_compra AS ENUM ('pendente', 'aprovada', 'entregue', 'cancelada');
CREATE TYPE public.status_estoque AS ENUM ('disponivel', 'reservado', 'instalado');
CREATE TYPE public.status_comissao AS ENUM ('pendente', 'pago');
CREATE TYPE public.status_financeiro AS ENUM ('pendente', 'pago', 'vencido', 'cancelado');
CREATE TYPE public.tipo_financa_pessoal AS ENUM ('retirada', 'devolucao', 'despesa', 'receita');
CREATE TYPE public.acao_audit AS ENUM ('criacao', 'edicao', 'exclusao');

-- 2. EMPRESAS (SaaS multiempresa)
CREATE TABLE public.empresas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT,
  segmento TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. USER ROLES (tabela separada conforme boas práticas)
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, empresa_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 5. CLIENTES
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  endereco TEXT,
  origem public.origem_lead DEFAULT 'outro',
  status_crm public.status_crm DEFAULT 'lead',
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 6. CRM INTERAÇÕES
CREATE TABLE public.crm_interacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  tipo TEXT,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_interacoes ENABLE ROW LEVEL SECURITY;

-- 7. FORNECEDORES
CREATE TABLE public.fornecedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo public.tipo_fornecedor DEFAULT 'fornecedor',
  cnpj_cpf TEXT,
  telefone TEXT,
  email TEXT,
  rt_percentual NUMERIC(5,2) DEFAULT 0,
  cidade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

-- 8. PRODUTOS (Catálogo)
CREATE TABLE public.produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo TEXT,
  nome TEXT NOT NULL,
  categoria TEXT,
  marca TEXT,
  unidade TEXT DEFAULT 'un',
  preco_custo NUMERIC(12,2) DEFAULT 0,
  preco_venda NUMERIC(12,2) DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

-- 9. PROJETOS (NÚCLEO CENTRAL)
CREATE TABLE public.projetos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id),
  arquiteto_id UUID REFERENCES public.fornecedores(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  status public.status_projeto DEFAULT 'orcamento',
  custo_previsto NUMERIC(12,2) DEFAULT 0,
  venda_total NUMERIC(12,2) DEFAULT 0,
  margem_prevista NUMERIC(12,2) DEFAULT 0,
  custo_real NUMERIC(12,2) DEFAULT 0,
  lucro_real NUMERIC(12,2) DEFAULT 0,
  entrada_recebida BOOLEAN DEFAULT false,
  data_inicio DATE,
  data_previsao DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;

-- 10. PROJETO ITENS (produtos, serviços, mão de obra)
CREATE TABLE public.projeto_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id),
  descricao TEXT,
  tipo public.tipo_projeto_item DEFAULT 'produto',
  quantidade NUMERIC(10,2) DEFAULT 1,
  preco_custo NUMERIC(12,2) DEFAULT 0,
  preco_venda NUMERIC(12,2) DEFAULT 0,
  rt_percentual NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projeto_itens ENABLE ROW LEVEL SECURITY;

-- 11. COMPRAS (vinculadas a projeto)
CREATE TABLE public.compras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  projeto_id UUID REFERENCES public.projetos(id),
  projeto_item_id UUID REFERENCES public.projeto_itens(id),
  produto_id UUID REFERENCES public.produtos(id),
  descricao TEXT,
  quantidade NUMERIC(10,2) DEFAULT 1,
  valor_unitario NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) DEFAULT 0,
  status public.status_compra DEFAULT 'pendente',
  data_compra DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

-- 12. ESTOQUE ITENS (controle por série, baixa na instalação)
CREATE TABLE public.estoque_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  compra_id UUID REFERENCES public.compras(id),
  numero_serie TEXT,
  localizacao TEXT,
  status public.status_estoque DEFAULT 'disponivel',
  projeto_id UUID REFERENCES public.projetos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;

-- 13. COMISSÕES (RT)
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID NOT NULL REFERENCES public.projetos(id),
  fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id),
  projeto_item_id UUID REFERENCES public.projeto_itens(id),
  percentual NUMERIC(5,2) DEFAULT 0,
  valor NUMERIC(12,2) DEFAULT 0,
  status public.status_comissao DEFAULT 'pendente',
  data_vencimento DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- 14. FINANCEIRO A PAGAR
CREATE TABLE public.financeiro_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id),
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  comissao_id UUID REFERENCES public.comissoes(id),
  descricao TEXT,
  valor NUMERIC(12,2) DEFAULT 0,
  data_vencimento DATE,
  data_pagamento DATE,
  status public.status_financeiro DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financeiro_pagar ENABLE ROW LEVEL SECURITY;

-- 15. FINANCEIRO A RECEBER
CREATE TABLE public.financeiro_receber (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  projeto_id UUID REFERENCES public.projetos(id),
  cliente_id UUID REFERENCES public.clientes(id),
  descricao TEXT,
  valor NUMERIC(12,2) DEFAULT 0,
  parcela INTEGER DEFAULT 1,
  data_vencimento DATE,
  data_pagamento DATE,
  status public.status_financeiro DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financeiro_receber ENABLE ROW LEVEL SECURITY;

-- 16. FINANÇAS PESSOAIS (isolado)
CREATE TABLE public.financas_pessoais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  descricao TEXT,
  categoria TEXT,
  valor NUMERIC(12,2) DEFAULT 0,
  tipo public.tipo_financa_pessoal DEFAULT 'despesa',
  data DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financas_pessoais ENABLE ROW LEVEL SECURITY;

-- 17. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID REFERENCES public.empresas(id),
  usuario_id UUID REFERENCES auth.users(id),
  tabela TEXT NOT NULL,
  registro_id UUID,
  acao public.acao_audit NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- get_empresa_id: retorna empresa_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_empresa_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

-- has_role: verifica se usuário tem um role específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- EMPRESAS: usuários veem apenas sua empresa
CREATE POLICY "Users see own empresa" ON public.empresas
  FOR SELECT USING (id = public.get_empresa_id(auth.uid()));

-- PROFILES: usuários veem profiles da mesma empresa
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid() OR empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- USER_ROLES: admins gerenciam, usuários veem próprios
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- CLIENTES: filtro por empresa + cliente vê apenas si mesmo
CREATE POLICY "Empresa users see clientes" ON public.clientes
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Admin manages clientes" ON public.clientes
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'administrativo')));

-- CRM INTERAÇÕES
CREATE POLICY "Empresa users see interacoes" ON public.crm_interacoes
  FOR SELECT USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE empresa_id = public.get_empresa_id(auth.uid()))
  );
CREATE POLICY "Admin manages interacoes" ON public.crm_interacoes
  FOR ALL USING (
    cliente_id IN (SELECT id FROM public.clientes WHERE empresa_id = public.get_empresa_id(auth.uid()))
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'administrativo'))
  );

-- FORNECEDORES
CREATE POLICY "Empresa users see fornecedores" ON public.fornecedores
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Admin manages fornecedores" ON public.fornecedores
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'administrativo')));

-- PRODUTOS
CREATE POLICY "Empresa users see produtos" ON public.produtos
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Admin manages produtos" ON public.produtos
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'administrativo')));

-- PROJETOS: admin vê tudo, arquiteto vê só vinculados, cliente vê só seus
CREATE POLICY "Admin sees all projetos" ON public.projetos
  FOR SELECT USING (
    empresa_id = public.get_empresa_id(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'administrativo')
      OR public.has_role(auth.uid(), 'financeiro')
      OR public.has_role(auth.uid(), 'tecnico')
    )
  );
CREATE POLICY "Arquiteto sees own projetos" ON public.projetos
  FOR SELECT USING (
    empresa_id = public.get_empresa_id(auth.uid())
    AND public.has_role(auth.uid(), 'arquiteto')
    AND arquiteto_id IN (
      SELECT id FROM public.fornecedores WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
CREATE POLICY "Admin manages projetos" ON public.projetos
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- PROJETO ITENS
CREATE POLICY "Users see projeto_itens" ON public.projeto_itens
  FOR SELECT USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE empresa_id = public.get_empresa_id(auth.uid()))
  );
CREATE POLICY "Admin manages projeto_itens" ON public.projeto_itens
  FOR ALL USING (
    projeto_id IN (SELECT id FROM public.projetos WHERE empresa_id = public.get_empresa_id(auth.uid()))
    AND public.has_role(auth.uid(), 'admin')
  );

-- COMPRAS
CREATE POLICY "Empresa users see compras" ON public.compras
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Admin manages compras" ON public.compras
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- ESTOQUE
CREATE POLICY "Empresa users see estoque" ON public.estoque_itens
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()));
CREATE POLICY "Admin manages estoque" ON public.estoque_itens
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- COMISSÕES: arquiteto vê apenas suas
CREATE POLICY "Admin sees all comissoes" ON public.comissoes
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "Arquiteto sees own comissoes" ON public.comissoes
  FOR SELECT USING (
    empresa_id = public.get_empresa_id(auth.uid())
    AND public.has_role(auth.uid(), 'arquiteto')
    AND fornecedor_id IN (
      SELECT id FROM public.fornecedores WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
CREATE POLICY "Admin manages comissoes" ON public.comissoes
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- FINANCEIRO PAGAR
CREATE POLICY "Finance users see pagar" ON public.financeiro_pagar
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "Admin manages pagar" ON public.financeiro_pagar
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- FINANCEIRO RECEBER
CREATE POLICY "Finance users see receber" ON public.financeiro_receber
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()) AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "Admin manages receber" ON public.financeiro_receber
  FOR ALL USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- FINANÇAS PESSOAIS: usuário vê apenas suas
CREATE POLICY "User sees own financas" ON public.financas_pessoais
  FOR SELECT USING (usuario_id = auth.uid());
CREATE POLICY "User manages own financas" ON public.financas_pessoais
  FOR ALL USING (usuario_id = auth.uid());

-- AUDIT LOGS: admin apenas
CREATE POLICY "Admin sees audit logs" ON public.audit_logs
  FOR SELECT USING (empresa_id = public.get_empresa_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System inserts audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-criar profile ao signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Atualizar updated_at genérico
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_fornecedores_updated_at BEFORE UPDATE ON public.fornecedores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projetos_updated_at BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-gerar financeiro_pagar ao criar comissão
CREATE OR REPLACE FUNCTION public.auto_gerar_conta_pagar_comissao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.financeiro_pagar (empresa_id, projeto_id, fornecedor_id, comissao_id, descricao, valor, data_vencimento, status)
  VALUES (
    NEW.empresa_id,
    NEW.projeto_id,
    NEW.fornecedor_id,
    NEW.id,
    'Comissão RT - Projeto ' || NEW.projeto_id::text,
    NEW.valor,
    NEW.data_vencimento,
    'pendente'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_comissao_created
  AFTER INSERT ON public.comissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_gerar_conta_pagar_comissao();

-- Atualizar custo_real do projeto ao registrar compra entregue
CREATE OR REPLACE FUNCTION public.atualizar_custo_real_projeto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'entregue' AND NEW.projeto_id IS NOT NULL THEN
    UPDATE public.projetos
    SET custo_real = (
      SELECT COALESCE(SUM(valor_total), 0)
      FROM public.compras
      WHERE projeto_id = NEW.projeto_id AND status = 'entregue'
    ),
    lucro_real = venda_total - (
      SELECT COALESCE(SUM(valor_total), 0)
      FROM public.compras
      WHERE projeto_id = NEW.projeto_id AND status = 'entregue'
    )
    WHERE id = NEW.projeto_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_compra_status_change
  AFTER INSERT OR UPDATE OF status ON public.compras
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_custo_real_projeto();

-- INDEXES para performance
CREATE INDEX idx_profiles_empresa ON public.profiles(empresa_id);
CREATE INDEX idx_clientes_empresa ON public.clientes(empresa_id);
CREATE INDEX idx_fornecedores_empresa ON public.fornecedores(empresa_id);
CREATE INDEX idx_produtos_empresa ON public.produtos(empresa_id);
CREATE INDEX idx_projetos_empresa ON public.projetos(empresa_id);
CREATE INDEX idx_projetos_cliente ON public.projetos(cliente_id);
CREATE INDEX idx_projetos_arquiteto ON public.projetos(arquiteto_id);
CREATE INDEX idx_projeto_itens_projeto ON public.projeto_itens(projeto_id);
CREATE INDEX idx_compras_empresa ON public.compras(empresa_id);
CREATE INDEX idx_compras_projeto ON public.compras(projeto_id);
CREATE INDEX idx_estoque_empresa ON public.estoque_itens(empresa_id);
CREATE INDEX idx_estoque_produto ON public.estoque_itens(produto_id);
CREATE INDEX idx_comissoes_empresa ON public.comissoes(empresa_id);
CREATE INDEX idx_comissoes_projeto ON public.comissoes(projeto_id);
CREATE INDEX idx_fin_pagar_empresa ON public.financeiro_pagar(empresa_id);
CREATE INDEX idx_fin_receber_empresa ON public.financeiro_receber(empresa_id);
CREATE INDEX idx_fin_pessoais_usuario ON public.financas_pessoais(usuario_id);
CREATE INDEX idx_audit_logs_empresa ON public.audit_logs(empresa_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
