import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { planejarAprovacao, type EntradaPlanoAprovacao } from "./planoAprovacao";

const ARQ = "arq-1";

function seqId() {
  let n = 0;
  return () => `id-${++n}`;
}

function base(over: Partial<EntradaPlanoAprovacao> = {}): EntradaPlanoAprovacao {
  return {
    empresaId: "emp-1",
    orcamento: {
      id: "orc-1", nome: "Casa", aprovado: false, grupo_id: null, frete: 0, imposto: 0,
      simulacao_pagamento: {
        formaPagamento: "PIX", entrada: 100, entradaData: "10/12/2026",
        parcelas: [{ valor: 450, data: "10/01/2027" }, { valor: 450, data: "10/02/2027" }],
      },
    },
    itens: [
      { descricao: "Som", quantidade: 1, preco_custo: 500, preco_venda: 800, tipo: "produto", produto_id: "p1", rt_comissao: 50 },
      { descricao: "Instalação", quantidade: 2, preco_custo: 0, preco_venda: 100, tipo: "servico", rt_comissao: 0 },
    ],
    cliente: { id: "cli-1", nome: "TESTE", endereco: "Rua A", arquiteto_id: null, status_crm: "orcamento", notas: null },
    origemLabel: "",
    projetoExistente: null,
    parcelasReceberExistentes: [],
    temComissaoPaga: false,
    comissoes: [],
    parcelasComissao: [],
    categoriaRtId: "cat-rt",
    projetosParceirosExistentes: [],
    contasPagarExtrasExistentes: [],
    totalOrcamentosCliente: 1,
    marcarAprovado: false,
    hoje: "2026-11-23",
    agoraLabel: "23/11/2026 10:00",
    gerarId: seqId(),
    ...over,
  };
}

describe("planejarAprovacao - projeto", () => {
  it("projeto novo: modo inserir com id gerado e campos completos", () => {
    const { plano, projetoExistia } = planejarAprovacao(base());
    expect(projetoExistia).toBe(false);
    expect(plano.projeto.modo).toBe("inserir");
    expect(plano.projeto.campos).toMatchObject({
      id: plano.projeto.id, empresa_id: "emp-1", nome: "TESTE — Casa", status: "infraestrutura",
      cliente_id: "cli-1", orcamento_id: "orc-1", data_inicio: "2026-11-23",
      endereco_obra: "Rua A", numero_parcelas: 2, forma_pagamento: "PIX",
      observacoes_pagamento: "Criado em 23/11/2026 10:00",
    });
    expect(plano.projeto.campos.venda_total).toBe(1000);
    expect(plano.projeto_itens.substituir.every(i => i.projeto_id === plano.projeto.id)).toBe(true);
  });

  it("projeto existente: modo atualizar, mesmo id, sem recriar", () => {
    const { plano, projetoExistia } = planejarAprovacao(base({ projetoExistente: { id: "proj-9", arquiteto_id: null } }));
    expect(projetoExistia).toBe(true);
    expect(plano.projeto).toMatchObject({ id: "proj-9", modo: "atualizar" });
    expect(plano.projeto.campos.observacoes_pagamento).toBe("Sincronizado em 23/11/2026 10:00");
    expect(plano.projeto.campos.id).toBeUndefined();
    expect(plano.projeto_itens.substituir.every(i => i.projeto_id === "proj-9")).toBe(true);
  });

  it("descricao inclui origem e observacoes do cliente", () => {
    const { plano } = planejarAprovacao(base({ origemLabel: "Indicação", cliente: { id: "c", nome: "N", notas: "VIP" } }));
    expect(plano.projeto.campos.descricao).toBe("Projeto criado a partir do CRM — Casa | Origem: Indicação | Obs: VIP");
  });
});

