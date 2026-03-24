

# Tornar Todos os Modulos Interativos e Editaveis

## Diagnostico

Modulos que ja tem CRUD parcial (criar + listar): Projetos, Fornecedores, Compras, FinanceiroPagar, FinanceiroReceber, FinancasPessoais.

**O que falta em cada modulo:**

| Modulo | Editar | Excluir | Status Change | Click Row |
|--------|--------|---------|---------------|-----------|
| Projetos | SIM | NAO | NAO | Via botao |
| CRM/Clientes | NAO | NAO | NAO | NAO |
| Fornecedores | NAO | NAO | — | NAO |
| Compras | NAO | NAO | NAO (critico) | NAO |
| Estoque | NAO | NAO | NAO | NAO |
| FinanceiroPagar | NAO | NAO | Pagar only | NAO |
| FinanceiroReceber | NAO | NAO | Receber only | NAO |
| FinancasPessoais | NAO | NAO | — | NAO |

## Alteracoes por Modulo

### 1. Compras (`Compras.tsx`) — PRIORIDADE
- Linhas clicaveis: ao clicar, abrir formulario de edicao inline
- Adicionar coluna Acoes com botoes Editar + status transitions
- **Status workflow**: pendente → aprovada → entregue (select dropdown na linha)
- Ao mudar para "entregue": inserir `estoque_itens` automaticamente (1 item por unidade ou 1 item com dados)
- Atualizar `custo_real` do projeto vinculado (trigger ja existe no banco)
- Adicionar selects de Fornecedor e Projeto no formulario de criacao

### 2. Fornecedores (`Fornecedores.tsx`)
- Linhas clicaveis: ao clicar, popular formulario com dados para edicao
- Adicionar mutation de update (supabase update by id)
- Adicionar botao excluir com confirmacao
- Reuso do formulario existente para criar/editar

### 3. CRM/Clientes (`CRM.tsx`)
- Linhas clicaveis para edicao
- Adicionar mutation de update (nome, email, telefone, status_crm, origem)
- Status editavel inline (select na linha ou no formulario)
- Botao excluir com confirmacao

### 4. Estoque (`Estoque.tsx`)
- **Catalogo**: adicionar CRUD completo para produtos (criar, editar, excluir)
- Formulario de novo produto com todos os campos
- Linhas clicaveis para edicao
- **Estoque Fisico**: permitir editar status (disponivel/reservado/instalado) e localizacao
- Adicionar botao para criar item de estoque manualmente

### 5. FinanceiroPagar (`FinanceiroPagar.tsx`)
- Linhas clicaveis para edicao (descricao, valor, vencimento)
- Adicionar botao excluir
- Formulario expandido com fornecedor_id e projeto_id (selects)

### 6. FinanceiroReceber (`FinanceiroReceber.tsx`)
- Linhas clicaveis para edicao
- Adicionar botao excluir
- Formulario expandido com cliente_id e projeto_id (selects)

### 7. FinancasPessoais (`FinancasPessoais.tsx`)
- Linhas clicaveis para edicao
- Adicionar mutation de update e delete
- Botao excluir por linha

### 8. Projetos (`Projetos.tsx`)
- Adicionar mudanca de status (select dropdown na coluna status)
- Adicionar botao excluir projeto (com confirmacao)

## Padrao de Implementacao (mesmo para todos)

Cada modulo seguira o mesmo padrao:
1. Estado `editId` para controlar edicao
2. Ao clicar na linha: popular formulario existente com dados e setar `editId`
3. Botao Salvar: se `editId` → update, senao → insert
4. Coluna Acoes: icones Pencil (editar) + Trash2 (excluir)
5. Confirmacao antes de excluir (window.confirm)
6. Toast de feedback em todas as operacoes

## Automacao Compras → Estoque
No modulo Compras, ao alterar status para "entregue":
```
supabase.from("estoque_itens").insert({
  empresa_id, produto_id, compra_id, status: "disponivel",
  localizacao: "Deposito"
})
```
O trigger `atualizar_custo_real_projeto` ja existe no banco e atualizara o projeto automaticamente.

## Arquivos Afetados
1. `src/pages/modules/Compras.tsx` — CRUD + status workflow + estoque auto
2. `src/pages/modules/Fornecedores.tsx` — editar + excluir
3. `src/pages/modules/CRM.tsx` — editar + excluir + status
4. `src/pages/modules/Estoque.tsx` — CRUD produtos + editar status estoque
5. `src/pages/modules/FinanceiroPagar.tsx` — editar + excluir
6. `src/pages/modules/FinanceiroReceber.tsx` — editar + excluir
7. `src/pages/modules/FinancasPessoais.tsx` — editar + excluir
8. `src/pages/modules/Projetos.tsx` — status change + excluir

