-- Campos comerciais dos fornecedores, vínculo do produto com o catálogo e dados do documento do fornecedor.
-- Aditiva (somente ADD COLUMN / índices). Aplicada em produção em 13/10/2026.

alter table public.fornecedores
  add column if not exists pedido_minimo numeric(14,2),
  add column if not exists frete_cif_acima_de numeric(14,2),
  add column if not exists condicao_pagamento_padrao text,
  add column if not exists garantia_meses integer,
  add column if not exists observacoes_comerciais text;

alter table public.produtos
  add column if not exists fornecedor_id uuid references public.fornecedores(id),
  add column if not exists codigo_fornecedor text,
  add column if not exists marca text,
  add column if not exists ncm text,
  add column if not exists ipi_percentual numeric(6,2),
  add column if not exists preco_lista numeric(14,2),
  add column if not exists tipo_preco_lista text,
  add column if not exists fator_custo numeric(8,5),
  add column if not exists custo_ultimo_pedido numeric(14,2),
  add column if not exists custo_atualizado_em timestamptz;

alter table public.produtos drop constraint if exists produtos_tipo_preco_lista_check;
alter table public.produtos add constraint produtos_tipo_preco_lista_check
  check (tipo_preco_lista is null or tipo_preco_lista in ('consumidor','sugerido','custo'));

create index if not exists idx_produtos_fornecedor on public.produtos(fornecedor_id);
create unique index if not exists uq_produtos_fornecedor_codigo
  on public.produtos(fornecedor_id, codigo_fornecedor)
  where codigo_fornecedor is not null and coalesce(deletado,false) = false;

alter table public.pedidos_compra
  add column if not exists numero_fornecedor text,
  add column if not exists validade_proposta date,
  add column if not exists frete_tipo text,
  add column if not exists forma_pagamento text,
  add column if not exists vendedor text,
  add column if not exists previsao_faturamento date,
  add column if not exists icms_st numeric(14,2) not null default 0;

alter table public.pedidos_compra drop constraint if exists pedidos_compra_frete_tipo_check;
alter table public.pedidos_compra add constraint pedidos_compra_frete_tipo_check
  check (frete_tipo is null or frete_tipo in ('CIF','FOB'));

alter table public.pedidos_compra_itens
  add column if not exists unidade text,
  add column if not exists codigo_fornecedor text,
  add column if not exists ncm text,
  add column if not exists ipi_percentual numeric(6,2);

update public.fornecedores
   set pedido_minimo = 2500, frete_cif_acima_de = 10000,
       condicao_pagamento_padrao = 'À VISTA', garantia_meses = 18,
       observacoes_comerciais = coalesce(observacoes_comerciais, observacao)
 where nome = 'CHIAVE DISTRIBUIDORA' and coalesce(deletado,false) = false;

notify pgrst, 'reload schema';
