 import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

 import {
   DollarSign, FolderKanban, ShoppingCart, ClipboardList, UserX,
   CalendarDays, ArrowRight, Package, ExternalLink, Plus, FileText,
   AlertTriangle, Clock, TrendingUp, Receipt, Wallet, ArrowDownRight, ArrowUpRight, Scale,
   PiggyBank
 } from "lucide-react";
 import { useAuth } from "@/contexts/AuthContext";
 import { Separator } from "@/components/ui/separator";
import RevenueExpensesChart from "@/components/dashboard/RevenueExpensesChart";
import InteractiveCalendar from "@/components/dashboard/InteractiveCalendar";
import { Skeleton } from "@/components/ui/skeleton";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const Dashboard = () => {
   const { user } = useAuth();
   const empresaId = useEmpresa();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const hoje = new Date();
   const inicioMes = startOfMonth(hoje);
   const fimMes = endOfMonth(hoje);

   const { data: financasPessoais } = useQuery({
     queryKey: ["financas_pessoais", user?.id],
     queryFn: async () => {
       if (!user?.id) return [];
       const { data } = await supabase
         .from("financas_pessoais" as any)
         .select("*")
         .eq("usuario_id", user.id);
       return (data ?? []) as any[];
     },
     enabled: !!user?.id,
   });

   const saldoPessoal = useMemo(() => {
     if (!financasPessoais) return 0;
     return financasPessoais
       .filter(f => f.data && new Date(f.data) >= inicioMes && new Date(f.data) <= fimMes)
       .reduce((acc, curr) => {
         const v = Number(curr.valor) || 0;
         if (curr.tipo === "receita" || curr.tipo === "devolucao") return acc + v;
         if (curr.tipo === "despesa" || curr.tipo === "retirada") return acc - v;
         return acc;
       }, 0);
   }, [financasPessoais, inicioMes, fimMes]);

   const pagarPessoal = useMemo(() => {
     if (!financasPessoais) return 0;
     return financasPessoais
       .filter(f => f.data && new Date(f.data) >= inicioMes && new Date(f.data) <= fimMes && f.tipo === "despesa")
       .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
   }, [financasPessoais, inicioMes, fimMes]);

  const { data: stats } = useQuery({
    queryKey: ["dashboard_stats_v3", empresaId],
    queryFn: async () => {
      const [receber, pagar, projetos, clientes, visitas, compras] = await Promise.all([
        supabase.from("financeiro_receber").select("valor, valor_recebido, status, data_vencimento, cliente_id, projeto_id, descricao").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("financeiro_pagar").select("valor, status, data_vencimento").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("projetos").select("id, status, nome, venda_total, custo_real, custo_previsto, lucro_real, cliente_id").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("clientes").select("id, nome").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("visitas_tecnicas").select("id, data, hora, descricao, status_visita, projeto_id, google_event_id").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("compras").select("id, valor_total, data_compra, status").eq("deletado", false).then(r => r.data ?? []),
      ]);

      const [produtosRes, crmItensPendentes, orcamentosAprovados] = await Promise.all([
        supabase.from("produtos").select("id, nome, preco_custo").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("crm_itens").select("id, descricao, quantidade, preco_custo, preco_venda, status_compra, orcamento_id, cliente_id").eq("status_compra", "pendente").then(r => (r.data ?? []) as any[]),
        supabase.from("crm_orcamentos").select("id").eq("aprovado", true).then(r => r.data ?? []),
      ]);

      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));
      const projetoMap = Object.fromEntries(projetos.map(p => [p.id, p.nome]));
      const produtoMap = Object.fromEntries(produtosRes.map(p => [p.id, p]));

      const idsAprovados = new Set(orcamentosAprovados.map(o => o.id));
      const itensFaltaComprar = crmItensPendentes.filter(i => i.orcamento_id && idsAprovados.has(i.orcamento_id));

      const itensComprarValorTotal = itensFaltaComprar.reduce((sum, i) => sum + (Number(i.preco_custo) || 0) * (Number(i.quantidade) || 1), 0);
      const itensPendentesCount = itensFaltaComprar.length;

      const projetosAtivos = projetos.filter(p => p.status !== "cancelado" && p.status !== "concluido");

      // saldo restante helper (considera recebimento parcial)
      const saldo = (r: any) => Math.max((Number(r.valor) || 0) - (Number((r as any).valor_recebido) || 0), 0);

      const inadimplentes = receber
        .filter(r => {
          if (r.status === "pago" || r.status === "cancelado") return false;
          if (saldo(r) <= 0) return false;
          return r.data_vencimento && new Date(r.data_vencimento) < hoje;
        })
        .map(r => ({
          ...r,
          valor_saldo: saldo(r),
          clienteNome: r.cliente_id ? clienteMap[r.cliente_id] ?? "—" : "—",
          projetoNome: r.projeto_id ? projetoMap[r.projeto_id] ?? "—" : "—",
          diasAtraso: differenceInDays(hoje, new Date(r.data_vencimento!)),
        }))
        .sort((a, b) => b.diasAtraso - a.diasAtraso);

      const inadimplentesValorTotal = inadimplentes.reduce((a, r) => a + r.valor_saldo, 0);
      const clientesInadimplentesUnicos = new Set(inadimplentes.map(i => i.cliente_id).filter(Boolean)).size;

      // Total a Receber GERAL — considera saldo restante (parcial conta apenas o que falta)
      const totalReceberGeral = receber
        .filter(r => r.status !== "pago" && r.status !== "cancelado")
        .reduce((a, r) => a + saldo(r), 0);

      // Compras do Mês (compras realizadas + itens pendentes convertidos no mês atual)
      const comprasMesValor = compras
        .filter(c => c.data_compra && new Date(c.data_compra) >= inicioMes && new Date(c.data_compra) <= fimMes && c.status !== "cancelada")
        .reduce((a, c) => a + (Number(c.valor_total) || 0), 0);

      // Contas a Pagar
      const pagarMes = pagar
        .filter(p => (p.status === "pendente" || p.status === "vencido") && p.data_vencimento && new Date(p.data_vencimento) >= inicioMes && new Date(p.data_vencimento) <= fimMes)
        .reduce((a, p) => a + (Number(p.valor) || 0), 0);
      const pagarGeral = pagar
        .filter(p => p.status === "pendente" || p.status === "vencido")
        .reduce((a, p) => a + (Number(p.valor) || 0), 0);

      const receberMes = receber
        .filter(r =>
          r.status !== "pago" && r.status !== "cancelado" &&
          r.data_vencimento && new Date(r.data_vencimento) >= inicioMes && new Date(r.data_vencimento) <= fimMes
        )
        .reduce((a, r) => a + saldo(r), 0);

      // Resumo Financeiro — somar valor_recebido (inclui parciais)
      const totalRecebido = receber
        .filter(r => r.status !== "cancelado")
        .reduce((a, r) => a + (Number((r as any).valor_recebido) || (r.status === "pago" ? (Number(r.valor) || 0) : 0)), 0);
      const totalPagoEfetivo = pagar
        .filter(p => p.status === "pago")
        .reduce((a, p) => a + (Number(p.valor) || 0), 0);
      const saldoAtual = totalRecebido - totalPagoEfetivo;
      const saldoPrevisto = saldoAtual + totalReceberGeral - pagarGeral;

      // Status operacionais
      const statusOperacionais = [
        { key: "infraestrutura", label: "INFRAESTRUTURA", color: "hsl(200, 80%, 55%)" },
        { key: "instalacao", label: "INSTALAÇÃO", color: "hsl(38, 92%, 50%)" },
        { key: "cabeamento", label: "CABEAMENTO", color: "hsl(280, 60%, 50%)" },
        { key: "programacao", label: "PROGRAMAÇÃO", color: "hsl(152, 69%, 40%)" },
        { key: "personalizacao", label: "PERSONALIZAÇÃO", color: "hsl(340, 70%, 50%)" },
        { key: "em_andamento", label: "EM ANDAMENTO", color: "hsl(210, 70%, 50%)" },
        { key: "pos_venda", label: "PÓS-VENDA", color: "hsl(170, 60%, 45%)" },
        { key: "concluido", label: "CONCLUÍDO", color: "hsl(140, 60%, 40%)" },
      ];
      const statusCounts = statusOperacionais
        .map(s => ({ ...s, count: projetos.filter(p => p.status === s.key).length }))
        .filter(s => s.count > 0);

      // Visitas próximas (fetch broader range for week navigation)
      const proximasVisitas = visitas
        .filter(v => {
          if (!v.data || v.status_visita === "cancelada") return false;
          return true;
        })
        .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())
        .map(v => ({ ...v, projetoNome: v.projeto_id ? projetoMap[v.projeto_id] ?? "—" : "—" }));

      // Itens a comprar detalhados
      const itensComprarDetalhados = itensPendentes.slice(0, 6).map(n => {
        let custoUnit = 0;
        if (n.projeto_item_id && projetoItemMap[n.projeto_item_id]) {
          custoUnit = Number(projetoItemMap[n.projeto_item_id].preco_custo) || 0;
        } else if (n.produto_id && produtoMap[n.produto_id]) {
          custoUnit = Number(produtoMap[n.produto_id].preco_custo) || 0;
        }
        return {
          ...n,
          projetoNome: n.projeto_id ? projetoMap[n.projeto_id] ?? "—" : "—",
          produtoNome: n.produto_id ? produtoMap[n.produto_id]?.nome ?? (n.descricao ?? "—") : (n.descricao ?? "—"),
          custoUnit,
        };
      });

      return {
        itensPendentesCount: itensPendentes.length,
        itensComprarValorTotal,
        inadimplentes,
        inadimplentesCount: inadimplentes.length,
        inadimplentesValorTotal,
        clientesInadimplentesUnicos,
        receberMes,
        totalReceberGeral,
        comprasMesValor,
        pagarMes,
        pagarGeral,
        saldoAtual,
        saldoPrevisto,
        totalRecebido,
        totalPagoEfetivo,
        projetosAtivosCount: projetosAtivos.length,
        statusCounts,
        proximasVisitas,
        itensComprarDetalhados,
        receber,
        pagar,
      };
    },
    enabled: !!empresaId,
    refetchInterval: 30000,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Realtime: refetch dashboard whenever financial/operational data changes
  useEffect(() => {
    if (!empresaId) return;
    const tables = [
      "financeiro_receber",
      "financeiro_pagar",
      "compras",
      "necessidades_compra",
      "projetos",
      "projeto_itens",
      "visitas_tecnicas",
      "crm_orcamentos",
    ];
    const channel = supabase.channel(`dashboard-realtime-${empresaId}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table },
        () => {
          queryClient.invalidateQueries({ queryKey: ["dashboard_stats_v3"] });
        }
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [empresaId, queryClient]);

  return (
    <div className="space-y-6 stagger-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visão geral · {format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* LINHA 1 – PRINCIPAIS KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Saldo Atual */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="text-blue-600" />
            <p className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">Saldo Atual</p>
          </div>
          <p className={`text-2xl font-bold ${(stats?.saldoAtual ?? 0) >= 0 ? "text-[hsl(152,69%,40%)]" : "text-destructive"}`}>
            {fmt(stats?.saldoAtual ?? 0)}
          </p>
          <p className="text-[11px] text-blue-600/70 font-medium mt-1">Recebido − Pago</p>
        </div>

        {/* A Receber */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownRight size={16} className="text-blue-600" />
            <p className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">A Receber</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{fmt(stats?.totalReceberGeral ?? 0)}</p>
          <p className="text-[11px] text-blue-600/70 font-medium mt-1">Total pendente</p>
        </div>

        {/* Inadimplente */}
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UserX size={16} className="text-red-600" />
            <p className="text-[11px] text-red-800 font-bold uppercase tracking-wider">Inadimplente</p>
          </div>
          <p className="text-2xl font-bold text-red-600">{fmt(stats?.inadimplentesValorTotal ?? 0)}</p>
          <p className="text-[11px] text-red-600/70 font-medium mt-1">
            {stats?.clientesInadimplentesUnicos ?? 0} clientes · {stats?.inadimplentesCount ?? 0} parcelas
          </p>
        </div>
      </div>

      {/* LINHA 2 – OPERACIONAL & COMPRAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* A Pagar */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpRight size={16} className="text-green-600" />
            <p className="text-[11px] text-green-800 font-bold uppercase tracking-wider">A Pagar</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{fmt(stats?.pagarGeral ?? 0)}</p>
          <p className="text-[11px] text-green-600/70 font-medium mt-1">Total pendente</p>
        </div>

        {/* Projetos Ativos */}
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FolderKanban size={16} className="text-green-600" />
            <p className="text-[11px] text-green-800 font-bold uppercase tracking-wider">Projetos Ativos</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats?.projetosAtivosCount ?? 0}</p>
          <p className="text-[11px] text-green-600/70 font-medium mt-1">Total (excl. cancelados)</p>
        </div>

        {/* Falta Comprar */}
        <div 
          className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm cursor-pointer hover:shadow-md transition"
          onClick={() => navigate("/itens-comprar")}
        >
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={16} className="text-orange-600" />
            <p className="text-[11px] text-orange-800 font-bold uppercase tracking-wider">Falta Comprar</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">{fmt(stats?.itensComprarValorTotal ?? 0)}</p>
          <p className="text-[11px] text-orange-600/70 font-medium mt-1">
            {stats?.itensPendentesCount ?? 0} itens pendentes
          </p>
        </div>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL – Agenda Interativa ocupando largura total */}
      <div className="grid grid-cols-1 gap-4">
        <InteractiveCalendar
          localVisitas={(stats?.proximasVisitas ?? []).map(v => ({
            id: v.id,
            data: v.data ?? null,
            hora: v.hora ?? null,
            descricao: v.descricao ?? null,
            status_visita: v.status_visita,
            projeto_id: v.projeto_id,
            google_event_id: (v as any).google_event_id ?? null,
            projetoNome: v.projetoNome,
          }))}
        />
      </div>

      {/* Inadimplência detalhada */}
      {(stats?.inadimplentes?.length ?? 0) > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle size={16} className="text-destructive" />
              Inadimplência
            </h3>
            <span className="text-[11px] text-destructive font-medium bg-destructive/10 px-2.5 py-0.5 rounded-full">
              {fmt(stats!.inadimplentesValorTotal)} em atraso
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[260px] overflow-y-auto pr-1">
            {stats!.inadimplentes.slice(0, 9).map((item, i) => (
              <div key={i} className="list-item-hover flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{item.clienteNome}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{item.projetoNome}</p>
                </div>
                <div className="text-right ml-3 shrink-0">
                  <p className="text-xs font-bold text-destructive">{fmt((item as any).valor_saldo ?? item.valor ?? 0)}</p>
                  <p className="text-[10px] text-destructive/70">{item.diasAtraso}d atraso</p>
                </div>
              </div>
            ))}
          </div>
        </div>
       )}

       {/* NOVA SEÇÃO – FINANÇAS PESSOAIS */}
       <div className="relative py-4">
         <div className="absolute inset-0 flex items-center">
           <Separator className="w-full" />
         </div>
         <div className="relative flex justify-center">
           <span className="bg-background px-3 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
             Finanças Pessoais
           </span>
         </div>
       </div>

       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-8">
         {/* Meu Saldo */}
         <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
           <div className="flex items-center gap-2 mb-2">
             <PiggyBank size={16} className="text-purple-600" />
             <p className="text-[11px] text-purple-800 font-bold uppercase tracking-wider">Meu Saldo</p>
           </div>
           <p className={`text-2xl font-bold ${saldoPessoal >= 0 ? "text-purple-700" : "text-destructive"}`}>
             {fmt(saldoPessoal)}
           </p>
           <p className="text-[11px] text-purple-600/70 font-medium mt-1">Receitas − Despesas/Retiradas</p>
         </div>

         {/* A Pagar Pessoal */}
         <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
           <div className="flex items-center gap-2 mb-2">
             <ShoppingCart size={16} className="text-purple-600" />
             <p className="text-[11px] text-purple-800 font-bold uppercase tracking-wider">A Pagar Pessoal</p>
           </div>
           <p className="text-2xl font-bold text-foreground">{fmt(pagarPessoal)}</p>
           <p className="text-[11px] text-purple-600/70 font-medium mt-1">Despesas pendentes do mês</p>
         </div>
       </div>
     </div>
   );
 };

export default Dashboard;
