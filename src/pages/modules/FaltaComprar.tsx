import { useState, useMemo } from "react"
import { calcFaltaComprar } from "@/lib/calcFaltaComprar"
 import { useQuery } from "@tanstack/react-query"
 import { supabase } from "@/integrations/supabase/client"
 import { useEmpresa } from "@/hooks/useEmpresa"
import { ShoppingCart, Search, AlertTriangle } from "lucide-react"
 
 const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
 
 const FaltaComprar = () => {
   const empresaId = useEmpresa()
   const [busca, setBusca] = useState("")
 
  const { data: receberRaw } = useQuery({
    queryKey: ["fc_receber", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("financeiro_receber")
        .select("valor, valor_recebido, status, projeto_id, data_vencimento")
        .eq("empresa_id", empresaId!)
        .eq("deletado", false)
      return data ?? []
    },
    enabled: !!empresaId
  })

  const receber = receberRaw ?? []
  const hoje = new Date().toISOString().split("T")[0]

   const totalRecebido = receber?.reduce(
     (s, r) => s + (Number(r.valor_recebido) || 0), 0) ?? 0

    const totalInadimplente = receber?.reduce(
      (s, r) => {
        if (
          (r.status === "pendente" &&
           r.data_vencimento &&
           r.data_vencimento < hoje) ||
          r.status === "parcial"
        ) {
          return s + Math.max(
            (Number(r.valor) || 0) -
            (Number(r.valor_recebido) || 0), 0
          )
        }
        return s
      }, 0) ?? 0

    const totalAReceber = receber?.reduce(
      (s, r) => {
        if (
          r.status === "pendente" &&
          r.data_vencimento &&
          r.data_vencimento >= hoje
        ) {
          return s + Math.max(
            (Number(r.valor) || 0) -
            (Number(r.valor_recebido) || 0), 0
          )
        }
        return s
      }, 0) ?? 0

    const { data: projetos, isLoading } = useQuery({
      queryKey: ["falta_comprar", empresaId],
      queryFn: async () => {
        const { data: orcs } = await supabase
          .from("crm_orcamentos")
          .select("id, nome, cliente_id, frete, imposto, clientes(nome)")
          .eq("empresa_id", empresaId!)
          .eq("aprovado", true)

        if (!orcs?.length) return []

        // Buscar projetos separadamente
        const { data: projetosData } = await supabase
          .from("projetos")
          .select("id, orcamento_id, status, deletado")
          .eq("empresa_id", empresaId!)
          .eq("deletado", false)

        // Cruzar manualmente
        const validOrcs = (orcs ?? []).map(o => {
          const proj = (projetosData ?? [])
            .find(p => p.orcamento_id === o.id)
          return {
            ...o,
            projeto_id: proj?.id ?? null,
            projeto_status: proj?.status ?? null
          }
        }).filter(o => o.projeto_id !== null)

        const orcIds = validOrcs.map(o => o.id)
        const { data: todosItens } = await supabase
          .from("crm_itens")
          .select("id, descricao, quantidade, preco_custo, preco_venda, rt_comissao, rt_valor_pago, status_compra, orcamento_id, tipo")
          .in("orcamento_id", orcIds)

        return validOrcs.map(projeto => {
          const itens = (todosItens ?? []).filter(i => i.orcamento_id === projeto.id)
          const frete = Number(projeto.frete) || 0
          const imposto = Number(projeto.imposto) || 0

          const stats = calcFaltaComprar(itens, frete, imposto)
          const totalVenda = itens.reduce((s, i) => s + (Number(i.preco_venda) || 0) * (Number(i.quantidade) || 1), 0)
          const itensPendentesCount = itens.filter(i => i.status_compra === "pendente").length

          const recebidoProjeto = (receber ?? [])
            .filter(r => r.projeto_id === projeto.projeto_id)
            .reduce((s, r) => s + (Number(r.valor_recebido) || 0), 0)

          const inadimplenteProjeto = (receber ?? [])
            .filter(r =>
              r.projeto_id === projeto.projeto_id &&
              r.status === "pendente" &&
              r.data_vencimento &&
              r.data_vencimento < hoje
            )
            .reduce((s, r) => s + Math.max(
              (Number(r.valor) || 0) - (Number(r.valor_recebido) || 0), 0
            ), 0)

          const faltaReceberProjeto = (receber ?? [])
            .filter(r =>
              r.projeto_id === projeto.projeto_id &&
              r.status !== "pago"
            )
            .reduce((s, r) => s + Math.max(
              (Number(r.valor) || 0) - (Number(r.valor_recebido) || 0), 0
            ), 0)

          return {
            clienteNome: (projeto.clientes as any)?.nome ?? "—",
            orcamentoNome: projeto.nome,
            totalVenda,
            totalCusto: stats.totalCusto,
            totalComprado: stats.totalComprado,
            faltaComprar: stats.faltaComprar,
            itensPendentes: itensPendentesCount,
            recebidoProjeto,
            faltaReceberProjeto,
            inadimplenteProjeto,
          }
        }).filter(r => r.faltaComprar > 0)
        .sort((a, b) => b.faltaComprar - a.faltaComprar)
     },
     enabled: !!empresaId,
   })
 
    const filtered = useMemo(() => {
      if (!busca.trim()) return projetos ?? []
      const q = busca.toLowerCase()
      return (projetos ?? []).filter(r =>
        r.clienteNome.toLowerCase().includes(q) ||
        r.orcamentoNome.toLowerCase().includes(q)
      )
    }, [projetos, busca])
 
    const totalGeral = filtered.reduce((s, r) => s + r.faltaComprar, 0)
    const totalCustoGeral = filtered.reduce((s, r) => s + r.totalCusto, 0)
    const totalCompradoGeral = filtered.reduce((s, r) => s + r.totalComprado, 0)
    const totalVendaGeral = filtered.reduce((s, r) => s + r.totalVenda, 0)
    const totalItens = filtered.reduce((s, r) => s + r.itensPendentes, 0)
 
    const totalFaltaComprar = totalGeral
    const saldoDisponivel = totalRecebido - totalFaltaComprar

   return (
     <div className="p-4 space-y-4 max-w-7xl mx-auto">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
             <ShoppingCart className="w-4 h-4 text-orange-600" />
           </div>
           <div>
             <h1 className="text-base font-bold text-foreground">
               Falta Comprar por Projeto
             </h1>
             <p className="text-[10px] text-muted-foreground">
               Resumo de itens pendentes de compra por orçamento aprovado
             </p>
           </div>
         </div>
 
         <div className="relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
           <input
             type="text"
             value={busca}
             onChange={(e) => setBusca(e.target.value)}
             placeholder="Buscar cliente..."
             className="pl-9 h-8 w-56 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
           />
         </div>
       </div>
 
      {/* Painel Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* A Receber */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            A Receber
          </p>
          <p className="text-2xl font-black text-primary">
            {fmt(totalAReceber)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Pendente dos clientes
          </p>
        </div>

        {/* Inadimplente */}
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Inadimplente
          </p>
          <p className="text-2xl font-black text-destructive">
            {fmt(totalInadimplente)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Vencido não recebido
          </p>
        </div>

        {/* Falta Comprar */}
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            Falta Comprar
          </p>
          <p className="text-2xl font-black text-orange-500">
            {fmt(totalFaltaComprar)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Custo pendente
          </p>
        </div>
      </div>
 
       {isLoading ? (
         <div className="flex items-center justify-center py-20 text-xs text-muted-foreground italic">
           Carregando...
         </div>
       ) : (
         <div className="bg-card rounded-lg border border-border overflow-hidden">
           <div className="overflow-x-auto">
             <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-secondary/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3 text-right text-success">Recebido</th>
                    <th className="px-4 py-3 text-right text-destructive">Inadimplente</th>
                    <th className="px-4 py-3 text-right text-primary">Falta Receber</th>
                    <th className="px-4 py-3 text-right">Custo</th>
                    <th className="px-4 py-3 text-right">Comprado</th>
                    <th className="px-4 py-3 text-center">Itens Pend.</th>
                    <th className="px-4 py-3 text-right text-orange-500">Falta Comprar</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-border">
                  {filtered.map((r, i) => (
                    <tr key={i} className="hover:bg-secondary/10 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-bold text-foreground">{r.clienteNome}</p>
                        <p className="text-[10px] text-muted-foreground">{r.orcamentoNome}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums text-success">{fmt(r.recebidoProjeto)}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums text-destructive">{fmt(r.inadimplenteProjeto)}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums text-primary">{fmt(r.faltaReceberProjeto)}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums text-muted-foreground">{fmt(r.totalCusto)}</td>
                      <td className="px-4 py-3 text-xs text-right tabular-nums text-green-600">{fmt(r.totalComprado)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex px-1.5 py-0.5 rounded bg-secondary text-[10px] font-medium whitespace-nowrap">
                          {r.itensPendentes} itens
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-right font-bold text-orange-500 tabular-nums">
                        {fmt(r.faltaComprar)}
                      </td>
                    </tr>
                  ))}
               </tbody>
                <tfoot className="bg-secondary/20 font-bold border-t border-border whitespace-nowrap">
                  <tr>
                    <td className="px-4 py-3 text-xs">Total Geral</td>
                    <td className="px-4 py-3 text-xs text-right text-success">{fmt(totalRecebido)}</td>
                    <td className="px-4 py-3 text-xs text-right text-destructive">{fmt(totalInadimplente)}</td>
                    <td className="px-4 py-3 text-xs text-right text-primary">{fmt(totalAReceber)}</td>
                    <td className="px-4 py-3 text-xs text-right text-muted-foreground">{fmt(totalCustoGeral)}</td>
                    <td className="px-4 py-3 text-xs text-right text-green-600">{fmt(totalCompradoGeral)}</td>
                    <td className="px-4 py-3 text-center text-[10px]">{totalItens} itens</td>
                    <td className="px-4 py-3 text-xs text-right text-orange-500">{fmt(totalGeral)}</td>
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