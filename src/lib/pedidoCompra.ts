/**
 * Regras do Pedido de Compra (lado da tela). As regras que garantem a consistência
 * ("comprado" no Pré-Projeto, limite de quantidade) ficam no banco, em gatilhos.
 */

const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

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
