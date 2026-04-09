
-- Add missing foreign key constraints to enforce referential integrity
-- Using IF NOT EXISTS pattern via DO blocks to be safe

-- audit_logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'audit_logs_empresa_id_fkey' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- categorias
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'categorias_empresa_id_fkey' AND table_name = 'categorias') THEN
    ALTER TABLE public.categorias ADD CONSTRAINT categorias_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- clientes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'clientes_empresa_id_fkey' AND table_name = 'clientes') THEN
    ALTER TABLE public.clientes ADD CONSTRAINT clientes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'clientes_arquiteto_id_fkey' AND table_name = 'clientes') THEN
    ALTER TABLE public.clientes ADD CONSTRAINT clientes_arquiteto_id_fkey FOREIGN KEY (arquiteto_id) REFERENCES public.fornecedores(id);
  END IF;
END $$;

-- comissoes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comissoes_empresa_id_fkey' AND table_name = 'comissoes') THEN
    ALTER TABLE public.comissoes ADD CONSTRAINT comissoes_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comissoes_projeto_id_fkey' AND table_name = 'comissoes') THEN
    ALTER TABLE public.comissoes ADD CONSTRAINT comissoes_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comissoes_fornecedor_id_fkey' AND table_name = 'comissoes') THEN
    ALTER TABLE public.comissoes ADD CONSTRAINT comissoes_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'comissoes_projeto_item_id_fkey' AND table_name = 'comissoes') THEN
    ALTER TABLE public.comissoes ADD CONSTRAINT comissoes_projeto_item_id_fkey FOREIGN KEY (projeto_item_id) REFERENCES public.projeto_itens(id);
  END IF;
END $$;

-- compras
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'compras_empresa_id_fkey' AND table_name = 'compras') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'compras_fornecedor_id_fkey' AND table_name = 'compras') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'compras_projeto_id_fkey' AND table_name = 'compras') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'compras_projeto_item_id_fkey' AND table_name = 'compras') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_projeto_item_id_fkey FOREIGN KEY (projeto_item_id) REFERENCES public.projeto_itens(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'compras_produto_id_fkey' AND table_name = 'compras') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
  END IF;
END $$;

-- contratos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contratos_empresa_id_fkey' AND table_name = 'contratos') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contratos_projeto_id_fkey' AND table_name = 'contratos') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'contratos_cliente_id_fkey' AND table_name = 'contratos') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
END $$;

-- crm_arquivos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_arquivos_empresa_id_fkey' AND table_name = 'crm_arquivos') THEN
    ALTER TABLE public.crm_arquivos ADD CONSTRAINT crm_arquivos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_arquivos_cliente_id_fkey' AND table_name = 'crm_arquivos') THEN
    ALTER TABLE public.crm_arquivos ADD CONSTRAINT crm_arquivos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
END $$;

-- crm_interacoes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_interacoes_cliente_id_fkey' AND table_name = 'crm_interacoes') THEN
    ALTER TABLE public.crm_interacoes ADD CONSTRAINT crm_interacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
END $$;

-- crm_itens
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_itens_empresa_id_fkey' AND table_name = 'crm_itens') THEN
    ALTER TABLE public.crm_itens ADD CONSTRAINT crm_itens_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_itens_cliente_id_fkey' AND table_name = 'crm_itens') THEN
    ALTER TABLE public.crm_itens ADD CONSTRAINT crm_itens_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_itens_orcamento_id_fkey' AND table_name = 'crm_itens') THEN
    ALTER TABLE public.crm_itens ADD CONSTRAINT crm_itens_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.crm_orcamentos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_itens_produto_id_fkey' AND table_name = 'crm_itens') THEN
    ALTER TABLE public.crm_itens ADD CONSTRAINT crm_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
  END IF;
END $$;

-- crm_orcamentos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_orcamentos_empresa_id_fkey' AND table_name = 'crm_orcamentos') THEN
    ALTER TABLE public.crm_orcamentos ADD CONSTRAINT crm_orcamentos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'crm_orcamentos_cliente_id_fkey' AND table_name = 'crm_orcamentos') THEN
    ALTER TABLE public.crm_orcamentos ADD CONSTRAINT crm_orcamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
