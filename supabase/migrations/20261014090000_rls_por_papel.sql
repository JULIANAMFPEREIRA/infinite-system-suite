-- C1: segurança dos usuários logados (RLS por papel)
-- Regra: equipe interna (admin, administrativo, financeiro, operacional, comercial, funcionario)
-- continua vendo e gravando tudo, como antes. Portais (cliente, arquiteto, técnico/parceiro)
-- passam a ver só o que é deles. Para desfazer: supabase/rollback/20261014_rls_por_papel_desfazer.sql

-- 1) Quem sou eu (funções de apoio; rodam com privilégio do dono para não entrar em laço de RLS)
create or replace function public.meu_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(trim(email)) from auth.users where id = auth.uid();
$$;

create or replace function public.meus_fornecedores()
returns setof uuid language sql stable security definer set search_path = public as $$
  select f.id from public.fornecedores f
  where coalesce(f.deletado, false) = false
    and lower(trim(f.email)) = public.meu_email();
$$;

create or replace function public.meus_clientes()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from public.clientes c
  where coalesce(c.deletado, false) = false
    and (c.user_id = auth.uid() or lower(trim(c.email)) = public.meu_email());
$$;

-- projetos em que sou arquiteto, técnico ou parceiro
create or replace function public.projetos_como_parceiro()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.projetos p where p.arquiteto_id in (select public.meus_fornecedores())
  union
  select pt.projeto_id from public.pagamentos_tecnico pt
   where pt.tecnico_id in (select public.meus_fornecedores()) and pt.projeto_id is not null
  union
  select pp.projeto_id from public.projeto_parceiros pp
   where pp.parceiro_id in (select public.meus_fornecedores()) and pp.projeto_id is not null;
$$;

create or replace function public.meus_projetos()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.id from public.projetos p where p.cliente_id in (select public.meus_clientes())
  union
  select public.projetos_como_parceiro();
$$;

-- clientes que vejo como arquiteto/técnico (leads do arquiteto + clientes dos meus projetos)
create or replace function public.clientes_como_parceiro()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from public.clientes c where c.arquiteto_id in (select public.meus_fornecedores())
  union
  select p.cliente_id from public.projetos p
   where p.id in (select public.projetos_como_parceiro()) and p.cliente_id is not null;
$$;

-- orçamentos dos projetos em que sou o arquiteto (para o valor de venda no portal)
create or replace function public.orcamentos_como_arquiteto()
returns setof uuid language sql stable security definer set search_path = public as $$
  select p.orcamento_id from public.projetos p
   where p.arquiteto_id in (select public.meus_fornecedores()) and p.orcamento_id is not null;
$$;

create or replace function public.minhas_comissoes()
returns setof uuid language sql stable security definer set search_path = public as $$
  select c.id from public.comissoes c where c.fornecedor_id in (select public.meus_fornecedores());
$$;

revoke all on function public.meu_email(), public.meus_fornecedores(), public.meus_clientes(),
  public.projetos_como_parceiro(), public.meus_projetos(), public.clientes_como_parceiro(),
  public.orcamentos_como_arquiteto(), public.minhas_comissoes() from public, anon;
grant execute on function public.meu_email(), public.meus_fornecedores(), public.meus_clientes(),
  public.projetos_como_parceiro(), public.meus_projetos(), public.clientes_como_parceiro(),
  public.orcamentos_como_arquiteto(), public.minhas_comissoes() to authenticated;

-- 2) Liga RLS em todas as tabelas e dá acesso total à equipe interna (nada muda para ela)
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname not in ('anotacoes_usuario', 'pedidos_compra', 'pedidos_compra_itens')
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists interno_acesso_total on public.%I', t);
    execute format(
      'create policy interno_acesso_total on public.%I for all to authenticated
         using (public.eh_usuario_interno()) with check (public.eh_usuario_interno())', t);
  end loop;
end $$;

-- 3) Políticas antigas que liberavam tudo para qualquer logado
drop policy if exists "Tecnicos podem inserir arquivos" on public.crm_arquivos;
drop policy if exists "Tecnicos podem deletar seus arquivos" on public.crm_arquivos;
drop policy if exists "Autenticados podem ler arquivos" on public.crm_arquivos;
drop policy if exists "Tecnicos podem inserir interacoes" on public.crm_interacoes;
drop policy if exists "Autenticados podem ler interacoes" on public.crm_interacoes;
drop policy if exists "Tecnicos podem atualizar suas interacoes" on public.crm_interacoes;
drop policy if exists "Tecnicos podem deletar suas interacoes" on public.crm_interacoes;

