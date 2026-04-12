import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  DollarSign, FolderKanban, ShoppingCart, ClipboardList, UserX,
  CalendarDays, ArrowRight, Package, ExternalLink, Plus, FileText,
  AlertTriangle, Clock, TrendingUp, Receipt
} from "lucide-react";
import RevenueExpensesChart from "@/components/dashboard/RevenueExpensesChart";
import InteractiveCalendar from "@/components/dashboard/InteractiveCalendar";
import { Skeleton } from "@/components/ui/skeleton";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const Dashboard = () => {
  const empresaId = useEmpresa();
  const navigate = useNavigate();
  const hoje = new Date();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(hoje, { weekStartsOn: 1 }));
  const [agendaModalOpen, setAgendaModalOpen] = useState(false);
  const { data: googleStatus } = useGoogleCalendarStatus();
  const { data: googleEvents, isLoading: isLoadingGoogle } = useGoogleCalendarEvents(googleStatus?.connected ?? false);
  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);

  const { data: stats } = useQuery({
    queryKey: ["dashboard_stats_v3", empresaId],
    queryFn: async () => {
      const [receber, pagar, projetos, clientes, necessidades, visitas, projetoItens, compras] = await Promise.all([
        supabase.from("financeiro_receber").select("valor, status, data_vencimento, cliente_id, projeto_id, descricao").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("financeiro_pagar").select("valor, status, data_vencimento").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("projetos").select("id, status, nome, venda_total, custo_real, custo_previsto, lucro_real, cliente_id").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("clientes").select("id, nome").eq("deletado", false).then(r => r.data ?? []),
        (supabase.from("necessidades_compra" as any).select("id, descricao, quantidade, status, projeto_id, produto_id, projeto_item_id, projetos!inner(deletado)").eq("projetos.deletado", false) as any).then((r: any) => (r.data ?? []) as any[]),
        supabase.from("visitas_tecnicas").select("id, data, hora, descricao, status_visita, projeto_id, google_event_id").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("projeto_itens").select("id, preco_custo, quantidade").then(r => r.data ?? []),
        supabase.from("compras").select("id, valor_total, data_compra, status").eq("deletado", false).then(r => r.data ?? []),
      ]);

      const [produtosRes] = await Promise.all([
        supabase.from("produtos").select("id, nome, preco_custo").eq("deletado", false).then(r => r.data ?? []),
      ]);

      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));
      const projetoMap = Object.fromEntries(projetos.map(p => [p.id, p.nome]));
      const produtoMap = Object.fromEntries(produtosRes.map(p => [p.id, p]));
      const projetoItemMap = Object.fromEntries(projetoItens.map(pi => [pi.id, pi]));

      const itensPendentes = necessidades.filter(n => n.status === "pendente");
      const projetosAtivos = projetos.filter(p => p.status !== "cancelado" && p.status !== "concluido");

      // Calcular valor total dos itens a comprar
      let itensComprarValorTotal = 0;
      itensPendentes.forEach(n => {
        const qty = Number(n.quantidade) || 1;
        let custoUnit = 0;
        if (n.projeto_item_id && projetoItemMap[n.projeto_item_id]) {
          custoUnit = Number(projetoItemMap[n.projeto_item_id].preco_custo) || 0;
        } else if (n.produto_id && produtoMap[n.produto_id]) {
          custoUnit = Number(produtoMap[n.produto_id].preco_custo) || 0;
        }
        itensComprarValorTotal += custoUnit * qty;
      });

      const inadimplentes = receber
        .filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) < hoje)
        .map(r => ({
          ...r,
          clienteNome: r.cliente_id ? clienteMap[r.cliente_id] ?? "—" : "—",
          projetoNome: r.projeto_id ? projetoMap[r.projeto_id] ?? "—" : "—",
          diasAtraso: differenceInDays(hoje, new Date(r.data_vencimento!)),
        }))
        .sort((a, b) => b.diasAtraso - a.diasAtraso);

      const inadimplentesValorTotal = inadimplentes.reduce((a, r) => a + (r.valor ?? 0), 0);
      const clientesInadimplentesUnicos = new Set(inadimplentes.map(i => i.cliente_id).filter(Boolean)).size;

      // Total a Receber GERAL (todas as pendentes, independente do mês)
      const totalReceberGeral = receber
        .filter(r => r.status === "pendente" || r.status === "vencido")
        .reduce((a, r) => a + (r.valor ?? 0), 0);

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
        .filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) >= inicioMes && new Date(r.data_vencimento) <= fimMes)
        .reduce((a, r) => a + (r.valor ?? 0), 0);

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
  });

  return (
    <div className="space-y-6 stagger-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Visão geral · {format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* LINHA 1 – FINANCEIRO RECEITAS */}
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-2">Receitas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total a Receber (Geral) */}
          <div
            onClick={() => navigate("/financeiro/receber")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-[hsl(210,70%,50%)]/15 to-[hsl(210,70%,50%)]/5 rounded-xl border border-[hsl(210,70%,50%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(210,70%,50%)]/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total a Receber</p>
                <p className="text-2xl font-bold text-foreground mt-2 truncate">{fmt(stats?.totalReceberGeral ?? 0)}</p>
                <p className="text-[11px] text-[hsl(210,70%,50%)] mt-1">Todas as pendentes</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[hsl(210,70%,50%)]/20 text-[hsl(210,70%,50%)] group-hover:scale-110 transition-transform shrink-0">
                <TrendingUp size={20} />
              </div>
            </div>
          </div>

          {/* A Receber (Mês) */}
          <div
            onClick={() => navigate("/financeiro/receber")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-[hsl(152,69%,40%)]/15 to-[hsl(152,69%,40%)]/5 rounded-xl border border-[hsl(152,69%,40%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(152,69%,40%)]/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">A Receber (Mês)</p>
                <p className="text-2xl font-bold text-foreground mt-2 truncate">{fmt(stats?.receberMes ?? 0)}</p>
                <p className="text-[11px] text-[hsl(152,69%,40%)] mt-1">{format(hoje, "MMMM/yyyy", { locale: ptBR })}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[hsl(152,69%,40%)]/20 text-[hsl(152,69%,40%)] group-hover:scale-110 transition-transform shrink-0">
                <DollarSign size={20} />
              </div>
            </div>
          </div>

          {/* Inadimplentes */}
          <div
            onClick={() => navigate("/financeiro/receber")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-destructive/15 to-destructive/5 rounded-xl border border-destructive/20 p-5 shadow-sm hover:shadow-md hover:border-destructive/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Inadimplentes</p>
                <p className="text-2xl font-bold text-foreground mt-2 truncate">{fmt(stats?.inadimplentesValorTotal ?? 0)}</p>
                <p className="text-[11px] text-destructive mt-1">{stats?.clientesInadimplentesUnicos ?? 0} cliente(s) · {stats?.inadimplentesCount ?? 0} parcela(s)</p>
              </div>
              <div className="p-2.5 rounded-xl bg-destructive/20 text-destructive group-hover:scale-110 transition-transform shrink-0">
                <UserX size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LINHA 2 – CUSTOS E OPERAÇÃO */}
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-2">Custos & Operação</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Itens a Comprar (Total) */}
          <div
            onClick={() => navigate("/itens-comprar")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-[hsl(38,92%,50%)]/15 to-[hsl(38,92%,50%)]/5 rounded-xl border border-[hsl(38,92%,50%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(38,92%,50%)]/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Itens a Comprar</p>
                <p className="text-2xl font-bold text-foreground mt-2 truncate">{fmt(stats?.itensComprarValorTotal ?? 0)}</p>
                <p className="text-[11px] text-[hsl(38,92%,50%)] mt-1">{stats?.itensPendentesCount ?? 0} itens pendentes</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[hsl(38,92%,50%)]/20 text-[hsl(38,92%,50%)] group-hover:scale-110 transition-transform shrink-0">
                <ClipboardList size={20} />
              </div>
            </div>
          </div>

          {/* Compras do Mês */}
          <div
            onClick={() => navigate("/itens-comprar")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-[hsl(280,60%,50%)]/15 to-[hsl(280,60%,50%)]/5 rounded-xl border border-[hsl(280,60%,50%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(280,60%,50%)]/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">A Comprar (Mês)</p>
                <p className="text-2xl font-bold text-foreground mt-2 truncate">{fmt(stats?.comprasMesValor ?? 0)}</p>
                <p className="text-[11px] text-[hsl(280,60%,50%)] mt-1">{format(hoje, "MMMM/yyyy", { locale: ptBR })}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[hsl(280,60%,50%)]/20 text-[hsl(280,60%,50%)] group-hover:scale-110 transition-transform shrink-0">
                <Receipt size={20} />
              </div>
            </div>
          </div>

          {/* Total de Projetos */}
          <div
            onClick={() => navigate("/projetos")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl border border-primary/20 p-5 shadow-sm hover:shadow-md hover:border-primary/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Total de Projetos</p>
                <p className="text-3xl font-bold text-foreground mt-2">{stats?.projetosAtivosCount ?? 0}</p>
                <p className="text-[11px] text-primary mt-1">ativos (excl. cancelados)</p>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/20 text-primary group-hover:scale-110 transition-transform shrink-0">
                <FolderKanban size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LINHA 3 – DESPESAS + GRÁFICO */}
      <div>
        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-2">Despesas</p>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          {/* Contas a Pagar */}
          <div
            onClick={() => navigate("/financeiro/pagar")}
            className="cursor-pointer group card-interactive bg-gradient-to-br from-[hsl(0,70%,50%)]/15 to-[hsl(0,70%,50%)]/5 rounded-xl border border-[hsl(0,70%,50%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(0,70%,50%)]/40"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Contas a Pagar</p>
                <p className="text-2xl font-bold text-foreground mt-2 truncate">{fmt(stats?.pagarMes ?? 0)}</p>
                <p className="text-[11px] text-[hsl(0,70%,50%)] mt-1">Mês · Total: {fmt(stats?.pagarGeral ?? 0)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-[hsl(0,70%,50%)]/20 text-[hsl(0,70%,50%)] group-hover:scale-110 transition-transform shrink-0">
                <ShoppingCart size={20} />
              </div>
            </div>
          </div>

          {/* Gráfico Receitas vs Despesas */}
          <div className="max-h-[260px]">
            <RevenueExpensesChart
              receber={stats?.receber ?? []}
              pagar={stats?.pagar ?? []}
            />
          </div>
        </div>
      </div>




      {/* 2. AÇÕES RÁPIDAS */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <button
          onClick={() => navigate("/projetos")}
          className="btn-press flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-foreground text-xs font-medium transition-colors border border-border/50 w-full sm:w-auto"
        >
          <Plus size={14} />
          Novo Projeto
        </button>
        <button
          onClick={() => navigate("/crm")}
          className="btn-press flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-foreground text-xs font-medium transition-colors border border-border/50 w-full sm:w-auto"
        >
          <FileText size={14} />
          Novo Orçamento
        </button>
        <button
          onClick={() => navigate("/financeiro/receber")}
          className="btn-press flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg bg-[hsl(152,69%,40%)]/15 hover:bg-[hsl(152,69%,40%)]/25 text-[hsl(152,69%,40%)] text-xs font-semibold transition-colors border border-[hsl(152,69%,40%)]/30 w-full sm:w-auto"
        >
          <DollarSign size={14} />
          Financeiro
          <ArrowRight size={12} />
        </button>
      </div>

      {/* 3. CONTEÚDO PRINCIPAL – 3 blocos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* BLOCO 1 – Agenda Semanal Navegável */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border/60 p-6 shadow-[0_2px_16px_-4px_hsl(var(--foreground)/0.06)] backdrop-blur-sm">
          {/* Header with navigation */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CalendarDays size={15} className="text-primary" />
              </div>
              Agenda da Semana
            </h3>
            <div className="flex items-center gap-2">
              {googleStatus?.connected ? (
                <span className="text-[10px] text-[hsl(152,69%,40%)] bg-[hsl(152,69%,40%)]/8 px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(152,69%,40%)] animate-pulse" /> Google Agenda
                </span>
              ) : (
                <button
                  onClick={() => navigate("/integracoes")}
                  className="text-[10px] text-primary bg-primary/8 px-3 py-1 rounded-full hover:bg-primary/15 transition-all cursor-pointer font-medium"
                >
                  Conectar Google Agenda →
                </button>
              )}
              <button
                onClick={() => setAgendaModalOpen(true)}
                className="text-[11px] text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                Ver Completa <ArrowRight size={10} />
              </button>
            </div>
          </div>

          {/* Week navigation */}
          <div className="flex items-center justify-between mt-3 mb-4">
            <button
              onClick={() => setCurrentWeekStart(prev => subWeeks(prev, 1))}
              className="p-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-foreground">
                {format(currentWeekStart, "dd MMM", { locale: ptBR })} — {format(addDays(currentWeekStart, 6), "dd MMM yyyy", { locale: ptBR })}
              </span>
              {!isSameDay(currentWeekStart, startOfWeek(hoje, { weekStartsOn: 1 })) && (
                <button
                  onClick={() => setCurrentWeekStart(startOfWeek(hoje, { weekStartsOn: 1 }))}
                  className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-all"
                >
                  Hoje
                </button>
              )}
            </div>
            <button
              onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))}
              className="p-2 rounded-lg bg-secondary/40 hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekly calendar grid */}
          {(() => {
            const days = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
            const visitas = stats?.proximasVisitas ?? [];

            type UnifiedEvent = {
              id: string;
              title: string;
              date: string;
              hora: string;
              descricao?: string;
              source: "local" | "google";
            };

            // Filter local visitas to current week
            const weekEnd = addDays(currentWeekStart, 6);
            const localEvents: UnifiedEvent[] = (stats?.proximasVisitas ?? [])
              .filter(v => {
                if (!v.data) return false;
                const d = new Date(v.data + "T00:00:00");
                return d >= currentWeekStart && d <= weekEnd;
              })
              .map(v => ({
                id: v.id,
                title: v.projetoNome || "Visita técnica",
                date: v.data ?? "",
                hora: v.hora ?? "",
                descricao: v.descricao ?? undefined,
                source: "local" as const,
              }));

            const linkedGoogleIds = new Set(
              visitas.filter(v => (v as any).google_event_id).map(v => (v as any).google_event_id)
            );

            const gEvents: UnifiedEvent[] = (googleEvents ?? [])
              .filter(e => !linkedGoogleIds.has(e.id))
              .map(e => {
                const startStr = e.start || "";
                let eventDate = "";
                let eventTime = "";
                if (startStr.includes("T")) {
                  const dt = new Date(startStr);
                  eventDate = format(dt, "yyyy-MM-dd");
                  eventTime = format(dt, "HH:mm");
                } else {
                  eventDate = startStr;
                }
                return {
                  id: e.id,
                  title: e.summary || "Sem título",
                  date: eventDate,
                  hora: eventTime,
                  descricao: e.description || undefined,
                  source: "google" as const,
                };
              })
              .filter(e => {
                if (!e.date) return false;
                const d = new Date(e.date + "T00:00:00");
                return d >= currentWeekStart && d <= weekEnd;
              });

            const allEvents = [...localEvents, ...gEvents];
            const isLoading = isLoadingGoogle && googleStatus?.connected;

            return (
              <div>
                {isLoading ? (
                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <Skeleton key={i} className="h-[180px] rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1.5 overflow-x-auto">
                    {days.map((day, idx) => {
                      const isCurrentDay = isTodayFn(day);
                      const dayEvents = allEvents
                        .filter(ev => ev.date && isSameDay(new Date(ev.date + "T00:00:00"), day))
                        .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));
                      const dayName = format(day, "EEE", { locale: ptBR });
                      const dayNum = format(day, "dd");
                      const monthName = format(day, "MMM", { locale: ptBR });

                      return (
                        <div
                          key={idx}
                          className={`flex flex-col rounded-xl border min-h-[160px] transition-all ${
                            isCurrentDay
                              ? "border-primary/40 bg-primary/5 shadow-sm"
                              : "border-border/40 bg-secondary/10 hover:bg-secondary/20"
                          }`}
                        >
                          <div className={`text-center py-2 rounded-t-xl ${isCurrentDay ? "bg-primary/10" : ""}`}>
                            <p className={`text-[10px] uppercase font-semibold tracking-wider ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                              {dayName}
                            </p>
                            <p className={`text-lg font-bold leading-tight ${isCurrentDay ? "text-primary" : "text-foreground"}`}>
                              {dayNum}
                            </p>
                            <p className="text-[9px] text-muted-foreground uppercase">{monthName}</p>
                          </div>

                          <div className="flex-1 px-1.5 pb-1.5 space-y-1 overflow-y-auto max-h-[140px]">
                            {dayEvents.length > 0 ? (
                              dayEvents.map((ev, vi) => {
                                const isPast = isBefore(new Date(ev.date + "T23:59:59"), hoje) && !isTodayFn(new Date(ev.date + "T00:00:00"));
                                const tagColor = isCurrentDay
                                  ? "border-l-[hsl(152,69%,40%)]"
                                  : isPast
                                  ? "border-l-destructive"
                                  : "border-l-[hsl(210,70%,50%)]";
                                const isGoogle = ev.source === "google";

                                return (
                                  <div
                                    key={`${ev.source}-${ev.id}-${vi}`}
                                    onClick={() => isGoogle ? undefined : navigate("/projetos")}
                                    className={`group ${isGoogle ? "" : "cursor-pointer"} p-1.5 rounded-lg border-l-[3px] ${tagColor} bg-card/80 hover:bg-card hover:shadow-sm transition-all`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <p className="text-[10px] font-semibold text-primary/80">{ev.hora || "—"}</p>
                                      {isGoogle && (
                                        <span className="text-[8px] px-1 py-px rounded bg-[hsl(210,70%,50%)]/15 text-[hsl(210,70%,50%)] font-medium leading-none">G</span>
                                      )}
                                    </div>
                                    <p className="text-[10px] font-medium text-foreground truncate leading-tight">{ev.title}</p>
                                    {ev.descricao && (
                                      <p className="text-[9px] text-muted-foreground truncate">{ev.descricao}</p>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <p className="text-[9px] text-muted-foreground/40">—</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => navigate("/cronograma")}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/8 hover:bg-primary/15 text-primary text-xs font-medium transition-all border border-primary/10 hover:border-primary/20"
                >
                  <Plus size={13} />
                  Nova Visita
                </button>
              </div>
            );
          })()}
        </div>

        {/* Agenda Modal */}
        <Dialog open={agendaModalOpen} onOpenChange={setAgendaModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarDays size={18} className="text-primary" />
                Agenda Completa
              </DialogTitle>
            </DialogHeader>
            {(() => {
              // Show 4 weeks in modal
              const modalWeekStart = startOfWeek(hoje, { weekStartsOn: 1 });
              const weeks = Array.from({ length: 4 }, (_, w) => {
                const ws = addDays(modalWeekStart, w * 7);
                return Array.from({ length: 7 }, (_, d) => addDays(ws, d));
              });

              const visitas = stats?.proximasVisitas ?? [];
              const linkedGoogleIds = new Set(
                visitas.filter(v => (v as any).google_event_id).map(v => (v as any).google_event_id)
              );

              const allGoogleEvents = (googleEvents ?? [])
                .filter(e => !linkedGoogleIds.has(e.id))
                .map(e => {
                  const startStr = e.start || "";
                  let eventDate = "";
                  let eventTime = "";
                  if (startStr.includes("T")) {
                    const dt = new Date(startStr);
                    eventDate = format(dt, "yyyy-MM-dd");
                    eventTime = format(dt, "HH:mm");
                  } else {
                    eventDate = startStr;
                  }
                  return { id: e.id, title: e.summary || "Sem título", date: eventDate, hora: eventTime, descricao: e.description || undefined, source: "google" as const };
                });

              const allLocalEvents = visitas.map(v => ({
                id: v.id,
                title: v.projetoNome || "Visita técnica",
                date: v.data ?? "",
                hora: v.hora ?? "",
                descricao: v.descricao ?? undefined,
                source: "local" as const,
              }));

              const mergedEvents = [...allLocalEvents, ...allGoogleEvents];

              return (
                <div className="space-y-4">
                  {weeks.map((week, wi) => (
                    <div key={wi}>
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                        {format(week[0], "dd MMM", { locale: ptBR })} — {format(week[6], "dd MMM", { locale: ptBR })}
                      </p>
                      <div className="grid grid-cols-7 gap-1">
                        {week.map((day, di) => {
                          const isCurrentDay = isTodayFn(day);
                          const dayEvents = mergedEvents
                            .filter(ev => ev.date && isSameDay(new Date(ev.date + "T00:00:00"), day))
                            .sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? ""));

                          return (
                            <div key={di} className={`rounded-lg border min-h-[80px] p-1 ${isCurrentDay ? "border-primary/40 bg-primary/5" : "border-border/30 bg-secondary/5"}`}>
                              <p className={`text-[9px] text-center font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
                                {format(day, "EEE dd", { locale: ptBR })}
                              </p>
                              <div className="space-y-0.5 mt-1">
                                {dayEvents.map((ev, ei) => (
                                  <div key={ei} className="px-1 py-0.5 rounded bg-card/80 border-l-2 border-l-primary/40">
                                    <p className="text-[8px] font-medium text-foreground truncate">{ev.hora} {ev.title}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* BLOCO 2 – Itens a Comprar */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package size={16} className="text-[hsl(38,92%,50%)]" />
              Itens a Comprar
            </h3>
            <button
              onClick={() => navigate("/itens-comprar")}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ExternalLink size={10} />
            </button>
          </div>
          {(stats?.itensComprarDetalhados?.length ?? 0) > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {stats!.itensComprarDetalhados.map((item, i) => (
                <div key={i} className="list-item-hover p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{item.produtoNome}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.projetoNome}</p>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <p className="text-xs font-semibold text-foreground">{fmt(item.custoUnit * (Number(item.quantidade) || 1))}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(38,92%,50%)]/15 text-[hsl(38,92%,50%)]">pendente</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum item pendente.</p>
          )}
        </div>

        {/* BLOCO 3 – Status dos Projetos */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderKanban size={16} className="text-primary" />
              Status dos Projetos
            </h3>
            <button
              onClick={() => navigate("/projetos")}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ExternalLink size={10} />
            </button>
          </div>
          {(stats?.statusCounts?.length ?? 0) > 0 ? (
            <div className="space-y-2">
              {stats!.statusCounts.map(s => (
                <div key={s.key} className="list-item-hover flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-foreground">{s.label}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">{s.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum projeto.</p>
          )}
        </div>
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
                  <p className="text-xs font-bold text-destructive">{fmt(item.valor ?? 0)}</p>
                  <p className="text-[10px] text-destructive/70">{item.diasAtraso}d atraso</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
