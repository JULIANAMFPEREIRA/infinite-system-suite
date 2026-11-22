// Saldo real = saldo nas contas + a receber + inadimplente − falta comprar.
// Funções puras; null/undefined/NaN contam como 0 e o resultado é arredondado a 2 casas.

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const arred = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

export interface SaldosContas {
  nubank?: number | string | null;
  cora?: number | string | null;
  bradescoPf?: number | string | null;
  bradescoPj?: number | string | null;
}

export function totalContas(saldos: SaldosContas): number {
  return arred(num(saldos.nubank) + num(saldos.cora) + num(saldos.bradescoPf) + num(saldos.bradescoPj));
}

export interface EntradasSaldoReal {
  saldoContas?: number | null;
  aReceber?: number | null;
  inadimplente?: number | null;
  faltaComprar?: number | null;
}

export function calcSaldoReal(e: EntradasSaldoReal): number {
  return arred(num(e.saldoContas) + num(e.aReceber) + num(e.inadimplente) - num(e.faltaComprar));
}
