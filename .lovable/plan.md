

# Corrigir Dados Nao Aparecendo — Substituir Placeholders por Modulos Funcionais

## Diagnostico

- **Dados existem no banco** e estao vinculados corretamente a empresa `a0000000-...0001`
- **Admin esta vinculado** corretamente (empresa_id + role admin confirmados)
- **RLS esta OK** — as policies usam `get_empresa_id(auth.uid())` e o admin tem acesso via `has_role`
- **Modulos funcionais** (Projetos, Compras, Estoque, Fornecedores, FinanceiroPagar, FinancasPessoais) ja consultam dados reais
- **Problema real**: 2 modulos com dados no banco ainda sao placeholders: **FinanceiroReceber** e **Comissoes**

## Alteracoes

### 1. FinanceiroReceber — Substituir placeholder (`src/pages/modules/FinanceiroReceber.tsx`)
Criar tela funcional similar a FinanceiroPagar:
- Usar `useFinanceiroReceber` e `useCreateContaReceber` (hooks ja existem)
- Tabela: Descricao, Cliente, Projeto, Parcela, Valor, Vencimento, Status, Acoes
- Botao "Marcar como Recebido" usando `useUpdateContaReceber`
- Botao "Nova Parcela" com form inline

### 2. Comissoes — Substituir placeholder (`src/pages/modules/Comissoes.tsx`)
Criar tela funcional:
- Query `comissoes` com joins em `fornecedores(nome)` e `projetos(nome)`
- Tabela: Arquiteto, Projeto, Percentual, Valor, Vencimento, Status
- Somente leitura (comissoes sao geradas automaticamente)

### 3. Hooks adicionais (`src/hooks/useFinanceiro.ts`)
- Adicionar `useComissoes()` hook

## Arquivos
1. `src/pages/modules/FinanceiroReceber.tsx` — reescrever
2. `src/pages/modules/Comissoes.tsx` — reescrever
3. `src/hooks/useFinanceiro.ts` — adicionar hook de comissoes

