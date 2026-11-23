/**
 * Plano de gravação da aprovação de orçamento (C4).
 *
 * A aprovação lê os dados (cliente), monta este plano (função pura, testada) e
 * grava TUDO de uma vez com a função do banco `aplicar_plano_aprovacao`
 * (uma transação só: ou grava tudo, ou não grava nada).
 *
 * As regras financeiras vivem nos módulos já testados:
 *  - parcelasReceber.ts (parcela paga nunca é tocada; parcela n recebe o número n)
 *  - comissaoRT.ts (comissão atualizada no lugar; nunca apaga o que foi pago)
 *  - orcamentoCalc.ts (totais) e arquitetoProjeto.ts (arquiteto por projeto)
 */
import { calcOrcamentoTotals } from "./orcamentoCalc";
import { planParcelasReceber, type ParcelaExistente } from "./parcelasReceber";
import { planComissaoRT } from "./comissaoRT";
import { arquitetoEfetivo } from "./arquitetoProjeto";

// ───────────────────────── Entrada (dados lidos) ─────────────────────────

export type OrcamentoEntrada = {
  id: string;
  nome: string | null;
  aprovado: boolean;
  grupo_id?: string | null;
  frete?: number | null;
  imposto?: number | null;
  frete_vencimento?: string | null;
  imposto_vencimento?: string | null;
  simulacao_pagamento?: any;
};

export type ItemEntrada = {
  descricao?: string | null;
  quantidade?: number | null;
  preco_custo?: number | null;
  preco_venda?: number | null;
  tipo?: string | null;
  produto_id?: string | null;
  rt_comissao?: number | null;
};

export type ClienteEntrada = {
  id: string;
  nome: string;
  endereco_obra?: string | null;
  endereco?: string | null;
  arquiteto_id?: string | null;
  status_crm?: string | null;
  notas?: string | null;
};

export type ComissaoLida = {
  id: string;
  status: string | null;
  valor: number | null;
  fornecedor_id: string | null;
  created_at?: string | null;
};

export type ParcelaPagarLida = {
  id: string;
  valor: number | null;
  status: string | null;
  comissao_id: string | null;
};

export type EntradaPlanoAprovacao = {
  empresaId: string;
  orcamento: OrcamentoEntrada;
  itens: ItemEntrada[];
  cliente: ClienteEntrada;
  /** Texto já traduzido da origem do lead (ex.: "Indicação"), ou "". */
  origemLabel: string;
  /** Projeto já ligado a este orçamento (o primeiro), se houver. */
  projetoExistente: { id: string; arquiteto_id: string | null } | null;
  parcelasReceberExistentes: ParcelaExistente[];
  /** Existe alguma comissão com status "pago" neste projeto? */
  temComissaoPaga: boolean;
  comissoes: ComissaoLida[];
  parcelasComissao: ParcelaPagarLida[];
  categoriaRtId: string | null;
  /** Vínculos já existentes em projeto_parceiros deste projeto. */
  projetosParceirosExistentes: { id: string; parceiro_id: string }[];
  /** Contas a pagar do projeto sem comissão e sem fornecedor (frete/imposto antigos). */
  contasPagarExtrasExistentes: { id: string; status: string | null }[];
  /** Quantos orçamentos o cliente tem (conta este). */
  totalOrcamentosCliente: number;
  opts?: {
    skipReceber?: boolean;
    /** Sobrescreve o arquiteto padrão do cliente (undefined = usar o do cliente). */
    clienteArquitetoId?: string | null;
  };
  /** true = esta chamada é a aprovação (marca aprovado + kanban no mesmo plano). */
  marcarAprovado: boolean;
  /** "YYYY-MM-DD" de hoje. */
  hoje: string;
  /** Texto de data/hora pt-BR para as observações. */
  agoraLabel: string;
  gerarId?: () => string;
};

// ───────────────────────── Saída (plano) ─────────────────────────

export type PlanoAprovacao = {
  orcamento_id: string;
  marcar_aprovado: boolean;
  cliente_status_crm: { cliente_id: string; status: string } | null;
  projeto: { id: string; modo: "inserir" | "atualizar"; campos: Record<string, any> };
  projeto_itens: { substituir: Record<string, any>[] };
  receber: { apagar_ids: string[]; inserir: Record<string, any>[] } | null;
  /** null quando já existe comissão paga (RT inteira é ignorada). */
  comissoes: {
    remover: { comissao_id: string; parcela_ids: string[] }[];
    atualizar: {
      id: string;
      valor: number;
      percentual: number;
      parcela_unica_id: string | null;
      criar_parcela: boolean;
    }[];
    inserir: Record<string, any> | null;
    parcelas_inserir: Record<string, any>[];
  } | null;
  projeto_arquiteto_id: string | null;
  projeto_parceiros: {
    inserir: Record<string, any> | null;
    atualizar: { id: string; rt_valor: number; rt_total: number } | null;
  } | null;
  compras: { inserir: Record<string, any>[] };
  necessidades: { inserir: Record<string, any>[] };
  pagar_extras: { apagar_ids: string[]; inserir: Record<string, any>[] };
};

