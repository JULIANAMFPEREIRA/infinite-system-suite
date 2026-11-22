import { describe, it, expect } from "vitest";
import { totalContas, calcSaldoReal } from "./saldoReal";

describe("totalContas", () => {
  it("soma as 4 contas", () => {
    expect(totalContas({ nubank: 1000.1, cora: 2000.2, bradescoPf: 300.3, bradescoPj: 400.4 })).toBe(3701);
  });
  it("trata nulos e NaN como 0", () => {
    expect(totalContas({ nubank: null, cora: NaN, bradescoPf: undefined, bradescoPj: 50 })).toBe(50);
    expect(totalContas({ nubank: "abc", cora: "10.50" })).toBe(10.5);
  });
  it("aceita negativos", () => {
    expect(totalContas({ nubank: -100, cora: 40, bradescoPf: 0, bradescoPj: 0 })).toBe(-60);
  });
});

describe("calcSaldoReal", () => {
  it("fórmula com números reais", () => {
    expect(
      calcSaldoReal({ saldoContas: 128137, aReceber: 110943.5, inadimplente: 61048.18, faltaComprar: 329693.73 }),
    ).toBe(-29565.05);
  });
  it("nulos viram 0", () => {
    expect(calcSaldoReal({ saldoContas: null, aReceber: NaN, inadimplente: undefined, faltaComprar: null })).toBe(0);
    expect(calcSaldoReal({})).toBe(0);
  });
  it("positivo quando entradas superam a falta comprar", () => {
    expect(calcSaldoReal({ saldoContas: 100, aReceber: 50, inadimplente: 10, faltaComprar: 20 })).toBe(140);
  });
  it("arredonda a 2 casas", () => {
    expect(calcSaldoReal({ saldoContas: 0.1, aReceber: 0.2, inadimplente: 0, faltaComprar: 0 })).toBe(0.3);
  });
});