describe("planejarAprovacao - contas a receber", () => {
  it("entrada + parcelas viram parcelas numeradas 1..n com descricao", () => {
    const { plano } = planejarAprovacao(base());
    expect(plano.receber!.apagar_ids).toEqual([]);
    expect(plano.receber!.inserir.map(r => [r.parcela, r.valor, r.data_vencimento, r.descricao, r.status])).toEqual([
      [1, 100, "2026-12-10", "Parcela 1/3 — TESTE", "pendente"],
      [2, 450, "2027-01-10", "Parcela 2/3 — TESTE", "pendente"],
      [3, 450, "2027-02-10", "Parcela 3/3 — TESTE", "pendente"],
    ]);
  });

  it("parcela paga é mantida (não apagada) e o número dela fica reservado", () => {
    const { plano } = planejarAprovacao(base({
      projetoExistente: { id: "proj-9", arquiteto_id: null },
      parcelasReceberExistentes: [
        { id: "r1", parcela: 1, status: "pago", valor_recebido: 100 },
        { id: "r2", parcela: 2, status: "pendente", valor_recebido: 0 },
        { id: "r3", parcela: 3, status: null, valor_recebido: 0 },
      ],
    }));
    expect(plano.receber!.apagar_ids).toEqual(["r2", "r3"]);
    expect(plano.receber!.inserir.map(r => r.parcela)).toEqual([2, 3]);
  });

  it("parcela parcial (valor recebido) nunca é apagada", () => {
    const { plano } = planejarAprovacao(base({
      projetoExistente: { id: "proj-9", arquiteto_id: null },
      parcelasReceberExistentes: [{ id: "r1", parcela: 1, status: "pendente", valor_recebido: 30 }],
    }));
    expect(plano.receber!.apagar_ids).toEqual([]);
    expect(plano.receber!.inserir.map(r => r.parcela)).toEqual([2, 3]);
  });

  it("skipReceber: seção receber ausente", () => {
    const { plano } = planejarAprovacao(base({ opts: { skipReceber: true } }));
    expect(plano.receber).toBeNull();
  });

  it("orçamento com grupo_id: seção receber ausente", () => {
    const e = base();
    e.orcamento.grupo_id = "g1";
    expect(planejarAprovacao(e).plano.receber).toBeNull();
  });

  it("sem parcelas: cria uma única 'Conta a receber' com o total", () => {
    const e = base();
    e.orcamento.simulacao_pagamento = {};
    const { plano } = planejarAprovacao(e);
    expect(plano.receber!.inserir).toHaveLength(1);
    expect(plano.receber!.inserir[0]).toMatchObject({
      descricao: "Conta a receber — TESTE", valor: 1000, parcela: 1, status: "pendente",
    });
    expect(plano.receber!.inserir[0].data_vencimento).toBeUndefined();
  });

  it("sem parcelas e com alguma já paga: não cria a conta única", () => {
    const e = base({
      projetoExistente: { id: "proj-9", arquiteto_id: null },
      parcelasReceberExistentes: [
        { id: "r1", parcela: 1, status: "pago", valor_recebido: 500 },
        { id: "r2", parcela: 2, status: "pendente", valor_recebido: 0 },
      ],
    });
    e.orcamento.simulacao_pagamento = {};
    const { plano } = planejarAprovacao(e);
    expect(plano.receber!.inserir).toEqual([]);
    expect(plano.receber!.apagar_ids).toEqual(["r2"]);
  });
});

