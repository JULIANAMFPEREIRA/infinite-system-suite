import { describe, it, expect } from "vitest";
import { statusParcela, resumoFinanceiroCliente } from "./statusParcela";

const HOJE = "2026-10-13";

describe("statusParcela", () => {
  it("paga", () => {
    expect(statusParcela({ status: "pago", data_vencimento: "2026-09-01" }, HOJE)).toBe("pago");
    expect(statusParcela({ status: "recebido", data_vencimento: "2026-09-01" }, HOJE)).toBe("pago");
  });

  it("parcial e cancelada mantêm o próprio status", () => {
    expect(statusParcela({ status: "parcial", data_vencimento: "2026-01-01" }, HOJE)).toBe("parcial");
    expect(statusParcela({ status: "cancelado", data_vencimento: "2026-01-01" }, HOJE)).toBe("cancelado");
  });

  it("pendente com vencimento passado é vencida", () => {
    expect(statusParcela({ status: "pendente", data_vencimento: "2026-06-15" }, HOJE)).toBe("vencido");
    expect(statusParcela({ status: null, data_vencimento: "2026-10-12" }, HOJE)).toBe("vencido");
  });

  it("pendente que vence hoje ou depois é a vencer", () => {
    expect(statusParcela({ status: "pendente", data_vencimento: HOJE }, HOJE)).toBe("a_vencer");
    expect(statusParcela({ status: "pendente", data_vencimento: "2027-03-05" }, HOJE)).toBe("a_vencer");
  });

  it("status 'vencido' do banco é vencida; 'atrasado' legado também", () => {
    expect(statusParcela({ status: "vencido", data_vencimento: "2026-10-30" }, HOJE)).toBe("vencido");
    expect(statusParcela({ status: "atrasado", data_vencimento: null }, HOJE)).toBe("vencido");
  });

  it("sem data de vencimento e pendente: a vencer", () => {
    expect(statusParcela({ status: "pendente", data_vencimento: null }, HOJE)).toBe("a_vencer");
  });
});

describe("resumoFinanceiroCliente", () => {
  const parcelas = [
    { valor: 1000, valor_recebido: 1000, status: "pago", data_vencimento: "2026-08-01" },
    { valor: 1000, valor_recebido: 400, status: "parcial", data_vencimento: "2026-09-01" },
    { valor: 1000, valor_recebido: 0, status: "pendente", data_vencimento: "2026-09-20" },
    { valor: 1000, valor_recebido: 0, status: "pendente", data_vencimento: "2026-12-01" },
    { valor: 500, valor_recebido: 0, status: "cancelado", data_vencimento: "2026-12-10" },
  ];

  it("soma o que foi pago, o vencido e o a vencer", () => {
    const r = resumoFinanceiroCliente(parcelas, HOJE);
    expect(r.pago).toBe(1400); // 1000 + 400 parcial
    expect(r.vencido).toBe(1600); // 600 restantes da parcial vencida + 1000 pendente vencida
    expect(r.aVencer).toBe(1000);
    expect(r.total).toBe(4000); // cancelada fica fora
  });

  it("lista vazia", () => {
    expect(resumoFinanceiroCliente([], HOJE)).toEqual({ pago: 0, vencido: 0, aVencer: 0, total: 0 });
  });
});
