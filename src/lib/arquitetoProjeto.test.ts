import { describe, it, expect } from "vitest";
import { arquitetoEfetivo, mesmoId, projetosParaAtualizarArquiteto } from "./arquitetoProjeto";

const A = "3b6b3bd8-e877-43c8-8784-9b22ab9a0e22";
const B = "a04d9763-dc76-415e-abfc-99baac5d2be4";

describe("arquitetoEfetivo", () => {
  it("o arquiteto do projeto tem prioridade", () => {
    expect(arquitetoEfetivo(A, B)).toBe(A);
  });
  it("sem arquiteto no projeto, usa o do cliente como padrão", () => {
    expect(arquitetoEfetivo(null, B)).toBe(B);
    expect(arquitetoEfetivo("", B)).toBe(B);
  });
  it("sem nenhum, devolve null", () => {
    expect(arquitetoEfetivo(null, undefined)).toBeNull();
  });
});

describe("mesmoId", () => {
  it("ignora maiúsculas/minúsculas (a limpeza de texto põe UUID em maiúsculas)", () => {
    expect(mesmoId(A.toUpperCase(), A)).toBe(true);
  });
  it("null e vazio são iguais", () => {
    expect(mesmoId(null, "")).toBe(true);
    expect(mesmoId(undefined, null)).toBe(true);
  });
  it("ids diferentes", () => {
    expect(mesmoId(A, B)).toBe(false);
  });
});

describe("projetosParaAtualizarArquiteto", () => {
  const projetos = [
    { id: "p1", arquiteto_id: null },
    { id: "p2", arquiteto_id: A },
    { id: "p3", arquiteto_id: B },
  ];

  it("atualiza projetos sem arquiteto e os que tinham o arquiteto antigo do cliente", () => {
    expect(projetosParaAtualizarArquiteto(projetos, A, B)).toEqual(["p1", "p2"]);
  });

  it("não sobrescreve projeto que tem outro arquiteto escolhido", () => {
    expect(projetosParaAtualizarArquiteto(projetos, A, B)).not.toContain("p3");
  });

  it("nada a fazer se o arquiteto não mudou (mesmo com caixa diferente)", () => {
    expect(projetosParaAtualizarArquiteto(projetos, A, A.toUpperCase())).toEqual([]);
  });

  it("remover o arquiteto do cliente limpa só os projetos que usavam esse arquiteto", () => {
    expect(projetosParaAtualizarArquiteto(projetos, A, null)).toEqual(["p1", "p2"]);
  });

  it("lista vazia de projetos", () => {
    expect(projetosParaAtualizarArquiteto([], null, A)).toEqual([]);
  });
});