export type ResultadoPlanoAprovacao = {
  plano: PlanoAprovacao;
  avisos: string[];
  /** true quando o projeto já existia (só atualiza). */
  projetoExistia: boolean;
};

const parseDate = (d: string) => {
  if (d.includes("/")) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return d;
};

export function planejarAprovacao(entrada: EntradaPlanoAprovacao): ResultadoPlanoAprovacao {
  const gerarId = entrada.gerarId ?? (() => crypto.randomUUID());
  const { empresaId, orcamento: orc, cliente, opts } = entrada;
  const items = entrada.itens ?? [];
  const avisos: string[] = [];

  const totals = calcOrcamentoTotals({
    itens: items,
    frete: orc.frete,
    imposto: orc.imposto,
    simulacao_pagamento: orc.simulacao_pagamento,
  });
  const totalVenda = totals.totalVenda;
  const totalCusto = totals.totalCusto;
  const margem = totals.margem;

  const sim = orc.simulacao_pagamento ?? {};
  const simParcelas: any[] = sim.parcelas ?? [];
  const simFormaPgto = sim.formaPagamento ?? "";
  const simEntradaValor = Number(sim.entrada) || 0;
  const simEntradaData = sim.entradaData ?? null;
  const frete = totals.frete;
  const imposto = totals.imposto;

  const descParts = [`Projeto criado a partir do CRM — ${orc.nome ?? "Orçamento"}`];
  if (entrada.origemLabel) descParts.push(`Origem: ${entrada.origemLabel}`);
  if (cliente.notas) descParts.push(`Obs: ${cliente.notas}`);
  const descricao = descParts.join(" | ");
  const numeroParcelas = simParcelas.length > 0 ? simParcelas.length : 1;

  // ── Projeto ──
  const existente = entrada.projetoExistente;
  const projId = existente ? existente.id : gerarId();
  const projeto: PlanoAprovacao["projeto"] = existente
    ? {
        id: projId,
        modo: "atualizar",
        campos: {
          venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
          numero_parcelas: numeroParcelas,
          forma_pagamento: simFormaPgto || null,
          descricao,
          status: "infraestrutura",
          observacoes_pagamento: `Sincronizado em ${entrada.agoraLabel}`,
        },
      }
    : {
        id: projId,
        modo: "inserir",
        campos: {
          id: projId,
          empresa_id: empresaId,
          nome: `${cliente.nome} — ${orc.nome ?? ""}`.trim(),
          descricao,
          cliente_id: cliente.id,
          endereco_obra: cliente.endereco_obra || cliente.endereco || null,
          arquiteto_id: cliente.arquiteto_id || null,
          status: "infraestrutura",
          venda_total: totalVenda, custo_previsto: totalCusto, margem_prevista: margem,
          numero_parcelas: numeroParcelas,
          forma_pagamento: simFormaPgto || null,
          observacoes_pagamento: `Criado em ${entrada.agoraLabel}`,
          orcamento_id: orc.id,
          data_inicio: entrada.hoje,
        },
      };

  // ── Itens do projeto (substituição completa) ──
  const itensProjeto = items.map(item => ({
    id: gerarId(),
    projeto_id: projId,
    descricao: item.descricao,
    quantidade: Number(item.quantidade) || 1,
    preco_custo: Number(item.preco_custo) || 0,
    preco_venda: Number(item.preco_venda) || 0,
    tipo: (["produto", "servico", "adicional"].includes(item.tipo as string) ? item.tipo : "produto") as string,
    produto_id: item.produto_id || null,
    rt_percentual: Number(item.rt_comissao) || 0,
  }));

  // ── Contas a receber ──
  let receber: PlanoAprovacao["receber"] = null;
  if (opts?.skipReceber) {
    // Edição de item: financeiro a receber não é reconstruído.
  } else if (orc.grupo_id) {
    // Orçamento em grupo: parcelas conjuntas são do AprovarConjuntoModal.
  } else {
    const fullParcelas: { valor: number; data: string | null }[] = [];
    if (simEntradaValor > 0) {
      fullParcelas.push({ valor: simEntradaValor, data: simEntradaData ? parseDate(simEntradaData) : null });
    }
    simParcelas.forEach((p: any) => {
      fullParcelas.push({ valor: Number(p.valor) || 0, data: p.data ? parseDate(p.data) : null });
    });

    const existentes = entrada.parcelasReceberExistentes ?? [];
    const plano = planParcelasReceber(existentes, fullParcelas);
    const inserir: Record<string, any>[] = [];
    if (fullParcelas.length > 0) {
      for (const p of plano.inserts) {
        inserir.push({
          id: gerarId(),
          empresa_id: empresaId,
          projeto_id: projId,
          cliente_id: cliente.id,
          descricao: `Parcela ${p.parcela}/${plano.total} — ${cliente.nome}`,
          valor: p.valor,
          parcela: p.parcela,
          data_vencimento: p.data,
          status: "pendente",
        });
      }
    } else if (totalVenda > 0 && !existentes.some(p => p.status !== "pendente" && p.status !== null)) {
      inserir.push({
        id: gerarId(),
        empresa_id: empresaId, projeto_id: projId, cliente_id: cliente.id,
        descricao: `Conta a receber — ${cliente.nome}`,
        valor: totalVenda, parcela: 1, status: "pendente",
      });
    }
    receber = { apagar_ids: plano.idsApagar, inserir };
  }

  // ── Comissão RT ──
  let comissoes: PlanoAprovacao["comissoes"] = null;
  let projetoArquitetoId: string | null = null;
  let projetoParceiros: PlanoAprovacao["projeto_parceiros"] = null;

  if (!entrada.temComissaoPaga) {
    const arqCliente = opts && opts.clienteArquitetoId !== undefined
      ? (opts.clienteArquitetoId ?? null)
      : (cliente.arquiteto_id ?? null);
    // Arquiteto do projeto: o que já existe, ou o que estamos gravando agora.
    const arquitetoAtualDoProjeto = existente ? existente.arquiteto_id : (cliente.arquiteto_id || null);
    const arquitetoId = arquitetoEfetivo(arquitetoAtualDoProjeto, arqCliente);
    if (arquitetoId && !arquitetoAtualDoProjeto) projetoArquitetoId = arquitetoId;

    const totalRt = arquitetoId
      ? itensProjeto.reduce((sum, pi) => sum + (Number(pi.rt_percentual) || 0), 0)
      : 0;
    const percentualMedio = totalVenda > 0 ? (totalRt / totalVenda) * 100 : 0;

    const comissoesLista = [...(entrada.comissoes ?? [])].sort((a, b) =>
      String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")),
    );
    const parcelasDe = (cid: string) => (entrada.parcelasComissao ?? []).filter(p => p.comissao_id === cid);

    // Principal = comissão do arquiteto atual com mais parcelas (empate: a mais antiga)
    let principalId: string | null = null;
    if (arquitetoId && totalRt > 0) {
      let melhor = -1;
      for (const c of comissoesLista) {
        if (c.fornecedor_id !== arquitetoId) continue;
        const n = parcelasDe(c.id).length;
        if (n > melhor) { melhor = n; principalId = c.id; }
      }
    }

    const parcelaRT = (comissaoId: string) => ({
      id: gerarId(),
      empresa_id: empresaId,
      projeto_id: projId,
      fornecedor_id: arquitetoId,
      comissao_id: comissaoId,
      descricao: `Comissão RT — ${cliente.nome}`,
      valor: totalRt,
      status: "pendente",
      origem: "comissao",
      categoria_id: entrada.categoriaRtId ?? null,
      tipo_manual: "Comissão RT",
    });

    const secao: NonNullable<PlanoAprovacao["comissoes"]> = {
      remover: [], atualizar: [], inserir: null, parcelas_inserir: [],
    };

    for (const c of comissoesLista) {
      const principal = c.id === principalId;
      const plano = planComissaoRT({
        comissao: { id: c.id, status: c.status, valor: c.valor },
        parcelas: parcelasDe(c.id).map(p => ({ id: p.id, valor: p.valor, status: p.status })),
        totalRt: principal ? totalRt : 0,
        temArquiteto: principal,
      });
      if (plano.acao === "remover") {
        secao.remover.push({ comissao_id: plano.comissaoId, parcela_ids: plano.parcelaIds });
      } else if (plano.acao === "atualizar") {
        secao.atualizar.push({
          id: plano.comissaoId,
          valor: plano.valor,
          percentual: percentualMedio,
          parcela_unica_id: plano.parcelaUnicaId,
          criar_parcela: plano.criarParcela,
        });
        if (!plano.parcelaUnicaId && plano.criarParcela) secao.parcelas_inserir.push(parcelaRT(plano.comissaoId));
        if (plano.aviso) avisos.push(plano.aviso);
      } else if (plano.acao === "manter" && plano.aviso) {
        avisos.push(plano.aviso);
      }
    }

    if (arquitetoId && totalRt > 0 && !principalId) {
      const novaId = gerarId();
      secao.inserir = {
        id: novaId,
        empresa_id: empresaId, projeto_id: projId, fornecedor_id: arquitetoId,
        valor: totalRt, percentual: percentualMedio, status: "pendente",
      };
      secao.parcelas_inserir.push(parcelaRT(novaId));
    }
    comissoes = secao;

    // Auto-vincular arquiteto em projeto_parceiros
    if (arquitetoId && totalRt > 0) {
      const parceiroExistente = (entrada.projetosParceirosExistentes ?? []).find(p => p.parceiro_id === arquitetoId);
      if (!parceiroExistente) {
        projetoParceiros = {
          inserir: {
            id: gerarId(),
            empresa_id: empresaId,
            projeto_id: projId,
            parceiro_id: arquitetoId,
            rt_tipo: "fixo",
            rt_base: "rt_itens",
            rt_percentual: percentualMedio,
            rt_valor: totalRt,
            rt_total: totalRt,
            rt_recebido: 0,
          },
          atualizar: null,
        };
      } else {
        projetoParceiros = {
          inserir: null,
          atualizar: { id: parceiroExistente.id, rt_valor: totalRt, rt_total: totalRt },
        };
      }
    }
  }

  // ── Compras e necessidades (só produtos; o banco apaga antes as pendentes) ──
  const produtos = itensProjeto.filter(pi => pi.tipo === "produto");
  const compras = produtos.map(pi => ({
    id: gerarId(),
    empresa_id: empresaId, projeto_id: projId, projeto_item_id: pi.id,
    produto_id: pi.produto_id || null, descricao: pi.descricao ?? "",
    quantidade: Number(pi.quantidade) || 1, status: "pendente",
    valor_unitario: Number(pi.preco_custo) || 0,
    valor_total: (Number(pi.preco_custo) || 0) * (Number(pi.quantidade) || 1),
  }));
  const necessidades = produtos.map(pi => ({
    id: gerarId(),
    empresa_id: empresaId, projeto_id: projId, projeto_item_id: pi.id,
    produto_id: pi.produto_id || null, descricao: pi.descricao ?? "",
    quantidade: Number(pi.quantidade) || 1, status: "pendente",
  }));

  // ── Frete e imposto como contas a pagar ──
  const extrasApagar = (entrada.contasPagarExtrasExistentes ?? [])
    .filter(p => p.status === "pendente")
    .map(p => p.id);
  const extras: Record<string, any>[] = [];
  if (frete > 0) {
    extras.push({
      id: gerarId(),
      empresa_id: empresaId, projeto_id: projId,
      descricao: `Frete — ${cliente.nome}`,
      valor: frete, status: "pendente",
      data_vencimento: orc.frete_vencimento || null,
    });
  }
  if (imposto > 0) {
    extras.push({
      id: gerarId(),
      empresa_id: empresaId, projeto_id: projId,
      descricao: `Imposto — ${cliente.nome}`,
      valor: imposto, status: "pendente",
      data_vencimento: orc.imposto_vencimento || null,
    });
  }

  // ── Aprovação (mesma transação) ──
  const clienteStatus =
    entrada.marcarAprovado && entrada.totalOrcamentosCliente < 2 && cliente.status_crm !== "projeto"
      ? { cliente_id: cliente.id, status: "projeto" }
      : null;

  return {
    plano: {
      orcamento_id: orc.id,
      marcar_aprovado: entrada.marcarAprovado,
      cliente_status_crm: clienteStatus,
      projeto,
      projeto_itens: { substituir: itensProjeto },
      receber,
      comissoes,
      projeto_arquiteto_id: projetoArquitetoId,
      projeto_parceiros: projetoParceiros,
      compras: { inserir: compras },
      necessidades: { inserir: necessidades },
      pagar_extras: { apagar_ids: extrasApagar, inserir: extras },
    },
    avisos,
    projetoExistia: !!existente,
  };
}
