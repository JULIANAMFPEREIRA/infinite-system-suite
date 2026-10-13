/**
 * A simulação de pagamento (crm_orcamentos.simulacao_pagamento) é o "plano" de parcelas.
 * Parcelas já movimentadas no financeiro (pagas/parciais) são a fonte de verdade e
 * a simulação gravada nunca pode contradizê-las — senão um "Salvar" reancora as datas em "hoje".
 */

export type RecebidaLocked = {
  parcela: number | null;
  valor: number | null;
  data_vencimento: string | null;
};

type SimParcela = { numero: number; valor: number; data: string };

const isoToBr = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};

export function alinharSimulacaoComRecebidas<T extends { entrada?: any; entradaData?: any; parcelas?: any[] }>(
  sim: T,
  recebidas: RecebidaLocked[],
): T {
  const out: T = JSON.parse(JSON.stringify(sim ?? {}));
  if (!recebidas.length) return out;

  const offset = Number(out.entrada) > 0 ? 1 : 0;
  const parcelas: SimParcela[] = Array.isArray(out.parcelas) ? (out.parcelas as SimParcela[]) : [];

  for (const r of recebidas) {
    if (r.parcela == null) continue;
    if (offset === 1 && r.parcela === 1) {
      if (r.data_vencimento) (out as any).entradaData = isoToBr(r.data_vencimento);
      continue;
    }
    const idx = r.parcela - 1 - offset;
    if (idx < 0 || idx >= parcelas.length) continue;
    if (r.valor != null) parcelas[idx].valor = Number(r.valor);
    if (r.data_vencimento) parcelas[idx].data = isoToBr(r.data_vencimento);
  }
  return out;
}
