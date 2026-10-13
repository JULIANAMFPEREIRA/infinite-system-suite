-- DESFAZER C1 (usar só em emergência): volta ao estado anterior a 20261014090000_rls_por_papel.sql
-- Efeito: todo usuário logado volta a ver tudo (o acesso anônimo continua fechado, etapa 1A).
-- Não aplicar junto com a migration principal; este arquivo é o "botão de voltar".
do $$
declare t text; pol record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('anotacoes_usuario', 'pedidos_compra', 'pedidos_compra_itens')
  loop
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

-- políticas que existiam antes em crm_arquivos/crm_interacoes (RLS delas estava desligado)
create policy "Autenticados podem ler arquivos" on public.crm_arquivos for select to authenticated using (true);
create policy "Tecnicos podem inserir arquivos" on public.crm_arquivos for insert to authenticated with check (true);
create policy "Tecnicos podem deletar seus arquivos" on public.crm_arquivos for delete to authenticated using (true);
create policy "Autenticados podem ler interacoes" on public.crm_interacoes for select to authenticated using (true);
create policy "Tecnicos podem inserir interacoes" on public.crm_interacoes for insert to authenticated with check (true);
create policy "Tecnicos podem atualizar suas interacoes" on public.crm_interacoes for update to authenticated using (usuario_id = auth.uid());
create policy "Tecnicos podem deletar suas interacoes" on public.crm_interacoes for delete to authenticated using (usuario_id = auth.uid());

notify pgrst, 'reload schema';
