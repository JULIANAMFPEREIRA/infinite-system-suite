

# Automacao Projetos-Estoque-Compras

## Resumo
Criar tabela `necessidades_compra` no banco, automacao no `ProjetoItensSection` para gerar necessidades ao adicionar itens tipo "produto", nova tela "Itens a Comprar" com acao de converter em compra real, e alerta visual nos projetos.

## 1. Migracao: tabela `necessidades_compra`

```sql
CREATE TABLE public.necessidades_compra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  projeto_id uuid NOT NULL,
  projeto_item_id uuid,
  produto_id uuid,
  descricao text,
  quantidade numeric DEFAULT 1,
  status text DEFAULT 'pendente', -- pendente | comprado
  compra_id uuid, -- referencia a compra gerada
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.necessidades_compra ENABLE ROW LEVEL SECURITY;
-- RLS: admin manages, empresa users see
```

## 2. Hook `useNecessidadesCompra` (`src/hooks/useNecessidadesCompra.ts`)
- `useNecessidadesCompra()`: lista necessidades pendentes com joins (projeto, produto)
- `useCreateNecessidade()`: insere necessidade
- `useConverterEmCompra()`: cria registro em `compras`, atualiza `necessidades_compra.status = 'comprado'` e vincula `compra_id`

## 3. Automacao em `Projetos.tsx` > `ProjetoItensSection`
No `handleAddItem`, apos criar o item com `tipo === 'produto'`:
- Verificar estoque disponivel: `SELECT count(*) FROM estoque_itens WHERE produto_id = X AND status = 'disponivel'`
- Se estoque insuficiente: chamar `useCreateNecessidade` automaticamente com dados do item
- Exibir toast: "Necessidade de compra gerada automaticamente"

## 4. Nova tela "Itens a Comprar" (`src/pages/modules/ItensComprar.tsx`)
- Tabela com colunas: Produto, Qtd Necessaria, Projeto, Status (pendente/comprado), Acoes
- Botao "Converter em Compra" por linha: cria compra vinculada ao projeto e atualiza status
- Filtro por status (pendente/comprado)

## 5. Rota e Sidebar
- `App.tsx`: adicionar rota `/itens-comprar` com `ItensComprar`
- `AppSidebar.tsx`: adicionar item "Itens a Comprar" com icone `ClipboardList` entre Compras e Fornecedores

## 6. Alerta visual em Projetos
Na tabela de projetos, adicionar coluna "Pendencias":
- Query count de `necessidades_compra` onde `status = 'pendente'` por projeto
- Exibir badge vermelho com numero de itens pendentes
- Clicar no badge navega para `/itens-comprar?projeto=ID`

## Ordem de Execucao
1. Migracao da tabela
2. Hook `useNecessidadesCompra`
3. Atualizar `ProjetoItensSection` com verificacao automatica
4. Criar pagina `ItensComprar.tsx`
5. Adicionar rota e sidebar
6. Adicionar alertas visuais na listagem de projetos

