import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regra: o que foi "excluído" (deletado = true) nunca aparece nos portais.
 * Aconteceu em 13/10/2026: a linha antiga da RT da Bia, marcada como excluída, ainda era
 * somada no portal dela (RT total dobrou). Estes testes impedem a volta do problema.
 */
const ler = (rel: string) => readFileSync(resolve(__dirname, "..", rel), "utf8");

/** devolve o trecho da consulta que começa em .from("tabela") até 700 caracteres adiante */
const consulta = (src: string, tabela: string) => {
  const i = src.indexOf(`.from("${tabela}")`);
  if (i < 0) throw new Error(`consulta de ${tabela} não encontrada`);
  return src.slice(i, i + 700);
};

describe("Portal do parceiro/arquiteto/técnico ignora excluídos", () => {
  const src = ler("pages/portal/PortalParceiros.tsx");

  it("parcelas de RT (financeiro_pagar) filtram deletado", () => {
    expect(consulta(src, "financeiro_pagar")).toContain('.eq("deletado", false)');
  });

  it("comissões filtram deletado", () => {
    expect(consulta(src, "comissoes")).toContain('.eq("deletado", false)');
  });

  it("parceiro excluído não entra no portal (busca por e-mail filtra deletado)", () => {
    expect(consulta(src, "fornecedores")).toContain('.eq("deletado", false)');
  });
});

describe("Portal do cliente ignora excluídos", () => {
  const src = ler("pages/portal/PortalCliente.tsx");

  it("cliente excluído não entra no portal (por login e por e-mail)", () => {
    const trechos = src.split('.from("clientes").select("id, nome")').slice(1);
    expect(trechos.length).toBe(2);
    for (const t of trechos) expect(t.slice(0, 120)).toContain('.eq("deletado", false)');
  });

  it("financeiro do cliente filtra deletado", () => {
    expect(consulta(src, "financeiro_receber")).toContain('.eq("deletado", false)');
  });

  it("pendências de compra filtram deletado", () => {
    expect(consulta(src, "necessidades_compra")).toMatch(/deletado.{0,12}false/);
  });
});