END $$;

-- equipe
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'equipe_empresa_id_fkey' AND table_name = 'equipe') THEN
    ALTER TABLE public.equipe ADD CONSTRAINT equipe_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- estoque_itens
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'estoque_itens_empresa_id_fkey' AND table_name = 'estoque_itens') THEN
    ALTER TABLE public.estoque_itens ADD CONSTRAINT estoque_itens_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'estoque_itens_produto_id_fkey' AND table_name = 'estoque_itens') THEN
    ALTER TABLE public.estoque_itens ADD CONSTRAINT estoque_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'estoque_itens_compra_id_fkey' AND table_name = 'estoque_itens') THEN
    ALTER TABLE public.estoque_itens ADD CONSTRAINT estoque_itens_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'estoque_itens_projeto_id_fkey' AND table_name = 'estoque_itens') THEN
    ALTER TABLE public.estoque_itens ADD CONSTRAINT estoque_itens_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
END $$;

-- financas_pessoais
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financas_pessoais_empresa_id_fkey' AND table_name = 'financas_pessoais') THEN
    ALTER TABLE public.financas_pessoais ADD CONSTRAINT financas_pessoais_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- financeiro_pagar
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_pagar_empresa_id_fkey' AND table_name = 'financeiro_pagar') THEN
    ALTER TABLE public.financeiro_pagar ADD CONSTRAINT financeiro_pagar_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_pagar_projeto_id_fkey' AND table_name = 'financeiro_pagar') THEN
    ALTER TABLE public.financeiro_pagar ADD CONSTRAINT financeiro_pagar_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_pagar_fornecedor_id_fkey' AND table_name = 'financeiro_pagar') THEN
    ALTER TABLE public.financeiro_pagar ADD CONSTRAINT financeiro_pagar_fornecedor_id_fkey FOREIGN KEY (fornecedor_id) REFERENCES public.fornecedores(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_pagar_comissao_id_fkey' AND table_name = 'financeiro_pagar') THEN
    ALTER TABLE public.financeiro_pagar ADD CONSTRAINT financeiro_pagar_comissao_id_fkey FOREIGN KEY (comissao_id) REFERENCES public.comissoes(id);
  END IF;
END $$;

-- financeiro_receber
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_receber_empresa_id_fkey' AND table_name = 'financeiro_receber') THEN
    ALTER TABLE public.financeiro_receber ADD CONSTRAINT financeiro_receber_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_receber_projeto_id_fkey' AND table_name = 'financeiro_receber') THEN
    ALTER TABLE public.financeiro_receber ADD CONSTRAINT financeiro_receber_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'financeiro_receber_cliente_id_fkey' AND table_name = 'financeiro_receber') THEN
    ALTER TABLE public.financeiro_receber ADD CONSTRAINT financeiro_receber_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
END $$;

-- formas_pagamento
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'formas_pagamento_empresa_id_fkey' AND table_name = 'formas_pagamento') THEN
    ALTER TABLE public.formas_pagamento ADD CONSTRAINT formas_pagamento_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- fornecedores
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fornecedores_empresa_id_fkey' AND table_name = 'fornecedores') THEN
    ALTER TABLE public.fornecedores ADD CONSTRAINT fornecedores_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- necessidades_compra
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'necessidades_compra_empresa_id_fkey' AND table_name = 'necessidades_compra') THEN
    ALTER TABLE public.necessidades_compra ADD CONSTRAINT necessidades_compra_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'necessidades_compra_projeto_id_fkey' AND table_name = 'necessidades_compra') THEN
    ALTER TABLE public.necessidades_compra ADD CONSTRAINT necessidades_compra_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'necessidades_compra_projeto_item_id_fkey' AND table_name = 'necessidades_compra') THEN
    ALTER TABLE public.necessidades_compra ADD CONSTRAINT necessidades_compra_projeto_item_id_fkey FOREIGN KEY (projeto_item_id) REFERENCES public.projeto_itens(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'necessidades_compra_produto_id_fkey' AND table_name = 'necessidades_compra') THEN
    ALTER TABLE public.necessidades_compra ADD CONSTRAINT necessidades_compra_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'necessidades_compra_compra_id_fkey' AND table_name = 'necessidades_compra') THEN
    ALTER TABLE public.necessidades_compra ADD CONSTRAINT necessidades_compra_compra_id_fkey FOREIGN KEY (compra_id) REFERENCES public.compras(id);
  END IF;
