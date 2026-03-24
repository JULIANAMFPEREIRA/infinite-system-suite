

# Evolucao INFINIT SYSTEM — Plano Completo em 3 Fases

Este plano cobre todos os 21 pontos solicitados, divididos em fases para garantir estabilidade.

---

## FASE 1 — Nucleo (esta implementacao)

### 1.1 Migracao de Banco de Dados

Novas tabelas e alteracoes necessarias:

**Nova tabela `visitas_tecnicas`:**
- id, empresa_id, projeto_id, tecnico_id (FK fornecedores), data, descricao, produtos_levados (jsonb), servicos_executados (text), valor_pago_tecnico (numeric), status_pagamento (pendente/pago), data_pagamento, created_at
- RLS: admin manages, empresa users see

**Nova tabela `formas_pagamento`:**
- id, empresa_id, nome, ativo (boolean), created_at

**Nova tabela `categorias`:**
- id, empresa_id, nome, tipo (produto/servico), created_at

**Alterar `projetos`:**
- Adicionar: endereco_obra (text), forma_pagamento (text), observacoes_pagamento (text), numero_parcelas (int default 1)

**Alterar `clientes`:**
- Adicionar: endereco_obra (text)

**Alterar `status_projeto` enum:**
- Adicionar valores: `lead`, `proposta`, `vendido`, `pos_venda`
- Fluxo final: lead → proposta → orcamento → aprovado → em_andamento → concluido → pos_venda → cancelado

**Alterar `comissoes`:**
- Tornar editavel: permitir UPDATE pelo admin (policy ja existe)

### 1.2 CRM → Projeto Automatico

No `CRM.tsx`, ao alterar `status_crm` para "projeto":
- Criar projeto automaticamente via `useCreateProjeto`
- Vincular cliente_id, copiar endereco e endereco_obra do cliente
- Toast: "Projeto criado automaticamente a partir do CRM"
- Status inicial do projeto: `proposta`

### 1.3 Projeto Completo

Expandir formulario em `Projetos.tsx`:
- Campos novos: endereco_obra, forma_pagamento (select de formas cadastradas), numero_parcelas, observacoes
- Responsaveis: arquiteto (ja existe), adicionar campos para engenheiro_id, designer_id (selects de fornecedores)
- Autocomplete de produtos: ao digitar no campo descricao de item tipo "produto", buscar produtos cadastrados e preencher custo/venda automaticamente
- Comissao por item: campo rt_percentual ja existe em projeto_itens, tornar visivel e editavel

### 1.4 Automacoes ao Criar/Aprovar Projeto

Ao salvar projeto com itens:
- Gerar necessidades de compra para itens tipo produto (ja existe parcialmente)
- Ao mudar status para "aprovado": gerar automaticamente contas a receber (parcelas conforme numero_parcelas) e comissoes RT

Entrada nao obrigatoria — financeiro gerado ao aprovar, nao ao receber entrada.

### 1.5 Visitas Tecnicas

Criar submodulo dentro do projeto (similar a ProjetoItensSection):
- Listar visitas vinculadas ao projeto
- Formulario: tecnico (select fornecedores), data, descricao, produtos levados (multi-select do estoque), servicos executados, valor pago ao tecnico, status pagamento
- Ao registrar visita com produtos: dar baixa no estoque (status → "instalado")
- Ao registrar valor pago: gerar conta a pagar automaticamente

### 1.6 Estoque — Baixa na Instalacao

Alterar logica: estoque nao baixa na compra (ja correto). Baixa ocorre apenas via visitas tecnicas (item 1.5) ao marcar produtos como instalados.

### 1.7 Comissoes Editaveis

Em `Comissoes.tsx`:
- Permitir editar percentual e valor
- Adicionar botao "Dar baixa" (marcar como pago + data_pagamento)
- Atualizar conta a pagar vinculada automaticamente

### 1.8 Financeiro — Baixa Completa

