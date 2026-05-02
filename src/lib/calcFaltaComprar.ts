export const calcFaltaComprar = (
  itens: any[],
  frete: number,
  imposto: number
) => {
  const custoItensPendentes = itens
    .filter(i => i.status_compra === "pendente")
    .reduce((s, i) => s +
      (Number(i.preco_custo)||0) *
      (Number(i.quantidade)||1), 0)

  // RT PENDENTE = apenas o que ainda não foi pago
  const rtPendente = itens.reduce((s, i) => {
    const rtTotal = Number(i.rt_comissao) || 0
    const rtPago = Number(i.rt_valor_pago) || 0
    return s + Math.max(rtTotal - rtPago, 0)
  }, 0)

  return custoItensPendentes +
    rtPendente +
    (Number(frete)||0) +
    (Number(imposto)||0)
}

export const calcCustoTotal = (
  itens: any[],
  frete: number,
  imposto: number
) => {
  const custoItens = itens.reduce((s, i) =>
    s + (Number(i.preco_custo)||0) *
    (Number(i.quantidade)||1), 0)

  const rtTotal = itens.reduce((s, i) =>
    s + (Number(i.rt_comissao)||0), 0)

  return custoItens + rtTotal +
    (Number(frete)||0) +
    (Number(imposto)||0)
}
