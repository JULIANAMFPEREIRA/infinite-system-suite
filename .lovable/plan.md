

# Implementacao Funcional do ERP — Fase 1 (Fundacao)

## Contexto

O sistema possui banco de dados completo (16 tabelas, RLS, triggers) mas os modulos frontend ainda usam dados mock ou sao placeholders. O login nao usa autenticacao real. Esta fase transforma o sistema em funcional.

**Escopo desta fase**: Autenticacao real + Modulo de Projetos completo + Financeiro basico. Os demais modulos (portal cliente/arquiteto, cronograma visual, CRM) ficam para fases seguintes.

---

## 1. Autenticacao Real (`Login.tsx`)

- Integrar com Lovable Cloud auth (signup + login com email/senha)
- Apos login, buscar `profiles` e `user_roles` para determinar perfil
- Criar `AuthProvider` com contexto global (user, empresa_id, roles)
- Proteger rotas: redirecionar para `/login` se nao autenticado
- Auto-confirm desabilitado (padrao)
- Ao criar primeiro usuario, associar a empresa "SMP CONSULTORIA LTDA" e role `admin`

**Arquivos**: `src/contexts/AuthContext.tsx`, `src/pages/Login.tsx`, `src/App.tsx`

## 2. Modulo de Projetos Funcional (`Projetos.tsx`)

O nucleo do sistema. Substituir placeholder por modulo completo:

**Listagem**:
- Tabela com dados reais do banco (projetos + cliente + arquiteto)
- Colunas: Nome, Cliente, Arquiteto, Status, Custo Previsto, Venda, Margem, Lucro Previsto
- Filtros por status
- Botao "Novo Projeto"

**Formulario de Criacao/Edicao** (Dialog/Sheet):
- Campos: nome, descricao, cliente (select do banco), arquiteto (select de fornecedores tipo=arquiteto), datas
- Secao de itens do projeto (produto, servico, mao_de_obra) com tabela inline
- Cada item: descricao, tipo, quantidade, preco_custo, preco_venda, rt_percentual
- Calculo automatico em tempo real: custo_previsto, venda_total, margem_prevista

**Automacoes ao salvar**:
- Gerar comissoes (RT) automaticamente para itens com rt > 0
- Status inicial: `orcamento`

**Arquivos**: `src/pages/modules/Projetos.tsx`, `src/components/projetos/ProjetoForm.tsx`, `src/components/projetos/ProjetoItemsTable.tsx`, `src/hooks/useProjetos.ts`

## 3. Financeiro Basico (Pagar + Receber)

Substituir placeholders por tabelas reais conectadas ao banco:

**Contas a Pagar** (`FinanceiroPagar.tsx`):
- Listar de `financeiro_pagar` com joins (fornecedor, projeto)
- Botao "Nova Conta"
- Marcar como pago (atualizar data_pagamento + status)

**Contas a Receber** (`FinanceiroReceber.tsx`):
- Listar de `financeiro_receber` com joins (cliente, projeto)
- Botao "Nova Parcela"
- Marcar como recebido

**Arquivos**: `src/pages/modules/FinanceiroPagar.tsx`, `src/pages/modules/FinanceiroReceber.tsx`, `src/hooks/useFinanceiro.ts`

## 4. Conectar Modulos Existentes ao Banco

Substituir dados mock por queries reais nos modulos ja construidos:

- **Fornecedores**: CRUD real na tabela `fornecedores`
- **Compras**: CRUD real na tabela `compras`
- **Estoque**: Leitura real de `produtos` e `estoque_itens`
- **Financas Pessoais**: CRUD real na tabela `financas_pessoais`

Cada modulo usara hooks customizados com `useQuery`/`useMutation` do React Query.

**Arquivos**: Atualizar `Fornecedores.tsx`, `Compras.tsx`, `Estoque.tsx`, `FinancasPessoais.tsx` + criar hooks em `src/hooks/`

## 5. Hook Utilitario de Empresa

Criar `useEmpresa()` que retorna o `empresa_id` do usuario logado, necessario para todas as queries e inserts.

**Arquivo**: `src/hooks/useEmpresa.ts`

---

## Detalhes Tecnicos

- Todas as queries usam `supabase` client de `@/integrations/supabase/client`
- React Query para cache e sync (`useQuery`, `useMutation`, `invalidateQueries`)
- `empresa_id` injetado em todo INSERT (vem do profile do usuario logado)
- Calculos de margem/lucro: `margem = ((venda - custo) / venda) * 100`
- Componente `DataTable` existente sera reutilizado para listagens
- Formularios usam `Dialog` do shadcn para criacao/edicao
- Toast notifications via `sonner` para feedback

## Ordem de Execucao

1. `AuthContext` + Login funcional
2. `useEmpresa` hook
3. Modulo Projetos completo (listagem + formulario + itens + calculos)
4. Financeiro Pagar e Receber
5. Conectar Fornecedores, Compras, Estoque, Financas Pessoais ao banco

