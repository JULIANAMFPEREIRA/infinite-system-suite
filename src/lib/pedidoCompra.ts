/**
 * Regras do Pedido de Compra (lado da tela). As regras que garantem a consistência
 * ("comprado" no Pré-Projeto, limite de quantidade) ficam no banco, em gatilhos.
 */

const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const brl = (n: number) => round2(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Quanto ainda pode ser pedido de um item: quantidade do item menos o que já está em outros pedidos. */
export function qtdRestante(quantidadeItem: number, jaPedido: number): number {
  return Math.max(0, round3(Number(quantidadeItem) - Number(jaPedido)));
}

/** Pedido com algo recebido não pode ser apagado: o recebimento já alterou o Pré-Projeto. Deve ser cancelado. */
export function podeExcluirPedido(totalRecebido: number): boolean {
  return (Number(totalRecebido) || 0) === 0;
}

export function resumoRecebimento(itens: { quantidade: number; recebida: number }[]) {
  let completos = 0, parciais = 0, recebido = 0;
  for (const it of itens) {
    const q = Number(it.quantidade) || 0;
    const r = Number(it.recebida) || 0;
    recebido += r;
    if (q > 0 && r >= q) completos++;
    else if (r > 0) parciais++;
  }
  return { total: itens.length, completos, parciais, recebido: round3(recebido) };
}

/** Dias até a validade da proposta (negativo = já venceu). `hoje` e `validade` no formato AAAA-MM-DD. */
export function diasParaVencer(validade: string | null | undefined, hoje: string): number | null {
  if (!validade) return null;
  const v = new Date(validade.slice(0, 10) + "T00:00:00Z").getTime();
  const h = new Date(hoje.slice(0, 10) + "T00:00:00Z").getTime();
  if (Number.isNaN(v) || Number.isNaN(h)) return null;
  return Math.round((v - h) / 86_400_000);
}

export type AlertaPolitica = { tipo: "ok" | "atencao" | "info"; texto: string };

/** Avisos com base na política comercial cadastrada no fornecedor (pedido mínimo, frete CIF). */
export function alertasPolitica(p: {
  subtotalProdutos: number;
  pedidoMinimo?: number | null;
  freteCifAcimaDe?: number | null;
  freteTipo?: string | null;
}): AlertaPolitica[] {
  const out: AlertaPolitica[] = [];
  const sub = round2(p.subtotalProdutos);
  const min = Number(p.pedidoMinimo) || 0;
  const cif = Number(p.freteCifAcimaDe) || 0;
  if (min > 0) {
    out.push(
      sub >= min
        ? { tipo: "ok", texto: `Pedido mínimo atingido (${brl(min)}).` }
        : { tipo: "atencao", texto: `Faltam ${brl(min - sub)} para o pedido mínimo de ${brl(min)}.` },
    );
  }
  if (cif > 0) {
    out.push(
      sub >= cif
        ? { tipo: "ok", texto: `Frete CIF liberado (acima de ${brl(cif)}).` }
        : { tipo: "info", texto: `Faltam ${brl(cif - sub)} para o frete CIF (acima de ${brl(cif)}).` },
    );
  }
  return out;
}

/** Agrupa linhas por cliente, mantendo a ordem de aparição; itens avulsos vão para o fim em "Sem cliente". */
export function agruparPorCliente<T extends { cliente_id?: string | null; cliente_nome?: string | null }>(
  itens: T[],
): { chave: string; nome: string; itens: T[] }[] {
  const mapa = new Map<string, { chave: string; nome: string; itens: T[] }>();
  const avulsos: T[] = [];
  for (const it of itens) {
    if (!it.cliente_id) { avulsos.push(it); continue; }
    const g = mapa.get(it.cliente_id) ?? { chave: it.cliente_id, nome: it.cliente_nome || "Cliente", itens: [] };
    g.itens.push(it);
    mapa.set(it.cliente_id, g);
  }
  const grupos = [...mapa.values()];
  if (avulsos.length) grupos.push({ chave: "_avulsos", nome: "Sem cliente", itens: avulsos });
  return grupos;
}

/** Faixa de chegada: um segmento por item (vazio / parcial / cheio). */
export function segmentosRecebimento(itens: { quantidade: number; recebida: number }[]): ("vazio" | "parcial" | "cheio")[] {
  return itens.map(it => {
    const q = Number(it.quantidade) || 0;
    const r = Number(it.recebida) || 0;
    if (q > 0 && r >= q) return "cheio";
    return r > 0 ? "parcial" : "vazio";
  });
}

/** Total do pedido: itens (já com desconto de linha) + frete + IPI + ICMS ST − desconto geral. */
export function totalPedido(p: {
  itens: { qtd: number; valor_unit: number; desconto: number }[];
  frete: number;
  ipi: number;
  icmsSt: number;
  descontoTotal: number;
}) {
  const subtotal = round2(
    p.itens.reduce((s, it) => s + (Number(it.qtd) || 0) * (Number(it.valor_unit) || 0) - (Number(it.desconto) || 0), 0),
  );
  const total = round2(subtotal + (Number(p.frete) || 0) + (Number(p.ipi) || 0) + (Number(p.icmsSt) || 0) - (Number(p.descontoTotal) || 0));
  return { subtotal, total };
}
