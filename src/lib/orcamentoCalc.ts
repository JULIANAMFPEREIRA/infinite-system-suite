/**
 * Centralised budget (orçamento) total calculation.
 * This is the SINGLE SOURCE OF TRUTH for financial totals.
 */

export interface OrcamentoTotalInput {
  /** crm_itens rows attached to the budget */
  itens: { quantidade?: number | null; preco_venda?: number | null; preco_custo?: number | null; rt_comissao?: number | null }[];
  frete?: number | null;
  imposto?: number | null;
  /** simulacao_pagamento JSON stored on crm_orcamentos */
  simulacao_pagamento?: Record<string, any> | null;
}

export interface OrcamentoTotals {
  subtotalVenda: number;
  subtotalCusto: number;
  frete: number;
  imposto: number;
  descontoTipo: "percentual" | "fixo";
  descontoValorRaw: number;
  descontoCalculado: number;
  totalVenda: number;        // subtotalVenda - desconto  (what the client pays for items)
  totalCusto: number;        // subtotalCusto + frete + imposto + RT
  totalRT: number;
  margem: number;            // percentage
}

export function calcOrcamentoTotals(input: OrcamentoTotalInput): OrcamentoTotals {
  const itens = input.itens ?? [];
  const frete = Number(input.frete) || 0;
  const imposto = Number(input.imposto) || 0;
  const sim = input.simulacao_pagamento ?? {};

  const subtotalVenda = itens.reduce(
    (s, i) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1),
    0,
  );

  const subtotalCusto = itens.reduce(
    (s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1),
    0,
  );

  const totalRT = itens.reduce(
    (s, i) => s + (Number((i as any).rt_comissao) || 0),
    0,
  );

  const descontoTipo: "percentual" | "fixo" = sim.descontoTipo ?? "fixo";
  const descontoValorRaw = Number(sim.descontoValor) || 0;

  const descontoCalculado =
    descontoTipo === "percentual"
      ? (subtotalVenda * Math.min(Math.max(descontoValorRaw, 0), 100)) / 100
      : Math.min(Math.max(descontoValorRaw, 0), subtotalVenda);

  const totalVenda = subtotalVenda - descontoCalculado;
  const totalCusto = subtotalCusto + frete + imposto + totalRT;
  const margem = totalVenda > 0 ? ((totalVenda - totalCusto) / totalVenda) * 100 : 0;

  return {
    subtotalVenda,
    subtotalCusto,
    frete,
    imposto,
    descontoTipo,
    descontoValorRaw,
    descontoCalculado,
    totalVenda,
    totalCusto,
    totalRT,
    margem,
  };
}
