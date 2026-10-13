import { describe, it, expect } from "vitest";
import {
  qtdRestante, podeExcluirPedido, resumoRecebimento,
  diasParaVencer, alertasPolitica, agruparPorCliente, segmentosRecebimento, totalPedido,
} from "./pedidoCompra";

describe("qtdRestante", () => {
  it("é a quantidade do item menos o que já está em outros pedidos", () => {
    expect(qtdRestante(10, 0)).toBe(10);
    expect(qtdRestante(10, 3)).toBe(7);
  });
  it("nunca fica negativa", () => {
    expect(qtdRestante(5, 8)).toBe(0);
  });
  it("aceita quantidades fracionadas sem erro de ponto flutuante", () => {
    expect(qtdRestante(1, 0.7)).toBe(0.3);
  });
});

describe("podeExcluirPedido", () => {
  it("pode excluir quando nada foi recebido", () => {
    expect(podeExcluirPedido(0)).toBe(true);
  });
  it("não pode excluir quando já há recebimento (o Pré-Projeto já foi alterado)", () => {
    expect(podeExcluirPedido(2)).toBe(false);
  });
});

describe("resumoRecebimento", () => {
  it("conta itens completos, parciais e o total recebido", () => {
    const r = resumoRecebimento([
      { quantidade: 5, recebida: 5 },
      { quantidade: 3, recebida: 1 },
      { quantidade: 2, recebida: 0 },
    ]);
    expect(r).toEqual({ total: 3, completos: 1, parciais: 1, recebido: 6 });
  });
  it("lista vazia", () => {
    expect(resumoRecebimento([])).toEqual({ total: 0, completos: 0, parciais: 0, recebido: 0 });
  });
});

describe("diasParaVencer", () => {
  it("conta os dias até a validade da proposta", () => {
    expect(diasParaVencer("2026-10-18", "2026-10-13")).toBe(5);
    expect(diasParaVencer("2026-10-13", "2026-10-13")).toBe(0);
  });
  it("negativo quando já venceu", () => {
    expect(diasParaVencer("2026-10-10", "2026-10-13")).toBe(-3);
  });
  it("sem validade informada devolve null", () => {
    expect(diasParaVencer(null, "2026-10-13")).toBeNull();
    expect(diasParaVencer("", "2026-10-13")).toBeNull();
  });
});

describe("alertasPolitica (regras do fornecedor)", () => {
  it("avisa quanto falta para o pedido mínimo", () => {
    const a = alertasPolitica({ subtotalProdutos: 1800, pedidoMinimo: 2500, freteCifAcimaDe: null, freteTipo: null });
    expect(a).toHaveLength(1);
    expect(a[0].tipo).toBe("atencao");
    expect(a[0].texto).toContain("700");
    expect(a[0].texto.toLowerCase()).toContain("mínimo");
  });
  it("confirma quando o pedido mínimo foi atingido", () => {
    const a = alertasPolitica({ subtotalProdutos: 2500, pedidoMinimo: 2500, freteCifAcimaDe: null, freteTipo: null });
    expect(a[0].tipo).toBe("ok");
  });
  it("informa quanto falta para o frete CIF", () => {
    const a = alertasPolitica({ subtotalProdutos: 9000, pedidoMinimo: 2500, freteCifAcimaDe: 10000, freteTipo: "FOB" });
    const cif = a.find(x => x.texto.includes("CIF"));
    expect(cif?.tipo).toBe("info");
    expect(cif?.texto).toContain("1.000");
  });
  it("frete CIF liberado acima do limite", () => {
    const a = alertasPolitica({ subtotalProdutos: 12000, pedidoMinimo: null, freteCifAcimaDe: 10000, freteTipo: "CIF" });
    expect(a.find(x => x.texto.includes("CIF"))?.tipo).toBe("ok");
  });
  it("sem regras cadastradas não gera alerta", () => {
    expect(alertasPolitica({ subtotalProdutos: 100, pedidoMinimo: null, freteCifAcimaDe: null, freteTipo: null })).toEqual([]);
  });
});

describe("agruparPorCliente", () => {
  const itens = [
    { id: 1, cliente_id: "a", cliente_nome: "ANGELA" },
    { id: 2, cliente_id: "b", cliente_nome: "RUI" },
    { id: 3, cliente_id: "a", cliente_nome: "ANGELA" },
    { id: 4, cliente_id: null, cliente_nome: null },
  ];
  it("junta os itens do mesmo cliente, mantendo a ordem de aparição", () => {
    const g = agruparPorCliente(itens);
    expect(g.map(x => x.nome)).toEqual(["ANGELA", "RUI", "Sem cliente"]);
    expect(g[0].itens.map(i => i.id)).toEqual([1, 3]);
  });
  it("itens avulsos ficam no fim, em 'Sem cliente'", () => {
    const g = agruparPorCliente([{ id: 9, cliente_id: null, cliente_nome: null }, { id: 8, cliente_id: "z", cliente_nome: "ZÉ" }]);
    expect(g[g.length - 1].nome).toBe("Sem cliente");
  });
});

describe("segmentosRecebimento (faixa de chegada)", () => {
  it("um segmento por item: vazio, parcial ou cheio", () => {
    const s = segmentosRecebimento([
      { quantidade: 4, recebida: 4 },
      { quantidade: 4, recebida: 1 },
      { quantidade: 4, recebida: 0 },
    ]);
    expect(s).toEqual(["cheio", "parcial", "vazio"]);
  });
  it("lista vazia", () => {
    expect(segmentosRecebimento([])).toEqual([]);
  });
});

describe("totalPedido", () => {
  it("soma itens + frete + IPI + ICMS ST e subtrai o desconto geral (caso Controlart 17105)", () => {
    const t = totalPedido({
      itens: [
        { qtd: 1, valor_unit: 48.33, desconto: 2.9 },
        { qtd: 1, valor_unit: 683.31, desconto: 41 },
        { qtd: 2, valor_unit: 48.33, desconto: 5.8 },
        { qtd: 2, valor_unit: 722.77, desconto: 86.73 },
        { qtd: 1, valor_unit: 2063.46, desconto: 123.81 },
        { qtd: 5, valor_unit: 32.54, desconto: 9.76 },
        { qtd: 1, valor_unit: 42.9, desconto: 2.57 },
      ],
      frete: 240.54, ipi: 309.05, icmsSt: 0, descontoTotal: 0,
    });
    expect(t.subtotal).toBe(4270.33);
    expect(t.total).toBe(4819.92);
  });
  it("caso Chiave 65219 (IPI separado, sem frete)", () => {
    const t = totalPedido({
      itens: [
        { qtd: 1, valor_unit: 1851.02, desconto: 0 },
        { qtd: 6, valor_unit: 318.84, desconto: 0 },
        { qtd: 2, valor_unit: 1457.9, desconto: 0 },
      ],
      frete: 0, ipi: 848.9, icmsSt: 0, descontoTotal: 0,
    });
    expect(t.subtotal).toBe(6679.86);
    expect(t.total).toBe(7528.76);
  });
});
