
Diagnóstico objetivo (já confirmado):
- Os dados do seed existem e estão corretos na mesma empresa do admin (projeto “Automação Residencial Alpha”, compras, estoque, clientes e fornecedores).
- Há erro real de permissão no backend: políticas RLS de arquiteto em `projetos` e `comissoes` consultam `auth.users` diretamente, gerando “permission denied for table users” e quebrando leituras.
- Ainda existem 12 rotas usando `ModulePage` (com texto “Módulo em desenvolvimento”), o que impede visualização funcional em “todos os módulos”.

Plano de correção definitiva (sem recriar dados):
1) Corrigir RLS (prioridade máxima)
- Criar migration para remover dependência de `auth.users` nas policies:
  - `Arquiteto sees own projetos`
  - `Arquiteto sees own comissoes`
- Recriar essas policies usando `auth.jwt()->>'email'` + `fornecedores.email` (sem acesso direto a tabela protegida).
- Padronizar políticas de admin para `TO authenticated` com `USING` + `WITH CHECK` explícitos nas tabelas críticas: `projetos`, `clientes`, `fornecedores`, `compras`, `estoque_itens`, `financeiro_pagar`, `financeiro_receber`, `projeto_itens`, `necessidades_compra`.

2) Garantir vínculo usuário/empresa em runtime
- Fortalecer `AuthContext` para tratar erro de carregamento de perfil/roles e evitar estado silencioso com `empresaId` nulo.
- Expor estado de erro de sessão/empresa (mensagem clara) em vez de tela vazia.

3) Padronizar consultas dos módulos principais com filtro de empresa + estado de erro
- `Projetos`, `Compras`, `Estoque`, `Fornecedores`, `Financeiro*`, `NecessidadesCompra`:
  - adicionar `.eq("empresa_id", empresaId)` onde aplicável;
  - usar `enabled: !!empresaId`;
  - tratar `isError/error` na UI (não mostrar “nenhum dado” quando na verdade houve erro de permissão).

4) Projetos (garantia explícita do caso pedido)
- Validar listagem real com joins e exibição do projeto “Automação Residencial Alpha”.
- Manter automações já implementadas (pendências de compra, badges, vínculo com itens).

5) Compras e Estoque
- Garantir listagem real com joins estáveis:
  - Compras: fornecedor + projeto vinculados.
  - Estoque: catálogo de produtos + estoque físico atualizado após compras.
- Exibir fallback funcional apenas quando realmente não houver registros.

6) Clientes e Fornecedores
- Fornecedores já funcional: manter e reforçar tratamento de erro.
- CRM deixará de ser placeholder e passará a listar clientes reais + resumo de interações (`clientes` + `crm_interacoes`).

7) Remover placeholder de todos os módulos atualmente em `ModulePage`
- Substituir cada rota por tela funcional orientada a dados já existentes:
  - `Cronograma`: timeline por `projetos` (data início/previsão/status/progresso calculado).
  - `FluxoCaixa`: entradas (`financeiro_receber`) vs saídas (`financeiro_pagar`).
  - `DRE`: receita, custo, comissão e lucro com base em tabelas reais.
  - `Relatorios`: rankings de projetos/clientes/produtos.
  - `Auditoria`: tabela `audit_logs`.
  - `Configurações`: `empresas`, `profiles`, `user_roles`.
  - `Kits`, `Automacoes`, `Contratos`, `NotasFiscais`, `Integracoes`: painéis funcionais data-driven (sem texto “em desenvolvimento”), usando dados reais disponíveis e estados operacionais.
- Remover uso do texto “Módulo em desenvolvimento” do fluxo de navegação.

8) Validação final obrigatória
- Confirmar em UI: todos os módulos carregam telas funcionais.
- Confirmar que nenhum módulo exibirá “Módulo em desenvolvimento”.
- Confirmar presença de dados seed nas telas-chave:
  - Projetos: “Automação Residencial Alpha”
  - Compras: compra do seed vinculada ao projeto
  - Estoque: produtos + itens atualizados
  - Clientes/Fornecedores: registros do seed
- Confirmar ausência de novos erros RLS nos logs.

Detalhes técnicos (objetivos de implementação):
- Banco: apenas ajuste de policies/funções de acesso (sem recriar tabelas/dados).
- Frontend: substituição de placeholders por telas reais, com tratamento explícito de loading/error/empty.
- Segurança: manter isolamento multiempresa por `empresa_id` e acesso total do admin dentro da própria empresa.

Arquivos principais impactados:
- Migration nova em `supabase/migrations/*` (RLS fix).
- `src/contexts/AuthContext.tsx`
- `src/hooks/useProjetos.ts`, `src/hooks/useFinanceiro.ts`, `src/hooks/useNecessidadesCompra.ts`
- `src/pages/modules/Projetos.tsx`, `Compras.tsx`, `Estoque.tsx`, `Fornecedores.tsx`, `CRM.tsx`
- Substituição dos módulos placeholder: `Cronograma.tsx`, `FluxoCaixa.tsx`, `DRE.tsx`, `Relatorios.tsx`, `Auditoria.tsx`, `Configuracoes.tsx`, `Kits.tsx`, `Automacoes.tsx`, `Contratos.tsx`, `NotasFiscais.tsx`, `Integracoes.tsx`
- `src/pages/modules/ModulePage.tsx` (descontinuar uso no menu principal)
