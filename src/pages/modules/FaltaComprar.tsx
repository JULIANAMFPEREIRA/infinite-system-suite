import { useState, useMemo } from "react"
import { calcFaltaComprar } from "@/lib/calcFaltaComprar"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useEmpresa } from "@/hooks/useEmpresa"
import { ShoppingCart, Search } from "lucide-react"

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`

const FaltaComprar = () => {
  const empresaId = useEmpresa()
  const [busca, setBusca] = useState("")
  const hoje = new Date().toISOString().split("T")[0]

  const { data: receberRaw, isLoading: isLoadingReceber } = useQuery({
    queryKey: ["fc_receber", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_receber")
        .select("valor, valor_recebido, status, projeto_id, cliente_id, data_vencimento")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
      return data ?? []
    },
    enabled: !!empresaId
  })

  const receber = receberRaw ?? []

  const totalAReceber = receber.reduce((s, r) => {
    if (r.status === "pendente" && r.data_vencimento && r.data_vencimento >= hoje) {
      return s + Math.max((Number(r.valor)||0) - (Number(r.valor_recebido)||0), 0)
    }
    return s
  }, 0)

  const totalInadimplente = receber.reduce((s, r) => {
    if (
      (r.status === "pendente" && r.data_vencimento && r.data_vencimento < hoje) ||
      r.status === "parcial"
    ) {
      return s + Math.max((Number(r.valor)||0) - (Number(r.valor_recebido)||0), 0)
    }
    return s
  }, 0)

  const { data: projetos, isLoading: isLoadingProjetos } = useQuery({
    queryKey: ["falta_comprar", empresaId, receberRaw],
    queryFn: async () => {
      const { data: orcs } = await supabase
        .from("crm_orcamentos")
        .select("id, nome, cliente_id, grupo_id, frete, imposto, clientes(nome)")
        .eq("empresa_id", empresaId!)
        .eq("aprovado", true)

      if (!orcs?.length) return []

      const { data: projetosData } = await supabase
        .from("projetos")
        .select("id, orcamento_id, status, deletado")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)

      const validOrcs = (orcs ?? []).map(o => {
        const proj = (projetosData ?? []).find(p => p.orcamento_id === o.id)
        return { ...o, projeto_id: proj?.id ?? null }
      }).filter(o => o.projeto_id !== null)

      if (!validOrcs.length) return []

      const orcIds = validOrcs.map(o => o.id)
      const { data: todosItens } = await supabase
        .from("crm_itens")
        .select("id, quantidade, preco_custo, preco_venda, rt_comissao, rt_valor_pago, status_compra, orcamento_id")
        .in("orcamento_id", orcIds)

      return validOrcs.map(projeto => {
        const itens = (todosItens ?? []).filter(i => i.orcamento_id === projeto.id)
        const frete = Number(projeto.frete) || 0
        const imposto = Number(projeto.imposto) || 0
        const stats = calcFaltaComprar(itens as any, frete, imposto)
        const totalVenda = itens.reduce((s, i) => s + (Number(i.preco_venda)||0) * (Number(i.quantidade)||1), 0)

        let recProjeto = receber.filter(r => r.projeto_id === projeto.projeto_id)

        // Fallback for grouped orçamentos: parcelas may be linked at cliente level
        if (recProjeto.length === 0 && projeto.grupo_id) {
          recProjeto = receber.filter(r => r.cliente_id === projeto.cliente_id)
        }

        const recebidoProjeto = recProjeto.reduce((s, r) => s + (Number(r.valor_recebido)||0), 0)

        const aReceberProjeto = recProjeto.reduce((s, r) => {
          if (r.status === "pendente" && r.data_vencimento && r.data_vencimento >= hoje) {
            return s + Math.max((Number(r.valor)||0) - (Number(r.valor_recebido)||0), 0)
          }
          return s
        }, 0)

        const inadimplenteProjeto = recProjeto.reduce((s, r) => {
          if (
            (r.status === "pendente" && r.data_vencimento && r.data_vencimento < hoje) ||
            r.status === "parcial"
          ) {
            return s + Math.max((Number(r.valor)||0) - (Number(r.valor_recebido)||0), 0)
          }
          return s
        }, 0)

        return {
          clienteNome: (projeto.clientes as any)?.nome ?? "—",
          orcamentoNome: projeto.nome,
          totalVenda,
          totalCusto: stats.totalCusto,
          totalComprado: stats.totalComprado,
          faltaComprar: stats.faltaComprar,
          recebidoProjeto,
          aReceberProjeto,
          inadimplenteProjeto,
        }
      })
      .filter(r => r.faltaComprar > 0)
      .sort((a, b) => b.faltaComprar - a.faltaComprar)
    },
    enabled: !!empresaId && !isLoadingReceber && receberRaw !== undefined,
  })

  const isLoading = isLoadingReceber || isLoadingProjetos

  const filtered = useMemo(() => {
    if (!busca.trim()) return projetos ?? []
    const q = busca.toLowerCase()
    return (projetos ?? []).filter(r =>
      r.clienteNome.toLowerCase().includes(q) ||
      r.orcamentoNome.toLowerCase().includes(q)
    )
  }, [projetos, busca])

  const totalFaltaComprar = filtered.reduce((s, r) => s + r.faltaComprar, 0)

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShoppingCart className="text-primary w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Falta Comprar por Projeto</h1>
            <p className="text-sm text-muted-foreground">Resumo por orçamento aprovado</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente..."
              className="pl-9 h-8 w-56 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">A Receber</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{fmt(totalAReceber)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Pendente não vencido</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Inadimplente</p>
          <p className="text-2xl font-bold text-destructive mt-1">{fmt(totalInadimplente)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Vencido não recebido</p>
        </div>

        <div className="p-4 bg-card border border-border rounded-xl shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Falta Comprar</p>
          <p className="text-2xl font-bold text-orange-500 mt-1">{fmt(totalFaltaComprar)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Custo pendente</p>
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground animate-pulse">Carregando...</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3 text-right">Valor Projeto</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Recebido</th>
                  <th className="px-4 py-3 text-right">A Receber</th>
                  <th className="px-4 py-3 text-right">Inadimplente</th>
                  <th className="px-4 py-3 text-right">Comprado</th>
                  <th className="px-4 py-3 text-right">Falta Comprar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((r, i) => (
                  <tr key={i} className="hover:bg-secondary/20 transition-colors whitespace-nowrap">
                    <td className="px-4 py-3">
                      <div className="font-medium text-xs text-foreground">{r.clienteNome}</div>
                      <div className="text-[10px] text-muted-foreground">{r.orcamentoNome}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-right font-medium">{fmt(r.totalVenda)}</td>
                    <td className="px-4 py-3 text-xs text-right">{fmt(r.totalCusto)}</td>
                    <td className="px-4 py-3 text-xs text-right text-green-600">{fmt(r.recebidoProjeto)}</td>
                    <td className="px-4 py-3 text-xs text-right text-blue-600">{fmt(r.aReceberProjeto)}</td>
                    <td className="px-4 py-3 text-xs text-right text-destructive">{fmt(r.inadimplenteProjeto)}</td>
                    <td className="px-4 py-3 text-xs text-right text-green-600">{fmt(r.totalComprado)}</td>
                    <td className="px-4 py-3 text-xs text-right font-bold text-orange-500">{fmt(r.faltaComprar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-secondary/10 border-t border-border font-bold">
                <tr>
                  <td className="px-4 py-3 text-[10px] uppercase">Total Geral</td>
                  <td className="px-4 py-3 text-xs text-right">{fmt(filtered.reduce((s,r) => s+r.totalVenda, 0))}</td>
                  <td className="px-4 py-3 text-xs text-right">{fmt(filtered.reduce((s,r) => s+r.totalCusto, 0))}</td>
                  <td className="px-4 py-3 text-xs text-right text-green-600">{fmt(filtered.reduce((s,r) => s+r.recebidoProjeto, 0))}</td>
                  <td className="px-4 py-3 text-xs text-right text-blue-600">{fmt(filtered.reduce((s,r) => s+r.aReceberProjeto, 0))}</td>
                  <td className="px-4 py-3 text-xs text-right text-destructive">{fmt(filtered.reduce((s,r) => s+r.inadimplenteProjeto, 0))}</td>
                  <td className="px-4 py-3 text-xs text-right text-green-600">{fmt(filtered.reduce((s,r) => s+r.totalComprado, 0))}</td>
                  <td className="px-4 py-3 text-xs text-right text-orange-500">{fmt(totalFaltaComprar)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default FaltaComprar
