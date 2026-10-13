import { describe, it, expect } from "vitest";
import { planParcelasReceber } from "./parcelasReceber";

const desejadas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ valor: 100 * (i + 1), data: `2026-0${i + 1}-15` }));

const pago = (id: string, parcela: number) => ({ id, parcela, status: "pago", valor_recebido: 100 });
const pendente = (id: string, parcela: number) => ({ id, parcela, status: "pendente", valor_recebido: 0 });

describe("planParcelasReceber", () => {
  it("sem nada pago, gera 1..N", () => {
    const r = planParcelasReceber([], desejadas(3));
    expect(r.inserts.map(i => i.parcela)).toEqual([1, 2, 3]);
    expect(r.idsApagar).toEqual([]);
  });

  it("1 paga + 3 desejadas: gera 2 e 3 sem repetir número (bug original gerava 2 e 2)", () => {
    const r = planParcelasReceber([pago("a", 1)], desejadas(3));
    expect(r.inserts.map(i => i.parcela)).toEqual([2, 3]);
    expect(r.inserts.map(i => i.valor)).toEqual([200, 300]);
  });

  it("2 pagas + 4 desejadas: gera 3 e 4 (bug original gerava 3 e 3)", () => {
    const r = planParcelasReceber([pago("a", 1), pago("b", 2)], desejadas(4));
    expect(r.inserts.map(i => i.parcela)).toEqual([3, 4]);
    expect(r.inserts.map(i => i.valor)).toEqual([300, 400]);
  });

  it("pagas fora de sequência {1,3}: cada nova mantém o valor e data da sua posição", () => {
    const r = planParcelasReceber([pago("a", 1), pago("b", 3)], desejadas(5));
    expect(r.inserts.map(i => i.parcela)).toEqual([2, 4, 5]);
    expect(r.inserts.map(i => i.valor)).toEqual([200, 400, 500]);
    expect(r.inserts.map(i => i.data)).toEqual(["2026-02-15", "2026-04-15", "2026-05-15"]);
  });

  it("apaga somente pendentes; nunca pago, parcial ou com valor recebido", () => {
    const r = planParcelasReceber(
      [
        pago("a", 1),
        { id: "b", parcela: 2, status: "parcial", valor_recebido: 50 },
        pendente("c", 3),
        { id: "d", parcela: 4, status: null, valor_recebido: 0 },
        { id: "e", parcela: 5, status: "pendente", valor_recebido: 10 },
      ],
      desejadas(5),
    );
    expect(r.idsApagar.sort()).toEqual(["c", "d"]);
  });

  it("não duplica quando já existe parcela em outro status (ex.: vencido)", () => {
    const r = planParcelasReceber(
      [pago("a", 1), { id: "v", parcela: 2, status: "vencido", valor_recebido: 0 }],
      desejadas(3),
    );
    expect(r.idsApagar).toEqual([]);
    expect(r.inserts.map(i => i.parcela)).toEqual([3]);
  });

  it("se há mais pagas que parcelas desejadas, não gera nada", () => {
    const r = planParcelasReceber([pago("a", 1), pago("b", 2), pago("c", 3)], desejadas(2));
    expect(r.inserts).toEqual([]);
  });

  it("informa o total para a descrição 'n/total'", () => {
    const r = planParcelasReceber([pago("a", 1)], desejadas(8));
    expect(r.total).toBe(8);
  });

  it("arredonda valores a 2 casas", () => {
    const r = planParcelasReceber([], [{ valor: 40324.5025, data: null }]);
    expect(r.inserts[0].valor).toBe(40324.5);
  });
});
