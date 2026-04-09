import { useNavigate } from "react-router-dom";
import {
  DollarSign, FolderKanban, ShoppingCart, ClipboardList, UserX,
  CalendarDays, ArrowRight, Package, ExternalLink, Plus, FileText,
  AlertTriangle, Clock
} from "lucide-react";
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
  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);

  const { data: stats } = useQuery({
    queryKey: ["dashboard_stats_v3", empresaId],
    queryFn: async () => {
      const [receber, pagar, projetos, clientes, necessidades, visitas, projetoItens] = await Promise.all([
        supabase.from("financeiro_receber").select("valor, status, data_vencimento, cliente_id, projeto_id, descricao").then(r => r.data ?? []),
        supabase.from("financeiro_pagar").select("valor, status, data_vencimento").then(r => r.data ?? []),
        supabase.from("projetos").select("id, status, nome, venda_total, custo_real, custo_previsto, lucro_real, cliente_id").then(r => r.data ?? []),
        supabase.from("clientes").select("id, nome").then(r => r.data ?? []),
        supabase.from("necessidades_compra").select("id, descricao, quantidade, status, projeto_id, produto_id, projeto_item_id").then(r => r.data ?? []),
        supabase.from("visitas_tecnicas").select("id, data, hora, descricao, status_visita, projeto_id").then(r => r.data ?? []),
        supabase.from("projeto_itens").select("id, preco_custo, quantidade").then(r => r.data ?? []),
      ]);

      const [produtosRes] = await Promise.all([
        supabase.from("produtos").select("id, nome, preco_custo").then(r => r.data ?? []),
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

      const receberMes = receber
        .filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) >= inicioMes && new Date(r.data_vencimento) <= fimMes)
        .reduce((a, r) => a + (r.valor ?? 0), 0);

      // Status operacionais
      const statusOperacionais = [
        { key: "infraestrutura", label: "Infraestrutura", color: "hsl(200, 80%, 55%)" },
        { key: "instalacao", label: "Instalação", color: "hsl(38, 92%, 50%)" },
        { key: "cabeamento", label: "Cabeamento", color: "hsl(280, 60%, 50%)" },
        { key: "programacao", label: "Programação", color: "hsl(152, 69%, 40%)" },
        { key: "personalizacao", label: "Personalização", color: "hsl(340, 70%, 50%)" },
        { key: "em_andamento", label: "Em Andamento", color: "hsl(210, 70%, 50%)" },
        { key: "pos_venda", label: "Pós-venda", color: "hsl(170, 60%, 45%)" },
        { key: "concluido", label: "Concluído", color: "hsl(140, 60%, 40%)" },
      ];
      const statusCounts = statusOperacionais
        .map(s => ({ ...s, count: projetos.filter(p => p.status === s.key).length }))
        .filter(s => s.count > 0);

      // Visitas próximas
      const proximasVisitas = visitas
        .filter(v => v.data && new Date(v.data) >= hoje && v.status_visita !== "cancelada")
        .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())
        .slice(0, 5)
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
        projetosAtivosCount: projetosAtivos.length,
        statusCounts,
        proximasVisitas,
        itensComprarDetalhados,
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

      {/* 1. INDICADORES PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Itens a Comprar */}
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
        {/* BLOCO 1 – Agenda de Visitas */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              Agenda de Visitas
            </h3>
            <button
              onClick={() => navigate("/cronograma")}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ExternalLink size={10} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              Google Workspace (em breve)
            </span>
          </div>
          {(stats?.proximasVisitas?.length ?? 0) > 0 ? (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {stats!.proximasVisitas.map((v, i) => (
                <div key={i} className="list-item-hover flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-primary/15 text-primary shrink-0">
                    <span className="text-xs font-bold leading-tight">{v.data ? format(new Date(v.data), "dd") : "—"}</span>
                    <span className="text-[9px] uppercase">{v.data ? format(new Date(v.data), "MMM", { locale: ptBR }) : ""}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{v.projetoNome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{v.hora ?? "—"} · {v.descricao ?? "Visita técnica"}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                    v.status_visita === "agendada" ? "bg-primary/15 text-primary" :
                    v.status_visita === "realizada" ? "bg-[hsl(152,69%,40%)]/15 text-[hsl(152,69%,40%)]" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {v.status_visita}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma visita agendada.</p>
          )}
        </div>

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
