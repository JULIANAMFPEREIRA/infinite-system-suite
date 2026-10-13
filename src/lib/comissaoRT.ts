/**
 * Decide o que fazer com a comissão RT de um projeto ao sincronizar o orçamento.
 * Princípios: atualizar no lugar (mesmo id), nunca tocar em parcela paga,
 * preservar parcelamento manual, e só remover quando não há nada pago.
 */

export type ComissaoExistente = { id: string; status: string | null; valor: number | null };
export type ParcelaComissao = { id: string; valor: number | null; status: string | null };

export type PlanoComissao =
  | { acao: "nada" }
  | { acao: "criar" }
  | {
      acao: "atualizar";
      comissaoId: string;
      valor: number;
      parcelaUnicaId: string | null;
      criarParcela: boolean;
      aviso?: string;
    }
  | { acao: "manter"; comissaoId: string; aviso?: string }
  | { acao: "remover"; comissaoId: string; parcelaIds: string[] };

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const soma = (ps: ParcelaComissao[]) => round2(ps.reduce((s, p) => s + (Number(p.valor) || 0), 0));

export function planComissaoRT(args: {
  comissao: ComissaoExistente | null;
  parcelas: ParcelaComissao[];
  totalRt: number;
  temArquiteto: boolean;
}): PlanoComissao {
  const { comissao, parcelas } = args;
  const totalRt = round2(args.totalRt);
  const querRt = args.temArquiteto && totalRt > 0;
  const temPago = !!comissao && (comissao.status === "pago" || parcelas.some(p => p.status === "pago"));

  if (!querRt) {
    if (!comissao) return { acao: "nada" };
    if (temPago) return { acao: "manter", comissaoId: comissao.id, aviso: "RT zerado, mas há parcela paga: mantido." };
    return {
      acao: "remover",
      comissaoId: comissao.id,
      parcelaIds: parcelas.filter(p => p.status !== "pago").map(p => p.id),
    };
  }

  if (!comissao) return { acao: "criar" };

  if (temPago) {
    const diverge = Math.abs(soma(parcelas) - totalRt) > 0.01;
    return diverge
      ? {
          acao: "manter",
          comissaoId: comissao.id,
          aviso: "O RT mudou, mas há parcelas já pagas. Ajuste o restante manualmente no Contas a Pagar.",
        }
      : { acao: "manter", comissaoId: comissao.id };
  }

  if (parcelas.length === 0) {
    return { acao: "atualizar", comissaoId: comissao.id, valor: totalRt, parcelaUnicaId: null, criarParcela: true };
  }
  if (parcelas.length === 1) {
    return { acao: "atualizar", comissaoId: comissao.id, valor: totalRt, parcelaUnicaId: parcelas[0].id, criarParcela: false };
  }
  const diverge = Math.abs(soma(parcelas) - totalRt) > 0.01;
  return {
    acao: "atualizar",
    comissaoId: comissao.id,
    valor: totalRt,
    parcelaUnicaId: null,
    criarParcela: false,
    ...(diverge ? { aviso: "RT mudou e as parcelas foram definidas manualmente: confira o total no Contas a Pagar." } : {}),
  };
}
