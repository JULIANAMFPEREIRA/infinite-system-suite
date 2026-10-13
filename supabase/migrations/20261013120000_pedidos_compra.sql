-- Pedido de Compra com itens por cliente e recebimento parcial item a item.
-- Aditiva: não altera nenhuma tabela existente. RLS ligada desde a criação.
-- Regras no banco: validação de quantidade e "recebido -> comprado" no Pré-Projeto.

-- 1) Numeração dos pedidos a partir de 2001
create sequence if not exists public.pedidos_compra_numero_seq start 2001;

-- 2) Auxiliar reutilizável para políticas: o usuário logado é da equipe interna?
create or replace function public.eh_usuario_interno()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('admin','administrativo','financeiro','operacional','comercial','funcionario')
  );
$$;
revoke all on function public.eh_usuario_interno() from public, anon;
grant execute on function public.eh_usuario_interno() to authenticated;

-- 3) Cabeçalho do pedido (colunas compatíveis com a tela existente)
create table if not exists public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id),
  numero integer not null default nextval('public.pedidos_compra_numero_seq'),
  status text not null default 'rascunho'
    check (status in ('rascunho','enviado','confirmado','recebido_parcial','recebido','cancelado')),
  data_pedido date not null default current_date,
  fornecedor_id uuid references public.fornecedores(id),
  condicao_pagamento text,
  prazo_entrega text,
  transportadora_id uuid references public.transportadoras(id),
  observacoes text,
  local_entrega text,
  responsavel text,
  frete numeric(14,2) not null default 0,
  desconto_total numeric(14,2) not null default 0,
  ipi numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  itens jsonb not null default '[]'::jsonb,   -- retrato do documento impresso (PDF); a fonte de verdade é pedidos_compra_itens
  deletado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, numero)
);

-- 4) Itens: cada linha pode ser de um cliente/projeto diferente
create table if not exists public.pedidos_compra_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_compra(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id),
  crm_item_id uuid references public.crm_itens(id) on delete set null,
  cliente_id uuid references public.clientes(id),
  projeto_id uuid references public.projetos(id),
  produto_id uuid references public.produtos(id),
  descricao text not null,
  quantidade numeric(12,3) not null check (quantidade > 0),
  quantidade_recebida numeric(12,3) not null default 0 check (quantidade_recebida >= 0),
  valor_unit numeric(14,2) not null default 0,
  desconto numeric(14,2) not null default 0,
  recebido_em date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantidade_recebida <= quantidade)
);

create index if not exists idx_pci_pedido on public.pedidos_compra_itens(pedido_id);
create index if not exists idx_pci_crm_item on public.pedidos_compra_itens(crm_item_id);
create index if not exists idx_pci_cliente on public.pedidos_compra_itens(cliente_id);
create index if not exists idx_pc_fornecedor on public.pedidos_compra(fornecedor_id);
create index if not exists idx_pc_empresa on public.pedidos_compra(empresa_id);

-- 5) updated_at
create trigger tr_pedidos_compra_updated_at before update on public.pedidos_compra
  for each row execute function public.update_updated_at_column();
create trigger tr_pedidos_compra_itens_updated_at before update on public.pedidos_compra_itens
  for each row execute function public.update_updated_at_column();

-- 6) Um item do Pré-Projeto não pode ser pedido além da quantidade que tem
create or replace function public.pci_valida_quantidade()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_total numeric;
  v_qtd_item numeric;
begin
  if new.crm_item_id is null then
    return new;
  end if;
  select quantidade into v_qtd_item from public.crm_itens where id = new.crm_item_id;
  select coalesce(sum(i.quantidade), 0) into v_total
  from public.pedidos_compra_itens i
  join public.pedidos_compra p on p.id = i.pedido_id
  where i.crm_item_id = new.crm_item_id
    and i.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and p.status <> 'cancelado' and p.deletado = false;
  if v_qtd_item is not null and v_total + new.quantidade > v_qtd_item then
    raise exception 'Quantidade pedida (%) excede o item do Pré-Projeto (%). Já pedido em outros pedidos: %',
      new.quantidade, v_qtd_item, v_total;
  end if;
  return new;