describe("planejarAprovacao - comissão RT", () => {
  const comArq = { cliente: { id: "cli-1", nome: "TESTE", arquiteto_id: ARQ, status_crm: "orcamento" } };

  it("comissão já paga no projeto: seção comissoes ausente (RT inteira ignorada)", () => {
    const { plano } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: ARQ }, temComissaoPaga: true,
    }));
    expect(plano.comissoes).toBeNull();
    expect(plano.projeto_parceiros).toBeNull();
    expect(plano.projeto_arquiteto_id).toBeNull();
  });

  it("arquiteto do cliente vale quando o projeto não tem; projeto grava o arquiteto", () => {
    const { plano } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: null },
    }));
    expect(plano.projeto_arquiteto_id).toBe(ARQ);
    expect(plano.comissoes!.inserir).toMatchObject({ fornecedor_id: ARQ, valor: 50, status: "pendente", projeto_id: "proj-9" });
  });

  it("arquiteto do projeto prevalece sobre o do cliente", () => {
    const { plano } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: "outro" },
    }));
    expect(plano.projeto_arquiteto_id).toBeNull();
    expect(plano.comissoes!.inserir!.fornecedor_id).toBe("outro");
  });

  it("sobrescrita do arquiteto do cliente (clienteArquitetoId) é respeitada", () => {
    const { plano } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: null }, opts: { skipReceber: true, clienteArquitetoId: null },
    }));
    expect(plano.comissoes!.inserir).toBeNull();
    expect(plano.projeto_arquiteto_id).toBeNull();
  });

  it("comissão nova + parcela única com comissao_id igual ao id da comissão", () => {
    const { plano } = planejarAprovacao(base({ ...comArq }));
    const c = plano.comissoes!;
    expect(c.inserir).toMatchObject({ projeto_id: plano.projeto.id, fornecedor_id: ARQ, valor: 50 });
    expect(c.parcelas_inserir).toHaveLength(1);
    expect(c.parcelas_inserir[0]).toMatchObject({
      comissao_id: c.inserir!.id, projeto_id: plano.projeto.id, fornecedor_id: ARQ, valor: 50,
      descricao: "Comissão RT — TESTE", origem: "comissao", categoria_id: "cat-rt", tipo_manual: "Comissão RT", status: "pendente",
    });
    expect(c.remover).toEqual([]);
    expect(c.atualizar).toEqual([]);
  });

  it("comissão existente com 1 parcela: atualiza no lugar (mesmo id) e a parcela única", () => {
    const { plano } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: ARQ },
      comissoes: [{ id: "com-1", status: "pendente", valor: 10, fornecedor_id: ARQ, created_at: "2026-01-01" }],
      parcelasComissao: [{ id: "pg-1", valor: 10, status: "pendente", comissao_id: "com-1" }],
    }));
    const c = plano.comissoes!;
    expect(c.inserir).toBeNull();
    expect(c.parcelas_inserir).toEqual([]);
    expect(c.atualizar).toEqual([{ id: "com-1", valor: 50, percentual: 5, parcela_unica_id: "pg-1", criar_parcela: false }]);
  });

  it("comissão existente sem parcela: atualiza e cria a parcela ligada ao mesmo id", () => {
    const { plano } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: ARQ },
      comissoes: [{ id: "com-1", status: "pendente", valor: 10, fornecedor_id: ARQ }],
    }));
    const c = plano.comissoes!;
    expect(c.atualizar[0]).toMatchObject({ id: "com-1", criar_parcela: true, parcela_unica_id: null });
    expect(c.parcelas_inserir[0]).toMatchObject({ comissao_id: "com-1", valor: 50 });
  });

  it("comissão com parcela paga é mantida; aviso quando o RT diverge", () => {
    const { plano, avisos } = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: ARQ },
      comissoes: [{ id: "com-1", status: "pendente", valor: 10, fornecedor_id: ARQ }],
      parcelasComissao: [{ id: "pg-1", valor: 10, status: "pago", comissao_id: "com-1" }],
    }));
    expect(plano.comissoes!.atualizar).toEqual([]);
    expect(plano.comissoes!.remover).toEqual([]);
    expect(plano.comissoes!.inserir).toBeNull();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/parcelas já pagas/);
  });

  it("RT zerada sem arquiteto: remove comissão não paga e só as parcelas não pagas", () => {
    const e = base({
      projetoExistente: { id: "proj-9", arquiteto_id: null },
      comissoes: [{ id: "com-1", status: "pendente", valor: 10, fornecedor_id: ARQ }],
      parcelasComissao: [
        { id: "pg-1", valor: 5, status: "pendente", comissao_id: "com-1" },
        { id: "pg-2", valor: 5, status: "pendente", comissao_id: "com-1" },
      ],
    });
    const { plano } = planejarAprovacao(e);
    expect(plano.comissoes!.remover).toEqual([{ comissao_id: "com-1", parcela_ids: ["pg-1", "pg-2"] }]);
  });

  it("vincula arquiteto em projeto_parceiros: inserir se novo, atualizar se já existe", () => {
    const novo = planejarAprovacao(base({ ...comArq })).plano.projeto_parceiros!;
    expect(novo.atualizar).toBeNull();
    expect(novo.inserir).toMatchObject({
      parceiro_id: ARQ, rt_tipo: "fixo", rt_base: "rt_itens", rt_valor: 50, rt_total: 50, rt_recebido: 0, rt_percentual: 5,
    });
    const existente = planejarAprovacao(base({
      ...comArq, projetoExistente: { id: "proj-9", arquiteto_id: ARQ },
      projetosParceirosExistentes: [{ id: "pp-1", parceiro_id: ARQ }],
    })).plano.projeto_parceiros!;
    expect(existente.inserir).toBeNull();
    expect(existente.atualizar).toEqual({ id: "pp-1", rt_valor: 50, rt_total: 50 });
  });

  it("sem arquiteto: não há RT nem vínculo", () => {
    const { plano } = planejarAprovacao(base());
    expect(plano.comissoes!.inserir).toBeNull();
    expect(plano.comissoes!.parcelas_inserir).toEqual([]);
    expect(plano.projeto_parceiros).toBeNull();
  });
});

