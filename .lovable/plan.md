

# Fase 2 + Fase 3 — Gestao, Portais e Relatorios

## FASE 2 — Gestao e Configuracoes

### 2.1 Gestao de Usuarios (Edge Function + Configuracoes)
- Criar edge function `create-user` que usa service role key para criar usuario via `auth.admin.createUser`, inserir profile com empresa_id, e atribuir role em `user_roles`
- Expandir `Configuracoes.tsx` com secao "Criar Usuario": formulario com nome, email, senha, role (select: admin/administrativo/financeiro/tecnico/arquiteto/cliente)
- Exibir lista de usuarios com suas roles (ja existe parcialmente)
- Adicionar botao para remover role

### 2.2 Contratos Integrados
- Criar tabela `contratos` via migration: id, empresa_id, projeto_id, cliente_id, status (rascunho/enviado/assinado/cancelado), descricao, valor, data_envio, data_assinatura, created_at
- RLS: admin manages, empresa users see
- Reescrever `Contratos.tsx` com CRUD real: criar contrato vinculado a projeto/cliente, alterar status, exibir na listagem
- No CRM, exibir contratos vinculados ao cliente

### 2.3 CRM Completo
- Expandir `CRM.tsx` com secao de detalhes ao clicar no cliente: exibir projeto vinculado, contrato vinculado, historico de interacoes
- Adicionar formulario para registrar interacoes (crm_interacoes): tipo, descricao
- Exibir responsaveis do projeto vinculado

### 2.4 Fluxo de Caixa Manual
- Expandir `FluxoCaixa.tsx` com botao "Novo Lancamento Manual"
- Inserir como financeiro_receber (receita) ou financeiro_pagar (despesa) com flag ou descricao "lancamento manual"

## FASE 3 — Portais e Relatorios

### 3.1 Portal do Cliente
- Nova rota `/portal/cliente` (protegida por role `cliente`)
- Pagina que mostra projetos vinculados ao cliente (via email do JWT → clientes.email → projetos.cliente_id)
- Exibir: nome do projeto, status, cronograma/progresso, etapas
- **Sem valores financeiros** — ocultar custo, venda, margem

### 3.2 Portal do Arquiteto
- Nova rota `/portal/arquiteto` (protegida por role `arquiteto`)
- Exibir projetos onde o arquiteto esta vinculado (fornecedores.email = JWT email)
- Listar comissoes (RT) do arquiteto com status de pagamento
- Sem acesso a outros modulos

### 3.3 Relatorios com PDF
- Adicionar botao "Exportar PDF" em `Relatorios.tsx`
- Usar `jspdf` + `jspdf-autotable` para gerar PDF com ranking de projetos, receita vs despesa
- Adicionar botao "Exportar CSV" para estrutura Excel

### 3.4 Alertas e Notificacoes
- Expandir `Automacoes.tsx` com alertas reais baseados em queries:
  - Contas vencidas (data_vencimento < hoje e status pendente)
  - Custo real > custo previsto em projetos
  - Compras pendentes ha mais de 7 dias
- Adicionar badge de notificacao no TopBar com contagem de alertas
- Criar dropdown de notificacoes no TopBar

### 3.5 Dashboard Alertas Visuais
- Adicionar secao "Alertas" no Dashboard com cards vermelhos para:
  - Contas vencidas
  - Projetos com custo excedido
  - Compras pendentes

## Detalhes Tecnicos

**Migration:**
- CREATE TABLE contratos (id, empresa_id, projeto_id, cliente_id, status, descricao, valor, data_envio, data_assinatura, created_at)
- RLS policies para contratos

**Edge Function:**
- `supabase/functions/create-user/index.ts` — cria usuario, profile, e role

**Pacotes:**
- Instalar `jspdf` e `jspdf-autotable` para exportacao PDF

**Arquivos novos:**
- `supabase/functions/create-user/index.ts`
- `src/pages/portal/PortalCliente.tsx`
- `src/pages/portal/PortalArquiteto.tsx`
- `src/hooks/useContratos.ts`

**Arquivos editados:**
- `src/App.tsx` — novas rotas portal + role-based redirect
- `src/pages/modules/Configuracoes.tsx` — secao criar usuario
- `src/pages/modules/Contratos.tsx` — CRUD real
- `src/pages/modules/CRM.tsx` — detalhes cliente + interacoes + contrato
- `src/pages/modules/FluxoCaixa.tsx` — lancamentos manuais
- `src/pages/modules/Relatorios.tsx` — exportacao PDF/CSV
- `src/pages/modules/Automacoes.tsx` — alertas reais
- `src/pages/Dashboard.tsx` — secao alertas visuais
- `src/components/layout/TopBar.tsx` — dropdown notificacoes com badge

**Ordem de execucao:**
1. Migration (tabela contratos)
2. Edge function create-user
3. Configuracoes — gestao de usuarios
4. Contratos CRUD
5. CRM completo (detalhes + interacoes)
6. Fluxo de Caixa manual
7. Portal do Cliente
8. Portal do Arquiteto
9. Relatorios PDF/CSV
10. Alertas e notificacoes (Automacoes + TopBar + Dashboard)

