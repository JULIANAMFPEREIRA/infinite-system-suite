import { useEffect, useState, useMemo, Fragment, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { calcFaltaComprar } from "@/lib/calcFaltaComprar";
import { debounce } from "lodash";

import {
  DollarSign, FolderKanban, ShoppingCart, ClipboardList, UserX,
  CalendarDays, ArrowRight, Package, ExternalLink, Plus, FileText,
  AlertTriangle, Clock, TrendingUp, Receipt, Wallet, ArrowDownRight, ArrowUpRight, Scale,
  PiggyBank, Info, Save, StickyNote
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Separator } from "@/components/ui/separator";
import RevenueExpensesChart from "@/components/dashboard/RevenueExpensesChart";
import InteractiveCalendar from "@/components/dashboard/InteractiveCalendar";
 import { Skeleton } from "@/components/ui/skeleton";
 import {
   Dialog,
   DialogContent,
   DialogHeader,
   DialogTitle,
 } from "@/components/ui/dialog";

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

  const [anotacoes, setAnotacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Buscar anotações do usuário
  const { data: anotacoesData, isLoading: isLoadingAnotacoes } = useQuery({
    queryKey: ["anotacoes_usuario", user?.id, empresaId],
    queryFn: async () => {
      if (!user?.id || !empresaId) return null;
      const { data, error } = await supabase
        .from("anotacoes_usuario" as any)
        .select("conteudo")
        .eq("user_id", user.id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && !!empresaId,
  });

  // Atualizar estado local quando os dados forem carregados
  useEffect(() => {
    if (anotacoesData) {
      setAnotacoes((anotacoesData as any).conteudo || "");
    }
  }, [anotacoesData]);

  // Função para salvar anotações
  const handleSaveAnotacoes = async (conteudo: string) => {
    if (!user?.id || !empresaId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("anotacoes_usuario" as any)
        .upsert({
          user_id: user.id,
          empresa_id: empresaId,
          conteudo: conteudo,
        }, { onConflict: "user_id,empresa_id" });

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao salvar anotações:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Debounce para auto-save
  const debouncedSave = useCallback(
    debounce((nextValue: string) => handleSaveAnotacoes(nextValue), 2000),
    [user?.id, empresaId]
  );

  const handleAnotacoesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setAnotacoes(newValue);
    debouncedSave(newValue);
  };

  const { data: empresa } = useQuery({
    queryKey: ["empresa_config", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await supabase
        .from("empresas")
        .select("saldo_inicial")
        .eq("id", empresaId)
        .maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: financasPessoais } = useQuery({

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
        supabase.from("financeiro_receber").select("*").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("financeiro_pagar").select("*").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("projetos").select("*").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("clientes").select("*").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("visitas_tecnicas").select("*").eq("deletado", false).then(r => r.data ?? []),
        supabase.from("compras").select("*").eq("deletado", false).then(r => r.data ?? []),
      ]);

      // Buscar orçamentos aprovados com frete/imposto
      const { data: orcAprovados } = await supabase
        .from("crm_orcamentos")
        .select("id, frete, imposto")
        .eq("aprovado", true);

      const orcIds = (orcAprovados ?? []).map(o => o.id);
      let itensComprarValorTotal = 0;
      let itensPendentesCount = 0;

      if (orcIds.length === 0) {
        itensComprarValorTotal = 0;
        itensPendentesCount = 0;
      } else {
        const { data: itensPend } = await supabase
          .from("crm_itens")
          .select("quantidade, preco_custo, rt_comissao, rt_valor_pago, status_compra, orcamento_id")
          .in("orcamento_id", orcIds);

        // Calculate faltaComprar per approved budget and sum them up
        itensComprarValorTotal = (orcAprovados ?? []).reduce((acc, orc) => {
          const orcItens = (itensPend ?? []).filter(i => i.orcamento_id === orc.id);
          const stats = calcFaltaComprar(orcItens, Number(orc.frete) || 0, Number(orc.imposto) || 0);
          return acc + stats.faltaComprar;
        }, 0);

        itensPendentesCount = (itensPend ?? []).filter(i => i.status_compra === "pendente").length;
      }
      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));
      const projetoMap = Object.fromEntries(projetos.map(p => [p.id, p.nome]));
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

      // A RECEBER = pendentes/parciais NÃO vencidos
      const totalAReceber = receber
        .filter(r => {
          if (r.status === "pago" || r.status === "cancelado") return false;
          const saldoR = saldo(r);
          if (saldoR <= 0) return false;
          if (!r.data_vencimento) return true;
          return new Date(r.data_vencimento) >= hoje;
        })
        .reduce((a, r) => a + saldo(r), 0);

      // Para saldo previsto, ainda precisamos do total geral (incluindo inadimplentes)
      const totalReceberGeralParaSaldo = receber
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
      
      const saldoInicial = Number((empresa as any)?.saldo_inicial) || 0;
      const saldoAtual = saldoInicial + totalRecebido - totalPagoEfetivo;
      const saldoPrevisto = saldoAtual + totalReceberGeralParaSaldo - pagarGeral;

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
      const itensComprarDetalhados: any[] = [];

      return {
        itensPendentesCount,
        itensComprarValorTotal,
        inadimplentes,
        inadimplentesCount: inadimplentes.length,
        inadimplentesValorTotal,
        clientesInadimplentesUnicos,
        receberMes,
        totalAReceber,
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
      "crm_itens",
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

      {/* CONTEÚDO SUPERIOR – KPIs & ANOTAÇÕES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lado Esquerdo: 6 Cards de Resumo em 2x3 */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
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
            <p className="text-2xl font-bold text-foreground">{fmt(stats?.totalAReceber ?? 0)}</p>
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
            onClick={() => navigate("/falta-comprar")}
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

        {/* Lado Direito: Bloco de Anotações */}
        <div className="md:col-span-1 h-full">
          <div className="bg-card rounded-xl border border-border p-5 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <StickyNote size={16} className="text-primary" />
                📝 Minhas Anotações
              </h3>
              {isSaving && (
                <span className="text-[10px] text-muted-foreground animate-pulse">
                  Salvando...
                </span>
              )}
            </div>
            <div className="relative flex-1 flex flex-col">
              <textarea
                value={anotacoes}
                onChange={handleAnotacoesChange}
                placeholder="Escreva seus lembretes e anotações aqui..."
                className="w-full flex-1 min-h-[300px] p-4 text-sm bg-secondary/20 border border-border/50 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/50 transition-all leading-relaxed"
                style={{ height: 'auto' }}
              />
              <button
                onClick={() => handleSaveAnotacoes(anotacoes)}
                disabled={isSaving}
                className="absolute bottom-3 right-3 p-2 rounded-md bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
                title="Salvar agora"
              >
                <Save size={14} />
              </button>
            </div>
          </div>
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
