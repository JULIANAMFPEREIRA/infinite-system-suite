/**
 * Planeja a sincronização das parcelas de Contas a Receber de um projeto.
 *
 * Regras (fonte de verdade das parcelas já movimentadas nunca é tocada):
 *  - Só são apagadas parcelas "pendente"/null SEM valor recebido.
 *  - Parcelas pagas, parciais, vencidas, canceladas ou com valor recebido são intocáveis
 *    e o número delas fica reservado.
 *  - A parcela desejada na posição n recebe sempre o número n. Nenhuma renumeração, então
 *    valor e data ficam ligados à posição certa e nunca há dois registros com o mesmo número.
 */

export type ParcelaExistente = {
  id: string;
  parcela: number | null;
  status: string | null;
  valor_recebido?: number | string | null;
};

export type ParcelaDesejada = { valor: number; data: string | null };

export type ParcelaNova = { parcela: number; valor: number; data: string | null };

export type PlanoParcelas = {
  idsApagar: string[];
  inserts: ParcelaNova[];
  total: number;
};

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const isPendenteEditavel = (p: ParcelaExistente) =>
  (p.status === "pendente" || p.status === null) && (Number(p.valor_recebido) || 0) === 0;

export function planParcelasReceber(
  existentes: ParcelaExistente[],
  desejadas: ParcelaDesejada[],
): PlanoParcelas {
  const idsApagar = existentes.filter(isPendenteEditavel).map(p => p.id);

  const numerosReservados = new Set(
    existentes
      .filter(p => !isPendenteEditavel(p) && p.parcela != null)
      .map(p => p.parcela as number),
  );

  const inserts: ParcelaNova[] = [];
  desejadas.forEach((d, i) => {
    const numero = i + 1;
    if (numerosReservados.has(numero)) return;
    inserts.push({ parcela: numero, valor: round2(d.valor), data: d.data });
  });

  return { idsApagar, inserts, total: desejadas.length };
}
