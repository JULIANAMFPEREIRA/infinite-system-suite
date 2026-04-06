

# Ajustes UX, Fluxo e Edição — Plano de Implementação

## Resumo

Ajustes cirúrgicos em módulos existentes para melhorar UX e completar funcionalidades parciais. Nenhum módulo será recriado, apenas complementado.

## 1. Projeto — Tela Exclusiva com Abas

**Arquivo:** `src/pages/modules/Projetos.tsx`

Atualmente, clicar num projeto abre o formulário inline com a lista ainda visível abaixo. Ajuste:

- Adicionar estado `viewMode: "list" | "detail"` 
- Quando `viewMode === "detail"`: ocultar lista e filtros, exibir botão "← Voltar para lista"
- Organizar conteúdo do projeto em abas usando `Tabs` (já existe em `src/components/ui/tabs.tsx`):
  - **Resumo** — formulário de edição do projeto (campos atuais)
  - **Itens** — `ProjetoItensSection` (já existe)
  - **Visitas Técnicas** — `VisitasTecnicasSection` (mover da posição atual para aba própria)
  - **Financeiro** — listar contas a receber/pagar vinculadas ao projeto (query inline)
  - **Compras** — listar compras vinculadas ao projeto
  - **Cronograma** — etapas do projeto (placeholder funcional)
  - **Contratos** — contratos vinculados

## 2. Visitas Técnicas — Aba Própria com CRUD Completo

**Arquivo:** `src/pages/modules/Projetos.tsx` (componente `VisitasTecnicasSection`)

Já existe parcialmente. Complementar:
- Adicionar edição de visita existente (click na linha → popular form, `editId`)
- Adicionar botão excluir visita
- Adicionar campos faltantes no formulário: produtos levados (input texto/json), data_pagamento
- Hook `useUpdateVisita` já existe, apenas conectar ao form de edição

## 3. Financeiro Receber — Modal de Baixa

**Arquivo:** `src/pages/modules/FinanceiroReceber.tsx`

`FinanceiroPagar` já tem modal de baixa com data/forma/obs. `FinanceiroReceber` ainda faz baixa direta. Ajuste:
- Adicionar `Dialog` de baixa igual ao `FinanceiroPagar` (data, forma de pagamento, observação)
- Importar `useFormasPagamento` para o select de formas

## 4. Comissões — Baixa com Modal + Criar Manual

**Arquivo:** `src/pages/modules/Comissoes.tsx`

- Adicionar modal de baixa (igual ao financeiro) em vez de baixa direta
- Adicionar botão "Nova Comissão" com formulário manual (projeto, fornecedor, percentual, valor, vencimento)
- Adicionar campos data_pagamento e forma_pagamento na baixa

## 5. Parcelamento Manual no Projeto

**Arquivo:** `src/pages/modules/Projetos.tsx` (aba Financeiro)

Na aba Financeiro do projeto:
- Listar parcelas existentes de `financeiro_receber` filtradas por `projeto_id`
- Botão "Nova Parcela" com formulário: valor, vencimento, forma de pagamento
- Cada parcela editável individualmente
- Inserir diretamente em `financeiro_receber`

## 6. Itens do Projeto — Autocomplete Já Funciona

O autocomplete de produtos já está implementado e funcional (linhas 395-414 do Projetos.tsx). Também permite digitação manual quando tipo é "serviço" ou "mão de obra". **Nenhuma alteração necessária.**

## 7. CRM → Projeto — Já Funciona

A automação CRM → Projeto já está implementada (linhas 89-92 do CRM.tsx). **Nenhuma alteração necessária.** Apenas garantir que o projeto criado aparece no cronograma (já funciona via query de projetos).

## 8. Configurações — Usuários Já Funciona

Criação de usuários com roles (cliente, arquiteto, técnico) já está implementada. **Nenhuma alteração necessária.**

## Arquivos Editados

1. `src/pages/modules/Projetos.tsx` — tela exclusiva com abas, visitas CRUD completo, aba financeiro com parcelas
2. `src/pages/modules/FinanceiroReceber.tsx` — modal de baixa completo
3. `src/pages/modules/Comissoes.tsx` — modal de baixa + criar comissão manual

## Arquivos NÃO Alterados

- CRM.tsx, Configuracoes.tsx, Compras.tsx, hooks — já funcionais, sem mudanças