-- 4) O próprio usuário (login e permissões)
create policy proprio_papel on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy proprio_perfil on public.profiles for select to authenticated using (id = auth.uid());
create policy proprias_permissoes on public.user_permissions for select to authenticated using (user_id = auth.uid());

-- 5) Portais: leitura do que é de cada um
create policy portal_le on public.fornecedores for select to authenticated
  using (id in (select public.meus_fornecedores()));
create policy portal_le on public.clientes for select to authenticated
  using (id in (select public.meus_clientes()) or id in (select public.clientes_como_parceiro()));
create policy portal_le on public.projetos for select to authenticated
  using (id in (select public.meus_projetos()));
create policy portal_le on public.historico_projeto for select to authenticated
  using (projeto_id in (select public.meus_projetos()));
create policy portal_le on public.necessidades_compra for select to authenticated
  using (projeto_id in (select p.id from public.projetos p where p.cliente_id in (select public.meus_clientes())));
create policy portal_le on public.financeiro_receber for select to authenticated
  using (cliente_id in (select public.meus_clientes()));
create policy portal_le on public.crm_orcamentos for select to authenticated
  using (id in (select public.orcamentos_como_arquiteto()));
create policy portal_le on public.crm_itens for select to authenticated
  using (orcamento_id in (select public.orcamentos_como_arquiteto()));
create policy portal_le on public.comissoes for select to authenticated
  using (fornecedor_id in (select public.meus_fornecedores()));
create policy portal_le on public.financeiro_pagar for select to authenticated
  using (fornecedor_id in (select public.meus_fornecedores()) or comissao_id in (select public.minhas_comissoes()));
create policy portal_le on public.parcelas_parceiros for select to authenticated
  using (parceiro_id in (select public.meus_fornecedores()));
create policy portal_le on public.projeto_parceiros for select to authenticated
  using (parceiro_id in (select public.meus_fornecedores()));
create policy portal_le on public.pagamentos_tecnico for select to authenticated
  using (tecnico_id in (select public.meus_fornecedores()));
create policy portal_le on public.pagamentos_tecnico_lancamentos for select to authenticated
  using (tecnico_id in (select public.meus_fornecedores()));

-- Diário de obra (visitas): vê as dos seus projetos; o técnico registra as dele
create policy portal_le on public.visitas_tecnicas for select to authenticated
  using (projeto_id in (select public.meus_projetos()));
create policy portal_tecnico_registra on public.visitas_tecnicas for insert to authenticated
  with check (tecnico_id in (select public.meus_fornecedores()) and projeto_id in (select public.meus_projetos()));

-- Arquivos do CRM (fotos e documentos)
create policy portal_le on public.crm_arquivos for select to authenticated
  using (cliente_id in (select public.meus_clientes())
      or cliente_id in (select public.clientes_como_parceiro())
      or projeto_id in (select public.meus_projetos()));
create policy portal_envia on public.crm_arquivos for insert to authenticated
  with check (autor_tipo <> 'admin'
      and (cliente_id in (select public.meus_clientes()) or cliente_id in (select public.clientes_como_parceiro())));
create policy portal_apaga_do_portal on public.crm_arquivos for delete to authenticated
  using (autor_tipo <> 'admin'
      and (cliente_id in (select public.meus_clientes()) or cliente_id in (select public.clientes_como_parceiro())));

-- Anotações / diário / comunicação (crm_interacoes)
-- cliente: só o que foi marcado "visível ao cliente" ou o que ele mesmo escreveu
-- arquiteto/técnico: o que é "visível no portal" dos clientes dos seus projetos
create policy portal_le on public.crm_interacoes for select to authenticated
  using (usuario_id = auth.uid()
      or (cliente_id in (select public.meus_clientes()) and visivel_cliente = true)
      or (cliente_id in (select public.clientes_como_parceiro()) and coalesce(visivel_portal, true)));
create policy portal_escreve on public.crm_interacoes for insert to authenticated
  with check (cliente_id in (select public.meus_clientes()) or cliente_id in (select public.clientes_como_parceiro()));
-- o que veio do escritório (autor_tipo 'admin') não é editado nem apagado pelo portal,
-- exceto o cliente marcar uma pendência visível a ele como concluída
create policy portal_edita on public.crm_interacoes for update to authenticated
  using ((usuario_id = auth.uid() and coalesce(autor_tipo, 'admin') <> 'admin')
      or (cliente_id in (select public.meus_clientes()) and visivel_cliente = true))
  with check (cliente_id in (select public.meus_clientes()) or cliente_id in (select public.clientes_como_parceiro()));
create policy portal_apaga_proprio on public.crm_interacoes for delete to authenticated
  using (usuario_id = auth.uid() and coalesce(autor_tipo, 'admin') <> 'admin');

notify pgrst, 'reload schema';