Expandir `FinanceiroPagar.tsx` e `FinanceiroReceber.tsx`:
- Ao dar baixa: modal com campos data_pagamento, forma_pagamento (select), observacao
- Em vez de apenas setar "pago" com data de hoje

### 1.9 Dashboard com Dados Reais

Substituir dados mock no `Dashboard.tsx`:
- Queries reais: total receita (financeiro_receber pago), projetos ativos (em_andamento), leads (clientes com status lead), compras pendentes
- Graficos com dados reais dos ultimos 6 meses
- Atividade recente: ultimos audit_logs

---

## FASE 2 — Gestao e Configuracoes (proxima iteracao)

### 2.1 Configuracoes Avancadas
- CRUD de categorias, formas de pagamento, servicos
- Gestao de usuarios: criar usuario (via edge function), atribuir role, vincular a empresa
- Templates de projeto

### 2.2 Usuarios e Acessos
- Edge function para criar usuarios com roles especificos (cliente, arquiteto, parceiro, funcionario)
- Tela em Configuracoes para gerenciar
- Vincular cada usuario ao seu tipo

### 2.3 Contratos Integrados
- Vincular contrato ao projeto e cliente
- Status do contrato (rascunho, enviado, assinado)
- Exibir no CRM

### 2.4 CRM Completo
- Visualizacao completa do cliente (projeto vinculado, contrato, endereco obra, responsaveis)
- Historico de interacoes

### 2.5 Fluxo de Caixa Manual
- Permitir lancamentos manuais alem dos automaticos

---

## FASE 3 — Portais e Relatorios (iteracao seguinte)

### 3.1 Portal do Cliente
- Rota separada `/portal/cliente`
- Ver projeto, cronograma, progresso, fotos
- Sem valores financeiros

### 3.2 Portal do Arquiteto
- Ver projetos vinculados, comissoes, status pagamento

### 3.3 Relatorios com PDF
- Exportacao usando reportlab ou html-to-pdf
- Estrutura para Excel

### 3.4 Notificacoes
- Alertas de vencimento, custo excedido, compras pendentes
- Sistema de notificacoes internas

### 3.5 Alertas Visuais
- No dashboard: contas vencidas, custo > previsto, compras pendentes

---

## Detalhes Tecnicos (Fase 1)

**Migrations:**
1. ALTER TABLE projetos ADD COLUMN endereco_obra text, forma_pagamento text, observacoes_pagamento text, numero_parcelas int DEFAULT 1
2. ALTER TABLE clientes ADD COLUMN endereco_obra text
3. CREATE TABLE visitas_tecnicas (...)
4. CREATE TABLE formas_pagamento (...)
5. CREATE TABLE categorias (...)
6. Adicionar novos valores ao enum status_projeto (lead, proposta, vendido, pos_venda)
7. RLS policies para novas tabelas

**Arquivos novos:**
- `src/hooks/useVisitasTecnicas.ts`
- `src/hooks/useCategorias.ts`

**Arquivos editados:**
- `src/pages/modules/Projetos.tsx` — formulario expandido + autocomplete + visitas + automacoes
- `src/pages/modules/CRM.tsx` — auto-criar projeto ao mudar status
- `src/pages/modules/Comissoes.tsx` — edicao + baixa
- `src/pages/modules/FinanceiroPagar.tsx` — modal de baixa completa
- `src/pages/modules/FinanceiroReceber.tsx` — modal de baixa completa
- `src/pages/modules/Cronograma.tsx` — usar novos status
- `src/pages/Dashboard.tsx` — dados reais
- `src/pages/modules/Configuracoes.tsx` — CRUD categorias e formas de pagamento

**Ordem de execucao:**
1. Migracao de banco (todas as alteracoes)
2. Hooks novos (visitas, categorias)
3. CRM → Projeto automatico
4. Projeto expandido (formulario + autocomplete + visitas)
5. Automacoes (financeiro ao aprovar + comissoes)
6. Comissoes editaveis + baixa
7. Financeiro com modal de baixa
8. Dashboard com dados reais
9. Configuracoes basicas

