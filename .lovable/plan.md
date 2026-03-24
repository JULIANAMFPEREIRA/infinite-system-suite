

# Ativação do Lovable Cloud — Banco de Dados ERP Completo

## Resumo

Ativar o Lovable Cloud e criar toda a estrutura de banco de dados relacional com o módulo de **Projetos como núcleo central**, incluindo enums, tabelas, RLS, funções de segurança, triggers e logs de auditoria. Estrutura preparada para SaaS multiempresa.

---

## Arquitetura do Banco

```text
                        ┌──────────┐
                        │ empresas │  (SaaS multiempresa)
                        └────┬─────┘
                             │
       ┌─────────────────────┼─────────────────────┐
       │                     │                     │
  ┌────┴────┐          ┌─────┴─────┐         ┌────┴────┐
  │ profiles│          │  clientes │         │fornece- │
  │ + roles │          │           │         │ dores   │
  └────┬────┘          └─────┬─────┘         └────┬────┘
       │                     │                     │
       │              ┌──────┴──────┐              │
       └──────────────┤  PROJETOS   ├──────────────┘
                      │  (núcleo)   │
                      └──────┬──────┘
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────┴──────┐   ┌──────┴──────┐   ┌──────┴──────┐
    │projeto_itens│   │ comissoes   │   │ financeiro  │
    │(prod+serv)  │   │   (RT)      │   │ pagar/receb │
    └──────┬──────┘   └─────────────┘   └─────────────┘
           │
    ┌──────┴──────┐
    │  compras    │──→ estoque_itens (por série)
    └─────────────┘
                      ┌─────────────┐
                      │fin_pessoais │ (isolado)
                      └─────────────┘
                      ┌─────────────┐
                      │ audit_logs  │
                      └─────────────┘
```

---

## Tabelas e Estrutura

### 1. Infraestrutura SaaS
- **`empresas`** — id, nome, nome_fantasia, cnpj, segmento, created_at
- **`profiles`** — id (FK auth.users), empresa_id (FK), full_name, phone, avatar_url
- **`user_roles`** — user_id (FK), role (enum: admin, administrativo, financeiro, tecnico, arquiteto, cliente), empresa_id

### 2. CRM e Clientes
- **`clientes`** — id, empresa_id, nome, email, telefone, cpf_cnpj, endereco, origem (enum: whatsapp, instagram, indicacao, outro), status_crm (enum: lead, contato, proposta, projeto), notas, created_at
- **`crm_interacoes`** — id, cliente_id, usuario_id, tipo, descricao, created_at

### 3. Fornecedores e Parceiros
- **`fornecedores`** — id, empresa_id, nome, tipo (enum: fornecedor, arquiteto), cnpj_cpf, telefone, email, rt_percentual, cidade, created_at

### 4. Produtos (Catálogo)
- **`produtos`** — id, empresa_id, codigo, nome, categoria, marca, unidade, preco_custo, preco_venda, estoque_minimo, created_at

### 5. PROJETOS (Núcleo)
- **`projetos`** — id, empresa_id, cliente_id (FK), arquiteto_id (FK fornecedores), nome, descricao, status (enum: orcamento, aprovado, em_andamento, concluido, cancelado), custo_previsto, venda_total, margem_prevista, custo_real, lucro_real, entrada_recebida (bool), data_inicio, data_previsao, created_at
- **`projeto_itens`** — id, projeto_id (FK), produto_id (FK nullable), descricao, tipo (enum: produto, servico, mao_de_obra), quantidade, preco_custo, preco_venda, rt_percentual, created_at

### 6. Compras (vinculadas a projeto)
- **`compras`** — id, empresa_id, fornecedor_id (FK), projeto_id (FK nullable), projeto_item_id (FK nullable), produto_id (FK nullable), descricao, quantidade, valor_unitario, valor_total, status (enum: pendente, aprovada, entregue, cancelada), data_compra, created_at

### 7. Estoque Físico (por série, baixa só na instalação)
- **`estoque_itens`** — id, empresa_id, produto_id (FK), compra_id (FK nullable), numero_serie, localizacao, status (enum: disponivel, reservado, instalado), projeto_id (FK nullable), created_at

### 8. Comissões RT
- **`comissoes`** — id, empresa_id, projeto_id (FK), fornecedor_id (FK, tipo=arquiteto), projeto_item_id (FK nullable), percentual, valor, status (enum: pendente, pago), data_vencimento, created_at
- Ao criar comissão, auto-gerar registro em `financeiro_pagar`

### 9. Financeiro Empresa
- **`financeiro_pagar`** — id, empresa_id, projeto_id (FK nullable), fornecedor_id (FK nullable), comissao_id (FK nullable), descricao, valor, data_vencimento, data_pagamento, status (enum: pendente, pago, vencido, cancelado)
- **`financeiro_receber`** — id, empresa_id, projeto_id (FK nullable), cliente_id (FK nullable), descricao, valor, parcela, data_vencimento, data_pagamento, status

### 10. Finanças Pessoais (Isolado)
- **`financas_pessoais`** — id, empresa_id, usuario_id (FK), descricao, categoria, valor, tipo (enum: retirada, devolucao, despesa, receita), data, created_at

### 11. Auditoria
- **`audit_logs`** — id, empresa_id, usuario_id, tabela, registro_id, acao (enum: criacao, edicao, exclusao), dados_anteriores (jsonb), dados_novos (jsonb), created_at

---

## Segurança (RLS)

1. **Enum `app_role`**: admin, administrativo, financeiro, tecnico, arquiteto, cliente
2. **Função `has_role()`**: security definer, sem recursão
3. **Função `get_empresa_id()`**: retorna empresa_id do usuário logado (security definer)
4. **Políticas por tabela**:
   - Todas filtram por `empresa_id = get_empresa_id(auth.uid())`
   - Admin: acesso total dentro da empresa
   - Cliente: SELECT em `projetos` e `projeto_itens` onde `cliente_id` é dele, sem colunas financeiras (controlado no frontend)
   - Arquiteto: SELECT em `projetos` vinculados a ele + `comissoes` próprias
   - Financeiro: acesso a tabelas financeiras da empresa

---

## Triggers

1. **Auto-criar profile** ao signup (trigger on auth.users)
2. **Atualizar `custo_real`** do projeto ao inserir compra com status=entregue
3. **Auto-gerar `financeiro_pagar`** ao criar comissão

---

## Ordem de Execução

1. Ativar Lovable Cloud
2. Criar migração com enums
3. Criar migração com tabelas (empresas → profiles → clientes → fornecedores → produtos → projetos → projeto_itens → compras → estoque → comissoes → financeiro → fin_pessoais → audit_logs → user_roles)
4. Criar migração com funções (has_role, get_empresa_id) + RLS policies
5. Criar migração com triggers
6. Inserir empresa padrão "SMP CONSULTORIA LTDA" e dados iniciais

