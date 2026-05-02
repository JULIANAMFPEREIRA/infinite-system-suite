export interface ItemCompra {
  preco_custo: number | null
  quantidade: number | null
  rt_comissao: number | null
  rt_valor_pago: number | null
  status_compra: string | null
}

export const calcFaltaComprar = (
  itens: ItemCompra[],
  frete: number,
  imposto: number
): {
  totalCusto: number
  totalComprado: number
  faltaComprar: number
  rtTotal: number
  rtPago: number
  rtPendente: number
  compradoCusto: number
  pendenteCusto: number
} => {
  const rtTotal = itens.reduce((s, i) => s + (Number(i.rt_comissao) || 0), 0)
  
  const rtPago = itens.reduce((s, i) => {
    const t = Number(i.rt_comissao) || 0
    return s + Math.min(Math.max(Number(i.rt_valor_pago) || 0, 0), t)
  }, 0)

  const rtPendente = Math.max(rtTotal - rtPago, 0)

  const compradoCusto = itens
    .filter(i => ["comprado", "pago"].includes(i.status_compra ?? "pendente"))
    .reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0)

  const pendenteCusto = itens
    .filter(i => (i.status_compra ?? "pendente") === "pendente")
    .reduce((s, i) => s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0)

  const totalCusto = itens.reduce((s, i) => 
    s + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0) + 
    (Number(frete) || 0) + (Number(imposto) || 0) + rtTotal

  const totalComprado = compradoCusto + rtPago
  const faltaComprar = Math.max(totalCusto - totalComprado, 0)

  return {
    totalCusto,
    totalComprado,
    faltaComprar,
    rtTotal,
    rtPago,
    rtPendente,
    compradoCusto,
    pendenteCusto
  }
}