describe("planejarAprovacao - compras, necessidades e extras", () => {
  it("só itens do tipo produto geram compras/necessidades, ligados ao id do item", () => {
    const { plano } = planejarAprovacao(base());
    const produto = plano.projeto_itens.substituir.find(i => i.tipo === "produto")!;
    expect(plano.compras.inserir).toHaveLength(1);
    expect(plano.compras.inserir[0]).toMatchObject({
      projeto_item_id: produto.id, projeto_id: plano.projeto.id, produto_id: "p1", descricao: "Som",
      quantidade: 1, status: "pendente", valor_unitario: 500, valor_total: 500,
    });
    expect(plano.necessidades.inserir).toHaveLength(1);
    expect(plano.necessidades.inserir[0]).toMatchObject({ projeto_item_id: produto.id, status: "pendente", descricao: "Som" });
  });

  it("tipo inválido vira produto; quantidade/custo zerados são normalizados", () => {
    const e = base();
    e.itens = [{ descricao: "X", quantidade: 0, preco_custo: 10, preco_venda: 20, tipo: "qualquer" }];
    const { plano } = planejarAprovacao(e);
    expect(plano.projeto_itens.substituir[0]).toMatchObject({ tipo: "produto", quantidade: 1, rt_percentual: 0 });
    expect(plano.compras.inserir[0].valor_total).toBe(10);
  });

  it("frete e imposto viram contas a pagar; só pendentes antigas sem comissão/fornecedor são apagadas", () => {
    const e = base({
      projetoExistente: { id: "proj-9", arquiteto_id: null },
      contasPagarExtrasExistentes: [
        { id: "x1", status: "pendente" }, { id: "x2", status: "pago" }, { id: "x3", status: "pendente" },
      ],
    });
    e.orcamento.frete = 80; e.orcamento.imposto = 120;
    e.orcamento.frete_vencimento = "2027-01-05";
    const { plano } = planejarAprovacao(e);
    expect(plano.pagar_extras.apagar_ids).toEqual(["x1", "x3"]);
    expect(plano.pagar_extras.inserir).toHaveLength(2);
    expect(plano.pagar_extras.inserir[0]).toMatchObject({
      descricao: "Frete — TESTE", valor: 80, status: "pendente", data_vencimento: "2027-01-05", projeto_id: "proj-9",
    });
    expect(plano.pagar_extras.inserir[1]).toMatchObject({ descricao: "Imposto — TESTE", valor: 120, data_vencimento: null });
  });

  it("sem frete/imposto: nada a inserir", () => {
    expect(planejarAprovacao(base()).plano.pagar_extras.inserir).toEqual([]);
  });
});

describe("planejarAprovacao - aprovação", () => {
  it("marcarAprovado + cliente com 1 orçamento: muda status_crm do cliente", () => {
    const { plano } = planejarAprovacao(base({ marcarAprovado: true, totalOrcamentosCliente: 1 }));
    expect(plano.marcar_aprovado).toBe(true);
    expect(plano.cliente_status_crm).toEqual({ cliente_id: "cli-1", status: "projeto" });
  });

  it("cliente com 2 ou mais orçamentos: não mexe no status_crm do cliente", () => {
    const { plano } = planejarAprovacao(base({ marcarAprovado: true, totalOrcamentosCliente: 2 }));
    expect(plano.marcar_aprovado).toBe(true);
    expect(plano.cliente_status_crm).toBeNull();
  });

  it("cliente que já está em 'projeto': não repete a mudança", () => {
    const e = base({ marcarAprovado: true });
    e.cliente.status_crm = "projeto";
    expect(planejarAprovacao(e).plano.cliente_status_crm).toBeNull();
  });

  it("sync comum (sem aprovar): não marca aprovado nem mexe no cliente", () => {
    const { plano } = planejarAprovacao(base());
    expect(plano.marcar_aprovado).toBe(false);
    expect(plano.cliente_status_crm).toBeNull();
  });
});

describe("migration aplicar_plano_aprovacao", () => {
  const file = path.resolve(__dirname, "../../supabase/migrations/20261123120000_aplicar_plano_aprovacao.sql");

  it("existe e usa SECURITY INVOKER (RLS continua valendo)", () => {
    expect(existsSync(file)).toBe(true);
    const sql = readFileSync(file, "utf-8");
    expect(sql).toMatch(/security invoker/i);
    expect(sql).not.toMatch(/security definer/i);
  });

  it("restringe a execução a usuários autenticados e recarrega o cache", () => {
    const sql = readFileSync(file, "utf-8");
    expect(sql).toMatch(/revoke all on function public\.aplicar_plano_aprovacao\(jsonb\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.aplicar_plano_aprovacao\(jsonb\) to authenticated/i);
    expect(sql).toMatch(/notify pgrst, 'reload schema'/i);
  });
});
