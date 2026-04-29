## Objetivo
Adicionar duas colunas opcionais à tabela `financeiro_pagar` para permitir anexar arquivo (comprovante/boleto) a contas a pagar. Nenhuma alteração de código frontend nesta etapa.

## Migration SQL

```sql
ALTER TABLE public.financeiro_pagar
  ADD COLUMN arquivo_url text,
  ADD COLUMN arquivo_nome text;
```

## Detalhes técnicos
- **Tabela:** `public.financeiro_pagar`
- **Colunas adicionadas:**
  - `arquivo_url` — `TEXT`, nullable, sem default
  - `arquivo_nome` — `TEXT`, nullable, sem default
- **RLS:** não é necessário alterar — as policies existentes (`Admin manages pagar`, `Finance users see pagar`) já cobrem a tabela inteira, incluindo novas colunas.
- **Triggers / Funções:** nenhum impacto. As funções `auto_gerar_conta_pagar_compra` e `auto_sync_conta_pagar_compra` não referenciam essas colunas.
- **types.ts:** será regenerado automaticamente após a migration.

## Fora de escopo (próxima etapa)
- Upload de arquivo no formulário de contas a pagar
- Exibição do anexo na listagem/detalhe do `FinanceiroPagar.tsx`
- Bucket de storage (se necessário usar bucket dedicado em vez do `crm-files`)