end;
$$;
create trigger tr_pci_valida_quantidade before insert or update of quantidade, crm_item_id
  on public.pedidos_compra_itens for each row execute function public.pci_valida_quantidade();

-- 7) Recebimento: item recebido por inteiro => "comprado" no Pré-Projeto; atualiza status do pedido
create or replace function public.pci_aplica_recebimento()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_recebido numeric;
  v_qtd_item numeric;
  v_atual text;
  v_todos int;
  v_completos int;
  v_algum int;
  v_status_ped text;
begin
  -- 7a) crm_itens.status_compra
  if new.crm_item_id is not null then
    select quantidade, status_compra into v_qtd_item, v_atual from public.crm_itens where id = new.crm_item_id;
    select coalesce(sum(i.quantidade_recebida), 0) into v_recebido
    from public.pedidos_compra_itens i
    join public.pedidos_compra p on p.id = i.pedido_id
    where i.crm_item_id = new.crm_item_id and p.status <> 'cancelado' and p.deletado = false;
    if v_qtd_item is not null then
      if v_recebido >= v_qtd_item and coalesce(v_atual,'pendente') = 'pendente' then
        update public.crm_itens set status_compra = 'comprado' where id = new.crm_item_id;
      elsif v_recebido < v_qtd_item and v_atual = 'comprado' then
        update public.crm_itens set status_compra = 'pendente' where id = new.crm_item_id;
      end if;
    end if;
  end if;

  -- 7b) status do pedido
  select count(*), count(*) filter (where quantidade_recebida >= quantidade),
         count(*) filter (where quantidade_recebida > 0)
    into v_todos, v_completos, v_algum
  from public.pedidos_compra_itens where pedido_id = new.pedido_id;
  select status into v_status_ped from public.pedidos_compra where id = new.pedido_id;
  if v_status_ped <> 'cancelado' and v_todos > 0 then
    if v_completos = v_todos then
      update public.pedidos_compra set status = 'recebido' where id = new.pedido_id and status <> 'recebido';
    elsif v_algum > 0 then
      update public.pedidos_compra set status = 'recebido_parcial' where id = new.pedido_id and status <> 'recebido_parcial';
    end if;
  end if;
  return new;
end;
$$;
create trigger tr_pci_aplica_recebimento after insert or update of quantidade_recebida
  on public.pedidos_compra_itens for each row execute function public.pci_aplica_recebimento();

-- 8) Proteção (RLS) desde o nascimento: só equipe interna da mesma empresa
alter table public.pedidos_compra enable row level security;
alter table public.pedidos_compra_itens enable row level security;

create policy "equipe interna gerencia pedidos da empresa" on public.pedidos_compra
  for all to authenticated
  using (public.eh_usuario_interno() and empresa_id = public.get_empresa_id(auth.uid()))
  with check (public.eh_usuario_interno() and empresa_id = public.get_empresa_id(auth.uid()));

create policy "equipe interna gerencia itens de pedido da empresa" on public.pedidos_compra_itens
  for all to authenticated
  using (public.eh_usuario_interno() and empresa_id = public.get_empresa_id(auth.uid()))
  with check (public.eh_usuario_interno() and empresa_id = public.get_empresa_id(auth.uid()));

revoke all on public.pedidos_compra from anon, public;
revoke all on public.pedidos_compra_itens from anon, public;
grant select, insert, update, delete on public.pedidos_compra to authenticated;
grant select, insert, update, delete on public.pedidos_compra_itens to authenticated;
grant usage, select on sequence public.pedidos_compra_numero_seq to authenticated;

notify pgrst, 'reload schema';
