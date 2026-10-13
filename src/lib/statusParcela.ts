/**
 * Situação de uma parcela a receber, como o CLIENTE a enxerga.
 * O banco só grava pendente/pago/parcial/cancelado; "vencido" é calculado pela data.
 */

export type SituacaoParcela = "pago" | "parcial" | "vencido" | "a_vencer" | "cancelado";

type ParcelaStatus = { status?: string | null; data_vencimento?: string | null };

/** `hoje` no formato AAAA-MM-DD (data local do Brasil, passada de fora para ser testável). */
export function statusParcela(p: ParcelaStatus, hoje: string): SituacaoParcela {
  const s = (p.status ?? "pendente").toLowerCase();
  if (s === "pago" || s === "recebido") return "pago";
  if (s === "parcial") return "parcial" as SituacaoParcela;
  if (s === "cancelado") return "cancelado";
  if (s === "vencido" || s === "atrasado") return "vencido";
  const venc = (p.data_vencimento ?? "").slice(0, 10);
  if (venc && venc < hoje) return "vencido";
  return "a_vencer";
}

type ParcelaValor = ParcelaStatus & { valor?: number | string | null; valor_recebido?: number | string | null };

const n = (v: unknown) => Number(v) || 0;
const round2 = (x: number) => Math.round(x * 100) / 100;

export function resumoFinanceiroCliente(parcelas: ParcelaValor[], hoje: string) {
  let pago = 0, vencido = 0, aVencer = 0;
  for (const p of parcelas) {
    const sit = statusParcela(p, hoje);
    if (sit === "cancelado") continue;
    const valor = n(p.valor);
    if (sit === "pago") { pago += valor; continue; }
    const recebido = Math.min(n(p.valor_recebido), valor);
    pago += recebido;
    const restante = valor - recebido;
    // parcial: o que falta herda a situação pela data
    const pelaData = statusParcela({ status: "pendente", data_vencimento: p.data_vencimento }, hoje);
    if (sit === "vencido" || (sit === "parcial" && pelaData === "vencido")) vencido += restante;
    else aVencer += restante;
  }
  return { pago: round2(pago), vencido: round2(vencido), aVencer: round2(aVencer), total: round2(pago + vencido + aVencer) };
}

export const rotuloSituacao: Record<SituacaoParcela, string> = {
  pago: "Pago",
  parcial: "Pago parcialmente",
  vencido: "Vencido",
  a_vencer: "A vencer",
  cancelado: "Cancelado",
};
