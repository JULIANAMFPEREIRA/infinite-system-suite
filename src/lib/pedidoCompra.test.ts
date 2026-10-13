import { describe, it, expect } from "vitest";
import { qtdRestante, podeExcluirPedido, resumoRecebimento } from "./pedidoCompra";

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