END $$;

-- produtos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'produtos_empresa_id_fkey' AND table_name = 'produtos') THEN
    ALTER TABLE public.produtos ADD CONSTRAINT produtos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'profiles_empresa_id_fkey' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- projeto_itens
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projeto_itens_projeto_id_fkey' AND table_name = 'projeto_itens') THEN
    ALTER TABLE public.projeto_itens ADD CONSTRAINT projeto_itens_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projeto_itens_produto_id_fkey' AND table_name = 'projeto_itens') THEN
    ALTER TABLE public.projeto_itens ADD CONSTRAINT projeto_itens_produto_id_fkey FOREIGN KEY (produto_id) REFERENCES public.produtos(id);
  END IF;
END $$;

-- projetos
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projetos_empresa_id_fkey' AND table_name = 'projetos') THEN
    ALTER TABLE public.projetos ADD CONSTRAINT projetos_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projetos_cliente_id_fkey' AND table_name = 'projetos') THEN
    ALTER TABLE public.projetos ADD CONSTRAINT projetos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projetos_arquiteto_id_fkey' AND table_name = 'projetos') THEN
    ALTER TABLE public.projetos ADD CONSTRAINT projetos_arquiteto_id_fkey FOREIGN KEY (arquiteto_id) REFERENCES public.fornecedores(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'projetos_orcamento_id_fkey' AND table_name = 'projetos') THEN
    ALTER TABLE public.projetos ADD CONSTRAINT projetos_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES public.crm_orcamentos(id);
  END IF;
END $$;

-- user_roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'user_roles_empresa_id_fkey' AND table_name = 'user_roles') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
END $$;

-- visitas_tecnicas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'visitas_tecnicas_empresa_id_fkey' AND table_name = 'visitas_tecnicas') THEN
    ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'visitas_tecnicas_projeto_id_fkey' AND table_name = 'visitas_tecnicas') THEN
    ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_projeto_id_fkey FOREIGN KEY (projeto_id) REFERENCES public.projetos(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'visitas_tecnicas_tecnico_id_fkey' AND table_name = 'visitas_tecnicas') THEN
    ALTER TABLE public.visitas_tecnicas ADD CONSTRAINT visitas_tecnicas_tecnico_id_fkey FOREIGN KEY (tecnico_id) REFERENCES public.fornecedores(id);
  END IF;
END $$;

-- Add indexes for performance on foreign key columns that may not have them
CREATE INDEX IF NOT EXISTS idx_comissoes_projeto_id ON public.comissoes(projeto_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_fornecedor_id ON public.comissoes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_compras_projeto_id ON public.compras(projeto_id);
CREATE INDEX IF NOT EXISTS idx_compras_fornecedor_id ON public.compras(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contratos_projeto_id ON public.contratos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON public.contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_crm_arquivos_cliente_id ON public.crm_arquivos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_crm_interacoes_cliente_id ON public.crm_interacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_crm_itens_orcamento_id ON public.crm_itens(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_crm_itens_cliente_id ON public.crm_itens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_crm_orcamentos_cliente_id ON public.crm_orcamentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_estoque_itens_produto_id ON public.estoque_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_pagar_projeto_id ON public.financeiro_pagar(projeto_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_projeto_id ON public.financeiro_receber(projeto_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_receber_cliente_id ON public.financeiro_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_necessidades_compra_projeto_id ON public.necessidades_compra(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_itens_projeto_id ON public.projeto_itens(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projetos_cliente_id ON public.projetos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_projetos_empresa_id ON public.projetos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_visitas_tecnicas_projeto_id ON public.visitas_tecnicas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
