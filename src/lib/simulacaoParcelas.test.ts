import { describe, it, expect } from "vitest";
import { alinharSimulacaoComRecebidas } from "./simulacaoParcelas";

const simBase = () => ({
  condicao: "parcelado",
  entrada: 0,
  entradaData: "04/05/2026",
  intervalo: 30,
  numParcelas: 4,
  parcelas: [
    { numero: 1, valor: 100, data: "11/11/2026" },
    { numero: 2, valor: 100, data: "11/12/2026" },
    { numero: 3, valor: 100, data: "10/01/2027" },
    { numero: 4, valor: 100, data: "09/02/2027" },
  ],
});

describe("alinharSimulacaoComRecebidas", () => {
  it("parcelas pagas passam a refletir valor e data reais do financeiro", () => {
    const r = alinharSimulacaoComRecebidas(simBase(), [
      { parcela: 1, valor: 90, data_vencimento: "2025-10-30" },
      { parcela: 2, valor: 95, data_vencimento: "2025-12-05" },
    ]);
    expect(r.parcelas[0]).toEqual({ numero: 1, valor: 90, data: "30/10/2025" });
    expect(r.parcelas[1]).toEqual({ numero: 2, valor: 95, data: "05/12/2025" });
  });

  it("não altera as parcelas que não estão pagas", () => {
    const r = alinharSimulacaoComRecebidas(simBase(), [{ parcela: 1, valor: 90, data_vencimento: "2025-10-30" }]);
    expect(r.parcelas[2]).toEqual({ numero: 3, valor: 100, data: "10/01/2027" });
    expect(r.parcelas[3]).toEqual({ numero: 4, valor: 100, data: "09/02/2027" });
  });

  it("sem parcelas recebidas devolve a simulação intacta", () => {
    const s = simBase();
    expect(alinharSimulacaoComRecebidas(s, [])).toEqual(s);
  });

  it("com entrada, a parcela 1 do financeiro é a entrada e as demais deslocam 1 posição", () => {
    const s = { ...simBase(), entrada: 500, parcelas: simBase().parcelas.slice(0, 3) };
    const r = alinharSimulacaoComRecebidas(s, [
      { parcela: 1, valor: 500, data_vencimento: "2026-01-10" },
      { parcela: 2, valor: 90, data_vencimento: "2026-02-10" },
    ]);
    expect(r.entradaData).toBe("10/01/2026");
    expect(r.parcelas[0]).toEqual({ numero: 1, valor: 90, data: "10/02/2026" });
    expect(r.parcelas[1].data).toBe("11/12/2026");
  });

  it("ignora recebidas fora do intervalo e sem data", () => {
    const r = alinharSimulacaoComRecebidas(simBase(), [
      { parcela: 9, valor: 1, data_vencimento: "2026-01-01" },
      { parcela: 2, valor: 77, data_vencimento: null },
    ]);
    expect(r.parcelas).toEqual(simBase().parcelas.map((p, i) => (i === 1 ? { ...p, valor: 77 } : p)));
  });

  it("não muta o objeto original", () => {
    const s = simBase();
    alinharSimulacaoComRecebidas(s, [{ parcela: 1, valor: 1, data_vencimento: "2020-01-01" }]);
    expect(s).toEqual(simBase());
  });
});
