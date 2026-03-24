

# Criar Usuario Admin + Seed de Dados Completos para Teste

## Resumo

Criar uma edge function `seed-test-data` que usa o service role key para: criar o usuario admin via Auth API, vincular a empresa, atribuir role admin, e popular todas as tabelas com um cenario de teste completo (cliente, fornecedores, produtos, projeto, itens, compras, estoque, financeiro, comissoes). Executar a function uma vez para popular tudo.

---

## Abordagem

Uma edge function e a unica forma de criar usuarios programaticamente (precisa do service role key). A function fara tudo em sequencia:

1. Criar usuario `admin@infinit.com` / `123456` via `supabase.auth.admin.createUser` (com `email_confirm: true`)
2. Inserir profile vinculado a empresa `a0000000-0000-0000-0000-000000000001`
3. Inserir `user_roles` com role `admin`
4. Inserir cliente, fornecedores (1 padrao + 1 arquiteto com RT)
5. Inserir 3 produtos com precos
6. Inserir 1 estoque_item por produto (qty baixa)
7. Criar projeto "Automacao Residencial Alpha" vinculado ao cliente
8. Inserir itens no projeto (3 produtos + 1 servico instalacao)
9. Inserir comissao RT do arquiteto
10. Inserir 1 compra vinculada ao projeto
11. Inserir estoque atualizado da compra
12. Inserir necessidade de compra para itens sem estoque
13. Gerar financeiro_receber (entrada + 2 parcelas)
14. Gerar financeiro_pagar (fornecedor + comissao)
15. Atualizar projeto status para `aprovado` e totais calculados

## Arquivo

`supabase/functions/seed-test-data/index.ts`

## Execucao

Apos deploy, chamar a function via `curl_edge_functions` para executar o seed. A function retorna um resumo do que foi criado.

## Seguranca

- Function usa `SUPABASE_SERVICE_ROLE_KEY` (ja disponivel como secret)
- Idempotente: verifica se usuario ja existe antes de criar
- Pode ser deletada apos uso

