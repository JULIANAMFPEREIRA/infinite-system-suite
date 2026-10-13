import { describe, it, expect } from "vitest";
import { planComissaoRT } from "./comissaoRT";

const com = (status = "pendente") => ({ id: "c1", status, valor: 1000 });
const par = (id: string, valor: number, status = "pendente") => ({ id, valor, status });

describe("planComissaoRT", () => {
  it("sem comissão e com RT: cria", () => {
    expect(planComissaoRT({ comissao: null, parcelas: [], totalRt: 500, temArquiteto: true }).acao).toBe("criar");
  });

  it("sem arquiteto ou RT zerado e sem comissão: nada", () => {
    expect(planComissaoRT({ comissao: null, parcelas: [], totalRt: 0, temArquiteto: true }).acao).toBe("nada");
    expect(planComissaoRT({ comissao: null, parcelas: [], totalRt: 500, temArquiteto: false }).acao).toBe("nada");
  });

  it("comissão pendente com 1 parcela pendente: atualiza no lugar, mesmo id", () => {
    const r = planComissaoRT({ comissao: com(), parcelas: [par("p1", 1000)], totalRt: 1200, temArquiteto: true });
    expect(r).toMatchObject({ acao: "atualizar", comissaoId: "c1", valor: 1200, parcelaUnicaId: "p1", criarParcela: false });
  });

  it("comissão sem parcela: atualiza e manda criar a parcela", () => {
    const r = planComissaoRT({ comissao: com(), parcelas: [], totalRt: 1200, temArquiteto: true });
    expect(r).toMatchObject({ acao: "atualizar", criarParcela: true, parcelaUnicaId: null });
  });

  it("parcelamento manual (>1 parcelas pendentes) é preservado", () => {
    const r = planComissaoRT({
      comissao: com(),
      parcelas: [par("p1", 500), par("p2", 500)],
      totalRt: 1200,
      temArquiteto: true,
    });
    expect(r.acao).toBe("atualizar");
    if (r.acao === "atualizar") {
      expect(r.parcelaUnicaId).toBeNull();
      expect(r.criarParcela).toBe(false);
      expect(r.aviso).toBeTruthy();
    }
  });

  it("com parcela paga: mantém tudo e avisa se o total mudou", () => {
    const r = planComissaoRT({
      comissao: com(),
      parcelas: [par("p1", 500, "pago"), par("p2", 500)],
      totalRt: 1500,
      temArquiteto: true,
    });
    expect(r.acao).toBe("manter");
    if (r.acao === "manter") expect(r.aviso).toBeTruthy();
  });

  it("com parcela paga e total igual: mantém sem aviso", () => {
    const r = planComissaoRT({
      comissao: com(),
      parcelas: [par("p1", 500, "pago"), par("p2", 500)],
      totalRt: 1000,
      temArquiteto: true,
    });
    expect(r).toEqual({ acao: "manter", comissaoId: "c1" });
  });

  it("comissão marcada paga nunca é alterada", () => {
    const r = planComissaoRT({ comissao: com("pago"), parcelas: [par("p1", 1000)], totalRt: 2000, temArquiteto: true });
    expect(r.acao).toBe("manter");
  });

  it("RT zerado sem nada pago: remove comissão e parcelas pendentes", () => {
    const r = planComissaoRT({ comissao: com(), parcelas: [par("p1", 500), par("p2", 500)], totalRt: 0, temArquiteto: true });
    expect(r).toEqual({ acao: "remover", comissaoId: "c1", parcelaIds: ["p1", "p2"] });
  });

  it("RT zerado mas com parcela paga: não remove", () => {
    const r = planComissaoRT({ comissao: com(), parcelas: [par("p1", 500, "pago")], totalRt: 0, temArquiteto: true });
    expect(r.acao).toBe("manter");
  });
});
