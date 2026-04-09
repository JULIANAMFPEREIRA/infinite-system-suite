import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  DollarSign, FolderKanban, ShoppingCart, AlertTriangle, Clock,
  ClipboardList, UserX, CalendarDays, ArrowRight, Package, ExternalLink
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
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
    queryKey: ["dashboard_stats_v2", empresaId],
    queryFn: async () => {
      const [receber, pagar, projetos, clientes, necessidades, visitas, compras] = await Promise.all([
        supabase.from("financeiro_receber").select("valor, status, data_vencimento, cliente_id, projeto_id, descricao").then(r => r.data ?? []),
        supabase.from("financeiro_pagar").select("valor, status, data_vencimento").then(r => r.data ?? []),
        supabase.from("projetos").select("id, status, nome, venda_total, custo_real, custo_previsto, lucro_real, cliente_id").then(r => r.data ?? []),
        supabase.from("clientes").select("id, nome").then(r => r.data ?? []),
        supabase.from("necessidades_compra").select("id, descricao, quantidade, status, projeto_id, produto_id").then(r => r.data ?? []),
        supabase.from("visitas_tecnicas").select("id, data, hora, descricao, status_visita, projeto_id").then(r => r.data ?? []),
        supabase.from("compras").select("id, valor_total, status").then(r => r.data ?? []),
      ]);

      const [produtosRes, projetosNomes] = await Promise.all([
        supabase.from("produtos").select("id, nome").then(r => r.data ?? []),
        projetos,
      ]);

      const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c.nome]));
      const projetoMap = Object.fromEntries(projetos.map(p => [p.id, p.nome]));
      const produtoMap = Object.fromEntries(produtosRes.map(p => [p.id, p.nome]));

      // Cards
      const itensPendentes = necessidades.filter(n => n.status === "pendente");
      const projetosAtivos = projetos.filter(p => p.status !== "cancelado" && p.status !== "concluido");

      const inadimplentes = receber
        .filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) < hoje)
        .map(r => ({
          ...r,
          clienteNome: r.cliente_id ? clienteMap[r.cliente_id] ?? "—" : "—",
          projetoNome: r.projeto_id ? projetoMap[r.projeto_id] ?? "—" : "—",
          diasAtraso: differenceInDays(hoje, new Date(r.data_vencimento!)),
        }))
        .sort((a, b) => b.diasAtraso - a.diasAtraso);

      const receberMes = receber
        .filter(r => r.status === "pendente" && r.data_vencimento && new Date(r.data_vencimento) >= inicioMes && new Date(r.data_vencimento) <= fimMes)
        .reduce((a, r) => a + (r.valor ?? 0), 0);

      // Status chart
      const statusCounts: Record<string, number> = {};
      projetos.forEach(p => { statusCounts[p.status ?? "orcamento"] = (statusCounts[p.status ?? "orcamento"] || 0) + 1; });

      // Top projetos
      const topProjetos = projetos
        .filter(p => (p.venda_total ?? 0) > 0)
        .sort((a, b) => (b.venda_total ?? 0) - (a.venda_total ?? 0))
        .slice(0, 5);

      // Visitas próximas
      const proximasVisitas = visitas
        .filter(v => v.data && new Date(v.data) >= hoje && v.status_visita !== "cancelada")
        .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime())
        .slice(0, 5)
        .map(v => ({
          ...v,
          projetoNome: v.projeto_id ? projetoMap[v.projeto_id] ?? "—" : "—",
        }));

      // Itens a comprar detalhados
      const itensComprarDetalhados = itensPendentes.slice(0, 8).map(n => ({
        ...n,
        projetoNome: n.projeto_id ? projetoMap[n.projeto_id] ?? "—" : "—",
        produtoNome: n.produto_id ? produtoMap[n.produto_id] ?? (n.descricao ?? "—") : (n.descricao ?? "—"),
      }));

      // Contas vencidas pagar
      const contasVencidasPagar = pagar.filter(p => p.status === "pendente" && p.data_vencimento && new Date(p.data_vencimento) < hoje).length;

      // Custo excedido
      const custoExcedido = projetos.filter(p => (p.custo_real ?? 0) > (p.custo_previsto ?? 0) && (p.custo_previsto ?? 0) > 0);

      return {
        itensPendentesCount: itensPendentes.length,
        inadimplentes,
        inadimplentesCount: inadimplentes.length,
        receberMes,
        projetosAtivosCount: projetosAtivos.length,
        statusCounts,
        topProjetos,
        proximasVisitas,
        itensComprarDetalhados,
        contasVencidasPagar,
        custoExcedido,
      };
    },
    enabled: !!empresaId,
    refetchInterval: 30000,
  });

  const projectStatusData = [
    { name: "Em Andamento", value: stats?.statusCounts?.em_andamento ?? 0, color: "hsl(200, 80%, 55%)" },
    { name: "Aprovado", value: stats?.statusCounts?.aprovado ?? 0, color: "hsl(152, 69%, 40%)" },
    { name: "Proposta", value: stats?.statusCounts?.proposta ?? 0, color: "hsl(38, 92%, 50%)" },
    { name: "Vendido", value: stats?.statusCounts?.vendido ?? 0, color: "hsl(280, 60%, 50%)" },
    { name: "Concluído", value: stats?.statusCounts?.concluido ?? 0, color: "hsl(140, 60%, 40%)" },
    { name: "Orçamento", value: stats?.statusCounts?.orcamento ?? 0, color: "hsl(220, 10%, 45%)" },
  ].filter(d => d.value > 0);

  const totalAlertas = (stats?.inadimplentesCount ?? 0) + (stats?.contasVencidasPagar ?? 0) + (stats?.custoExcedido?.length ?? 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Visão geral do INFINIT SYSTEM</p>
        </div>
        <button
          onClick={() => navigate("/financeiro/receber")}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[hsl(152,69%,40%)] hover:bg-[hsl(152,69%,35%)] text-white font-semibold text-sm transition-colors shadow-lg shadow-[hsl(152,69%,40%)]/20"
        >
          <DollarSign size={18} />
          Financeiro
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Alertas */}
      {totalAlertas > 0 && (
        <div className="space-y-2">
          {(stats?.inadimplentesCount ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle size={16} className="text-destructive" />
              <span className="text-xs text-destructive font-medium">{stats!.inadimplentesCount} parcela(s) vencida(s) — clientes inadimplentes</span>
            </div>
          )}
          {(stats?.contasVencidasPagar ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle size={16} className="text-destructive" />
              <span className="text-xs text-destructive font-medium">{stats!.contasVencidasPagar} conta(s) a pagar vencida(s)</span>
            </div>
          )}
          {(stats?.custoExcedido?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <Clock size={16} className="text-warning" />
              <span className="text-xs text-warning font-medium">{stats!.custoExcedido.length} projeto(s) com custo excedido</span>
            </div>
          )}
        </div>
      )}

      {/* Cards Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Itens a Comprar */}
        <div
          onClick={() => navigate("/itens-comprar")}
          className="cursor-pointer group bg-gradient-to-br from-[hsl(38,92%,50%)]/15 to-[hsl(38,92%,50%)]/5 rounded-xl border border-[hsl(38,92%,50%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(38,92%,50%)]/40 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Itens a Comprar</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats?.itensPendentesCount ?? 0}</p>
              <p className="text-[11px] text-[hsl(38,92%,50%)] mt-1">itens pendentes</p>
            </div>
            <div className="p-3 rounded-xl bg-[hsl(38,92%,50%)]/20 text-[hsl(38,92%,50%)] group-hover:scale-110 transition-transform">
              <ClipboardList size={22} />
            </div>
          </div>
        </div>

        {/* Inadimplentes */}
        <div
          className="cursor-pointer group bg-gradient-to-br from-destructive/15 to-destructive/5 rounded-xl border border-destructive/20 p-5 shadow-sm hover:shadow-md hover:border-destructive/40 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Inadimplentes</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats?.inadimplentesCount ?? 0}</p>
              <p className="text-[11px] text-destructive mt-1">parcelas vencidas</p>
            </div>
            <div className="p-3 rounded-xl bg-destructive/20 text-destructive group-hover:scale-110 transition-transform">
              <UserX size={22} />
            </div>
          </div>
        </div>

        {/* A Receber (Mês) */}
        <div
          onClick={() => navigate("/financeiro/receber")}
          className="cursor-pointer group bg-gradient-to-br from-[hsl(152,69%,40%)]/15 to-[hsl(152,69%,40%)]/5 rounded-xl border border-[hsl(152,69%,40%)]/20 p-5 shadow-sm hover:shadow-md hover:border-[hsl(152,69%,40%)]/40 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">A Receber (Mês)</p>
              <p className="text-2xl font-bold text-foreground mt-2">{fmt(stats?.receberMes ?? 0)}</p>
              <p className="text-[11px] text-[hsl(152,69%,40%)] mt-1">{format(hoje, "MMMM/yyyy", { locale: ptBR })}</p>
            </div>
            <div className="p-3 rounded-xl bg-[hsl(152,69%,40%)]/20 text-[hsl(152,69%,40%)] group-hover:scale-110 transition-transform">
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        {/* Total de Projetos */}
        <div
          onClick={() => navigate("/projetos")}
          className="cursor-pointer group bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl border border-primary/20 p-5 shadow-sm hover:shadow-md hover:border-primary/40 transition-all"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total de Projetos</p>
              <p className="text-3xl font-bold text-foreground mt-2">{stats?.projetosAtivosCount ?? 0}</p>
              <p className="text-[11px] text-primary mt-1">ativos (excl. cancelados)</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/20 text-primary group-hover:scale-110 transition-transform">
              <FolderKanban size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Row: Inadimplência + Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Inadimplência */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserX size={16} className="text-destructive" />
              Inadimplência
            </h3>
            <span className="text-[11px] text-destructive font-medium bg-destructive/10 px-2 py-0.5 rounded-full">
              {stats?.inadimplentesCount ?? 0} registro(s)
            </span>
          </div>
          {(stats?.inadimplentes?.length ?? 0) > 0 ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {stats!.inadimplentes.slice(0, 10).map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.clienteNome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{item.projetoNome}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-xs font-bold text-destructive">{fmt(item.valor ?? 0)}</p>
                    <p className="text-[10px] text-destructive/70">{item.diasAtraso} dia(s) atraso</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum cliente inadimplente 🎉</p>
          )}
        </div>

        {/* Agenda de Visitas */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays size={16} className="text-primary" />
              Agenda de Visitas
            </h3>
            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              Google Workspace (em breve)
            </span>
          </div>
          {(stats?.proximasVisitas?.length ?? 0) > 0 ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {stats!.proximasVisitas.map((v, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-primary/15 text-primary">
                      <span className="text-xs font-bold leading-tight">{v.data ? format(new Date(v.data), "dd") : "—"}</span>
                      <span className="text-[9px] uppercase">{v.data ? format(new Date(v.data), "MMM", { locale: ptBR }) : ""}</span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{v.projetoNome}</p>
                      <p className="text-[11px] text-muted-foreground">{v.hora ?? "Horário não definido"} — {v.descricao ?? "Visita técnica"}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
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
      </div>

      {/* Row: Itens a Comprar + Status Projetos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Itens a Comprar */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package size={16} className="text-[hsl(38,92%,50%)]" />
              Itens a Comprar (Pendentes)
            </h3>
            <button
              onClick={() => navigate("/itens-comprar")}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Ver todos <ExternalLink size={10} />
            </button>
          </div>
          {(stats?.itensComprarDetalhados?.length ?? 0) > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Produto</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Projeto</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Qtd</th>
                    <th className="text-center py-2 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats!.itensComprarDetalhados.map((item, i) => (
                    <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="py-2.5 text-foreground">{item.produtoNome}</td>
                      <td className="py-2.5 text-muted-foreground">{item.projetoNome}</td>
                      <td className="py-2.5 text-center text-foreground">{item.quantidade ?? 1}</td>
                      <td className="py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-[hsl(38,92%,50%)]/15 text-[hsl(38,92%,50%)]">
                          pendente
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum item pendente para compra.</p>
          )}
        </div>

        {/* Status dos Projetos */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <FolderKanban size={16} className="text-primary" />
            Status dos Projetos
          </h3>
          {projectStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={projectStatusData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" stroke="none">
                    {projectStatusData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(222, 15%, 16%)", border: "1px solid hsl(222, 12%, 25%)", borderRadius: "6px", fontSize: "12px", color: "hsl(220, 10%, 88%)" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {projectStatusData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum projeto.</p>
          )}
        </div>
      </div>

      {/* Top Projetos */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FolderKanban size={16} className="text-primary" />
          Top Projetos por Venda
        </h3>
        {(stats?.topProjetos?.length ?? 0) > 0 ? (
          <div className="space-y-2">
            {stats!.topProjetos.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-xs text-foreground font-medium">{p.nome}</span>
                </div>
                <div className="flex gap-5 text-[11px]">
                  <span className="text-muted-foreground">Venda: <strong className="text-foreground">{fmt(p.venda_total ?? 0)}</strong></span>
                  <span className="text-muted-foreground">Lucro: <strong className={(p.lucro_real ?? 0) >= 0 ? "text-[hsl(152,69%,40%)]" : "text-destructive"}>{fmt(p.lucro_real ?? 0)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum projeto com vendas.</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
