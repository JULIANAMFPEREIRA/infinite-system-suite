-- C4: aprovação de orçamento atômica.
-- O app monta um "plano" (JSON) com tudo que deve ser gravado e chama esta função UMA vez.
-- O corpo de uma função plpgsql roda em uma transação só: qualquer erro desfaz tudo.
--
-- SECURITY INVOKER de propósito: as políticas de RLS continuam valendo exatamente como
-- quando o navegador gravava tabela por tabela. A função NÃO dá permissão nova a ninguém.
--
-- Segunda rede de segurança das regras financeiras:
--  * nunca apaga/altera financeiro_receber que não esteja pendente (ou tenha valor recebido);
--  * nunca apaga comissão/parcela de comissão com status 'pago';
--  * todo registro do plano precisa pertencer ao projeto do plano.

create or replace function public.aplicar_plano_aprovacao(plano jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_orc      uuid;
  v_proj     uuid;
  v_modo     text;
  v_n        integer;
  v_ids      uuid[];
  v_sec      jsonb;
  v_item     jsonb;
  v_cli      uuid;
begin
  if plano is null or jsonb_typeof(plano) <> 'object' then
    raise exception 'Plano de aprovação inválido.';
  end if;

  v_orc  := (plano->>'orcamento_id')::uuid;
  v_proj := (plano->'projeto'->>'id')::uuid;
  v_modo := plano->'projeto'->>'modo';

  if v_orc is null or v_proj is null or coalesce(v_modo, '') not in ('inserir', 'atualizar') then
    raise exception 'Plano de aprovação incompleto (orçamento, projeto ou modo ausente).';
  end if;

  -- ── 1. Aprovação do orçamento (mesma transação do resto) ──────────────────────
  if coalesce((plano->>'marcar_aprovado')::boolean, false) then
    update public.crm_orcamentos
       set aprovado = true, status_kanban = 'projeto'
     where id = v_orc;
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'Orçamento % não encontrado ou sem permissão para aprovar.', v_orc;
    end if;

    v_sec := plano->'cliente_status_crm';
    if v_sec is not null and jsonb_typeof(v_sec) = 'object' then
      v_cli := (v_sec->>'cliente_id')::uuid;
      if not exists (select 1 from public.crm_orcamentos where id = v_orc and cliente_id = v_cli) then
        raise exception 'O cliente do plano não é o cliente do orçamento.';
      end if;
      update public.clientes
         set status_crm = (jsonb_populate_record(null::public.clientes,
                             jsonb_build_object('status_crm', v_sec->>'status'))).status_crm
       where id = v_cli;
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'Cliente % não encontrado ou sem permissão.', v_cli;
      end if;
    end if;
  else
    if not exists (select 1 from public.crm_orcamentos where id = v_orc and aprovado = true) then
      raise exception 'Orçamento % não está aprovado.', v_orc;
    end if;
  end if;

  -- ── 2. Projeto ────────────────────────────────────────────────────────────────
  if v_modo = 'inserir' then
    if (plano->'projeto'->'campos'->>'id')::uuid is distinct from v_proj
       or (plano->'projeto'->'campos'->>'orcamento_id')::uuid is distinct from v_orc then
      raise exception 'Projeto do plano não confere com o orçamento.';
    end if;
    insert into public.projetos (
      id, empresa_id, nome, descricao, cliente_id, endereco_obra, arquiteto_id, status,
      venda_total, custo_previsto, margem_prevista, numero_parcelas, forma_pagamento,
      observacoes_pagamento, orcamento_id, data_inicio
    )
    select c.id, c.empresa_id, c.nome, c.descricao, c.cliente_id, c.endereco_obra, c.arquiteto_id, c.status,
           c.venda_total, c.custo_previsto, c.margem_prevista, c.numero_parcelas, c.forma_pagamento,
           c.observacoes_pagamento, c.orcamento_id, c.data_inicio
      from jsonb_populate_record(null::public.projetos, plano->'projeto'->'campos') c;
  else
    if not exists (select 1 from public.projetos where id = v_proj and orcamento_id = v_orc) then
      raise exception 'Projeto % não pertence ao orçamento % (ou sem permissão).', v_proj, v_orc;
    end if;
    update public.projetos p
       set venda_total = c.venda_total,
           custo_previsto = c.custo_previsto,
           margem_prevista = c.margem_prevista,
           numero_parcelas = c.numero_parcelas,
           forma_pagamento = c.forma_pagamento,
           descricao = c.descricao,
           status = c.status,
           observacoes_pagamento = c.observacoes_pagamento
      from jsonb_populate_record(null::public.projetos, plano->'projeto'->'campos') c
     where p.id = v_proj;
    get diagnostics v_n = row_count;
    if v_n <> 1 then
      raise exception 'Não foi possível atualizar o projeto %.', v_proj;
    end if;
  end if;

  -- ── 3. Compras/necessidades pendentes saem antes dos itens (elas apontam para os itens) ──
  delete from public.compras where projeto_id = v_proj and status = 'pendente';
  delete from public.necessidades_compra where projeto_id = v_proj and status = 'pendente';

  -- ── 4. Itens do projeto: apaga todos e insere os novos ────────────────────────
  v_sec := coalesce(plano->'projeto_itens'->'substituir', '[]'::jsonb);
  if exists (select 1 from jsonb_populate_recordset(null::public.projeto_itens, v_sec) r
              where r.projeto_id is distinct from v_proj or r.id is null) then
    raise exception 'Item do plano pertence a outro projeto.';
  end if;
  begin
    delete from public.projeto_itens where projeto_id = v_proj;
  exception when foreign_key_violation then
    raise exception 'Há compras ou comissões já em andamento ligadas aos itens deste projeto; os itens não puderam ser substituídos.'
      using errcode = '23503';
  end;
  insert into public.projeto_itens (id, projeto_id, descricao, quantidade, preco_custo, preco_venda, tipo, produto_id, rt_percentual)
  select r.id, r.projeto_id, r.descricao, r.quantidade, r.preco_custo, r.preco_venda, r.tipo, r.produto_id, r.rt_percentual
    from jsonb_populate_recordset(null::public.projeto_itens, v_sec) r;

  -- ── 5. Contas a receber (ausente quando skipReceber ou orçamento em grupo) ────
  v_sec := plano->'receber';
  if v_sec is not null and jsonb_typeof(v_sec) = 'object' then
    v_ids := array(select jsonb_array_elements_text(coalesce(v_sec->'apagar_ids', '[]'::jsonb)))::uuid[];
    if cardinality(v_ids) > 0 then
      -- Rede de segurança: nunca toca em parcela paga/parcial/com valor recebido.
      if exists (
        select 1 from public.financeiro_receber
         where id = any(v_ids)
           and (projeto_id is distinct from v_proj
                or not ((status is null or status = 'pendente') and coalesce(valor_recebido, 0) = 0))
      ) then
        raise exception 'Operação bloqueada: o plano tentou apagar parcela a receber já movimentada ou de outro projeto.';
      end if;
      delete from public.financeiro_receber where id = any(v_ids) and projeto_id = v_proj;
      get diagnostics v_n = row_count;
      if v_n <> cardinality(v_ids) then
        raise exception 'Parcelas a receber mudaram durante a aprovação (esperado %, apagado %). Nada foi gravado.', cardinality(v_ids), v_n;
      end if;
    end if;

    if exists (select 1 from jsonb_populate_recordset(null::public.financeiro_receber,
                 coalesce(v_sec->'inserir', '[]'::jsonb)) r
                where r.projeto_id is distinct from v_proj or r.id is null) then
      raise exception 'Parcela a receber do plano pertence a outro projeto.';
    end if;
    insert into public.financeiro_receber (id, empresa_id, projeto_id, cliente_id, descricao, valor, parcela, data_vencimento, status)
    select r.id, r.empresa_id, r.projeto_id, r.cliente_id, r.descricao, r.valor, r.parcela, r.data_vencimento, r.status
      from jsonb_populate_recordset(null::public.financeiro_receber, coalesce(v_sec->'inserir', '[]'::jsonb)) r;
  end if;

  -- ── 6. Comissão RT (ausente quando já existe comissão paga) ───────────────────
  if plano->>'projeto_arquiteto_id' is not null then
    update public.projetos
       set arquiteto_id = (plano->>'projeto_arquiteto_id')::uuid
     where id = v_proj and arquiteto_id is null;
  end if;

  v_sec := plano->'comissoes';
  if v_sec is not null and jsonb_typeof(v_sec) = 'object' then
    -- remover (nunca o que está pago)
    for v_item in select * from jsonb_array_elements(coalesce(v_sec->'remover', '[]'::jsonb)) loop
      if not exists (select 1 from public.comissoes
                      where id = (v_item->>'comissao_id')::uuid and projeto_id = v_proj
                        and status is distinct from 'pago') then
        raise exception 'Operação bloqueada: comissão % não pode ser removida (paga, de outro projeto ou inexistente).', v_item->>'comissao_id';
      end if;
      v_ids := array(select jsonb_array_elements_text(coalesce(v_item->'parcela_ids', '[]'::jsonb)))::uuid[];
      if cardinality(v_ids) > 0 then
        delete from public.financeiro_pagar
         where id = any(v_ids)
           and comissao_id = (v_item->>'comissao_id')::uuid
           and projeto_id = v_proj
           and status is distinct from 'pago';
        get diagnostics v_n = row_count;
        if v_n <> cardinality(v_ids) then
          raise exception 'Parcelas da comissão mudaram durante a aprovação. Nada foi gravado.';
        end if;
      end if;
      delete from public.comissoes
       where id = (v_item->>'comissao_id')::uuid and projeto_id = v_proj and status is distinct from 'pago';
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'Não foi possível remover a comissão %.', v_item->>'comissao_id';
      end if;
    end loop;

    -- atualizar no lugar (mesmo id)
    for v_item in select * from jsonb_array_elements(coalesce(v_sec->'atualizar', '[]'::jsonb)) loop
      update public.comissoes
         set valor = (v_item->>'valor')::numeric,
             percentual = (v_item->>'percentual')::numeric
       where id = (v_item->>'id')::uuid and projeto_id = v_proj and status is distinct from 'pago';
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'Operação bloqueada: comissão % não pode ser atualizada (paga, de outro projeto ou inexistente).', v_item->>'id';
      end if;
      if v_item->>'parcela_unica_id' is not null then
        update public.financeiro_pagar
           set valor = (v_item->>'valor')::numeric
         where id = (v_item->>'parcela_unica_id')::uuid
           and comissao_id = (v_item->>'id')::uuid
           and projeto_id = v_proj
           and status is distinct from 'pago';
        get diagnostics v_n = row_count;
        if v_n <> 1 then
          raise exception 'Operação bloqueada: parcela da comissão % não pode ser atualizada.', v_item->>'id';
        end if;
      end if;
    end loop;

    -- nova comissão
    if v_sec->'inserir' is not null and jsonb_typeof(v_sec->'inserir') = 'object' then
      if (v_sec->'inserir'->>'projeto_id')::uuid is distinct from v_proj then
        raise exception 'Comissão do plano pertence a outro projeto.';
      end if;
      insert into public.comissoes (id, empresa_id, projeto_id, fornecedor_id, valor, percentual, status)
      select r.id, r.empresa_id, r.projeto_id, r.fornecedor_id, r.valor, r.percentual, r.status
        from jsonb_populate_record(null::public.comissoes, v_sec->'inserir') r;
    end if;

    -- parcelas novas da RT (a comissão já existe neste ponto)
    if exists (select 1 from jsonb_populate_recordset(null::public.financeiro_pagar,
                 coalesce(v_sec->'parcelas_inserir', '[]'::jsonb)) r
                where r.projeto_id is distinct from v_proj or r.id is null or r.comissao_id is null
                   or not exists (select 1 from public.comissoes c where c.id = r.comissao_id and c.projeto_id = v_proj)) then
      raise exception 'Parcela de comissão do plano não pertence a este projeto.';
    end if;
    insert into public.financeiro_pagar (id, empresa_id, projeto_id, fornecedor_id, comissao_id, descricao, valor, status, origem, categoria_id, tipo_manual)
    select r.id, r.empresa_id, r.projeto_id, r.fornecedor_id, r.comissao_id, r.descricao, r.valor, r.status, r.origem, r.categoria_id, r.tipo_manual
      from jsonb_populate_recordset(null::public.financeiro_pagar, coalesce(v_sec->'parcelas_inserir', '[]'::jsonb)) r;
  end if;

  -- ── 7. projeto_parceiros ──────────────────────────────────────────────────────
  v_sec := plano->'projeto_parceiros';
  if v_sec is not null and jsonb_typeof(v_sec) = 'object' then
    if v_sec->'inserir' is not null and jsonb_typeof(v_sec->'inserir') = 'object' then
      if (v_sec->'inserir'->>'projeto_id')::uuid is distinct from v_proj then
        raise exception 'Parceiro do plano pertence a outro projeto.';
      end if;
      insert into public.projeto_parceiros (id, empresa_id, projeto_id, parceiro_id, rt_tipo, rt_base, rt_percentual, rt_valor, rt_total, rt_recebido)
      select r.id, r.empresa_id, r.projeto_id, r.parceiro_id, r.rt_tipo, r.rt_base, r.rt_percentual, r.rt_valor, r.rt_total, r.rt_recebido
        from jsonb_populate_record(null::public.projeto_parceiros, v_sec->'inserir') r;
    end if;
    if v_sec->'atualizar' is not null and jsonb_typeof(v_sec->'atualizar') = 'object' then
      update public.projeto_parceiros
         set rt_valor = (v_sec->'atualizar'->>'rt_valor')::numeric,
             rt_total = (v_sec->'atualizar'->>'rt_total')::numeric
       where id = (v_sec->'atualizar'->>'id')::uuid and projeto_id = v_proj;
      get diagnostics v_n = row_count;
      if v_n <> 1 then
        raise exception 'Vínculo do parceiro com o projeto não encontrado.';
      end if;
    end if;
  end if;

  -- ── 8. Compras e necessidades (pendentes antigas já foram apagadas no passo 3) ──
  v_sec := coalesce(plano->'compras'->'inserir', '[]'::jsonb);
  if exists (select 1 from jsonb_populate_recordset(null::public.compras, v_sec) r
              where r.projeto_id is distinct from v_proj or r.id is null
                 or not exists (select 1 from public.projeto_itens i where i.id = r.projeto_item_id and i.projeto_id = v_proj)) then
    raise exception 'Compra do plano não pertence a este projeto.';
  end if;
  insert into public.compras (id, empresa_id, projeto_id, projeto_item_id, produto_id, descricao, quantidade, status, valor_unitario, valor_total)
  select r.id, r.empresa_id, r.projeto_id, r.projeto_item_id, r.produto_id, r.descricao, r.quantidade, r.status, r.valor_unitario, r.valor_total
    from jsonb_populate_recordset(null::public.compras, v_sec) r;

  v_sec := coalesce(plano->'necessidades'->'inserir', '[]'::jsonb);
  if exists (select 1 from jsonb_populate_recordset(null::public.necessidades_compra, v_sec) r
              where r.projeto_id is distinct from v_proj or r.id is null
                 or not exists (select 1 from public.projeto_itens i where i.id = r.projeto_item_id and i.projeto_id = v_proj)) then
    raise exception 'Necessidade de compra do plano não pertence a este projeto.';
  end if;
  insert into public.necessidades_compra (id, empresa_id, projeto_id, projeto_item_id, produto_id, descricao, quantidade, status)
  select r.id, r.empresa_id, r.projeto_id, r.projeto_item_id, r.produto_id, r.descricao, r.quantidade, r.status
    from jsonb_populate_recordset(null::public.necessidades_compra, v_sec) r;

  -- ── 9. Frete e imposto (só pendentes, sem comissão e sem fornecedor) ───────────
  v_sec := plano->'pagar_extras';
  if v_sec is not null and jsonb_typeof(v_sec) = 'object' then
    v_ids := array(select jsonb_array_elements_text(coalesce(v_sec->'apagar_ids', '[]'::jsonb)))::uuid[];
    if cardinality(v_ids) > 0 then
      if exists (
        select 1 from public.financeiro_pagar
         where id = any(v_ids)
           and (projeto_id is distinct from v_proj
                or comissao_id is not null
                or fornecedor_id is not null
                or status is distinct from 'pendente')
      ) then
        raise exception 'Operação bloqueada: o plano tentou apagar conta a pagar que não é frete/imposto pendente deste projeto.';
      end if;
      delete from public.financeiro_pagar where id = any(v_ids) and projeto_id = v_proj;
      get diagnostics v_n = row_count;
      if v_n <> cardinality(v_ids) then
        raise exception 'Contas a pagar mudaram durante a aprovação (esperado %, apagado %). Nada foi gravado.', cardinality(v_ids), v_n;
      end if;
    end if;

    if exists (select 1 from jsonb_populate_recordset(null::public.financeiro_pagar,
                 coalesce(v_sec->'inserir', '[]'::jsonb)) r
                where r.projeto_id is distinct from v_proj or r.id is null
                   or r.comissao_id is not null or r.fornecedor_id is not null) then
      raise exception 'Conta a pagar do plano inválida (outro projeto, comissão ou fornecedor).';
    end if;
    insert into public.financeiro_pagar (id, empresa_id, projeto_id, descricao, valor, status, data_vencimento)
    select r.id, r.empresa_id, r.projeto_id, r.descricao, r.valor, r.status, r.data_vencimento
      from jsonb_populate_recordset(null::public.financeiro_pagar, coalesce(v_sec->'inserir', '[]'::jsonb)) r;
  end if;

  return v_proj;
end;
$$;

revoke all on function public.aplicar_plano_aprovacao(jsonb) from public, anon;
grant execute on function public.aplicar_plano_aprovacao(jsonb) to authenticated;

notify pgrst, 'reload schema';
