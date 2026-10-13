-- Correção: criar um pedido para um item já "comprado" NÃO pode devolvê-lo para "pendente".
-- Só o ESTORNO de um recebimento (quantidade_recebida diminui) volta o item para pendente.
-- Também reinicia a numeração dos pedidos em 2001 (tabela ainda sem pedidos reais).

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
  if new.crm_item_id is not null then
    select quantidade, status_compra into v_qtd_item, v_atual from public.crm_itens where id = new.crm_item_id;
    select coalesce(sum(i.quantidade_recebida), 0) into v_recebido
    from public.pedidos_compra_itens i
    join public.pedidos_compra p on p.id = i.pedido_id
    where i.crm_item_id = new.crm_item_id and p.status <> 'cancelado' and p.deletado = false;
    if v_qtd_item is not null then
      if v_recebido >= v_qtd_item and coalesce(v_atual,'pendente') = 'pendente' then
        update public.crm_itens set status_compra = 'comprado' where id = new.crm_item_id;
      elsif tg_op = 'UPDATE' and new.quantidade_recebida < old.quantidade_recebida
            and v_recebido < v_qtd_item and v_atual = 'comprado' then
        update public.crm_itens set status_compra = 'pendente' where id = new.crm_item_id;
      end if;
    end if;
  end if;

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

alter sequence public.pedidos_compra_numero_seq restart with 2001;
